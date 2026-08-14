/**
 * Read-only check: is 1083 pet loyalty lifetime cap present?
 * Usage (PowerShell): $env:ENVIRONMENT='prod'; node scripts/check-pet-loyalty-1083-rds-data-api.js
 */
const { query } = require('./rds-data-api-utils-dev');

async function main() {
  const env = (process.env.ENVIRONMENT || '').toLowerCase();
  if (env !== 'prod' && env !== 'dev') {
    console.error("Set ENVIRONMENT=prod (or dev) before running this script.");
    process.exit(1);
  }

  console.log(`CHECK_START=${new Date().toISOString()}`);
  console.log(`Environment: ${env}\n`);

  const rules = await query(`
    SELECT action_name, frequency_type, frequency_limit,
           conditions->>'cap_effective_from' AS cap_effective_from, notes
    FROM loyalty_action_rules
    WHERE action_name IN ('complete_pet_profile', 'update_health_record')
    ORDER BY action_name
  `);
  console.log('RULES', JSON.stringify(rules, null, 2));

  const sources = await query(`
    SELECT method, route_pattern, action_name, success_predicate, enabled
    FROM action_sources
    WHERE action_name IN ('complete_pet_profile', 'update_health_record')
    ORDER BY action_name, method, route_pattern
  `);
  console.log('SOURCES', JSON.stringify(sources, null, 2));

  const needed = ['complete_pet_profile', 'update_health_record'];
  const missingCap = needed.filter((name) => {
    const row = (rules || []).find((r) => r.action_name === name);
    return !row || row.frequency_type !== 'lifetime_limit' || Number(row.frequency_limit) !== 3;
  });

  if (missingCap.length > 0) {
    console.log(`\n1083_MISSING actions=${missingCap.join(',')}`);
    process.exit(2);
  }

  console.log('\n1083_PRESENT both rules are lifetime_limit / 3');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
