import type { Context } from 'hono';
import * as customer_customerid_searchhistory_postRepo from '../repos/customer_customerid_searchhistory_post.repo';
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

export async function executecustomerCustomeridSearchhistoryPost(c: Context) {
    try {
      const customerId = c.req.param('customerId');
      const body = await c.req.json();
      const { query: searchQuery } = body;

      if (!searchQuery) {
        return c.json({ error: 'Search query is required' }, 400);
      }

      const customer = await resolveCustomerId(customerId);
      if (!customer) {
        return c.json({ error: 'Customer not found' }, 404);
      }

      const customers = await customer_customerid_searchhistory_postRepo.dbCustomerCustomeridSearchhistoryPost0(customer)
      const preferences = customers[0]?.preferences as any || {};
      let searchHistory = preferences.searchHistory || [];

      // Add to history (keep last 20)
      searchHistory = [
        { query: searchQuery, timestamp: new Date().toISOString() },
        ...searchHistory.filter((h: any) => h.query !== searchQuery)
      ].slice(0, 20);

      await customer_customerid_searchhistory_postRepo.dbCustomerCustomeridSearchhistoryPost1(customer)

      return c.json({ success: true, history: searchHistory });
    } catch (error: any) {
      console.error('Error saving search history:', error);
      return c.json({ error: error.message }, 500);
    }
}