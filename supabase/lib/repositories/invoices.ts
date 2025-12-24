/**
 * ============================================================================
 * INVOICES REPOSITORY
 * ============================================================================
 * 
 * Repository for invoice data access.
 * 
 * RULES:
 * ❌ NO KV imports allowed
 * ✅ All operations use SQL only
 * 
 * Date: 2024-12-23
 * Migration: Phase 2, Task 2.1 - GST Invoice Generation
 * ============================================================================
 */

import { getDbClient, selectQuery, insertQuery, updateQuery } from "../db.ts";
import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";

export interface Invoice {
  id: string;
  invoice_number: string;
  order_id: string | null;
  customer_id: string;
  vendor_id: string | null;
  invoice_date: string;
  due_date: string | null;
  subtotal: number;
  tax_amount: number;
  cgst_amount: number | null;
  sgst_amount: number | null;
  igst_amount: number | null;
  total_amount: number;
  hsn_codes: any[];
  tax_breakdown: any;
  invoice_data: any;
  pdf_url: string | null;
  pdf_generated_at: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface CreateInvoiceInput {
  invoice_number: string;
  order_id?: string | null;
  customer_id: string;
  vendor_id?: string | null;
  invoice_date: string;
  due_date?: string | null;
  subtotal: number;
  tax_amount: number;
  cgst_amount?: number | null;
  sgst_amount?: number | null;
  igst_amount?: number | null;
  total_amount: number;
  hsn_codes?: any[];
  tax_breakdown?: any;
  invoice_data: any;
  pdf_url?: string | null;
  status?: string;
}

export interface UpdateInvoiceInput {
  pdf_url?: string | null;
  pdf_generated_at?: string | null;
  status?: string;
  due_date?: string | null;
}

export class InvoicesRepository {
  private client: SupabaseClient;

  constructor(client?: SupabaseClient) {
    this.client = client || getDbClient();
  }

  async findById(invoiceId: string): Promise<Invoice | null> {
    const results = await selectQuery<Invoice>("invoices", { id: invoiceId }, { limit: 1 });
    return results[0] || null;
  }

  async findByInvoiceNumber(invoiceNumber: string): Promise<Invoice | null> {
    const results = await selectQuery<Invoice>("invoices", { invoice_number: invoiceNumber }, { limit: 1 });
    return results[0] || null;
  }

  async findByOrder(orderId: string): Promise<Invoice | null> {
    const results = await selectQuery<Invoice>("invoices", { order_id: orderId }, { limit: 1 });
    return results[0] || null;
  }

  async findByCustomer(customerId: string, options?: { limit?: number; offset?: number }): Promise<Invoice[]> {
    return selectQuery<Invoice>("invoices", { customer_id: customerId }, {
      limit: options?.limit,
      offset: options?.offset,
      orderBy: "invoice_date",
      orderDirection: "desc",
    });
  }

  async findByVendor(vendorId: string, options?: { limit?: number; offset?: number }): Promise<Invoice[]> {
    return selectQuery<Invoice>("invoices", { vendor_id: vendorId }, {
      limit: options?.limit,
      offset: options?.offset,
      orderBy: "invoice_date",
      orderDirection: "desc",
    });
  }

  async create(input: CreateInvoiceInput): Promise<Invoice> {
    const results = await insertQuery<Invoice>("invoices", {
      invoice_number: input.invoice_number,
      order_id: input.order_id || null,
      customer_id: input.customer_id,
      vendor_id: input.vendor_id || null,
      invoice_date: input.invoice_date,
      due_date: input.due_date || null,
      subtotal: input.subtotal,
      tax_amount: input.tax_amount,
      cgst_amount: input.cgst_amount || null,
      sgst_amount: input.sgst_amount || null,
      igst_amount: input.igst_amount || null,
      total_amount: input.total_amount,
      hsn_codes: input.hsn_codes || [],
      tax_breakdown: input.tax_breakdown || {},
      invoice_data: input.invoice_data,
      pdf_url: input.pdf_url || null,
      status: input.status || 'generated',
    });
    
    if (!results[0]) {
      throw new Error("Failed to create invoice");
    }
    
    return results[0];
  }

  async update(invoiceId: string, input: UpdateInvoiceInput): Promise<Invoice> {
    const updateData: any = {
      updated_at: new Date().toISOString(),
    };
    
    if (input.pdf_url !== undefined) updateData.pdf_url = input.pdf_url;
    if (input.pdf_generated_at !== undefined) updateData.pdf_generated_at = input.pdf_generated_at;
    if (input.status !== undefined) updateData.status = input.status;
    if (input.due_date !== undefined) updateData.due_date = input.due_date;
    
    const results = await updateQuery<Invoice>("invoices", { id: invoiceId }, updateData);
    
    if (!results[0]) {
      throw new Error(`Invoice not found: ${invoiceId}`);
    }
    
    return results[0];
  }

  async generateInvoiceNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const { data: lastInvoice } = await this.client
      .from('invoices')
      .select('invoice_number')
      .like('invoice_number', `INV-${year}-%`)
      .order('invoice_number', { ascending: false })
      .limit(1)
      .maybeSingle();

    let sequence = 1;
    if (lastInvoice?.invoice_number) {
      const match = lastInvoice.invoice_number.match(/INV-\d{4}-(\d+)/);
      if (match) {
        sequence = parseInt(match[1]) + 1;
      }
    }

    return `INV-${year}-${sequence.toString().padStart(6, '0')}`;
  }
}

let repositoryInstance: InvoicesRepository | null = null;

export function getInvoicesRepository(): InvoicesRepository {
  if (!repositoryInstance) {
    repositoryInstance = new InvoicesRepository();
  }
  return repositoryInstance;
}

