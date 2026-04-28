DO $$ BEGIN
  CREATE TYPE analytics_error_case_priority_enum AS ENUM ('p1', 'p2', 'p3', 'p4');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
