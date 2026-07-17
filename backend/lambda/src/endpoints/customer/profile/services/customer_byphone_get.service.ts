import type { Context } from 'hono';
import { resolveCustomerId } from '../repos/module-helpers.repo';
import * as customer_byphone_getRepo from '../repos/customer_byphone_get.repo';
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

export async function executecustomerByphoneGet(c: Context) {
    try {
      const phone = c.req.query('phone');
      if (!phone) {
        return c.json({ error: 'Phone number is required' }, 400);
      }

      const ms = await getCustomerByPhoneFromMicroservice(phone);
      if (ms.kind === 'hit') {
        return c.json(ms.body);
      }

      const customerId = await resolveCustomerId(phone);
      if (!customerId) {
        return c.json({ error: 'Customer not found', customer: null }, 404);
      }
      const customers = await customer_byphone_getRepo.dbCustomerByphoneGet0(customerId)

      if (customers.length === 0) {
        return c.json({ error: 'Customer not found', customer: null }, 404);
      }

      const customer = customers[0];
      return c.json({
        success: true,
        customer: {
          id: customer.id,
          phone: customer.phone,
          name: customer.full_name,
          email: customer.email,
          status: customer.status,
          onboarding_status: customer.onboarding_status,
          profile_completed: customer.profile_completed,
          createdAt: customer.created_at,
        }
      });
    } catch (error: any) {
      const msg = error?.message || String(error);
      console.error('Error fetching customer by phone:', error);
      // Return 503 for pool exhaustion/timeout so clients can retry; 500 for other errors
      if (msg.includes('connection pool') || msg.includes('too many clients') || msg.includes('timeout') || msg.includes('Timeout')) {
        return c.json({ error: 'Service temporarily busy. Please try again in a moment.', code: 'SERVICE_BUSY' }, 503);
      }
      return c.json({ error: msg }, 500);
    }
}