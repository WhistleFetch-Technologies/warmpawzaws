-- Close tele video sessions for appointments that ended more than 24h ago but were never finalized.
UPDATE video_call_sessions vcs
SET status = 'completed',
    ended_at = COALESCE(vcs.ended_at, NOW()),
    updated_at = NOW()
FROM bookings b
WHERE vcs.booking_id = b.id
  AND vcs.status IN ('active', 'waiting')
  AND (b.service_style = 'tele' OR b.service_type = 'tele' OR b.service_type = 'video_consultation')
  AND (b.booking_date + b.booking_time::time) < NOW() - INTERVAL '24 hours'
  AND b.status IN ('confirmed', 'in_progress', 'scheduled', 'active');

-- Mark abandoned stale tele bookings as cancelled so join trackers stop surfacing them.
UPDATE bookings b
SET status = 'cancelled',
    updated_at = NOW(),
    notes = COALESCE(b.notes, '') || E'\n[Auto-closed stale tele booking ' || TO_CHAR(NOW(), 'YYYY-MM-DD HH24:MI') || ' UTC]'
WHERE (b.service_style = 'tele' OR b.service_type = 'tele' OR b.service_type = 'video_consultation')
  AND b.status IN ('confirmed', 'in_progress', 'scheduled', 'active')
  AND (b.booking_date + b.booking_time::time) < NOW() - INTERVAL '24 hours';
