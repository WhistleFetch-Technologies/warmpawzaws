-- ============================================================================
-- SEARCH_HISTORY TABLE - SCHEMA
-- ============================================================================
-- Extracted from production RDS database
-- ============================================================================

-- ============================================================================
-- TABLE DEFINITION
-- ============================================================================

CREATE TABLE IF NOT EXISTS search_history (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    customer_id UUID,
    search_query TEXT NOT NULL,
    results_count INTEGER DEFAULT 0,
    clicked_result_id UUID,
    created_at TIMESTAMPTZ DEFAULT now(),
    PRIMARY KEY (id)
);

-- ============================================================================
-- FOREIGN KEY CONSTRAINTS
-- ============================================================================

ALTER TABLE search_history ADD CONSTRAINT search_history_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES customers(id) ON UPDATE NO ACTION ON DELETE SET NULL;

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE UNIQUE INDEX search_history_pkey ON public.search_history USING btree (id);
CREATE INDEX idx_search_history_customer_id ON public.search_history USING btree (customer_id) WHERE customer_id IS NOT NULL;
CREATE INDEX idx_search_history_created_at ON public.search_history USING btree (created_at DESC);

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE search_history IS 'Search history - maps from search_history_trie KV key';
COMMENT ON COLUMN search_history.customer_id IS 'Reference to customers table';
COMMENT ON COLUMN search_history.search_query IS 'Search query text';
COMMENT ON COLUMN search_history.results_count IS 'Number of results returned';
COMMENT ON COLUMN search_history.clicked_result_id IS 'ID of result that was clicked';
