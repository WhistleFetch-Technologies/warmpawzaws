-- Migration: Extend search_index for individual services and products
-- Idempotent, additive only

-- Ensure upsert target exists (007 adds this; some envs only have a non-unique index)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'search_index_entity_unique'
    ) THEN
        ALTER TABLE search_index
        ADD CONSTRAINT search_index_entity_unique
        UNIQUE (entity_type, entity_id);
    END IF;
END $$;

-- ============================================
-- SERVICE SEARCH INDEX
-- ============================================

CREATE OR REPLACE FUNCTION update_search_index_for_service(p_vendor_service_id UUID)
RETURNS void AS $$
DECLARE
    v_search_text TEXT;
    v_metadata JSONB;
    v_is_listable BOOLEAN;
BEGIN
    SELECT
        vs.is_enabled = true
        AND vs.publish_status IN ('published', 'auto_published')
        AND v.is_active = true
        AND v.status IN ('approved', 'activated', 'active'),
        LOWER(
            COALESCE(vs.service_name, '') || ' ' ||
            COALESCE(vs.custom_description, '') || ' ' ||
            COALESCE(vs.sub_category, '') || ' ' ||
            COALESCE(vs.category, '') || ' ' ||
            COALESCE(v.business_name, '')
        ),
        jsonb_build_object(
            'serviceName', vs.service_name,
            'vendorId', vs.vendor_id,
            'category', vs.category,
            'subCategory', vs.sub_category
        )
    INTO v_is_listable, v_search_text, v_metadata
    FROM vendor_services vs
    JOIN vendors v ON v.id = vs.vendor_id
    WHERE vs.id = p_vendor_service_id;

    IF NOT FOUND OR NOT v_is_listable OR NULLIF(TRIM(v_search_text), '') IS NULL THEN
        DELETE FROM search_index
        WHERE entity_type = 'service' AND entity_id = p_vendor_service_id;
        RETURN;
    END IF;

    INSERT INTO search_index (entity_type, entity_id, search_text, metadata, updated_at)
    VALUES ('service', p_vendor_service_id, v_search_text, v_metadata, NOW())
    ON CONFLICT (entity_type, entity_id)
    DO UPDATE SET
        search_text = EXCLUDED.search_text,
        metadata = EXCLUDED.metadata,
        updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- PRODUCT SEARCH INDEX
-- ============================================

CREATE OR REPLACE FUNCTION update_search_index_for_product(p_product_id UUID)
RETURNS void AS $$
DECLARE
    v_search_text TEXT;
    v_metadata JSONB;
    v_is_listable BOOLEAN;
BEGIN
    SELECT
        p.is_active = true,
        LOWER(
            COALESCE(p.name, '') || ' ' ||
            COALESCE(p.description, '') || ' ' ||
            COALESCE(v.business_name, '')
        ),
        jsonb_build_object(
            'productName', p.name,
            'vendorId', p.vendor_id,
            'category', p.category
        )
    INTO v_is_listable, v_search_text, v_metadata
    FROM products p
    LEFT JOIN vendors v ON v.id = p.vendor_id
    WHERE p.id = p_product_id;

    IF NOT FOUND OR NOT v_is_listable OR NULLIF(TRIM(v_search_text), '') IS NULL THEN
        DELETE FROM search_index
        WHERE entity_type = 'product' AND entity_id = p_product_id;
        RETURN;
    END IF;

    INSERT INTO search_index (entity_type, entity_id, search_text, metadata, updated_at)
    VALUES ('product', p_product_id, v_search_text, v_metadata, NOW())
    ON CONFLICT (entity_type, entity_id)
    DO UPDATE SET
        search_text = EXCLUDED.search_text,
        metadata = EXCLUDED.metadata,
        updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- TRIGGERS
-- ============================================

CREATE OR REPLACE FUNCTION trigger_update_service_search_index()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        DELETE FROM search_index
        WHERE entity_type = 'service' AND entity_id = OLD.id;
        RETURN OLD;
    END IF;

    PERFORM update_search_index_for_service(NEW.id);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_vendor_service_entity_search_index ON vendor_services;
CREATE TRIGGER trigger_vendor_service_entity_search_index
    AFTER INSERT OR UPDATE OR DELETE ON vendor_services
    FOR EACH ROW
    EXECUTE FUNCTION trigger_update_service_search_index();

CREATE OR REPLACE FUNCTION trigger_update_product_search_index()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        DELETE FROM search_index
        WHERE entity_type = 'product' AND entity_id = OLD.id;
        RETURN OLD;
    END IF;

    PERFORM update_search_index_for_product(NEW.id);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_product_search_index ON products;
CREATE TRIGGER trigger_product_search_index
    AFTER INSERT OR UPDATE OR DELETE ON products
    FOR EACH ROW
    EXECUTE FUNCTION trigger_update_product_search_index();

-- ============================================
-- BACKFILL (idempotent)
-- ============================================

INSERT INTO search_index (entity_type, entity_id, search_text, metadata, updated_at)
SELECT
    'service',
    vs.id,
    LOWER(
        COALESCE(vs.service_name, '') || ' ' ||
        COALESCE(vs.custom_description, '') || ' ' ||
        COALESCE(vs.sub_category, '') || ' ' ||
        COALESCE(vs.category, '') || ' ' ||
        COALESCE(v.business_name, '')
    ),
    jsonb_build_object(
        'serviceName', vs.service_name,
        'vendorId', vs.vendor_id,
        'category', vs.category,
        'subCategory', vs.sub_category
    ),
    NOW()
FROM vendor_services vs
JOIN vendors v ON v.id = vs.vendor_id
WHERE vs.is_enabled = true
  AND vs.publish_status IN ('published', 'auto_published')
  AND v.is_active = true
  AND v.status IN ('approved', 'activated', 'active')
ON CONFLICT (entity_type, entity_id)
DO UPDATE SET
    search_text = EXCLUDED.search_text,
    metadata = EXCLUDED.metadata,
    updated_at = NOW();

INSERT INTO search_index (entity_type, entity_id, search_text, metadata, updated_at)
SELECT
    'product',
    p.id,
    LOWER(
        COALESCE(p.name, '') || ' ' ||
        COALESCE(p.description, '') || ' ' ||
        COALESCE(v.business_name, '')
    ),
    jsonb_build_object(
        'productName', p.name,
        'vendorId', p.vendor_id,
        'category', p.category
    ),
    NOW()
FROM products p
LEFT JOIN vendors v ON v.id = p.vendor_id
WHERE p.is_active = true
ON CONFLICT (entity_type, entity_id)
DO UPDATE SET
    search_text = EXCLUDED.search_text,
    metadata = EXCLUDED.metadata,
    updated_at = NOW();

COMMENT ON FUNCTION update_search_index_for_service IS 'Upserts or removes search_index row for a vendor_services entity';
COMMENT ON FUNCTION update_search_index_for_product IS 'Upserts or removes search_index row for a products entity';
