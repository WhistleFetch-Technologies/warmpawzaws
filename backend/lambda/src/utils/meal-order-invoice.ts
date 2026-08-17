/**
 * Build GST invoice payload from meal_orders rows (one-off + subscription sessions).
 */
import {
  buildMealTrackingSummaryLines,
  formatMealDeliveryAddressForDisplay,
} from './meal-tracking-order-payload';
import { resolveCustomerMealPlanOrderDisplayTotals, safeMoney } from './meal-order-pricing';

export interface MealOrderInvoiceItem {
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
}

export interface MealOrderInvoicePayload {
  invoiceNumber: string;
  invoiceDate: string;
  orderNumber: string;
  meal_order_id: string;
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
    address: Record<string, string>;
    gstin?: string;
  };
  items: MealOrderInvoiceItem[];
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

function parseSnap(raw: unknown): Record<string, unknown> {
  if (raw == null) return {};
  if (typeof raw === 'object' && !Array.isArray(raw)) return raw as Record<string, unknown>;
  if (typeof raw === 'string') {
    try {
      const o = JSON.parse(raw) as unknown;
      return typeof o === 'object' && o != null && !Array.isArray(o) ? (o as Record<string, unknown>) : {};
    } catch {
      return {};
    }
  }
  return {};
}

function parseAddressObject(raw: unknown): Record<string, string> {
  if (raw == null) return {};
  let obj: Record<string, unknown> | null = null;
  if (typeof raw === 'object' && !Array.isArray(raw)) obj = raw as Record<string, unknown>;
  if (typeof raw === 'string') {
    try {
      const o = JSON.parse(raw) as unknown;
      if (typeof o === 'object' && o != null && !Array.isArray(o)) obj = o as Record<string, unknown>;
    } catch {
      return { address_line1: raw.trim() };
    }
  }
  if (!obj) return {};
  const line1 = String(
    obj.address ?? obj.address_line1 ?? obj.addressLine1 ?? obj.line1 ?? '',
  ).trim();
  return {
    address_line1: line1,
    city: String(obj.city ?? '').trim(),
    state: String(obj.state ?? '').trim(),
    pincode: String(obj.pincode ?? obj.postal_code ?? obj.postalCode ?? '').trim(),
  };
}

function splitTax(isInterState: boolean, gstRate: number, taxAmount: number) {
  if (taxAmount <= 0 || gstRate <= 0) {
    return { cgst: 0, sgst: 0, igst: 0 };
  }
  if (isInterState) {
    return { cgst: 0, sgst: 0, igst: taxAmount };
  }
  const half = taxAmount / 2;
  return { cgst: half, sgst: half, igst: 0 };
}

function storedMealGstSplit(order: Record<string, unknown>): { cgst: number; sgst: number; igst: number } | null {
  const cgst = safeMoney(order.cgst_amount);
  const sgst = safeMoney(order.sgst_amount);
  const igst = safeMoney(order.igst_amount);
  if (cgst + sgst + igst <= 0.009) return null;
  return { cgst, sgst, igst };
}

function numberToWords(num: number): string {
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  const teens = [
    'Ten',
    'Eleven',
    'Twelve',
    'Thirteen',
    'Fourteen',
    'Fifteen',
    'Sixteen',
    'Seventeen',
    'Eighteen',
    'Nineteen',
  ];

  if (num === 0) return 'Zero';
  if (num < 10) return ones[num];
  if (num < 20) return teens[num - 10];
  if (num < 100) return `${tens[Math.floor(num / 10)]} ${ones[num % 10]}`.trim();
  if (num < 1000) {
    return `${ones[Math.floor(num / 100)]} Hundred ${numberToWords(num % 100)}`.trim();
  }
  if (num < 100000) {
    return `${numberToWords(Math.floor(num / 1000))} Thousand ${numberToWords(num % 1000)}`.trim();
  }
  if (num < 10000000) {
    return `${numberToWords(Math.floor(num / 100000))} Lakh ${numberToWords(num % 100000)}`.trim();
  }
  return `${numberToWords(Math.floor(num / 10000000))} Crore ${numberToWords(num % 10000000)}`.trim();
}

export function isMealOrderInvoiceEligible(order: Record<string, unknown>): boolean {
  const ps = String(order.payment_status || '').toLowerCase();
  if (ps === 'paid' || ps === 'completed') return true;
  if (ps === 'pending' || ps === 'awaiting_payment') return false;
  const status = String(order.status || '').toLowerCase();
  return ['confirmed', 'preparing', 'ready', 'out_for_delivery', 'delivered', 'cancelled'].includes(
    status,
  );
}

export function buildMealOrderInvoicePayload(params: {
  order: Record<string, unknown>;
  mealPlanName: string;
  invoiceNumber: string;
  isInterState: boolean;
}): MealOrderInvoicePayload {
  const { order, mealPlanName, invoiceNumber, isInterState } = params;
  const snap = parseSnap(order.purchase_snapshot);
  const cp = (snap.checkoutPricing ?? {}) as Record<string, unknown>;
  const gstSnap = (cp.gst ?? snap.gst) as Record<string, unknown> | undefined;
  const foodGstPct = safeMoney(gstSnap?.foodGstPct ?? gstSnap?.food_gst_pct ?? order.gst_rate);
  const deliveryGstPct = safeMoney(gstSnap?.deliveryGstPct ?? gstSnap?.delivery_gst_pct ?? 0);
  const storedSplit = storedMealGstSplit(order);
  const snapInter =
    gstSnap?.isInterState === true ||
    gstSnap?.is_inter_state === true ||
    order.is_inter_state === true ||
    order.is_inter_state === 't';
  const effectiveInterState = storedSplit
    ? storedSplit.igst > 0.009
    : typeof gstSnap?.isInterState === 'boolean'
      ? Boolean(gstSnap.isInterState)
      : isInterState;

  const { subtotal, total } = resolveCustomerMealPlanOrderDisplayTotals(order, null);
  const deliveryFee = safeMoney(order.delivery_fee ?? order.logistics_cost ?? cp.deliveryFee);
  const platformCombined = safeMoney(order.platform_fee ?? cp.platformFee);
  const taxAmount = safeMoney(
    order.tax_amount ?? gstSnap?.totalGstAmount ?? (cp.gst as Record<string, unknown> | undefined)?.totalGstAmount,
  );
  const qty = Math.max(1, Math.floor(safeMoney(order.quantity) || 1));

  const summaryLines = buildMealTrackingSummaryLines({
    order,
    subtotal,
    deliveryFee,
    platformFeeCombined: platformCombined,
    taxAmount,
    totalAmount: total,
    quantity: qty,
  });

  const lineGstPct: Record<string, number> = {
    'Meal price': foodGstPct,
    Delivery: deliveryGstPct,
    'Platform fee': 0,
    'Convenience fee': 0,
  };

  const items: MealOrderInvoiceItem[] = [];
  for (const line of summaryLines) {
    if (line.label.startsWith('GST on')) continue;
    if (line.amount <= 0 && line.label !== 'Delivery') continue;

    const gstRate = lineGstPct[line.label] ?? 0;
    const taxableValue = line.amount;
    let taxForLine = 0;
    if (line.label === 'Meal price') {
      taxForLine = safeMoney(gstSnap?.foodGstAmount ?? (taxableValue * foodGstPct) / 100);
    } else if (line.label === 'Delivery') {
      taxForLine = safeMoney(gstSnap?.deliveryGstAmount ?? (taxableValue * deliveryGstPct) / 100);
    }
    const lineSplit = splitTax(effectiveInterState, gstRate, taxForLine);
    const taxSplit =
      storedSplit && taxAmount > 0.009
        ? {
            cgst: lineSplit.cgst,
            sgst: lineSplit.sgst,
            igst: lineSplit.igst,
          }
        : lineSplit;
    const lineQty = line.label === 'Meal price' ? qty : 1;
    const unitPrice = lineQty > 0 ? taxableValue / lineQty : taxableValue;

    items.push({
      name: line.label === 'Meal price' ? mealPlanName || 'Meal plan' : line.label,
      hsn: '',
      quantity: lineQty,
      unitPrice: Math.round(unitPrice * 100) / 100,
      gstRate,
      taxableValue: Math.round(taxableValue * 100) / 100,
      ...taxSplit,
      total: Math.round((taxableValue + taxForLine) * 100) / 100,
    });
  }

  const subtotalSum = items.reduce((s, i) => s + i.taxableValue, 0);
  const cgst = items.reduce((s, i) => s + i.cgst, 0);
  const sgst = items.reduce((s, i) => s + i.sgst, 0);
  const igst = items.reduce((s, i) => s + i.igst, 0);
  const totalTax = cgst + sgst + igst;
  const grandTotal = total > 0 ? total : subtotalSum + totalTax;

  const addr = parseAddressObject(order.delivery_address);
  const placeOfSupply = addr.state || String(order.vendor_state || '');

  return {
    invoiceNumber,
    invoiceDate: new Date(
      (order.confirmed_at as string) || (order.created_at as string) || Date.now(),
    ).toLocaleDateString('en-IN'),
    orderNumber: String(order.order_number || order.id || '').trim() || String(order.id),
    meal_order_id: String(order.id),
    vendor: {
      name: String(order.vendor_name || 'Vendor'),
      gstin: String(order.vendor_gstin || order.vendor_gst || ''),
      pan: String(order.vendor_pan || ''),
      address: [
        order.vendor_address,
        order.vendor_city,
        order.vendor_state,
        order.vendor_pincode,
      ]
        .filter((x) => typeof x === 'string' && x.trim())
        .join(', '),
    },
    customer: {
      name: String(order.customer_name || 'Customer'),
      phone: String(order.customer_phone || ''),
      email: String(order.customer_email || ''),
      address: addr.address_line1
        ? addr
        : { address_line1: formatMealDeliveryAddressForDisplay(order, 'meal_orders') },
    },
    items,
    subtotal: Math.round(subtotalSum * 100) / 100,
    cgst: Math.round(cgst * 100) / 100,
    sgst: Math.round(sgst * 100) / 100,
    igst: Math.round(igst * 100) / 100,
    totalTax: Math.round(totalTax * 100) / 100,
    shipping: 0,
    discount: safeMoney(order.discount_amount),
    total: Math.round(grandTotal * 100) / 100,
    isInterState,
    placeOfSupply,
    amountInWords: numberToWords(Math.round(grandTotal)),
  };
}
