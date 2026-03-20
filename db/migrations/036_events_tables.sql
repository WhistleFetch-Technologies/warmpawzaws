-- ============================================================================
-- EVENTS TABLES
-- ============================================================================
-- Tables for event management (adoption drives, fundraisers, pet parties, etc.)
-- ============================================================================

-- Events
CREATE TABLE IF NOT EXISTS events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    category TEXT NOT NULL CHECK (category IN ('adoption_drive', 'fundraiser', 'awareness_campaign', 'volunteer_drive', 'pet_party', 'meetup', 'training_workshop', 'contest', 'other')),
    event_date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME,
    venue JSONB DEFAULT '{}'::jsonb, -- { type, address, coordinates, capacity, meetingLink }
    registration_required BOOLEAN DEFAULT false,
    registration_deadline DATE,
    max_attendees INTEGER,
    current_attendees INTEGER DEFAULT 0,
    fees NUMERIC(10, 2),
    status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'ongoing', 'completed', 'cancelled')),
    image_url TEXT,
    tags TEXT[] DEFAULT '{}',
    adoption_goal INTEGER,
    fundraising_goal NUMERIC(10, 2),
    amount_raised NUMERIC(10, 2) DEFAULT 0,
    animals_available INTEGER,
    animals_adopted INTEGER DEFAULT 0,
    pet_friendly BOOLEAN DEFAULT true,
    allowed_pets TEXT[],
    menu JSONB DEFAULT '[]'::jsonb,
    activities TEXT[],
    organizers TEXT[],
    sponsors TEXT[],
    special_guests TEXT[],
    requirements TEXT[],
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_events_vendor_id ON events(vendor_id);
CREATE INDEX IF NOT EXISTS idx_events_event_date ON events(event_date);
CREATE INDEX IF NOT EXISTS idx_events_status ON events(status);
CREATE INDEX IF NOT EXISTS idx_events_category ON events(category);

-- Event Registrations
CREATE TABLE IF NOT EXISTS event_registrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
    vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
    attendee_name TEXT NOT NULL,
    attendee_email TEXT,
    attendee_phone TEXT NOT NULL,
    number_of_people INTEGER DEFAULT 1,
    pets JSONB DEFAULT '[]'::jsonb,
    special_requirements TEXT,
    payment_status TEXT DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'waived')),
    payment_amount NUMERIC(10, 2),
    transaction_id TEXT,
    check_in_status TEXT DEFAULT 'pending' CHECK (check_in_status IN ('pending', 'checked_in', 'no_show')),
    check_in_time TIMESTAMPTZ,
    status TEXT DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'waitlist', 'cancelled')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_event_registrations_event_id ON event_registrations(event_id);
CREATE INDEX IF NOT EXISTS idx_event_registrations_customer_id ON event_registrations(customer_id);
CREATE INDEX IF NOT EXISTS idx_event_registrations_vendor_id ON event_registrations(vendor_id);

-- Updated timestamp trigger
CREATE OR REPLACE FUNCTION update_events_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_events_updated_at
    BEFORE UPDATE ON events
    FOR EACH ROW
    EXECUTE FUNCTION update_events_updated_at();

CREATE TRIGGER trigger_update_event_registrations_updated_at
    BEFORE UPDATE ON event_registrations
    FOR EACH ROW
    EXECUTE FUNCTION update_events_updated_at();

