/**
 * Tax Calculation Service
 * 
 * Centralized service for tax calculations across the platform
 * Supports HSN codes, multiple tax rules, CGST/SGST/IGST
 * AWS Serverless compatible (Lambda, RDS)
 */

import { query } from '../../database/rds-connection';

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
  hsnCode?: string;
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

    // Determine if interstate transaction
    const isInterstate = customerLocation?.state && vendorLocation?.state 
      ? customerLocation.state !== vendorLocation.state 
      : true; // Default to interstate if locations not provided

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

      // Get HSN code details if available
      let hsnDetails = null;
      if (item.hsnCode) {
        hsnDetails = await this.getHSNCodeDetails(item.hsnCode);
      }

      // Use HSN code rate if available, otherwise use tax rule rate
      const gstRate = hsnDetails?.gst_rate || taxRule.gst_rate || 18;
      const cgstRate = taxRule.cgst_percentage || (gstRate / 2);
      const sgstRate = taxRule.sgst_percentage || (gstRate / 2);
      const igstRate = taxRule.igst_percentage || gstRate;

      // Calculate tax amounts
      const taxRate = isInterstate ? igstRate : gstRate;
      const taxAmount = (itemAmount * taxRate) / 100;
      const cgstAmount = isInterstate ? 0 : (itemAmount * cgstRate) / 100;
      const sgstAmount = isInterstate ? 0 : (itemAmount * sgstRate) / 100;
      const igstAmount = isInterstate ? taxAmount : 0;

      taxBreakdowns.push({
        itemId: item.id,
        itemType: item.type,
        hsnCode: item.hsnCode || hsnDetails?.hsn_code,
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

    // Filter by category
    if (category || item.category) {
      queryStr += ` AND (category IS NULL OR category = $${paramIndex})`;
      queryParams.push(category || item.category);
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
   * Get HSN code details
   */
  private async getHSNCodeDetails(hsnCode: string): Promise<any> {
    const queryStr = `
      SELECT * FROM hsn_codes
      WHERE hsn_code = $1 AND is_active = true
      LIMIT 1
    `;
    const result = await query(queryStr, [hsnCode]);
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

