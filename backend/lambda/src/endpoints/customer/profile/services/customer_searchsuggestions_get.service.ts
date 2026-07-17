import type { Context } from 'hono';
import * as customer_searchsuggestions_getRepo from '../repos/customer_searchsuggestions_get.repo';
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

export async function executecustomerSearchsuggestionsGet(c: Context) {
    try {
      const { rows } = await customer_searchsuggestions_getRepo.dbCustomerSearchsuggestionsGet0()

      const suggestions = (rows as { keyword: string; hub_slug: string }[]).map((row) => ({
        type: row.hub_slug,
        text: row.keyword,
      }));

      return c.json({
        success: true,
        suggestions,
        count: suggestions.length,
      });
    } catch (error: any) {
      console.error('[search-suggestions] Error fetching suggestions:', error);
      return c.json({ success: true, suggestions: [], count: 0 }, 200);
    }
}