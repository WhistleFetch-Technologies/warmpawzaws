-- ============================================================================
-- CUSTOMER_SUBSCRIPTIONS TABLE - SCHEMA
-- ============================================================================
-- Extracted from production RDS database
-- ============================================================================

-- ============================================================================
-- TABLE DEFINITION
-- ============================================================================

CREATE TABLE IF NOT EXISTS customer_subscriptions (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    subscription_id TEXT NOT NULL,
    customer_id UUID NOT NULL,
    plan_id TEXT NOT NULL,
    vendor_id UUID NOT NULL,
    plan_name TEXT NOT NULL,
    price NUMERIC(10, 2) NOT NULL,
    interval TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active'::text,
    start_date TIMESTAMPTZ NOT NULL DEFAULT now(),
    next_billing_date TIMESTAMPTZ,
    payment_method_id TEXT,
    cancelled_at TIMESTAMPTZ,
    cancellation_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    PRIMARY KEY (id)
);

-- ============================================================================
-- FOREIGN KEY CONSTRAINTS
-- ============================================================================

ALTER TABLE customer_subscriptions ADD CONSTRAINT customer_subscriptions_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES customers(id) ON UPDATE NO ACTION ON DELETE CASCADE;
ALTER TABLE customer_subscriptions ADD CONSTRAINT customer_subscriptions_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES vendor_subscription_plans(plan_id) ON UPDATE NO ACTION ON DELETE CASCADE;
ALTER TABLE customer_subscriptions ADD CONSTRAINT customer_subscriptions_vendor_id_fkey FOREIGN KEY (vendor_id) REFERENCES vendors(id) ON UPDATE NO ACTION ON DELETE CASCADE;

-- ============================================================================
-- UNIQUE CONSTRAINTS
-- ============================================================================

ALTER TABLE customer_subscriptions ADD CONSTRAINT customer_subscriptions_subscription_id_key UNIQUE (subscription_id);

-- ============================================================================
-- CHECK CONSTRAINTS
-- ============================================================================

-- ALTER TABLE customer_subscriptions ADD CONSTRAINT 2200_21434_10_not_null CHECK (...);
-- ALTER TABLE customer_subscriptions ADD CONSTRAINT 2200_21434_1_not_null CHECK (...);
-- ALTER TABLE customer_subscriptions ADD CONSTRAINT 2200_21434_2_not_null CHECK (...);
-- ALTER TABLE customer_subscriptions ADD CONSTRAINT 2200_21434_3_not_null CHECK (...);
-- ALTER TABLE customer_subscriptions ADD CONSTRAINT 2200_21434_4_not_null CHECK (...);
-- ALTER TABLE customer_subscriptions ADD CONSTRAINT 2200_21434_5_not_null CHECK (...);
-- ALTER TABLE customer_subscriptions ADD CONSTRAINT 2200_21434_6_not_null CHECK (...);
-- ALTER TABLE customer_subscriptions ADD CONSTRAINT 2200_21434_7_not_null CHECK (...);
-- ALTER TABLE customer_subscriptions ADD CONSTRAINT 2200_21434_8_not_null CHECK (...);
-- ALTER TABLE customer_subscriptions ADD CONSTRAINT 2200_21434_9_not_null CHECK (...);
-- ALTER TABLE customer_subscriptions ADD CONSTRAINT customer_subscriptions_interval_check CHECK (...);
-- ALTER TABLE customer_subscriptions ADD CONSTRAINT customer_subscriptions_status_check CHECK (...);

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE UNIQUE INDEX customer_subscriptions_pkey ON public.customer_subscriptions USING btree (id);
CREATE UNIQUE INDEX customer_subscriptions_subscription_id_key ON public.customer_subscriptions USING btree (subscription_id);
CREATE INDEX idx_customer_subscriptions_customer ON public.customer_subscriptions USING btree (customer_id);
CREATE INDEX idx_customer_subscriptions_customer_id ON public.customer_subscriptions USING btree (customer_id);
CREATE INDEX idx_customer_subscriptions_next_billing ON public.customer_subscriptions USING btree (next_billing_date) WHERE (status = 'active'::text);
CREATE INDEX idx_customer_subscriptions_next_billing_date ON public.customer_subscriptions USING btree (next_billing_date);
CREATE INDEX idx_customer_subscriptions_plan ON public.customer_subscriptions USING btree (plan_id);
CREATE INDEX idx_customer_subscriptions_plan_id ON public.customer_subscriptions USING btree (plan_id);
CREATE INDEX idx_customer_subscriptions_status ON public.customer_subscriptions USING btree (status);
CREATE INDEX idx_customer_subscriptions_vendor ON public.customer_subscriptions USING btree (vendor_id);
CREATE INDEX idx_customer_subscriptions_vendor_id ON public.customer_subscriptions USING btree (vendor_id);

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE customer_subscriptions IS 'Customer subscriptions to vendor-created plans';

