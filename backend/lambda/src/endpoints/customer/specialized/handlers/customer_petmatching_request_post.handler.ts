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

export async function customerPetmatchingRequestPostHandler(c: Context) {
    try {
      const body = await c.req.json();
      const { fromPetId, toPetId, fromCustomerId, message } = body;

      if (!fromPetId || !toPetId) {
        return c.json({ error: 'Both pet IDs are required' }, 400);
      }

      if (!fromCustomerId || !isValidUUID(fromCustomerId)) {
        return c.json({ error: 'fromCustomerId (valid UUID) is required' }, 400);
      }

      const ownerCheck = await query(
        `SELECT id FROM pets WHERE id = $1 AND customer_id = $2::uuid`,
        [fromPetId, fromCustomerId]
      );
      if (ownerCheck.rows.length === 0) {
        return c.json({ error: 'fromPetId must be one of your pets' }, 403);
      }

      // Get target pet owner
      const targetPet = await query(`SELECT customer_id FROM pets WHERE id = $1`, [toPetId]);
      if (targetPet.rows.length === 0) {
        return c.json({ error: 'Target pet not found' }, 404);
      }

      const toCustomerId = targetPet.rows[0].customer_id;
      if (toCustomerId && String(toCustomerId) === String(fromCustomerId)) {
        return c.json({ error: 'Cannot send a match request to your own pet' }, 400);
      }

      // Create match request
      const matchRequest = await insert('mating_requests', {
        from_pet_id: fromPetId,
        to_pet_id: toPetId,
        from_customer_id: fromCustomerId,
        to_customer_id: toCustomerId,
        message: message,
        status: 'pending',
      }).catch(async () => {
        // Create table if not exists
        await query(`
          CREATE TABLE IF NOT EXISTS mating_requests (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            from_pet_id UUID NOT NULL,
            to_pet_id UUID NOT NULL,
            from_customer_id UUID,
            to_customer_id UUID,
            message TEXT,
            status VARCHAR(50) DEFAULT 'pending',
            accepted_at TIMESTAMP,
            declined_at TIMESTAMP,
            created_at TIMESTAMP DEFAULT NOW(),
            updated_at TIMESTAMP DEFAULT NOW()
          )
        `);
        return insert('mating_requests', {
          from_pet_id: fromPetId,
          to_pet_id: toPetId,
          from_customer_id: fromCustomerId,
          to_customer_id: toCustomerId,
          message: message,
          status: 'pending',
        });
      });

      return c.json({
        success: true,
        request: matchRequest[0],
        message: 'Match request sent successfully!',
      });
    } catch (error: any) {
      console.error('Error creating match request:', error);
      return c.json({ error: error.message }, 500);
    }
}
