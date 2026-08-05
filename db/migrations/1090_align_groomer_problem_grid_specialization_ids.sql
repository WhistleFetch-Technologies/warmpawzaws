-- Align legacy problem_grid_mappings.problem_id with specialization_master.specialization_id
-- so customer tiles and vendor profile specializations resolve to the same discovery keys.

-- General: remap rows where problem_id differs from canonical specialization_id but matches by name/display
UPDATE problem_grid_mappings pgm
SET problem_id = sm.specialization_id
FROM specialization_master sm
WHERE sm.is_active = true
  AND pgm.problem_id IS DISTINCT FROM sm.specialization_id
  AND (
    LOWER(TRIM(sm.specialization_id)) = LOWER(TRIM(pgm.problem_id))
    OR LOWER(TRIM(sm.name)) = LOWER(TRIM(pgm.problem_name))
    OR LOWER(TRIM(COALESCE(sm.display_name, ''))) = LOWER(TRIM(COALESCE(pgm.problem_display_name, pgm.problem_name)))
  );

-- Groomer bath tile: migrations used bath_only vs bath_brush — prefer bath_brush when present in catalog
UPDATE problem_grid_mappings pgm
SET problem_id = 'bath_brush'
WHERE LOWER(TRIM(pgm.role_id)) IN ('groomer', 'groomer_solo', 'groomer_center', 'pet_groomer')
  AND LOWER(TRIM(pgm.problem_id)) = 'bath_only'
  AND EXISTS (
    SELECT 1 FROM specialization_master sm
    WHERE sm.is_active = true AND LOWER(TRIM(sm.specialization_id)) = 'bath_brush'
  );

-- Groomer hair trim vs hair_trimming alias
UPDATE problem_grid_mappings pgm
SET problem_id = sm.specialization_id
FROM specialization_master sm
WHERE sm.is_active = true
  AND LOWER(TRIM(pgm.role_id)) IN ('groomer', 'groomer_solo', 'groomer_center', 'pet_groomer')
  AND LOWER(TRIM(pgm.problem_id)) IN ('hair_trim', 'haircut_styling')
  AND (
    LOWER(TRIM(sm.specialization_id)) IN ('hair_trimming', 'haircut_styling')
    OR LOWER(TRIM(sm.name)) ILIKE '%hair%trim%'
    OR LOWER(TRIM(sm.display_name)) ILIKE '%hair%trim%'
  )
  AND pgm.problem_id IS DISTINCT FROM sm.specialization_id;
