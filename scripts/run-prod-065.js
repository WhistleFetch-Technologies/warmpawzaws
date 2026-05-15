const fs = require('fs');
const { execSync } = require('child_process');
const base = {
  resourceArn: 'arn:aws:rds:ap-south-1:057442119249:cluster:warmpawz-prod-cluster',
  secretArn:
    'arn:aws:secretsmanager:ap-south-1:057442119249:secret:warmpawz-prod-rds-master-20260207201049162400000001-hmqkCE',
  database: 'warmpawz',
};
const stmts = [
  "UPDATE loyalty_action_rules SET conditions = jsonb_set(COALESCE(conditions, '{}'::jsonb), '{segment_ids}', (SELECT jsonb_agg(id::text) FROM loyalty_segments WHERE segment_name = 'Medicine Buyers')) WHERE action_name = 'buy_medicine' AND (conditions->>'segment_ids') IS NULL",
  "UPDATE loyalty_action_rules SET conditions = jsonb_set(COALESCE(conditions, '{}'::jsonb), '{segment_ids}', (SELECT jsonb_agg(id::text) FROM loyalty_segments WHERE segment_name = 'Grooming Service Users')) WHERE action_name = 'book_grooming' AND (conditions->>'segment_ids') IS NULL",
  "UPDATE loyalty_action_rules SET conditions = jsonb_set(COALESCE(conditions, '{}'::jsonb), '{segment_ids}', (SELECT jsonb_agg(id::text) FROM loyalty_segments WHERE segment_name = 'Vet Consultation Users')) WHERE action_name = 'book_vet_consultation' AND (conditions->>'segment_ids') IS NULL",
  "UPDATE loyalty_action_rules SET conditions = jsonb_set(COALESCE(conditions, '{}'::jsonb), '{segment_ids}', (SELECT jsonb_agg(id::text) FROM loyalty_segments WHERE segment_name = 'Pet Food Buyers')) WHERE action_name = 'purchase_pet_food' AND (conditions->>'segment_ids') IS NULL",
  "UPDATE loyalty_action_rules SET conditions = jsonb_set(COALESCE(conditions, '{}'::jsonb), '{segment_ids}', (SELECT jsonb_agg(id::text) FROM loyalty_segments WHERE segment_name = 'Insurance Buyers')) WHERE action_name = 'buy_insurance' AND (conditions->>'segment_ids') IS NULL",
  "UPDATE loyalty_action_rules SET conditions = jsonb_set(COALESCE(conditions, '{}'::jsonb), '{segment_ids}', (SELECT jsonb_agg(id::text) FROM loyalty_segments WHERE segment_name = 'First Time Buyers')) WHERE action_name = 'buy_first_product' AND (conditions->>'segment_ids') IS NULL",
  "UPDATE loyalty_action_rules SET conditions = jsonb_set(COALESCE(conditions, '{}'::jsonb), '{segment_ids}', (SELECT jsonb_agg(id::text) FROM loyalty_segments WHERE segment_name = 'Birthday Month Customers')) WHERE action_name = 'birthday_month_booking' AND (conditions->>'segment_ids') IS NULL",
  "COMMENT ON COLUMN loyalty_action_rules.conditions IS 'JSONB conditions including segment_ids (array of segment UUIDs), service_categories, customer_tiers, etc.'",
];
const out = 'd:/WFTPL/warmpawzApp/warmpawzaws/scripts/temp-prod-cli-one.json';
stmts.forEach((sql, i) => {
  console.log('065 step', i + 1);
  fs.writeFileSync(out, JSON.stringify({ ...base, sql }));
  execSync(
    'aws rds-data execute-statement --cli-input-json file://d:/WFTPL/warmpawzApp/warmpawzaws/scripts/temp-prod-cli-one.json --region ap-south-1',
    { stdio: 'inherit' }
  );
});
