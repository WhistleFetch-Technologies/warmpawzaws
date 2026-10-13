/**
 * Warmpawz Insurance feature flags.
 * Unset or any value other than true/1/yes/on means off.
 */

const TRUTHY = new Set(['true', '1', 'yes', 'on']);

function readFlag(env: Record<string, string | undefined>, key: string): boolean {
  const raw = env[key];
  if (raw === undefined || raw.trim() === '') return false;
  return TRUTHY.has(raw.trim().toLowerCase());
}

export function isWarmpawzInsuranceEnabled(
  env: Record<string, string | undefined> = process.env,
): boolean {
  return readFlag(env, 'WARMPAWZ_INSURANCE_ENABLED');
}

export function isWarmpawzInsuranceAdminEnabled(
  env: Record<string, string | undefined> = process.env,
): boolean {
  return readFlag(env, 'WARMPAWZ_INSURANCE_ADMIN_ENABLED');
}

/** Published form templates are required for vendor readiness only after P4. */
export function isInsuranceFormTemplateRequired(
  env: Record<string, string | undefined> = process.env,
): boolean {
  return readFlag(env, 'WARMPAWZ_INSURANCE_REQUIRE_FORM_TEMPLATE');
}
