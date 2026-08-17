import type { Context } from 'hono';
import * as customer_profile_postRepo from '../repos/customer_profile_post.repo';
import {
  selectCanonicalCustomerRowsByLast10Digits,
  normalizePhone,
  mergeHouseNoFromPayload,
  resolveCustomerId,
  syncDefaultCustomerAddressFromProfile,
  deriveLatLngFromProfileData,
  withProfileAddressFields,
  type ProfileAddressSyncPayload,
} from '../repos/module-helpers.repo';
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

export async function executecustomerProfilePost(c: Context) {
    try {
      const body = await c.req.json().catch(() => ({}));

      // Handle nested profile structure from frontend
      // Frontend sends: { phone, profile: { firstName, lastName, ... }, journeyType }
      // Backend expects: { firstName, lastName, ... }
      const rawProfilePayload = body.profile || body;
      const { hasHouseKey: hasHouseNoField, merged: mergedHouseNo } = mergeHouseNoFromPayload(
        rawProfilePayload as Record<string, any>
      );
      const hasFloorField =
        typeof rawProfilePayload === 'object' && rawProfilePayload !== null && 'floor' in rawProfilePayload;

      // Clean the payload - remove empty strings for optional URL fields (photo)
      // and remove extra fields (phone) that aren't in the schema
      const profilePayload: Record<string, any> = {};
      if (rawProfilePayload.firstName) profilePayload.firstName = rawProfilePayload.firstName;
      if (rawProfilePayload.lastName) profilePayload.lastName = rawProfilePayload.lastName;
      if (rawProfilePayload.email) profilePayload.email = rawProfilePayload.email;
      if (rawProfilePayload.address) profilePayload.address = rawProfilePayload.address;
      if (rawProfilePayload.pincode !== undefined && rawProfilePayload.pincode !== null) {
        profilePayload.pincode = String(rawProfilePayload.pincode).trim();
      }
      if (rawProfilePayload.city) profilePayload.city = rawProfilePayload.city;
      if (rawProfilePayload.state) profilePayload.state = rawProfilePayload.state;
      if (hasHouseNoField) {
        profilePayload.houseNo = mergedHouseNo ?? '';
      } else if (mergedHouseNo) {
        profilePayload.houseNo = mergedHouseNo;
      }
      if (rawProfilePayload.floor !== undefined && rawProfilePayload.floor !== null) {
        profilePayload.floor =
          typeof rawProfilePayload.floor === 'string' ? rawProfilePayload.floor : String(rawProfilePayload.floor);
      }
      const photoRaw =
        typeof rawProfilePayload.photo === 'string' ? rawProfilePayload.photo.trim() : '';
      if (
        photoRaw &&
        (photoRaw.startsWith('http://') ||
          photoRaw.startsWith('https://') ||
          photoRaw.startsWith('media/'))
      ) {
        profilePayload.photo = photoRaw;
      }
      if (rawProfilePayload.latitude !== undefined) {
        profilePayload.latitude = rawProfilePayload.latitude;
      }
      if (rawProfilePayload.longitude !== undefined) {
        profilePayload.longitude = rawProfilePayload.longitude;
      }
      if (rawProfilePayload.coordinates !== undefined) {
        profilePayload.coordinates = rawProfilePayload.coordinates;
      }

      const hasGeoPayload =
        rawProfilePayload != null &&
        typeof rawProfilePayload === 'object' &&
        ('latitude' in rawProfilePayload ||
          'longitude' in rawProfilePayload ||
          'coordinates' in rawProfilePayload);

      console.log('[PROFILE] Cleaned payload:', profilePayload);

      // Validate request with Zod schema
      const validationResult = UpdateCustomerProfileRequestSchema.safeParse(profilePayload);
      if (!validationResult.success) {
        console.error('[PROFILE] Validation failed:', validationResult.error.errors);
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

      const addrPresentPost = !!(profileData.address && String(profileData.address).trim());
      const effectiveHousePost = String(mergedHouseNo ?? profileData.houseNo ?? '').trim();
      if (addrPresentPost && hasHouseNoField && !effectiveHousePost) {
        return c.json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'House / flat number is required',
            details: { field: 'houseNo', message: 'Please enter your house or flat number' },
          },
        }, 400);
      }

      // Get phone from body (required for POST endpoint)
      // Note: phone is not part of the validated schema, it comes from body directly
      const phone = body.phone || (body.profile as any)?.phone;
      if (!phone) {
        return c.json({ error: 'Phone number is required' }, 400);
      }

      const cleanPhone = normalizePhone(phone);

      // ✅ Validate phone number - must be exactly 10 digits
      if (cleanPhone.length !== 10 || !/^\d{10}$/.test(cleanPhone)) {
        return c.json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid phone number',
            details: {
              field: 'phone',
              message: 'Phone number must be exactly 10 digits',
            },
          },
        }, 400);
      }

      let customerId = await resolveCustomerId(cleanPhone);

      if (!customerId) {
        const lateRows = await selectCanonicalCustomerRowsByLast10Digits(cleanPhone);
        if (lateRows.length > 0) customerId = lateRows[0].id;
      }

      if (!customerId) {
        // Customer doesn't exist - create it (for UAT mode or when OTP verification didn't create customer)
        try {
          // Create customer identity first (same pattern as OTP verification)
          const { createOrUpdateCustomerIdentity } = await import('../../../../utils/customer-state');
          const identityId = await createOrUpdateCustomerIdentity(cleanPhone, undefined);

          // Create customer record with all required fields (matching OTP verification pattern)
          const fullName = profileData.firstName && profileData.lastName
            ? `${profileData.firstName} ${profileData.lastName}`.trim()
            : `Customer ${cleanPhone.slice(-4)}`;

          const newCustomer = await customer_profile_postRepo.insertCustomerRow({
            phone: cleanPhone,
            full_name: fullName,
            email: profileData.email || null,
            is_active: true,
            status: 'new',
            onboarding_status: 'PHONE_VERIFIED',
            profile_completed: false,
            customer_identity_id: identityId,
            // Don't set created_at/updated_at - let database defaults handle it
          });

          customerId = newCustomer[0].id;

          console.log(`[PROFILE] Created new customer ${customerId} for phone ${cleanPhone}`);
        } catch (createError: any) {
          console.error('[PROFILE] Error creating customer:', createError);
          console.error('[PROFILE] Error details:', {
            message: createError.message,
            stack: createError.stack,
            phone: cleanPhone
          });
          return c.json({
            error: 'Failed to create customer. Please try again.',
            code: 'CUSTOMER_CREATION_FAILED',
            details: process.env.NODE_ENV === 'development' ? createError.message : undefined
          }, 500);
        }
      }

      // Use PUT logic to update profile
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
      if (hasHouseNoField) {
        updateData.house_no = effectiveHousePost || null;
      }
      if (hasFloorField) {
        updateData.floor = profileData.floor?.trim() || null;
      }

      if (hasGeoPayload) {
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

      const updated = await customer_profile_postRepo.updateCustomerProfileRow(
        customerId as string,
        updateData
      );

      try {
        await syncDefaultCustomerAddressFromProfile(
          customerId as string,
          profileData,
          updated[0],
          {
            updateHouseNo: hasHouseNoField,
            houseNo: hasHouseNoField ? effectiveHousePost || null : undefined,
            updateFloor: hasFloorField,
            floor: hasFloorField ? profileData.floor?.trim() || null : undefined,
          }
        );
      } catch (syncErr) {
        console.error('[PROFILE] customer_addresses sync failed:', syncErr);
      }

      if (Object.keys(completionUpdates).length > 0 && customerId) {
        try {
          await updateProfileCompletion(customerId as string, completionUpdates);

          const customers = await customer_profile_postRepo.selectCustomerById(customerId as string);
          const customer = customers[0];

          if (customer.onboarding_status === 'PHONE_VERIFIED' && completionUpdates.basic_info) {
            await updateCustomerOnboardingStatus(customerId as string, 'PROFILE_PENDING', 'profile');
          }
        } catch (stateError) {
          console.error('Error updating customer state:', stateError);
        }
      }

      return c.json({
        success: true,
        message: 'Profile updated successfully',
        profile: withProfileAddressFields(updated[0]),
      });
    } catch (error: any) {
      console.error('Error updating customer profile:', error);

      // Check if error is about missing preferences column
      if (error.message && error.message.includes('column "preferences"')) {
        console.error('[PROFILE] Preferences column does not exist. Run migration 139_add_customers_preferences_column.sql');
        return c.json({
          error: 'Database schema mismatch. Please run migration 139_add_customers_preferences_column.sql',
          details: error.message
        }, 500);
      }

      if (error.message && /column "latitude"|column "longitude"/i.test(error.message)) {
        console.error('[PROFILE] customers.latitude/longitude missing. Run migration 1005_customers_latitude_longitude.sql');
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