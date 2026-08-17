/**
 * Resolve service-booking GST inputs for taxCalculationService (catalog category + vendor role).
 * Shared by POST /tax/calculate, payments-enhanced, and /customer/pricing/quote.
 *
 * All veterinary services (including vaccinations) use the veterinary catalogue GST row (0% for vet roles).
 */

import { query, select } from '../database/rds-connection';
import { isValidUUID } from '../types/entities';
import { resolveCatalogCategoryUuidFromRef } from '../lib/services/gst-catalog-role-resolution';
import type { TaxItem } from '../lib/services/tax-calculation-service';

/** Vendor roles that receive 0% GST on service_booking when catalogue category is missing. */
export const VET_VENDOR_ROLE_NAMES = [
  'vet_clinic',
  'veterinarian',
  'vet_solo',
  'vet',
  'veterinary_clinic',
  'solo_vet',
  'pet_clinic',
] as const;

/** Catalogue slugs that share an Admin GST card with another master. */
const GST_CATALOG_CATEGORY_ALIASES: Record<string, string> = {
  behavioral: 'training',
  behavioural: 'training',
  'lab-diagnostics': 'diagnostic',
};

export function aliasGstCatalogCategoryRef(ref: string): string {
  const key = String(ref || '').trim().toLowerCase();
  return GST_CATALOG_CATEGORY_ALIASES[key] ?? ref;
}

export function isVetVendorRoleName(roleName: string | null | undefined): boolean {
  if (roleName == null || String(roleName).trim() === '') return false;
  const n = String(roleName).toLowerCase().trim();
  return (VET_VENDOR_ROLE_NAMES as readonly string[]).includes(n);
}

async function resolveVendorRole(
  vendorRoleId: string | null | undefined,
  vendorId: string | null | undefined,
): Promise<{ roleId: string | null; roleName: string | null }> {
  let roleId = vendorRoleId ? String(vendorRoleId).trim() : '';
  if (!roleId && vendorId) {
    const vendors = await select('vendors', { id: vendorId }).catch(() => []);
    roleId = vendors[0]?.role_id ? String(vendors[0].role_id).trim() : '';
  }
  if (!roleId) return { roleId: null, roleName: null };
  const rows = await query(`SELECT name FROM roles WHERE id = $1::uuid LIMIT 1`, [roleId]).catch(
    () => ({ rows: [] }),
  );
  const name = rows.rows?.[0]?.name;
  return {
    roleId,
    roleName: name != null ? String(name).trim() : null,
  };
}

export function catalogPriceIncludesTaxMeta(meta: unknown): boolean {
  if (meta == null || typeof meta !== 'object') return false;
  return !!(meta as Record<string, unknown>).show_final_price_inclusive_tax;
}

function metadataGstCatalogRef(meta: unknown): string | null {
  if (meta == null || typeof meta !== 'object') return null;
  const m = meta as Record<string, unknown>;
  const raw =
    m.gst_catalog_category_id ??
    m.gst_catalog_category_ref ??
    m.gstCatalogCategoryId ??
    m.gst_catalog_category;
  if (raw == null || String(raw).trim() === '') return null;
  return String(raw).trim();
}

/** Detect vaccination services (booking UX / reminders — not a separate GST lane). */
export function isVaccinationService(params: {
  catalogServiceId?: string | null;
  serviceName?: string | null;
  subCategory?: string | null;
}): boolean {
  const sid = String(params.catalogServiceId || '').toLowerCase().trim();
  if (sid === 'vet_vaccination' || sid.includes('vaccination')) return true;
  const name = String(params.serviceName || '').toLowerCase();
  if (/\bvaccin|\bimmuniz|\bimmunis|booster\s+shot|\barv\b|rabies\s+vacc|dhpp|fvrcp|distemper\s+vacc/.test(name)) {
    return true;
  }
  const sub = String(params.subCategory || '').toLowerCase();
  if (/\bvaccin/.test(sub)) return true;
  return false;
}

/**
 * Catalogue slug / UUID ref for Admin GST lookup (before resolveCatalogCategoryUuidFromRef).
 * Priority: metadata override → service/catalog category id → categoryFallback → vet last-resort.
 * Service category (e.g. custom boarding on a vet vendor) wins over vendor-role inference.
 */
export async function resolveGstCatalogCategoryRefForBooking(params: {
  categoryIdFromCatalog?: string | null;
  subCategoryIdFromCatalog?: string | null;
  catalogServiceId?: string | null;
  serviceName?: string | null;
  subCategoryName?: string | null;
  scMetadata?: unknown;
  vsMetadata?: unknown;
  categoryFallback?: string | null;
  vendorRoleName?: string | null;
}): Promise<string | null> {
  for (const meta of [params.vsMetadata, params.scMetadata]) {
    const explicit = metadataGstCatalogRef(meta);
    if (explicit) return explicit;
  }

  const catRef = params.categoryIdFromCatalog ? String(params.categoryIdFromCatalog).trim() : '';
  if (catRef) return aliasGstCatalogCategoryRef(catRef);

  const fallback = params.categoryFallback ? String(params.categoryFallback).trim() : '';
  if (fallback && fallback.toLowerCase() !== 'pet_services') {
    return aliasGstCatalogCategoryRef(fallback);
  }

  // Last resort: vet vendors with no service/catalog category signal → veterinary (0%).
  if (isVetVendorRoleName(params.vendorRoleName)) {
    return 'veterinary';
  }

  return null;
}

export type ServiceBookingTaxResolveInput = {
  serviceId?: string | null;
  vendorId?: string | null;
  bookingId?: string | null;
  vendorRoleId?: string | null;
  amount: number;
  quantity?: number;
  category?: string | null;
  serviceStyle?: string | null;
  amountIsTaxInclusive?: boolean;
  itemId?: string;
};

export type ServiceBookingTaxResolveResult = {
  taxItem: TaxItem;
  category?: string;
};

type CatalogRow = {
  category_id?: string;
  category_name?: string;
  service_id?: string;
  service_name?: string;
  sub_category_id?: string;
  sub_category_name?: string;
  sc_metadata?: unknown;
  vs_metadata?: unknown;
  /** vendor_services.category text (custom services) */
  vs_category?: string;
  /** vendor_services.category_id UUID → service_categories.id */
  vs_category_id?: string;
};

const VS_CATALOG_SELECT = `SELECT sc.category_id, sc.category_name, sc.service_id, sc.service_name,
              sc.sub_category_id, sc.sub_category_name,
              sc.metadata AS sc_metadata, vs.metadata AS vs_metadata,
              vs.category AS vs_category, vs.category_id::text AS vs_category_id
       FROM vendor_services vs
       LEFT JOIN service_catalog sc ON sc.id = vs.service_id`;

async function loadCatalogContext(
  serviceId: string | null | undefined,
  vendorId: string | null | undefined,
  bookingId: string | null | undefined,
): Promise<CatalogRow | null> {
  if (serviceId && vendorId && isValidUUID(String(serviceId))) {
    const vendorSvcs = await query(
      `${VS_CATALOG_SELECT}
       WHERE vs.vendor_id = $2::uuid
         AND (vs.id = $1::uuid OR vs.service_id = $1::uuid OR sc.id = $1::uuid)
       LIMIT 1`,
      [serviceId, vendorId],
    ).catch(() => ({ rows: [] }));
    if (vendorSvcs.rows?.length > 0) return vendorSvcs.rows[0] as CatalogRow;
  } else if (serviceId && vendorId) {
    const vendorSvcs = await query(
      `${VS_CATALOG_SELECT}
       WHERE vs.id = $1::uuid
       LIMIT 1`,
      [serviceId],
    ).catch(() => ({ rows: [] }));
    if (vendorSvcs.rows?.length > 0) return vendorSvcs.rows[0] as CatalogRow;
  }

  if (serviceId) {
    const byCatalogId = await query(
      `SELECT category_id, category_name, service_id, service_name,
              sub_category_id, sub_category_name, metadata AS sc_metadata
       FROM service_catalog
       WHERE id = $1::uuid
       LIMIT 1`,
      [serviceId],
    ).catch(() => ({ rows: [] }));
    if (byCatalogId.rows?.length > 0) return byCatalogId.rows[0] as CatalogRow;

    const byServiceSlug = await query(
      `SELECT category_id, category_name, service_id, service_name,
              sub_category_id, sub_category_name, metadata AS sc_metadata
       FROM service_catalog
       WHERE service_id = $1 AND status = 'active'
       LIMIT 1`,
      [serviceId],
    ).catch(() => ({ rows: [] }));
    if (byServiceSlug.rows?.length > 0) return byServiceSlug.rows[0] as CatalogRow;
  }

  const bid =
    bookingId != null && String(bookingId).trim() !== '' && isValidUUID(String(bookingId).trim())
      ? String(bookingId).trim()
      : '';
  if (bid) {
    const bkg = await query(
      `SELECT sc.category_id, sc.category_name, sc.service_id, sc.service_name,
              sc.sub_category_id, sc.sub_category_name,
              sc.metadata AS sc_metadata, vs.metadata AS vs_metadata,
              vs.category AS vs_category, vs.category_id::text AS vs_category_id
       FROM bookings b
       JOIN vendor_services vs ON vs.id = b.service_id
       LEFT JOIN service_catalog sc ON sc.id = vs.service_id
       WHERE b.id = $1::uuid
       LIMIT 1`,
      [bid],
    ).catch(() => ({ rows: [] }));
    if (bkg.rows?.length > 0) return bkg.rows[0] as CatalogRow;
  }

  if (serviceId) {
    const services = await select('services', { id: serviceId }).catch(() => []);
    if (services.length > 0) {
      return {
        category_name: services[0].category,
        service_name: services[0].name,
      };
    }
  }

  return null;
}

export async function resolveServiceBookingTaxItem(
  input: ServiceBookingTaxResolveInput,
): Promise<ServiceBookingTaxResolveResult> {
  const serviceId = input.serviceId ? String(input.serviceId) : undefined;
  const quantity = input.quantity ?? 1;
  let category = input.category ? String(input.category) : undefined;
  let amountIsTaxInclusive = input.amountIsTaxInclusive === true;

  const ctx = await loadCatalogContext(serviceId, input.vendorId, input.bookingId);
  const vendorRole = await resolveVendorRole(input.vendorRoleId, input.vendorId);

  if (ctx) {
    // Prefer catalog name, then custom vendor_services.category, then catalog/vs category ids.
    if (!category) {
      category =
        ctx.category_name ||
        ctx.vs_category ||
        ctx.category_id ||
        ctx.vs_category_id ||
        undefined;
    }
    if (!amountIsTaxInclusive) {
      amountIsTaxInclusive =
        catalogPriceIncludesTaxMeta(ctx.sc_metadata) || catalogPriceIncludesTaxMeta(ctx.vs_metadata);
    }
  }

  // Catalog row wins when present; custom services use vs.category_id (no service_catalog join).
  const categoryIdFromCatalog =
    (ctx?.category_id && String(ctx.category_id).trim()) ||
    (ctx?.vs_category_id && String(ctx.vs_category_id).trim()) ||
    null;

  const categoryFallback =
    category ||
    (ctx?.vs_category ? String(ctx.vs_category).trim() : '') ||
    (ctx?.category_name ? String(ctx.category_name).trim() : '') ||
    null;

  const scCatRef = await resolveGstCatalogCategoryRefForBooking({
    categoryIdFromCatalog,
    subCategoryIdFromCatalog: ctx?.sub_category_id,
    catalogServiceId: ctx?.service_id,
    serviceName: ctx?.service_name,
    subCategoryName: ctx?.sub_category_name,
    scMetadata: ctx?.sc_metadata,
    vsMetadata: ctx?.vs_metadata,
    categoryFallback,
    vendorRoleName: vendorRole.roleName,
  });

  let catalogCategoryUuid: string | null = null;
  if (scCatRef) {
    catalogCategoryUuid = await resolveCatalogCategoryUuidFromRef(scCatRef);
  }
  if (
    !catalogCategoryUuid &&
    category &&
    String(category).trim().toLowerCase() !== 'pet_services'
  ) {
    catalogCategoryUuid = await resolveCatalogCategoryUuidFromRef(String(category).trim());
  }

  const serviceStyleNorm = String(input.serviceStyle || '').toLowerCase().trim();
  const serviceStyle =
    serviceStyleNorm === 'at_center' ||
    serviceStyleNorm === 'at_home' ||
    serviceStyleNorm === 'tele' ||
    serviceStyleNorm === 'hybrid'
      ? (serviceStyleNorm as TaxItem['serviceStyle'])
      : undefined;

  const taxItem: TaxItem = {
    id: input.itemId || serviceId || input.bookingId || 'service-booking',
    type: 'service',
    amount: input.amount,
    quantity,
    catalogCategoryId: catalogCategoryUuid ?? undefined,
    category,
    serviceStyle,
    roleId: input.vendorRoleId ?? vendorRole.roleId ?? undefined,
    amountIsTaxInclusive,
    gstApplicationScope: 'service_booking',
  };

  return { taxItem, category };
}
