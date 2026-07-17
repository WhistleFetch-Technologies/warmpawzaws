import type { Context } from 'hono';
import * as customer_customerid_preferences_putRepo from '../repos/customer_customerid_preferences_put.repo';
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

export async function executecustomerCustomeridPreferencesPut(c: Context) {
    try {
      const { customerId } = c.req.param();
      const newPreferences = await c.req.json();

      const customers = await customer_customerid_preferences_putRepo.dbCustomerCustomeridPreferencesPut0(customerId)
      if (customers.length === 0) {
        return c.json({ error: 'Customer not found' }, 404);
      }

      const existingPreferences = (customers[0].preferences as any) || {};

      const mergedPreferences = {
        ...existingPreferences,
        ...newPreferences,
      };

      const updated = await customer_customerid_preferences_putRepo.dbCustomerCustomeridPreferencesPut1(
        customerId,
        mergedPreferences
      );

      return c.json({
        success: true,
        message: 'Preferences updated successfully',
        preferences: updated[0].preferences,
      });
    } catch (error: any) {
      console.error('Error updating customer preferences:', error);
      return c.json({ error: error.message }, 500);
    }
}