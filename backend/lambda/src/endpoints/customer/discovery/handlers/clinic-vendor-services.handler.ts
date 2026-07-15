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

export async function clinicVendorServicesHandler(c: Context) {

    try {
      const { vendorId } = c.req.param();
      const serviceStyle = c.req.query('style') || c.req.query('serviceStyle');

      if (!vendorId || !isValidUUID(vendorId)) {
        return c.json({ error: 'Valid vendor ID is required', success: false }, 400);
      }

      const clinicVendorOnline = await query(
        `SELECT COALESCE(is_online, true) AS is_online FROM vendors WHERE id = $1 LIMIT 1`,
        [vendorId]
      ).catch(() => ({ rows: [] as any[] }));
      if (!clinicVendorOnline.rows?.length || !vendorRowIsOnline(clinicVendorOnline.rows[0]?.is_online)) {
        return c.json({ error: 'Vendor not found', success: false }, 404);
      }

      // Get vendor services from vendor_services table
      let servicesQuery = `
        SELECT 
          vs.id,
          vs.service_id,
          vs.service_name,
          vs.service_style,
          vs.price,
          COALESCE(vs.custom_duration, vs.duration_minutes) as duration,
          COALESCE(vs.custom_description, (SELECT sc.description FROM service_catalog sc WHERE sc.service_name = vs.service_name AND sc.service_style = vs.service_style LIMIT 1), s.description) as description,
          vs.is_enabled,
          vs.publish_status,
          vs.category as category_name,
          vs.sub_category as sub_category_name,
          vs.metadata as package_details,
          s.name as base_service_name,
          s.description as base_description
        FROM vendor_services vs
        LEFT JOIN services s ON vs.service_id = s.id
        WHERE vs.vendor_id = $1 
          AND vs.is_enabled = true 
          AND (vs.publish_status IN ('published','auto_published') OR vs.publish_status IS NULL)
      `;

      const params: any[] = [vendorId];

      if (serviceStyle) {
        const acceptableStyles = acceptableStylesForService(serviceStyle);
        servicesQuery += ` AND vs.service_style = ANY($2::text[])`;
        params.push(acceptableStyles);
      }

      servicesQuery += ` ORDER BY vs.category, vs.service_name`;

      const servicesResult = await query(servicesQuery, params);

      const services = servicesResult.rows.map((s) => {
        const meta = parseVendorServiceMetadataForCustomer(s.package_details);
        const dur = s.duration || 30;
        const { isPackage, packageDetails } = vendorServicePackagePresentationForCustomer(meta, dur);
        return {
          id: s.id,
          serviceId: s.service_id,
          serviceName: s.service_name || s.base_service_name,
          description: cleanDescription(s.description) || cleanDescription(s.base_description) || '',
          price: parseFloat(s.price || 0),
          duration: dur,
          serviceStyle: s.service_style,
          categoryName: s.category_name || s.category,
          subCategoryName: s.sub_category_name || s.sub_category,
          metadata: meta,
          isPackage,
          packageDetails: isPackage ? packageDetails : undefined,
          isEnabled: s.is_enabled,
          publishStatus: s.publish_status,
        };
      });

      // Group by service style
      const groupedServices = {
        at_center: services.filter(s => s.serviceStyle === 'at_center'),
        at_home: services.filter(s => s.serviceStyle === 'at_home'),
        tele: services.filter(s => s.serviceStyle === 'tele'),
      };

      return c.json({
        success: true,
        services,
        grouped: groupedServices,
        total: services.length,
      });
    } catch (error: any) {
      console.error('Error fetching clinic services:', error);
      return c.json({ error: error.message, success: false }, 500);
    }
}
