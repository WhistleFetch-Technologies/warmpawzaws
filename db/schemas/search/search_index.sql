-- ============================================================================
-- SEARCH_INDEX TABLE - SCHEMA
-- ============================================================================
-- Extracted from production RDS database
-- ============================================================================

-- ============================================================================
-- TABLE DEFINITION
-- ============================================================================

CREATE TABLE IF NOT EXISTS search_index (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    entity_type TEXT NOT NULL,
    entity_id UUID NOT NULL,
    search_text TEXT NOT NULL,
    search_vector tsvector GENERATED ALWAYS AS (to_tsvector('english', search_text)) STORED,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    PRIMARY KEY (id)
);

-- ============================================================================
-- UNIQUE CONSTRAINTS
-- ============================================================================

ALTER TABLE search_index ADD CONSTRAINT search_index_entity_unique UNIQUE (entity_type, entity_id);

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE UNIQUE INDEX search_index_pkey ON public.search_index USING btree (id);
CREATE UNIQUE INDEX search_index_entity_unique ON public.search_index USING btree (entity_type, entity_id);
CREATE INDEX idx_search_index_entity_type ON public.search_index USING btree (entity_type);
CREATE INDEX idx_search_index_entity_id ON public.search_index USING btree (entity_id);
CREATE INDEX idx_search_index_search_vector ON public.search_index USING gin(search_vector);

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE search_index IS 'Search index - maps from search_index_master KV key';
COMMENT ON COLUMN search_index.entity_type IS 'Entity type: vendor, service, staff, etc.';
COMMENT ON COLUMN search_index.entity_id IS 'Entity ID';
COMMENT ON COLUMN search_index.search_text IS 'Searchable text';
COMMENT ON COLUMN search_index.search_vector IS 'Full-text search vector (auto-generated)';
COMMENT ON COLUMN search_index.metadata IS 'Additional metadata (JSONB)';
