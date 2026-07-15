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

export async function discoveryMetaHandler(c: Context) {

    try {
      // Align with admin active vendors: (approved|active), any published/draft service, no r.is_active
      const rolesResult = await query(`
        SELECT DISTINCT r.name AS roleName, r.display_name AS roleDisplayName
        FROM vendors v
        INNER JOIN roles r ON v.role_id = r.id
        WHERE (v.status = 'approved' OR v.status = 'active')
          AND ${sqlVendorOnlineForCustomerDiscovery('v')}
          AND v.is_active = true
          AND EXISTS (
            SELECT 1 FROM vendor_services vs
            WHERE vs.vendor_id = v.id AND vs.is_enabled = true
              AND (vs.publish_status IN ('published', 'auto_published', 'draft') OR vs.publish_status IS NULL)
          )
        ORDER BY r.name
      `);
      const stylesResult = await query(`
        SELECT DISTINCT vs.service_style AS serviceStyle
        FROM vendor_services vs
        INNER JOIN vendors v ON v.id = vs.vendor_id
        WHERE (v.status = 'approved' OR v.status = 'active') AND v.is_active = true
          AND ${sqlVendorOnlineForCustomerDiscovery('v')}
          AND vs.is_enabled = true
          AND (vs.publish_status IN ('published', 'auto_published', 'draft') OR vs.publish_status IS NULL)
          AND vs.service_style IS NOT NULL
        ORDER BY vs.service_style
      `);
      const roles = (rolesResult.rows || []).map((r: any) => ({
        roleId: r.rolename,
        roleName: r.rolename,
        displayName: r.roledisplayname || r.rolename,
        category: getCategoryFromRole(r.rolename || ''),
      }));
      const serviceStyles = (stylesResult.rows || []).map((s: any) => s.servicestyle).filter(Boolean);
      const categories = [...new Set(roles.map((r: any) => r.category).filter(Boolean))].sort();
      return c.json({
        success: true,
        roles,
        serviceStyles: serviceStyles.length ? serviceStyles : ['at_center', 'at_home', 'tele'],
        categories,
      });
    } catch (error: any) {
      console.error('[discovery/meta] Error:', error);
      return c.json({
        success: true,
        roles: [],
        serviceStyles: ['at_center', 'at_home', 'tele'],
        categories: ['vet', 'grooming', 'training', 'walker', 'nutrition', 'boarding', 'diagnostics', 'shop', 'cafes', 'photography', 'insurance', 'ambulance', 'breeder', 'adoption', 'relocation', 'resort', 'holiday', 'sunset'],
      }, 200);
    }
}
