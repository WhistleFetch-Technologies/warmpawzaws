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

import { Hono } from 'hono';
import { query, select, insert, update } from '../database/rds-connection';
import { parseSelectedServices } from '../utils/entity-extractor';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const s3Client = new S3Client({ region: process.env.AWS_REGION || 'ap-south-1' });
const INVOICE_BUCKET = process.env.S3_INVOICES_BUCKET || process.env.S3_UPLOADS_BUCKET || 'warmpawz-invoices';

export function registerTaxInvoicePdfEndpoints(app: Hono) {

  // ============================================================================
  // GENERATE INVOICE FOR ORDER
  // ============================================================================

  app.post('/orders/:orderId/invoice/generate', async (c) => {
    try {
      const orderId = c.req.param('orderId');

      // Fetch order with all related data
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
        return c.json({ success: false, error: 'Order not found' }, 404);
      }

      const order = orderResult.rows[0];

      // Fetch order items
      const itemsQuery = `
        SELECT 
          oi.*,
          p.name as product_name,
          p.hsn_code,
          p.gst_rate
        FROM order_items oi
        LEFT JOIN products p ON oi.product_id = p.id
        WHERE oi.order_id = $1
      `;
      const itemsResult = await query(itemsQuery, [orderId]);
      const items = itemsResult.rows || [];

      // Generate invoice number
      const invoiceNumber = await generateInvoiceNumber(order.vendor_id);

      // Calculate tax breakdown
      const shippingAddress = typeof order.shipping_address === 'string' 
        ? JSON.parse(order.shipping_address || '{}') 
        : (order.shipping_address || {});
      
      const isInterState = (order.vendor_state || '').toLowerCase() !== (shippingAddress.state || '').toLowerCase();

      const invoiceData = buildInvoiceData({
        order,
        items,
        invoiceNumber,
        isInterState,
        shippingAddress,
      });

      // Generate HTML invoice
      const htmlContent = generateInvoiceHTML(invoiceData);

      // Store invoice record
      const [invoice] = await insert('invoices', {
        order_id: orderId,
        vendor_id: order.vendor_id,
        customer_id: order.customer_id,
        invoice_number: invoiceNumber,
        invoice_type: 'tax_invoice',
        invoice_date: new Date().toISOString(),
        subtotal: invoiceData.subtotal,
        tax_amount: invoiceData.totalTax,
        cgst_amount: invoiceData.cgst,
        sgst_amount: invoiceData.sgst,
        igst_amount: invoiceData.igst,
        shipping_amount: order.shipping_fee || 0,
        discount_amount: order.discount_amount || 0,
        total_amount: order.total_amount,
        is_inter_state: isInterState,
        customer_gstin: shippingAddress.gstin || null,
        place_of_supply: shippingAddress.state || order.vendor_state,
        invoice_data: JSON.stringify(invoiceData),
        status: 'generated',
        created_at: new Date().toISOString(),
      });

      // Upload HTML to S3
      const s3Key = `invoices/${order.vendor_id}/${new Date().getFullYear()}/${invoiceNumber}.html`;
      
      try {
        await s3Client.send(new PutObjectCommand({
          Bucket: INVOICE_BUCKET,
          Key: s3Key,
          Body: htmlContent,
          ContentType: 'text/html',
        }));

        await update('invoices', { id: invoice.id }, {
          pdf_url: s3Key,
          updated_at: new Date().toISOString(),
        });
      } catch (s3Error: any) {
        console.warn('S3 upload failed:', s3Error.message);
      }

      return c.json({
        success: true,
        invoice: {
          id: invoice.id,
          invoiceNumber,
          date: invoice.invoice_date,
          subtotal: invoiceData.subtotal,
          tax: invoiceData.totalTax,
          total: order.total_amount,
          isInterState,
        },
        html: htmlContent,
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
          type: invoice.invoice_type,
          subtotal: parseFloat(invoice.subtotal),
          cgst: parseFloat(invoice.cgst_amount) || 0,
          sgst: parseFloat(invoice.sgst_amount) || 0,
          igst: parseFloat(invoice.igst_amount) || 0,
          totalTax: parseFloat(invoice.tax_amount),
          shipping: parseFloat(invoice.shipping_amount) || 0,
          discount: parseFloat(invoice.discount_amount) || 0,
          total: parseFloat(invoice.total_amount),
          isInterState: invoice.is_inter_state,
          placeOfSupply: invoice.place_of_supply,
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
        const bookingQuery = `
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
                 c.name as customer_name,
                 c.phone as customer_phone,
                 c.email as customer_email,
                 c.address as customer_address,
                 c.city as customer_city,
                 c.state as customer_state,
                 c.pincode as customer_pincode,
                 s.name as service_name,
                 s.description as service_description
          FROM bookings b
          LEFT JOIN vendors v ON b.vendor_id = v.id
          LEFT JOIN customers c ON b.customer_id = c.id
          LEFT JOIN services s ON b.service_id = s.id
          WHERE b.id = $1
        `;
        const bookingResult = await query(bookingQuery, [bookingId]);

        if (bookingResult.rows.length === 0) {
          return c.json({ success: false, error: 'Booking not found' }, 404);
        }

        const booking = bookingResult.rows[0];

        // Generate invoice number
        const invoiceNumber = await generateInvoiceNumber(booking.vendor_id);

        // Build invoice data from booking
        const basePrice = parseFloat(booking.base_price || booking.total_amount || '0');
        const taxAmount = parseFloat(booking.tax_amount || '0');
        const discountAmount = parseFloat(booking.discount_amount || '0');
        const totalAmount = parseFloat(booking.total_amount || '0');

        // Calculate GST (assuming 18% if tax exists, otherwise 0)
        const gstRate = taxAmount > 0 ? (taxAmount / basePrice) * 100 : 0;
        const isInterState = booking.customer_state && booking.vendor_state && booking.customer_state !== booking.vendor_state;
        
        let cgst = 0, sgst = 0, igst = 0;
        if (isInterState) {
          igst = taxAmount;
        } else {
          cgst = taxAmount / 2;
          sgst = taxAmount / 2;
        }

        // Multi-service: build line items from selected_services when present
        const selectedServices = parseSelectedServices(booking.selected_services);
        const items = selectedServices.length > 0
          ? selectedServices.map((s: any) => {
              const qty = s.quantity ?? 1;
              const unitPrice = parseFloat(s.price) || 0;
              const taxableValue = unitPrice * qty;
              const itemTax = taxAmount > 0 && basePrice > 0 ? (taxableValue / basePrice) * taxAmount : 0;
              const itemCgst = isInterState ? 0 : itemTax / 2;
              const itemSgst = isInterState ? 0 : itemTax / 2;
              const itemIgst = isInterState ? itemTax : 0;
              return {
                name: s.name || s.serviceName || 'Service',
                description: (s.description || '').toString(),
                quantity: qty,
                unitPrice,
                taxableValue,
                hsnCode: '998314',
                cgst: itemCgst,
                sgst: itemSgst,
                igst: itemIgst,
                taxRate: gstRate,
                total: taxableValue + itemTax,
              };
            })
          : [{
              name: booking.service_name || 'Service',
              description: booking.service_description || '',
              quantity: 1,
              unitPrice: basePrice,
              taxableValue: basePrice,
              hsnCode: '998314',
              cgst: cgst,
              sgst: sgst,
              igst: igst,
              taxRate: gstRate,
              total: basePrice + taxAmount,
            }];

        const invoiceData = {
          invoiceNumber,
          invoiceDate: new Date(booking.created_at || new Date()).toLocaleDateString('en-IN'),
          vendor: {
            name: booking.vendor_name || 'Vendor',
            owner: booking.vendor_owner || '',
            address: booking.vendor_address || '',
            city: booking.vendor_city || '',
            state: booking.vendor_state || '',
            pincode: booking.vendor_pincode || '',
            phone: booking.vendor_phone || '',
            email: booking.vendor_email || '',
            gstin: booking.vendor_gst || '',
          },
          customer: {
            name: booking.customer_name || 'Customer',
            address: booking.customer_address || '',
            city: booking.customer_city || '',
            state: booking.customer_state || '',
            pincode: booking.customer_pincode || '',
            phone: booking.customer_phone || '',
            email: booking.customer_email || '',
          },
          items,
          subtotal: basePrice,
          cgst: cgst,
          sgst: sgst,
          igst: igst,
          totalTax: taxAmount,
          discount: discountAmount,
          total: totalAmount,
          isInterState,
          placeOfSupply: booking.customer_state || booking.vendor_state || '',
        };

        // Generate HTML invoice
        const htmlContent = generateInvoiceHTML(invoiceData);

        // Store invoice record (store booking_id in invoice_data since table doesn't have booking_id column)
        try {
          const invoiceDataWithBooking = {
            ...invoiceData,
            booking_id: bookingId,
          };
          
          await insert('invoices', {
            vendor_id: booking.vendor_id,
            customer_id: booking.customer_id,
            invoice_number: invoiceNumber,
            invoice_type: 'tax_invoice',
            invoice_date: new Date().toISOString(),
            subtotal: invoiceData.subtotal,
            tax_amount: invoiceData.totalTax,
            cgst_amount: invoiceData.cgst,
            sgst_amount: invoiceData.sgst,
            igst_amount: invoiceData.igst,
            discount_amount: invoiceData.discount,
            total_amount: invoiceData.total,
            is_inter_state: isInterState,
            place_of_supply: invoiceData.placeOfSupply,
            invoice_data: JSON.stringify(invoiceDataWithBooking),
            status: 'generated',
            created_at: new Date().toISOString(),
          });
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

      // Invoice exists, return it
      const invoice = invoiceResult.rows[0];
      const invoiceData = typeof invoice.invoice_data === 'string' 
        ? JSON.parse(invoice.invoice_data) 
        : invoice.invoice_data;

      if (!invoiceData) {
        return c.json({ success: false, error: 'Invoice data not available' }, 400);
      }

      const htmlContent = generateInvoiceHTML(invoiceData);
      
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

      if (invoice.pdf_url) {
        // Get presigned URL from S3
        try {
          const command = new GetObjectCommand({
            Bucket: INVOICE_BUCKET,
            Key: invoice.pdf_url,
          });
          const url = await getSignedUrl(s3Client, command, { expiresIn: 3600 });
          return c.json({ success: true, downloadUrl: url });
        } catch (s3Error: any) {
          console.warn('S3 presign failed:', s3Error.message);
        }
      }

      // Regenerate HTML on the fly
      const invoiceData = typeof invoice.invoice_data === 'string' 
        ? JSON.parse(invoice.invoice_data) 
        : invoice.invoice_data;

      if (!invoiceData) {
        return c.json({ success: false, error: 'Invoice data not available' }, 400);
      }

      const htmlContent = generateInvoiceHTML(invoiceData);
      
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

      let whereClause = 'WHERE i.vendor_id = $1';
      const params: any[] = [vendorId];
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
          customerName: i.customer_name,
          date: i.invoice_date,
          subtotal: parseFloat(i.subtotal),
          tax: parseFloat(i.tax_amount),
          total: parseFloat(i.total_amount),
          isInterState: i.is_inter_state,
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

      const result = await query(invoicesQuery, [vendorId, month]);

      // Format for GSTR-1 B2C (Business to Consumer) section
      const b2cInvoices = (result.rows || [])
        .filter((i: any) => !i.customer_gstin)
        .map((i: any) => ({
          'Invoice Number': i.invoice_number,
          'Invoice Date': new Date(i.invoice_date).toLocaleDateString('en-IN'),
          'Place of Supply': i.place_of_supply,
          'Rate': '18', // Assuming 18% GST
          'Taxable Value': parseFloat(i.subtotal).toFixed(2),
          'CGST': parseFloat(i.cgst_amount || 0).toFixed(2),
          'SGST': parseFloat(i.sgst_amount || 0).toFixed(2),
          'IGST': parseFloat(i.igst_amount || 0).toFixed(2),
          'Total': parseFloat(i.total_amount).toFixed(2),
        }));

      // Format for GSTR-1 B2B (Business to Business) section
      const b2bInvoices = (result.rows || [])
        .filter((i: any) => i.customer_gstin)
        .map((i: any) => ({
          'GSTIN': i.customer_gstin,
          'Invoice Number': i.invoice_number,
          'Invoice Date': new Date(i.invoice_date).toLocaleDateString('en-IN'),
          'Invoice Value': parseFloat(i.total_amount).toFixed(2),
          'Place of Supply': i.place_of_supply,
          'Rate': '18',
          'Taxable Value': parseFloat(i.subtotal).toFixed(2),
          'IGST': parseFloat(i.igst_amount || 0).toFixed(2),
          'CGST': parseFloat(i.cgst_amount || 0).toFixed(2),
          'SGST': parseFloat(i.sgst_amount || 0).toFixed(2),
        }));

      // Summary by HSN
      const hsnSummaryQuery = `
        SELECT 
          oi.hsn_code,
          SUM(oi.quantity) as total_qty,
          SUM(oi.unit_price * oi.quantity) as taxable_value,
          SUM(oi.tax_amount) as total_tax
        FROM order_items oi
        JOIN orders o ON oi.order_id = o.id
        WHERE o.vendor_id = $1
          AND TO_CHAR(o.created_at, 'YYYY-MM') = $2
          AND oi.hsn_code IS NOT NULL
        GROUP BY oi.hsn_code
      `;
      const hsnResult = await query(hsnSummaryQuery, [vendorId, month]);

      const hsnSummary = (hsnResult.rows || []).map((h: any) => ({
        'HSN Code': h.hsn_code,
        'Total Quantity': parseInt(h.total_qty),
        'Taxable Value': parseFloat(h.taxable_value).toFixed(2),
        'Integrated Tax': '0.00',
        'Central Tax': (parseFloat(h.total_tax) / 2).toFixed(2),
        'State Tax': (parseFloat(h.total_tax) / 2).toFixed(2),
      }));

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
  const totalCgst = invoiceItems.reduce((sum, item) => sum + item.cgst, 0);
  const totalSgst = invoiceItems.reduce((sum, item) => sum + item.sgst, 0);
  const totalIgst = invoiceItems.reduce((sum, item) => sum + item.igst, 0);
  const totalTax = totalCgst + totalSgst + totalIgst;
  const shipping = parseFloat(order.shipping_fee) || 0;
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

function generateInvoiceHTML(data: InvoiceData): string {
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
    .header { display: flex; justify-content: space-between; border-bottom: 2px solid #f97316; padding-bottom: 20px; margin-bottom: 20px; }
    .header-left h1 { color: #f97316; font-size: 24px; margin-bottom: 5px; }
    .header-left p { color: #666; }
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
      <div class="header-left">
        <h1>🐾 WarmPawz</h1>
        <p>Pet Care Marketplace</p>
      </div>
      <div class="header-right">
        <h2>TAX INVOICE</h2>
        <p class="invoice-number">${data.invoiceNumber}</p>
        <p>Date: ${data.invoiceDate}</p>
        <p>Order: ${data.orderNumber}</p>
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
        <p>${data.customer.address.address_line1 || ''}</p>
        <p>${[data.customer.address.city, data.customer.address.state, data.customer.address.pincode].filter(Boolean).join(', ')}</p>
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
            <td class="text-center">${item.hsn}</td>
            <td class="text-right">${item.quantity}</td>
            <td class="text-right">₹${item.unitPrice.toFixed(2)}</td>
            <td class="text-right">₹${item.taxableValue.toFixed(2)}</td>
            ${data.isInterState 
              ? `<td class="text-right">₹${item.igst.toFixed(2)}<br><small>(${item.gstRate}%)</small></td>`
              : `<td class="text-right">₹${item.cgst.toFixed(2)}<br><small>(${item.gstRate/2}%)</small></td>
                 <td class="text-right">₹${item.sgst.toFixed(2)}<br><small>(${item.gstRate/2}%)</small></td>`}
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
