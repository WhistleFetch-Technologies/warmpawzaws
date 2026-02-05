/**
 * RBAC constants — must stay in sync with backend VENDOR_ROLE_NAMES.
 * Used to filter vendor/catalog roles out of the RBAC Management UI (admin user roles only).
 */
export const VENDOR_ROLE_NAMES = new Set([
  'vet_solo', 'vet_clinic', 'groomer_solo', 'groomer_center', 'trainer_solo', 'trainer_center',
  'behaviorist_solo', 'behaviorist_center', 'boarding', 'walker', 'sitter', 'adoption_center',
  'cafe', 'photographer', 'pharmacy', 'seller', 'ambulance', 'insurance', 'nutritionist',
  'nutritionist_center', 'relocation', 'resort', 'holiday', 'sunset', 'breeder', 'diagnostics_center',
  'event_organizer',
]);

export function isVendorRole(roleName: string | undefined | null): boolean {
  if (roleName == null || typeof roleName !== 'string') return false;
  return VENDOR_ROLE_NAMES.has(roleName.trim().toLowerCase());
}

/** Filter to only admin (non-vendor) roles for RBAC Management. */
export function filterAdminRolesOnly<T extends { name?: string; roleCode?: string }>(roles: T[]): T[] {
  return roles.filter((r) => !isVendorRole(r.name ?? r.roleCode));
}
