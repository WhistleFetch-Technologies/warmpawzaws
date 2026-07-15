import type { Context } from 'hono';
/**
 * ============================================================================
 * CUSTOMER PROFILE MANAGEMENT ENDPOINTS - LAMBDA VERSION
 * ============================================================================
 * 
 * Handles customer profile management:
 * - Get customer profile (unified)
 * - Update customer profile
 * - Get customer preferences
 * - Update customer preferences
 * 
 * 
 * Date: 2025-01-28
 * Migration: Supabase to AWS Lambda
 * ============================================================================
 */

import { Hono } from 'hono';
import {
  handleCustomerAccountStatus,
  handleCustomerSetPassword,
  hasMeaningfulStoredPassword,
} from '../../password';
import { select, update, query, insert } from '../../../../database/rds-connection';
import { UpdateCustomerProfileRequestSchema } from '@warmpawz/api-contracts';
import { normalizeDbRow, normalizeDbRows, extractEntityIds } from '../../../../utils/entity-extractor';
import { isValidUUID } from '../../../../types/entities';
import { presignS3GetUrlIfApplicable, stripS3PresignQueryFromUrl } from '../../../../utils/s3-media-presign';
import { resolveImageForContext } from '../../../../services/image';
import { getCustomerByPhoneFromMicroservice } from '../../../../lib/services/customer-microservice-client';
import { geocodeAddress, geocodeIndiaPincode } from '../../../../lib/utils/geocode';

export async function customerCustomeridSearchhistoryPostHandler(c: Context) {
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

      const customers = await select('customers', { id: customer });
      const preferences = customers[0]?.preferences as any || {};
      let searchHistory = preferences.searchHistory || [];

      // Add to history (keep last 20)
      searchHistory = [
        { query: searchQuery, timestamp: new Date().toISOString() },
        ...searchHistory.filter((h: any) => h.query !== searchQuery)
      ].slice(0, 20);

      await update('customers', { id: customer }, {
        preferences: { ...preferences, searchHistory }
      });

      return c.json({ success: true, history: searchHistory });
    } catch (error: any) {
      console.error('Error saving search history:', error);
      return c.json({ error: error.message }, 500);
    }
}
