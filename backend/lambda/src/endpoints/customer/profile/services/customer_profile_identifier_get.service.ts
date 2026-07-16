import type { Context } from 'hono';
import { resolveCustomerId, resolveCustomerPhotoForDisplay } from '../repos/module-helpers.repo';
import * as customer_profile_identifier_getRepo from '../repos/customer_profile_identifier_get.repo';
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

export async function executecustomerProfileIdentifierGet(c: Context) {
    try {
      const { identifier } = c.req.param();
      if (identifier === 'password-status') {
        return handleCustomerAccountStatus(c);
      }

      const customerId = await resolveCustomerId(identifier);
      if (!customerId) {
        return c.json({ error: 'Customer not found' }, 404);
      }

      const customers = await customer_profile_identifier_getRepo.dbCustomerProfileIdentifierGet0(customerId)
      if (customers.length === 0) {
        return c.json({ error: 'Customer not found' }, 404);
      }

      const customer = customers[0];

      // Map backend fields to UI fields
      const nameParts = (customer.full_name || '').split(' ');
      const firstName = nameParts[0] || '';
      const lastName = nameParts.slice(1).join(' ') || '';

      const photoUrl = await resolveCustomerPhotoForDisplay(customer.profile_photo_url, customer.id);

      // Extract address fields from JSONB (if address is stored as JSONB)
      // Otherwise use address as text
      let addressData: any = {};
      if (typeof customer.address === 'string') {
        // Address is stored as text, use it directly
        addressData = { street: customer.address };
      } else if (customer.address) {
        addressData = customer.address;
      }

      return c.json({
        success: true,
        profile: {
          firstName,
          lastName,
          email: customer.email || '',
          phone: customer.phone || identifier,
          address: addressData.street || '',
          pincode: (customer as any).pincode || addressData.pincode || '',
          city: (customer as any).city || '',
          state: (customer as any).state || '',
          houseNo: (customer as any).house_no ?? null,
          floor: (customer as any).floor ?? null,
          photo: photoUrl || '',
          profile_photo_url: photoUrl || '',
          latitude: (customer as any).latitude != null ? Number((customer as any).latitude) : null,
          longitude: (customer as any).longitude != null ? Number((customer as any).longitude) : null,
        },
      });
    } catch (error: any) {
      console.error('Error fetching customer profile:', error);
      return c.json({ error: error.message }, 500);
    }
}