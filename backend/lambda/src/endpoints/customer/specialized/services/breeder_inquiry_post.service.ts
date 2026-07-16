import type { Context } from 'hono';
import * as breeder_inquiry_postRepo from '../repos/breeder_inquiry_post.repo';
import { Hono } from 'hono';
import { isValidUUID } from '../../../../types/entities';

export async function executebreederInquiryPost(c: Context) {
    try {
      const body = await c.req.json();
      const { customerId, customerPhone, customerName, puppyId, message, visitDate, vendorId } = body;

      if (!puppyId) {
        return c.json({ error: 'Puppy ID is required' }, 400);
      }

      // Get puppy details
      const puppies = await breeder_inquiry_postRepo.dbBreederInquiryPost0(puppyId)
      if (puppies.rows.length === 0) {
        return c.json({ error: 'Puppy not found' }, 404);
      }

      const puppy = puppies.rows[0];
      if (!puppy.vendor_id && !vendorId) {
        return c.json({ error: 'vendorId is required' }, 400);
      }

      // Create inquiry/booking
      const inquiry = await breeder_inquiry_postRepo.dbBreederInquiryPost1(customerId, customerPhone, customerName, puppy, puppyId, visitDate, message, vendorId)

      return c.json({
        success: true,
        inquiry: inquiry[0],
        message: 'Inquiry submitted. The breeder will contact you shortly.',
      });
    } catch (error: any) {
      console.error('Error creating breeder inquiry:', error);
      return c.json({ error: error.message }, 500);
    }
}