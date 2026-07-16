import type { Context } from 'hono';
import { resolveCustomerId } from '../repos/module-helpers.repo';
import * as customer_customerid_searchhistory_deleteRepo from '../repos/customer_customerid_searchhistory_delete.repo';
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

export async function executecustomerCustomeridSearchhistoryDelete(c: Context) {
    try {
      const customerId = c.req.param('customerId');

      const customer = await resolveCustomerId(customerId);
      if (!customer) {
        return c.json({ error: 'Customer not found' }, 404);
      }

      const customers = await customer_customerid_searchhistory_deleteRepo.dbCustomerCustomeridSearchhistoryDelete0(customer)
      const preferences = customers[0]?.preferences as any || {};

      const clearedPreferences = { ...preferences, searchHistory: [] };

      await customer_customerid_searchhistory_deleteRepo.dbCustomerCustomeridSearchhistoryDelete1(
        customer,
        clearedPreferences
      );

      return c.json({ success: true, message: 'Search history cleared' });
    } catch (error: any) {
      console.error('Error clearing search history:', error);
      return c.json({ error: error.message }, 500);
    }
}