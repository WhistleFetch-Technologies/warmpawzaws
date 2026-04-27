DO $$ BEGIN
  CREATE TYPE analytics_error_case_status_enum AS ENUM ('open', 'in_progress', 'resolved', 'ignored');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
