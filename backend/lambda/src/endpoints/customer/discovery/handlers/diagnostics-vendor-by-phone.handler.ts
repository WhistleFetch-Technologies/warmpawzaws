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

export async function diagnosticsVendorByPhoneHandler(c: Context) {

    try {
      const phone = c.req.query('phone');
      if (!phone) {
        return c.json({ error: 'Phone parameter required' }, 400);
      }

      // Find vendor
      const vendorResult = await query(`
        SELECT 
          v.id, 
          v.business_name, 
          v.owner_name, 
          v.phone, 
          v.status, 
          v.is_active, 
          v.vendor_type,
          r.id as role_id,
          r.name as role_name, 
          r.display_name as role_display_name
        FROM vendors v 
        LEFT JOIN roles r ON v.role_id = r.id 
        WHERE v.phone LIKE $1 OR v.phone = $2
        ORDER BY v.created_at DESC 
        LIMIT 5
      `, [`%${phone}%`, phone]);

      if (vendorResult.rows.length === 0) {
        return c.json({
          found: false,
          message: 'Vendor not found',
          search_phone: phone
        });
      }

      const vendor = vendorResult.rows[0];

      // Check services
      const servicesResult = await query(`
        SELECT 
          vs.id, 
          vs.service_name, 
          vs.service_style, 
          vs.is_enabled, 
          vs.publish_status,
          vs.category,
          vs.price
        FROM vendor_services vs
        WHERE vs.vendor_id = $1
        ORDER BY vs.created_at DESC
      `, [vendor.id]);

      // Check tele services specifically
      const teleServices = servicesResult.rows.filter(s =>
        (s.service_style === 'tele' || s.service_style === 'online') &&
        s.is_enabled === true &&
        (s.publish_status === 'published' || s.publish_status === 'auto_published' || s.publish_status === 'draft' || s.publish_status === null)
      );

      // Eligibility checks
      const eligibility = {
        statusApproved: vendor.status === 'approved' || vendor.status === 'active',
        isActive: vendor.is_active === true,
        hasRole: vendor.role_id !== null,
        hasServices: servicesResult.rows.length > 0,
        hasTeleServices: teleServices.length > 0,
        roleMatches: false // Will check below
      };

      // Check role matching for vet
      const targetRoles = ['veterinarian', 'vet', 'vet_clinic', 'vet_solo', 'Veterinarian (Solo)', 'Vet Solo', 'Veterinary Clinic'];
      eligibility.roleMatches = targetRoles.some(role =>
        vendor.role_name?.toLowerCase() === role.toLowerCase() ||
        vendor.role_display_name?.toLowerCase() === role.toLowerCase()
      );

      // If vendor is pending but has all other requirements, offer to approve
      const canApprove = !eligibility.statusApproved &&
        eligibility.isActive &&
        eligibility.hasRole &&
        eligibility.hasServices &&
        eligibility.hasTeleServices &&
        eligibility.roleMatches;

      return c.json({
        found: true,
        vendor: {
          id: vendor.id,
          business_name: vendor.business_name,
          owner_name: vendor.owner_name,
          phone: vendor.phone,
          status: vendor.status,
          is_active: vendor.is_active,
          vendor_type: vendor.vendor_type,
          role_name: vendor.role_name,
          role_display_name: vendor.role_display_name
        },
        services: {
          total: servicesResult.rows.length,
          all: servicesResult.rows,
          tele: teleServices
        },
        eligibility,
        willAppear: Object.values(eligibility).every(v => v === true),
        target_roles: targetRoles,
        canApprove,
        fix: canApprove ? 'Update vendor status from "pending" to "approved" to make it appear in results' : null
      });
    } catch (error: any) {
      console.error('[Diagnostics] Error:', error);
      return c.json({ error: error.message }, 500);
    }
}
