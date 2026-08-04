/**
 * Vendor earnings for UI — single source: GET /vendor/:id/earnings (vendor_earnings ledger).
 * Do not mix with GET /transactions; that route is for other screens only.
 */
import { apiClient } from './api-client';
import { clearLedgerVendorIdCache, resolveLedgerVendorId } from './vendor-ledger-id';

export type VendorEarningsTransaction = {
  id: string;
  date: string;
  service: string;
  amount: number;
  status: string;
  customer: string;
  flowType?: string;
  quotedAmount?: number;
  paidAmount?: number;
};

export type VendorEarningsSummary = {
  ledgerVendorId: string;
  today: number;
  thisWeek: number;
  thisMonth: number;
  pending: number;
  total: number;
  transactions: VendorEarningsTransaction[];
  dailyTrend: Array<{ day: string; amount: number }>;
  totalBookings: number;
  completedBookings: number;
  averageBookingValue: number;
  lastMonthEarnings: number;
};

type EarningsApiResponse = {
  success?: boolean;
  canonicalVendorId?: string;
  earnings?: {
    totalEarnings?: number;
    pendingSettlement?: number;
    pendingPayout?: number;
    thisPeriod?: number;
    transactions?: unknown[];
    dailyBreakdown?: Array<{ day?: string; date?: string; amount?: number; earnings?: number }>;
    dailyEarnings?: Array<{ day?: string; date?: string; amount?: number; earnings?: number }>;
    totalBookings?: number;
    completedBookings?: number;
    averageBookingValue?: number;
    lastMonthEarnings?: number;
  };
};

function pickEarnings(res: EarningsApiResponse | null | undefined) {
  return res?.earnings ?? {};
}

function periodAmount(res: EarningsApiResponse | null | undefined, field: 'thisPeriod' | 'totalEarnings'): number {
  const e = pickEarnings(res);
  const n = Number(e[field] ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function buildDailyTrendFromEarningTransactions(
  transactions: unknown[]
): Array<{ day: string; amount: number }> {
  const shortDay = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
  const byKey = new Map<string, number>();
  for (const t of transactions as Array<Record<string, unknown>>) {
    const raw = t?.realizedAt ?? t?.realized_at ?? t?.date ?? t?.created_at;
    if (!raw) continue;
    const d = new Date(String(raw));
    if (Number.isNaN(d.getTime())) continue;
    const key = d.toISOString().slice(0, 10);
    const a = Number(t?.amount ?? t?.price ?? 0) || 0;
    byKey.set(key, (byKey.get(key) || 0) + a);
  }
  const out: Array<{ day: string; amount: number }> = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    const amt = byKey.get(key) || 0;
    out.push({ day: shortDay[d.getDay()], amount: Math.round(amt * 100) / 100 });
  }
  return out;
}

function mapTransactionsFromEarningsApi(txSource: unknown[]): VendorEarningsTransaction[] {
  return txSource.map((t: unknown) => {
    const row = t as Record<string, unknown>;
    const credited =
      row.realizedAt ||
      row.realized_at ||
      row.createdAt ||
      row.created_at ||
      row.date ||
      new Date().toISOString();
    return {
      id: String(row.id || row.transactionId || Math.random()),
      date: String(credited),
      service:
        row.flowType === 'pay_bill'
          ? 'Pay Bill'
          : String(row.serviceName || row.service_name || row.service || 'Service'),
      amount: Number(row.amount || row.price || 0) || 0,
      status: String(row.status || 'pending').toLowerCase(),
      customer: String(row.customerName || row.customer_name || row.customer || 'Customer'),
      flowType: row.flowType ? String(row.flowType) : undefined,
      quotedAmount:
        row.quotedAmount != null ? Number(row.quotedAmount) : undefined,
      paidAmount: row.paidAmount != null ? Number(row.paidAmount) : undefined,
    };
  });
}

async function fetchEarningsPeriod(
  vendorId: string,
  period: string
): Promise<EarningsApiResponse> {
  return apiClient.get<EarningsApiResponse>(`/vendor/${vendorId}/earnings?period=${period}`);
}

/** Prefer localStorage (synced from profile) then props. */
export function resolveSessionVendorIdForEarnings(
  propVendorId?: string,
  vendorDataId?: string
): string {
  if (typeof window !== 'undefined') {
    const stored = (localStorage.getItem('vendorId') || '').trim();
    if (stored) return stored;
  }
  return (propVendorId || vendorDataId || '').trim();
}

export async function fetchVendorEarningsSummary(
  sessionVendorId: string,
  options?: { forceProfileRefresh?: boolean }
): Promise<VendorEarningsSummary> {
  if (options?.forceProfileRefresh) {
    clearLedgerVendorIdCache();
  }

  const sessionId = resolveSessionVendorIdForEarnings(sessionVendorId) || sessionVendorId;
  let ledgerVendorId = await resolveLedgerVendorId(sessionId, options);

  let [todayRes, weekRes, monthRes, lifetimeRes] = await Promise.all([
    fetchEarningsPeriod(ledgerVendorId, 'day'),
    fetchEarningsPeriod(ledgerVendorId, 'week'),
    fetchEarningsPeriod(ledgerVendorId, 'month'),
    fetchEarningsPeriod(ledgerVendorId, 'lifetime'),
  ]);

  const canonical = lifetimeRes?.canonicalVendorId;
  const lifetimeTotal = periodAmount(lifetimeRes, 'totalEarnings');
  if (lifetimeTotal === 0 && canonical && canonical !== ledgerVendorId) {
    ledgerVendorId = canonical;
    if (typeof window !== 'undefined') {
      localStorage.setItem('vendorId', canonical);
    }
    [todayRes, weekRes, monthRes, lifetimeRes] = await Promise.all([
      fetchEarningsPeriod(ledgerVendorId, 'day'),
      fetchEarningsPeriod(ledgerVendorId, 'week'),
      fetchEarningsPeriod(ledgerVendorId, 'month'),
      fetchEarningsPeriod(ledgerVendorId, 'lifetime'),
    ]);
  }

  const lifetime = pickEarnings(lifetimeRes);
  const week = pickEarnings(weekRes);
  const month = pickEarnings(monthRes);

  const txFromLifetime = Array.isArray(lifetime.transactions) ? lifetime.transactions : [];
  const txFromMonth = Array.isArray(month.transactions) ? month.transactions : [];
  const txSource = txFromLifetime.length > 0 ? txFromLifetime : txFromMonth;

  const dailyFromApi = week.dailyBreakdown || week.dailyEarnings;
  let dailyTrend: Array<{ day: string; amount: number }>;
  if (Array.isArray(dailyFromApi) && dailyFromApi.length > 0) {
    dailyTrend = dailyFromApi.map((d, index) => ({
      day: d.day || d.date || ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][index] || '',
      amount: Number(d.amount ?? d.earnings ?? 0) || 0,
    }));
  } else {
    const weekTx = Array.isArray(week.transactions) ? week.transactions : [];
    const built =
      weekTx.length > 0 ? buildDailyTrendFromEarningTransactions(weekTx) : null;
    dailyTrend =
      built && built.some((x) => x.amount > 0)
        ? built
        : [
            { day: 'Mon', amount: 0 },
            { day: 'Tue', amount: 0 },
            { day: 'Wed', amount: 0 },
            { day: 'Thu', amount: 0 },
            { day: 'Fri', amount: 0 },
            { day: 'Sat', amount: 0 },
            { day: 'Sun', amount: 0 },
          ];
  }

  return {
    ledgerVendorId,
    today: periodAmount(todayRes, 'thisPeriod'),
    thisWeek: periodAmount(weekRes, 'thisPeriod'),
    thisMonth: periodAmount(monthRes, 'thisPeriod'),
    pending:
      Number(lifetime.pendingSettlement ?? lifetime.pendingPayout ?? 0) || 0,
    total: periodAmount(lifetimeRes, 'totalEarnings'),
    transactions: mapTransactionsFromEarningsApi(txSource).slice(0, 50),
    dailyTrend,
    totalBookings: Number(lifetime.totalBookings ?? txSource.length) || 0,
    completedBookings: Number(lifetime.completedBookings ?? 0) || 0,
    averageBookingValue: Number(lifetime.averageBookingValue ?? 0) || 0,
    lastMonthEarnings: Number(lifetime.lastMonthEarnings ?? 0) || 0,
  };
}
