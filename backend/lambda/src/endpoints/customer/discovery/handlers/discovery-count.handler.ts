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
import {
} from '../repos/legacy-helpers.repo';

import type { Context } from 'hono';

export async function discoveryCountHandler(c: Context) {

    try {
      const serviceStyle = c.req.query('serviceStyle') || c.req.query('style');
      if (!serviceStyle) {
        return c.json(
          { success: false, error: 'Service style is required (tele, at_home, at_center)', count: 0 },
          400
        );
      }
      const category = c.req.query('category') || undefined;
      const roleId = c.req.query('roleId') || undefined;
      let latitude = c.req.query('latitude') || null;
      let longitude = c.req.query('longitude') || null;
      if (!latitude || !longitude) {
        const customerPhone = c.req.query('customerPhone') || c.req.query('phone') || null;
        const coords = await getCustomerCoordinates(customerPhone || undefined);
        if (coords) {
          latitude = String(coords.latitude);
          longitude = String(coords.longitude);
        }
      }
      const count = await countDiscoverableVendorsForDiscoveryQuery({
        serviceStyleRaw: serviceStyle,
        category,
        roleId,
        latitude,
        longitude,
        radiusQ: c.req.query('radius') || undefined,
        maxDistanceQ: c.req.query('maxDistance') || undefined,
        minRatingQ: c.req.query('minRating') || undefined,
        specialization:
          (c.req.query('specialization') || c.req.query('specializationId') || '').trim() || undefined,
      });
      return c.json({ success: true, count });
    } catch (error: any) {
      console.error('[discovery/count] Error:', error);
      return c.json({ success: false, error: error?.message || 'Count failed', count: 0 }, 500);
    }
}
