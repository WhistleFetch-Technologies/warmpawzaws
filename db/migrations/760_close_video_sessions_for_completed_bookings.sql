-- Close orphaned video_call_sessions still marked active/waiting after booking finalized.
UPDATE video_call_sessions vcs
SET status = 'completed',
    ended_at = COALESCE(vcs.ended_at, NOW()),
    updated_at = NOW()
FROM bookings b
WHERE vcs.booking_id = b.id
  AND b.status IN ('completed', 'cancelled', 'no_show', 'expired')
  AND vcs.status IN ('active', 'waiting');
