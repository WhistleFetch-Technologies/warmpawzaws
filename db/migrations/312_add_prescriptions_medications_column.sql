-- ============================================================================
-- MIGRATION 312: Add medications JSONB column to prescriptions if missing
-- ============================================================================
-- Date: 2026-01-23
-- Purpose: Fix "column medications does not exist" when creating prescriptions.
--          Some prescriptions tables were created without medications column.
--
-- Run: psql -h <RDS_HOST> -p 5432 -U <USER> -d <DB> -f db/migrations/312_add_prescriptions_medications_column.sql
-- Or:  ./scripts/run-migration-rds.sh (edit MIGRATION_FILE to point to this file)
-- ============================================================================

-- Temporarily disable triggers that might reference missing columns
DO $$
DECLARE
    trigger_rec RECORD;
BEGIN
    FOR trigger_rec IN 
        SELECT trigger_name 
        FROM information_schema.triggers 
        WHERE event_object_table = 'prescriptions'
          AND trigger_schema = 'public'
    LOOP
        EXECUTE format('ALTER TABLE prescriptions DISABLE TRIGGER %I', trigger_rec.trigger_name);
    END LOOP;
END $$;

-- Add medications column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'prescriptions'
          AND column_name = 'medications'
    ) THEN
        -- Add column as nullable first to avoid trigger issues
        ALTER TABLE prescriptions
        ADD COLUMN medications JSONB DEFAULT '[]'::jsonb;
        
        -- Then set NOT NULL constraint
        ALTER TABLE prescriptions
        ALTER COLUMN medications SET NOT NULL,
        ALTER COLUMN medications SET DEFAULT '[]'::jsonb;
        
        COMMENT ON COLUMN prescriptions.medications IS 'Array of medication objects: [{name, dosage, frequency, duration, instructions}]';
        RAISE NOTICE 'Added medications column to prescriptions';
        
        -- If medication_name column exists, migrate data
        IF EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = 'prescriptions'
              AND column_name = 'medication_name'
        ) THEN
            -- Migrate existing medication_name, dosage, frequency, duration to medications JSONB
            UPDATE prescriptions
            SET medications = jsonb_build_array(
                jsonb_build_object(
                    'name', COALESCE(medication_name, 'Prescription'),
                    'dosage', COALESCE(dosage, ''),
                    'frequency', COALESCE(frequency, ''),
                    'duration', COALESCE(duration, ''),
                    'instructions', COALESCE(instructions, '')
                )
            )
            WHERE medications IS NULL 
               OR medications = '[]'::jsonb
               OR (medications::text = 'null');
            
            RAISE NOTICE 'Migrated existing medication_name data to medications JSONB';
        END IF;
    ELSE
        RAISE NOTICE 'medications column already exists in prescriptions table';
    END IF;
END $$;

-- Create GIN index on medications for efficient JSONB queries if not exists
CREATE INDEX IF NOT EXISTS idx_prescriptions_medications_gin 
ON prescriptions USING GIN (medications);

-- Add comment explaining the structure
COMMENT ON COLUMN prescriptions.medications IS 
'JSONB array of medication objects. Each object has: {name, dosage, frequency, duration, instructions}';

-- Re-enable triggers
DO $$
DECLARE
    trigger_rec RECORD;
BEGIN
    FOR trigger_rec IN 
        SELECT trigger_name 
        FROM information_schema.triggers 
        WHERE event_object_table = 'prescriptions'
          AND trigger_schema = 'public'
    LOOP
        EXECUTE format('ALTER TABLE prescriptions ENABLE TRIGGER %I', trigger_rec.trigger_name);
    END LOOP;
END $$;
