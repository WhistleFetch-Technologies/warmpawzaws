-- Customer-service canary hardening constraints.
--
-- Apply manually against Aurora/PostgreSQL during a maintenance window:
--   psql "$DATABASE_URL" -f services/customer-service/docs/sql/canary-hardening.sql
--
-- The application must not auto-run this file. customer-service keeps
-- spring.jpa.hibernate.ddl-auto=none and relies on explicit operator-applied DDL.
--
-- These indexes mirror the duplicate guards in:
--   CustomerAddressRepository.existsNormalizedDuplicate
--   PetRepository.existsNormalizedDuplicate

CREATE TABLE IF NOT EXISTS public.idempotency_records (
    id uuid PRIMARY KEY,
    scope_key varchar(255) NOT NULL,
    idempotency_key varchar(128) NOT NULL,
    composite_key varchar(512) NOT NULL,
    payload_hash varchar(128) NOT NULL,
    status_code integer,
    response_body text,
    state varchar(32) NOT NULL,
    expires_at timestamptz NOT NULL,
    created_at timestamptz NOT NULL,
    updated_at timestamptz NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS uk_idempotency_scope_key
    ON public.idempotency_records (scope_key, idempotency_key);

CREATE INDEX IF NOT EXISTS idx_idempotency_expires_at
    ON public.idempotency_records (expires_at);

CREATE UNIQUE INDEX IF NOT EXISTS ux_customer_addresses_business_key
    ON public.customer_addresses (
        customer_id,
        lower(btrim(coalesce(address_line1, ''))),
        lower(btrim(coalesce(address_line2, ''))),
        lower(btrim(coalesce(city, ''))),
        lower(btrim(coalesce(state, ''))),
        btrim(coalesce(pincode, '')),
        lower(btrim(coalesce(address_type, '')))
    )
    WHERE customer_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ux_pets_customer_profile_key
    ON public.pets (
        customer_id,
        lower(btrim(coalesce(name, ''))),
        lower(btrim(coalesce(species, ''))),
        lower(btrim(coalesce(breed, '')))
    )
    WHERE customer_id IS NOT NULL;
