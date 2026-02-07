-- ============================================================================
-- INSTANT TELE QUEUE TABLES
-- ============================================================================
-- 
-- Tables for instant tele consultation queue system:
-- - staff_tele_availability: Provider availability status
-- - tele_queue: Customer queue entries
-- 
-- Date: 2026-01-17
-- ============================================================================

-- Staff Tele Availability Table
-- Tracks which staff members are currently available for instant tele consultations
CREATE TABLE IF NOT EXISTS staff_tele_availability (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  is_available BOOLEAN DEFAULT false,
  available_services JSONB, -- Array of service IDs the staff is available for
  last_status_change TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(staff_id)
);

CREATE INDEX idx_staff_tele_availability_staff_id ON staff_tele_availability(staff_id);
CREATE INDEX idx_staff_tele_availability_is_available ON staff_tele_availability(is_available) WHERE is_available = true;

-- Tele Queue Table
-- Stores customer queue entries for instant tele consultations
CREATE TABLE IF NOT EXISTS tele_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  staff_id UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  pet_id UUID NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
  service_id UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  
  -- Queue management
  position INTEGER NOT NULL, -- Position in queue (1, 2, 3, ...)
  status VARCHAR(50) DEFAULT 'waiting', -- waiting, accepted, expired, cancelled, skipped, provider_offline
  
  -- Booking info (set when accepted)
  booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL,
  meeting_id VARCHAR(255), -- Video call meeting ID (set when call starts)
  
  -- Customer details
  symptoms TEXT,
  urgency VARCHAR(20) DEFAULT 'normal', -- normal, urgent
  notes TEXT,
  
  -- Service details (snapshot at queue time)
  service_name VARCHAR(255),
  price DECIMAL(10,2),
  duration_minutes INTEGER,
  
  -- Timing
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  resolved_at TIMESTAMP WITH TIME ZONE, -- When queue entry was resolved (accepted/expired/etc)
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  skip_reason TEXT -- Reason for skipping (if skipped)
);

CREATE INDEX idx_tele_queue_staff_id_status ON tele_queue(staff_id, status);
CREATE INDEX idx_tele_queue_customer_id ON tele_queue(customer_id);
CREATE INDEX idx_tele_queue_status ON tele_queue(status);
CREATE INDEX idx_tele_queue_expires_at ON tele_queue(expires_at);
CREATE INDEX idx_tele_queue_position ON tele_queue(staff_id, position) WHERE status = 'waiting';

-- Ensure one active queue entry per customer-staff combination (partial unique index)
CREATE UNIQUE INDEX unique_active_queue_entry ON tele_queue(customer_id, staff_id) 
  WHERE status = 'waiting';

-- Function to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updated_at
CREATE TRIGGER update_staff_tele_availability_updated_at 
  BEFORE UPDATE ON staff_tele_availability
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tele_queue_updated_at 
  BEFORE UPDATE ON tele_queue
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- HELPER VIEWS
-- ============================================================================

-- View: Active queue count per staff
CREATE OR REPLACE VIEW staff_queue_stats AS
SELECT 
  s.id as staff_id,
  s.name as staff_name,
  sta.is_available,
  COUNT(tq.id) FILTER (WHERE tq.status = 'waiting') as waiting_count,
  COUNT(tq.id) FILTER (WHERE tq.status = 'waiting' AND tq.expires_at > NOW()) as active_waiting_count,
  MIN(tq.created_at) FILTER (WHERE tq.status = 'waiting') as oldest_waiting_since
FROM staff s
LEFT JOIN staff_tele_availability sta ON sta.staff_id = s.id
LEFT JOIN tele_queue tq ON tq.staff_id = s.id AND tq.status = 'waiting'
WHERE s.is_active = true AND s.mobile_verified = true
GROUP BY s.id, s.name, sta.is_available;
