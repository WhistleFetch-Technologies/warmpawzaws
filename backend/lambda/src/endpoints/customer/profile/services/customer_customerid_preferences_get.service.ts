import type { Context } from 'hono';
import * as customer_customerid_preferences_getRepo from '../repos/customer_customerid_preferences_get.repo';
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

export async function executecustomerCustomeridPreferencesGet(c: Context) {
    try {
      const { customerId } = c.req.param();
      const { requireCustomerIdentifierMatch } = await import(
        '../../../../utils/security-ownership'
      );
      const authz = await requireCustomerIdentifierMatch(c, String(customerId || ''));
      if (!authz.ok) {
        return c.json({ success: false, error: authz.error }, authz.status);
      }

      const customers = await customer_customerid_preferences_getRepo.dbCustomerCustomeridPreferencesGet0(authz.customerId)
      if (customers.length === 0) {
        return c.json({ error: 'Customer not found' }, 404);
      }

      const preferences = (customers[0].preferences as any) || {};

      return c.json({
        success: true,
        preferences,
      });
    } catch (error: any) {
      console.error('Error fetching customer preferences:', error);
      return c.json({ error: error.message }, 500);
    }
}