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

export async function customerCustomeridSearchhistoryGetHandler(c: Context) {
    try {
      const customerId = c.req.param('customerId');

      // Check if customer exists
      const customer = await resolveCustomerId(customerId);
      if (!customer) {
        return c.json({ error: 'Customer not found' }, 404);
      }

      // Try to get search history from preferences or a dedicated table
      const customers = await select('customers', { id: customer });
      const preferences = customers[0]?.preferences as any || {};
      const searchHistory = preferences.searchHistory || [];

      return c.json({
        success: true,
        history: searchHistory,
        count: searchHistory.length,
      });
    } catch (error: any) {
      console.error('[search-history] Error fetching search history:', error);
      return c.json({ success: true, history: [], count: 0 }, 200);
    }
}
