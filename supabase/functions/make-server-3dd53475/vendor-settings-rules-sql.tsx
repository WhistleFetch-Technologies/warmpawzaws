/**
 * Vendor Settings Multi-Rule Management Endpoints (SQL-ONLY VERSION)
 * Supports multiple rules per service type with service location filtering
 * 
 * REFACTORED: Removed all KV usage, using SQL repositories only
 * 
 * CHANGES:
 * - Removed `kv` parameter from function signature
 * - Replaced all `kv.get()`, `kv.set()` with SQL repository calls
 * - All data now comes from SQL tables (booking_rules, refund_rules, refund_tiers, platform_settings)
 * 
 * Date: 2025-01-27
 * Migration: Batch 9 - 500 KV Operations Migration
 */

import { Hono } from "npm:hono";
import { sendSuccess, sendError } from "./response-utils.ts";
import { getServicesRepository } from '../../lib/repositories/services.ts';
import { getDbClient } from '../../lib/db.ts';

const BASE_PATH = "/make-server-3dd53475";

export function vendorSettingsRulesEndpointsSQL(app: Hono) {
  console.log('✅ Registering Vendor Settings Rules Endpoints (SQL-only)...');

  const client = getDbClient();
  const servicesRepo = getServicesRepository();

  // ============================================
  // HELPER: Get All Services from Catalog
  // ============================================

  async function getAllServicesFromCatalog() {
    // ✅ SQL: Get all services from services table
    const { data: services, error } = await client
      .from('services')
      .select('id, name, category_id, subcategory_id, service_style, vendor_type')
      .eq('is_active', true);

    if (error) {
      console.error('Error fetching services:', error);
      return [];
    }

    return (services || []).map((service: any) => ({
      id: service.id,
      name: service.name,
      categoryId: service.category_id,
      subCategoryId: service.subcategory_id,
      serviceStyle: service.service_style || 'both',
      vendorType: service.vendor_type
    }));
  }

  // ============================================
  // GET ALL VENDOR SETTINGS (Multi-Rule Based)
  // ============================================

  app.get(`${BASE_PATH}/admin/vendor-settings-rules`, async (c) => {
    try {
      // ✅ SQL: Get booking rules
      const { data: bookingRules } = await client
        .from('booking_rules')
        .select('*')
        .eq('is_active', true);

      // ✅ SQL: Get payment rules from platform_settings (JSONB)
      const { data: paymentRulesSetting } = await client
        .from('platform_settings')
        .select('setting_value')
        .eq('setting_key', 'payment_rules')
        .maybeSingle();

      const paymentRules = paymentRulesSetting?.setting_value || [];

      // ✅ SQL: Get refund tiers
      const { data: refundTiers } = await client
        .from('refund_tiers')
        .select('*')
        .eq('is_active', true);

      // ✅ SQL: Get refund policies from platform_settings
      const { data: refundPoliciesSetting } = await client
        .from('platform_settings')
        .select('setting_value')
        .eq('setting_key', 'refund_policies')
        .maybeSingle();

      const refundPolicies = refundPoliciesSetting?.setting_value || {
        providerCancellation: {
          refundToCustomer: 100,
          additionalCompensation: 10,
          cancellationFee: 50
        },
        refundProcessing: {
          mode: 'auto',
          processingTimeBusinessDays: 7,
          actionRefundType: 'immediate',
          disputeResolutionTimeDays: 7,
          refundPreference: 'wallet'
        }
      };

      // ✅ SQL: Get service types from catalog
      const serviceTypes = await getAllServicesFromCatalog();

      return sendSuccess(c, {
        bookingRules: bookingRules || [],
        paymentRules: paymentRules,
        refundTiers: refundTiers || [],
        refundPolicies: refundPolicies,
        serviceTypes: serviceTypes
      });
    } catch (error) {
      console.error('Error fetching vendor settings rules:', error);
      return sendError(c, String(error), 500);
    }
  });

  // ============================================
  // BOOKING RULES MANAGEMENT (Multi-Rule)
  // ============================================

  // Get all booking rules
  app.get(`${BASE_PATH}/admin/vendor-settings/booking-rules`, async (c) => {
    try {
      // ✅ SQL: Get booking rules
      const { data: rules, error } = await client
        .from('booking_rules')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching booking rules:', error);
        return sendError(c, 'Failed to fetch booking rules', 500);
      }

      return sendSuccess(c, { rules: rules || [] });
    } catch (error) {
      console.error('Error fetching booking rules:', error);
      return sendError(c, String(error), 500);
    }
  });

  // Create new booking rule
  app.post(`${BASE_PATH}/admin/vendor-settings/booking-rules`, async (c) => {
    try {
      const newRule = await c.req.json();
      const now = new Date().toISOString();

      // Generate ID if not provided
      const ruleId = newRule.id || `booking_rule_${Date.now()}`;

      // ✅ SQL: Create booking rule
      const { data: rule, error } = await client
        .from('booking_rules')
        .insert({
          id: ruleId,
          rule_name: newRule.name || newRule.rule_name,
          rule_type: newRule.rule_type || 'other',
          rule_config: newRule.rule_config || newRule,
          is_active: newRule.isActive ?? true,
          created_at: now,
          updated_at: now
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating booking rule:', error);
        return sendError(c, 'Failed to create booking rule', 500);
      }

      console.log('Booking rule created:', rule);
      return sendSuccess(c, { rule });
    } catch (error) {
      console.error('Error creating booking rule:', error);
      return sendError(c, String(error), 500);
    }
  });

  // Update existing booking rule
  app.put(`${BASE_PATH}/admin/vendor-settings/booking-rules/:ruleId`, async (c) => {
    try {
      const { ruleId } = c.req.param();
      const updatedRule = await c.req.json();

      // ✅ SQL: Update booking rule
      const { data: rule, error } = await client
        .from('booking_rules')
        .update({
          rule_name: updatedRule.name || updatedRule.rule_name,
          rule_type: updatedRule.rule_type,
          rule_config: updatedRule.rule_config || updatedRule,
          is_active: updatedRule.isActive ?? updatedRule.is_active,
          updated_at: new Date().toISOString()
        })
        .eq('id', ruleId)
        .select()
        .single();

      if (error || !rule) {
        return sendError(c, 'Rule not found', 404);
      }

      console.log('Booking rule updated:', rule);
      return sendSuccess(c, { rule });
    } catch (error) {
      console.error('Error updating booking rule:', error);
      return sendError(c, String(error), 500);
    }
  });

  // Delete booking rule
  app.delete(`${BASE_PATH}/admin/vendor-settings/booking-rules/:ruleId`, async (c) => {
    try {
      const { ruleId } = c.req.param();

      // ✅ SQL: Delete booking rule
      const { error } = await client
        .from('booking_rules')
        .delete()
        .eq('id', ruleId);

      if (error) {
        console.error('Error deleting booking rule:', error);
        return sendError(c, 'Failed to delete booking rule', 500);
      }

      console.log('Booking rule deleted:', ruleId);
      return sendSuccess(c, { success: true });
    } catch (error) {
      console.error('Error deleting booking rule:', error);
      return sendError(c, String(error), 500);
    }
  });

  // ============================================
  // PAYMENT RULES MANAGEMENT (Multi-Rule)
  // ============================================

  // Get all payment rules
  app.get(`${BASE_PATH}/admin/vendor-settings/payment-rules`, async (c) => {
    try {
      // ✅ SQL: Get payment rules from platform_settings
      const { data: setting } = await client
        .from('platform_settings')
        .select('setting_value')
        .eq('setting_key', 'payment_rules')
        .maybeSingle();

      const rules = setting?.setting_value || [];
      return sendSuccess(c, { rules });
    } catch (error) {
      console.error('Error fetching payment rules:', error);
      return sendError(c, String(error), 500);
    }
  });

  // Create new payment rule
  app.post(`${BASE_PATH}/admin/vendor-settings/payment-rules`, async (c) => {
    try {
      const newRule = await c.req.json();

      // Generate ID if not provided
      if (!newRule.id) {
        newRule.id = `payment_rule_${Date.now()}`;
      }

      // Add creation timestamp
      newRule.createdAt = new Date().toISOString();
      newRule.isActive = newRule.isActive ?? true;

      // ✅ SQL: Get existing payment rules
      const { data: existingSetting } = await client
        .from('platform_settings')
        .select('setting_value')
        .eq('setting_key', 'payment_rules')
        .maybeSingle();

      const rules = existingSetting?.setting_value || [];
      rules.push(newRule);

      // ✅ SQL: Update payment rules
      await client
        .from('platform_settings')
        .upsert({
          setting_key: 'payment_rules',
          setting_value: rules,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'setting_key'
        });

      console.log('Payment rule created:', newRule);
      return sendSuccess(c, { rule: newRule });
    } catch (error) {
      console.error('Error creating payment rule:', error);
      return sendError(c, String(error), 500);
    }
  });

  // Update existing payment rule
  app.put(`${BASE_PATH}/admin/vendor-settings/payment-rules/:ruleId`, async (c) => {
    try {
      const { ruleId } = c.req.param();
      const updatedRule = await c.req.json();

      // ✅ SQL: Get existing payment rules
      const { data: existingSetting } = await client
        .from('platform_settings')
        .select('setting_value')
        .eq('setting_key', 'payment_rules')
        .maybeSingle();

      const rules = existingSetting?.setting_value || [];
      const index = rules.findIndex((r: any) => r.id === ruleId);

      if (index === -1) {
        return sendError(c, 'Rule not found', 404);
      }

      rules[index] = { ...rules[index], ...updatedRule, id: ruleId };

      // ✅ SQL: Update payment rules
      await client
        .from('platform_settings')
        .upsert({
          setting_key: 'payment_rules',
          setting_value: rules,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'setting_key'
        });

      console.log('Payment rule updated:', rules[index]);
      return sendSuccess(c, { rule: rules[index] });
    } catch (error) {
      console.error('Error updating payment rule:', error);
      return sendError(c, String(error), 500);
    }
  });

  // Delete payment rule
  app.delete(`${BASE_PATH}/admin/vendor-settings/payment-rules/:ruleId`, async (c) => {
    try {
      const { ruleId } = c.req.param();

      // ✅ SQL: Get existing payment rules
      const { data: existingSetting } = await client
        .from('platform_settings')
        .select('setting_value')
        .eq('setting_key', 'payment_rules')
        .maybeSingle();

      const rules = existingSetting?.setting_value || [];
      const filteredRules = rules.filter((r: any) => r.id !== ruleId);

      // ✅ SQL: Update payment rules
      await client
        .from('platform_settings')
        .upsert({
          setting_key: 'payment_rules',
          setting_value: filteredRules,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'setting_key'
        });

      console.log('Payment rule deleted:', ruleId);
      return sendSuccess(c, { success: true });
    } catch (error) {
      console.error('Error deleting payment rule:', error);
      return sendError(c, String(error), 500);
    }
  });

  // ============================================
  // REFUND POLICY TIERS MANAGEMENT (Multi-Rule)
  // ============================================

  // Get all refund policy tiers
  app.get(`${BASE_PATH}/admin/vendor-settings/refund-tiers`, async (c) => {
    try {
      // ✅ SQL: Get refund tiers
      const { data: tiers, error } = await client
        .from('refund_tiers')
        .select('*')
        .order('min_hours_before_booking', { ascending: true });

      if (error) {
        console.error('Error fetching refund tiers:', error);
        return sendError(c, 'Failed to fetch refund tiers', 500);
      }

      return sendSuccess(c, { tiers: tiers || [] });
    } catch (error) {
      console.error('Error fetching refund tiers:', error);
      return sendError(c, String(error), 500);
    }
  });

  // Create new refund tier
  app.post(`${BASE_PATH}/admin/vendor-settings/refund-tiers`, async (c) => {
    try {
      const newTier = await c.req.json();
      const now = new Date().toISOString();

      // Generate ID if not provided
      const tierId = newTier.id || `refund_tier_${Date.now()}`;

      // ✅ SQL: Create refund tier
      const { data: tier, error } = await client
        .from('refund_tiers')
        .insert({
          id: tierId,
          tier_name: newTier.name || newTier.tier_name,
          min_hours_before_booking: newTier.hoursBeforeService || newTier.min_hours_before_booking,
          refund_percentage: newTier.refundPercentage || newTier.refund_percentage,
          is_active: newTier.isActive ?? true,
          created_at: now,
          updated_at: now
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating refund tier:', error);
        return sendError(c, 'Failed to create refund tier', 500);
      }

      console.log('Refund tier created:', tier);
      return sendSuccess(c, { tier });
    } catch (error) {
      console.error('Error creating refund tier:', error);
      return sendError(c, String(error), 500);
    }
  });

  // Update existing refund tier
  app.put(`${BASE_PATH}/admin/vendor-settings/refund-tiers/:tierId`, async (c) => {
    try {
      const { tierId } = c.req.param();
      const updatedTier = await c.req.json();

      // ✅ SQL: Update refund tier
      const { data: tier, error } = await client
        .from('refund_tiers')
        .update({
          tier_name: updatedTier.name || updatedTier.tier_name,
          min_hours_before_booking: updatedTier.hoursBeforeService ?? updatedTier.min_hours_before_booking,
          refund_percentage: updatedTier.refundPercentage ?? updatedTier.refund_percentage,
          is_active: updatedTier.isActive ?? updatedTier.is_active,
          updated_at: new Date().toISOString()
        })
        .eq('id', tierId)
        .select()
        .single();

      if (error || !tier) {
        return sendError(c, 'Tier not found', 404);
      }

      console.log('Refund tier updated:', tier);
      return sendSuccess(c, { tier });
    } catch (error) {
      console.error('Error updating refund tier:', error);
      return sendError(c, String(error), 500);
    }
  });

  // Delete refund tier
  app.delete(`${BASE_PATH}/admin/vendor-settings/refund-tiers/:tierId`, async (c) => {
    try {
      const { tierId } = c.req.param();

      // ✅ SQL: Delete refund tier
      const { error } = await client
        .from('refund_tiers')
        .delete()
        .eq('id', tierId);

      if (error) {
        console.error('Error deleting refund tier:', error);
        return sendError(c, 'Failed to delete refund tier', 500);
      }

      console.log('Refund tier deleted:', tierId);
      return sendSuccess(c, { success: true });
    } catch (error) {
      console.error('Error deleting refund tier:', error);
      return sendError(c, String(error), 500);
    }
  });

  // ============================================
  // CUSTOMER APP QUERY ENDPOINTS
  // ============================================

  // Get applicable rules for a service booking
  app.get(`${BASE_PATH}/customer/booking-rules/:serviceId`, async (c) => {
    try {
      const { serviceId } = c.req.param();
      const serviceLocation = c.req.query('location') || 'both';

      // ✅ SQL: Get service details
      const { data: service } = await client
        .from('services')
        .select('id, name, vendor_type, category_id')
        .eq('id', serviceId)
        .maybeSingle();

      if (!service) {
        return sendError(c, 'Service not found in catalog', 404);
      }

      const serviceVendorType = service.vendor_type;

      // ✅ SQL: Get payment rules
      const { data: paymentRulesSetting } = await client
        .from('platform_settings')
        .select('setting_value')
        .eq('setting_key', 'payment_rules')
        .maybeSingle();

      const paymentRules = paymentRulesSetting?.setting_value || [];

      // ✅ SQL: Get refund tiers
      const { data: refundTiers } = await client
        .from('refund_tiers')
        .select('*')
        .eq('is_active', true);

      // Find applicable payment rule
      const applicablePaymentRule = paymentRules.find((rule: any) =>
        rule.isActive &&
        rule.vendorTypes &&
        rule.vendorTypes.includes(serviceVendorType) &&
        (rule.serviceLocation === 'both' || rule.serviceLocation === serviceLocation)
      );

      // Find applicable refund tier
      const applicableRefundTier = refundTiers?.find((tier: any) =>
        tier.is_active &&
        (tier.vendor_types || []).includes(serviceVendorType) &&
        (tier.service_location === 'both' || tier.service_location === serviceLocation)
      );

      return sendSuccess(c, {
        serviceId,
        serviceLocation,
        serviceVendorType,
        paymentRule: applicablePaymentRule || null,
        refundTier: applicableRefundTier || null,
        hasRules: !!(applicablePaymentRule || applicableRefundTier)
      });
    } catch (error) {
      console.error('Error fetching booking rules for customer:', error);
      return sendError(c, String(error), 500);
    }
  });

  // Calculate payment amount for a booking
  app.post(`${BASE_PATH}/customer/calculate-payment`, async (c) => {
    try {
      const { serviceId, serviceLocation, totalAmount } = await c.req.json();

      // ✅ SQL: Get service details
      const { data: service } = await client
        .from('services')
        .select('id, name, vendor_type')
        .eq('id', serviceId)
        .maybeSingle();

      if (!service) {
        return sendError(c, 'Service not found in catalog', 404);
      }

      const serviceVendorType = service.vendor_type;

      // ✅ SQL: Get payment rules
      const { data: paymentRulesSetting } = await client
        .from('platform_settings')
        .select('setting_value')
        .eq('setting_key', 'payment_rules')
        .maybeSingle();

      const paymentRules = paymentRulesSetting?.setting_value || [];

      // Find applicable payment rule
      const applicableRule = paymentRules.find((rule: any) =>
        rule.isActive &&
        rule.vendorTypes &&
        rule.vendorTypes.includes(serviceVendorType) &&
        (rule.serviceLocation === 'both' || rule.serviceLocation === serviceLocation)
      );

      if (!applicableRule) {
        return sendError(c, 'No payment rule found for this service', 404);
      }

      let advancePayment = 0;
      let remainingPayment = totalAmount;

      if (applicableRule.reservationType === 'full') {
        advancePayment = totalAmount;
        remainingPayment = 0;
      } else if (applicableRule.reservationType === 'percentage') {
        advancePayment = Math.max(
          (totalAmount * applicableRule.reservationPercentage) / 100,
          applicableRule.minimumAdvancePayment
        );
        remainingPayment = totalAmount - advancePayment;
      } else if (applicableRule.reservationType === 'flat') {
        advancePayment = applicableRule.flatAmount;
        remainingPayment = totalAmount - advancePayment;
      }

      return sendSuccess(c, {
        serviceId,
        serviceLocation,
        serviceVendorType,
        totalAmount,
        advancePayment: Math.round(advancePayment * 100) / 100,
        remainingPayment: Math.round(remainingPayment * 100) / 100,
        paymentRule: {
          name: applicableRule.name,
          type: applicableRule.reservationType,
          partialPaymentAllowed: applicableRule.partialPaymentAllowed
        }
      });
    } catch (error) {
      console.error('Error calculating payment:', error);
      return sendError(c, String(error), 500);
    }
  });

  // Calculate refund amount for a cancellation
  app.post(`${BASE_PATH}/customer/calculate-refund`, async (c) => {
    try {
      const { serviceId, serviceLocation, paidAmount, hoursBeforeService } = await c.req.json();

      // ✅ SQL: Get service details
      const { data: service } = await client
        .from('services')
        .select('id, name, vendor_type')
        .eq('id', serviceId)
        .maybeSingle();

      if (!service) {
        return sendError(c, 'Service not found in catalog', 404);
      }

      const serviceVendorType = service.vendor_type;

      // ✅ SQL: Get refund tiers
      const { data: refundTiers } = await client
        .from('refund_tiers')
        .select('*')
        .eq('is_active', true)
        .lte('min_hours_before_booking', hoursBeforeService)
        .order('min_hours_before_booking', { ascending: false });

      // Find applicable refund tier
      const applicableTier = refundTiers?.[0] || null;

      if (!applicableTier) {
        return sendError(c, 'No refund policy found for this cancellation window', 404);
      }

      const refundPercentage = applicableTier.refund_percentage;
      const cancellationFee = applicableTier.cancellation_fee || 0;
      const refundAmount = Math.max(0, (paidAmount * refundPercentage / 100) - cancellationFee);

      return sendSuccess(c, {
        serviceId,
        serviceLocation,
        serviceVendorType,
        paidAmount,
        hoursBeforeService,
        refundPercentage,
        cancellationFee,
        refundAmount: Math.round(refundAmount * 100) / 100,
        refundPolicy: {
          name: applicableTier.tier_name,
          windowHours: applicableTier.min_hours_before_booking
        }
      });
    } catch (error) {
      console.error('Error calculating refund:', error);
      return sendError(c, String(error), 500);
    }
  });

  console.log('✅ Vendor Settings Rules Endpoints registered (SQL-only)');
}

