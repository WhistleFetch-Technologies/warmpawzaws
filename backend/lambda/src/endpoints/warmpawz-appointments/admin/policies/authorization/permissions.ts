export const WAPPT_POLICIES_VIEW = 'admin.warmpawz_appointments.policies.view';
export const WAPPT_POLICIES_EDIT = 'admin.warmpawz_appointments.policies.edit';

export function hasWapptPoliciesPermission(
  permissions: readonly string[],
  required: typeof WAPPT_POLICIES_VIEW | typeof WAPPT_POLICIES_EDIT,
): boolean {
  if (permissions.some((p) => p === 'admin.full_access' || p === '*')) return true;
  if (permissions.includes('admin.warmpawz_appointments')) return true;
  if (required === WAPPT_POLICIES_VIEW && permissions.includes(WAPPT_POLICIES_EDIT)) return true;
  return permissions.includes(required);
}
