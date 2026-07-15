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

export async function vendorVendoridAdoptionPetsGetHandler(c: Context) {
    try {
      const { vendorId } = c.req.param();
      const status = c.req.query('status');

      let petsQuery = `
        SELECT p.*
        FROM pets p
        WHERE p.vendor_id = $1 AND p.is_for_adoption = true
      `;

      const params: any[] = [vendorId];
      let paramIndex = 2;

      if (status) {
        petsQuery += ` AND p.adoption_status = $${paramIndex}`;
        params.push(status);
        paramIndex++;
      }

      petsQuery += ` ORDER BY p.created_at DESC`;

      const pets = await query(petsQuery, params).catch(() => ({ rows: [] }));

      return c.json({
        success: true,
        pets: pets.rows,
        total: pets.rows.length,
      });
    } catch (error: any) {
      console.error('Error fetching adoption pets:', error);
      return c.json({ success: true, pets: [], total: 0 });
    }
}
