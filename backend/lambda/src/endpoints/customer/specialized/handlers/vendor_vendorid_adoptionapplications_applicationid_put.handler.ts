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

export async function vendorVendoridAdoptionapplicationsApplicationidPutHandler(c: Context) {
    try {
      const { vendorId, applicationId } = c.req.param();
      const body = await c.req.json();
      const { status, reviewerNotes } = body;

      if (!['approved', 'rejected', 'pending', 'under_review'].includes(status)) {
        return c.json({ error: 'Invalid status' }, 400);
      }

      const updated = await update('adoption_applications',
        { id: applicationId, vendor_id: vendorId },
        {
          status: status,
          reviewer_notes: reviewerNotes,
          reviewed_at: new Date().toISOString(),
        }
      );

      // If approved, update pet status
      if (status === 'approved' && updated[0]?.pet_id) {
        await update('pets', { id: updated[0].pet_id }, { status: 'adoption_pending' });
      }

      return c.json({
        success: true,
        application: updated[0],
        message: `Application ${status} successfully`,
      });
    } catch (error: any) {
      console.error('Error updating adoption application:', error);
      return c.json({ error: error.message }, 500);
    }
}
