/**
 * Resolve service-booking GST inputs for taxCalculationService (catalog category + vendor role).
 * Shared by POST /tax/calculate, payments-enhanced, and /customer/pricing/quote.
 *
 * Vaccination services use a separate GST lane: they do not inherit the veterinary 0% catalogue
 * row unless metadata or sub_category_id points at a dedicated admin GST config.
 */

import { query, select } from '../database/rds-connection';
import { isValidUUID } from '../types/entities';
import { resolveCatalogCategoryUuidFromRef } from '../lib/services/gst-catalog-role-resolution';
import type { TaxItem } from '../lib/services/tax-calculation-service';

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

/** Vaccination bookings keep separate GST (not the general veterinary 0% catalogue row). */
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
}): Promise<string | null> {
  for (const meta of [params.vsMetadata, params.scMetadata]) {
    const explicit = metadataGstCatalogRef(meta);
    if (explicit) return explicit;
  }

  if (
    isVaccinationService({
      catalogServiceId: params.catalogServiceId,
      serviceName: params.serviceName,
      subCategory: params.subCategoryName ?? params.subCategoryIdFromCatalog,
    })
  ) {
    const subRef = params.subCategoryIdFromCatalog ? String(params.subCategoryIdFromCatalog).trim() : '';
    if (subRef) return subRef;
    return null;
  }

  const catRef = params.categoryIdFromCatalog ? String(params.categoryIdFromCatalog).trim() : '';
  if (catRef) return catRef;

  const fallback = params.categoryFallback ? String(params.categoryFallback).trim() : '';
  return fallback || null;
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
};

async function loadCatalogContext(
  serviceId: string | null | undefined,
  vendorId: string | null | undefined,
  bookingId: string | null | undefined,
): Promise<CatalogRow | null> {
  if (serviceId && vendorId) {
    const vendorSvcs = await query(
      `SELECT sc.category_id, sc.category_name, sc.service_id, sc.service_name,
              sc.sub_category_id, sc.sub_category_name,
              sc.metadata AS sc_metadata, vs.metadata AS vs_metadata
       FROM vendor_services vs
       LEFT JOIN service_catalog sc ON sc.id = vs.service_id
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
              sc.metadata AS sc_metadata, vs.metadata AS vs_metadata
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

  if (ctx) {
    if (!category) category = ctx.category_name || ctx.category_id;
    if (!amountIsTaxInclusive) {
      amountIsTaxInclusive =
        catalogPriceIncludesTaxMeta(ctx.sc_metadata) || catalogPriceIncludesTaxMeta(ctx.vs_metadata);
    }
  }

  const scCatRef = await resolveGstCatalogCategoryRefForBooking({
    categoryIdFromCatalog: ctx?.category_id,
    subCategoryIdFromCatalog: ctx?.sub_category_id,
    catalogServiceId: ctx?.service_id,
    serviceName: ctx?.service_name,
    subCategoryName: ctx?.sub_category_name,
    scMetadata: ctx?.sc_metadata,
    vsMetadata: ctx?.vs_metadata,
    categoryFallback: category,
  });

  let catalogCategoryUuid: string | null = null;
  if (scCatRef) {
    catalogCategoryUuid = await resolveCatalogCategoryUuidFromRef(scCatRef);
  }
  if (!catalogCategoryUuid && category) {
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
    roleId: input.vendorRoleId ?? undefined,
    amountIsTaxInclusive,
    gstApplicationScope: 'service_booking',
  };

  return { taxItem, category };
}
