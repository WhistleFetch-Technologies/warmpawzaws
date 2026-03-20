-- ============================================================================
-- BEHAVIOR JOURNAL TABLE
-- ============================================================================
-- Table for storing pet behavior journal entries
-- Used by behaviorists and pet owners to track behavioral patterns
-- ============================================================================

-- Behavior Journal Entries
CREATE TABLE IF NOT EXISTS behavior_journal (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pet_id UUID NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    behavior TEXT NOT NULL,
    triggers TEXT[] DEFAULT '{}',
    duration TEXT,
    severity TEXT DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_behavior_journal_pet_id ON behavior_journal(pet_id);
CREATE INDEX IF NOT EXISTS idx_behavior_journal_customer_id ON behavior_journal(customer_id);
CREATE INDEX IF NOT EXISTS idx_behavior_journal_created_at ON behavior_journal(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_behavior_journal_behavior ON behavior_journal(behavior);
CREATE INDEX IF NOT EXISTS idx_behavior_journal_severity ON behavior_journal(severity);

-- Comments
COMMENT ON TABLE behavior_journal IS 'Pet behavior journal entries for tracking behavioral patterns and triggers';
COMMENT ON COLUMN behavior_journal.pet_id IS 'Reference to the pet';
COMMENT ON COLUMN behavior_journal.customer_id IS 'Reference to the pet owner';
COMMENT ON COLUMN behavior_journal.behavior IS 'Description of the behavior observed';
COMMENT ON COLUMN behavior_journal.triggers IS 'Array of triggers that may cause the behavior';
COMMENT ON COLUMN behavior_journal.duration IS 'Duration of the behavior episode';
COMMENT ON COLUMN behavior_journal.severity IS 'Severity level: low, medium, high, critical';
COMMENT ON COLUMN behavior_journal.notes IS 'Additional notes about the behavior';
