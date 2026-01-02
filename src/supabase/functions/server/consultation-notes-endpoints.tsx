// ✅ SQL MIGRATION: All KV operations replaced with SQL repositories
import { Hono } from 'hono';
import { 
  getBookingsRepository
} from '../../../supabase/lib/repositories/index';
import { getDbClient } from '../../../supabase/lib/db';

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
      
      // ✅ SQL: Get booking using repository
      const bookingsRepo = getBookingsRepository();
      const booking = await bookingsRepo.findById(bookingId);
      if (!booking) {
        return c.json({ error: 'Booking not found' }, 404);
      }
      
      // ✅ SQL: Create note in consultation_notes table
      const db = getDbClient();
      const noteId = `note_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      
      const { data: noteData, error: insertError } = await db
        .from('consultation_notes')
        .insert({
          id: noteId,
          booking_id: bookingId,
          content: notes,
          author_id: authorId,
          author_type: authorType, // 'vendor' or 'staff'
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single();
      
      if (insertError) {
        console.error('Error saving consultation note:', insertError);
        return c.json({ error: 'Failed to save note' }, 500);
      }
      
      const note = {
        id: noteData.id,
        bookingId: noteData.booking_id,
        content: noteData.content,
        authorId: noteData.author_id,
        authorType: noteData.author_type,
        createdAt: noteData.created_at,
        updatedAt: noteData.updated_at
      };
      
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
      
      // ✅ SQL: Get all notes for booking from consultation_notes table
      const db = getDbClient();
      const { data: notesData, error } = await db
        .from('consultation_notes')
        .select('*')
        .eq('booking_id', bookingId)
        .order('created_at', { ascending: false });
      
      if (error) {
        console.error('Error fetching consultation notes:', error);
        return c.json({ error: 'Failed to fetch notes' }, 500);
      }
      
      const notes = (notesData || []).map((note: any) => ({
        id: note.id,
        bookingId: note.booking_id,
        content: note.content,
        authorId: note.author_id,
        authorType: note.author_type,
        createdAt: note.created_at,
        updatedAt: note.updated_at
      }));
      
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
