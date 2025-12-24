-- ============================================================================
-- DATING & MATING SERVICE - COMPLETE SCHEMA
-- ============================================================================
-- Migration: 009_dating_mating_complete.sql
-- Date: 2025-01-23
-- 
-- Complete schema for P2P dating service:
-- - Pet dating profiles
-- - Owner dating profiles
-- - Matches
-- - Chat channels
-- - Meet-ups (Café bookings)
-- - Mating appointments (Vet bookings)
-- - Subscription integration
-- ============================================================================

-- Dating Profiles (Pet)
CREATE TABLE IF NOT EXISTS dating_profiles_pet (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id TEXT NOT NULL UNIQUE, -- e.g., 'pet_dating_{petId}'
    pet_id UUID REFERENCES pets(id) ON DELETE CASCADE,
    customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    breed TEXT NOT NULL,
    age INTEGER,
    gender TEXT CHECK (gender IN ('male', 'female', 'unknown')),
    photos JSONB DEFAULT '[]'::jsonb,
    temperament TEXT DEFAULT 'friendly',
    vaccinated BOOLEAN DEFAULT false,
    bio TEXT,
    looking_for TEXT CHECK (looking_for IN ('mating', 'playdate', 'both')) DEFAULT 'both',
    location JSONB, -- {lat, lng, city, address}
    is_active BOOLEAN DEFAULT true,
    likes JSONB DEFAULT '[]'::jsonb, -- Array of profile IDs
    dislikes JSONB DEFAULT '[]'::jsonb,
    matches JSONB DEFAULT '[]'::jsonb,
    preferences JSONB DEFAULT '{}'::jsonb, -- {breed, distance, age, temperament}
    flagged BOOLEAN DEFAULT false,
    suspended BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_dating_profiles_pet_customer ON dating_profiles_pet(customer_id);
CREATE INDEX idx_dating_profiles_pet_pet ON dating_profiles_pet(pet_id);
CREATE INDEX idx_dating_profiles_pet_active ON dating_profiles_pet(is_active) WHERE is_active = true;
CREATE INDEX idx_dating_profiles_pet_breed ON dating_profiles_pet(breed);
CREATE INDEX idx_dating_profiles_pet_looking_for ON dating_profiles_pet(looking_for);

-- Dating Profiles (Owner)
CREATE TABLE IF NOT EXISTS dating_profiles_owner (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id TEXT NOT NULL UNIQUE, -- e.g., 'owner_dating_{userId}'
    customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    age INTEGER,
    photos JSONB DEFAULT '[]'::jsonb,
    bio TEXT,
    pets JSONB DEFAULT '[]'::jsonb, -- Array of pet info
    interests JSONB DEFAULT '[]'::jsonb,
    location JSONB, -- {lat, lng, city, address}
    is_active BOOLEAN DEFAULT true,
    likes JSONB DEFAULT '[]'::jsonb,
    dislikes JSONB DEFAULT '[]'::jsonb,
    matches JSONB DEFAULT '[]'::jsonb,
    preferences JSONB DEFAULT '{}'::jsonb,
    flagged BOOLEAN DEFAULT false,
    suspended BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_dating_profiles_owner_customer ON dating_profiles_owner(customer_id);
CREATE INDEX idx_dating_profiles_owner_active ON dating_profiles_owner(is_active) WHERE is_active = true;

-- Dating Matches
CREATE TABLE IF NOT EXISTS dating_matches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    match_id TEXT NOT NULL UNIQUE, -- e.g., 'match_{timestamp}_{random}'
    profile_type TEXT NOT NULL CHECK (profile_type IN ('pet', 'owner')),
    profile1_id TEXT NOT NULL, -- References profile_id from dating_profiles_pet or dating_profiles_owner
    profile2_id TEXT NOT NULL,
    customer1_id UUID NOT NULL REFERENCES customers(id),
    customer2_id UUID NOT NULL REFERENCES customers(id),
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'archived', 'blocked')),
    chat_unlocked BOOLEAN DEFAULT false,
    chat_unlocked_by UUID REFERENCES customers(id),
    chat_unlocked_at TIMESTAMPTZ,
    chat_channel_arn TEXT, -- AWS Chime or KV reference
    chat_channel_name TEXT,
    chime_app_instance_arn TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_dating_matches_customer1 ON dating_matches(customer1_id);
CREATE INDEX idx_dating_matches_customer2 ON dating_matches(customer2_id);
CREATE INDEX idx_dating_matches_status ON dating_matches(status);
CREATE INDEX idx_dating_matches_profile_type ON dating_matches(profile_type);

-- Dating Meet-ups (Café Bookings)
CREATE TABLE IF NOT EXISTS dating_meetups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    meetup_id TEXT NOT NULL UNIQUE,
    match_id UUID REFERENCES dating_matches(id) ON DELETE CASCADE,
    initiated_by UUID NOT NULL REFERENCES customers(id),
    customer1_id UUID NOT NULL REFERENCES customers(id),
    customer2_id UUID NOT NULL REFERENCES customers(id),
    cafe_vendor_id UUID REFERENCES vendors(id),
    booking_id UUID REFERENCES bookings(id), -- Links to actual booking
    scheduled_date DATE NOT NULL,
    scheduled_time TIME NOT NULL,
    notes TEXT,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'completed', 'cancelled')),
    feedback1 JSONB, -- Feedback from customer1
    feedback2 JSONB, -- Feedback from customer2
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_dating_meetups_match ON dating_meetups(match_id);
CREATE INDEX idx_dating_meetups_cafe ON dating_meetups(cafe_vendor_id);
CREATE INDEX idx_dating_meetups_status ON dating_meetups(status);

-- Mating Appointments (Vet Bookings)
CREATE TABLE IF NOT EXISTS mating_appointments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    appointment_id TEXT NOT NULL UNIQUE,
    match_id UUID REFERENCES dating_matches(id) ON DELETE CASCADE,
    requested_by UUID NOT NULL REFERENCES customers(id),
    customer1_id UUID NOT NULL REFERENCES customers(id),
    customer2_id UUID NOT NULL REFERENCES customers(id),
    pet1_id UUID REFERENCES pets(id),
    pet2_id UUID REFERENCES pets(id),
    vet_vendor_id UUID NOT NULL REFERENCES vendors(id),
    booking_id UUID REFERENCES bookings(id), -- Links to actual booking
    scheduled_date DATE NOT NULL,
    scheduled_time TIME NOT NULL,
    notes TEXT,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'completed', 'cancelled')),
    feedback1 JSONB,
    feedback2 JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_mating_appointments_match ON mating_appointments(match_id);
CREATE INDEX idx_mating_appointments_vet ON mating_appointments(vet_vendor_id);
CREATE INDEX idx_mating_appointments_status ON mating_appointments(status);

-- Subscription Tiers Enhancement (Add role-based access)
DO $$ 
BEGIN
    -- Add tier_type if not exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='subscription_tiers' AND column_name='tier_type') THEN
        ALTER TABLE subscription_tiers ADD COLUMN tier_type TEXT CHECK (tier_type IN ('vendor', 'customer', 'p2p_service')) DEFAULT 'customer';
    END IF;
    
    -- Add applicable_roles if not exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='subscription_tiers' AND column_name='applicable_roles') THEN
        ALTER TABLE subscription_tiers ADD COLUMN applicable_roles JSONB DEFAULT '[]'::jsonb;
    END IF;
    
    -- Add enabled_roles if not exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='subscription_tiers' AND column_name='enabled_roles') THEN
        ALTER TABLE subscription_tiers ADD COLUMN enabled_roles JSONB DEFAULT '[]'::jsonb;
    END IF;
    
    -- Add disabled_roles if not exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='subscription_tiers' AND column_name='disabled_roles') THEN
        ALTER TABLE subscription_tiers ADD COLUMN disabled_roles JSONB DEFAULT '[]'::jsonb;
    END IF;
    
    -- Add billing_cycle if not exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='subscription_tiers' AND column_name='billing_cycle') THEN
        ALTER TABLE subscription_tiers ADD COLUMN billing_cycle TEXT CHECK (billing_cycle IN ('monthly', 'quarterly', 'semi_annual', 'annual')) DEFAULT 'monthly';
    END IF;
    
    -- Add commission_rate if not exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='subscription_tiers' AND column_name='commission_rate') THEN
        ALTER TABLE subscription_tiers ADD COLUMN commission_rate NUMERIC(5, 2);
    END IF;
    
    -- Add benefits if not exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='subscription_tiers' AND column_name='benefits') THEN
        ALTER TABLE subscription_tiers ADD COLUMN benefits JSONB DEFAULT '{}'::jsonb;
    END IF;
    
    -- Add quarterly_price, semi_annual_price, annual_price if not exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='subscription_tiers' AND column_name='quarterly_price') THEN
        ALTER TABLE subscription_tiers ADD COLUMN quarterly_price NUMERIC(10, 2);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='subscription_tiers' AND column_name='semi_annual_price') THEN
        ALTER TABLE subscription_tiers ADD COLUMN semi_annual_price NUMERIC(10, 2);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='subscription_tiers' AND column_name='annual_price') THEN
        ALTER TABLE subscription_tiers ADD COLUMN annual_price NUMERIC(10, 2);
    END IF;
    
    -- Add display_name if not exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='subscription_tiers' AND column_name='display_name') THEN
        ALTER TABLE subscription_tiers ADD COLUMN display_name TEXT;
        -- Set display_name to tier_name for existing rows
        UPDATE subscription_tiers SET display_name = tier_name WHERE display_name IS NULL;
    END IF;
END $$;

-- User Subscriptions (P2P Service)
CREATE TABLE IF NOT EXISTS user_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subscription_id TEXT NOT NULL UNIQUE,
    customer_id UUID NOT NULL REFERENCES customers(id),
    tier_id UUID NOT NULL REFERENCES subscription_tiers(id),
    tier_name TEXT NOT NULL,
    tier_type TEXT NOT NULL,
    price NUMERIC(10, 2) NOT NULL,
    billing_cycle TEXT NOT NULL,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'cancelled', 'expired', 'pending')),
    start_date DATE NOT NULL,
    next_billing_date DATE,
    end_date DATE,
    payment_id TEXT,
    payment_method TEXT DEFAULT 'razorpay',
    cancelled_at TIMESTAMPTZ,
    cancellation_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_user_subscriptions_customer ON user_subscriptions(customer_id);
CREATE INDEX idx_user_subscriptions_tier ON user_subscriptions(tier_id);
CREATE INDEX idx_user_subscriptions_status ON user_subscriptions(status);
CREATE INDEX idx_user_subscriptions_tier_type ON user_subscriptions(tier_type);

-- Dating Chat Messages (if using KV fallback, otherwise use AWS Chime)
CREATE TABLE IF NOT EXISTS dating_chat_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    match_id UUID NOT NULL REFERENCES dating_matches(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES customers(id),
    message_type TEXT DEFAULT 'text' CHECK (message_type IN ('text', 'image', 'emoji', 'system')),
    content TEXT NOT NULL,
    media_url TEXT,
    is_read BOOLEAN DEFAULT false,
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_dating_chat_messages_match ON dating_chat_messages(match_id);
CREATE INDEX idx_dating_chat_messages_sender ON dating_chat_messages(sender_id);
CREATE INDEX idx_dating_chat_messages_created ON dating_chat_messages(created_at DESC);

-- Dating Service Analytics (for admin dashboard)
CREATE TABLE IF NOT EXISTS dating_analytics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date DATE NOT NULL,
    metric_type TEXT NOT NULL, -- 'matches', 'subscriptions', 'revenue', 'meetups', 'appointments'
    metric_value NUMERIC(10, 2) NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(date, metric_type)
);

CREATE INDEX idx_dating_analytics_date ON dating_analytics(date);
CREATE INDEX idx_dating_analytics_type ON dating_analytics(metric_type);

COMMENT ON TABLE dating_profiles_pet IS 'Pet dating profiles for P2P matching';
COMMENT ON TABLE dating_profiles_owner IS 'Pet owner dating profiles';
COMMENT ON TABLE dating_matches IS 'Matches between profiles';
COMMENT ON TABLE dating_meetups IS 'Café meet-up bookings from matches';
COMMENT ON TABLE mating_appointments IS 'Vet clinic mating appointments';
COMMENT ON TABLE user_subscriptions IS 'User subscriptions for P2P service access';
COMMENT ON TABLE dating_chat_messages IS 'Chat messages between matched users';
COMMENT ON TABLE dating_analytics IS 'Analytics data for dating service';

