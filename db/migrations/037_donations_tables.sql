-- ============================================================================
-- DONATIONS TABLES
-- ============================================================================
-- Tables for donation management (monetary and in-kind donations)
-- ============================================================================

-- Donations
CREATE TABLE IF NOT EXISTS donations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
    donor_id UUID REFERENCES customers(id) ON DELETE SET NULL,
    donor_name TEXT NOT NULL,
    donor_email TEXT,
    donor_phone TEXT NOT NULL,
    donor_address TEXT,
    donation_type TEXT NOT NULL CHECK (donation_type IN ('monetary', 'food', 'medicine', 'supplies', 'equipment', 'other')),
    amount NUMERIC(10, 2),
    items JSONB DEFAULT '[]'::jsonb, -- For in-kind donations
    total_value NUMERIC(10, 2) NOT NULL,
    payment_method TEXT CHECK (payment_method IN ('cash', 'card', 'upi', 'bank_transfer', 'cheque')),
    transaction_id TEXT,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'received', 'acknowledged', 'utilized')),
    receipt_number TEXT NOT NULL UNIQUE,
    receipt_issued BOOLEAN DEFAULT false,
    receipt_url TEXT,
    tax_benefit BOOLEAN DEFAULT false,
    certificate_url TEXT,
    purpose TEXT,
    notes TEXT,
    received_date DATE,
    acknowledged_date DATE,
    thankyou_sent BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_donations_vendor_id ON donations(vendor_id);
CREATE INDEX IF NOT EXISTS idx_donations_donor_id ON donations(donor_id);
CREATE INDEX IF NOT EXISTS idx_donations_status ON donations(status);
CREATE INDEX IF NOT EXISTS idx_donations_donation_type ON donations(donation_type);
CREATE INDEX IF NOT EXISTS idx_donations_created_at ON donations(created_at);

-- Donation Campaigns
CREATE TABLE IF NOT EXISTS donation_campaigns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    goal_amount NUMERIC(10, 2) NOT NULL,
    raised_amount NUMERIC(10, 2) DEFAULT 0,
    start_date DATE NOT NULL,
    end_date DATE,
    status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'completed', 'cancelled')),
    image_url TEXT,
    donation_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_donation_campaigns_vendor_id ON donation_campaigns(vendor_id);
CREATE INDEX IF NOT EXISTS idx_donation_campaigns_status ON donation_campaigns(status);

-- Updated timestamp triggers
CREATE OR REPLACE FUNCTION update_donations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_donations_updated_at
    BEFORE UPDATE ON donations
    FOR EACH ROW
    EXECUTE FUNCTION update_donations_updated_at();

CREATE TRIGGER trigger_update_donation_campaigns_updated_at
    BEFORE UPDATE ON donation_campaigns
    FOR EACH ROW
    EXECUTE FUNCTION update_donations_updated_at();

