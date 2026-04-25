-- Remaining F100 auto-assign slots: first N new eligible vendors get Tier F100, then default Basic.
CREATE TABLE IF NOT EXISTS platform_tier_onboarding (
  id text PRIMARY KEY DEFAULT 'default' CHECK (id = 'default'),
  f100_auto_assign_slots_remaining integer NOT NULL DEFAULT 60
);

INSERT INTO platform_tier_onboarding (id, f100_auto_assign_slots_remaining)
VALUES ('default', 60)
ON CONFLICT (id) DO NOTHING;

COMMENT ON TABLE platform_tier_onboarding IS
  'Singleton row: decrements when a new eligible vendor is assigned Tier F100 at onboarding.';
