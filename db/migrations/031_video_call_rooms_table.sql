-- ============================================================================
-- MIGRATION 031: Video Call Rooms Table
-- ============================================================================
-- Date: 2025-01-27
-- Purpose: Create video_call_rooms table for WebRTC video call management
-- ============================================================================

CREATE TABLE IF NOT EXISTS video_call_rooms (
    id TEXT PRIMARY KEY,
    booking_id UUID REFERENCES bookings(id) ON DELETE CASCADE,
    room_id TEXT NOT NULL UNIQUE,
    participants JSONB DEFAULT '[]'::jsonb,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'ended', 'cancelled')),
    offer JSONB,
    answer JSONB,
    ice_candidates JSONB DEFAULT '[]'::jsonb,
    ended_at TIMESTAMPTZ,
    ended_by TEXT,
    duration INTEGER, -- in seconds
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_video_call_rooms_booking ON video_call_rooms(booking_id);
CREATE INDEX idx_video_call_rooms_room_id ON video_call_rooms(room_id);
CREATE INDEX idx_video_call_rooms_status ON video_call_rooms(status);

COMMENT ON TABLE video_call_rooms IS 'WebRTC video call rooms - replaces video:room:{id} KV keys';
COMMENT ON COLUMN video_call_rooms.participants IS 'Array of participant objects';
COMMENT ON COLUMN video_call_rooms.offer IS 'WebRTC offer SDP';
COMMENT ON COLUMN video_call_rooms.answer IS 'WebRTC answer SDP';
COMMENT ON COLUMN video_call_rooms.ice_candidates IS 'Array of ICE candidates';

-- Call history table
CREATE TABLE IF NOT EXISTS video_call_history (
    id TEXT PRIMARY KEY,
    room_id TEXT NOT NULL REFERENCES video_call_rooms(room_id) ON DELETE CASCADE,
    booking_id UUID REFERENCES bookings(id) ON DELETE CASCADE,
    started_at TIMESTAMPTZ NOT NULL,
    ended_at TIMESTAMPTZ,
    duration INTEGER, -- in seconds
    participants JSONB DEFAULT '[]'::jsonb,
    call_type TEXT NOT NULL DEFAULT 'video',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_video_call_history_booking ON video_call_history(booking_id);
CREATE INDEX idx_video_call_history_room ON video_call_history(room_id);

COMMENT ON TABLE video_call_history IS 'Video call history records - replaces call:{id} KV keys';

