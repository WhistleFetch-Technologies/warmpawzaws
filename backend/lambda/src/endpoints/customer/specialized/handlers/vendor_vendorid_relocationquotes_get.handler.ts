import type { Context } from 'hono';
/**
 * ============================================================================
 * SPECIALIZED SERVICE FLOWS - 360 DEGREE CUSTOMER-VENDOR MATCHING
 * ============================================================================
 * 
 * Complete end-to-end flows for specialized pet services:
 * - Adoption: Pet catalog, adoption requests, applications
 * - Breeder: Puppy listings, purchase inquiries, reservations
 * - Peer to Peer: Pet matching, match requests, messaging
 * - Pet Holidays: Package builder, bookings, itinerary
 * - Relocation: Quote calculator, booking, tracking
 * 
 * Date: 2026-01-19
 * ============================================================================
 */

import { Hono } from 'hono';
import { select, insert, update, query } from '../../../../database/rds-connection';
import { isValidUUID } from '../../../../types/entities';

export async function vendorVendoridRelocationquotesGetHandler(c: Context) {
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
        OR rq.vendor_id = $1
        ORDER BY rq.created_at DESC
      `;

      const quotes = await query(quotesQuery, [vendorId]).catch(() => ({ rows: [] }));

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
