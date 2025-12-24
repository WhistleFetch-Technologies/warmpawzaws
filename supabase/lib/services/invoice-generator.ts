/**
 * ============================================================================
 * INVOICE GENERATOR SERVICE
 * ============================================================================
 * 
 * Service for generating GST invoices with tax breakdown
 * 
 * RULES:
 * ❌ NO KV imports allowed
 * ✅ All operations use SQL only
 * 
 * Date: 2024-12-23
 * Migration: Phase 2, Task 2.1 - GST Invoice Generation
 * ============================================================================
 */

import { getOrdersRepository } from "../repositories/orders.ts";
import { getCustomersRepository } from "../repositories/customers.ts";
import { getVendorsRepository } from "../repositories/vendors.ts";
import { getProductsRepository } from "../repositories/products.ts";
import { getInvoicesRepository } from "../repositories/invoices.ts";
import { getDbClient } from "../db.ts";
import { calculateGST } from "./gst-calculator.ts";

export interface InvoiceItem {
  product_id?: string;
  name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  hsn_code?: string;
  gst_rate?: number;
  cgst_amount?: number;
  sgst_amount?: number;
  igst_amount?: number;
}

export interface InvoiceData {
  invoice_number: string;
  invoice_date: string;
  order_number: string;
  items: InvoiceItem[];
  billing_address: {
    name: string;
    address: string;
    city: string;
    state: string;
    pincode: string;
    phone: string;
    email?: string;
  };
  shipping_address: {
    name: string;
    address: string;
    city: string;
    state: string;
    pincode: string;
    phone: string;
  };
  vendor_details?: {
    name: string;
    address: string;
    gstin?: string;
    phone?: string;
  };
  subtotal: number;
  tax_amount: number;
  total_amount: number;
  tax_breakdown: {
    cgst: number;
    sgst: number;
    igst: number;
    by_item: Array<{
      name: string;
      hsn_code?: string;
      gst_rate: number;
      taxable_amount: number;
      cgst: number;
      sgst: number;
      igst: number;
    }>;
  };
}

export async function generateInvoiceForOrder(orderId: string): Promise<InvoiceData> {
  const ordersRepo = getOrdersRepository();
  const customersRepo = getCustomersRepository();
  const vendorsRepo = getVendorsRepository();
  const productsRepo = getProductsRepository();
  const invoicesRepo = getInvoicesRepository();
  const db = getDbClient();

  // Get order
  const order = await ordersRepo.findById(orderId);
  if (!order) {
    throw new Error(`Order not found: ${orderId}`);
  }

  // Get customer
  const customer = await customersRepo.findById(order.customer_id);
  if (!customer) {
    throw new Error(`Customer not found: ${order.customer_id}`);
  }

  // Get vendor (if exists)
  const vendor = order.vendor_id ? await vendorsRepo.findById(order.vendor_id) : null;

  // Get order items
  const { data: orderItems } = await db
    .from('order_items')
    .select('*')
    .eq('order_id', orderId);

  if (!orderItems || orderItems.length === 0) {
    throw new Error(`No items found for order: ${orderId}`);
  }

  // Build invoice items with GST calculation
  const invoiceItems: InvoiceItem[] = [];
  let totalCGST = 0;
  let totalSGST = 0;
  let totalIGST = 0;
  const taxBreakdownByItem: any[] = [];

  for (const item of orderItems) {
    let product = null;
    if (item.product_id) {
      product = await productsRepo.findById(item.product_id);
    }

    // Calculate GST using the GST calculator service
    const gstResult = await calculateGST({
      amount: item.total_price,
      category: product?.category || 'general',
      customerState: customer.state || '',
      vendorState: vendor?.state || '',
    });

    const gstRate = gstResult.rate;
    const hsnCode = product?.hsn_code;
    const cgst = gstResult.cgst;
    const sgst = gstResult.sgst;
    const igst = gstResult.igst;

    totalCGST += cgst;
    totalSGST += sgst;
    totalIGST += igst;

    invoiceItems.push({
      product_id: item.product_id || undefined,
      name: item.name,
      quantity: item.quantity,
      unit_price: item.unit_price,
      total_price: item.total_price,
      hsn_code: hsnCode,
      gst_rate: gstRate,
      cgst_amount: cgst,
      sgst_amount: sgst,
      igst_amount: igst,
    });

    taxBreakdownByItem.push({
      name: item.name,
      hsn_code: hsnCode,
      gst_rate: gstRate,
      taxable_amount: item.total_price,
      cgst,
      sgst,
      igst,
    });
  }

  // Generate invoice number
  const invoiceNumber = await invoicesRepo.generateInvoiceNumber();

  // Build invoice data
  const invoiceData: InvoiceData = {
    invoice_number: invoiceNumber,
    invoice_date: new Date().toISOString().split('T')[0],
    order_number: order.order_number,
    items: invoiceItems,
    billing_address: {
      name: customer.full_name,
      address: customer.address || '',
      city: customer.city || '',
      state: customer.state || '',
      pincode: customer.pincode || '',
      phone: customer.phone,
      email: customer.email || undefined,
    },
    shipping_address: {
      name: customer.full_name,
      address: order.shipping_address,
      city: order.shipping_city,
      state: order.shipping_state,
      pincode: order.shipping_pincode,
      phone: order.shipping_phone,
    },
    vendor_details: vendor ? {
      name: vendor.business_name || vendor.businessName || '',
      address: vendor.address || '',
      gstin: vendor.gstin || undefined,
      phone: vendor.phone || undefined,
    } : undefined,
    subtotal: order.subtotal,
    tax_amount: order.tax_amount,
    total_amount: order.total_amount,
    tax_breakdown: {
      cgst: totalCGST,
      sgst: totalSGST,
      igst: totalIGST,
      by_item: taxBreakdownByItem,
    },
  };

  // Save invoice to database
  await invoicesRepo.create({
    invoice_number: invoiceNumber,
    order_id: orderId,
    customer_id: order.customer_id,
    vendor_id: order.vendor_id || null,
    invoice_date: invoiceData.invoice_date,
    subtotal: order.subtotal,
    tax_amount: order.tax_amount,
    cgst_amount: totalCGST,
    sgst_amount: totalSGST,
    igst_amount: totalIGST,
    total_amount: order.total_amount,
    hsn_codes: invoiceItems.map(item => ({
      hsn_code: item.hsn_code,
      gst_rate: item.gst_rate,
    })).filter(item => item.hsn_code),
    tax_breakdown: invoiceData.tax_breakdown,
    invoice_data: invoiceData,
    status: 'generated',
  });

  return invoiceData;
}

