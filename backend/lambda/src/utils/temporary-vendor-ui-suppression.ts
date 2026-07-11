/**
 * Temporary vendor suppression till fixed cutoff date (IST).
 * Hides bookings / settlements / vendor earnings on or before the cutoff for listed vendors
 * from admin and vendor UIs only — no DB deletes. Bookings after the cutoff (including today) show normally.
 * Remove this module’s usage once the cleanup window is past.
 */

/** Last calendar day (IST) hidden for TEMPORARY_SUPPRESSED_VENDOR_IDS; bookings after this date are visible. */
export const TEMPORARY_SUPPRESSED_CUTOFF_DATE_IST = '2026-05-25';

/** Specific bookings hidden from vendor-web and admin-web only (no DB deletes). */
export const UI_HIDDEN_BOOKING_IDS: readonly string[] = [
	'e77e3faa-9b90-4187-94d7-7e50c6ae3b73',
];

export const TEMPORARY_SUPPRESSED_VENDOR_IDS: readonly string[] = [
	'191568e6-2139-4675-9cd4-adb95a27c8b5',
	'426fb107-76cc-4b64-931a-ed2d924628e0',
	'45104431-dca6-4073-ab8d-b20f5003d19e',
	'6e0f8ea7-31ed-4242-b395-e995e17b3ed4',
	'9b87f7da-4b7e-44da-9324-291ef79fb551',
	'040f49a3-58e9-4da3-a220-74e4c1ad5fb7',
	'7c826be1-70b9-465e-8156-c258bfb3a6f7',
	'bd489856-97bb-436f-9e1f-cb8b86460d29',
	'c630354a-529d-49f4-a975-776e481c3aa1',
	'216246dc-4f30-4e72-9c47-23b61197f5e6',
	'51111e34-5327-4c7e-b46e-61eb9a7be4d8',
	'a9bf1007-cf4c-4050-b926-f2c47e1b657f',
	'75eeb757-a719-4b5f-9b81-6d8fbd69cec3',
	'ad1b7f84-1ed4-4c96-a0a4-40d14fc1c1f6',
];

/** Params for `query(..., params)` when suppression is active. */
export function getTemporaryVendorSuppressionParams(): {
	vendorIds: string[];
	cutoffDateIst: string;
} | null {
	if (TEMPORARY_SUPPRESSED_VENDOR_IDS.length === 0) return null;
	return {
		vendorIds: [...TEMPORARY_SUPPRESSED_VENDOR_IDS],
		cutoffDateIst: TEMPORARY_SUPPRESSED_CUTOFF_DATE_IST,
	};
}

function sqlExcludeUiHiddenBookingIdsInline(bookingAlias: string): string | null {
	if (UI_HIDDEN_BOOKING_IDS.length === 0) return null;
	const literals = UI_HIDDEN_BOOKING_IDS.map((id) => `'${id}'`).join(', ');
	return `NOT (${bookingAlias}.id = ANY(ARRAY[${literals}]::uuid[]))`;
}

/**
 * SQL predicate: hide listed booking ids (inline) and optionally vendor+date suppression.
 * Vendor/date bind params are optional; hidden booking ids need no params.
 */
export function sqlExcludeSuppressedBookingRows(
	bookingAlias: string,
	paramVendor?: number,
	paramDate?: number,
): string {
	const parts: string[] = [];
	const hidden = sqlExcludeUiHiddenBookingIdsInline(bookingAlias);
	if (hidden) parts.push(hidden);
	if (paramVendor != null && paramDate != null) {
		parts.push(`NOT (
    ${bookingAlias}.vendor_id = ANY($${paramVendor}::uuid[])
    AND COALESCE(${bookingAlias}.booking_date, (timezone('Asia/Kolkata', ${bookingAlias}.created_at))::date) <= $${paramDate}::date
  )`);
	}
	if (parts.length === 0) return 'TRUE';
	return parts.join(' AND ');
}

/** ` AND (...)` for booking queries; empty when nothing to exclude. */
export function sqlAndExcludeSuppressedBookingRows(
	bookingAlias: string,
	paramVendor?: number,
	paramDate?: number,
): string {
	const clause = sqlExcludeSuppressedBookingRows(bookingAlias, paramVendor, paramDate);
	return clause === 'TRUE' ? '' : ` AND ${clause}`;
}

/**
 * SQL fragment for settlement rows. Uses period end dates when present (DATE columns), else created_at in IST.
 * Pass a table-qualified alias when the query uses JOINs (e.g. `s`); for `FROM settlements` use `settlements`.
 */
export function sqlExcludeSuppressedSettlementRows(
	alias: string,
	paramVendor: number,
	paramDate: number,
): string {
	return `NOT (
    ${alias}.vendor_id = ANY($${paramVendor}::uuid[])
    AND COALESCE(${alias}.settlement_period_end, (timezone('Asia/Kolkata', ${alias}.created_at))::date) <= $${paramDate}::date
  )`;
}

/** Payments / e‑commerce orders: include NULL vendor_id rows; exclude suppressed vendors by payment/order created_at (IST). */
export function sqlExcludeSuppressedVendorCreatedRows(
	alias: string,
	paramVendor: number,
	paramDate: number,
): string {
	return `(${alias}.vendor_id IS NULL OR NOT (
    ${alias}.vendor_id = ANY($${paramVendor}::uuid[])
    AND (timezone('Asia/Kolkata', ${alias}.created_at))::date <= $${paramDate}::date
  ))`;
}

/** vendor_earnings: hide rows tied to suppressed vendors realized on/before IST cutoff */
export function sqlExcludeSuppressedVendorEarningsRows(
	alias: string,
	paramVendor: number,
	paramDate: number,
): string {
	return `NOT (
    ${alias}.vendor_id = ANY($${paramVendor}::uuid[])
    AND COALESCE(
      (timezone('Asia/Kolkata', ${alias}.realized_at))::date,
      (timezone('Asia/Kolkata', ${alias}.created_at))::date
    ) <= $${paramDate}::date
  )`;
}

function bookingReferenceDayForUiSuppression(row: {
	booking_date?: unknown;
	created_at?: unknown;
}): string | null {
	const bd = row.booking_date;
	if (bd != null && bd !== '') {
		return toBookingDateOnlyString(bd);
	}
	const ca = row.created_at;
	if (ca != null && ca !== '') {
		return new Intl.DateTimeFormat('en-CA', {
			timeZone: 'Asia/Kolkata',
			year: 'numeric',
			month: '2-digit',
			day: '2-digit',
		}).format(new Date(ca as string | Date));
	}
	return null;
}

/** DATE column strings or Date from pg driver (UTC midnight → calendar day). */
function toBookingDateOnlyString(raw: unknown): string | null {
	if (raw == null || raw === '') return null;
	if (typeof raw === 'string') {
		const head = raw.slice(0, 10);
		if (/^\d{4}-\d{2}-\d{2}$/.test(head)) return head;
		return new Intl.DateTimeFormat('en-CA', {
			timeZone: 'Asia/Kolkata',
			year: 'numeric',
			month: '2-digit',
			day: '2-digit',
		}).format(new Date(raw));
	}
	const d = raw as Date;
	const y = d.getUTCFullYear();
	const m = String(d.getUTCMonth() + 1).padStart(2, '0');
	const day = String(d.getUTCDate()).padStart(2, '0');
	return `${y}-${m}-${day}`;
}

export function isUiHiddenBookingId(id: unknown): boolean {
	if (id == null || id === '') return false;
	return UI_HIDDEN_BOOKING_IDS.includes(String(id));
}

/** Hide vendor booking rows (used when data comes from KV/select without SQL suppression). */
export function shouldHideBookingRowFromVendorUi(row: {
	id?: string | null;
	vendor_id?: string | null;
	booking_date?: unknown;
	created_at?: unknown;
}): boolean {
	if (isUiHiddenBookingId(row.id)) return true;
	const sup = getTemporaryVendorSuppressionParams();
	if (!sup || row.vendor_id == null || row.vendor_id === '') return false;
	if (!sup.vendorIds.includes(String(row.vendor_id))) return false;
	const ref = bookingReferenceDayForUiSuppression(row);
	if (!ref) return false;
	return ref <= sup.cutoffDateIst;
}

export function filterBookingsTemporarySuppression<T extends { vendor_id?: string | null; booking_date?: unknown; created_at?: unknown }>(
	rows: T[],
): T[] {
	const sup = getTemporaryVendorSuppressionParams();
	if (!sup) return rows;
	return rows.filter((r) => !shouldHideBookingRowFromVendorUi(r));
}

/** vendor_earnings row (joined or raw): hide realized/created date on or before IST cutoff when vendor is suppressed. */
export function shouldHideVendorEarningsRowFromVendorUi(row: {
	vendor_id?: string | null;
	realized_at?: string | Date | null;
	created_at?: string | Date | null;
}): boolean {
	const sup = getTemporaryVendorSuppressionParams();
	if (!sup || row.vendor_id == null || row.vendor_id === '') return false;
	if (!sup.vendorIds.includes(String(row.vendor_id))) return false;
	const refDay =
		row.realized_at != null
			? new Intl.DateTimeFormat('en-CA', {
					timeZone: 'Asia/Kolkata',
					year: 'numeric',
					month: '2-digit',
					day: '2-digit',
				}).format(new Date(row.realized_at))
			: row.created_at != null
				? new Intl.DateTimeFormat('en-CA', {
						timeZone: 'Asia/Kolkata',
						year: 'numeric',
						month: '2-digit',
						day: '2-digit',
					}).format(new Date(row.created_at))
				: null;
	if (!refDay) return false;
	return refDay <= sup.cutoffDateIst;
}

function toIsoDateOnlyFromDb(raw: string | Date | null | undefined): string | null {
	if (raw == null) return null;
	if (typeof raw === 'string') {
		const head = raw.slice(0, 10);
		if (/^\d{4}-\d{2}-\d{2}$/.test(head)) return head;
		const d = new Date(raw);
		if (!Number.isNaN(d.getTime())) {
			return new Intl.DateTimeFormat('en-CA', {
				timeZone: 'Asia/Kolkata',
				year: 'numeric',
				month: '2-digit',
				day: '2-digit',
			}).format(d);
		}
		return null;
	}
	const d = raw as Date;
	const y = d.getUTCFullYear();
	const m = String(d.getUTCMonth() + 1).padStart(2, '0');
	const day = String(d.getUTCDate()).padStart(2, '0');
	return `${y}-${m}-${day}`;
}

/** Used by GET /settlements/:id to avoid surfacing suppressed historical rows via direct id. */
export function shouldHideSettlementRowFromAdminUi(row: {
	vendor_id?: string | null;
	settlement_period_end?: string | Date | null;
	created_at?: string | Date | null;
}): boolean {
	const sup = getTemporaryVendorSuppressionParams();
	if (!sup || !row.vendor_id) return false;
	if (!sup.vendorIds.includes(String(row.vendor_id))) return false;
	const endRaw = row.settlement_period_end;
	const refDay =
		endRaw != null
			? toIsoDateOnlyFromDb(endRaw)
			: row.created_at != null
				? toIsoDateOnlyFromDb(row.created_at)
				: null;
	if (!refDay) return false;
	return refDay <= sup.cutoffDateIst;
}
