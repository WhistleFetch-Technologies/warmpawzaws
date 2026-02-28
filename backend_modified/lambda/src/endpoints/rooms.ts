/**
 * ============================================================================
 * CONSULTATION ROOMS MANAGEMENT ENDPOINTS - LAMBDA VERSION
 * ============================================================================
 * 
 * Handles consultation room management for business/clinic vendors:
 * - Room CRUD operations
 * - Room availability scheduling
 * - Room assignment for bookings
 * 
 * Phase 1.1: Missing Features Implementation
 * Date: 2025-01-30
 * ============================================================================
 */

import { Hono } from 'hono';
import { select, insert, update, query } from '../database/rds-connection';
import { checkVendorCapability } from '../middleware/capability-enforcement';

export function registerRoomsEndpoints(app: Hono) {
  /**
   * GET /vendor/:vendorId/rooms
   * Get all consultation rooms for a vendor
   */
  app.get("/vendor/:vendorId/rooms", async (c) => {
    try {
      const { vendorId } = c.req.param();
      const centreId = c.req.query('centreId'); // Optional: filter by centre

      if (!vendorId) {
        return c.json({ error: 'vendorId is required' }, 400);
      }

      let roomsQuery = `
        SELECT cr.*, 
               COALESCE(vc.name, 'Vendor-level') as centre_name
        FROM consultation_rooms cr
        LEFT JOIN vendor_centres vc ON cr.centre_id = vc.id
        WHERE cr.vendor_id = $1
      `;

      const params: any[] = [vendorId];
      if (centreId) {
        roomsQuery += ` AND (cr.centre_id = $2 OR cr.centre_id IS NULL)`;
        params.push(centreId);
      }

      roomsQuery += ` ORDER BY cr.room_number, cr.created_at`;

      const result = await query(roomsQuery, params);

      return c.json({
        success: true,
        rooms: result.rows.map((room: any) => ({
          id: room.id,
          vendorId: room.vendor_id,
          centreId: room.centre_id,
          centreName: room.centre_name,
          roomNumber: room.room_number,
          roomName: room.room_name,
          roomType: room.room_type,
          isActive: room.is_active,
          capacity: room.capacity,
          amenities: room.amenities || [],
          metadata: room.metadata || {},
          createdAt: room.created_at,
          updatedAt: room.updated_at,
        })),
        total: result.rows.length,
      });
    } catch (error: any) {
      console.error('Error fetching rooms:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * GET /vendor/:vendorId/rooms/:roomId
   * Get a specific room with its availability schedule
   */
  app.get("/vendor/:vendorId/rooms/:roomId", async (c) => {
    try {
      const { vendorId, roomId } = c.req.param();

      // Get room details
      const rooms = await select('consultation_rooms', { id: roomId, vendor_id: vendorId });
      if (rooms.length === 0) {
        return c.json({ error: 'Room not found' }, 404);
      }

      const room = rooms[0];

      // Get room availability schedule
      const availability = await query(
        `SELECT * FROM room_availability 
         WHERE room_id = $1 
         ORDER BY day_of_week, start_time`,
        [roomId]
      );

      return c.json({
        success: true,
        room: {
          id: room.id,
          vendorId: room.vendor_id,
          centreId: room.centre_id,
          roomNumber: room.room_number,
          roomName: room.room_name,
          roomType: room.room_type,
          isActive: room.is_active,
          capacity: room.capacity,
          amenities: room.amenities || [],
          metadata: room.metadata || {},
          availability: availability.rows.map((av: any) => ({
            id: av.id,
            dayOfWeek: av.day_of_week,
            startTime: av.start_time,
            endTime: av.end_time,
            isAvailable: av.is_available,
            blockedUntil: av.blocked_until,
          })),
          createdAt: room.created_at,
          updatedAt: room.updated_at,
        },
      });
    } catch (error: any) {
      console.error('Error fetching room:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * POST /vendor/:vendorId/rooms
   * Create a new consultation room
   */
  app.post("/vendor/:vendorId/rooms", async (c) => {
    try {
      const { vendorId } = c.req.param();
      
      // Check vendor capability
      const hasCapability = await checkVendorCapability(vendorId, 'services') || 
                           await checkVendorCapability(vendorId, 'staff_management');
      if (!hasCapability) {
        return c.json({ error: 'Vendor does not have required capability' }, 403);
      }

      const body = await c.req.json();
      const {
        roomNumber,
        roomName,
        roomType = 'consultation',
        centreId,
        capacity = 1,
        amenities = [],
        metadata = {},
      } = body;

      if (!roomNumber) {
        return c.json({ error: 'roomNumber is required' }, 400);
      }

      // Check for duplicate room number
      const existing = await query(
        `SELECT id FROM consultation_rooms 
         WHERE vendor_id = $1 AND room_number = $2 
         AND COALESCE(centre_id, '00000000-0000-0000-0000-000000000000'::uuid) = COALESCE($3, '00000000-0000-0000-0000-000000000000'::uuid)`,
        [vendorId, roomNumber, centreId]
      );

      if (existing.rows.length > 0) {
        return c.json({ error: 'Room with this number already exists' }, 400);
      }

      const newRoom = await insert('consultation_rooms', {
        vendor_id: vendorId,
        centre_id: centreId || null,
        room_number: roomNumber,
        room_name: roomName || null,
        room_type: roomType,
        capacity: capacity,
        amenities: JSON.stringify(amenities),
        metadata: JSON.stringify(metadata),
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      return c.json({
        success: true,
        room: newRoom[0],
        message: 'Room created successfully',
      });
    } catch (error: any) {
      console.error('Error creating room:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * PUT /vendor/:vendorId/rooms/:roomId
   * Update a consultation room
   */
  app.put("/vendor/:vendorId/rooms/:roomId", async (c) => {
    try {
      const { vendorId, roomId } = c.req.param();
      
      const body = await c.req.json();
      const updateData: any = {
        updated_at: new Date().toISOString(),
      };

      if (body.roomName !== undefined) updateData.room_name = body.roomName;
      if (body.roomType !== undefined) updateData.room_type = body.roomType;
      if (body.capacity !== undefined) updateData.capacity = body.capacity;
      if (body.amenities !== undefined) updateData.amenities = JSON.stringify(body.amenities);
      if (body.isActive !== undefined) updateData.is_active = body.isActive;
      if (body.metadata !== undefined) updateData.metadata = JSON.stringify(body.metadata);

      const updated = await update(
        'consultation_rooms',
        { id: roomId, vendor_id: vendorId },
        updateData
      );

      if (updated.length === 0) {
        return c.json({ error: 'Room not found or unauthorized' }, 404);
      }

      return c.json({
        success: true,
        room: updated[0],
        message: 'Room updated successfully',
      });
    } catch (error: any) {
      console.error('Error updating room:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * DELETE /vendor/:vendorId/rooms/:roomId
   * Delete a consultation room (soft delete - set is_active = false)
   */
  app.delete("/vendor/:vendorId/rooms/:roomId", async (c) => {
    try {
      const { vendorId, roomId } = c.req.param();

      // Check if room has active bookings
      const activeBookings = await query(
        `SELECT id FROM bookings 
         WHERE room_id = $1 
         AND status IN ('pending', 'confirmed', 'in_progress')`,
        [roomId]
      );

      if (activeBookings.rows.length > 0) {
        // Soft delete - set is_active = false
        const updated = await update(
          'consultation_rooms',
          { id: roomId, vendor_id: vendorId },
          { is_active: false, updated_at: new Date().toISOString() }
        );

        return c.json({
          success: true,
          message: 'Room deactivated (has active bookings)',
          room: updated[0],
        });
      } else {
        // Hard delete if no active bookings
        await query(
          `DELETE FROM room_availability WHERE room_id = $1`,
          [roomId]
        );
        await query(
          `DELETE FROM consultation_rooms WHERE id = $1 AND vendor_id = $2`,
          [roomId, vendorId]
        );

        return c.json({
          success: true,
          message: 'Room deleted successfully',
        });
      }
    } catch (error: any) {
      console.error('Error deleting room:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * POST /vendor/:vendorId/rooms/:roomId/availability
   * Set availability schedule for a room
   */
  app.post("/vendor/:vendorId/rooms/:roomId/availability", async (c) => {
    try {
      const { vendorId, roomId } = c.req.param();
      
      const body = await c.req.json();
      const { schedule } = body; // Array of {dayOfWeek, startTime, endTime, isAvailable}

      if (!Array.isArray(schedule)) {
        return c.json({ error: 'schedule must be an array' }, 400);
      }

      // Verify room belongs to vendor
      const rooms = await select('consultation_rooms', { id: roomId, vendor_id: vendorId });
      if (rooms.length === 0) {
        return c.json({ error: 'Room not found' }, 404);
      }

      // Delete existing schedule
      await query(
        `DELETE FROM room_availability WHERE room_id = $1`,
        [roomId]
      );

      // Insert new schedule
      for (const slot of schedule) {
        await insert('room_availability', {
          room_id: roomId,
          vendor_id: vendorId,
          day_of_week: slot.dayOfWeek,
          start_time: slot.startTime,
          end_time: slot.endTime,
          is_available: slot.isAvailable !== false,
          blocked_until: slot.blockedUntil || null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
      }

      return c.json({
        success: true,
        message: 'Room availability schedule updated successfully',
      });
    } catch (error: any) {
      console.error('Error updating room availability:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * GET /vendor/:vendorId/rooms/available
   * Get available rooms for a specific date/time (for booking)
   */
  app.get("/vendor/:vendorId/rooms/available", async (c) => {
    try {
      const { vendorId } = c.req.param();
      const date = c.req.query('date'); // ISO date string
      const startTime = c.req.query('startTime'); // HH:mm format
      const duration = parseInt(c.req.query('duration') || '30'); // minutes

      if (!date || !startTime) {
        return c.json({ error: 'date and startTime are required' }, 400);
      }

      const bookingDate = new Date(date);
      const dayOfWeek = bookingDate.getDay(); // 0 = Sunday, 6 = Saturday

      // Get all active rooms for vendor
      const rooms = await query(
        `SELECT cr.* FROM consultation_rooms cr
         WHERE cr.vendor_id = $1 AND cr.is_active = true`,
        [vendorId]
      );

      const availableRooms = [];

      for (const room of rooms.rows) {
        // Check room availability schedule
        const availability = await query(
          `SELECT * FROM room_availability 
           WHERE room_id = $1 AND day_of_week = $2 
           AND is_available = true
           AND start_time <= $3 AND end_time >= $4`,
          [room.id, dayOfWeek, startTime, startTime]
        );

        if (availability.rows.length === 0) {
          continue; // Room not available at this time
        }

        // Check for conflicting bookings
        const conflictingBookings = await query(
          `SELECT id FROM bookings 
           WHERE room_id = $1 
           AND booking_date = $2
           AND booking_time = $3
           AND status IN ('pending', 'confirmed', 'in_progress')`,
          [room.id, date, startTime]
        );

        if (conflictingBookings.rows.length === 0) {
          availableRooms.push({
            id: room.id,
            roomNumber: room.room_number,
            roomName: room.room_name,
            roomType: room.room_type,
            capacity: room.capacity,
            amenities: room.amenities || [],
          });
        }
      }

      return c.json({
        success: true,
        availableRooms,
        date,
        startTime,
        duration,
      });
    } catch (error: any) {
      console.error('Error fetching available rooms:', error);
      return c.json({ error: error.message }, 500);
    }
  });
}
