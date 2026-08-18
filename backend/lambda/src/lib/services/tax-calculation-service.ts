/**
 * Tax Calculation Service
 * 
 * Centralized service for tax calculations across the platform
 * Supports HSN codes, multiple tax rules, CGST/SGST/IGST
 * AWS Serverless compatible (Lambda, RDS)
 */

import { query } from '../../database/rds-connection';
import {
  classifyGstPlaceOfSupply,
  isGstInterstateSupply,
  missingGstPlaceOfSupplyError,
  resolveGstStateKey,
} from '../gst-place-of-supply';
import {
  missingServiceGstConfigError,
  resolveGstRateForCatalogAndRole,
  type GstApplicationScope,
} from './gst-catalog-role-resolution';

/** DB NUMERIC / JSON may return rates as strings; normalize for math and API JSON. */
function coerceRate(value: unknown, fallback: number): number {
  if (value === null || value === undefined || value === '') return fallback;
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export interface TaxCalculationParams {
  items: TaxItem[];
  customerLocation?: {
    state: string;
    city?: string;
    pincode?: string;
  };
  vendorLocation?: {
    state: string;
    city?: string;
  };
  vendorId?: string;
  serviceType?: string;
  category?: string;
}

export interface TaxItem {
  id: string;
  type: 'product' | 'service';
  hsnCode?: string;       // HSN code string (e.g. '9996') — products / goods
  hsnCodeId?: string;     // HSN row UUID — products
  taxCategoryId?: string; // Legacy; ignored for services (GST from catalogue category + role)
  /** service_categories.id — Admin Catalogue category; with vendor role → GST Configuration */
  catalogCategoryId?: string;
  amount: number;
  quantity?: number;
  category?: string;
  serviceStyle?: 'at_center' | 'at_home' | 'tele' | 'hybrid';
  /** vendors.role_id (UUID) for GST role mapping */
  roleId?: string;
  /** When set with type service + catalogCategoryId, selects tax_categories.gst_application_scope row */
  gstApplicationScope?: 'service_booking' | 'meal_plan_food' | 'meal_plan_delivery';
  /** When true, `amount` × qty is tax-inclusive; engine derives taxable value as amount/(1+gst%/100). */
  amountIsTaxInclusive?: boolean;
}

export interface TaxBreakdown {
  itemId: string;
  itemType: 'product' | 'service';
  hsnCode?: string;
  baseAmount: number;
  quantity: number;
  gstRate: number;
  cgstRate: number;
  sgstRate: number;
  igstRate: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  totalTax: number;
  totalAmount: number;
  taxRuleId?: string;
  taxRuleName?: string;
}

export interface TaxCalculationResult {
  items: TaxBreakdown[];
  subtotal: number;
  totalTax: number;
  totalCGST: number;
  totalSGST: number;
  totalIGST: number;
  grandTotal: number;
  isInterstate: boolean;
  hsnSummary: Array<{
    hsnCode: string;
    description?: string;
    taxableAmount: number;
    gstRate: number;
    cgstAmount: number;
    sgstAmount: number;
    igstAmount: number;
    totalTax: number;
  }>;
}

export class TaxCalculationService {
  /**
   * Calculate tax: products via HSN / tax category; services via Admin catalogue category + vendor role.
   * Service bookings do not silently default to 18% when Admin GST configuration is missing.
   */
  async calculateTax(params: TaxCalculationParams): Promise<TaxCalculationResult> {
    const { items, customerLocation, vendorLocation, vendorId, serviceType, category } = params;

    // Inter-state only when both places of supply resolve to different states (normalized).
    // City-only + same city/state inference avoids false IGST when both sides are e.g. Bangalore/Karnataka.
    const customerStateKey = resolveGstStateKey(customerLocation?.state, customerLocation?.city);
    const vendorStateKey = resolveGstStateKey(vendorLocation?.state, vendorLocation?.city);
    const supplyKind = classifyGstPlaceOfSupply(customerStateKey, vendorStateKey);
    const hasServiceBooking = items.some(
      (item) =>
        item.type === 'service' &&
        (item.gstApplicationScope || 'service_booking') === 'service_booking',
    );
    if (hasServiceBooking && supplyKind === 'unknown') {
      throw missingGstPlaceOfSupplyError();
    }
    const isInterstate = hasServiceBooking
      ? supplyKind === 'inter_state'
      : isGstInterstateSupply(customerStateKey, vendorStateKey);
    if (process.env.LOG_GST === '1') {
      console.log('[GST]', {
        customerStateKey,
        vendorStateKey,
        supplyKind,
        isInterstate,
      });
    }

    const taxBreakdowns: TaxBreakdown[] = [];
    let subtotal = 0;

    // Calculate tax for each item
    for (const item of items) {
      const quantity = item.quantity || 1;
      const lineInputTotal = item.amount * quantity;

      // CGST/SGST split metadata only — statutory % comes from HSN / tax category / catalogue+role.
      const taxRule = this.getDefaultGstComponentRule();

      let hsnDetails: any = null;
      let taxCategoryDetails: any = null;
      let gstRate: number;

      if (item.type === 'service') {
        let scope: GstApplicationScope = 'service_booking';
        if (item.gstApplicationScope === 'meal_plan_food') scope = 'meal_plan_food';
        else if (item.gstApplicationScope === 'meal_plan_delivery') scope = 'meal_plan_delivery';

        if (scope !== 'service_booking') {
          if (!item.catalogCategoryId) {
            gstRate = 0;
          } else {
            const resolved = await resolveGstRateForCatalogAndRole(
              item.catalogCategoryId,
              item.roleId,
              scope,
            );
            gstRate = resolved.found ? resolved.rate : 0;
          }
        } else if (!item.catalogCategoryId) {
          throw missingServiceGstConfigError({
            catalogCategoryId: item.category || null,
            vendorRoleId: item.roleId || null,
          });
        } else {
          const resolved = await resolveGstRateForCatalogAndRole(
            item.catalogCategoryId,
            item.roleId,
            scope,
          );
          if (!resolved.found) {
            throw missingServiceGstConfigError({
              catalogCategoryId: resolved.catalogCategoryId || item.catalogCategoryId,
              vendorRoleId: resolved.vendorRoleId ?? item.roleId ?? null,
            });
          }
          gstRate = resolved.rate;
        }
      } else {
        let hsnCodeToRescope: string | undefined;
        if (item.hsnCodeId) {
          const byId = await this.getHSNCodeById(item.hsnCodeId);
          if (byId) {
            const rowCat = byId.category_id ?? byId.tax_category_id;
            const codeStr = byId.hsn_code || byId.code;
            if (
              item.taxCategoryId &&
              rowCat != null &&
              String(rowCat) !== String(item.taxCategoryId)
            ) {
              hsnCodeToRescope = codeStr;
              hsnDetails = null;
            } else if (item.taxCategoryId && rowCat == null && codeStr) {
              const scoped = await this.getHSNCodeByCode(String(codeStr), item.taxCategoryId);
              hsnDetails = scoped || byId;
            } else {
              hsnDetails = byId;
            }
          }
        }
        if (!hsnDetails && (item.hsnCode || hsnCodeToRescope)) {
          hsnDetails = await this.getHSNCodeByCode(
            String(item.hsnCode || hsnCodeToRescope),
            item.taxCategoryId
          );
        }
        if (!hsnDetails && item.taxCategoryId) {
          taxCategoryDetails = await this.getTaxCategoryDetails(item.taxCategoryId);
        }

        if (hsnDetails) {
          gstRate = await this.effectiveGstRateFromHsnRow(hsnDetails);
        } else {
          gstRate = coerceRate(
            taxCategoryDetails?.tax_rate ?? taxCategoryDetails?.default_gst_rate,
            18
          );
        }
      }

      // Intra-state split from rule, but rule CGST+SGST must sum to statutory gstRate (HSN/category).
      // Otherwise a 9%+9% rule with gstRate 10% would show wrong components and mismatch totalTax.
      let cgstRate = coerceRate(taxRule.cgst_percentage || gstRate / 2, gstRate / 2);
      let sgstRate = coerceRate(taxRule.sgst_percentage || gstRate / 2, gstRate / 2);
      const splitSum = cgstRate + sgstRate;
      if (Math.abs(splitSum - gstRate) > 0.015) {
        cgstRate = Math.round((gstRate / 2) * 100) / 100;
        sgstRate = Math.round((gstRate - cgstRate) * 100) / 100;
      }

      const igstRate = gstRate;

      const taxableAmount = item.amountIsTaxInclusive
        ? lineInputTotal / (1 + gstRate / 100)
        : lineInputTotal;
      subtotal += taxableAmount;

      const taxAmount = (taxableAmount * gstRate) / 100;
      const cgstAmount = isInterstate ? 0 : (taxableAmount * cgstRate) / 100;
      const sgstAmount = isInterstate ? 0 : (taxableAmount * sgstRate) / 100;
      const igstAmount = isInterstate ? taxAmount : 0;

      taxBreakdowns.push({
        itemId: item.id,
        itemType: item.type,
        hsnCode: item.hsnCode || hsnDetails?.hsn_code || hsnDetails?.code,
        baseAmount: taxableAmount,
        quantity,
        gstRate,
        cgstRate,
        sgstRate,
        igstRate,
        cgstAmount,
        sgstAmount,
        igstAmount,
        totalTax: taxAmount,
        totalAmount: taxableAmount + taxAmount,
        taxRuleName: taxRule.rule_name,
      });
    }

    // Calculate totals
    const totalTax = taxBreakdowns.reduce((sum, item) => sum + item.totalTax, 0);
    const totalCGST = taxBreakdowns.reduce((sum, item) => sum + item.cgstAmount, 0);
    const totalSGST = taxBreakdowns.reduce((sum, item) => sum + item.sgstAmount, 0);
    const totalIGST = taxBreakdowns.reduce((sum, item) => sum + item.igstAmount, 0);
    const grandTotal = subtotal + totalTax;

    // Generate HSN summary
    const hsnSummary = this.generateHSNSummary(taxBreakdowns);

    return {
      items: taxBreakdowns,
      subtotal,
      totalTax,
      totalCGST,
      totalSGST,
      totalIGST,
      grandTotal,
      isInterstate,
      hsnSummary,
    };
  }

  /**
   * Default component labels for CGST/SGST/IGST breakdown. Per-line statutory % always comes from
   * HSN → tax category → (services) Admin catalogue category + role — not from gst_rules.
   */
  private getDefaultGstComponentRule(): {
    rule_name: string;
    gst_rate: number;
    cgst_percentage: number;
    sgst_percentage: number;
    igst_percentage: number;
  } {
    return {
      rule_name: 'Default GST Rule',
      gst_rate: 18,
      cgst_percentage: 9,
      sgst_percentage: 9,
      igst_percentage: 18,
    };
  }

  /**
   * Product HSN: statutory % from linked tax_categories row when category_id is set; else legacy hsn_codes.gst_rate.
   */
  private async effectiveGstRateFromHsnRow(hsnRow: Record<string, unknown>): Promise<number> {
    const linkCat = hsnRow.category_id ?? hsnRow.tax_category_id;
    if (linkCat != null && String(linkCat).trim() !== '') {
      const tc = await this.getTaxCategoryDetails(String(linkCat));
      if (tc) {
        return coerceRate(tc.tax_rate ?? tc.default_gst_rate ?? tc.gst_rate, 18);
      }
    }
    return coerceRate(hsnRow.gst_rate, 18);
  }

  /**
   * Get HSN code by UUID (from service_catalog.hsn_code_id)
   */
  private async getHSNCodeById(id: string): Promise<any> {
    const result = await query(
      `SELECT * FROM hsn_codes WHERE id = $1 AND is_active = true LIMIT 1`,
      [id]
    );
    const rows = Array.isArray(result) ? result : (result as any).rows || [];
    return rows.length > 0 ? rows[0] : null;
  }

  /**
   * Get HSN row by code string. If multiple rows share the same code, prefer `category_id`
   * matching `taxCategoryId` when provided; otherwise newest row by `created_at`, then `id`.
   * Supports legacy `code` column when `hsn_code` is absent.
   */
  private async getHSNCodeByCode(hsnCode: string, taxCategoryId?: string): Promise<any> {
    const run = async (sql: string, params: unknown[]) => {
      const result = await query(sql, params);
      return Array.isArray(result) ? result : (result as any).rows || [];
    };

    /** Deterministic tie-break when multiple rows share the same code (avoids relying on created_at existing). */
    const orderClause = 'ORDER BY id DESC';

    if (taxCategoryId) {
      try {
        const scoped = await run(
          `SELECT * FROM hsn_codes WHERE hsn_code = $1 AND is_active = true AND category_id = $2::uuid LIMIT 1`,
          [hsnCode, taxCategoryId]
        );
        if (scoped.length > 0) return scoped[0];
      } catch {
        /* category_id column missing */
      }
    }

    const byHsn = await run(
      `SELECT * FROM hsn_codes WHERE hsn_code = $1 AND is_active = true ${orderClause} LIMIT 1`,
      [hsnCode]
    );
    if (byHsn.length > 0) return byHsn[0];

    try {
      if (taxCategoryId) {
        try {
          const scoped = await run(
            `SELECT * FROM hsn_codes WHERE code = $1 AND is_active = true AND category_id = $2::uuid LIMIT 1`,
            [hsnCode, taxCategoryId]
          );
          if (scoped.length > 0) return scoped[0];
        } catch {
          /* ignore */
        }
      }
      const byCode = await run(
        `SELECT * FROM hsn_codes WHERE code = $1 AND is_active = true ${orderClause} LIMIT 1`,
        [hsnCode]
      );
      return byCode.length > 0 ? byCode[0] : null;
    } catch {
      return null;
    }
  }

  /**
   * Get tax category details (tax_rate or default_gst_rate)
   */
  private async getTaxCategoryDetails(id: string): Promise<any> {
    const result = await query(
      `SELECT * FROM tax_categories WHERE id = $1 AND is_active = true LIMIT 1`,
      [id]
    );
    const rows = Array.isArray(result) ? result : (result as any).rows || [];
    return rows.length > 0 ? rows[0] : null;
  }

  /**
   * Generate HSN code summary for invoice
   */
  private generateHSNSummary(breakdowns: TaxBreakdown[]): Array<{
    hsnCode: string;
    description?: string;
    taxableAmount: number;
    gstRate: number;
    cgstAmount: number;
    sgstAmount: number;
    igstAmount: number;
    totalTax: number;
  }> {
    const hsnMap = new Map<string, {
      hsnCode: string;
      taxableAmount: number;
      gstRate: number;
      cgstAmount: number;
      sgstAmount: number;
      igstAmount: number;
      totalTax: number;
    }>();

    for (const item of breakdowns) {
      const hsnCode = item.hsnCode || 'N/A';
      const existing = hsnMap.get(hsnCode);

      if (existing) {
        existing.taxableAmount += item.baseAmount;
        existing.cgstAmount += item.cgstAmount;
        existing.sgstAmount += item.sgstAmount;
        existing.igstAmount += item.igstAmount;
        existing.totalTax += item.totalTax;
      } else {
        hsnMap.set(hsnCode, {
          hsnCode,
          taxableAmount: item.baseAmount,
          gstRate: item.gstRate,
          cgstAmount: item.cgstAmount,
          sgstAmount: item.sgstAmount,
          igstAmount: item.igstAmount,
          totalTax: item.totalTax,
        });
      }
    }

    return Array.from(hsnMap.values());
  }
}

export const taxCalculationService = new TaxCalculationService();

