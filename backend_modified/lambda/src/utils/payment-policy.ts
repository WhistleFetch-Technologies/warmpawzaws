import { query, select } from '../database/rds-connection';

export type PaymentRule = {
  id: string;
  name?: string;
  vendorTypes?: string[];
  serviceLocation?: 'at_home' | 'at_center' | 'tele' | 'both';
  reservationType?: 'flat' | 'percentage' | 'full';
  reservationPercentage?: number;
  flatAmount?: number;
  minimumAdvancePayment?: number;
  partialPaymentAllowed?: boolean;
  isActive?: boolean;
};

export type PaymentPolicyResult = {
  rule: PaymentRule | null;
  requiredUpfront: number;
  allowsZeroUpfront: boolean;
  isPartialAllowed: boolean;
  reason: string;
};

function normalizeVendorType(value?: string | null): string | null {
  if (!value) return null;
  return String(value).trim().toLowerCase();
}

function normalizeServiceLocation(serviceType?: string | null): 'at_home' | 'at_center' | 'tele' {
  const normalized = String(serviceType || '').toLowerCase();
  if (normalized === 'tele' || normalized === 'online') return 'tele';
  if (normalized === 'at_home') return 'at_home';
  // Treat tele/online/at_vendor as at_center for policy matching
  return 'at_center';
}

function ruleMatchesService(rule: PaymentRule, serviceLocation: 'at_home' | 'at_center' | 'tele'): boolean {
  const ruleLocation = rule.serviceLocation || 'both';
  if (ruleLocation === 'both') return true;
  return ruleLocation === serviceLocation;
}

function ruleMatchesVendor(rule: PaymentRule, vendorType: string | null): boolean {
  const types = (rule.vendorTypes || []).map((t) => String(t).toLowerCase());
  if (types.length === 0) return false;
  if (!vendorType) return false;
  return types.includes(vendorType);
}

export async function getPaymentRules(): Promise<PaymentRule[]> {
  const settings = await select('platform_settings', { setting_key: 'admin:settings:payment_rules' });
  if (settings.length === 0) return [];
  const raw = settings[0]?.setting_value;
  if (!raw || !Array.isArray(raw)) return [];
  return raw as PaymentRule[];
}

export async function resolvePaymentPolicy(params: {
  vendorId?: string | null;
  vendorType?: string | null;
  serviceType?: string | null;
  totalAmount: number;
}): Promise<PaymentPolicyResult> {
  const totalAmount = Math.max(0, Number(params.totalAmount) || 0);
  const vendorType = normalizeVendorType(params.vendorType);
  const serviceLocation = normalizeServiceLocation(params.serviceType);
  const rules = await getPaymentRules();

  const matching = rules.filter((rule) => {
    if (rule.isActive === false) return false;
    return ruleMatchesVendor(rule, vendorType) && ruleMatchesService(rule, serviceLocation);
  });

  const rule = matching.length > 0 ? matching[0] : null;

  if (!rule) {
    return {
      rule: null,
      requiredUpfront: totalAmount,
      allowsZeroUpfront: totalAmount === 0,
      isPartialAllowed: false,
      reason: 'default_full_upfront',
    };
  }

  const reservationType = rule.reservationType || 'full';
  const partialAllowed = rule.partialPaymentAllowed !== false;

  let required = totalAmount;
  if (!partialAllowed) {
    required = totalAmount;
  } else if (reservationType === 'full') {
    required = totalAmount;
  } else if (reservationType === 'percentage') {
    const pct = Number(rule.reservationPercentage) || 0;
    required = totalAmount * (pct / 100);
  } else if (reservationType === 'flat') {
    required = Number(rule.flatAmount) || 0;
  }

  const minimumAdvance = Number(rule.minimumAdvancePayment) || 0;
  if (minimumAdvance > 0) {
    required = Math.max(required, minimumAdvance);
  }

  required = Math.min(Math.max(0, required), totalAmount);

  return {
    rule,
    requiredUpfront: required,
    allowsZeroUpfront: required === 0,
    isPartialAllowed: partialAllowed,
    reason: 'rule_applied',
  };
}

export async function getCompletedPayment(params: {
  paymentId?: string | null;
  razorpayPaymentId?: string | null;
  razorpayOrderId?: string | null;
  customerId?: string | null;
  vendorId?: string | null;
}): Promise<any | null> {
  const clauses: string[] = [];
  const values: any[] = [];
  let idx = 1;

  if (params.paymentId) {
    clauses.push(`id = $${idx++}`);
    values.push(params.paymentId);
  } else if (params.razorpayPaymentId) {
    clauses.push(`razorpay_payment_id = $${idx++}`);
    values.push(params.razorpayPaymentId);
  } else if (params.razorpayOrderId) {
    clauses.push(`razorpay_order_id = $${idx++}`);
    values.push(params.razorpayOrderId);
  } else {
    return null;
  }

  if (params.customerId) {
    clauses.push(`customer_id = $${idx++}`);
    values.push(params.customerId);
  }

  if (params.vendorId) {
    clauses.push(`vendor_id = $${idx++}`);
    values.push(params.vendorId);
  }

  clauses.push(`payment_status = 'completed'`);

  const where = clauses.join(' AND ');
  const result = await query(`SELECT * FROM payments WHERE ${where} ORDER BY created_at DESC LIMIT 1`, values).catch(() => ({ rows: [] }));
  return result.rows?.[0] || null;
}

export async function getTotalPaidForBooking(bookingId: string): Promise<number> {
  const result = await query(
    `SELECT COALESCE(SUM(amount), 0) as total_paid
     FROM payments
     WHERE booking_id = $1 AND payment_status = 'completed'`,
    [bookingId]
  ).catch(() => ({ rows: [{ total_paid: '0' }] }));

  return parseFloat(result.rows?.[0]?.total_paid || '0') || 0;
}
