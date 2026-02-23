-- ============================================================================
-- MIGRATION 543: FIX FOREIGN KEY CONSTRAINTS ON VIDEO_CALL_SESSIONS
-- ============================================================================
-- Date: 2026-02-21
-- Purpose: Remove strict foreign key constraints on vendor_id and customer_id
--          to allow vendors that exist only in vendor_identity (solo providers)
--          and to make the table more flexible
-- ============================================================================

DO $$
DECLARE
    constraint_name TEXT;
BEGIN
    -- Drop foreign key constraint on vendor_id if it exists
    SELECT conname INTO constraint_name
    FROM pg_constraint
    WHERE conrelid = 'video_call_sessions'::regclass
      AND contype = 'f'
      AND conname LIKE '%vendor_id%';
    
    IF constraint_name IS NOT NULL THEN
        EXECUTE format('ALTER TABLE video_call_sessions DROP CONSTRAINT IF EXISTS %I', constraint_name);
        RAISE NOTICE 'Dropped foreign key constraint: %', constraint_name;
    ELSE
        RAISE NOTICE 'No vendor_id foreign key constraint found';
    END IF;

    -- Drop foreign key constraint on customer_id if it exists
    SELECT conname INTO constraint_name
    FROM pg_constraint
    WHERE conrelid = 'video_call_sessions'::regclass
      AND contype = 'f'
      AND conname LIKE '%customer_id%';
    
    IF constraint_name IS NOT NULL THEN
        EXECUTE format('ALTER TABLE video_call_sessions DROP CONSTRAINT IF EXISTS %I', constraint_name);
        RAISE NOTICE 'Dropped foreign key constraint: %', constraint_name;
    ELSE
        RAISE NOTICE 'No customer_id foreign key constraint found';
    END IF;

    -- Make vendor_id nullable if it's currently NOT NULL
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'video_call_sessions'
          AND column_name = 'vendor_id'
          AND is_nullable = 'NO'
    ) THEN
        ALTER TABLE video_call_sessions ALTER COLUMN vendor_id DROP NOT NULL;
        RAISE NOTICE 'Made vendor_id nullable';
    ELSE
        RAISE NOTICE 'vendor_id is already nullable or does not exist';
    END IF;

    -- Make customer_id nullable if it's currently NOT NULL
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'video_call_sessions'
          AND column_name = 'customer_id'
          AND is_nullable = 'NO'
    ) THEN
        ALTER TABLE video_call_sessions ALTER COLUMN customer_id DROP NOT NULL;
        RAISE NOTICE 'Made customer_id nullable';
    ELSE
        RAISE NOTICE 'customer_id is already nullable or does not exist';
    END IF;

END $$;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
