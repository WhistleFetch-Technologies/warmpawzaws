DO $$ BEGIN
  CREATE TYPE analytics_actor_type_enum AS ENUM ('customer', 'vendor');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
