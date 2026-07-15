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

export async function vendorVendoridHolidaycustomrequestsGetHandler(c: Context) {
    try {
      const { vendorId } = c.req.param();

      const requests = await query(`
        SELECT 
          hcr.*,
          c.full_name as customer_name,
          c.phone as customer_phone
        FROM holiday_custom_requests hcr
        LEFT JOIN customers c ON hcr.customer_id = c.id
        WHERE hcr.status = 'pending_quote'
        OR hcr.vendor_id = $1
        ORDER BY hcr.created_at DESC
      `, [vendorId]).catch(() => ({ rows: [] }));

      return c.json({
        success: true,
        requests: requests.rows,
        total: requests.rows.length,
      });
    } catch (error: any) {
      console.error('Error fetching holiday custom requests:', error);
      return c.json({ success: true, requests: [], total: 0 });
    }
}
