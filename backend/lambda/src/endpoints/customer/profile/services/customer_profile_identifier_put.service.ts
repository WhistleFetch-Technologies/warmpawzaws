import type { Context } from 'hono';
import { resolveCustomerId, mergeHouseNoFromPayload, deriveLatLngFromProfileData, withProfileAddressFields, syncDefaultCustomerAddressFromProfile, type ProfileAddressSyncPayload } from '../repos/module-helpers.repo';
import * as customer_profile_identifier_putRepo from '../repos/customer_profile_identifier_put.repo';
import { Hono } from 'hono';
import {
  handleCustomerAccountStatus,
  handleCustomerSetPassword,
  hasMeaningfulStoredPassword,
} from '../../password';
import { UpdateCustomerProfileRequestSchema } from '@warmpawz/api-contracts';
import { normalizeDbRow, normalizeDbRows, extractEntityIds } from '../../../../utils/entity-extractor';
import { isValidUUID } from '../../../../types/entities';
import { presignS3GetUrlIfApplicable, stripS3PresignQueryFromUrl } from '../../../../utils/s3-media-presign';
import { resolveImageForContext } from '../../../../services/image';
import { getCustomerByPhoneFromMicroservice } from '../../../../lib/services/customer-microservice-client';
import { geocodeAddress, geocodeIndiaPincode } from '../../../../lib/utils/geocode';

export async function executecustomerProfileIdentifierPut(c: Context) {
    try {
      const { identifier } = c.req.param();

      // Parse body from Hono request
      const body = await c.req.json().catch(() => ({}));
      const hasFloorInPut = 'floor' in body;

      const bodyForSchema: Record<string, any> = { ...body };
      const { hasHouseKey, merged: mergedPutHouse } = mergeHouseNoFromPayload(bodyForSchema);
      if (hasHouseKey) {
        bodyForSchema.houseNo = mergedPutHouse ?? '';
      }
      if ('house_no' in bodyForSchema) {
        delete bodyForSchema.house_no;
      }

      // Validate request with Zod schema
      const validationResult = UpdateCustomerProfileRequestSchema.safeParse(bodyForSchema);
      if (!validationResult.success) {
        return c.json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Validation failed',
            details: {
              errors: validationResult.error.errors,
            },
          },
        }, 400);
      }

      const profileData = validationResult.data;

      // ✅ Validate email format (RFC-compliant)
      if (profileData.email) {
        const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z]{2,})+$/;
        if (!emailRegex.test(profileData.email.trim())) {
          return c.json({
            success: false,
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Invalid email format',
              details: {
                field: 'email',
                message: 'Please enter a valid email address',
              },
            },
          }, 400);
        }
      }

      const addrStr = profileData.address !== undefined && profileData.address !== null ? String(profileData.address).trim() : '';
      const effectiveHousePut = String(mergedPutHouse ?? profileData.houseNo ?? '').trim();
      if (addrStr.length > 0 && hasHouseKey && !effectiveHousePut) {
        return c.json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'House / flat number is required when address is provided',
            details: { field: 'houseNo', message: 'Please enter your house or flat number' },
          },
        }, 400);
      }

      const customerId = await resolveCustomerId(identifier);
      if (!customerId) {
        return c.json({ error: 'Customer not found' }, 404);
      }

      // Prepare update data
      const updateData: any = {};

      if (profileData.firstName || profileData.lastName) {
        updateData.full_name = `${profileData.firstName || ''} ${profileData.lastName || ''}`.trim();
      }

      if (profileData.email) {
        updateData.email = profileData.email;
      }

      if (profileData.photo) {
        // Use profile_photo_url column directly instead of storing in preferences
        updateData.profile_photo_url = profileData.photo;
      }

      // Update profile completion status
      const { updateProfileCompletion, updateCustomerOnboardingStatus } = await import('../../../../utils/customer-state');

      const completionUpdates: any = {};
      if (profileData.firstName || profileData.lastName || profileData.email) {
        completionUpdates.basic_info = true;
      }
      if (profileData.address || profileData.pincode) {
        completionUpdates.address = true;
      }

      // Handle address - customers table has address (TEXT), pincode (TEXT), city (TEXT), state (TEXT) as separate fields
      if (profileData.address) {
        updateData.address = profileData.address;
      }
      if (profileData.pincode !== undefined && String(profileData.pincode).trim() !== '') {
        updateData.pincode = profileData.pincode;
      }
      if (profileData.city) {
        updateData.city = profileData.city;
      }
      if (profileData.state) {
        updateData.state = String(profileData.state).replace(/\s*\d{6}\s*$/, '').trim();
      }
      if (hasHouseKey) {
        updateData.house_no = effectiveHousePut || null;
      }
      if (hasFloorInPut) {
        updateData.floor = profileData.floor?.trim() || null;
      }

      const hasGeoPut =
        'latitude' in bodyForSchema || 'longitude' in bodyForSchema || 'coordinates' in bodyForSchema;
      if (hasGeoPut) {
        const geo = deriveLatLngFromProfileData(profileData as ProfileAddressSyncPayload);
        updateData.latitude = geo.latitude;
        updateData.longitude = geo.longitude;
      } else if (updateData.address || updateData.pincode) {
        // Server-side geocode when frontend didn't supply coordinates
        try {
          const geoResult = updateData.pincode
            ? await geocodeIndiaPincode(String(updateData.pincode))
            : null;
          const resolved = geoResult ?? (updateData.address
            ? await geocodeAddress(String(updateData.address))
            : null);
          if (resolved) {
            updateData.latitude = resolved.latitude;
            updateData.longitude = resolved.longitude;
          }
        } catch {
          // Non-fatal — profile saves even if geocoding fails
        }
      }

      // Ensure we're not trying to update preferences column (it may not exist yet)
      // Remove preferences from updateData if it somehow got added
      if ('preferences' in updateData) {
        delete updateData.preferences;
      }

      const updated = await customer_profile_identifier_putRepo.dbCustomerProfileIdentifierPut0(customerId, updateData)

      try {
        await syncDefaultCustomerAddressFromProfile(customerId, profileData, updated[0], {
          updateHouseNo: hasHouseKey,
          houseNo: hasHouseKey ? effectiveHousePut || null : undefined,
          updateFloor: hasFloorInPut,
          floor: hasFloorInPut ? profileData.floor?.trim() || null : undefined,
        });
      } catch (syncErr) {
        console.error('[PROFILE] customer_addresses sync failed:', syncErr);
      }

      // Update profile completion and onboarding status
      if (Object.keys(completionUpdates).length > 0) {
        try {
          await updateProfileCompletion(customerId, completionUpdates);

          // Check if we should update onboarding status
          const customers = await customer_profile_identifier_putRepo.dbCustomerProfileIdentifierPut1(customerId)
          const customer = customers[0];

          if (customer.onboarding_status === 'PHONE_VERIFIED' && completionUpdates.basic_info) {
            await updateCustomerOnboardingStatus(customerId, 'PROFILE_PENDING', 'profile');
          }
        } catch (stateError) {
          console.error('Error updating customer state:', stateError);
          // Don't fail profile update if state update fails
        }
      }

      return c.json({
        success: true,
        message: 'Profile updated successfully',
        profile: withProfileAddressFields(updated[0]),
      });
    } catch (error: any) {
      console.error('Error updating customer profile:', error);
      if (error.message && /column "latitude"|column "longitude"/i.test(error.message)) {
        return c.json(
          {
            error: 'Database schema mismatch. Run migration 1005_customers_latitude_longitude.sql on the API database.',
            details: error.message,
          },
          500
        );
      }
      return c.json({ error: error.message }, 500);
    }
}