-- ============================================================================
-- MIGRATION 036: Content Assets Table
-- ============================================================================
-- Date: 2025-01-27
-- Purpose: Create content_assets table for content library management
-- ============================================================================

-- Content Assets table
-- Stores uploaded content assets (images, videos, documents) for marketing
CREATE TABLE IF NOT EXISTS content_assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    asset_id TEXT UNIQUE NOT NULL, -- Original asset ID from KV
    type TEXT NOT NULL CHECK (type IN ('image', 'video', 'document', 'audio', 'other')),
    category TEXT DEFAULT 'general',
    title TEXT NOT NULL,
    description TEXT,
    url TEXT NOT NULL, -- S3 URL
    thumbnail_url TEXT,
    file_size INTEGER, -- Size in bytes
    mime_type TEXT,
    width INTEGER, -- For images/videos
    height INTEGER, -- For images/videos
    duration INTEGER, -- For videos/audio (in seconds)
    metadata JSONB DEFAULT '{}'::jsonb, -- Additional metadata
    approval_status TEXT DEFAULT 'pending' CHECK (approval_status IN ('pending', 'approved', 'rejected')),
    approved_by UUID, -- References admin users
    approved_at TIMESTAMPTZ,
    rejection_reason TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_content_assets_type ON content_assets(type);
CREATE INDEX IF NOT EXISTS idx_content_assets_category ON content_assets(category);
CREATE INDEX IF NOT EXISTS idx_content_assets_approval_status ON content_assets(approval_status);
CREATE INDEX IF NOT EXISTS idx_content_assets_active ON content_assets(is_active);
CREATE INDEX IF NOT EXISTS idx_content_assets_asset_id ON content_assets(asset_id);

COMMENT ON TABLE content_assets IS 'Content library assets (images, videos, documents) for marketing and content management';
COMMENT ON COLUMN content_assets.asset_id IS 'Original asset ID from KV (content:asset:*)';

