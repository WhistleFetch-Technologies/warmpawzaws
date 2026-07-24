import type { Context } from 'hono';
import { dbWpayVendorsListPage } from '../repos/wpay-vendors-list.repo';
import { mapWpayVendorListRows } from './wpay-vendors-list-mapper';

const DEFAULT_LIMIT = 5;
const MAX_LIMIT = 20;

function parseLimit(raw: string | undefined): number {
  const n = parseInt(String(raw ?? ''), 10);
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_LIMIT;
  return Math.min(MAX_LIMIT, n);
}

export async function executeCustomerWarmpawzPayVendorsGet(c: Context) {
  try {
    const limit = parseLimit(c.req.query('limit'));
    const cursor = c.req.query('cursor')?.trim() || null;
    const category = c.req.query('category')?.trim() || null;

    const page = await dbWpayVendorsListPage({ limit, cursor, category });
    const vendors = await mapWpayVendorListRows(page.rows);

    return c.json({
      success: true,
      vendors,
      total: vendors.length,
      nextCursor: page.nextCursor,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to load Warmpawz Pay vendors';
    console.error('[customer/warmpawz-pay/vendors]', error);
    return c.json({ success: false, error: message }, 500);
  }
}
