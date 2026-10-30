/**
 * Vendor earnings for UI — single source: GET /vendor/:id/earnings (vendor_earnings ledger).
 * Do not mix with GET /transactions; that route is for other screens only.
 */
import { apiClient } from './api-client';
import { clearLedgerVendorIdCache, resolveLedgerVendorId } from './vendor-ledger-id';

export type VendorPackageEarningsBreakdown = {
  basePrice: number;
  commissionRate: number;
  vendorPool: number;
  sessionCount: number;
  sessionNumber: number;
  thisSession: number;
  remainingSessions: number;
};

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
  settlementId?: string;
  requiresBillProof?: boolean;
  billImageStatus?: 'missing' | 'uploaded';
  billVerified?: boolean;
  packageBreakdown?: VendorPackageEarningsBreakdown | null;
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
  allowDataDownload: boolean;
  nextCursor: string | null;
  hasMore: boolean;
  totalCount: number;
  pageSize: number;
};

type EarningsApiResponse = {
  success?: boolean;
  canonicalVendorId?: string;
  allowDataDownload?: boolean;
  earnings?: {
    totalEarnings?: number;
    pendingSettlement?: number;
    pendingPayout?: number;
    thisPeriod?: number;
    transactions?: unknown[];
    nextCursor?: string | null;
    hasMore?: boolean;
    totalCount?: number;
    pageSize?: number;
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

function parsePackageBreakdown(raw: unknown): VendorPackageEarningsBreakdown | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const sessionNumber = Number(o.sessionNumber ?? o.session_number ?? 0);
  if (sessionNumber !== 1) return null;
  const basePrice = Number(o.basePrice ?? o.base_price ?? 0);
  const vendorPool = Number(o.vendorPool ?? o.vendor_pool ?? 0);
  const sessionCount = Number(o.sessionCount ?? o.session_count ?? 0);
  const thisSession = Number(o.thisSession ?? o.this_session ?? 0);
  if (!(basePrice > 0) || !(sessionCount > 0)) return null;
  return {
    basePrice,
    commissionRate: Number(o.commissionRate ?? o.commission_rate ?? 0),
    vendorPool,
    sessionCount,
    sessionNumber: 1,
    thisSession,
    remainingSessions: Number(o.remainingSessions ?? o.remaining_sessions ?? Math.max(0, sessionCount - 1)),
  };
}

export function formatPayBillEarningsLabel(customerName?: string | null): string {
  const name = String(customerName || '').trim() || 'Customer';
  return `Pay Bill → ${name}`;
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
    const customer = String(row.customerName || row.customer_name || row.customer || 'Customer');
    return {
      id: String(row.id || row.transactionId || Math.random()),
      date: String(credited),
      service:
        row.flowType === 'pay_bill'
          ? formatPayBillEarningsLabel(customer)
          : String(row.serviceName || row.service_name || row.service || 'Service'),
      amount: Number(row.amount || row.price || 0) || 0,
      status: String(row.status || 'pending').toLowerCase(),
      customer,
      flowType: row.flowType ? String(row.flowType) : undefined,
      quotedAmount:
        row.quotedAmount != null ? Number(row.quotedAmount) : undefined,
      paidAmount: row.paidAmount != null ? Number(row.paidAmount) : undefined,
      settlementId: row.settlementId ? String(row.settlementId) : undefined,
      requiresBillProof: row.requiresBillProof === true,
      billImageStatus: row.billImageStatus === 'uploaded' ? 'uploaded' : row.flowType === 'pay_bill' ? 'missing' : undefined,
      billVerified: row.billVerified === true,
      packageBreakdown: parsePackageBreakdown(row.packageBreakdown ?? row.package_breakdown),
    };
  });
}

export type VendorEarningsListPeriod = 'day' | 'week' | 'month';
export type VendorEarningsVisibility = 'today' | 'week' | 'month' | 'range';

export const EARNINGS_CURSOR_PAGE_SIZE = 5;

/** Bookings → Earnings Schedule toggle maps onto GET /vendor/:id/earnings period. */
export function schedulePeriodToEarningsApiPeriod(
  period: 'today' | 'week' | 'month'
): VendorEarningsListPeriod {
  return period === 'today' ? 'day' : period;
}

export function visibilityToEarningsApiPeriod(
  period: VendorEarningsVisibility
): 'day' | 'week' | 'month' | 'range' {
  return period === 'today' ? 'day' : period;
}

export function currentIstYmd(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
}

export function currentIstYearMonth(): string {
  return currentIstYmd().slice(0, 7);
}

export function pickEarningsTransactionsForPeriod(
  byPeriod: Record<VendorEarningsListPeriod | 'lifetime', unknown[]>,
  listPeriod: VendorEarningsListPeriod
): unknown[] {
  const selected = byPeriod[listPeriod];
  return Array.isArray(selected) ? selected : [];
}

export type EarningsQueryOpts = {
  period: string;
  date?: string;
  from?: string;
  to?: string;
  yearMonth?: string;
  cursor?: string;
  limit?: number;
};

export function earningsRequestQuery(
  periodOrOpts: string | EarningsQueryOpts,
  anchorDate?: string
): string {
  const opts: EarningsQueryOpts =
    typeof periodOrOpts === 'string'
      ? { period: periodOrOpts, date: anchorDate }
      : periodOrOpts;
  const params = new URLSearchParams({ period: opts.period });
  if (opts.date && opts.period !== 'lifetime' && /^\d{4}-\d{2}-\d{2}$/.test(opts.date)) {
    params.set('date', opts.date);
  }
  if (opts.yearMonth && /^\d{4}-\d{2}$/.test(opts.yearMonth)) {
    params.set('yearMonth', opts.yearMonth);
  }
  if (opts.from && /^\d{4}-\d{2}-\d{2}$/.test(opts.from)) {
    params.set('from', opts.from);
  }
  if (opts.to && /^\d{4}-\d{2}-\d{2}$/.test(opts.to)) {
    params.set('to', opts.to);
  }
  if (opts.cursor) params.set('cursor', opts.cursor);
  if (opts.limit != null) params.set('limit', String(opts.limit));
  return params.toString();
}

async function fetchEarningsPeriod(
  vendorId: string,
  opts: EarningsQueryOpts
): Promise<EarningsApiResponse> {
  return apiClient.get<EarningsApiResponse>(
    `/vendor/${vendorId}/earnings?${earningsRequestQuery(opts)}`
  );
}

function paginationFrom(res: EarningsApiResponse | null | undefined) {
  const e = pickEarnings(res);
  return {
    nextCursor: e.nextCursor ?? null,
    hasMore: e.hasMore === true,
    totalCount: Number(e.totalCount ?? 0) || 0,
    pageSize: Number(e.pageSize ?? EARNINGS_CURSOR_PAGE_SIZE) || EARNINGS_CURSOR_PAGE_SIZE,
    allowDataDownload: res?.allowDataDownload === true,
  };
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

export type FetchVendorEarningsOptions = {
  forceProfileRefresh?: boolean;
  listPeriod?: VendorEarningsListPeriod;
  visibility?: VendorEarningsVisibility;
  /** IST calendar YYYY-MM-DD; day/week/month windows end on this date. */
  date?: string;
  yearMonth?: string;
  from?: string;
  to?: string;
  cursor?: string;
};

function listQueryFromOptions(options?: FetchVendorEarningsOptions): EarningsQueryOpts {
  if (options?.visibility === 'range') {
    return {
      period: 'range',
      from: options.from,
      to: options.to,
      cursor: options.cursor,
      limit: EARNINGS_CURSOR_PAGE_SIZE,
    };
  }
  const period = options?.visibility
    ? visibilityToEarningsApiPeriod(options.visibility)
    : options?.listPeriod || 'lifetime';
  return {
    period,
    date: options?.date,
    yearMonth: period === 'month' ? options?.yearMonth : undefined,
    cursor: options.cursor,
    limit: EARNINGS_CURSOR_PAGE_SIZE,
  };
}

export async function fetchVendorEarningsPage(
  sessionVendorId: string,
  options?: FetchVendorEarningsOptions
): Promise<{
  ledgerVendorId: string;
  transactions: VendorEarningsTransaction[];
  nextCursor: string | null;
  hasMore: boolean;
  totalCount: number;
  pageSize: number;
  allowDataDownload: boolean;
}> {
  const sessionId = resolveSessionVendorIdForEarnings(sessionVendorId) || sessionVendorId;
  const ledgerVendorId = await resolveLedgerVendorId(sessionId, options);
  const res = await fetchEarningsPeriod(ledgerVendorId, listQueryFromOptions(options));
  const page = paginationFrom(res);
  const tx = Array.isArray(res.earnings?.transactions) ? res.earnings.transactions : [];
  return {
    ledgerVendorId,
    transactions: mapTransactionsFromEarningsApi(tx),
    ...page,
  };
}

export async function fetchVendorEarningsSummary(
  sessionVendorId: string,
  options?: FetchVendorEarningsOptions
): Promise<VendorEarningsSummary> {
  if (options?.forceProfileRefresh) {
    clearLedgerVendorIdCache();
  }

  const sessionId = resolveSessionVendorIdForEarnings(sessionVendorId) || sessionVendorId;
  let ledgerVendorId = await resolveLedgerVendorId(sessionId, options);
  const listQuery = listQueryFromOptions(options);
  const cardLimit = 0;

  const loadCardsAndList = (vendorId: string) =>
    Promise.all([
      fetchEarningsPeriod(vendorId, { period: 'day', limit: cardLimit }),
      fetchEarningsPeriod(vendorId, { period: 'week', limit: cardLimit }),
      fetchEarningsPeriod(vendorId, {
        period: 'month',
        yearMonth: options?.yearMonth,
        limit: cardLimit,
      }),
      fetchEarningsPeriod(vendorId, { period: 'lifetime', limit: cardLimit }),
      fetchEarningsPeriod(vendorId, listQuery),
    ]);

  let [todayRes, weekRes, monthRes, lifetimeRes, listRes] = await loadCardsAndList(ledgerVendorId);

  const canonical = lifetimeRes?.canonicalVendorId;
  const lifetimeTotal = periodAmount(lifetimeRes, 'totalEarnings');
  if (lifetimeTotal === 0 && canonical && canonical !== ledgerVendorId) {
    ledgerVendorId = canonical;
    if (typeof window !== 'undefined') {
      localStorage.setItem('vendorId', canonical);
    }
    [todayRes, weekRes, monthRes, lifetimeRes, listRes] = await loadCardsAndList(ledgerVendorId);
  }

  const lifetime = pickEarnings(lifetimeRes);
  const week = pickEarnings(weekRes);
  const listEarnings = pickEarnings(listRes);
  const page = paginationFrom(listRes);
  const txSource = Array.isArray(listEarnings.transactions) ? listEarnings.transactions : [];

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
    transactions: mapTransactionsFromEarningsApi(txSource),
    dailyTrend,
    totalBookings: Number(listEarnings.totalCount ?? lifetime.totalBookings ?? txSource.length) || 0,
    completedBookings: Number(lifetime.completedBookings ?? 0) || 0,
    averageBookingValue: Number(lifetime.averageBookingValue ?? 0) || 0,
    lastMonthEarnings: Number(lifetime.lastMonthEarnings ?? 0) || 0,
    allowDataDownload: page.allowDataDownload,
    nextCursor: page.nextCursor,
    hasMore: page.hasMore,
    totalCount: page.totalCount,
    pageSize: page.pageSize,
  };
}

export function vendorEarningsExportPath(
  vendorId: string,
  options?: FetchVendorEarningsOptions
): string {
  const query = listQueryFromOptions(options);
  delete query.cursor;
  delete query.limit;
  return `/vendor/${vendorId}/earnings/export.xlsx?${earningsRequestQuery(query)}`;
}
