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

export async function relocationBookPostHandler(c: Context) {
    try {
      const body = await c.req.json();
      const { quoteId, customerId, vendorId, paymentMethod } = body;

      if (!quoteId) {
        return c.json({ error: 'Quote ID is required' }, 400);
      }

      // Get quote details
      const quotes = await query(`SELECT * FROM relocation_quotes WHERE id = $1`, [quoteId]).catch(() => ({ rows: [] }));
      if (quotes.rows.length === 0) {
        return c.json({ error: 'Quote not found' }, 404);
      }

      const quote = quotes.rows[0];

      // Check if quote is still valid
      if (new Date(quote.valid_until) < new Date()) {
        return c.json({ error: 'Quote has expired. Please request a new quote.' }, 400);
      }

      // Create booking
      const booking = await insert('bookings', {
        customer_id: customerId || quote.customer_id,
        vendor_id: vendorId,
        service_type: 'pet_relocation',
        booking_date: quote.preferred_date || new Date().toISOString().split('T')[0],
        total_amount: quote.total_quote,
        status: 'pending',
        payment_method: paymentMethod || 'online',
        metadata: JSON.stringify({
          quoteId: quoteId,
          origin: quote.origin,
          destination: quote.destination,
          transportType: quote.transport_type,
          petType: quote.pet_type,
          petSize: quote.pet_size,
          numberOfPets: quote.number_of_pets,
          cageRequired: quote.cage_required,
          insuranceRequired: quote.insurance_required,
        }),
      });

      // Update quote status
      await update('relocation_quotes', { id: quoteId }, { status: 'booked', vendor_id: vendorId });

      return c.json({
        success: true,
        booking: booking[0],
        message: 'Relocation booked successfully!',
      });
    } catch (error: any) {
      console.error('Error booking relocation:', error);
      return c.json({ error: error.message }, 500);
    }
}
