-- Fix service_categories.name to 'Training & Behaviorist' for training/behavioral categories
-- Idempotent: only updates rows whose name is the old raw value
UPDATE service_categories
SET name = 'Training & Behaviorist'
WHERE category_id IN ('behavioral', 'training')
  AND name IN ('Behavioral', 'Behaviorist', 'Training');
