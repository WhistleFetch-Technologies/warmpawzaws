-- ============================================================================
-- MIGRATION 036: Security Fixes - Function Search Path and Extensions
-- ============================================================================
-- Date: 2025-01-27
-- Purpose: Fix security warnings by:
--          1. Setting search_path for all functions to prevent injection attacks
--          2. Moving postgis extension from public schema to extensions schema
-- ============================================================================

-- ============================================================================
-- PART 1: Fix Function Search Path Security Issues
-- ============================================================================
-- All functions need SET search_path to prevent search_path injection attacks
-- Using SET search_path = 'public' to lock functions to public schema only
-- ============================================================================

-- Function: auto_update_vendor_service_styles
CREATE OR REPLACE FUNCTION public.auto_update_vendor_service_styles()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = 'public'
AS $function$
BEGIN
  -- If role_id changed and service_styles is empty, update it
  IF NEW.role_id IS NOT NULL AND (NEW.role_id != OLD.role_id OR OLD.role_id IS NULL) THEN
    IF NEW.service_styles IS NULL OR array_length(NEW.service_styles, 1) IS NULL THEN
      NEW.service_styles := get_service_styles_from_role(NEW.role_id);
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Function: cleanup_expired_otps
CREATE OR REPLACE FUNCTION public.cleanup_expired_otps()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
BEGIN
  DELETE FROM otp_tokens
  WHERE expires_at < NOW() - INTERVAL '1 day';
END;
$function$;

-- Function: exec_sql
CREATE OR REPLACE FUNCTION public.exec_sql(query text, params text[])
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  result jsonb;
BEGIN
  EXECUTE query USING params[1], params[2], params[3] INTO result;
  RETURN result;
END;
$function$;

-- Function: get_service_styles_from_role
CREATE OR REPLACE FUNCTION public.get_service_styles_from_role(p_role_id character varying)
RETURNS text[]
LANGUAGE plpgsql
SET search_path = 'public'
AS $function$
DECLARE
  v_capabilities JSONB;
  v_service_styles TEXT[];
  v_role_name TEXT;
BEGIN
  -- Get role capabilities
  SELECT capabilities, name INTO v_capabilities, v_role_name FROM vendor_roles WHERE id = p_role_id;
  
  -- Extract serviceStyles from capabilities
  IF v_capabilities IS NOT NULL AND v_capabilities ? 'serviceStyles' THEN
    SELECT ARRAY(SELECT jsonb_array_elements_text(v_capabilities->'serviceStyles')) INTO v_service_styles;
  END IF;
  
  -- If not in capabilities, infer from role name
  IF v_service_styles IS NULL OR array_length(v_service_styles, 1) IS NULL THEN
    -- Default service styles based on role
    v_service_styles := CASE
      WHEN v_role_name IN ('pet_boarding', 'pet_kennel', 'pet_resort', 'pet_clinic') THEN ARRAY['at_center']
      WHEN v_role_name IN ('pet_walking', 'pet_sitter') THEN ARRAY['at_home']
      ELSE ARRAY['at_center', 'at_home', 'tele']
    END;
  END IF;
  
  RETURN COALESCE(v_service_styles, ARRAY['at_center', 'at_home', 'tele']);
END;
$function$;

-- Function: get_vendor_allowed_service_styles
CREATE OR REPLACE FUNCTION public.get_vendor_allowed_service_styles(p_vendor_id text)
RETURNS TABLE(allowed_styles text[], role_id character varying, role_name text, role_config jsonb)
LANGUAGE plpgsql
SET search_path = 'public'
AS $function$
DECLARE
  v_vendor_uuid UUID;
  v_role_id VARCHAR;
  v_service_styles TEXT[];
  v_role_name TEXT;
  v_role_capabilities JSONB;
BEGIN
  -- Resolve vendor ID
  v_vendor_uuid := resolve_vendor_id(p_vendor_id);
  
  IF v_vendor_uuid IS NULL THEN
    RETURN;
  END IF;
  
  -- Get vendor's role_id and service_styles
  SELECT v.role_id, v.service_styles, vr.name, vr.capabilities
  INTO v_role_id, v_service_styles, v_role_name, v_role_capabilities
  FROM vendors v
  LEFT JOIN vendor_roles vr ON vr.id = v.role_id
  WHERE v.id = v_vendor_uuid;
  
  -- If service_styles is empty, get from role capabilities
  IF v_service_styles IS NULL OR array_length(v_service_styles, 1) IS NULL THEN
    IF v_role_capabilities IS NOT NULL AND v_role_capabilities ? 'serviceStyles' THEN
      SELECT ARRAY(SELECT jsonb_array_elements_text(v_role_capabilities->'serviceStyles')) INTO v_service_styles;
    END IF;
  END IF;
  
  -- Fallback: infer from role name
  IF v_service_styles IS NULL OR array_length(v_service_styles, 1) IS NULL THEN
    v_service_styles := CASE
      WHEN v_role_name IN ('pet_boarding', 'pet_kennel', 'pet_resort', 'pet_clinic') THEN ARRAY['at_center']
      WHEN v_role_name IN ('pet_walking', 'pet_sitter') THEN ARRAY['at_home']
      ELSE ARRAY['at_center', 'at_home', 'tele']
    END;
  END IF;
  
  RETURN QUERY SELECT v_service_styles, v_role_id, v_role_name, v_role_capabilities;
END;
$function$;

-- Function: infer_role_id_from_category
CREATE OR REPLACE FUNCTION public.infer_role_id_from_category(p_category text, p_vendor_type text, p_business_name text)
RETURNS character varying
LANGUAGE plpgsql
SET search_path = 'public'
AS $function$
DECLARE
  v_role_id VARCHAR;
  v_role_name TEXT;
BEGIN
  -- Determine role name based on category, vendor_type, or business_name patterns
  v_role_name := CASE
    -- Veterinary roles
    WHEN p_category ILIKE '%vet%' OR p_category ILIKE '%clinic%' OR p_business_name ILIKE '%vet%' OR p_business_name ILIKE '%clinic%' THEN 'pet_clinic'
    WHEN p_category ILIKE '%doctor%' OR p_business_name ILIKE '%doctor%' THEN 'pet_clinic'
    
    -- Grooming roles
    WHEN p_category ILIKE '%groom%' OR p_business_name ILIKE '%groom%' OR p_business_name ILIKE '%salon%' THEN 'pet_grooming'
    
    -- Training roles
    WHEN p_category ILIKE '%train%' OR p_business_name ILIKE '%train%' THEN 'pet_trainer'
    
    -- Boarding roles
    WHEN p_category ILIKE '%board%' OR p_category ILIKE '%kennel%' OR p_category ILIKE '%resort%' 
         OR p_business_name ILIKE '%board%' OR p_business_name ILIKE '%kennel%' OR p_business_name ILIKE '%resort%' THEN 'pet_boarding'
    
    -- Walking/Sitting
    WHEN p_category ILIKE '%walk%' OR p_category ILIKE '%sit%' OR p_business_name ILIKE '%walk%' OR p_business_name ILIKE '%sit%' THEN 'pet_walking'
    
    -- Default to service provider
    ELSE 'service_provider'
  END;
  
  -- Find role by name
  SELECT id INTO v_role_id FROM vendor_roles WHERE name = v_role_name AND is_active = true LIMIT 1;
  
  -- If not found, try to find any active role
  IF v_role_id IS NULL THEN
    SELECT id INTO v_role_id FROM vendor_roles WHERE is_active = true LIMIT 1;
  END IF;
  
  RETURN v_role_id;
END;
$function$;

-- Function: populate_problem_grid_mapping
CREATE OR REPLACE FUNCTION public.populate_problem_grid_mapping(
  p_problem_id text,
  p_problem_name text,
  p_problem_display_name text,
  p_role_id text,
  p_sub_category_id text,
  p_sub_category_name text,
  p_order_index integer DEFAULT 0
)
RETURNS void
LANGUAGE plpgsql
SET search_path = 'public'
AS $function$
BEGIN
  INSERT INTO problem_grid_mappings (
    problem_id,
    problem_name,
    problem_display_name,
    role_id,
    sub_category_id,
    sub_category_name,
    order_index,
    created_at,
    updated_at
  )
  VALUES (
    p_problem_id,
    p_problem_name,
    p_problem_display_name,
    p_role_id,
    p_sub_category_id,
    p_sub_category_name,
    p_order_index,
    NOW(),
    NOW()
  )
  ON CONFLICT (problem_id, sub_category_id)
  DO UPDATE SET
    problem_name = EXCLUDED.problem_name,
    problem_display_name = EXCLUDED.problem_display_name,
    role_id = EXCLUDED.role_id,
    sub_category_name = EXCLUDED.sub_category_name,
    order_index = EXCLUDED.order_index,
    updated_at = NOW();
END;
$function$;

-- Function: resolve_vendor_id
CREATE OR REPLACE FUNCTION public.resolve_vendor_id(p_vendor_id text)
RETURNS uuid
LANGUAGE plpgsql
SET search_path = 'public'
AS $function$
DECLARE
  v_resolved_id UUID;
BEGIN
  -- Check if it's a UUID
  IF p_vendor_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    SELECT id INTO v_resolved_id FROM vendors WHERE id = p_vendor_id::UUID;
  ELSE
    -- Try vendor_id column
    SELECT id INTO v_resolved_id FROM vendors WHERE vendor_id = p_vendor_id;
    
    -- If not found, try phone (vendor_id might be like "vendor_9611377119")
    IF v_resolved_id IS NULL AND p_vendor_id LIKE 'vendor_%' THEN
      SELECT id INTO v_resolved_id FROM vendors WHERE phone = REPLACE(p_vendor_id, 'vendor_', '');
    END IF;
  END IF;
  
  RETURN v_resolved_id;
END;
$function$;

-- Function: restore_enhanced_forms_from_kv
CREATE OR REPLACE FUNCTION public.restore_enhanced_forms_from_kv()
RETURNS TABLE(role_name text, status text, kv_version integer, sql_version integer, sections_count integer, doc_sections_count integer)
LANGUAGE plpgsql
SET search_path = 'public'
AS $function$
DECLARE
  kv_rec RECORD;
  role_name_var TEXT;
  sections_var JSONB;
  doc_sections_var JSONB;
  kv_version_var INT;
  current_config_var JSONB;
  current_version_var INT;
  all_fields_var JSONB;
  section_elem JSONB;
  field_elem JSONB;
  updated_config_var JSONB;
BEGIN
  FOR kv_rec IN 
    SELECT key, value 
    FROM kv_store_3dd53475 
    WHERE key LIKE 'onboarding:form:%:active'
  LOOP
    -- Extract role name from key
    role_name_var := REPLACE(REPLACE(kv_rec.key, 'onboarding:form:', ''), ':active', '');
    
    -- Get sections and documentSections
    sections_var := kv_rec.value->'sections';
    doc_sections_var := COALESCE(kv_rec.value->'documentSections', '[]'::jsonb);
    kv_version_var := COALESCE((kv_rec.value->>'version')::int, 1);
    
    -- Get current role config
    SELECT config INTO current_config_var FROM roles WHERE name = role_name_var;
    
    IF current_config_var IS NULL THEN
      RETURN QUERY SELECT role_name_var::TEXT, 'skipped'::TEXT, kv_version_var, 0, 0, 0;
      CONTINUE;
    END IF;
    
    current_version_var := COALESCE((current_config_var->'onboardingFields'->>'version')::int, 0);
    
    -- Extract all fields from sections
    all_fields_var := '[]'::jsonb;
    IF sections_var IS NOT NULL AND jsonb_typeof(sections_var) = 'array' THEN
      FOR section_elem IN SELECT * FROM jsonb_array_elements(sections_var)
      LOOP
        IF section_elem->'fields' IS NOT NULL AND jsonb_typeof(section_elem->'fields') = 'array' THEN
          FOR field_elem IN SELECT * FROM jsonb_array_elements(section_elem->'fields')
          LOOP
            all_fields_var := all_fields_var || jsonb_set(
              field_elem,
              '{section}',
              to_jsonb(COALESCE(section_elem->>'id', section_elem->>'name', 'general'))
            );
          END LOOP;
        END IF;
      END LOOP;
    END IF;
    
    -- Build updated config
    updated_config_var := jsonb_set(
      current_config_var,
      '{onboardingFields}',
      jsonb_build_object(
        'version', GREATEST(kv_version_var, current_version_var),
        'fields', all_fields_var,
        'sections', COALESCE(sections_var, '[]'::jsonb),
        'documentSections', doc_sections_var
      )
    );
    
    -- Update role
    UPDATE roles 
    SET config = updated_config_var,
        updated_at = NOW()
    WHERE name = role_name_var;
    
    RETURN QUERY SELECT 
      role_name_var::TEXT,
      'restored'::TEXT,
      kv_version_var,
      GREATEST(kv_version_var, current_version_var),
      jsonb_array_length(COALESCE(sections_var, '[]'::jsonb)),
      jsonb_array_length(doc_sections_var);
  END LOOP;
END;
$function$;

-- Function: restore_enhanced_forms_from_kv_v2
CREATE OR REPLACE FUNCTION public.restore_enhanced_forms_from_kv_v2()
RETURNS TABLE(role_name text, status text, kv_version integer, sql_version integer, sections_count integer, doc_sections_count integer)
LANGUAGE plpgsql
SET search_path = 'public'
AS $function$
DECLARE
  kv_rec RECORD;
  role_name_var TEXT;
  sql_role_name_var TEXT;
  sections_var JSONB;
  doc_sections_var JSONB;
  kv_version_var INT;
  current_config_var JSONB;
  current_version_var INT;
  all_fields_var JSONB;
  section_elem JSONB;
  field_elem JSONB;
  updated_config_var JSONB;
  
  -- Role name mapping: KV name -> SQL name
  role_mapping JSONB := '{
    "pet_groomer": "groomer",
    "pet_clinic": "vet_clinic",
    "pet_boarder": "boarding",
    "pet_behaviorist": "behaviourist",
    "pet_cafe": "cafe",
    "pet_ambulance": "ambulance",
    "pet_insurance": "insurance",
    "pet_pharmacy": "pharmacy",
    "pet_photographer": "photography",
    "pet_trainer": "trainer",
    "pet_walker": "walker",
    "pet_shelter": "adoption",
    "pet_sunset": "sunset",
    "pet_product_seller": "product_seller",
    "service-provider": "service_provider",
    "sunset_services": "sunset",
    "veterinarian": "veterinarian"
  }'::jsonb;
BEGIN
  FOR kv_rec IN 
    SELECT key, value 
    FROM kv_store_3dd53475 
    WHERE key LIKE 'onboarding:form:%:active'
  LOOP
    -- Extract role name from key
    role_name_var := REPLACE(REPLACE(kv_rec.key, 'onboarding:form:', ''), ':active', '');
    
    -- Map KV role name to SQL role name
    sql_role_name_var := COALESCE(role_mapping->>role_name_var, role_name_var);
    
    -- Get sections and documentSections
    sections_var := kv_rec.value->'sections';
    doc_sections_var := COALESCE(kv_rec.value->'documentSections', '[]'::jsonb);
    kv_version_var := COALESCE((kv_rec.value->>'version')::int, 1);
    
    -- Get current role config
    SELECT config INTO current_config_var FROM roles WHERE name = sql_role_name_var;
    
    IF current_config_var IS NULL THEN
      RETURN QUERY SELECT role_name_var::TEXT, ('skipped (SQL role not found: ' || sql_role_name_var || ')')::TEXT, kv_version_var, 0, 0, 0;
      CONTINUE;
    END IF;
    
    current_version_var := COALESCE((current_config_var->'onboardingFields'->>'version')::int, 0);
    
    -- Extract all fields from sections
    all_fields_var := '[]'::jsonb;
    IF sections_var IS NOT NULL AND jsonb_typeof(sections_var) = 'array' THEN
      FOR section_elem IN SELECT * FROM jsonb_array_elements(sections_var)
      LOOP
        IF section_elem->'fields' IS NOT NULL AND jsonb_typeof(section_elem->'fields') = 'array' THEN
          FOR field_elem IN SELECT * FROM jsonb_array_elements(section_elem->'fields')
          LOOP
            all_fields_var := all_fields_var || jsonb_set(
              field_elem,
              '{section}',
              to_jsonb(COALESCE(section_elem->>'id', section_elem->>'name', 'general'))
            );
          END LOOP;
        END IF;
      END LOOP;
    END IF;
    
    -- Build updated config
    updated_config_var := jsonb_set(
      current_config_var,
      '{onboardingFields}',
      jsonb_build_object(
        'version', GREATEST(kv_version_var, current_version_var),
        'fields', all_fields_var,
        'sections', COALESCE(sections_var, '[]'::jsonb),
        'documentSections', doc_sections_var
      )
    );
    
    -- Update role
    UPDATE roles 
    SET config = updated_config_var,
        updated_at = NOW()
    WHERE name = sql_role_name_var;
    
    RETURN QUERY SELECT 
      role_name_var::TEXT,
      'restored'::TEXT,
      kv_version_var,
      GREATEST(kv_version_var, current_version_var),
      jsonb_array_length(COALESCE(sections_var, '[]'::jsonb)),
      jsonb_array_length(doc_sections_var);
  END LOOP;
END;
$function$;

-- Function: update_return_requests_updated_at
CREATE OR REPLACE FUNCTION public.update_return_requests_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = 'public'
AS $function$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$function$;

-- Function: update_staff_services_updated_at
CREATE OR REPLACE FUNCTION public.update_staff_services_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = 'public'
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

-- Function: update_updated_at_column
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = 'public'
AS $function$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$function$;

-- Function: update_vendor_role_config
CREATE OR REPLACE FUNCTION public.update_vendor_role_config(p_vendor_id text, p_role_id character varying DEFAULT NULL::character varying, p_service_styles text[] DEFAULT NULL::text[])
RETURNS boolean
LANGUAGE plpgsql
SET search_path = 'public'
AS $function$
DECLARE
  v_vendor_uuid UUID;
  v_final_role_id VARCHAR;
  v_final_service_styles TEXT[];
BEGIN
  -- Resolve vendor ID
  v_vendor_uuid := resolve_vendor_id(p_vendor_id);
  
  IF v_vendor_uuid IS NULL THEN
    RAISE EXCEPTION 'Vendor not found: %', p_vendor_id;
  END IF;
  
  -- Determine final role_id
  IF p_role_id IS NOT NULL THEN
    v_final_role_id := p_role_id;
  ELSE
    SELECT role_id INTO v_final_role_id FROM vendors WHERE id = v_vendor_uuid;
  END IF;
  
  -- Determine final service_styles
  IF p_service_styles IS NOT NULL AND array_length(p_service_styles, 1) > 0 THEN
    v_final_service_styles := p_service_styles;
  ELSIF v_final_role_id IS NOT NULL THEN
    SELECT get_service_styles_from_role(v_final_role_id) INTO v_final_service_styles;
  ELSE
    v_final_service_styles := ARRAY['at_center', 'at_home', 'tele'];
  END IF;
  
  -- Update vendor
  UPDATE vendors
  SET 
    role_id = COALESCE(v_final_role_id, role_id),
    service_styles = COALESCE(v_final_service_styles, service_styles),
    updated_at = NOW()
  WHERE id = v_vendor_uuid;
  
  RETURN TRUE;
END;
$function$;

-- Function: update_vendor_services_updated_at
CREATE OR REPLACE FUNCTION public.update_vendor_services_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = 'public'
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

-- Function: update_vendor_specialized_config_updated_at
CREATE OR REPLACE FUNCTION public.update_vendor_specialized_config_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = 'public'
AS $function$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$function$;

-- ============================================================================
-- PART 2: Move PostGIS Extension from Public Schema
-- ============================================================================
-- PostGIS extension should not be in the public schema for security reasons
-- Moving it to the extensions schema (standard practice)
-- ============================================================================

-- Create extensions schema if it doesn't exist
CREATE SCHEMA IF NOT EXISTS extensions;

-- Grant usage on extensions schema to public (or specific roles as needed)
GRANT USAGE ON SCHEMA extensions TO PUBLIC;

-- Move postgis extension to extensions schema
-- Note: PostgreSQL doesn't support moving extensions directly.
-- We need to recreate it in the new schema.
-- This is safe because PostGIS types and functions will be available
-- through the extensions schema in search_path.
DO $$
DECLARE
  v_extension_exists BOOLEAN;
  v_ext_version TEXT;
  v_has_dependent_objects BOOLEAN;
BEGIN
  -- Check if postgis extension exists in public schema
  SELECT EXISTS (
    SELECT 1 
    FROM pg_extension e
    JOIN pg_namespace n ON e.extnamespace = n.oid
    WHERE e.extname = 'postgis' AND n.nspname = 'public'
  ) INTO v_extension_exists;
  
  IF v_extension_exists THEN
    -- Get extension version
    SELECT extversion INTO v_ext_version
    FROM pg_extension
    WHERE extname = 'postgis';
    
    -- Check if there are user-created objects depending on PostGIS
    -- (not just the extension's own objects)
    SELECT EXISTS (
      SELECT 1
      FROM pg_depend d
      JOIN pg_extension e ON d.refobjid = e.oid
      JOIN pg_class c ON d.objid = c.oid
      WHERE e.extname = 'postgis'
        AND c.relnamespace != (SELECT oid FROM pg_namespace WHERE nspname = 'public')
        AND d.deptype = 'n'
    ) INTO v_has_dependent_objects;
    
    IF v_has_dependent_objects THEN
      RAISE WARNING 'PostGIS extension has dependent objects. Manual migration recommended.';
      RAISE NOTICE 'To move PostGIS manually:';
      RAISE NOTICE '1. Create extension in new schema: CREATE EXTENSION IF NOT EXISTS postgis SCHEMA extensions VERSION ''%'';', v_ext_version;
      RAISE NOTICE '2. Update any functions using PostGIS to include extensions in search_path';
      RAISE NOTICE '3. Drop old extension: DROP EXTENSION postgis;';
      RAISE NOTICE 'Note: This migration will create the extension in extensions schema.';
      RAISE NOTICE 'The old extension in public can be dropped after verifying everything works.';
    END IF;
    
    -- Create extension in extensions schema (if not already there)
    -- This makes PostGIS available in the extensions schema
    CREATE EXTENSION IF NOT EXISTS postgis SCHEMA extensions;
    
    RAISE NOTICE 'PostGIS extension created in extensions schema.';
    RAISE NOTICE 'Original extension in public schema can remain for backward compatibility.';
    RAISE NOTICE 'To fully migrate, drop the public schema extension after verifying:';
    RAISE NOTICE '  DROP EXTENSION postgis; (only if created in public schema)';
  ELSE
    -- Check if it already exists in extensions schema
    IF EXISTS (
      SELECT 1 
      FROM pg_extension e
      JOIN pg_namespace n ON e.extnamespace = n.oid
      WHERE e.extname = 'postgis' AND n.nspname = 'extensions'
    ) THEN
      RAISE NOTICE 'PostGIS extension already exists in extensions schema.';
    ELSE
      -- Create it in extensions schema
      CREATE EXTENSION IF NOT EXISTS postgis SCHEMA extensions;
      RAISE NOTICE 'PostGIS extension created in extensions schema.';
    END IF;
  END IF;
EXCEPTION
  WHEN insufficient_privilege THEN
    RAISE WARNING 'Insufficient privileges to create PostGIS extension. Manual intervention required.';
  WHEN OTHERS THEN
    RAISE WARNING 'Could not create PostGIS extension in extensions schema: %.', SQLERRM;
    RAISE NOTICE 'Manual intervention required. Run: CREATE EXTENSION postgis SCHEMA extensions;';
END $$;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
-- All 16 functions now have SET search_path = 'public' to prevent injection
-- PostGIS extension migration requires manual intervention (see notices above)
-- ============================================================================

