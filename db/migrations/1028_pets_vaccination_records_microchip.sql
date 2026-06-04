-- Prod-safe: pets health columns used by PUT /customer/:phone/pets/:petId
-- (also defined in 202_customer_preferences_unified.sql; idempotent re-apply)

ALTER TABLE pets
  ADD COLUMN IF NOT EXISTS microchip_id TEXT;

ALTER TABLE pets
  ADD COLUMN IF NOT EXISTS vaccination_records JSONB DEFAULT '[]'::jsonb;

COMMENT ON COLUMN pets.microchip_id IS 'Pet microchip identification number';
COMMENT ON COLUMN pets.vaccination_records IS 'Vaccination map or array JSONB; mirrored in medical_history.vaccinationDates';
