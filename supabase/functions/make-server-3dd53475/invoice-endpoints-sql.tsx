/**
 * ============================================================================
 * INVOICE ENDPOINTS - SQL-ONLY VERSION
 * ============================================================================
 * 
 * GST Invoice Generation System
 * 
 * Features:
 * - Auto-generate invoices on order completion
 * - GST breakdown (CGST, SGST, IGST)
 * - HSN code tracking
 * - PDF generation support
 * 
 * RULES:
 * ❌ NO KV imports allowed
 * ✅ All operations use SQL only
 * 
 * Date: 2024-12-23
 * Migration: Phase 2, Task 2.1 - GST Invoice Generation
 * ============================================================================
 */

import { Hono } from "npm:hono";
import { sendSuccess, sendError } from "./response-utils.ts";
import { getInvoicesRepository } from "../../lib/repositories/invoices.ts";
import { getOrdersRepository } from "../../lib/repositories/orders.ts";
import { generateInvoiceForOrder } from "../../lib/services/invoice-generator.ts";
import { getVendorsRepository } from "../../lib/repositories/vendors.ts";

export function invoiceEndpointsSQL(app: Hono) {
  const BASE_PATH = "/make-server-3dd53475";
  const invoicesRepo = getInvoicesRepository();
  const ordersRepo = getOrdersRepository();
  const vendorsRepo = getVendorsRepository();

  // Helper: Resolve vendor ID
  async function resolveVendorId(identifier: string): Promise<string | null> {
    return await vendorsRepo.resolveVendorId(identifier);
  }

  /**
   * POST /orders/:orderId/generate-invoice
   * Generate invoice for an order
   */
  app.post(`${BASE_PATH}/orders/:orderId/generate-invoice`, async (c) => {
    try {
      const { orderId } = c.req.param();

      // Check if invoice already exists
      const existingInvoice = await invoicesRepo.findByOrder(orderId);
      if (existingInvoice) {
        return sendSuccess(c, { 
          invoice: existingInvoice,
          message: 'Invoice already exists for this order'
        });
      }

      // Generate invoice
      const invoiceData = await generateInvoiceForOrder(orderId);

      // Get saved invoice
      const invoice = await invoicesRepo.findByInvoiceNumber(invoiceData.invoice_number);

      console.log(`✅ [INVOICE-SQL] Generated invoice ${invoiceData.invoice_number} for order ${orderId}`);

      return sendSuccess(c, { 
        invoice: invoice || invoiceData,
        invoiceData 
      }, 'Invoice generated successfully');
    } catch (error) {
      console.error('❌ [INVOICE-SQL] Error generating invoice:', error);
      return sendError(c, `Failed to generate invoice: ${String(error)}`, 500);
    }
  });

  /**
   * GET /invoices/:invoiceId
   * Get invoice by ID
   */
  app.get(`${BASE_PATH}/invoices/:invoiceId`, async (c) => {
    try {
      const { invoiceId } = c.req.param();
      const invoice = await invoicesRepo.findById(invoiceId);

      if (!invoice) {
        return sendError(c, 'Invoice not found', 404);
      }

      return sendSuccess(c, { invoice });
    } catch (error) {
      console.error('❌ [INVOICE-SQL] Error fetching invoice:', error);
      return sendError(c, `Failed to fetch invoice: ${String(error)}`, 500);
    }
  });

  /**
   * GET /invoices/order/:orderId
   * Get invoice by order ID
   */
  app.get(`${BASE_PATH}/invoices/order/:orderId`, async (c) => {
    try {
      const { orderId } = c.req.param();
      const invoice = await invoicesRepo.findByOrder(orderId);

      if (!invoice) {
        return sendError(c, 'Invoice not found for this order', 404);
      }

      return sendSuccess(c, { invoice });
    } catch (error) {
      console.error('❌ [INVOICE-SQL] Error fetching invoice by order:', error);
      return sendError(c, `Failed to fetch invoice: ${String(error)}`, 500);
    }
  });

  /**
   * GET /invoices/vendor/:vendorId
   * Get all invoices for a vendor
   */
  app.get(`${BASE_PATH}/invoices/vendor/:vendorId`, async (c) => {
    try {
      const { vendorId: paramVendorId } = c.req.param();
      const limit = parseInt(c.req.query('limit') || '50');
      const offset = parseInt(c.req.query('offset') || '0');

      // ✅ CRITICAL FIX: Resolve vendorId to UUID
      const resolvedVendorId = await resolveVendorId(paramVendorId);
      
      if (!resolvedVendorId) {
        return sendError(c, 'Vendor not found or invalid ID format', 404);
      }

      const invoices = await invoicesRepo.findByVendor(resolvedVendorId, { limit, offset });

      console.log(`✅ [INVOICE-SQL] Found ${invoices.length} invoices for vendor ${paramVendorId}`);

      return sendSuccess(c, { invoices });
    } catch (error) {
      console.error('❌ [INVOICE-SQL] Error fetching vendor invoices:', error);
      return sendError(c, `Failed to fetch invoices: ${String(error)}`, 500);
    }
  });

  /**
   * GET /invoices/customer/:customerId
   * Get all invoices for a customer
   */
  app.get(`${BASE_PATH}/invoices/customer/:customerId`, async (c) => {
    try {
      const { customerId } = c.req.param();
      const limit = parseInt(c.req.query('limit') || '50');
      const offset = parseInt(c.req.query('offset') || '0');

      const invoices = await invoicesRepo.findByCustomer(customerId, { limit, offset });

      console.log(`✅ [INVOICE-SQL] Found ${invoices.length} invoices for customer ${customerId}`);

      return sendSuccess(c, { invoices });
    } catch (error) {
      console.error('❌ [INVOICE-SQL] Error fetching customer invoices:', error);
      return sendError(c, `Failed to fetch invoices: ${String(error)}`, 500);
    }
  });

  /**
   * GET /invoices/:invoiceId/pdf
   * Get invoice PDF URL (or generate if not exists)
   */
  app.get(`${BASE_PATH}/invoices/:invoiceId/pdf`, async (c) => {
    try {
      const { invoiceId } = c.req.param();
      const invoice = await invoicesRepo.findById(invoiceId);

      if (!invoice) {
        return sendError(c, 'Invoice not found', 404);
      }

      if (invoice.pdf_url) {
        return sendSuccess(c, { 
          pdf_url: invoice.pdf_url,
          pdf_generated_at: invoice.pdf_generated_at
        });
      }

      // TODO: Generate PDF (can use a PDF generation library)
      // For now, return invoice data for frontend to generate PDF
      return sendSuccess(c, { 
        invoice: invoice,
        message: 'PDF generation not yet implemented. Use invoice data to generate PDF on frontend.'
      });
    } catch (error) {
      console.error('❌ [INVOICE-SQL] Error fetching invoice PDF:', error);
      return sendError(c, `Failed to fetch invoice PDF: ${String(error)}`, 500);
    }
  });

  /**
   * PUT /invoices/:invoiceId/pdf
   * Update invoice with PDF URL (after PDF generation)
   */
  app.put(`${BASE_PATH}/invoices/:invoiceId/pdf`, async (c) => {
    try {
      const { invoiceId } = c.req.param();
      const { pdf_url } = await c.req.json();

      if (!pdf_url) {
        return sendError(c, 'PDF URL is required', 400);
      }

      const invoice = await invoicesRepo.update(invoiceId, {
        pdf_url,
        pdf_generated_at: new Date().toISOString(),
      });

      console.log(`✅ [INVOICE-SQL] Updated invoice ${invoiceId} with PDF URL`);

      return sendSuccess(c, { invoice }, 'Invoice PDF URL updated');
    } catch (error) {
      console.error('❌ [INVOICE-SQL] Error updating invoice PDF:', error);
      return sendError(c, `Failed to update invoice PDF: ${String(error)}`, 500);
    }
  });

  console.log('✅ [INVOICE-SQL] Invoice endpoints registered (SQL-only)');
}

