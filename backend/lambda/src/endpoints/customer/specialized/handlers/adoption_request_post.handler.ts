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

export async function adoptionRequestPostHandler(c: Context) {
    try {
      const body = await c.req.json();
      const { customerId, customerPhone, petId, message, visitDate, visitTime } = body;

      if (!petId) {
        return c.json({ error: 'Pet ID is required' }, 400);
      }

      // Get pet details
      const pets = await query(`SELECT id, vendor_id, name FROM pets WHERE id = $1`, [petId]);
      if (pets.rows.length === 0) {
        return c.json({ error: 'Pet not found' }, 404);
      }

      const pet = pets.rows[0];

      // Create booking for adoption visit
      const booking = await insert('bookings', {
        customer_id: customerId,
        customer_phone: customerPhone,
        vendor_id: pet.vendor_id,
        pet_id: petId,
        service_type: 'adoption_visit',
        booking_date: visitDate || new Date().toISOString().split('T')[0],
        booking_time: visitTime || '10:00',
        status: 'pending',
        notes: message || `Adoption inquiry for ${pet.name}`,
        total_amount: 0, // Adoption visits are typically free
      });

      return c.json({
        success: true,
        booking: booking[0],
        message: 'Adoption request submitted. The shelter will contact you shortly.',
      });
    } catch (error: any) {
      console.error('Error creating adoption request:', error);
      return c.json({ error: error.message }, 500);
    }
}
