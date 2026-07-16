import type { Context } from 'hono';
import * as relocation_book_postRepo from '../repos/relocation_book_post.repo';
import { Hono } from 'hono';
import { isValidUUID } from '../../../../types/entities';

export async function executerelocationBookPost(c: Context) {
    try {
      const body = await c.req.json();
      const { quoteId, customerId, vendorId, paymentMethod } = body;

      if (!quoteId) {
        return c.json({ error: 'Quote ID is required' }, 400);
      }

      // Get quote details
      const quotes = await relocation_book_postRepo.dbRelocationBookPost0(quoteId).catch(() => ({ rows: [] }));
      if (quotes.rows.length === 0) {
        return c.json({ error: 'Quote not found' }, 404);
      }

      const quote = quotes.rows[0];

      // Check if quote is still valid
      if (new Date(quote.valid_until) < new Date()) {
        return c.json({ error: 'Quote has expired. Please request a new quote.' }, 400);
      }

      // Create booking
      const booking = await relocation_book_postRepo.dbRelocationBookPost1(customerId, vendorId, quote, paymentMethod, JSON, quoteId)

      // Update quote status
      await relocation_book_postRepo.dbRelocationBookPost2(quoteId, vendorId)

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