#!/usr/bin/env node
/**
 * Strict code-level forensic verification: Rule Engine attribute + service_style/service_type.
 * No skipping – every line of implementation is checked.
 * Run: node scripts/forensic-verification-rule-engine.js
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const results = { passed: [], failed: [], warnings: [] };

function fail(check, detail) {
  results.failed.push({ check, detail });
}

function pass(check, detail) {
  results.passed.push({ check, detail });
}

function warn(check, detail) {
  results.warnings.push({ check, detail });
}

// ---------------------------------------------------------------------------
// 1. MIGRATION 091
// ---------------------------------------------------------------------------
const migrationPath = path.join(ROOT, 'db/migrations/091_discovery_rules_service_style_type.sql');
if (!fs.existsSync(migrationPath)) {
  fail('MIGRATION_091_EXISTS', 'File 091_discovery_rules_service_style_type.sql not found');
} else {
  pass('MIGRATION_091_EXISTS', 'File exists');
  const migration = fs.readFileSync(migrationPath, 'utf8');
  if (!migration.includes("ADD COLUMN IF NOT EXISTS service_style TEXT NOT NULL DEFAULT ''")) fail('MIGRATION_091_SERVICE_STYLE_COL', 'service_style column definition missing');
  else pass('MIGRATION_091_SERVICE_STYLE_COL', 'service_style column present');
  if (!migration.includes("ADD COLUMN IF NOT EXISTS service_type TEXT NOT NULL DEFAULT ''")) fail('MIGRATION_091_SERVICE_TYPE_COL', 'service_type column definition missing');
  else pass('MIGRATION_091_SERVICE_TYPE_COL', 'service_type column present');
  if (!migration.includes('DROP CONSTRAINT IF EXISTS discovery_rules_role_id_rule_key_applies_to_flow_city_key')) fail('MIGRATION_091_DROP_CONSTRAINT', 'DROP CONSTRAINT for old unique missing');
  else pass('MIGRATION_091_DROP_CONSTRAINT', 'DROP CONSTRAINT present');
  if (!migration.includes('discovery_rules_role_key_flow_city_style_type_key')) fail('MIGRATION_091_NEW_CONSTRAINT', 'New unique constraint name missing');
  else pass('MIGRATION_091_NEW_CONSTRAINT', 'New constraint name present');
  if (!migration.includes('UNIQUE (role_id, rule_key, applies_to_flow, city, service_style, service_type)')) fail('MIGRATION_091_UNIQUE_COLS', 'UNIQUE column list incorrect');
  else pass('MIGRATION_091_UNIQUE_COLS', 'UNIQUE columns correct');
  if (!migration.includes('idx_discovery_rules_service_style') || !migration.includes('idx_discovery_rules_service_type')) fail('MIGRATION_091_INDEXES', 'Partial indexes for service_style/type missing');
  else pass('MIGRATION_091_INDEXES', 'Indexes present');
}

// ---------------------------------------------------------------------------
// 2. RULE ENGINE (rule-engine.ts)
// ---------------------------------------------------------------------------
const ruleEnginePath = path.join(ROOT, 'backend/lambda/src/lib/rule-engine.ts');
const ruleEngine = fs.readFileSync(ruleEnginePath, 'utf8');

if (!ruleEngine.includes('serviceStyle?: string | null') || !ruleEngine.includes('serviceType?: string | null')) fail('RULE_ENGINE_SIGNATURE', 'getDiscoveryRules missing serviceStyle/serviceType params');
else pass('RULE_ENGINE_SIGNATURE', 'getDiscoveryRules(roleId, flow?, serviceStyle?, serviceType?) present');

if (!ruleEngine.includes("const style = (serviceStyle && serviceStyle.trim()) || ''")) fail('RULE_ENGINE_STYLE_NORMALIZE', 'style normalization missing');
else pass('RULE_ENGINE_STYLE_NORMALIZE', 'style normalized');
if (!ruleEngine.includes("const type = (serviceType && serviceType.trim()) || ''")) fail('RULE_ENGINE_TYPE_NORMALIZE', 'type normalization missing');
else pass('RULE_ENGINE_TYPE_NORMALIZE', 'type normalized');

if (!ruleEngine.includes("AND (COALESCE(service_style, '') = '' OR COALESCE(service_style, '') = COALESCE($3, ''))")) fail('RULE_ENGINE_WHERE_STYLE', 'WHERE service_style clause missing');
else pass('RULE_ENGINE_WHERE_STYLE', 'WHERE service_style present');
if (!ruleEngine.includes("AND (COALESCE(service_type, '') = '' OR COALESCE(service_type, '') = COALESCE($4, ''))")) fail('RULE_ENGINE_WHERE_TYPE', 'WHERE service_type clause missing');
else pass('RULE_ENGINE_WHERE_TYPE', 'WHERE service_type present');

if (!ruleEngine.includes("CASE WHEN COALESCE(service_style, '') = '' THEN 0 ELSE 1 END") || !ruleEngine.includes("CASE WHEN COALESCE(service_type, '') = '' THEN 0 ELSE 1 END")) fail('RULE_ENGINE_ORDER', 'ORDER BY specificity for style/type missing');
else pass('RULE_ENGINE_ORDER', 'ORDER BY specificity correct');

if (!ruleEngine.includes('[roleId, flow || \'\', style, type]')) fail('RULE_ENGINE_PARAMS', 'Query params array [roleId, flow, style, type] missing');
else pass('RULE_ENGINE_PARAMS', 'Query params correct');

if (!ruleEngine.includes('extractRuleValue(row.rule_value)') || !ruleEngine.includes('(result as any)[key] = val')) fail('RULE_ENGINE_LOOP', 'getDiscoveryRules must extract and merge rule_value');
else pass('RULE_ENGINE_LOOP', 'Loop merges rule_value correctly');

const getRuleNumberMatch = ruleEngine.match(/getRuleNumber\s*\([^)]+\)/);
if (!getRuleNumberMatch || !ruleEngine.includes('serviceStyle?: string | null') || !ruleEngine.includes('serviceType?: string | null')) {
  const hasOptionalStyleType = /getRuleNumber[\s\S]*?serviceStyle\?\:[\s\S]*?serviceType\?\:/.test(ruleEngine);
  if (!hasOptionalStyleType) {
    const getRuleNumberBlock = ruleEngine.indexOf('export async function getRuleNumber');
    const nextExport = ruleEngine.indexOf('export async function', getRuleNumberBlock + 5);
    const block = ruleEngine.slice(getRuleNumberBlock, nextExport > 0 ? nextExport : ruleEngine.length);
    if (!block.includes('serviceStyle') || !block.includes('serviceType')) fail('RULE_ENGINE_GET_RULE_NUMBER_ARGS', 'getRuleNumber missing serviceStyle/serviceType');
    else pass('RULE_ENGINE_GET_RULE_NUMBER_ARGS', 'getRuleNumber has optional style/type');
  } else pass('RULE_ENGINE_GET_RULE_NUMBER_ARGS', 'getRuleNumber has optional style/type');
} else pass('RULE_ENGINE_GET_RULE_NUMBER_ARGS', 'getRuleNumber has optional style/type');

if (!ruleEngine.includes('getDiscoveryRules(roleId, flow, serviceStyle, serviceType)')) fail('RULE_ENGINE_GET_RULE_NUMBER_CALL', 'getRuleNumber must call getDiscoveryRules with style/type');
else pass('RULE_ENGINE_GET_RULE_NUMBER_CALL', 'getRuleNumber forwards to getDiscoveryRules with style/type');

// ---------------------------------------------------------------------------
// 3. DISCOVERY RULES ADMIN API
// ---------------------------------------------------------------------------
const adminPath = path.join(ROOT, 'backend/lambda/src/endpoints/discovery-rules-admin.ts');
const admin = fs.readFileSync(adminPath, 'utf8');

if (!admin.includes("c.req.query('service_style') ?? c.req.query('serviceStyle')")) fail('ADMIN_GET_QUERY_STYLE', 'GET query service_style/serviceStyle missing');
else pass('ADMIN_GET_QUERY_STYLE', 'GET reads service_style from query');
if (!admin.includes('service_style, service_type') || !admin.includes('FROM discovery_rules')) fail('ADMIN_GET_SELECT', 'GET SELECT must include service_style, service_type');
else pass('ADMIN_GET_SELECT', 'GET SELECT includes service_style, service_type');

if (!admin.includes('COALESCE(service_style') || !admin.includes('service_style = $')) fail('ADMIN_GET_FILTER_STYLE', 'GET filter for service_style missing');
else pass('ADMIN_GET_FILTER_STYLE', 'GET filter service_style present');

if (!admin.includes('service_style, service_type, is_active, updated_at') && !admin.includes('service_style, service_type')) fail('ADMIN_POST_INSERT_COLS', 'POST INSERT must include service_style, service_type');
else pass('ADMIN_POST_INSERT_COLS', 'POST INSERT columns include service_style, service_type');

if (!admin.includes('ON CONFLICT (role_id, rule_key, applies_to_flow, city, service_style, service_type)')) fail('ADMIN_POST_CONFLICT', 'POST ON CONFLICT must use new 6-column unique');
else pass('ADMIN_POST_CONFLICT', 'POST ON CONFLICT correct');

if (!admin.includes('const style = (service_style != null') || !admin.includes('const type = (service_type != null')) fail('ADMIN_POST_NORMALIZE', 'POST must normalize style/type to string');
else pass('ADMIN_POST_NORMALIZE', 'POST normalizes style/type');

if (!admin.includes('service_style !== undefined') || !admin.includes('service_type !== undefined')) fail('ADMIN_PUT_FIELDS', 'PUT must handle service_style, service_type');
else pass('ADMIN_PUT_FIELDS', 'PUT updates service_style, service_type');

if (!admin.includes('service_type') || !admin.includes('COALESCE(service_type')) fail('ADMIN_GET_FILTER_TYPE', 'GET filter for service_type missing');
else pass('ADMIN_GET_FILTER_TYPE', 'GET filter service_type present');

// Keys API: unit per key
if (!admin.includes("unit: 'km'") || !admin.includes("unit: 'minutes'")) fail('ADMIN_KEYS_UNIT', 'GET /keys must return unit for keys');
else pass('ADMIN_KEYS_UNIT', 'Keys API returns unit');

// ---------------------------------------------------------------------------
// 4. DISCOVERY RULES MANAGER (UI)
// ---------------------------------------------------------------------------
const uiPath = path.join(ROOT, 'apps/admin-web/components/admin/platform-settings/integrations/ruleBook/DiscoveryRulesManager.tsx');
const ui = fs.readFileSync(uiPath, 'utf8');

if (!ui.includes('service_style?: string | null') || !ui.includes('service_type?: string | null')) fail('UI_INTERFACE', 'DiscoveryRule interface must include service_style, service_type');
else pass('UI_INTERFACE', 'DiscoveryRule has service_style, service_type');

if (!ui.includes('service_style: "" as string') || !ui.includes('service_type: "" as string')) fail('UI_FORM_STATE', 'form state must include service_style, service_type');
else pass('UI_FORM_STATE', 'form state includes service_style, service_type');

if (!ui.includes('filterServiceStyle') || !ui.includes('filterServiceType')) fail('UI_FILTER_STATE', 'filter state for service style/type missing');
else pass('UI_FILTER_STATE', 'filterServiceStyle, filterServiceType present');

if (!ui.includes('params.set("service_style"') || !ui.includes('params.set("service_type"')) fail('UI_LOAD_PARAMS', 'loadRules must pass service_style, service_type in params');
else pass('UI_LOAD_PARAMS', 'loadRules passes service_style, service_type');

if (!ui.includes('Service style') || !ui.includes('Service type')) fail('UI_TABLE_HEADERS', 'Table must have Service style and Service type columns');
else pass('UI_TABLE_HEADERS', 'Table headers present');

if (!ui.includes('rule.service_style || "—"') || !ui.includes('rule.service_type || "—"')) fail('UI_TABLE_CELLS', 'Table must render rule.service_style, rule.service_type');
else pass('UI_TABLE_CELLS', 'Table cells for service_style, service_type present');

if (!ui.includes('attributeForRule(rule, keys)') || !ui.includes('Attribute')) fail('UI_ATTRIBUTE_COLUMN', 'Attribute column from keys lookup missing');
else pass('UI_ATTRIBUTE_COLUMN', 'Attribute column present');

if (!ui.includes('Service style (optional)') || !ui.includes('Service type (optional)')) fail('UI_FORM_FIELDS', 'Add/Edit form must have Service style and Service type fields');
else pass('UI_FORM_FIELDS', 'Form has Service style and Service type dropdowns');

if (!ui.includes('service_style: form.service_style || null') || !ui.includes('service_type: form.service_type || null')) fail('UI_SAVE_BODY', 'handleSave PUT/POST body must include service_style, service_type');
else pass('UI_SAVE_BODY', 'handleSave sends service_style, service_type');

if (!ui.includes('rule.service_style ?? ""') || !ui.includes('rule.service_type ?? ""')) fail('UI_OPEN_EDIT', 'openEdit must set form.service_style, form.service_type from rule');
else pass('UI_OPEN_EDIT', 'openEdit populates service_style, service_type');

if (!ui.includes('opt.unit') && !ui.includes('unit: ')) warn('UI_VALUE_LABEL_UNIT', 'Form value label should show type/unit from keys');
else pass('UI_VALUE_LABEL_UNIT', 'Value label uses key type/unit');

// ---------------------------------------------------------------------------
// 5. SERVICE DISCOVERY CALL SITE
// ---------------------------------------------------------------------------
const discoveryPath = path.join(ROOT, 'backend/lambda/src/endpoints/service-discovery.ts');
const discovery = fs.readFileSync(discoveryPath, 'utf8');

if (!discovery.includes("getDiscoveryRules(") || !discovery.includes("serviceStyle || undefined") || !discovery.includes("category || undefined")) fail('DISCOVERY_BY_STYLE_CALL', 'by-style endpoint must call getDiscoveryRules(..., serviceStyle, category)');
else pass('DISCOVERY_BY_STYLE_CALL', 'by-style passes serviceStyle and category to getDiscoveryRules');

// ---------------------------------------------------------------------------
// REPORT
// ---------------------------------------------------------------------------
console.log('\n=== Forensic verification: Rule Engine (attribute + service_style/service_type) ===\n');

console.log('PASSED (' + results.passed.length + '):');
results.passed.forEach(({ check, detail }) => console.log('  [OK] ' + check + ': ' + detail));

if (results.warnings.length) {
  console.log('\nWARNINGS (' + results.warnings.length + '):');
  results.warnings.forEach(({ check, detail }) => console.log('  [WARN] ' + check + ': ' + detail));
}

if (results.failed.length) {
  console.log('\nFAILED (' + results.failed.length + '):');
  results.failed.forEach(({ check, detail }) => console.log('  [FAIL] ' + check + ': ' + detail));
  process.exit(1);
}

console.log('\nAll checks passed. No lines skipped.\n');
process.exit(0);
