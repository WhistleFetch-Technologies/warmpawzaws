-- Create problem_grid_mappings table for problem-based vendor discovery
CREATE TABLE IF NOT EXISTS problem_grid_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  problem_id TEXT NOT NULL,
  problem_name TEXT NOT NULL,
  problem_display_name TEXT,
  role_id TEXT NOT NULL,
  sub_category_id TEXT,
  sub_category_name TEXT,
  order_index INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_problem_grid_problem_id 
  ON problem_grid_mappings(problem_id);
CREATE INDEX IF NOT EXISTS idx_problem_grid_role_id 
  ON problem_grid_mappings(role_id);
CREATE INDEX IF NOT EXISTS idx_problem_grid_role_problem 
  ON problem_grid_mappings(role_id, problem_id);

-- Insert sample problem mappings for veterinarians
INSERT INTO problem_grid_mappings (problem_id, problem_name, problem_display_name, role_id, order_index)
SELECT 
  'health-checkup' as problem_id,
  'Health Checkup' as problem_name,
  'Health Checkup' as problem_display_name,
  id as role_id,
  1 as order_index
FROM roles 
WHERE name = 'veterinarian' OR name = 'vet_clinic'
LIMIT 1
ON CONFLICT DO NOTHING;

INSERT INTO problem_grid_mappings (problem_id, problem_name, problem_display_name, role_id, order_index)
SELECT 
  'vaccination' as problem_id,
  'Vaccination' as problem_name,
  'Vaccination' as problem_display_name,
  id as role_id,
  2 as order_index
FROM roles 
WHERE name = 'veterinarian' OR name = 'vet_clinic'
LIMIT 1
ON CONFLICT DO NOTHING;

INSERT INTO problem_grid_mappings (problem_id, problem_name, problem_display_name, role_id, order_index)
SELECT 
  'surgery' as problem_id,
  'Surgery' as problem_name,
  'Surgery' as problem_display_name,
  id as role_id,
  3 as order_index
FROM roles 
WHERE name = 'veterinarian' OR name = 'vet_clinic'
LIMIT 1
ON CONFLICT DO NOTHING;

INSERT INTO problem_grid_mappings (problem_id, problem_name, problem_display_name, role_id, order_index)
SELECT 
  'emergency' as problem_id,
  'Emergency' as problem_name,
  'Emergency Care' as problem_display_name,
  id as role_id,
  4 as order_index
FROM roles 
WHERE name = 'veterinarian' OR name = 'vet_clinic'
LIMIT 1
ON CONFLICT DO NOTHING;

INSERT INTO problem_grid_mappings (problem_id, problem_name, problem_display_name, role_id, order_index)
SELECT 
  'dermatology' as problem_id,
  'Dermatology' as problem_name,
  'Skin & Coat Issues' as problem_display_name,
  id as role_id,
  5 as order_index
FROM roles 
WHERE name = 'veterinarian' OR name = 'vet_clinic'
LIMIT 1
ON CONFLICT DO NOTHING;
