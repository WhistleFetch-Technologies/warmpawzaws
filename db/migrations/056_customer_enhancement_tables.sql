-- ============================================================================
-- MIGRATION 056: Customer Enhancement Tables
-- ============================================================================
-- Purpose: Add missing customer-related tables for complete lifecycle
-- Date: 2026-01-12
-- ============================================================================

-- Customer Notification Settings
CREATE TABLE IF NOT EXISTS customer_notification_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    email_notifications BOOLEAN DEFAULT true,
    sms_notifications BOOLEAN DEFAULT true,
    push_notifications BOOLEAN DEFAULT true,
    booking_reminders BOOLEAN DEFAULT true,
    promotional_emails BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(customer_id)
);

CREATE INDEX IF NOT EXISTS idx_customer_notification_settings_customer ON customer_notification_settings(customer_id);

-- Customer Search History
CREATE TABLE IF NOT EXISTS customer_search_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    search_query TEXT NOT NULL,
    search_type TEXT DEFAULT 'general',
    filters JSONB DEFAULT '{}',
    results_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_customer_search_history_customer ON customer_search_history(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_search_history_created ON customer_search_history(created_at DESC);

-- Customer Favorites
CREATE TABLE IF NOT EXISTS customer_favorites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    favorite_type TEXT NOT NULL CHECK (favorite_type IN ('vendor', 'service', 'product')),
    favorite_id UUID NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(customer_id, favorite_type, favorite_id)
);

CREATE INDEX IF NOT EXISTS idx_customer_favorites_customer ON customer_favorites(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_favorites_type ON customer_favorites(favorite_type, favorite_id);

-- Customer Questionnaires
CREATE TABLE IF NOT EXISTS customer_questionnaires (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    questionnaire_type TEXT NOT NULL CHECK (questionnaire_type IN ('planning', 'have_pet', 'end_of_life')),
    answers JSONB NOT NULL DEFAULT '{}',
    completed_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_customer_questionnaires_customer ON customer_questionnaires(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_questionnaires_type ON customer_questionnaires(questionnaire_type);

COMMENT ON TABLE customer_notification_settings IS 'Customer notification preferences';
COMMENT ON TABLE customer_search_history IS 'Customer search history for recommendations';
COMMENT ON TABLE customer_favorites IS 'Customer favorite vendors, services, and products';
COMMENT ON TABLE customer_questionnaires IS 'Customer onboarding questionnaire responses';
