-- ============================================================================
-- MIGRATION 070: Package Tracking & Session Management Enhancements
-- ============================================================================
-- Purpose: Enable package-aware booking, GPS tracking for walks, 
--          training skill progress, and same-provider assignments
-- Date: 2026-01-15
-- ============================================================================

-- 1. Add preferred vendor to package purchases (for "same provider" packages)
ALTER TABLE package_purchases ADD COLUMN IF NOT EXISTS 
    preferred_vendor_id UUID REFERENCES vendors(id);

ALTER TABLE package_purchases ADD COLUMN IF NOT EXISTS 
    preferred_staff_id UUID; -- For specific trainer/walker

ALTER TABLE package_purchases ADD COLUMN IF NOT EXISTS 
    auto_assign_same_provider BOOLEAN DEFAULT true;

-- 2. Add package awareness to bookings
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS 
    package_purchase_id UUID REFERENCES package_purchases(id);

ALTER TABLE bookings ADD COLUMN IF NOT EXISTS 
    is_package_session BOOLEAN DEFAULT false;

ALTER TABLE bookings ADD COLUMN IF NOT EXISTS 
    package_session_number INTEGER;

ALTER TABLE bookings ADD COLUMN IF NOT EXISTS 
    is_trial BOOLEAN DEFAULT false;

ALTER TABLE bookings ADD COLUMN IF NOT EXISTS 
    converted_to_package_id UUID;

-- 3. Package scheduled sessions (pre-schedule all sessions in a package)
CREATE TABLE IF NOT EXISTS package_scheduled_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    package_purchase_id UUID NOT NULL REFERENCES package_purchases(id) ON DELETE CASCADE,
    session_number INTEGER NOT NULL,
    scheduled_date DATE,
    scheduled_time TIME,
    booking_id UUID REFERENCES bookings(id),
    status TEXT DEFAULT 'pending' 
        CHECK (status IN ('pending', 'scheduled', 'completed', 'cancelled', 'rescheduled', 'no_show')),
    reminder_sent BOOLEAN DEFAULT false,
    reminder_sent_at TIMESTAMPTZ,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(package_purchase_id, session_number)
);

CREATE INDEX IF NOT EXISTS idx_package_scheduled_sessions_purchase ON package_scheduled_sessions(package_purchase_id);
CREATE INDEX IF NOT EXISTS idx_package_scheduled_sessions_date ON package_scheduled_sessions(scheduled_date);
CREATE INDEX IF NOT EXISTS idx_package_scheduled_sessions_status ON package_scheduled_sessions(status);

-- 4. Walk routes for GPS tracking
CREATE TABLE IF NOT EXISTS walk_routes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
    walker_id UUID NOT NULL REFERENCES vendors(id),
    customer_id UUID NOT NULL REFERENCES customers(id),
    pet_id UUID REFERENCES pets(id),
    route_polyline TEXT, -- Encoded polyline string
    total_distance_meters INTEGER DEFAULT 0,
    total_duration_seconds INTEGER DEFAULT 0,
    average_speed_kmh DECIMAL(5, 2),
    start_location JSONB, -- {lat, lng, address}
    end_location JSONB,
    waypoints JSONB DEFAULT '[]'::jsonb, -- Array of {lat, lng, timestamp}
    photos JSONB DEFAULT '[]'::jsonb, -- Array of photo URLs with timestamps
    notes TEXT,
    potty_breaks INTEGER DEFAULT 0,
    weather_conditions TEXT,
    started_at TIMESTAMPTZ,
    ended_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_walk_routes_booking ON walk_routes(booking_id);
CREATE INDEX IF NOT EXISTS idx_walk_routes_walker ON walk_routes(walker_id);
CREATE INDEX IF NOT EXISTS idx_walk_routes_customer ON walk_routes(customer_id);

-- 5. Walker live location (for active sessions - real-time tracking)
CREATE TABLE IF NOT EXISTS walker_live_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
    walker_id UUID NOT NULL REFERENCES vendors(id),
    customer_id UUID NOT NULL REFERENCES customers(id),
    current_lat DECIMAL(10, 8),
    current_lng DECIMAL(11, 8),
    heading DECIMAL(5, 2), -- Direction in degrees (0-360)
    speed_kmh DECIMAL(5, 2),
    accuracy_meters DECIMAL(6, 2),
    battery_level INTEGER, -- Walker's phone battery %
    last_updated TIMESTAMPTZ DEFAULT NOW(),
    is_active BOOLEAN DEFAULT true,
    started_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(booking_id)
);

CREATE INDEX IF NOT EXISTS idx_walker_live_sessions_active ON walker_live_sessions(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_walker_live_sessions_customer ON walker_live_sessions(customer_id);

-- 6. Training skills master list
CREATE TABLE IF NOT EXISTS training_skills (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    skill_name TEXT NOT NULL,
    skill_code TEXT NOT NULL UNIQUE, -- e.g., 'sit', 'stay', 'heel'
    skill_category TEXT NOT NULL CHECK (skill_category IN ('basic', 'intermediate', 'advanced', 'behavior', 'specialty')),
    description TEXT,
    prerequisites JSONB DEFAULT '[]'::jsonb, -- Array of skill_codes required first
    proficiency_levels JSONB DEFAULT '["learning", "developing", "proficient", "mastered"]'::jsonb,
    estimated_sessions INTEGER DEFAULT 2, -- Avg sessions to learn
    display_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_training_skills_category ON training_skills(skill_category);
CREATE INDEX IF NOT EXISTS idx_training_skills_code ON training_skills(skill_code);

-- 7. Pet skill progress tracking
CREATE TABLE IF NOT EXISTS pet_skill_progress (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pet_id UUID NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
    skill_id UUID NOT NULL REFERENCES training_skills(id) ON DELETE CASCADE,
    current_level TEXT DEFAULT 'not_started' 
        CHECK (current_level IN ('not_started', 'learning', 'developing', 'proficient', 'mastered')),
    proficiency_score INTEGER DEFAULT 0 CHECK (proficiency_score >= 0 AND proficiency_score <= 100),
    sessions_practiced INTEGER DEFAULT 0,
    last_practiced_at TIMESTAMPTZ,
    notes TEXT,
    training_package_id UUID REFERENCES package_purchases(id),
    trainer_id UUID REFERENCES vendors(id),
    started_at TIMESTAMPTZ DEFAULT NOW(),
    mastered_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(pet_id, skill_id)
);

CREATE INDEX IF NOT EXISTS idx_pet_skill_progress_pet ON pet_skill_progress(pet_id);
CREATE INDEX IF NOT EXISTS idx_pet_skill_progress_skill ON pet_skill_progress(skill_id);
CREATE INDEX IF NOT EXISTS idx_pet_skill_progress_package ON pet_skill_progress(training_package_id);

-- 8. Training session skill records (per-session skill updates)
CREATE TABLE IF NOT EXISTS training_session_skills (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
    session_id UUID REFERENCES package_sessions(id),
    pet_id UUID NOT NULL REFERENCES pets(id),
    skill_id UUID NOT NULL REFERENCES training_skills(id),
    practiced BOOLEAN DEFAULT true,
    before_level TEXT,
    after_level TEXT,
    improvement_notes TEXT,
    trainer_notes TEXT,
    homework TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_training_session_skills_booking ON training_session_skills(booking_id);
CREATE INDEX IF NOT EXISTS idx_training_session_skills_pet ON training_session_skills(pet_id);

-- 9. Customer previous providers tracking (for quick rebooking)
CREATE TABLE IF NOT EXISTS customer_provider_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
    staff_id UUID, -- Specific staff member if applicable
    service_type TEXT NOT NULL, -- 'vet', 'grooming', 'walking', 'training'
    total_bookings INTEGER DEFAULT 1,
    last_booking_id UUID REFERENCES bookings(id),
    last_booking_date TIMESTAMPTZ,
    average_rating DECIMAL(3, 2),
    is_favorite BOOLEAN DEFAULT false,
    notes TEXT, -- Customer's private notes about this provider
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(customer_id, vendor_id, service_type)
);

CREATE INDEX IF NOT EXISTS idx_customer_provider_history_customer ON customer_provider_history(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_provider_history_vendor ON customer_provider_history(vendor_id);
CREATE INDEX IF NOT EXISTS idx_customer_provider_history_service ON customer_provider_history(service_type);

-- 10. Package usage log (audit trail)
CREATE TABLE IF NOT EXISTS package_usage_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    package_purchase_id UUID NOT NULL REFERENCES package_purchases(id) ON DELETE CASCADE,
    booking_id UUID REFERENCES bookings(id),
    session_number INTEGER,
    action TEXT NOT NULL CHECK (action IN ('session_used', 'session_refunded', 'session_expired', 'session_gifted')),
    sessions_before INTEGER,
    sessions_after INTEGER,
    notes TEXT,
    created_by UUID,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_package_usage_log_purchase ON package_usage_log(package_purchase_id);
CREATE INDEX IF NOT EXISTS idx_package_usage_log_booking ON package_usage_log(booking_id);

-- ============================================================================
-- SEED DATA: Training Skills Master List
-- ============================================================================

INSERT INTO training_skills (skill_name, skill_code, skill_category, description, display_order) VALUES
-- Basic Commands
('Sit', 'sit', 'basic', 'Dog sits on command and holds position', 1),
('Stay', 'stay', 'basic', 'Dog remains in position until released', 2),
('Come', 'come', 'basic', 'Dog comes to handler when called (recall)', 3),
('Down', 'down', 'basic', 'Dog lies down on command', 4),
('Stand', 'stand', 'basic', 'Dog stands on all fours on command', 5),

-- Intermediate Commands
('Heel', 'heel', 'intermediate', 'Dog walks beside handler without pulling', 10),
('Leave It', 'leave_it', 'intermediate', 'Dog ignores items or distractions on command', 11),
('Drop It', 'drop_it', 'intermediate', 'Dog releases item from mouth', 12),
('Wait', 'wait', 'intermediate', 'Dog pauses before proceeding (doorways, food)', 13),
('Place', 'place', 'intermediate', 'Dog goes to designated spot and stays', 14),
('Off', 'off', 'intermediate', 'Dog gets off furniture or stops jumping', 15),

-- Advanced Commands
('Loose Leash Walking', 'loose_leash', 'advanced', 'Dog walks without tension on leash', 20),
('Distance Commands', 'distance_commands', 'advanced', 'Dog obeys commands from distance', 21),
('Off-Leash Recall', 'off_leash_recall', 'advanced', 'Dog returns reliably without leash', 22),
('Focus/Watch Me', 'focus', 'advanced', 'Dog maintains eye contact on command', 23),
('Impulse Control', 'impulse_control', 'advanced', 'Dog waits patiently for rewards', 24),

-- Behavior Modification
('Reduce Reactivity', 'reduce_reactivity', 'behavior', 'Decrease reaction to triggers (dogs, people)', 30),
('Reduce Anxiety', 'reduce_anxiety', 'behavior', 'Manage separation or general anxiety', 31),
('Stop Jumping', 'stop_jumping', 'behavior', 'Eliminate jumping on people', 32),
('Stop Barking', 'stop_barking', 'behavior', 'Control excessive barking', 33),
('Resource Guarding', 'resource_guarding', 'behavior', 'Address food/toy guarding behavior', 34),
('Leash Reactivity', 'leash_reactivity', 'behavior', 'Reduce pulling/lunging on leash', 35),

-- Specialty/Fun
('Shake/Paw', 'shake', 'specialty', 'Dog offers paw on command', 40),
('Roll Over', 'roll_over', 'specialty', 'Dog rolls over on command', 41),
('Spin', 'spin', 'specialty', 'Dog spins in circle', 42),
('Play Dead', 'play_dead', 'specialty', 'Dog lies on side and stays still', 43),
('Fetch', 'fetch', 'specialty', 'Dog retrieves and returns items', 44),
('Speak/Quiet', 'speak_quiet', 'specialty', 'Dog barks or stops barking on command', 45)
ON CONFLICT (skill_code) DO NOTHING;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE package_scheduled_sessions IS 'Pre-scheduled sessions for package purchases';
COMMENT ON TABLE walk_routes IS 'GPS route data and statistics for completed walks';
COMMENT ON TABLE walker_live_sessions IS 'Real-time walker location during active walks';
COMMENT ON TABLE training_skills IS 'Master list of trainable skills/commands';
COMMENT ON TABLE pet_skill_progress IS 'Per-pet progress on each training skill';
COMMENT ON TABLE training_session_skills IS 'Skills practiced in each training session';
COMMENT ON TABLE customer_provider_history IS 'Customer interaction history with vendors for rebooking';
COMMENT ON TABLE package_usage_log IS 'Audit trail for package session usage';

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
