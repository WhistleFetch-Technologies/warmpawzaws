DO $$ BEGIN
  CREATE TYPE analytics_event_type_enum AS ENUM (
    'screen_view',
    'screen_end',
    'tap',
    'scroll',
    'filter',
    'tab_change',
    'search',
    'error',
    'api_timing',
    'notification_open',
    'notification_dismiss',
    'drop_off',
    'rage_click',
    'custom'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
