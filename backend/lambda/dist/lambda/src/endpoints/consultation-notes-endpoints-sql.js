"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.consultationNotesEndpointsSQL = consultationNotesEndpointsSQL;
const response_utils_1 = require("./response-utils");
const bookings_1 = require("../lib/repositories/bookings");
const db_1 = require("../lib/db");
function consultationNotesEndpointsSQL(app) {
    const BASE_PATH = "/make-server-3dd53475";
    const bookingsRepo = (0, bookings_1.getBookingsRepository)();
    /**
     * POST /consultation/notes
     * Save consultation notes for a booking
     */
    app.post(`${BASE_PATH}/consultation/notes`, async (c) => {
        try {
            const { bookingId, notes, authorId, authorType } = await c.req.json();
            console.log(`📝 [CONSULTATION-NOTES] Saving notes for booking: ${bookingId}`);
            if (!bookingId || !notes) {
                return (0, response_utils_1.sendError)(c, 'Missing required fields', 400);
            }
            // ✅ SQL: Verify booking exists
            const booking = await bookingsRepo.findById(bookingId);
            if (!booking) {
                return (0, response_utils_1.sendError)(c, 'Booking not found', 404);
            }
            // ✅ SQL: Create consultation note
            const noteId = `note_${Date.now()}_${Math.random().toString(36).substring(7)}`;
            const now = new Date().toISOString();
            const noteResults = await (0, db_1.insertQuery)('consultation_notes', {
                id: noteId,
                booking_id: bookingId,
                content: notes,
                author_id: authorId,
                author_type: authorType || 'staff', // 'vendor' or 'staff'
                created_at: now,
                updated_at: now
            });
            if (!noteResults || noteResults.length === 0) {
                return (0, response_utils_1.sendError)(c, 'Failed to save note', 500);
            }
            const note = noteResults[0];
            console.log(`✅ [CONSULTATION-NOTES] Note saved: ${noteId}`);
            return (0, response_utils_1.sendSuccess)(c, {
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
        }
        catch (error) {
            console.error('❌ [CONSULTATION-NOTES] Error saving notes:', error);
            return (0, response_utils_1.sendError)(c, String(error), 500);
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
            const notes = await (0, db_1.selectQuery)('consultation_notes', { booking_id: bookingId }, {
                orderBy: 'created_at',
                orderDirection: 'desc'
            });
            return (0, response_utils_1.sendSuccess)(c, {
                notes: (notes || []).map((note) => ({
                    id: note.id,
                    bookingId: note.booking_id,
                    content: note.content,
                    authorId: note.author_id,
                    authorType: note.author_type,
                    createdAt: note.created_at,
                    updatedAt: note.updated_at
                }))
            });
        }
        catch (error) {
            console.error('❌ [CONSULTATION-NOTES] Error fetching notes:', error);
            return (0, response_utils_1.sendError)(c, String(error), 500);
        }
    });
}
//# sourceMappingURL=consultation-notes-endpoints-sql.js.map