import { query } from "src/database/rds-connection";

/** Module-level cache: once verified in this Lambda invocation, skip re-checking */
let _verified = false;

export async function ensureVideoCallSessionsTable(_tableVerified?: boolean): Promise<void> {
    // If already verified (either via module cache or caller's flag), skip
    if (_verified || _tableVerified) return;
    try {
        // Check if table exists with correct columns
        const checkResult = await query(`
        SELECT column_name FROM information_schema.columns 
        WHERE table_name = 'video_call_sessions' AND column_name = 'meeting_id'
      `);

        if (checkResult.rows.length === 0) {
            console.log('[VIDEO CALL] Table video_call_sessions missing meeting_id column, recreating...');

            // Drop and recreate table with correct schema
            await query(`
          DROP TABLE IF EXISTS video_call_sessions CASCADE;
          
          CREATE TABLE video_call_sessions (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            booking_id UUID NOT NULL,
            meeting_id TEXT NOT NULL,
            customer_id UUID,
            vendor_id UUID,
            staff_id UUID,
            customer_attendee_id TEXT,
            vendor_attendee_id TEXT,
            customer_join_token TEXT,
            vendor_join_token TEXT,
            status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'waiting', 'completed', 'cancelled', 'ended')),
            started_at TIMESTAMPTZ DEFAULT NOW(),
            ended_at TIMESTAMPTZ,
            duration_seconds INTEGER,
            recording_url TEXT,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW()
          );
          
          CREATE INDEX IF NOT EXISTS idx_video_sessions_booking_id ON video_call_sessions(booking_id);
          CREATE INDEX IF NOT EXISTS idx_video_sessions_meeting_id ON video_call_sessions(meeting_id);
          CREATE INDEX IF NOT EXISTS idx_video_sessions_status ON video_call_sessions(status);
        `);

            console.log('[VIDEO CALL] Table video_call_sessions recreated successfully');
        }
        _verified = true; // ✅ Now actually persists across calls within the same Lambda invocation
    } catch (error: any) {
        console.error('[VIDEO CALL] Error ensuring table schema:', error.message);
        // If table doesn't exist at all, create it
        if (error.message?.includes('does not exist')) {
            await query(`
          CREATE TABLE IF NOT EXISTS video_call_sessions (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            booking_id UUID NOT NULL,
            meeting_id TEXT NOT NULL,
            customer_id UUID,
            vendor_id UUID,
            staff_id UUID,
            customer_attendee_id TEXT,
            vendor_attendee_id TEXT,
            customer_join_token TEXT,
            vendor_join_token TEXT,
            status TEXT NOT NULL DEFAULT 'active',
            started_at TIMESTAMPTZ DEFAULT NOW(),
            ended_at TIMESTAMPTZ,
            duration_seconds INTEGER,
            recording_url TEXT,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW()
          );
        `);
            _verified = true;
        }
    }
}
