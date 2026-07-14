/**
 * Resolve booking service category for promotion / subscription matching.
 *
 * Precedence (first non-empty wins):
 * 1. Explicit caller override (serviceCategory / body.category)
 * 2. Catalog service.category or vendor_services.category
 * 3. Vendor role customer_service or role config category (roles table)
 * 4. vendors.category column
 * 5. Service catalog category_id / service name heuristic (service-catalog-sync)
 */
import { query } from '../../database/rds-connection';
import { categoryToApplicableRoles } from '../../utils/service-catalog-sync';

export type ResolveBookingServiceCategoryParams = {
  vendorId?: string | null;
  service?: Record<string, unknown> | null;
  serviceId?: string | null;
  serviceName?: string | null;
  explicitCategory?: string | null;
};

function normalizeCategory(raw: unknown): string | null {
  const s = String(raw ?? '').trim();
  return s || null;
}

function categoryFromRoleRecord(role: Record<string, unknown>): string | null {
  const direct = normalizeCategory(role.customer_service);
  if (direct) return direct;

  const config =
    role.config && typeof role.config === 'object'
      ? (role.config as Record<string, unknown>)
      : typeof role.config === 'string'
        ? (() => {
            try {
              return JSON.parse(role.config) as Record<string, unknown>;
            } catch {
              return null;
            }
          })()
        : null;

  if (config) {
    const fromConfig =
      normalizeCategory(config.customer_service) ||
      normalizeCategory(config.category) ||
      normalizeCategory(config.service_category);
    if (fromConfig) return fromConfig;
  }

  return normalizeCategory(role.category);
}

function inferCategoryFromServiceIdentity(
  serviceId?: string | null,
  serviceName?: string | null
): string | null {
  const roles = categoryToApplicableRoles(null, null, serviceId ?? null, serviceName ?? null);
  if (roles.some((r) => /vet|veterinar/.test(r))) return 'vet';
  if (roles.some((r) => /groom/.test(r))) return 'grooming';
  if (roles.some((r) => /train/.test(r))) return 'training';
  if (roles.some((r) => /walk/.test(r))) return 'walker';
  if (roles.some((r) => /board|sitter|daycare/.test(r))) return 'boarding';
  if (roles.some((r) => /nutrition/.test(r))) return 'nutritionist';
  return null;
}

export async function resolveBookingServiceCategory(
  params: ResolveBookingServiceCategoryParams
): Promise<string | null> {
  const explicit = normalizeCategory(params.explicitCategory);
  if (explicit) return explicit;

  const service = params.service ?? {};
  const fromService =
    normalizeCategory(service.category) ||
    normalizeCategory(service.service_category) ||
    normalizeCategory((service as { category_id?: unknown }).category_id);
  if (fromService) return fromService;

  const vendorId = normalizeCategory(params.vendorId);
  if (vendorId) {
    try {
      const res = await query(
        `SELECT v.category AS vendor_category,
                r.customer_service, r.config, r.category AS role_category
         FROM vendors v
         LEFT JOIN roles r ON r.id = v.role_id
         WHERE v.id = $1::uuid
         LIMIT 1`,
        [vendorId]
      );
      const row = (res.rows?.[0] as Record<string, unknown>) ?? {};
      const fromRole = categoryFromRoleRecord(row);
      if (fromRole) return fromRole;
      const fromVendorCol = normalizeCategory(row.vendor_category);
      if (fromVendorCol) return fromVendorCol;
    } catch (err) {
      console.warn('[resolveBookingServiceCategory] vendor role lookup failed:', err);
    }
  }

  return inferCategoryFromServiceIdentity(
    params.serviceId ?? normalizeCategory(service.service_id ?? service.id),
    params.serviceName ??
      normalizeCategory(service.service_name ?? service.name ?? service.display_name)
  );
}
