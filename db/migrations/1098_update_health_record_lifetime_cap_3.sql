-- ============================================================================
-- 1098: Lifetime max 3 loyalty awards for pet vaccination profile saves
-- ============================================================================
-- update_health_record is fired when customers save vaccination details on pet
-- profile APIs. Cap at 3 lifetime earns per customer; pets remain unlimited.
-- Award service: recurring + frequency_limit + NULL frequency_period = lifetime.
-- ============================================================================

UPDATE loyalty_action_rules
SET frequency_type = 'recurring',
    frequency_limit = 3,
    frequency_period = NULL,
    notes = COALESCE(notes, '') || ' [1098] Lifetime max 3 awards for pet vaccination profile saves.',
    updated_at = NOW()
WHERE action_name = 'update_health_record';
