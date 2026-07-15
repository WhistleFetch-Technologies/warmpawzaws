import type { Hono } from 'hono';
import { select, query, insert } from '../../../../database/rds-connection';
import { normalizeDbRow, normalizeDbRows, extractEntityIds } from '../../../../utils/entity-extractor';
import { isValidUUID } from '../../../../types/entities';
import { getDiscoveryRules, type DiscoveryRuleSet } from '../../../../lib/rule-engine';
import { resolveVendorById, getVendorIdsForAvailabilityLookup, getVendorIdentityId } from '../../../vendor/endpoints/vendorProfile.vendor';
import { taxCalculationService } from '../../../../lib/services/tax-calculation-service';
import { discountCalculationService } from '../../../../lib/services/discount-calculation-service';
import { CATEGORY_ROLES } from '../../constants';
import { extractS3KeyFromUrl, regeneratePresignedUrl } from '../../../constants/helper';
import { getCustomerCoordinates, resolveCustomerIdFromPhone } from '../../../../utils/customer-coordinates';
import { seedFinitePackagesMissingSessionsForScope, type SqlClient } from '../../../../utils/package-session-sync';
import { sqlPackagePurchaseActiveForListing } from '../../../../utils/package-session-eligibility';
import { DistanceResolver, haversineKm, formatDistanceKm } from '../../../../lib/utils/vendor-customer-distance';
import {
} from '../../../../lib/discovery-vendor-query';
import { acceptableAvailabilityStylesForSlot, normalizeAvailabilityServiceStyle } from '../../../../utils/availability-service-styles';
import { vendorGalleryDrivesListingPhoto, getVendorListingPhotoUrl } from '../../../../utils/vendor-listing-photo';
import {
} from '../../../../utils/ist-scheduling';
import {
} from '../../../../lib/search-discovery-parity';
import {
} from '../../../../services/image';

import type { Context } from 'hono';

export async function autocompleteHandler(c: Context) {

    try {
      const q = c.req.query('q') || '';
      const limit = parseInt(c.req.query('limit') || '10', 10);

      if (!q || q.length < 2) {
        return c.json({ success: true, suggestions: [] });
      }

      // Search vendors
      const vendors = await query(
        `SELECT DISTINCT business_name as name, 'vendor' as type, id
         FROM vendors
         WHERE business_name ILIKE $1 AND status = 'approved' AND is_active = true
         LIMIT $2`,
        [`%${q}%`, limit]
      );

      // Search services
      const services = await query(
        `SELECT DISTINCT name, 'service' as type, id
         FROM services
         WHERE name ILIKE $1 AND is_active = true
         LIMIT $2`,
        [`%${q}%`, limit]
      );

      // Search problems
      const problems = await query(
        `SELECT DISTINCT problem_name as name, 'problem' as type, id
         FROM problem_grid
         WHERE problem_name ILIKE $1
         LIMIT $2`,
        [`%${q}%`, limit]
      );

      const suggestions = [
        ...vendors.rows.map((v: any) => ({ text: v.name, type: v.type, id: v.id })),
        ...services.rows.map((s: any) => ({ text: s.name, type: s.type, id: s.id })),
        ...problems.rows.map((p: any) => ({ text: p.name, type: p.type, id: p.id })),
      ].slice(0, limit);

      return c.json({ success: true, suggestions });
    } catch (error: any) {
      console.error('Error in autocomplete:', error);
      return c.json({ success: true, suggestions: [] });
    }
}
