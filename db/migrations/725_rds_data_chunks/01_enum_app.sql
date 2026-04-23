DO $$ BEGIN
  CREATE TYPE analytics_app_enum AS ENUM ('customer_web', 'vendor_web');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
