CREATE TABLE IF NOT EXISTS delivery_location_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tracking_id UUID NOT NULL REFERENCES delivery_tracking(id) ON DELETE CASCADE,
    lat NUMERIC(10,7) NOT NULL,
    lng NUMERIC(10,7) NOT NULL,
    accuracy_meters NUMERIC(6,2),
    speed_kmh NUMERIC(5,2),
    heading INTEGER,
    recorded_at TIMESTAMPTZ DEFAULT NOW()
);
