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

export async function debugTrainingVendorsHandler(c: Context) {

    try {
      const hasVsCatId = await columnExists('vendor_services', 'category_id');

      // Show all trainer_center / training_center vendors and their at_center services
      const vendorCheck = await query(`
        SELECT
          v.id,
          v.business_name,
          v.status,
          v.is_active,
          v.is_online,
          r.name as role_name,
          (
            SELECT json_agg(json_build_object(
              'name', vs.service_name,
              'style', vs.service_style,
              'category', vs.category,
              'is_enabled', vs.is_enabled,
              'publish_status', vs.publish_status,
              'is_custom', vs.is_custom_service
            ))
            FROM vendor_services vs
            WHERE vs.vendor_id = v.id AND vs.service_style IN ('at_center','at_vendor','at_clinic')
              AND vs.is_enabled = true
              AND (vs.publish_status IS NULL OR vs.publish_status IN ('published','auto_published','draft'))
          ) as at_center_services,
          (SELECT COUNT(*) FROM vendor_services vs WHERE vs.vendor_id = v.id
            AND vs.is_enabled = true
            AND (vs.publish_status IS NULL OR vs.publish_status IN ('published','auto_published','draft'))
            AND vs.service_style IN ('at_center','at_vendor','at_clinic')
          ) as at_center_count
        FROM vendors v
        LEFT JOIN roles r ON v.role_id = r.id
        WHERE LOWER(COALESCE(r.name, '')) IN ('trainer_center', 'training_center', 'pet_trainer', 'trainer', 'trainer_solo')
        ORDER BY v.business_name
        LIMIT 20
      `);

      // Run the by-style EXISTS check for each vendor (full conditions including is_custom)
      const byStyleCheck = await query(`
        SELECT DISTINCT ON (v.id)
          v.id,
          v.business_name,
          v.status,
          v.is_active,
          v.is_online,
          r.name as role_name,
          EXISTS (
            SELECT 1 FROM vendor_services vs
            WHERE vs.vendor_id = v.id
              AND vs.is_enabled = true
              AND (vs.publish_status IS NULL OR LOWER(TRIM(COALESCE(vs.publish_status::text,''))) IN ('published','auto_published','draft'))
              AND vs.service_style = ANY(ARRAY['at_center','at_vendor','at_clinic'])
              AND (
                LOWER(COALESCE(vs.category,'')) = 'training'
                OR LOWER(COALESCE(vs.category,'')) LIKE '%training%'
                OR LOWER(COALESCE(TRIM(r.name), '')) IN ('trainer', 'pet_trainer', 'trainer_solo', 'trainer_center', 'training_center')
              )
          ) as passes_category_check,
          EXISTS (
            SELECT 1 FROM vendor_services vs
            WHERE vs.vendor_id = v.id
              AND vs.is_enabled = true
              AND (vs.publish_status IS NULL OR LOWER(TRIM(COALESCE(vs.publish_status::text,''))) IN ('published','auto_published','draft'))
              AND vs.service_style = ANY(ARRAY['at_center','at_vendor','at_clinic'])
              AND (
                LOWER(COALESCE(vs.category,'')) = 'training'
                OR LOWER(COALESCE(vs.category,'')) LIKE '%training%'
                OR LOWER(COALESCE(TRIM(r.name), '')) IN ('trainer', 'pet_trainer', 'trainer_solo', 'trainer_center', 'training_center')
              )
              AND (
                COALESCE(vs.is_custom_service, false) = false
                OR (
                  vs.is_custom_service = true
                  AND (
                    LOWER(TRIM(COALESCE(vs.category, ''))) LIKE '%training%'
                    OR TRIM(COALESCE(vs.category, '')) = ''
                    OR LOWER(COALESCE(TRIM(r.name), '')) IN ('trainer', 'pet_trainer', 'trainer_solo', 'trainer_center', 'training_center')
                  )
                )
              )
          ) as passes_full_check
        FROM vendors v
        LEFT JOIN roles r ON v.role_id = r.id
        WHERE v.is_active = true
          AND (
            LOWER(TRIM(COALESCE(v.status::text, ''))) IN ('approved', 'active', 'activated')
            OR (LOWER(TRIM(COALESCE(v.status::text, ''))) = 'pending' AND LOWER(TRIM(COALESCE(v.vendor_type::text, ''))) = 'solo')
          )
          AND COALESCE(v.is_online, true) = true
          AND LOWER(COALESCE(r.name, '')) IN ('trainer_center', 'training_center', 'pet_trainer', 'trainer', 'trainer_solo')
        ORDER BY v.id
        LIMIT 20
      `);

      // Check specializations for "wrong persona" vendor specifically
      const specCheck = await query(`
        SELECT
          v.id,
          v.business_name,
          v.specializations AS jsonb_specializations,
          v.metadata->'specializations' AS meta_specializations,
          (SELECT json_agg(vsp.specialization) FROM vendor_specializations vsp WHERE vsp.vendor_id = v.id) AS table_specializations
        FROM vendors v
        WHERE LOWER(v.business_name) LIKE '%wrong%' OR LOWER(v.business_name) LIKE '%training%'
        LIMIT 10
      `).catch(() => ({ rows: [] }));

      // Check what specialization_master has for basic_obedience
      const masterCheck = await query(`
        SELECT id::text, specialization_id, name, display_name
        FROM specialization_master
        WHERE is_active = true
          AND (
            LOWER(TRIM(COALESCE(specialization_id,''))) LIKE '%obedience%'
            OR LOWER(TRIM(COALESCE(display_name,''))) LIKE '%obedience%'
            OR LOWER(TRIM(COALESCE(name,''))) LIKE '%obedience%'
          )
        LIMIT 10
      `).catch(() => ({ rows: [] }));

      // Simulate the exact sqlVendorMatchesDeclaredSpecialization SQL for 'basic_obedience'
      // This is exactly what the by-style endpoint runs when specialization=basic_obedience
      const specKeys = ['basic_obedience', 'basic obedience', 'obedience', 'd9466ca6-2809-45e5-8a40-13443d652e8f'];
      const specIlike = ['%basic\\_obedience%', '%basic obedience%', '%obedience%', '%d9466ca6-2809-45e5-8a40-13443d652e8f%'];
      const specFilterSimulation = await query(`
        SELECT
          v.id,
          v.business_name,
          EXISTS (
            SELECT 1 FROM vendor_specializations vsp
            WHERE vsp.vendor_id = v.id
              AND (
                LOWER(TRIM(vsp.specialization)) = ANY($1::text[])
                OR vsp.specialization ILIKE ANY($2::text[])
              )
          ) AS branch1_table_exact,
          EXISTS (
            SELECT 1 FROM vendor_specializations vsp2
            JOIN specialization_master sm
              ON sm.is_active = true
                 AND (
                   sm.id::text = vsp2.specialization
                   OR LOWER(TRIM(sm.specialization_id)) = LOWER(TRIM(vsp2.specialization))
                   OR LOWER(TRIM(sm.name)) = LOWER(TRIM(vsp2.specialization))
                   OR LOWER(TRIM(sm.display_name)) = LOWER(TRIM(vsp2.specialization))
                 )
            WHERE vsp2.vendor_id = v.id
              AND (
                sm.id::text = ANY($1::text[])
                OR LOWER(TRIM(sm.specialization_id)) = ANY($1::text[])
                OR LOWER(TRIM(sm.name)) = ANY($1::text[])
                OR LOWER(TRIM(sm.display_name)) = ANY($1::text[])
                OR regexp_replace(LOWER(TRIM(sm.specialization_id)), '[^a-z0-9]+', '_', 'g') = ANY($1::text[])
              )
          ) AS branch2_table_uuid,
          CASE WHEN v.specializations IS NOT NULL
               THEN v.specializations::text ILIKE ANY($2::text[])
               ELSE false
          END AS branch3_jsonb_ilike,
          CASE WHEN v.metadata->'specializations' IS NOT NULL
               THEN (v.metadata->'specializations')::text ILIKE ANY($2::text[])
               ELSE false
          END AS branch4_meta_ilike,
          v.specializations AS raw_jsonb_specs,
          (SELECT json_agg(vsp.specialization) FROM vendor_specializations vsp WHERE vsp.vendor_id = v.id) AS raw_table_specs
        FROM vendors v
        WHERE LOWER(v.business_name) LIKE '%wrong%' OR LOWER(v.business_name) LIKE '%training center%'
        LIMIT 10
      `, [specKeys, specIlike]).catch((e: any) => ({ rows: [], error: e?.message }));

      return c.json({
        success: true,
        has_category_id_col: hasVsCatId,
        training_vendors_detail: vendorCheck.rows,
        by_style_check: byStyleCheck.rows,
        specialization_check: specCheck.rows,
        master_check: masterCheck.rows,
        spec_filter_simulation: (specFilterSimulation as any).rows || [],
        spec_filter_error: (specFilterSimulation as any).error || null,
      });
    } catch (error: any) {
      return c.json({ success: false, error: error?.message }, 500);
    }
}
