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

export async function radarProvidersHandler(c: Context) {

    try {
      const lat = parseFloat(c.req.query('lat') || '0');
      const lng = parseFloat(c.req.query('lng') || '0');
      const roleId = c.req.query('roleId');
      const rules = await getDiscoveryRules(roleId || 'all', 'discover');
      const defaultRadiusKm = rules.discovery_radius_km ?? 10;
      const maxResults = typeof rules.discovery_max_results === 'number' ? rules.discovery_max_results : 50;
      const radius = c.req.query('radius') ? parseFloat(c.req.query('radius')!) : defaultRadiusKm;
      const serviceType = c.req.query('serviceType') || '';

      if (!lat || !lng) {
        return c.json({ error: 'lat and lng are required' }, 400);
      }

      const limitCount = Math.min(100, maxResults);
      // Get vendors with location within radius (rule-book radius + max_results)
      const vendors = await query(
        `SELECT v.*, r.name as role_name,
         (6371 * acos(
           cos(radians($1)) * cos(radians(CAST(v.latitude AS FLOAT))) *
           cos(radians(CAST(v.longitude AS FLOAT)) - radians($2)) +
           sin(radians($1)) * sin(radians(CAST(v.latitude AS FLOAT)))
         )) AS distance_km
         FROM vendors v
         INNER JOIN roles r ON v.role_id = r.id
         WHERE v.status = 'approved' AND v.is_active = true
           AND ${sqlVendorOnlineForCustomerDiscovery('v')}
           AND v.latitude IS NOT NULL AND v.longitude IS NOT NULL
           ${serviceType ? `AND r.name ILIKE $3` : ''}
         HAVING distance_km <= $4
         ORDER BY distance_km ASC
         LIMIT $5`,
        serviceType ? [lat, lng, `%${serviceType}%`, radius, limitCount] : [lat, lng, null, radius, limitCount]
      );

      return c.json({
        success: true,
        providers: vendors.rows.map((v: any) => ({
          id: v.id,
          name: v.business_name,
          role: v.role_name,
          distance: parseFloat(v.distance_km?.toFixed(2) || '0'),
          latitude: v.latitude,
          longitude: v.longitude,
        })),
      });
    } catch (error: any) {
      console.error('Error fetching radar providers:', error);
      return c.json({ error: error.message }, 500);
    }
}
