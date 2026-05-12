-- Persist customer deactivation metadata.
--
-- Apply manually against Aurora/PostgreSQL:
--   psql "$DATABASE_URL" -f services/customer-service/docs/sql/customer-deactivation-reason.sql
--
-- This project does not use Flyway/Liquibase here and customer-service keeps
-- spring.jpa.hibernate.ddl-auto=none, so deploys must not auto-run this DDL.

ALTER TABLE public.customers
    ADD COLUMN IF NOT EXISTS deactivated_at timestamptz;

ALTER TABLE public.customers
    ADD COLUMN IF NOT EXISTS deactivation_reason varchar(255);
