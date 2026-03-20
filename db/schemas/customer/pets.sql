-- ============================================================================
-- PETS TABLE - SCHEMA
-- ============================================================================
-- Extracted from production RDS database
-- ============================================================================

-- ============================================================================
-- TABLE DEFINITION
-- ============================================================================

CREATE TABLE IF NOT EXISTS pets (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL,
    name TEXT NOT NULL,
    species TEXT NOT NULL,
    breed TEXT,
    age_years INTEGER,
    age_months INTEGER,
    gender TEXT,
    weight_kg NUMERIC(5, 2),
    profile_photo_url TEXT,
    medical_history JSONB,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    PRIMARY KEY (id)
);

-- ============================================================================
-- FOREIGN KEY CONSTRAINTS
-- ============================================================================

ALTER TABLE pets ADD CONSTRAINT pets_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES customers(id) ON UPDATE NO ACTION ON DELETE CASCADE;

-- ============================================================================
-- CHECK CONSTRAINTS
-- ============================================================================

ALTER TABLE pets ADD CONSTRAINT pets_gender_check CHECK (gender IS NULL OR gender IN ('male', 'female', 'neutered', 'spayed'));

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE UNIQUE INDEX pets_pkey ON public.pets USING btree (id);
CREATE INDEX idx_pets_customer_id ON public.pets USING btree (customer_id);
CREATE INDEX idx_pets_species ON public.pets USING btree (species);

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE pets IS 'Pet profiles - maps from customer:{id}:pets KV keys';
COMMENT ON COLUMN pets.customer_id IS 'Reference to customers table';
COMMENT ON COLUMN pets.name IS 'Pet name';
COMMENT ON COLUMN pets.species IS 'Pet species: dog, cat, bird, etc.';
COMMENT ON COLUMN pets.breed IS 'Pet breed';
COMMENT ON COLUMN pets.age_years IS 'Age in years';
COMMENT ON COLUMN pets.age_months IS 'Age in months';
COMMENT ON COLUMN pets.gender IS 'Gender: male, female, neutered, spayed';
COMMENT ON COLUMN pets.weight_kg IS 'Weight in kilograms';
COMMENT ON COLUMN pets.medical_history IS 'Medical history (JSONB)';
