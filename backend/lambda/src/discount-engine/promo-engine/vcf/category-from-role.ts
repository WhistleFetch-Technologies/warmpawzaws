/**
 * Category is a real service_categories.id reached through vendor_roles.
 * Do not invent a slug when nothing matches.
 */

export interface CatalogueCategoryRow {
  id: string;
  vendor_roles: unknown;
}

function roleTokens(roleId?: string | null, roleName?: string | null): string[] {
  const out: string[] = [];
  const id = String(roleId || '').trim();
  const name = String(roleName || '').trim();
  if (id) out.push(id, id.toLowerCase());
  if (name) {
    out.push(name, name.toLowerCase());
    out.push(name.toLowerCase().replace(/[^a-z0-9]+/g, '_'));
  }
  return [...new Set(out.filter(Boolean))];
}

function rolesOnCategory(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.map((x) => String(x).trim()).filter(Boolean);
  if (typeof raw === 'string') {
    const s = raw.trim();
    if (!s) return [];
    try {
      const parsed = JSON.parse(s);
      if (Array.isArray(parsed)) return parsed.map((x) => String(x).trim()).filter(Boolean);
    } catch {
      return s.split(',').map((x) => x.trim()).filter(Boolean);
    }
  }
  return [];
}

/** First catalogue row whose vendor_roles contains this role id or name. */
export function categoryIdFromVendorRole(opts: {
  roleId?: string | null;
  roleName?: string | null;
  categories: CatalogueCategoryRow[];
}): string | null {
  const tokens = roleTokens(opts.roleId, opts.roleName);
  if (!tokens.length) return null;
  const tokenSet = new Set(tokens.map((t) => t.toLowerCase()));
  for (const row of opts.categories) {
    const listed = rolesOnCategory(row.vendor_roles);
    const hit = listed.some((entry) => tokenSet.has(entry.toLowerCase()));
    if (hit && row.id) return String(row.id);
  }
  return null;
}
