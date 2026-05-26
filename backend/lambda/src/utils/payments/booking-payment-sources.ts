import { query } from '../../database/rds-connection';

export interface BookingPaymentSource {
  method: string;
  label: string;
  amount: number;
}

export function formatGatewayLabel(method: string): string {
  const m = method.toLowerCase();
  switch (m) {
    case 'wallet':
      return 'Warmpawz Wallet';
    case 'upi':
      return 'UPI';
    case 'card':
      return 'Card';
    case 'netbanking':
      return 'Net Banking';
    case 'cod':
      return 'Cash on Delivery';
    case 'razorpay':
      return 'Online Payment';
    default:
      return m.charAt(0).toUpperCase() + m.slice(1).replace(/_/g, ' ');
  }
}

function buildSourcesForBooking(
  bookingId: string,
  totalPaid: number,
  walletTotal: number,
  gatewayMethod: string | null
): BookingPaymentSource[] {
  const sources: BookingPaymentSource[] = [];
  const walletRounded = Math.round(walletTotal * 100) / 100;
  if (walletRounded > 0.009) {
    sources.push({ method: 'wallet', label: 'Warmpawz Wallet', amount: walletRounded });
  }

  const gatewayAmount =
    totalPaid > 0
      ? Math.max(0, Math.round((totalPaid - walletRounded) * 100) / 100)
      : 0;

  if (gatewayAmount > 0.009) {
    sources.push({
      method: gatewayMethod || 'razorpay',
      label: formatGatewayLabel(gatewayMethod || 'razorpay'),
      amount: gatewayAmount,
    });
  } else if (sources.length === 0 && totalPaid > 0.009) {
    sources.push({
      method: gatewayMethod || 'razorpay',
      label: formatGatewayLabel(gatewayMethod || 'razorpay'),
      amount: Math.round(totalPaid * 100) / 100,
    });
  }

  return sources;
}

function pickGatewayMethod(existing: string | null | undefined, candidate: string): string {
  const c = String(candidate || '').toLowerCase();
  if (!c || c === 'wallet') return existing || 'razorpay';
  if (!existing || existing === 'razorpay') {
    return c === 'razorpay' ? (existing || 'razorpay') : c;
  }
  return existing;
}

/**
 * Resolve how a booking was paid (wallet slice + gateway slice) for customer-facing UI.
 */
export async function resolveBookingPaymentSources(
  bookingId: string,
  totalAmountHint?: number | null
): Promise<BookingPaymentSource[]> {
  let walletTotal = 0;
  let gatewayMethod: string | null = null;

  try {
    const wt = await query<{ total: string }>(
      `SELECT COALESCE(SUM(amount::numeric), 0)::text AS total
       FROM wallet_transactions
       WHERE booking_id = $1::uuid AND transaction_type = 'debit'`,
      [bookingId]
    );
    walletTotal = parseFloat(String(wt.rows[0]?.total ?? '0')) || 0;
  } catch {
    /* wallet_transactions may lack booking_id in older schemas */
  }

  try {
    const pr = await query<{ payment_method: string; amount: string; total_amount: string | null }>(
      `SELECT payment_method, amount, total_amount
       FROM payments
       WHERE booking_id = $1::uuid AND payment_status = 'completed'
       ORDER BY created_at ASC`,
      [bookingId]
    );
    for (const row of pr.rows) {
      const method = String(row.payment_method || '').toLowerCase();
      if (method === 'wallet') {
        if (walletTotal <= 0.009) {
          walletTotal = parseFloat(String(row.total_amount ?? row.amount ?? '0')) || 0;
        }
      } else {
        gatewayMethod = pickGatewayMethod(gatewayMethod, method);
      }
    }
  } catch {
    /* non-fatal */
  }

  const totalPaid =
    totalAmountHint != null && Number.isFinite(Number(totalAmountHint)) && Number(totalAmountHint) > 0
      ? Number(totalAmountHint)
      : 0;

  const walletRounded = Math.round(walletTotal * 100) / 100;
  let gatewayAmount =
    totalPaid > 0
      ? Math.max(0, Math.round((totalPaid - walletRounded) * 100) / 100)
      : 0;

  if ((!gatewayMethod || gatewayMethod === 'razorpay') && gatewayAmount > 0.009) {
    try {
      const rp = await query<{ razorpay_payment_id: string | null }>(
        `SELECT razorpay_payment_id FROM payments
         WHERE booking_id = $1::uuid AND razorpay_payment_id IS NOT NULL
         ORDER BY created_at DESC LIMIT 1`,
        [bookingId]
      );
      const pid = rp.rows[0]?.razorpay_payment_id;
      if (pid) {
        const { fetchRazorpayPaymentMethod } = await import('./razorpay-client');
        const resolved = await fetchRazorpayPaymentMethod(String(pid));
        if (resolved) gatewayMethod = resolved;
      }
    } catch {
      /* non-fatal */
    }
  }

  return buildSourcesForBooking(bookingId, totalPaid, walletTotal, gatewayMethod);
}

/** Batch resolve payment sources for booking list screens. */
export async function resolveBookingPaymentSourcesBatch(
  bookings: Array<{ id: string; total_amount?: number | string | null }>
): Promise<Map<string, BookingPaymentSource[]>> {
  const result = new Map<string, BookingPaymentSource[]>();
  if (!bookings.length) return result;

  const ids = bookings.map((b) => b.id).filter(Boolean);
  const totalById = new Map(
    bookings.map((b) => [b.id, parseFloat(String(b.total_amount ?? '0')) || 0])
  );

  const walletById = new Map<string, number>();
  try {
    const wt = await query<{ booking_id: string; total: string }>(
      `SELECT booking_id::text, COALESCE(SUM(amount::numeric), 0)::text AS total
       FROM wallet_transactions
       WHERE booking_id = ANY($1::uuid[]) AND transaction_type = 'debit'
       GROUP BY booking_id`,
      [ids]
    );
    for (const row of wt.rows) {
      walletById.set(row.booking_id, parseFloat(row.total) || 0);
    }
  } catch {
    /* non-fatal */
  }

  const gatewayMethodById = new Map<string, string>();
  try {
    const pr = await query<{ booking_id: string; payment_method: string }>(
      `SELECT booking_id::text, payment_method
       FROM payments
       WHERE booking_id = ANY($1::uuid[]) AND payment_status = 'completed'
       ORDER BY created_at ASC`,
      [ids]
    );
    for (const row of pr.rows) {
      const m = String(row.payment_method || '').toLowerCase();
      if (m === 'wallet') continue;
      gatewayMethodById.set(
        row.booking_id,
        pickGatewayMethod(gatewayMethodById.get(row.booking_id), m)
      );
    }
  } catch {
    /* non-fatal */
  }

  for (const id of ids) {
    const sources = buildSourcesForBooking(
      id,
      totalById.get(id) || 0,
      walletById.get(id) || 0,
      gatewayMethodById.get(id) || null
    );
    if (sources.length) result.set(id, sources);
  }

  return result;
}
