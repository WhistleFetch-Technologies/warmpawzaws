import { query, select, insert, update } from '../../../../database/rds-connection';

export async function dbDebugTrainingVendors0() {
  return await query(`
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
}

export async function dbDebugTrainingVendors1() {
  return await query(`
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
}

export async function dbDebugTrainingVendors2() {
  return await query(`
        SELECT
          v.id,
          v.business_name,
          v.specializations AS jsonb_specializations,
          v.metadata->'specializations' AS meta_specializations,
          (SELECT json_agg(vsp.specialization) FROM vendor_specializations vsp WHERE vsp.vendor_id = v.id) AS table_specializations
        FROM vendors v
        WHERE LOWER(v.business_name) LIKE '%wrong%' OR LOWER(v.business_name) LIKE '%training%'
        LIMIT 10
      `)
}

export async function dbDebugTrainingVendors3() {
  return await query(`
        SELECT id::text, specialization_id, name, display_name
        FROM specialization_master
        WHERE is_active = true
          AND (
            LOWER(TRIM(COALESCE(specialization_id,''))) LIKE '%obedience%'
            OR LOWER(TRIM(COALESCE(display_name,''))) LIKE '%obedience%'
            OR LOWER(TRIM(COALESCE(name,''))) LIKE '%obedience%'
          )
        LIMIT 10
      `)
}

export async function dbDebugTrainingVendors4(specKeys, specIlike) {
  return await query(`
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
      `, [specKeys, specIlike]);
}

