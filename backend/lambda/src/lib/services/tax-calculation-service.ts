/**
 * Tax Calculation Service
 * 
 * Centralized service for tax calculations across the platform
 * Supports HSN codes, multiple tax rules, CGST/SGST/IGST
 * AWS Serverless compatible (Lambda, RDS)
 */

import { query } from '../../database/rds-connection';
import { resolveGstStateKey } from '../gst-place-of-supply';

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
  hsnCode?: string;       // HSN code string (e.g. '9996') - from GST Configuration
  hsnCodeId?: string;     // HSN code UUID - when linked via service_catalog.hsn_code_id
  taxCategoryId?: string; // Tax category UUID - when linked via service_catalog.tax_category_id
  amount: number;
  quantity?: number;
  category?: string;
  serviceStyle?: 'at_center' | 'at_home' | 'tele' | 'hybrid';
  roleId?: string;
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
   * Calculate tax for items based on HSN codes and tax rules
   */
  async calculateTax(params: TaxCalculationParams): Promise<TaxCalculationResult> {
    const { items, customerLocation, vendorLocation, vendorId, serviceType, category } = params;

    // Inter-state only when both places of supply resolve to different states (normalized).
    // City-only + same city/state inference avoids false IGST when both sides are e.g. Bangalore/Karnataka.
    const customerStateKey = resolveGstStateKey(customerLocation?.state, customerLocation?.city);
    const vendorStateKey = resolveGstStateKey(vendorLocation?.state, vendorLocation?.city);
    const isInterstate =
      customerStateKey && vendorStateKey ? customerStateKey !== vendorStateKey : true;

    const taxBreakdowns: TaxBreakdown[] = [];
    let subtotal = 0;

    // Calculate tax for each item
    for (const item of items) {
      const itemAmount = item.amount * (item.quantity || 1);
      subtotal += itemAmount;

      // Get applicable tax rule for this item
      const taxRule = await this.getApplicableTaxRule({
        item,
        customerLocation,
        vendorLocation,
        vendorId,
        serviceType: serviceType || item.category,
        category: category || item.category,
      });

      // Resolution chain: HSN (by ID, must match tax category when both set) → HSN (by code + category) → Tax Category → Tax Rule → 18%
      let hsnDetails = null;
      let taxCategoryDetails = null;
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
            // catalog FK can point at another category's row for the same SAC (e.g. 998351 boarding 18% vs vet 16%)
            hsnCodeToRescope = codeStr;
            hsnDetails = null;
          } else if (item.taxCategoryId && rowCat == null && codeStr) {
            // legacy rows without category_id: prefer HSN row scoped to service tax category when duplicates exist
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

      const gstRate = coerceRate(
        hsnDetails?.gst_rate ??
          taxCategoryDetails?.tax_rate ??
          taxCategoryDetails?.default_gst_rate ??
          taxRule.gst_rate ??
          18,
        18
      );

      // Intra-state split from rule, but rule CGST+SGST must sum to statutory gstRate (HSN/category).
      // Otherwise a 9%+9% rule with gstRate 10% would show wrong components and mismatch totalTax.
      let cgstRate = coerceRate(taxRule.cgst_percentage || gstRate / 2, gstRate / 2);
      let sgstRate = coerceRate(taxRule.sgst_percentage || gstRate / 2, gstRate / 2);
      const splitSum = cgstRate + sgstRate;
      if (Math.abs(splitSum - gstRate) > 0.015) {
        cgstRate = Math.round((gstRate / 2) * 100) / 100;
        sgstRate = Math.round((gstRate - cgstRate) * 100) / 100;
      }

      // Interstate: IGST must use the same composite % as HSN/tax category — do not let
      // gst_rules.igst_percentage override (e.g. 18% rule vs 10% catalogue).
      const igstRate = gstRate;

      const taxAmount = (itemAmount * gstRate) / 100;
      const cgstAmount = isInterstate ? 0 : (itemAmount * cgstRate) / 100;
      const sgstAmount = isInterstate ? 0 : (itemAmount * sgstRate) / 100;
      const igstAmount = isInterstate ? taxAmount : 0;

      taxBreakdowns.push({
        itemId: item.id,
        itemType: item.type,
        hsnCode: item.hsnCode || hsnDetails?.hsn_code || hsnDetails?.code,
        baseAmount: itemAmount,
        quantity: item.quantity || 1,
        gstRate,
        cgstRate,
        sgstRate,
        igstRate,
        cgstAmount,
        sgstAmount,
        igstAmount,
        totalTax: taxAmount,
        totalAmount: itemAmount + taxAmount,
        taxRuleId: taxRule.id,
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
   * Get applicable tax rule for an item
   */
  private async getApplicableTaxRule(params: {
    item: TaxItem;
    customerLocation?: { state: string };
    vendorLocation?: { state: string };
    vendorId?: string;
    serviceType?: string;
    category?: string;
  }): Promise<any> {
    const { item, customerLocation, vendorLocation, vendorId, serviceType, category } = params;

    let queryStr = `
      SELECT * FROM gst_rules
      WHERE enabled = true
    `;
    const queryParams: any[] = [];
    let paramIndex = 1;

    // Filter by role if provided
    if (item.roleId) {
      queryStr += ` AND (role_id IS NULL OR role_id = $${paramIndex})`;
      queryParams.push(item.roleId);
      paramIndex++;
    }

    // Filter by service style
    if (item.serviceStyle) {
      queryStr += ` AND (service_style IS NULL OR service_style = $${paramIndex})`;
      queryParams.push(item.serviceStyle);
      paramIndex++;
    }

    // Filter by category (legacy TEXT)
    if (category || item.category) {
      queryStr += ` AND (category IS NULL OR category = $${paramIndex})`;
      queryParams.push(category || item.category);
      paramIndex++;
    }

    // Filter by tax_category_id (FK - selection not enter)
    if (item.taxCategoryId) {
      queryStr += ` AND (tax_category_id IS NULL OR tax_category_id = $${paramIndex})`;
      queryParams.push(item.taxCategoryId);
      paramIndex++;
    }

    // Filter by customer state
    if (customerLocation?.state) {
      queryStr += ` AND (customer_state IS NULL OR customer_state = $${paramIndex})`;
      queryParams.push(customerLocation.state);
      paramIndex++;
    }

    // Filter by vendor state
    if (vendorLocation?.state) {
      queryStr += ` AND (vendor_state IS NULL OR vendor_state = $${paramIndex})`;
      queryParams.push(vendorLocation.state);
      paramIndex++;
    }

    // Filter by amount range if applicable
    if (item.amount) {
      queryStr += ` AND (min_amount IS NULL OR min_amount <= $${paramIndex})`;
      queryParams.push(item.amount);
      paramIndex++;
      queryStr += ` AND (max_amount IS NULL OR max_amount >= $${paramIndex})`;
      queryParams.push(item.amount);
      paramIndex++;
    }

    // Order by priority and get the most specific rule
    queryStr += ` ORDER BY priority DESC LIMIT 1`;

    const result = await query(queryStr, queryParams);
    const rows = Array.isArray(result) ? result : (result as any).rows || [];

    if (rows.length > 0) {
      return rows[0];
    }

    // Return default tax rule
    return {
      id: null,
      rule_name: 'Default GST Rule',
      gst_rate: 18,
      cgst_percentage: 9,
      sgst_percentage: 9,
      igst_percentage: 18,
    };
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

