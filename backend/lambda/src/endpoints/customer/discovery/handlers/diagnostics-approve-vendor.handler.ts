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

export async function diagnosticsApproveVendorHandler(c: Context) {

    try {
      const body = await c.req.json();
      const vendorId = body.vendorId || body.id;

      if (!vendorId) {
        return c.json({ error: 'Vendor ID required' }, 400);
      }

      // Update vendor status to approved
      const updateResult = await query(`
        UPDATE vendors 
        SET 
          status = 'approved',
          approved_at = NOW(),
          is_active = true,
          updated_at = NOW()
        WHERE id = $1
        RETURNING id, business_name, phone, status, is_active
      `, [vendorId]);

      if (updateResult.rows.length === 0) {
        return c.json({ error: 'Vendor not found' }, 404);
      }

      return c.json({
        success: true,
        message: 'Vendor approved successfully',
        vendor: updateResult.rows[0]
      });
    } catch (error: any) {
      console.error('[Diagnostics] Error approving vendor:', error);
      return c.json({ error: error.message }, 500);
    }
}
