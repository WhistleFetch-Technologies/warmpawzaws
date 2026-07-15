import type { Context } from 'hono';
import * as vendor_vendorid_relocationquotes_getRepo from '../repos/vendor_vendorid_relocationquotes_get.repo';
import { Hono } from 'hono';
import { isValidUUID } from '../../../../types/entities';

export async function executevendorVendoridRelocationquotesGet(c: Context) {
    try {
      const { vendorId } = c.req.param();
      const status = c.req.query('status');

      // For relocation vendors, get all pending quotes in their service area
      let quotesQuery = `
        SELECT 
          rq.*,
          c.full_name as customer_name,
          c.phone as customer_phone
        FROM relocation_quotes rq
        LEFT JOIN customers c ON rq.customer_id = c.id
        WHERE rq.status = 'pending'
        OR rq.vendor_id = executevendorVendoridRelocationquotesGet
        ORDER BY rq.created_at DESC
      `;

      const quotes = await vendor_vendorid_relocationquotes_getRepo.dbVendorVendoridRelocationquotesGet0(quotesQuery).catch(() => ({ rows: [] }));

      return c.json({
        success: true,
        quotes: quotes.rows,
        total: quotes.rows.length,
      });
    } catch (error: any) {
      console.error('Error fetching relocation quotes:', error);
      return c.json({ success: true, quotes: [], total: 0 });
    }
}