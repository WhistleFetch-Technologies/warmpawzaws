/**
 * ============================================================================
 * CUSTOMER ENDPOINTS - ENHANCED VERSION (PHASE 5)
 * ============================================================================
 * 
 * Migrated to use:
 * - BaseHandlerEnhanced for CloudWatch logging and error handling
 * - API Contracts (Zod) for validation
 * - Standardized response format
 * 
 * Endpoints:
 * - GET /customer/:customerId - Get customer profile
 * - GET /customer/by-phone - Get customer by phone
 * - PUT /customer/:customerId - Update customer profile
 * - GET /customer/:customerId/pets - Get customer pets
 * - POST /customer/:customerId/pets - Add pet
 * 
 * Date: 2026-01-28
 * Phase: 5
 * ============================================================================
 */

import { Hono } from 'hono';
import * as enhanced_base_handlersRepo from '../repos/enhanced-base-handlers.repo';
import { randomUUID } from 'crypto';
import { BaseHandlerEnhanced, HandlerContext, HandlerResponse } from '../../../../handler/base-handler-enhanced';
import {
  UpdateCustomerProfileRequestSchema,
  AddPetRequestSchema,
} from '@warmpawz/api-contracts/customers';
import { normalizeDbRow, normalizeDbRows, extractEntityIds } from '../../../../utils/entity-extractor';
import { isValidUUID } from '../../../../types/entities';
import { presignS3GetUrlIfApplicable } from '../../../../utils/s3-media-presign';
import {
  extractHealthRecordsForClient,
  extractVaccinationsForClient,
} from '../../../../utils/pet-health-normalize';
import {
  normalizeBloodTypeForStorage,
  resolveBloodTypeFromPayload,
} from '../../../../lib/pet-blood-types';
import { validatePetCreatePayload } from '../../../../utils/pet-create-validation';
import { buildSinglePetCreateLoyaltyFields } from '../../../../lib/pet-loyalty-response';
import { findCustomerByPhone } from '../../../../utils/customer-phone-lookup';
import { getDiscoveryRules } from '../../../../lib/rule-engine';
import {
  resolveCustomerMealPlanOrderDisplayTotals,
} from '../../../../utils/meal-order-pricing';
import {
  resolveEffectiveMealDeliveryState,
  isTerminalMealDeliveryState,
  shouldShowMealRiderFooterBar,
  mealRiderDeliveryMessage,
} from '../../../../utils/meal-delivery-effective-state';
import { enrichSubscriptionRowsWithPresignedMealImages } from '../../../../services/meal-subscription/meal-subscription-operations-service';
import { expireMealPaymentHolds } from '../../../../utils/meal-payment-hold';
import { getMealRefundReviewCustomerMetadata } from '../../../../utils/meal-refund-cases';
import { SAFE_INTERNAL_ERROR_MESSAGE } from '../../../../utils/safe-hono-error';

/** Module helpers (move-only). */

// ============================================================================
// CUSTOMER HANDLERS
// ============================================================================

export class GetCustomerHandlerEnhanced extends BaseHandlerEnhanced {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    const customerId = context.event.pathParameters?.customerId;
    const requestId = context.requestId;

    if (!customerId) {
      return this.error('Customer ID is required', 400, 'VALIDATION_ERROR', undefined, requestId);
    }

    try {
      // SECURITY (H6): path customerId must match JWT subject; strip password_hash.
      const authCustomerId = context.userId;
      if (!authCustomerId) {
        return this.error('Authentication required', 401, 'AUTH_REQUIRED', undefined, requestId);
      }
      const uuidRe =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      if (
        uuidRe.test(String(customerId)) &&
        String(customerId).toLowerCase() !== String(authCustomerId).toLowerCase()
      ) {
        return this.error('Forbidden', 403, 'FORBIDDEN', undefined, requestId);
      }

      const customers = await enhanced_base_handlersRepo.dbEnhancedBaseHandlers0(authCustomerId)
      
      if (customers.length === 0) {
        return this.error('Customer not found', 404, 'NOT_FOUND', undefined, requestId);
      }

      const row = customers[0] as Record<string, unknown>;
      const { password_hash: _ph, passwordHash: _pH, password: _p, ...safe } = row;
      return this.success({ customer: safe }, requestId);
    } catch (error: any) {
      console.error('Error getting customer:', error);
      return this.error(
        SAFE_INTERNAL_ERROR_MESSAGE,
        500,
        'INTERNAL_ERROR',
        undefined,
        requestId
      );
    }
  }
}

export class GetCustomerByPhoneHandlerEnhanced extends BaseHandlerEnhanced {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    const phone = context.event.queryStringParameters?.phone;
    const requestId = context.requestId;

    if (!phone) {
      return this.error('Phone number is required', 400, 'VALIDATION_ERROR', undefined, requestId);
    }

    try {
      // Normalize phone - remove non-digits
      const cleanPhone = phone.replace(/\D/g, '');
      
      const customers = await enhanced_base_handlersRepo.dbEnhancedBaseHandlers1(cleanPhone)
      
      if (customers.length === 0) {
        return this.error('Customer not found', 404, 'NOT_FOUND', undefined, requestId);
      }

      const customer = customers[0];
      return this.success({ 
        customer: {
          id: customer.id,
          phone: customer.phone,
          name: customer.full_name,
          email: customer.email,
          status: customer.status,
          onboarding_status: customer.onboarding_status,
          profile_completed: customer.profile_completed,
          created_at: customer.created_at,
        }
      }, requestId);
    } catch (error: any) {
      console.error('Error getting customer by phone:', error);
      return this.error(
        SAFE_INTERNAL_ERROR_MESSAGE,
        500,
        'INTERNAL_ERROR',
        undefined,
        requestId
      );
    }
  }
}

export class UpdateCustomerHandlerEnhanced extends BaseHandlerEnhanced {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    const customerId = context.event.pathParameters?.customerId;
    const body = this.parseBody(context.event) as Record<string, unknown>;
    const requestId = context.requestId;

    if (!customerId) {
      return this.error('Customer ID is required', 400, 'VALIDATION_ERROR', undefined, requestId);
    }

    // SECURITY: path customerId must match JWT subject.
    const authCustomerId = context.userId;
    if (!authCustomerId) {
      return this.error('Authentication required', 401, 'AUTH_REQUIRED', undefined, requestId);
    }
    if (String(customerId).toLowerCase() !== String(authCustomerId).toLowerCase()) {
      return this.error('Forbidden', 403, 'FORBIDDEN', undefined, requestId);
    }

    const hasHouseNoInPut = 'houseNo' in body || 'house_no' in body;
    const hasFloorInPut = 'floor' in body;

    // Validate request with Zod schema
    const validationResult = UpdateCustomerProfileRequestSchema.safeParse(body);
    if (!validationResult.success) {
      return this.error(
        'Validation failed',
        400,
        'VALIDATION_ERROR',
        { errors: validationResult.error.errors },
        requestId
      );
    }

    try {
      const existingCustomers = await enhanced_base_handlersRepo.dbEnhancedBaseHandlers0(authCustomerId);
      if (existingCustomers.length === 0) {
        return this.error('Customer not found', 404, 'NOT_FOUND', undefined, requestId);
      }

      const profileData = validationResult.data;
      const addrStr =
        profileData.address !== undefined && profileData.address !== null
          ? String(profileData.address).trim()
          : '';
      if (addrStr.length > 0 && hasHouseNoInPut && !profileData.houseNo?.trim()) {
        return this.error(
          'House / flat number is required when address is provided',
          400,
          'VALIDATION_ERROR',
          { field: 'houseNo' },
          requestId
        );
      }

      const updateData: any = {
        updated_at: new Date(),
      };

      if (profileData.firstName) updateData.first_name = profileData.firstName;
      if (profileData.lastName) updateData.last_name = profileData.lastName;
      if (profileData.email) updateData.email = profileData.email;
      if (profileData.address) updateData.address = profileData.address;
      if (profileData.pincode) updateData.pincode = profileData.pincode;
      if (profileData.city) updateData.city = profileData.city;
      if (profileData.state) updateData.state = profileData.state;
      if (profileData.photo) updateData.profile_photo_url = profileData.photo;
      if (hasHouseNoInPut) {
        updateData.house_no = profileData.houseNo?.trim() || null;
      }
      if (hasFloorInPut) {
        updateData.floor = profileData.floor?.trim() || null;
      }

      await enhanced_base_handlersRepo.dbEnhancedBaseHandlers2(customerId, updateData)

      // Get updated customer
      const customers = await enhanced_base_handlersRepo.dbEnhancedBaseHandlers3(customerId)

      const row = customers[0];
      return this.success({
        message: 'Customer updated successfully',
        customer: {
          ...row,
          houseNo: row.house_no ?? null,
          floor: row.floor ?? null,
        },
      }, requestId);
    } catch (error: any) {
      console.error('Error updating customer:', error);
      return this.error(
        SAFE_INTERNAL_ERROR_MESSAGE,
        500,
        'INTERNAL_ERROR',
        undefined,
        requestId
      );
    }
  }
}

export class GetCustomerPetsHandlerEnhanced extends BaseHandlerEnhanced {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    const customerId = context.event.pathParameters?.customerId;
    const requestId = context.requestId;

    if (!customerId) {
      return this.error('Customer ID is required', 400, 'VALIDATION_ERROR', undefined, requestId);
    }

    const authCustomerId = context.userId;
    if (!authCustomerId) {
      return this.error('Authentication required', 401, 'AUTH_REQUIRED', undefined, requestId);
    }
    if (String(customerId).toLowerCase() !== String(authCustomerId).toLowerCase()) {
      return this.error('Forbidden', 403, 'FORBIDDEN', undefined, requestId);
    }

    try {
      const pets = await enhanced_base_handlersRepo.dbEnhancedBaseHandlers4(authCustomerId)

      return this.success({ pets }, requestId);
    } catch (error: any) {
      console.error('Error getting customer pets:', error);
      return this.error(
        SAFE_INTERNAL_ERROR_MESSAGE,
        500,
        'INTERNAL_ERROR',
        undefined,
        requestId
      );
    }
  }
}

export class AddPetHandlerEnhanced extends BaseHandlerEnhanced {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    const customerId = context.event.pathParameters?.customerId;
    const body = this.parseBody(context.event);
    const requestId = context.requestId;

    if (!customerId) {
      return this.error('Customer ID is required', 400, 'VALIDATION_ERROR', undefined, requestId);
    }

    const authCustomerId = context.userId;
    if (!authCustomerId) {
      return this.error('Authentication required', 401, 'AUTH_REQUIRED', undefined, requestId);
    }
    if (String(customerId).toLowerCase() !== String(authCustomerId).toLowerCase()) {
      return this.error('Forbidden', 403, 'FORBIDDEN', undefined, requestId);
    }

    // Validate required fields for pet creation
    const createValidation = validatePetCreatePayload({
      ...body,
      customerId: authCustomerId,
    });
    if (!createValidation.ok) {
      return this.error(createValidation.error, 400, 'VALIDATION_ERROR', undefined, requestId);
    }

    try {
      const ageUnit = body.ageUnit || body.age_unit;
      let age_years: number | null = null;
      let age_months: number | null = null;
      if (body.age != null && body.age !== '') {
        const n = parseInt(String(body.age), 10);
        if (!Number.isNaN(n)) {
          if (ageUnit === 'months' || ageUnit === 'month') age_months = n;
          else age_years = n;
        }
      }

      const weight_kg =
        body.weight_kg != null && body.weight_kg !== ''
          ? parseFloat(String(body.weight_kg))
          : body.weight != null && body.weight !== ''
            ? parseFloat(String(body.weight))
            : null;

      const med = body.medicalHistory ?? body.medical_history;
      const medical_history =
        med != null && typeof med === 'object' && !Array.isArray(med)
          ? med
          : {};

      const petData = {
        customer_id: authCustomerId,
        name: body.name,
        species: body.species,
        breed: body.breed || null,
        age_years,
        age_months,
        gender: body.gender || null,
        weight_kg: weight_kg != null && !Number.isNaN(weight_kg) ? weight_kg : null,
        color: body.color || null,
        medical_history,
      };

      const pets = await enhanced_base_handlersRepo.dbEnhancedBaseHandlers5(petData)
      const created = pets[0] as Record<string, unknown>;
      const loyaltyFields = buildSinglePetCreateLoyaltyFields(
        authCustomerId,
        String(created.id),
        created,
        body as Record<string, unknown>
      );

      // First-pet / profile loyalty: handled by action_sources → loyalty-events-consumer (not inline here).

      return this.success({ pet: created, ...loyaltyFields }, requestId);
    } catch (error: any) {
      console.error('Error adding pet:', error);
      return this.error(
        SAFE_INTERNAL_ERROR_MESSAGE,
        500,
        'INTERNAL_ERROR',
        undefined,
        requestId
      );
    }
  }
}

export class DeactivateCustomerHandlerEnhanced extends BaseHandlerEnhanced {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    const customerId = context.event.pathParameters?.customerId;
    const body = this.parseBody(context.event);
    const requestId = context.requestId;

    if (!customerId) {
      return this.error('Customer ID is required', 400, 'VALIDATION_ERROR', undefined, requestId);
    }

    const authCustomerId = context.userId;
    if (!authCustomerId) {
      return this.error('Authentication required', 401, 'AUTH_REQUIRED', undefined, requestId);
    }
    const actorType = context.userRole || body.actorType || 'customer';
    const isAdmin = actorType === 'admin' || actorType === 'system';
    if (
      !isAdmin &&
      String(customerId).toLowerCase() !== String(authCustomerId).toLowerCase()
    ) {
      return this.error('Forbidden', 403, 'FORBIDDEN', undefined, requestId);
    }

    const reason = body.reason || body.deactivationReason || 'Customer request';
    const actorId = context.userId || body.actorId;
    const permanentDelete = body.permanentDelete === true; // Only if explicitly requested
    const targetCustomerId = isAdmin ? customerId : authCustomerId;

    try {
      // Get current customer
      const existingCustomers = await enhanced_base_handlersRepo.dbEnhancedBaseHandlers6(targetCustomerId)
      if (existingCustomers.length === 0) {
        return this.error('Customer not found', 404, 'NOT_FOUND', undefined, requestId);
      }

      const currentCustomer = existingCustomers[0];

      if (permanentDelete) {
        // Hard delete - only allowed by admins or system
        if (actorType !== 'admin' && actorType !== 'system') {
          return this.error(
            'Permanent deletion is only allowed by administrators',
            403,
            'FORBIDDEN',
            undefined,
            requestId
          );
        }

        // Check for active bookings/orders before deletion
        const activeBookings = await enhanced_base_handlersRepo.dbEnhancedBaseHandlers7(targetCustomerId)

        const activeOrders = await enhanced_base_handlersRepo.dbEnhancedBaseHandlers8(targetCustomerId)

        if (parseInt(activeBookings.rows[0]?.count || '0', 10) > 0 ||
            parseInt(activeOrders.rows[0]?.count || '0', 10) > 0) {
          return this.error(
            'Cannot delete customer with active bookings or orders. Please cancel them first.',
            400,
            'VALIDATION_ERROR',
            undefined,
            requestId
          );
        }

        // Soft delete by setting is_active = false and updating
        await enhanced_base_handlersRepo.dbEnhancedBaseHandlers9(targetCustomerId)

        return this.success({
          customerId: targetCustomerId,
          message: 'Customer account deactivated successfully',
          deactivated: true,
        }, requestId);
      } else {
        // Soft delete - deactivate account
        await enhanced_base_handlersRepo.dbEnhancedBaseHandlers10(targetCustomerId)

        // Log audit entry
        try {
          const { logAuditEntry } = await import('../utils/audit-log');
          await logAuditEntry({
            entityType: 'customer',
            entityId: targetCustomerId,
            action: 'deactivate',
            oldValues: { is_active: currentCustomer.is_active },
            newValues: { is_active: false, reason },
            changedFields: ['is_active'],
            actorId,
            actorType,
            requestId,
          });
        } catch (error) {
          console.error('Error logging audit entry:', error);
        }

        return this.success({
          customerId: targetCustomerId,
          message: 'Customer account deactivated successfully',
          deactivated: true,
        }, requestId);
      }
    } catch (error: any) {
      console.error('Error deactivating customer:', error);
      return this.error(
        SAFE_INTERNAL_ERROR_MESSAGE,
        500,
        'INTERNAL_ERROR',
        undefined,
        requestId
      );
    }
  }
}

// ============================================================================
// HONO ROUTER SETUP
// ============================================================================
