// Database Migrations for Warmpawz Production System
// Run this file to create all necessary tables and indexes

import { createClient } from 'npm:@supabase/supabase-js@2';

export async function runMigrations() {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  console.log('🔄 Starting database migrations...');

  try {
    // ============================================
    // MIGRATION 1: Update bookings table
    // ============================================
    console.log('📋 Migration 1: Updating bookings table...');
    
    const { error: bookingsError } = await supabase.rpc('exec_sql', {
      sql: `
        -- Add new columns to bookings table if they don't exist
        DO $$ 
        BEGIN
          -- chat_enabled column
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                        WHERE table_name='bookings' AND column_name='chat_enabled') THEN
            ALTER TABLE bookings ADD COLUMN chat_enabled BOOLEAN DEFAULT TRUE;
          END IF;
          
          -- is_follow_up column
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                        WHERE table_name='bookings' AND column_name='is_follow_up') THEN
            ALTER TABLE bookings ADD COLUMN is_follow_up BOOLEAN DEFAULT FALSE;
          END IF;
          
          -- parent_booking_id column
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                        WHERE table_name='bookings' AND column_name='parent_booking_id') THEN
            ALTER TABLE bookings ADD COLUMN parent_booking_id UUID REFERENCES bookings(id);
          END IF;
          
          -- has_prescription column
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                        WHERE table_name='bookings' AND column_name='has_prescription') THEN
            ALTER TABLE bookings ADD COLUMN has_prescription BOOLEAN DEFAULT FALSE;
          END IF;
          
          -- pet_breed column
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                        WHERE table_name='bookings' AND column_name='pet_breed') THEN
            ALTER TABLE bookings ADD COLUMN pet_breed TEXT;
          END IF;
          
          -- pet_age column
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                        WHERE table_name='bookings' AND column_name='pet_age') THEN
            ALTER TABLE bookings ADD COLUMN pet_age TEXT;
          END IF;
        END $$;
        
        -- Create indexes
        CREATE INDEX IF NOT EXISTS idx_bookings_parent ON bookings(parent_booking_id);
        CREATE INDEX IF NOT EXISTS idx_bookings_follow_up ON bookings(is_follow_up);
        CREATE INDEX IF NOT EXISTS idx_bookings_has_prescription ON bookings(has_prescription);
      `
    });

    if (bookingsError) {
      console.error('❌ Error updating bookings table:', bookingsError);
    } else {
      console.log('✅ Bookings table updated successfully');
    }

    // ============================================
    // MIGRATION 2: Create prescriptions table
    // ============================================
    console.log('📋 Migration 2: Creating prescriptions table...');
    
    const { error: prescriptionsError } = await supabase.rpc('exec_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS prescriptions (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
          vendor_id TEXT NOT NULL,
          vendor_name TEXT NOT NULL,
          diagnosis TEXT,
          medications TEXT NOT NULL,
          dosage TEXT,
          frequency TEXT,
          duration TEXT,
          notes TEXT,
          follow_up_date DATE,
          uploaded_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        );
        
        CREATE INDEX IF NOT EXISTS idx_prescriptions_booking ON prescriptions(booking_id);
        CREATE INDEX IF NOT EXISTS idx_prescriptions_vendor ON prescriptions(vendor_id);
        CREATE INDEX IF NOT EXISTS idx_prescriptions_uploaded_at ON prescriptions(uploaded_at DESC);
      `
    });

    if (prescriptionsError) {
      console.error('❌ Error creating prescriptions table:', prescriptionsError);
    } else {
      console.log('✅ Prescriptions table created successfully');
    }

    // ============================================
    // MIGRATION 3: Create booking_activities table
    // ============================================
    console.log('📋 Migration 3: Creating booking_activities table...');
    
    const { error: activitiesError } = await supabase.rpc('exec_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS booking_activities (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
          type TEXT NOT NULL CHECK (type IN ('status_change', 'prescription', 'chat', 'note', 'follow_up', 'otp_verified', 'session_started', 'session_ended')),
          description TEXT NOT NULL,
          actor TEXT NOT NULL CHECK (actor IN ('vendor', 'customer', 'system')),
          actor_name TEXT NOT NULL,
          timestamp TIMESTAMPTZ DEFAULT NOW()
        );
        
        CREATE INDEX IF NOT EXISTS idx_activities_booking ON booking_activities(booking_id);
        CREATE INDEX IF NOT EXISTS idx_activities_timestamp ON booking_activities(timestamp DESC);
        CREATE INDEX IF NOT EXISTS idx_activities_type ON booking_activities(type);
      `
    });

    if (activitiesError) {
      console.error('❌ Error creating booking_activities table:', activitiesError);
    } else {
      console.log('✅ Booking activities table created successfully');
    }

    // ============================================
    // MIGRATION 4: Update chat_messages table
    // ============================================
    console.log('📋 Migration 4: Updating chat_messages table...');
    
    const { error: chatError } = await supabase.rpc('exec_sql', {
      sql: `
        DO $$ 
        BEGIN
          -- archived column (for soft delete - never actually delete messages)
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                        WHERE table_name='chat_messages' AND column_name='archived') THEN
            ALTER TABLE chat_messages ADD COLUMN archived BOOLEAN DEFAULT FALSE;
          END IF;
        END $$;
        
        CREATE INDEX IF NOT EXISTS idx_chat_messages_archived ON chat_messages(archived);
      `
    });

    if (chatError) {
      console.error('❌ Error updating chat_messages table:', chatError);
    } else {
      console.log('✅ Chat messages table updated successfully');
    }

    console.log('✅ All migrations completed successfully!');
    return { success: true };

  } catch (error) {
    console.error('❌ Migration failed:', error);
    return { success: false, error };
  }
}

// Helper function to log booking activity
export async function logBookingActivity(
  bookingId: string,
  type: string,
  description: string,
  actor: string,
  actorName: string
) {
  // Import KV store dynamically to avoid circular dependencies
  const kv = await import('./kv_store.tsx');
  
  try {
    // Store activity in KV store with composite key
    const activityId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const activityKey = `booking_activity:${bookingId}:${activityId}`;
    
    const activity = {
      id: activityId,
      booking_id: bookingId,
      type,
      description,
      actor,
      actor_name: actorName,
      timestamp: new Date().toISOString()
    };

    await kv.set(activityKey, activity);
    console.log('✅ [ACTIVITY] Logged activity:', activityKey);
  } catch (error) {
    console.error('❌ Error logging activity:', error);
  }
}