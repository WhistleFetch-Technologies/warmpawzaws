DO $$ BEGIN
  CREATE TYPE analytics_environment_enum AS ENUM ('dev', 'staging', 'prod');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
