-- ============================================================================
-- MIGRATION 035: Events and Event Registrations Tables
-- ============================================================================
-- Date: 2025-01-28
-- Purpose: Create events and event_registrations tables for event management
-- Replaces: event:{vendorId}:{eventId} and event-registration:{eventId}:{registrationId} KV keys
-- ============================================================================

-- Events table
CREATE TABLE IF NOT EXISTS events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
    vendor_type TEXT NOT NULL CHECK (vendor_type IN ('shelter', 'cafe', 'other')),
    name TEXT NOT NULL,
    description TEXT,
    category TEXT NOT NULL CHECK (category IN (
        'adoption_drive', 'fundraiser', 'awareness_campaign', 'volunteer_drive',
        'pet_party', 'meetup', 'training_workshop', 'contest', 'other'
    )),
    event_date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    duration INTEGER, -- in minutes
    venue JSONB NOT NULL DEFAULT '{}'::jsonb, -- { type, address, coordinates, capacity, meetingLink }
    registration_required BOOLEAN DEFAULT false,
    registration_deadline DATE,
    max_attendees INTEGER,
    current_attendees INTEGER DEFAULT 0,
    fees NUMERIC(10, 2),
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'ongoing', 'completed', 'cancelled')),
    image_url TEXT,
    tags TEXT[] DEFAULT '{}',
    
    -- Shelter-specific fields
    adoption_goal INTEGER,
    fundraising_goal NUMERIC(10, 2),
    amount_raised NUMERIC(10, 2) DEFAULT 0,
    animals_available INTEGER,
    animals_adopted INTEGER DEFAULT 0,
    
    -- Cafe-specific fields
    pet_friendly BOOLEAN DEFAULT false,
    allowed_pets TEXT[] DEFAULT '{}',
    menu JSONB DEFAULT '[]'::jsonb,
    activities TEXT[] DEFAULT '{}',
    
    -- Common fields
    organizers TEXT[] DEFAULT '{}',
    sponsors TEXT[] DEFAULT '{}',
    special_guests TEXT[] DEFAULT '{}',
    requirements TEXT[] DEFAULT '{}',
    notes TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_events_vendor_id ON events(vendor_id);
CREATE INDEX idx_events_status ON events(status);
CREATE INDEX idx_events_category ON events(category);
CREATE INDEX idx_events_event_date ON events(event_date);
CREATE INDEX idx_events_vendor_status ON events(vendor_id, status);

COMMENT ON TABLE events IS 'Events for shelters and cafes - replaces event:{vendorId}:{eventId} KV keys';

-- Event Registrations table
CREATE TABLE IF NOT EXISTS event_registrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
    attendee_name TEXT NOT NULL,
    attendee_email TEXT NOT NULL,
    attendee_phone TEXT NOT NULL,
    number_of_people INTEGER DEFAULT 1,
    pets JSONB DEFAULT '[]'::jsonb, -- Array of { name, type, breed }
    special_requirements TEXT,
    payment_status TEXT NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'waived')),
    payment_amount NUMERIC(10, 2),
    transaction_id TEXT,
    check_in_status TEXT NOT NULL DEFAULT 'pending' CHECK (check_in_status IN ('pending', 'checked_in', 'no_show')),
    check_in_time TIMESTAMPTZ,
    status TEXT NOT NULL DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'waitlist', 'cancelled')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_event_registrations_event_id ON event_registrations(event_id);
CREATE INDEX idx_event_registrations_vendor_id ON event_registrations(vendor_id);
CREATE INDEX idx_event_registrations_status ON event_registrations(status);
CREATE INDEX idx_event_registrations_check_in_status ON event_registrations(check_in_status);
CREATE INDEX idx_event_registrations_payment_status ON event_registrations(payment_status);

COMMENT ON TABLE event_registrations IS 'Event registrations - replaces event-registration:{eventId}:{registrationId} KV keys';

