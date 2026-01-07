/**
 * useTaxCalculation Hook
 * 
 * React hook for calculating taxes
 * Used in payment pages and invoice generation
 */

import { useState, useCallback } from 'react';
import { apiClient } from '../lib/api-client';

export interface TaxCalculationItem {
  id: string;
  type: 'product' | 'service';
  hsnCode?: string;
  amount: number;
  quantity?: number;
  category?: string;
  serviceStyle?: 'at_center' | 'at_home' | 'tele' | 'hybrid';
  roleId?: string;
}

export interface TaxCalculationParams {
  items: TaxCalculationItem[];
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

export function useTaxCalculation() {
  const [calculating, setCalculating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const calculateTax = useCallback(async (params: TaxCalculationParams): Promise<TaxCalculationResult> => {
    try {
      setCalculating(true);
      setError(null);

      const response = await apiClient.post<{ taxCalculation: TaxCalculationResult }>(
        '/admin/tax/calculate',
        params
      );

      return response.taxCalculation;
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to calculate tax';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setCalculating(false);
    }
  }, []);

  return {
    calculateTax,
    calculating,
    error,
  };
}

