import { Hono } from 'npm:hono';
import * as kv from './kv_store.tsx';

export function consultationNotesEndpoints(app: Hono) {
  
  /**
   * POST /make-server-3dd53475/consultation/notes
   * Save consultation notes for a booking
   */
  app.post('/make-server-3dd53475/consultation/notes', async (c) => {
    try {
      const { bookingId, notes, authorId, authorType } = await c.req.json();
      
      console.log(`📝 [CONSULTATION-NOTES] Saving notes for booking: ${bookingId}`);
      
      if (!bookingId || !notes) {
        return c.json({ error: 'Missing required fields' }, 400);
      }
      
      const booking = await kv.get(`booking:${bookingId}`);
      if (!booking) {
        return c.json({ error: 'Booking not found' }, 404);
      }
      
      // Create note object
      const noteId = `note_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      const note = {
        id: noteId,
        bookingId,
        content: notes,
        authorId,
        authorType, // 'vendor' or 'staff'
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      // Save note
      await kv.set(`consultation_note:${noteId}`, note);
      
      // Add to booking's notes list
      const bookingNotesKey = `booking:${bookingId}:notes`;
      const bookingNotes = await kv.get(bookingNotesKey) || [];
      bookingNotes.push(noteId);
      await kv.set(bookingNotesKey, bookingNotes);
      
      console.log(`✅ [CONSULTATION-NOTES] Note saved: ${noteId}`);
      
      return c.json({
        success: true,
        noteId,
        note
      });
      
    } catch (error) {
      console.error('❌ [CONSULTATION-NOTES] Error saving notes:', error);
      return c.json({ error: String(error) }, 500);
    }
  });
  
  /**
   * GET /make-server-3dd53475/consultation/notes/:bookingId
   * Get all notes for a booking
   */
  app.get('/make-server-3dd53475/consultation/notes/:bookingId', async (c) => {
    try {
      const { bookingId } = c.req.param();
      
      const bookingNotesKey = `booking:${bookingId}:notes`;
      const noteIds = await kv.get(bookingNotesKey) || [];
      
      const notes = [];
      for (const noteId of noteIds) {
        const note = await kv.get(`consultation_note:${noteId}`);
        if (note) {
          notes.push(note);
        }
      }
      
      return c.json({
        success: true,
        notes
      });
      
    } catch (error) {
      console.error('❌ [CONSULTATION-NOTES] Error fetching notes:', error);
      return c.json({ error: String(error) }, 500);
    }
  });
}
