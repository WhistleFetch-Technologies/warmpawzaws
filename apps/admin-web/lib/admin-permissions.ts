/**
 * Client-side admin portal permission checks (must match backend admin.* IDs).
 */

export function getStoredAdminPermissions(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem('adminPermissions');
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

export function hasAdminPortalPermission(required: string | string[]): boolean {
  const perms = getStoredAdminPermissions();
  if (perms.length === 0) return false;
  if (perms.includes('admin.full_access') || perms.includes('*')) return true;
  const need = Array.isArray(required) ? required : [required];
  return need.some((p) => perms.includes(p));
}

export function canAccessRbacPage(): boolean {
  return hasAdminPortalPermission(['admin.roles', 'admin.full_access']);
}
