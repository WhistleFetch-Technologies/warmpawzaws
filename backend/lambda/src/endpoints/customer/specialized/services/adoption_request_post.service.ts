import type { Context } from 'hono';
import * as adoption_request_postRepo from '../repos/adoption_request_post.repo';
import { Hono } from 'hono';
import { isValidUUID } from '../../../../types/entities';

export async function executeadoptionRequestPost(c: Context) {
    try {
      const body = await c.req.json();
      const { customerId, customerPhone, petId, message, visitDate, visitTime } = body;

      if (!petId) {
        return c.json({ error: 'Pet ID is required' }, 400);
      }

      // Get pet details
      const pets = await adoption_request_postRepo.dbAdoptionRequestPost0(vendor_id)
      if (pets.rows.length === 0) {
        return c.json({ error: 'Pet not found' }, 404);
      }

      const pet = pets.rows[0];

      // Create booking for adoption visit
      const booking = await adoption_request_postRepo.dbAdoptionRequestPost1(customerId, customerPhone, pet, petId, visitDate, visitTime, message)

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