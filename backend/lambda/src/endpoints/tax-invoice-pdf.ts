/**
 * ============================================================================
 * TAX INVOICE PDF GENERATION
 * ============================================================================
 * 
 * Features:
 * - Generate GST-compliant tax invoices
 * - PDF download for orders
 * - Batch invoice generation
 * - GSTR-1 export data
 * 
 * Date: 2026-01-20
 * ============================================================================
 */

import { Hono, Context } from 'hono';
import { query, select, insert, update } from '../database/rds-connection';
import { parseSelectedServices } from '../utils/entity-extractor';
import { extractAndVerifyAuthToken } from '../utils/jwt-verification';
import { resolveVendorId } from '../utils/vendor-resolve';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { resolveOrderShippingAddress } from '../utils/logistics/shipment-pincodes';
import {
  buildMealOrderInvoicePayload,
  isMealOrderInvoiceEligible,
} from '../utils/meal-order-invoice';
import {
  SQL_INVOICE_IS_INTER_STATE,
  customerGstinFromInvoiceRow,
  inferIsInterStateFromInvoiceRow,
  placeOfSupplyFromInvoiceRow,
} from '../utils/invoice-row-gst';

const s3Client = new S3Client({ region: process.env.AWS_REGION || 'ap-south-1' });
const INVOICE_BUCKET = process.env.S3_INVOICES_BUCKET || process.env.S3_UPLOADS_BUCKET || 'warmpawz-invoices';

/** Public logo URL for HTML invoices (override per env). */
function getInvoiceLogoUrl(): string {
  if (process.env.INVOICE_LOGO_URL) return process.env.INVOICE_LOGO_URL;
  const customerWeb = process.env.CUSTOMER_WEB_URL?.replace(/\/$/, '');
  if (customerWeb) return `${customerWeb}/logo.png`;
  return 'https://dg69gqp2frh39.cloudfront.net/logo.png';
}

interface BookingServiceTaxMeta {
  serviceName: string;
  serviceDescription: string;
  hsnCode: string;
  hsnDescription: string;
  gstRate: number;
  serviceCategory: string | null;
  catalogCategoryId: string | null;
  hsnCodeId: string | null;
  taxCategoryId: string | null;
  roleId: string | null;
}

export function registerTaxInvoicePdfEndpoints(app: Hono) {

  // ============================================================================
  // GENERATE INVOICE FOR ORDER
  // ============================================================================

  app.post('/orders/:orderId/invoice/generate', async (c) => {
    try {
      const orderId = c.req.param('orderId');
      const result = await ensureOrderInvoiceGenerated(orderId);
      if (!result.invoice && !result.invoiceId) {
        return c.json({ success: false, error: 'Order not found' }, 404);
      }
      return c.json({
        success: true,
        invoice: result.invoice ?? { id: result.invoiceId },
        created: result.created,
      });
    } catch (error: any) {
      console.error('Error generating invoice:', error);
      return c.json({ success: false, error: error.message }, 500);
    }
  });

  // ============================================================================
  // GET INVOICE
  // ============================================================================

  app.get('/orders/:orderId/invoice', async (c) => {
    try {
      const orderId = c.req.param('orderId');

      const invoiceQuery = `
        SELECT * FROM invoices WHERE order_id = $1 ORDER BY created_at DESC LIMIT 1
      `;
      const result = await query(invoiceQuery, [orderId]);

      if (result.rows.length === 0) {
        // Generate if not exists
        return c.json({ success: false, error: 'Invoice not found. Generate it first.', needsGeneration: true }, 404);
      }

      const invoice = result.rows[0];
      const invoiceData = typeof invoice.invoice_data === 'string' 
        ? JSON.parse(invoice.invoice_data) 
        : invoice.invoice_data;

      return c.json({
        success: true,
        invoice: {
          id: invoice.id,
          invoiceNumber: invoice.invoice_number,
          date: invoice.invoice_date,
          type: invoice.invoice_type || invoiceData?.invoiceType || 'tax_invoice',
          subtotal: parseFloat(invoice.subtotal),
          cgst: parseFloat(invoice.cgst_amount) || 0,
          sgst: parseFloat(invoice.sgst_amount) || 0,
          igst: parseFloat(invoice.igst_amount) || 0,
          totalTax: parseFloat(invoice.tax_amount),
          shipping: parseFloat(invoice.shipping_amount) || Number(invoiceData?.shipping) || 0,
          discount: parseFloat(invoice.discount_amount) || Number(invoiceData?.discount) || 0,
          total: parseFloat(invoice.total_amount),
          isInterState: invoice.is_inter_state ?? invoiceData?.isInterState ?? false,
          placeOfSupply: invoice.place_of_supply || invoiceData?.placeOfSupply || '',
          status: invoice.status,
        },
        data: invoiceData,
        downloadUrl: invoice.pdf_url ? `/invoices/download/${invoice.id}` : null,
      });
    } catch (error: any) {
      console.error('Error fetching invoice:', error);
      return c.json({ success: false, error: error.message }, 500);
    }
  });

  // ============================================================================
  // MEAL ORDER INVOICE
  // ============================================================================

  app.post('/meal/orders/:orderId/invoice/generate', async (c) => {
    try {
      const orderId = c.req.param('orderId');
      const result = await ensureMealOrderInvoiceGenerated(orderId);
      if (result.ineligible) {
        return c.json({ success: false, error: 'Invoice is available after payment is confirmed' }, 400);
      }
      if (!result.invoice && !result.invoiceId) {
        return c.json({ success: false, error: 'Order not found' }, 404);
      }
      return c.json({
        success: true,
        invoice: result.invoice ?? { id: result.invoiceId },
        created: result.created,
      });
    } catch (error: any) {
      console.error('Error generating meal order invoice:', error);
      return c.json({ success: false, error: error.message }, 500);
    }
  });

  app.get('/meal/orders/:orderId/invoice', async (c) => {
    try {
      const orderId = c.req.param('orderId');
      const result = await query(
        `SELECT * FROM invoices WHERE invoice_data->>'meal_order_id' = $1 ORDER BY created_at DESC LIMIT 1`,
        [orderId]
      );

      if (result.rows.length === 0) {
        return c.json(
          { success: false, error: 'Invoice not found. Generate it first.', needsGeneration: true },
          404
        );
      }

      const invoice = result.rows[0];
      const invoiceData =
        typeof invoice.invoice_data === 'string'
          ? JSON.parse(invoice.invoice_data)
          : invoice.invoice_data;

      return c.json({
        success: true,
        invoice: {
          id: invoice.id,
          invoiceNumber: invoice.invoice_number,
          date: invoice.invoice_date,
          type: invoice.invoice_type || invoiceData?.invoiceType || 'tax_invoice',
          subtotal: parseFloat(invoice.subtotal),
          cgst: parseFloat(invoice.cgst_amount) || 0,
          sgst: parseFloat(invoice.sgst_amount) || 0,
          igst: parseFloat(invoice.igst_amount) || 0,
          totalTax: parseFloat(invoice.tax_amount),
          shipping: parseFloat(invoice.shipping_amount) || Number(invoiceData?.shipping) || 0,
          discount: parseFloat(invoice.discount_amount) || Number(invoiceData?.discount) || 0,
          total: parseFloat(invoice.total_amount),
          isInterState: invoice.is_inter_state ?? invoiceData?.isInterState ?? false,
          placeOfSupply: invoice.place_of_supply || invoiceData?.placeOfSupply || '',
          status: invoice.status,
        },
        data: invoiceData,
        downloadUrl: invoice.pdf_url ? `/invoices/download/${invoice.id}` : null,
      });
    } catch (error: any) {
      console.error('Error fetching meal order invoice:', error);
      return c.json({ success: false, error: error.message }, 500);
    }
  });

  // ============================================================================
  // GET BOOKING INVOICE
  // ============================================================================

  app.get('/bookings/:bookingId/invoice', async (c) => {
    try {
      const bookingId = c.req.param('bookingId');

      // Check if invoice already exists for this booking (stored in invoice_data JSONB)
      const invoiceQuery = `
        SELECT * FROM invoices 
        WHERE invoice_data->>'booking_id' = $1 
        ORDER BY created_at DESC LIMIT 1
      `;
      let invoiceResult = await query(invoiceQuery, [bookingId]);

      // If invoice doesn't exist, generate one from booking data
      if (invoiceResult.rows.length === 0) {
        // Get booking details
        const bookingQuery = BOOKING_FOR_INVOICE_SQL;
        const bookingResult = await query(bookingQuery, [bookingId]);

        if (bookingResult.rows.length === 0) {
          return c.json({ success: false, error: 'Booking not found' }, 404);
        }

        const booking = bookingResult.rows[0];

        // Generate invoice number
        const invoiceNumber = await generateInvoiceNumber(booking.vendor_id);

        const serviceMeta = await resolveBookingServiceTaxMeta(booking);
        const invoiceData = await buildBookingInvoiceData({
          booking,
          bookingId,
          invoiceNumber,
          serviceMeta,
        });

        // Generate HTML invoice
        const htmlContent = generateInvoiceHTML(normalizeInvoiceDataForHtml(invoiceData));

        // Store invoice record (store booking_id in invoice_data since table doesn't have booking_id column)
        try {
          const invoiceDataWithBooking = {
            ...invoiceData,
            booking_id: bookingId,
          };
          
          await insert(
            'invoices',
            buildInvoicesInsertRow({
              vendorId: booking.vendor_id,
              customerId: booking.customer_id,
              invoiceNumber,
              invoiceData: invoiceDataWithBooking,
              totalAmount: invoiceData.total,
            })
          );
        } catch (insertError: any) {
          console.warn('Failed to store invoice in database:', insertError.message);
          // Continue anyway - invoice generation succeeded
        }

        // Return HTML invoice for download
        return c.html(htmlContent, 200, {
          'Content-Type': 'text/html',
          'Content-Disposition': `attachment; filename="invoice_${invoiceNumber}.html"`,
        });
      }

      // Invoice exists — rebuild from live booking so HSN/tax/wording stay current
      const invoice = invoiceResult.rows[0];
      const refreshed = await rebuildBookingInvoiceFromDb(bookingId, invoice.invoice_number);
      const invoicePayload = refreshed || normalizeInvoiceDataForHtml(
        typeof invoice.invoice_data === 'string'
          ? JSON.parse(invoice.invoice_data)
          : invoice.invoice_data
      );

      const htmlContent = generateInvoiceHTML(invoicePayload);
      
      return c.html(htmlContent, 200, {
        'Content-Type': 'text/html',
        'Content-Disposition': `attachment; filename="invoice_${invoice.invoice_number}.html"`,
      });
    } catch (error: any) {
      console.error('Error fetching booking invoice:', error);
      return c.json({ success: false, error: error.message }, 500);
    }
  });

  // ============================================================================
  // DOWNLOAD INVOICE
  // ============================================================================

  app.get('/invoices/download/:invoiceId', async (c) => {
    try {
      const invoiceId = c.req.param('invoiceId');

      const invoices = await select('invoices', { id: invoiceId });
      if (invoices.length === 0) {
        return c.json({ success: false, error: 'Invoice not found' }, 404);
      }

      const invoice = invoices[0];
      const access = await assertInvoiceDownloadAccess(c, invoice);
      if (!access.ok) {
        return c.json({ success: false, error: access.error }, access.status);
      }

      if (invoice.pdf_url) {
        try {
          const s3Result = await s3Client.send(
            new GetObjectCommand({
              Bucket: INVOICE_BUCKET,
              Key: invoice.pdf_url,
            })
          );
          const htmlContent = await s3Result.Body?.transformToString('utf-8');
          if (htmlContent) {
            return c.html(htmlContent, 200, {
              'Content-Type': 'text/html',
              'Content-Disposition': `attachment; filename="invoice_${invoice.invoice_number}.html"`,
            });
          }
        } catch (s3Error: any) {
          console.warn('S3 get object failed:', s3Error.message);
        }
      }

      // Regenerate HTML on the fly (refresh booking invoices from live data)
      let invoicePayload: InvoiceData | null = null;
      const storedRaw =
        typeof invoice.invoice_data === 'string'
          ? JSON.parse(invoice.invoice_data)
          : invoice.invoice_data;

      if (!storedRaw) {
        return c.json({ success: false, error: 'Invoice data not available' }, 400);
      }

      const bookingIdFromStore = storedRaw.booking_id;
      if (bookingIdFromStore) {
        invoicePayload = await rebuildBookingInvoiceFromDb(
          String(bookingIdFromStore),
          invoice.invoice_number
        );
      }

      const htmlContent = generateInvoiceHTML(
        invoicePayload || normalizeInvoiceDataForHtml(storedRaw)
      );
      
      return c.html(htmlContent, 200, {
        'Content-Disposition': `attachment; filename="invoice_${invoice.invoice_number}.html"`,
      });
    } catch (error: any) {
      console.error('Error downloading invoice:', error);
      return c.json({ success: false, error: error.message }, 500);
    }
  });

  // ============================================================================
  // VENDOR INVOICE LIST
  // ============================================================================

  app.get('/vendor/:vendorId/invoices', async (c) => {
    try {
      const vendorId = c.req.param('vendorId');
      const limit = parseInt(c.req.query('limit') || '50');
      const offset = parseInt(c.req.query('offset') || '0');
      const month = c.req.query('month'); // Format: YYYY-MM
      const status = c.req.query('status');
      const access = await assertVendorInvoiceAccess(c, vendorId);
      if (!access.ok) {
        return c.json({ success: false, error: access.error }, access.status);
      }

      let whereClause = 'WHERE i.vendor_id = $1';
      const params: any[] = [access.vendorId];
      let paramIdx = 2;

      if (month) {
        whereClause += ` AND TO_CHAR(i.invoice_date, 'YYYY-MM') = $${paramIdx++}`;
        params.push(month);
      }

      if (status) {
        whereClause += ` AND i.status = $${paramIdx++}`;
        params.push(status);
      }

      params.push(limit, offset);

      const invoicesQuery = `
        SELECT 
          i.*,
          o.order_number,
          c.full_name as customer_name
        FROM invoices i
        LEFT JOIN orders o ON i.order_id = o.id
        LEFT JOIN customers c ON i.customer_id = c.id
        ${whereClause}
        ORDER BY i.invoice_date DESC
        LIMIT $${paramIdx++} OFFSET $${paramIdx}
      `;

      const result = await query(invoicesQuery, params);

      // Get summary
      const summaryQuery = `
        SELECT 
          COUNT(*) as total_invoices,
          COALESCE(SUM(subtotal), 0) as total_subtotal,
          COALESCE(SUM(tax_amount), 0) as total_tax,
          COALESCE(SUM(cgst_amount), 0) as total_cgst,
          COALESCE(SUM(sgst_amount), 0) as total_sgst,
          COALESCE(SUM(igst_amount), 0) as total_igst,
          COALESCE(SUM(total_amount), 0) as total_amount
        FROM invoices i
        ${whereClause}
      `;
      const summaryResult = await query(summaryQuery, params.slice(0, -2));

      return c.json({
        success: true,
        invoices: (result.rows || []).map((i: any) => ({
          id: i.id,
          invoiceNumber: i.invoice_number,
          orderNumber: i.order_number,
          orderId: i.order_id,
          customerName: i.customer_name,
          date: i.invoice_date,
          subtotal: parseFloat(i.subtotal),
          tax: parseFloat(i.tax_amount),
          cgst: parseFloat(i.cgst_amount || 0),
          sgst: parseFloat(i.sgst_amount || 0),
          igst: parseFloat(i.igst_amount || 0),
          total: parseFloat(i.total_amount),
          isInterState: inferIsInterStateFromInvoiceRow(i),
          status: i.status,
        })),
        summary: {
          totalInvoices: parseInt(summaryResult.rows[0]?.total_invoices) || 0,
          totalSubtotal: parseFloat(summaryResult.rows[0]?.total_subtotal) || 0,
          totalTax: parseFloat(summaryResult.rows[0]?.total_tax) || 0,
          totalCGST: parseFloat(summaryResult.rows[0]?.total_cgst) || 0,
          totalSGST: parseFloat(summaryResult.rows[0]?.total_sgst) || 0,
          totalIGST: parseFloat(summaryResult.rows[0]?.total_igst) || 0,
          totalAmount: parseFloat(summaryResult.rows[0]?.total_amount) || 0,
        },
        pagination: { limit, offset },
      });
    } catch (error: any) {
      console.error('Error fetching vendor invoices:', error);
      return c.json({ success: false, error: error.message }, 500);
    }
  });

  // ============================================================================
  // GSTR-1 EXPORT
  // ============================================================================

  app.get('/vendor/:vendorId/gstr1-export', async (c) => {
    try {
      const vendorId = c.req.param('vendorId');
      const month = c.req.query('month'); // Required, format: YYYY-MM

      if (!month) {
        return c.json({ success: false, error: 'Month parameter required (format: YYYY-MM)' }, 400);
      }
      const access = await assertVendorInvoiceAccess(c, vendorId);
      if (!access.ok) {
        return c.json({ success: false, error: access.error }, access.status);
      }

      // Fetch all invoices for the month
      const invoicesQuery = `
        SELECT 
          i.*,
          o.order_number,
          c.full_name as customer_name,
          c.phone as customer_phone
        FROM invoices i
        LEFT JOIN orders o ON i.order_id = o.id
        LEFT JOIN customers c ON i.customer_id = c.id
        WHERE i.vendor_id = $1
          AND TO_CHAR(i.invoice_date, 'YYYY-MM') = $2
        ORDER BY i.invoice_date
      `;

      const result = await query(invoicesQuery, [access.vendorId, month]);

      const effectiveRate = (i: any) => effectiveInvoiceGstRatePercent(i);

      // Format for GSTR-1 B2C (Business to Consumer) section
      const b2cInvoices = (result.rows || [])
        .filter((i: any) => !customerGstinFromInvoiceRow(i))
        .map((i: any) => ({
          'Invoice Number': i.invoice_number,
          'Invoice Date': new Date(i.invoice_date).toLocaleDateString('en-IN'),
          'Place of Supply': placeOfSupplyFromInvoiceRow(i),
          'Rate': effectiveRate(i),
          'Taxable Value': parseFloat(i.subtotal).toFixed(2),
          'CGST': parseFloat(i.cgst_amount || 0).toFixed(2),
          'SGST': parseFloat(i.sgst_amount || 0).toFixed(2),
          'IGST': parseFloat(i.igst_amount || 0).toFixed(2),
          'Total': parseFloat(i.total_amount).toFixed(2),
        }));

      // Format for GSTR-1 B2B (Business to Business) section
      const b2bInvoices = (result.rows || [])
        .filter((i: any) => Boolean(customerGstinFromInvoiceRow(i)))
        .map((i: any) => ({
          'GSTIN': customerGstinFromInvoiceRow(i),
          'Invoice Number': i.invoice_number,
          'Invoice Date': new Date(i.invoice_date).toLocaleDateString('en-IN'),
          'Invoice Value': parseFloat(i.total_amount).toFixed(2),
          'Place of Supply': placeOfSupplyFromInvoiceRow(i),
          'Rate': effectiveRate(i),
          'Taxable Value': parseFloat(i.subtotal).toFixed(2),
          'IGST': parseFloat(i.igst_amount || 0).toFixed(2),
          'CGST': parseFloat(i.cgst_amount || 0).toFixed(2),
          'SGST': parseFloat(i.sgst_amount || 0).toFixed(2),
        }));

      // Summary by HSN — join products for hsn_code (order_items has no hsn_code column).
      // Tax amounts are proportionally derived from stored CGST/SGST/IGST columns.
      // Inter-state is inferred from invoice_data + tax split (no is_inter_state column required).
      const hsnSummaryQuery = `
        SELECT
          p.hsn_code,
          SUM(oi.quantity)                                        AS total_qty,
          SUM(oi.total_price)                                     AS taxable_value,
          BOOL_OR(${SQL_INVOICE_IS_INTER_STATE})                  AS is_inter_state,
          COALESCE(SUM(
            CASE WHEN ${SQL_INVOICE_IS_INTER_STATE}
              THEN (oi.total_price / NULLIF(o.subtotal::numeric, 0))
                   * COALESCE(o.igst_amount::numeric, 0)
              ELSE 0
            END
          ), 0)                                                   AS igst_amount,
          COALESCE(SUM(
            CASE WHEN NOT ${SQL_INVOICE_IS_INTER_STATE}
              THEN (oi.total_price / NULLIF(o.subtotal::numeric, 0))
                   * COALESCE(o.cgst_amount::numeric, 0)
              ELSE 0
            END
          ), 0)                                                   AS cgst_amount,
          COALESCE(SUM(
            CASE WHEN NOT ${SQL_INVOICE_IS_INTER_STATE}
              THEN (oi.total_price / NULLIF(o.subtotal::numeric, 0))
                   * COALESCE(o.sgst_amount::numeric, 0)
              ELSE 0
            END
          ), 0)                                                   AS sgst_amount
        FROM order_items oi
        JOIN orders o           ON oi.order_id = o.id
        LEFT JOIN products p    ON oi.product_id = p.id
        LEFT JOIN invoices inv  ON inv.order_id = o.id
        WHERE o.vendor_id = $1
          AND TO_CHAR(o.created_at, 'YYYY-MM') = $2
          AND p.hsn_code IS NOT NULL
        GROUP BY p.hsn_code
      `;
      const hsnResult = await query(hsnSummaryQuery, [access.vendorId, month]);

      const hsnSummary = (hsnResult.rows || []).map((h: any) => {
        const igst = parseFloat(h.igst_amount) || 0;
        const cgst = parseFloat(h.cgst_amount) || 0;
        const sgst = parseFloat(h.sgst_amount) || 0;
        return {
          'HSN Code': h.hsn_code,
          'Total Quantity': parseInt(h.total_qty),
          'Taxable Value': parseFloat(h.taxable_value).toFixed(2),
          'Integrated Tax': igst.toFixed(2),
          'Central Tax': cgst.toFixed(2),
          'State Tax': sgst.toFixed(2),
        };
      });

      return c.json({
        success: true,
        period: month,
        export: {
          b2b: b2bInvoices,
          b2c: b2cInvoices,
          hsn: hsnSummary,
        },
        summary: {
          totalB2BInvoices: b2bInvoices.length,
          totalB2CInvoices: b2cInvoices.length,
          totalTaxableValue: (result.rows || []).reduce((sum: number, i: any) => sum + parseFloat(i.subtotal || 0), 0),
          totalTax: (result.rows || []).reduce((sum: number, i: any) => sum + parseFloat(i.tax_amount || 0), 0),
        },
      });
    } catch (error: any) {
      console.error('Error generating GSTR-1 export:', error);
      return c.json({ success: false, error: error.message }, 500);
    }
  });

  app.post('/admin/invoices/ecommerce/backfill', async (c) => {
    try {
      const admin = await assertAdminInvoiceAccess(c);
      if (!admin.ok) {
        return c.json({ success: false, error: admin.error }, admin.status);
      }

      const body = await c.req.json().catch(() => ({}));
      const vendorId = body?.vendorId ? String(body.vendorId) : null;
      const periodFrom = body?.periodFrom ? String(body.periodFrom) : null;
      const periodTo = body?.periodTo ? String(body.periodTo) : null;
      const dryRun = Boolean(body?.dryRun);
      const limit = Math.min(Math.max(parseInt(String(body?.limit ?? 100), 10) || 100, 1), 500);

      const conditions = [
        `o.order_status = 'delivered'`,
        `NOT EXISTS (SELECT 1 FROM invoices i WHERE i.order_id = o.id)`,
      ];
      const params: unknown[] = [];
      let idx = 1;

      if (vendorId) {
        conditions.push(`o.vendor_id = $${idx++}::uuid`);
        params.push(vendorId);
      }
      if (periodFrom) {
        conditions.push(`o.created_at >= $${idx++}::timestamptz`);
        params.push(periodFrom);
      }
      if (periodTo) {
        conditions.push(`o.created_at < ($${idx++}::date + INTERVAL '1 day')`);
        params.push(periodTo);
      }

      params.push(limit);
      const ordersRes = await query(
        `SELECT o.id::text AS id, o.vendor_id::text AS vendor_id, o.order_number
         FROM orders o
         WHERE ${conditions.join(' AND ')}
         ORDER BY o.created_at ASC
         LIMIT $${idx}`,
        params
      );

      const candidates = ordersRes.rows ?? [];
      if (dryRun) {
        return c.json({
          success: true,
          dryRun: true,
          count: candidates.length,
          orders: candidates,
        });
      }

      const generated: Array<{ orderId: string; invoiceId?: string }> = [];
      const failed: Array<{ orderId: string; error: string }> = [];

      for (const order of candidates) {
        const orderId = String(order.id);
        try {
          const result = await ensureOrderInvoiceGenerated(orderId);
          generated.push({ orderId, invoiceId: result.invoiceId ?? result.invoice?.id });
        } catch (error) {
          failed.push({
            orderId,
            error: error instanceof Error ? error.message : 'Unknown invoice generation error',
          });
        }
      }

      return c.json({
        success: true,
        scanned: candidates.length,
        generatedCount: generated.length,
        failedCount: failed.length,
        generated,
        failed,
      });
    } catch (error: any) {
      console.error('Error backfilling ecommerce invoices:', error);
      return c.json({ success: false, error: error.message }, 500);
    }
  });
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

async function generateInvoiceNumber(vendorId: string): Promise<string> {
  const year = new Date().getFullYear();
  const month = String(new Date().getMonth() + 1).padStart(2, '0');
  
  // Get count of invoices this month for this vendor
  const countResult = await query(
    `SELECT COUNT(*) as count FROM invoices 
     WHERE vendor_id = $1 
     AND TO_CHAR(invoice_date, 'YYYY-MM') = $2`,
    [vendorId, `${year}-${month}`]
  );
  
  const sequence = (parseInt(countResult.rows[0]?.count) || 0) + 1;
  const vendorPrefix = vendorId.substring(0, 4).toUpperCase();
  
  return `INV-${vendorPrefix}-${year}${month}-${String(sequence).padStart(4, '0')}`;
}

interface InvoiceData {
  invoiceNumber: string;
  invoiceDate: string;
  orderNumber: string;
  vendor: {
    name: string;
    gstin: string;
    pan: string;
    address: string;
  };
  customer: {
    name: string;
    phone: string;
    email: string;
    address: any;
    gstin?: string;
  };
  items: Array<{
    name: string;
    hsn: string;
    quantity: number;
    unitPrice: number;
    gstRate: number;
    taxableValue: number;
    cgst: number;
    sgst: number;
    igst: number;
    total: number;
  }>;
  subtotal: number;
  cgst: number;
  sgst: number;
  igst: number;
  totalTax: number;
  shipping: number;
  discount: number;
  total: number;
  isInterState: boolean;
  placeOfSupply: string;
  amountInWords: string;
}

/** Compatible with migration 021 invoices table; extended columns live in invoice_data until 1047 is applied. */
function buildInvoicesInsertRow(params: {
  orderId?: string | null;
  vendorId: string;
  customerId: string | null;
  invoiceNumber: string;
  invoiceData: InvoiceData | Record<string, unknown>;
  totalAmount: number;
}): Record<string, unknown> {
  const data = params.invoiceData as InvoiceData;
  return {
    ...(params.orderId ? { order_id: params.orderId } : {}),
    vendor_id: params.vendorId,
    customer_id: params.customerId,
    invoice_number: params.invoiceNumber,
    invoice_date: new Date().toISOString().slice(0, 10),
    subtotal: Number(data.subtotal) || 0,
    tax_amount: Number(data.totalTax) || 0,
    cgst_amount: Number(data.cgst) || 0,
    sgst_amount: Number(data.sgst) || 0,
    igst_amount: Number(data.igst) || 0,
    total_amount: params.totalAmount,
    invoice_data: params.invoiceData,
    status: 'generated',
    created_at: new Date().toISOString(),
  };
}

function buildInvoiceData(params: {
  order: any;
  items: any[];
  invoiceNumber: string;
  isInterState: boolean;
  shippingAddress: any;
}): InvoiceData {
  const { order, items, invoiceNumber, isInterState, shippingAddress } = params;

  const invoiceItems = items.map((item: any) => {
    const unitPrice = parseFloat(item.unit_price) || 0;
    const quantity = parseInt(item.quantity) || 1;
    const gstRate = parseFloat(item.gst_rate) || 18;
    const taxableValue = unitPrice * quantity;
    const taxAmount = (taxableValue * gstRate) / 100;

    return {
      name: item.product_name || 'Product',
      hsn: item.hsn_code || '',
      quantity,
      unitPrice,
      gstRate,
      taxableValue,
      cgst: isInterState ? 0 : taxAmount / 2,
      sgst: isInterState ? 0 : taxAmount / 2,
      igst: isInterState ? taxAmount : 0,
      total: taxableValue + taxAmount,
    };
  });

  const subtotal = invoiceItems.reduce((sum, item) => sum + item.taxableValue, 0);

  // Fix B: prefer stored CGST/SGST/IGST from Phase 5 tax calculation over per-item gst_rate||18 fallbacks.
  // Stored values are authoritative (computed by taxCalculationService at order creation time).
  const storedCgst = parseFloat(order.cgst_amount) || 0;
  const storedSgst = parseFloat(order.sgst_amount) || 0;
  const storedIgst = parseFloat(order.igst_amount) || 0;
  const hasSufficientTaxData = (storedCgst + storedSgst + storedIgst) > 0;

  const totalCgst = hasSufficientTaxData ? storedCgst : invoiceItems.reduce((sum, item) => sum + item.cgst, 0);
  const totalSgst = hasSufficientTaxData ? storedSgst : invoiceItems.reduce((sum, item) => sum + item.sgst, 0);
  const totalIgst = hasSufficientTaxData ? storedIgst : invoiceItems.reduce((sum, item) => sum + item.igst, 0);
  const totalTax = totalCgst + totalSgst + totalIgst;

  // Fix A: orders table stores shipping_amount (Phase 5); shipping_fee is legacy fallback.
  const shipping = parseFloat(order.shipping_amount) || parseFloat(order.shipping_fee) || 0;
  const discount = parseFloat(order.discount_amount) || 0;
  const total = subtotal + totalTax + shipping - discount;

  return {
    invoiceNumber,
    invoiceDate: new Date().toLocaleDateString('en-IN'),
    orderNumber: order.order_number,
    vendor: {
      name: order.vendor_name || 'Vendor',
      gstin: order.vendor_gstin || '',
      pan: order.vendor_pan || '',
      address: [order.vendor_address, order.vendor_city, order.vendor_state, order.vendor_pincode].filter(Boolean).join(', '),
    },
    customer: {
      name: order.customer_name || 'Customer',
      phone: order.customer_phone || '',
      email: order.customer_email || '',
      address: shippingAddress,
      gstin: shippingAddress.gstin,
    },
    items: invoiceItems,
    subtotal,
    cgst: totalCgst,
    sgst: totalSgst,
    igst: totalIgst,
    totalTax,
    shipping,
    discount,
    total,
    isInterState,
    placeOfSupply: shippingAddress.state || order.vendor_state,
    amountInWords: numberToWords(Math.round(total)),
  };
}

const BOOKING_FOR_INVOICE_SQL = `
  SELECT b.*,
         v.business_name as vendor_name,
         v.owner_name as vendor_owner,
         v.phone as vendor_phone,
         v.email as vendor_email,
         v.address as vendor_address,
         v.city as vendor_city,
         v.state as vendor_state,
         v.pincode as vendor_pincode,
         v.gst_number as vendor_gst,
         v.role_id as vendor_role_id,
         c.full_name as customer_name,
         c.phone as customer_phone,
         c.email as customer_email,
         c.address as customer_address,
         c.city as customer_city,
         c.state as customer_state,
         c.pincode as customer_pincode,
         COALESCE(vs.service_name, sc.service_name, s.name) as service_name,
         COALESCE(vs.custom_description, sc.description, s.description) as service_description,
         sc.hsn_code_id as catalog_hsn_code_id,
         sc.tax_category_id as catalog_tax_category_id,
         sc.category_id as catalog_category_id,
         sc.category_name as catalog_category_name
  FROM bookings b
  LEFT JOIN vendors v ON b.vendor_id = v.id
  LEFT JOIN customers c ON b.customer_id = c.id
  LEFT JOIN vendor_services vs ON vs.id = b.service_id
  LEFT JOIN service_catalog sc ON sc.id = COALESCE(vs.service_id, b.service_id)
  LEFT JOIN services s ON s.id = b.service_id
  WHERE b.id = $1
`;

async function rebuildBookingInvoiceFromDb(
  bookingId: string,
  invoiceNumber: string
): Promise<InvoiceData | null> {
  const bookingResult = await query(BOOKING_FOR_INVOICE_SQL, [bookingId]);
  if (!bookingResult.rows?.length) return null;

  const booking = bookingResult.rows[0];
  const serviceMeta = await resolveBookingServiceTaxMeta(booking);
  return normalizeInvoiceDataForHtml(
    await buildBookingInvoiceData({
      booking,
      bookingId,
      invoiceNumber,
      serviceMeta,
    })
  );
}

async function resolveHsnRowById(hsnCodeId: string | null | undefined): Promise<Record<string, unknown> | null> {
  if (!hsnCodeId) return null;
  const result = await query(
    `SELECT id, hsn_code, code, description, gst_rate, category_id
     FROM hsn_codes WHERE id = $1 AND is_active = true LIMIT 1`,
    [hsnCodeId]
  );
  return result.rows?.[0] || null;
}

function hsnCodeFromRow(row: Record<string, unknown> | null): string {
  if (!row) return '';
  const code = row.hsn_code ?? row.code;
  return code != null ? String(code).trim() : '';
}

async function resolveBookingServiceTaxMeta(booking: Record<string, any>): Promise<BookingServiceTaxMeta> {
  let hsnCodeId = booking.catalog_hsn_code_id || null;
  let taxCategoryId = booking.catalog_tax_category_id || null;
  let catalogCategoryId = booking.catalog_category_id || null;
  let serviceCategory = booking.catalog_category_name || booking.service_type || null;
  let serviceName = booking.service_name || 'Service';
  let serviceDescription = booking.service_description || '';

  if (booking.service_id && (!hsnCodeId || !serviceName)) {
    const vsResult = await query(
      `SELECT vs.service_name, vs.custom_description, vs.category,
              sc.hsn_code_id, sc.tax_category_id, sc.category_id, sc.category_name, sc.service_name AS catalog_name
       FROM vendor_services vs
       LEFT JOIN service_catalog sc ON sc.id = vs.service_id
       WHERE vs.id = $1::uuid OR vs.service_id = $1::uuid
       LIMIT 1`,
      [booking.service_id]
    ).catch(() => ({ rows: [] }));
    if (vsResult.rows?.length > 0) {
      const row = vsResult.rows[0];
      serviceName = row.service_name || row.catalog_name || serviceName;
      serviceDescription = row.custom_description || serviceDescription;
      hsnCodeId = hsnCodeId || row.hsn_code_id;
      taxCategoryId = taxCategoryId || row.tax_category_id;
      catalogCategoryId = catalogCategoryId || row.category_id;
      serviceCategory = serviceCategory || row.category_name || row.category;
    }
  }

  const hsnRow = await resolveHsnRowById(hsnCodeId);
  let hsnCode = hsnCodeFromRow(hsnRow);
  let hsnDescription = hsnRow?.description ? String(hsnRow.description) : '';
  let gstRate = 0;

  if (hsnRow?.gst_rate != null && hsnRow.gst_rate !== '') {
    gstRate = parseFloat(String(hsnRow.gst_rate)) || 0;
  }

  if (!gstRate && taxCategoryId) {
    const tcResult = await query(
      `SELECT tax_rate, default_gst_rate, gst_rate FROM tax_categories WHERE id = $1 AND is_active = true LIMIT 1`,
      [taxCategoryId]
    ).catch(() => ({ rows: [] }));
    if (tcResult.rows?.length > 0) {
      const tc = tcResult.rows[0];
      gstRate = parseFloat(String(tc.tax_rate ?? tc.default_gst_rate ?? tc.gst_rate ?? 0)) || 0;
    }
  }

  if (!hsnCode) {
    const legacy = await query(`SELECT hsn_code FROM services WHERE id = $1 LIMIT 1`, [booking.service_id]).catch(() => ({ rows: [] }));
    hsnCode = legacy.rows?.[0]?.hsn_code ? String(legacy.rows[0].hsn_code) : '';
  }

  if (!hsnCode) {
    hsnCode = '998314';
    hsnDescription = hsnDescription || 'Pet care services';
  }

  return {
    serviceName,
    serviceDescription,
    hsnCode,
    hsnDescription,
    gstRate,
    serviceCategory,
    catalogCategoryId,
    hsnCodeId,
    taxCategoryId,
    roleId: booking.vendor_role_id || null,
  };
}

async function buildBookingInvoiceData(params: {
  booking: Record<string, any>;
  bookingId: string;
  invoiceNumber: string;
  serviceMeta: BookingServiceTaxMeta;
}): Promise<InvoiceData> {
  const { booking, bookingId, invoiceNumber, serviceMeta } = params;

  const basePrice = parseFloat(booking.base_price || booking.total_amount || '0');
  const taxAmount = parseFloat(booking.tax_amount || '0');
  const discountAmount = parseFloat(booking.discount_amount || '0');
  const totalAmount = parseFloat(booking.total_amount || '0');

  const gstRate =
    taxAmount > 0 && basePrice > 0
      ? (taxAmount / basePrice) * 100
      : serviceMeta.gstRate || 0;

  const isInterState = Boolean(
    booking.customer_state &&
      booking.vendor_state &&
      String(booking.customer_state).toLowerCase() !== String(booking.vendor_state).toLowerCase()
  );

  let cgst = 0;
  let sgst = 0;
  let igst = 0;
  if (isInterState) {
    igst = taxAmount;
  } else {
    cgst = taxAmount / 2;
    sgst = taxAmount / 2;
  }

  const selectedServices = parseSelectedServices(booking.selected_services);
  const items =
    selectedServices.length > 0
      ? selectedServices.map((s: any) => {
          const qty = s.quantity ?? 1;
          const unitPrice = parseFloat(s.price) || 0;
          const taxableValue = unitPrice * qty;
          const itemTax = taxAmount > 0 && basePrice > 0 ? (taxableValue / basePrice) * taxAmount : 0;
          const itemCgst = isInterState ? 0 : itemTax / 2;
          const itemSgst = isInterState ? 0 : itemTax / 2;
          const itemIgst = isInterState ? itemTax : 0;
          return {
            name: s.name || s.serviceName || serviceMeta.serviceName || 'Service',
            hsn: serviceMeta.hsnCode,
            quantity: qty,
            unitPrice,
            gstRate,
            taxableValue,
            cgst: itemCgst,
            sgst: itemSgst,
            igst: itemIgst,
            total: taxableValue + itemTax,
          };
        })
      : [
          {
            name: serviceMeta.serviceName || booking.service_name || 'Service',
            hsn: serviceMeta.hsnCode,
            quantity: 1,
            unitPrice: basePrice,
            gstRate,
            taxableValue: basePrice,
            cgst,
            sgst,
            igst,
            total: basePrice + taxAmount,
          },
        ];

  const vendorAddress = [booking.vendor_address, booking.vendor_city, booking.vendor_state, booking.vendor_pincode]
    .filter(Boolean)
    .join(', ');

  const customerAddress = {
    address_line1: booking.customer_address || booking.address || '',
    city: booking.customer_city || booking.city || '',
    state: booking.customer_state || booking.state || '',
    pincode: booking.customer_pincode || booking.pincode || '',
  };

  const total = totalAmount;

  return {
    invoiceNumber,
    invoiceDate: new Date(booking.created_at || new Date()).toLocaleDateString('en-IN'),
    orderNumber: `Booking #${String(bookingId).slice(0, 8)}`,
    vendor: {
      name: booking.vendor_name || 'Vendor',
      gstin: booking.vendor_gst || '',
      pan: '',
      address: vendorAddress,
    },
    customer: {
      name: booking.customer_name || 'Customer',
      phone: booking.customer_phone || '',
      email: booking.customer_email || '',
      address: customerAddress,
    },
    items,
    subtotal: basePrice,
    cgst,
    sgst,
    igst,
    totalTax: taxAmount,
    shipping: 0,
    discount: discountAmount,
    total,
    isInterState,
    placeOfSupply: booking.customer_state || booking.vendor_state || '',
    amountInWords: numberToWords(Math.round(total)),
  };
}

function normalizeInvoiceItem(item: Record<string, any>): InvoiceData['items'][number] {
  const gstRate = Number(item.gstRate ?? item.taxRate ?? 0);
  return {
    name: item.name || 'Item',
    hsn: String(item.hsn ?? item.hsnCode ?? '—'),
    quantity: Number(item.quantity ?? 1) || 1,
    unitPrice: Number(item.unitPrice) || 0,
    gstRate: Number.isFinite(gstRate) ? gstRate : 0,
    taxableValue: Number(item.taxableValue) || 0,
    cgst: Number(item.cgst) || 0,
    sgst: Number(item.sgst) || 0,
    igst: Number(item.igst) || 0,
    total: Number(item.total) || 0,
  };
}

function normalizeCustomerForHtml(customer: Record<string, any> | undefined): InvoiceData['customer'] {
  if (!customer) {
    return { name: 'Customer', phone: '', email: '', address: {} };
  }
  const addr = customer.address;
  const address =
    addr && typeof addr === 'object'
      ? {
          address_line1: addr.address_line1 || addr.line1 || '',
          city: addr.city || customer.city || '',
          state: addr.state || customer.state || '',
          pincode: addr.pincode || customer.pincode || '',
        }
      : {
          address_line1: typeof addr === 'string' ? addr : customer.address || '',
          city: customer.city || '',
          state: customer.state || '',
          pincode: customer.pincode || '',
        };
  return {
    name: customer.name || 'Customer',
    phone: customer.phone || '',
    email: customer.email || '',
    address,
    gstin: customer.gstin,
  };
}

/** Map legacy/stored invoice JSON (booking + order) to the shape expected by generateInvoiceHTML. */
function normalizeInvoiceDataForHtml(raw: Record<string, any>): InvoiceData {
  const items = (raw.items || []).map((item: Record<string, any>) => normalizeInvoiceItem(item));
  const total = Number(raw.total) || 0;
  const vendor = raw.vendor || {};
  const vendorAddress =
    typeof vendor.address === 'string'
      ? vendor.address
      : [vendor.address, vendor.city, vendor.state, vendor.pincode].filter(Boolean).join(', ');

  return {
    invoiceNumber: raw.invoiceNumber || raw.invoice_number || '—',
    invoiceDate: raw.invoiceDate || raw.invoice_date || new Date().toLocaleDateString('en-IN'),
    orderNumber:
      raw.orderNumber ||
      raw.order_number ||
      (raw.booking_id ? `Booking #${String(raw.booking_id).slice(0, 8)}` : '—'),
    vendor: {
      name: vendor.name || 'Vendor',
      gstin: vendor.gstin || vendor.gst || '',
      pan: vendor.pan || '',
      address: vendorAddress || '',
    },
    customer: normalizeCustomerForHtml(raw.customer),
    items,
    subtotal: Number(raw.subtotal) || 0,
    cgst: Number(raw.cgst) || 0,
    sgst: Number(raw.sgst) || 0,
    igst: Number(raw.igst) || 0,
    totalTax: Number(raw.totalTax ?? raw.tax_amount) || 0,
    shipping: Number(raw.shipping) || 0,
    discount: Number(raw.discount) || 0,
    total,
    isInterState: Boolean(raw.isInterState ?? raw.is_inter_state),
    placeOfSupply: raw.placeOfSupply || raw.place_of_supply || '',
    amountInWords: raw.amountInWords || numberToWords(Math.round(total)),
  };
}

function formatGstHalfRate(rate: number): string {
  const safe = Number.isFinite(rate) ? rate : 0;
  const half = safe / 2;
  return Number.isFinite(half) ? half.toFixed(2).replace(/\.00$/, '') : '0';
}

function formatGstRate(rate: number): string {
  const safe = Number.isFinite(rate) ? rate : 0;
  return safe.toFixed(2).replace(/\.00$/, '');
}

function generateInvoiceHTML(data: InvoiceData): string {
  const logoUrl = getInvoiceLogoUrl();
  const customerAddr = data.customer.address || {};
  const customerLine = [
    customerAddr.address_line1,
    [customerAddr.city, customerAddr.state, customerAddr.pincode].filter(Boolean).join(', '),
  ]
    .filter(Boolean)
    .map((line) => `<p>${line}</p>`)
    .join('');
  const refLabel = String(data.orderNumber || '').startsWith('Booking') ? 'Booking' : 'Order';

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Tax Invoice - ${data.invoiceNumber}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 12px; line-height: 1.4; color: #333; }
    .invoice { max-width: 800px; margin: 20px auto; padding: 30px; border: 1px solid #ddd; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #f97316; padding-bottom: 20px; margin-bottom: 20px; }
    .brand { display: flex; align-items: center; gap: 14px; }
    .brand img { width: 56px; height: 56px; object-fit: contain; border-radius: 50%; }
    .brand-text h1 { color: #f97316; font-size: 24px; margin-bottom: 4px; letter-spacing: 0.02em; }
    .brand-text p { color: #666; font-size: 12px; }
    .header-right { text-align: right; }
    .header-right h2 { color: #333; font-size: 18px; margin-bottom: 10px; }
    .header-right .invoice-number { font-size: 14px; font-weight: bold; }
    .parties { display: flex; justify-content: space-between; margin-bottom: 20px; }
    .party { width: 48%; }
    .party h3 { color: #f97316; font-size: 12px; text-transform: uppercase; margin-bottom: 10px; border-bottom: 1px solid #eee; padding-bottom: 5px; }
    .party p { margin-bottom: 3px; }
    .party .gstin { font-weight: bold; color: #333; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
    th { background: #f97316; color: white; padding: 10px 8px; text-align: left; font-size: 11px; }
    td { padding: 10px 8px; border-bottom: 1px solid #eee; }
    .text-right { text-align: right; }
    .text-center { text-align: center; }
    .totals { margin-left: auto; width: 300px; }
    .totals table { margin-bottom: 0; }
    .totals td { padding: 8px; }
    .totals .total-row { background: #f97316; color: white; font-weight: bold; font-size: 14px; }
    .amount-words { background: #fff9f5; padding: 10px; border-left: 3px solid #f97316; margin-bottom: 20px; }
    .footer { border-top: 1px solid #eee; padding-top: 20px; display: flex; justify-content: space-between; }
    .footer-left { font-size: 10px; color: #666; }
    .footer-right { text-align: right; }
    .signature { border-top: 1px solid #333; padding-top: 5px; margin-top: 40px; }
    @media print { body { -webkit-print-color-adjust: exact; } .invoice { border: none; } }
  </style>
</head>
<body>
  <div class="invoice">
    <div class="header">
      <div class="brand">
        <img src="${logoUrl}" alt="Warmpawz logo" onerror="this.style.display='none'" />
        <div class="brand-text">
          <h1>Warmpawz</h1>
          <p>Pet Care Marketplace</p>
        </div>
      </div>
      <div class="header-right">
        <h2>TAX INVOICE</h2>
        <p class="invoice-number">${data.invoiceNumber}</p>
        <p>Date: ${data.invoiceDate}</p>
        <p>${refLabel}: ${data.orderNumber}</p>
      </div>
    </div>

    <div class="parties">
      <div class="party">
        <h3>Seller Details</h3>
        <p><strong>${data.vendor.name}</strong></p>
        <p>${data.vendor.address}</p>
        ${data.vendor.gstin ? `<p class="gstin">GSTIN: ${data.vendor.gstin}</p>` : ''}
        ${data.vendor.pan ? `<p>PAN: ${data.vendor.pan}</p>` : ''}
      </div>
      <div class="party">
        <h3>Billing & Shipping</h3>
        <p><strong>${data.customer.name}</strong></p>
        ${customerLine}
        <p>Phone: ${data.customer.phone}</p>
        ${data.customer.gstin ? `<p class="gstin">GSTIN: ${data.customer.gstin}</p>` : ''}
        <p>Place of Supply: ${data.placeOfSupply}</p>
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th style="width: 5%">#</th>
          <th style="width: 30%">Item Description</th>
          <th class="text-center" style="width: 10%">HSN</th>
          <th class="text-right" style="width: 8%">Qty</th>
          <th class="text-right" style="width: 12%">Rate</th>
          <th class="text-right" style="width: 10%">Taxable</th>
          ${data.isInterState 
            ? `<th class="text-right" style="width: 12%">IGST</th>` 
            : `<th class="text-right" style="width: 6%">CGST</th><th class="text-right" style="width: 6%">SGST</th>`}
          <th class="text-right" style="width: 12%">Total</th>
        </tr>
      </thead>
      <tbody>
        ${data.items.map((item, idx) => `
          <tr>
            <td>${idx + 1}</td>
            <td>${item.name}</td>
            <td class="text-center">${item.hsn || '—'}</td>
            <td class="text-right">${item.quantity}</td>
            <td class="text-right">₹${item.unitPrice.toFixed(2)}</td>
            <td class="text-right">₹${item.taxableValue.toFixed(2)}</td>
            ${data.isInterState 
              ? `<td class="text-right">₹${item.igst.toFixed(2)}<br><small>(${formatGstRate(item.gstRate)}%)</small></td>`
              : `<td class="text-right">₹${item.cgst.toFixed(2)}<br><small>(${formatGstHalfRate(item.gstRate)}%)</small></td>
                 <td class="text-right">₹${item.sgst.toFixed(2)}<br><small>(${formatGstHalfRate(item.gstRate)}%)</small></td>`}
            <td class="text-right"><strong>₹${item.total.toFixed(2)}</strong></td>
          </tr>
        `).join('')}
      </tbody>
    </table>

    <div class="totals">
      <table>
        <tr>
          <td>Subtotal</td>
          <td class="text-right">₹${data.subtotal.toFixed(2)}</td>
        </tr>
        ${data.isInterState ? `
          <tr>
            <td>IGST</td>
            <td class="text-right">₹${data.igst.toFixed(2)}</td>
          </tr>
        ` : `
          <tr>
            <td>CGST</td>
            <td class="text-right">₹${data.cgst.toFixed(2)}</td>
          </tr>
          <tr>
            <td>SGST</td>
            <td class="text-right">₹${data.sgst.toFixed(2)}</td>
          </tr>
        `}
        ${data.shipping > 0 ? `
          <tr>
            <td>Shipping</td>
            <td class="text-right">₹${data.shipping.toFixed(2)}</td>
          </tr>
        ` : ''}
        ${data.discount > 0 ? `
          <tr>
            <td>Discount</td>
            <td class="text-right">-₹${data.discount.toFixed(2)}</td>
          </tr>
        ` : ''}
        <tr class="total-row">
          <td><strong>Grand Total</strong></td>
          <td class="text-right"><strong>₹${data.total.toFixed(2)}</strong></td>
        </tr>
      </table>
    </div>

    <div class="amount-words">
      <strong>Amount in Words:</strong> ${data.amountInWords} Rupees Only
    </div>

    <div class="footer">
      <div class="footer-left">
        <p>This is a computer generated invoice and does not require signature.</p>
        <p>Terms & Conditions apply. For queries contact support@warmpawz.com</p>
      </div>
      <div class="footer-right">
        <p>For ${data.vendor.name}</p>
        <div class="signature">Authorized Signatory</div>
      </div>
    </div>
  </div>
</body>
</html>
  `;
}

function numberToWords(num: number): string {
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
    'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  if (num === 0) return 'Zero';
  if (num < 0) return 'Minus ' + numberToWords(-num);

  let words = '';

  if (Math.floor(num / 10000000) > 0) {
    words += numberToWords(Math.floor(num / 10000000)) + ' Crore ';
    num %= 10000000;
  }

  if (Math.floor(num / 100000) > 0) {
    words += numberToWords(Math.floor(num / 100000)) + ' Lakh ';
    num %= 100000;
  }

  if (Math.floor(num / 1000) > 0) {
    words += numberToWords(Math.floor(num / 1000)) + ' Thousand ';
    num %= 1000;
  }

  if (Math.floor(num / 100) > 0) {
    words += numberToWords(Math.floor(num / 100)) + ' Hundred ';
    num %= 100;
  }

  if (num > 0) {
    if (words !== '') words += 'and ';
    if (num < 20) {
      words += ones[num];
    } else {
      words += tens[Math.floor(num / 10)];
      if (num % 10 > 0) words += ' ' + ones[num % 10];
    }
  }

  return words.trim();
}

function effectiveInvoiceGstRatePercent(invoiceRow: {
  subtotal?: string | number;
  tax_amount?: string | number;
}): string {
  const subtotal = parseFloat(String(invoiceRow.subtotal ?? 0));
  const tax = parseFloat(String(invoiceRow.tax_amount ?? 0));
  if (subtotal <= 0 || tax <= 0) return '0';
  return (Math.round((tax / subtotal) * 10000) / 100).toFixed(2);
}

async function assertVendorInvoiceAccess(
  c: Context,
  vendorId: string
): Promise<{ ok: true; vendorId: string } | { ok: false; error: string; status: 401 | 403 }> {
  const authHeader = c.req.header('Authorization') || c.req.header('authorization') || '';
  if (!authHeader) {
    return { ok: false, error: 'Authentication required', status: 401 };
  }

  const verified = await extractAndVerifyAuthToken({ authorization: authHeader });
  if (!verified.valid || !verified.payload?.sub) {
    return { ok: false, error: 'Authentication required', status: 401 };
  }

  const userId = verified.payload.sub;
  const role = String(verified.payload['custom:user_type'] || verified.payload['custom:role'] || '').toLowerCase();
  const resolvedVendor = await resolveVendorId(vendorId);
  if (role === 'admin' || role.includes('admin')) {
    return { ok: true, vendorId: resolvedVendor || vendorId };
  }

  const resolvedUser = await resolveVendorId(String(userId));
  if (resolvedVendor && resolvedUser && String(resolvedVendor) === String(resolvedUser)) {
    return { ok: true, vendorId: resolvedVendor };
  }

  if (String(userId) === String(vendorId)) {
    return { ok: true, vendorId };
  }

  return { ok: false, error: 'Not authorized for this vendor', status: 403 };
}

async function assertAdminInvoiceAccess(
  c: Context
): Promise<{ ok: true } | { ok: false; error: string; status: 401 | 403 }> {
  const authHeader = c.req.header('Authorization') || c.req.header('authorization') || '';
  if (!authHeader) {
    return { ok: false, error: 'Authentication required', status: 401 };
  }

  const verified = await extractAndVerifyAuthToken({ authorization: authHeader });
  if (!verified.valid || !verified.payload?.sub) {
    return { ok: false, error: 'Authentication required', status: 401 };
  }

  const role = String(verified.payload['custom:user_type'] || verified.payload['custom:role'] || '').toLowerCase();
  if (role === 'admin' || role.includes('admin')) {
    return { ok: true };
  }

  return { ok: false, error: 'Admin access required', status: 403 };
}

async function assertInvoiceDownloadAccess(
  c: Context,
  invoice: { vendor_id?: string; customer_id?: string }
): Promise<{ ok: true } | { ok: false; error: string; status: 401 | 403 }> {
  const authHeader = c.req.header('Authorization') || c.req.header('authorization') || '';
  if (!authHeader) {
    return { ok: false, error: 'Authentication required', status: 401 };
  }

  const verified = await extractAndVerifyAuthToken({ authorization: authHeader });
  if (!verified.valid || !verified.payload?.sub) {
    return { ok: false, error: 'Authentication required', status: 401 };
  }

  const userId = verified.payload.sub;
  const role = String(verified.payload['custom:user_type'] || verified.payload['custom:role'] || '').toLowerCase();
  if (role === 'admin' || role.includes('admin')) {
    return { ok: true };
  }

  if (invoice.customer_id && String(invoice.customer_id) === String(userId)) {
    return { ok: true };
  }

  if (invoice.vendor_id) {
    const resolvedVendor = await resolveVendorId(String(invoice.vendor_id));
    const resolvedUser = await resolveVendorId(String(userId));
    if (resolvedVendor && resolvedUser && String(resolvedVendor) === String(resolvedUser)) {
      return { ok: true };
    }
    if (String(userId) === String(invoice.vendor_id)) {
      return { ok: true };
    }
  }

  return { ok: false, error: 'Not authorized to download this invoice', status: 403 };
}

export interface GeneratedOrderInvoice {
  id: string;
  invoiceNumber: string;
  subtotal: number;
  tax: number;
  total: number;
  isInterState: boolean;
}

/** Idempotent: create invoice row for order if none exists. */
export async function ensureOrderInvoiceGenerated(orderId: string): Promise<{
  created: boolean;
  invoiceId?: string;
  invoice?: GeneratedOrderInvoice;
}> {
  const existing = await query(
    `SELECT id FROM invoices WHERE order_id = $1 ORDER BY created_at DESC LIMIT 1`,
    [orderId]
  );
  if (existing.rows.length > 0) {
    return { created: false, invoiceId: String(existing.rows[0].id) };
  }

  const orderQuery = `
    SELECT 
      o.*,
      c.full_name as customer_name,
      c.phone as customer_phone,
      c.email as customer_email,
      v.business_name as vendor_name,
      v.gst_number as vendor_gstin,
      v.pan_number as vendor_pan,
      v.address as vendor_address,
      v.city as vendor_city,
      v.state as vendor_state,
      v.pincode as vendor_pincode
    FROM orders o
    LEFT JOIN customers c ON o.customer_id = c.id
    LEFT JOIN vendors v ON o.vendor_id = v.id
    WHERE o.id = $1
  `;
  const orderResult = await query(orderQuery, [orderId]);
  if (orderResult.rows.length === 0) {
    return { created: false };
  }

  const order = orderResult.rows[0];
  const itemsResult = await query(
    `SELECT oi.*, p.name as product_name, p.hsn_code, p.gst_rate
     FROM order_items oi
     LEFT JOIN products p ON oi.product_id = p.id
     WHERE oi.order_id = $1`,
    [orderId]
  );
  const items = itemsResult.rows || [];

  const shippingAddress = resolveOrderShippingAddress(order as Record<string, unknown>);
  const customerState = String(shippingAddress.state ?? order.shipping_state ?? '').toLowerCase();
  const isInterState =
    String(order.vendor_state ?? '').toLowerCase() !== customerState;

  const invoiceNumber = await generateInvoiceNumber(order.vendor_id);
  const invoiceData = buildInvoiceData({
    order,
    items,
    invoiceNumber,
    isInterState,
    shippingAddress,
  });
  const htmlContent = generateInvoiceHTML(normalizeInvoiceDataForHtml(invoiceData));

  const [invoice] = await insert(
    'invoices',
    buildInvoicesInsertRow({
      orderId: orderId,
      vendorId: order.vendor_id,
      customerId: order.customer_id,
      invoiceNumber,
      invoiceData,
      totalAmount: parseFloat(String(order.total_amount)) || invoiceData.total,
    })
  );

  const s3Key = `invoices/${order.vendor_id}/${new Date().getFullYear()}/${invoiceNumber}.html`;
  try {
    await s3Client.send(
      new PutObjectCommand({
        Bucket: INVOICE_BUCKET,
        Key: s3Key,
        Body: htmlContent,
        ContentType: 'text/html',
      })
    );
    await update('invoices', { id: invoice.id }, {
      pdf_url: s3Key,
      updated_at: new Date().toISOString(),
    });
  } catch (s3Error: any) {
    console.warn('S3 upload failed:', s3Error.message);
  }

  return {
    created: true,
    invoiceId: String(invoice.id),
    invoice: {
      id: String(invoice.id),
      invoiceNumber,
      subtotal: invoiceData.subtotal,
      tax: invoiceData.totalTax,
      total: parseFloat(String(order.total_amount)),
      isInterState,
    },
  };
}

const MEAL_ORDER_FOR_INVOICE_SQL = `
  SELECT
    mo.*,
    mp.name as meal_plan_name,
    c.full_name as customer_name,
    c.phone as customer_phone,
    c.email as customer_email,
    v.business_name as vendor_name,
    v.gst_number as vendor_gstin,
    v.pan_number as vendor_pan,
    v.address as vendor_address,
    v.city as vendor_city,
    v.state as vendor_state,
    v.pincode as vendor_pincode
  FROM meal_orders mo
  JOIN meal_plans mp ON mo.meal_plan_id = mp.id
  LEFT JOIN customers c ON mo.customer_id = c.id
  LEFT JOIN vendors v ON mo.vendor_id = v.id
  WHERE mo.id = $1
`;

function parseMealDeliveryState(order: Record<string, unknown>): string {
  const raw = order.delivery_address;
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      return String(parsed.state ?? '').trim();
    } catch {
      return '';
    }
  }
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    return String((raw as Record<string, unknown>).state ?? '').trim();
  }
  return '';
}

/** Idempotent: create invoice row for meal_orders if none exists. */
export async function ensureMealOrderInvoiceGenerated(mealOrderId: string): Promise<{
  created: boolean;
  invoiceId?: string;
  invoice?: GeneratedOrderInvoice;
  ineligible?: boolean;
}> {
  const existing = await query(
    `SELECT id FROM invoices WHERE invoice_data->>'meal_order_id' = $1 ORDER BY created_at DESC LIMIT 1`,
    [mealOrderId]
  );
  if (existing.rows.length > 0) {
    return { created: false, invoiceId: String(existing.rows[0].id) };
  }

  const orderResult = await query(MEAL_ORDER_FOR_INVOICE_SQL, [mealOrderId]);
  if (orderResult.rows.length === 0) {
    return { created: false };
  }

  const order = orderResult.rows[0] as Record<string, unknown>;
  if (!isMealOrderInvoiceEligible(order)) {
    return { created: false, ineligible: true };
  }

  const customerState = parseMealDeliveryState(order).toLowerCase();
  const vendorState = String(order.vendor_state ?? '').toLowerCase();
  const isInterState = Boolean(vendorState && customerState && vendorState !== customerState);

  const invoiceNumber = await generateInvoiceNumber(String(order.vendor_id));
  const invoicePayload = buildMealOrderInvoicePayload({
    order,
    mealPlanName: String(order.meal_plan_name || order.meal_name || 'Meal plan'),
    invoiceNumber,
    isInterState,
  });
  const invoiceData = {
    ...invoicePayload,
    meal_order_id: mealOrderId,
  };
  const htmlContent = generateInvoiceHTML(normalizeInvoiceDataForHtml(invoiceData));

  const [invoice] = await insert(
    'invoices',
    buildInvoicesInsertRow({
      vendorId: String(order.vendor_id),
      customerId: order.customer_id ? String(order.customer_id) : null,
      invoiceNumber,
      invoiceData,
      totalAmount: invoicePayload.total,
    })
  );

  const s3Key = `invoices/${order.vendor_id}/${new Date().getFullYear()}/${invoiceNumber}.html`;
  try {
    await s3Client.send(
      new PutObjectCommand({
        Bucket: INVOICE_BUCKET,
        Key: s3Key,
        Body: htmlContent,
        ContentType: 'text/html',
      })
    );
    await update('invoices', { id: invoice.id }, {
      pdf_url: s3Key,
      updated_at: new Date().toISOString(),
    });
  } catch (s3Error: any) {
    console.warn('S3 upload failed:', s3Error.message);
  }

  return {
    created: true,
    invoiceId: String(invoice.id),
    invoice: {
      id: String(invoice.id),
      invoiceNumber,
      subtotal: invoicePayload.subtotal,
      tax: invoicePayload.totalTax,
      total: invoicePayload.total,
      isInterState,
    },
  };
}
