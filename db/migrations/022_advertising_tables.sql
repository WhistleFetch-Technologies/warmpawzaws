-- ============================================================================
-- MIGRATION 022: Advertising Tables
-- ============================================================================
-- Date: 2024-12-23
-- Purpose: Create tables for pay-per-click and impression advertising
-- Migration: Phase 2, Task 2.2 - Advertising Module
-- ============================================================================

-- Advertising Campaigns
CREATE TABLE IF NOT EXISTS advertising_campaigns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
    campaign_name TEXT NOT NULL,
    campaign_type TEXT NOT NULL CHECK (campaign_type IN ('ppc', 'impression', 'banner', 'sponsored')),
    
    -- Budget & Billing
    budget_amount NUMERIC(10, 2) NOT NULL,
    spent_amount NUMERIC(10, 2) DEFAULT 0,
    daily_budget NUMERIC(10, 2),
    cost_per_click NUMERIC(10, 2), -- For PPC campaigns
    cost_per_impression NUMERIC(10, 4), -- For impression campaigns (usually very small)
    
    -- Targeting
    target_audience JSONB DEFAULT '{}'::jsonb, -- {location, age, interests, etc.}
    target_keywords TEXT[] DEFAULT '{}'::TEXT[],
    target_categories UUID[] DEFAULT '{}'::UUID[], -- Product categories
    
    -- Campaign Details
    ad_creative JSONB NOT NULL, -- {title, description, image_url, landing_url}
    landing_url TEXT NOT NULL,
    
    -- Status & Dates
    status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'paused', 'completed', 'cancelled')),
    start_date DATE NOT NULL,
    end_date DATE,
    
    -- Performance Metrics
    total_impressions INTEGER DEFAULT 0,
    total_clicks INTEGER DEFAULT 0,
    total_conversions INTEGER DEFAULT 0,
    click_through_rate NUMERIC(5, 2) DEFAULT 0, -- Percentage
    conversion_rate NUMERIC(5, 2) DEFAULT 0, -- Percentage
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ad_campaigns_vendor_id ON advertising_campaigns(vendor_id);
CREATE INDEX IF NOT EXISTS idx_ad_campaigns_status ON advertising_campaigns(status);
CREATE INDEX IF NOT EXISTS idx_ad_campaigns_dates ON advertising_campaigns(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_ad_campaigns_type ON advertising_campaigns(campaign_type);

-- Ad Impressions (Track each impression)
CREATE TABLE IF NOT EXISTS ad_impressions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID NOT NULL REFERENCES advertising_campaigns(id) ON DELETE CASCADE,
    vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
    
    -- Impression Details
    impression_type TEXT NOT NULL CHECK (impression_type IN ('product', 'vendor', 'category', 'search', 'banner')),
    target_id UUID, -- product_id, vendor_id, category_id, etc.
    target_type TEXT, -- 'product', 'vendor', 'category', 'search'
    
    -- User Context
    customer_id UUID REFERENCES customers(id),
    session_id TEXT,
    ip_address TEXT,
    user_agent TEXT,
    
    -- Location
    location JSONB, -- {lat, lng, city, state, country}
    
    -- Timestamp
    impressed_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ad_impressions_campaign_id ON ad_impressions(campaign_id);
CREATE INDEX IF NOT EXISTS idx_ad_impressions_vendor_id ON ad_impressions(vendor_id);
CREATE INDEX IF NOT EXISTS idx_ad_impressions_impressed_at ON ad_impressions(impressed_at);
CREATE INDEX IF NOT EXISTS idx_ad_impressions_type ON ad_impressions(impression_type, target_type);

-- Ad Clicks (Track each click)
CREATE TABLE IF NOT EXISTS ad_clicks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID NOT NULL REFERENCES advertising_campaigns(id) ON DELETE CASCADE,
    impression_id UUID REFERENCES ad_impressions(id) ON DELETE SET NULL,
    vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
    
    -- Click Details
    click_type TEXT NOT NULL CHECK (click_type IN ('product', 'vendor', 'category', 'search', 'banner')),
    target_id UUID,
    target_type TEXT,
    
    -- User Context
    customer_id UUID REFERENCES customers(id),
    session_id TEXT,
    ip_address TEXT,
    user_agent TEXT,
    referrer TEXT,
    
    -- Location
    location JSONB,
    
    -- Conversion Tracking
    converted BOOLEAN DEFAULT false,
    conversion_type TEXT, -- 'purchase', 'booking', 'signup', etc.
    conversion_value NUMERIC(10, 2),
    converted_at TIMESTAMPTZ,
    
    -- Timestamp
    clicked_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ad_clicks_campaign_id ON ad_clicks(campaign_id);
CREATE INDEX IF NOT EXISTS idx_ad_clicks_vendor_id ON ad_clicks(vendor_id);
CREATE INDEX IF NOT EXISTS idx_ad_clicks_clicked_at ON ad_clicks(clicked_at);
CREATE INDEX IF NOT EXISTS idx_ad_clicks_converted ON ad_clicks(converted) WHERE converted = true;

-- Ad Budget Transactions (Track spending)
CREATE TABLE IF NOT EXISTS ad_budget_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID NOT NULL REFERENCES advertising_campaigns(id) ON DELETE CASCADE,
    vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
    
    -- Transaction Details
    transaction_type TEXT NOT NULL CHECK (transaction_type IN ('click', 'impression', 'refund', 'adjustment')),
    amount NUMERIC(10, 2) NOT NULL,
    currency TEXT DEFAULT 'INR',
    
    -- Related Records
    click_id UUID REFERENCES ad_clicks(id),
    impression_id UUID REFERENCES ad_impressions(id),
    
    -- Metadata
    description TEXT,
    
    -- Timestamp
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ad_budget_campaign_id ON ad_budget_transactions(campaign_id);
CREATE INDEX IF NOT EXISTS idx_ad_budget_vendor_id ON ad_budget_transactions(vendor_id);
CREATE INDEX IF NOT EXISTS idx_ad_budget_created_at ON ad_budget_transactions(created_at);

-- Ad Performance Analytics (Daily aggregated stats)
CREATE TABLE IF NOT EXISTS ad_performance_analytics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID NOT NULL REFERENCES advertising_campaigns(id) ON DELETE CASCADE,
    vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
    
    -- Date
    date DATE NOT NULL,
    
    -- Metrics
    impressions INTEGER DEFAULT 0,
    clicks INTEGER DEFAULT 0,
    conversions INTEGER DEFAULT 0,
    spend NUMERIC(10, 2) DEFAULT 0,
    revenue NUMERIC(10, 2) DEFAULT 0,
    
    -- Calculated Metrics
    ctr NUMERIC(5, 2) DEFAULT 0, -- Click-through rate
    cpc NUMERIC(10, 2) DEFAULT 0, -- Cost per click
    cpm NUMERIC(10, 2) DEFAULT 0, -- Cost per 1000 impressions
    conversion_rate NUMERIC(5, 2) DEFAULT 0,
    roas NUMERIC(10, 2) DEFAULT 0, -- Return on ad spend
    
    -- Timestamp
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(campaign_id, date)
);

CREATE INDEX IF NOT EXISTS idx_ad_performance_campaign_id ON ad_performance_analytics(campaign_id);
CREATE INDEX IF NOT EXISTS idx_ad_performance_vendor_id ON ad_performance_analytics(vendor_id);
CREATE INDEX IF NOT EXISTS idx_ad_performance_date ON ad_performance_analytics(date);

COMMENT ON TABLE advertising_campaigns IS 'Advertising campaigns for vendors - PPC and impression-based';
COMMENT ON TABLE ad_impressions IS 'Track each ad impression for billing and analytics';
COMMENT ON TABLE ad_clicks IS 'Track each ad click for billing and conversion tracking';
COMMENT ON TABLE ad_budget_transactions IS 'Track all budget spending transactions';
COMMENT ON TABLE ad_performance_analytics IS 'Daily aggregated performance metrics for campaigns';

