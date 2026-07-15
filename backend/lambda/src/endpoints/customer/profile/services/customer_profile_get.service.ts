import type { Context } from 'hono';
import * as customer_profile_getRepo from '../repos/customer_profile_get.repo';
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

export async function executecustomerProfileGet(c: Context) {
    try {
      const phone = c.req.query('phone');
      if (!phone) {
        return c.json({ error: 'Phone number is required as query param' }, 400);
      }

      const cleanPhone = normalizePhone(phone);
      let customers: any[];
      try {
        const customerId = await resolveCustomerId(cleanPhone);
        if (!customerId) {
          return c.json({ error: 'Customer not found' }, 404);
        }
        customers = await customer_profile_getRepo.dbCustomerProfileGet0(customerId)
        if (customers.length === 0) return c.json({ error: 'Customer not found' }, 404);

        // Get addresses for this customer
        const addressesResult = await customer_profile_getRepo.dbCustomerProfileGet1(phone, city, state, pincode, landmark, coordinates, floor)

        customers[0].addresses = addressesResult.rows;
      } catch (error: any) {
        console.error('[profile] Error fetching customer by phone:', error);
        return c.json({ success: true, profile: null, _degraded: true }, 200);
      }

      const customer = customers[0];
      const defaultAddr = customer.addresses?.[0] || null;

      // Profile edits persist to `customers`; GET used to prefer `customer_addresses` first,
      // so a stale default row hid the updated pincode. Prefer customer row, then saved address.
      const custPin = String(customer.pincode ?? '').trim();
      const addrPin = String(defaultAddr?.pincode ?? '').trim();
      const profilePincode = custPin || addrPin || null;
      const custCity = String(customer.city ?? '').trim();
      const addrCity = defaultAddr?.city != null ? String(defaultAddr.city).trim() : '';
      const profileCity = custCity || addrCity || null;
      const custState = String(customer.state ?? '').trim();
      const addrState = defaultAddr?.state != null ? String(defaultAddr.state).trim() : '';
      const profileState = custState || addrState || null;

      const fullName = (customer.full_name || '').trim();
      const nameParts = fullName.split(/\s+/).filter(Boolean);
      const firstName = nameParts[0] || '';
      const lastName = nameParts.slice(1).join(' ') || '';

      const addressText =
        typeof customer.address === 'string'
          ? customer.address
          : (customer.address && (customer.address as any).street) || '';

      const profilePhoto = await resolveCustomerPhotoForDisplay(customer.profile_photo_url, customer.id);

      // Get pets for this customer with error handling
      let pets: any[] = [];
      try {
        pets = await customer_profile_getRepo.dbCustomerProfileGet2(customer)
      } catch (error: any) {
        console.warn('Error fetching pets (using empty):', error.message);
        // Continue with empty pets array
      }

      const petsOut = await Promise.all(
        pets.map(async (p: any) => {
          const rawPhoto = p.profile_photo_url;
          const signed =
            (await resolveCustomerPhotoForDisplay(rawPhoto, customer.id)) || rawPhoto;
          return {
            id: p.id,
            name: p.name,
            type: p.species,
            breed: p.breed,
            age: p.age_years,
            gender: p.gender,
            photo: signed,
            image: signed,
            profile_photo_url: signed,
          };
        })
      );

      return c.json({
        success: true,
        profile: {
          id: customer.id,
          phone: customer.phone,
          name: customer.full_name,
          firstName,
          lastName,
          email: customer.email,
          address: addressText || customer.address,
          pincode: profilePincode,
          city: profileCity,
          state: profileState,
          houseNo: customer.house_no ?? null,
          floor: customer.floor ?? null,
          photo: profilePhoto,
          profile_photo_url: profilePhoto,
          status: customer.status,
          onboarding_status: customer.onboarding_status,
          profile_completed: customer.profile_completed,
          createdAt: customer.created_at,
          latitude: customer.latitude != null ? Number(customer.latitude) : null,
          longitude: customer.longitude != null ? Number(customer.longitude) : null,
          pets: petsOut,
        }
      });
    } catch (error: any) {
      console.error('[profile] Error fetching customer profile by query:', error);
      console.error('[profile] Error stack:', error?.stack);

      // Return 200 with degraded so customer home loads (non-critical for query param profile)
      return c.json({ success: true, profile: null, _degraded: true });
    }
}