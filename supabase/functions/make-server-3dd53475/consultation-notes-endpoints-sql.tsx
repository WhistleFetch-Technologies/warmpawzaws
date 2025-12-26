/**
 * CONSULTATION NOTES ENDPOINTS (SQL-ONLY VERSION)
 * 
 * REFACTORED: Removed all KV usage, using SQL repositories only
 * 
 * CHANGES:
 * - Removed `kv` import
 * - Replaced all `kv.get()`, `kv.set()` with SQL repository calls
 * - All data now comes from SQL tables (bookings, consultation_notes)
 * 
 * Date: 2025-01-27
 * Migration: Batch 8 - Complete KV to SQL Migration
 */

import { Hono } from 'npm:hono';
import { sendSuccess, sendError } from './response-utils.ts';
import { getBookingsRepository } from '../../lib/repositories/bookings.ts';
import { getDbClient } from '../../lib/db.ts';

export function consultationNotesEndpointsSQL(app: Hono) {
  const BASE_PATH = "/make-server-3dd53475";
  const bookingsRepo = getBookingsRepository();
  const client = getDbClient();

  /**
   * POST /consultation/notes
   * Save consultation notes for a booking
   */
  app.post(`${BASE_PATH}/consultation/notes`, async (c) => {
    try {
      const { bookingId, notes, authorId, authorType } = await c.req.json();

      console.log(`📝 [CONSULTATION-NOTES] Saving notes for booking: ${bookingId}`);

      if (!bookingId || !notes) {
        return sendError(c, 'Missing required fields', 400);
      }

      // ✅ SQL: Verify booking exists
      const booking = await bookingsRepo.findById(bookingId);
      if (!booking) {
        return sendError(c, 'Booking not found', 404);
      }

      // ✅ SQL: Create consultation note
      const noteId = `note_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      const now = new Date().toISOString();

      const { data: note, error } = await client
        .from('consultation_notes')
        .insert({
          id: noteId,
          booking_id: bookingId,
          content: notes,
          author_id: authorId,
          author_type: authorType || 'staff', // 'vendor' or 'staff'
          created_at: now,
          updated_at: now
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating consultation note:', error);
        return sendError(c, 'Failed to save note', 500);
      }

      console.log(`✅ [CONSULTATION-NOTES] Note saved: ${noteId}`);

      return sendSuccess(c, {
        noteId: note.id,
        note: {
          id: note.id,
          bookingId: note.booking_id,
          content: note.content,
          authorId: note.author_id,
          authorType: note.author_type,
          createdAt: note.created_at
        }
      });
    } catch (error) {
      console.error('❌ [CONSULTATION-NOTES] Error saving notes:', error);
      return sendError(c, String(error), 500);
    }
  });

  /**
   * GET /consultation/notes/:bookingId
   * Get all notes for a booking
   */
  app.get(`${BASE_PATH}/consultation/notes/:bookingId`, async (c) => {
    try {
      const { bookingId } = c.req.param();

      // ✅ SQL: Get all notes for booking
      const { data: notes, error } = await client
        .from('consultation_notes')
        .select('*')
        .eq('booking_id', bookingId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching consultation notes:', error);
        return sendError(c, 'Failed to fetch notes', 500);
      }

      return sendSuccess(c, {
        notes: (notes || []).map(note => ({
          id: note.id,
          bookingId: note.booking_id,
          content: note.content,
          authorId: note.author_id,
          authorType: note.author_type,
          createdAt: note.created_at,
          updatedAt: note.updated_at
        }))
      });
    } catch (error) {
      console.error('❌ [CONSULTATION-NOTES] Error fetching notes:', error);
      return sendError(c, String(error), 500);
    }
  });
}

