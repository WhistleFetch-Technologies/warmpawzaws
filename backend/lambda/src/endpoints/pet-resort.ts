/**
 * ============================================================================
 * PET RESORT & BOARDING ENDPOINTS
 * ============================================================================
 * 
 * Handles pet resort and boarding operations:
 * - List resorts
 * - Room management
 * - Room availability
 * - Room bookings
 * 
 * Date: 2026-01-07
 * ============================================================================
 */

import { Hono } from 'hono';
import { BaseHandler, HandlerContext, HandlerResponse } from '../handler/base-handler';
import { query } from '../database/rds-connection';

// ============================================================================
// GET /vendor/:id/rooms - Get rooms for a resort
// ============================================================================

class GetResortRoomsHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    try {
      const vendorId = context.event.pathParameters?.id || 
                      context.event.pathParameters?.vendorId ||
                      context.userId;

      if (!vendorId) {
        return this.error('Vendor ID is required', 400);
      }

      // Get all rooms for the resort
      const rooms = await query(`
        SELECT 
          r.*,
          COUNT(b.id) FILTER (WHERE b.status IN ('confirmed', 'in_progress')
            AND b.check_in_date <= CURRENT_DATE
            AND b.check_out_date >= CURRENT_DATE) as current_bookings
        FROM resort_rooms r
        LEFT JOIN bookings b ON r.id = b.room_id 
          AND b.service_type = 'pet_resort'
          AND b.status IN ('confirmed', 'in_progress')
        WHERE r.vendor_id = $1
        GROUP BY r.id
        ORDER BY r.room_number ASC
      `, [vendorId]);

      return this.success({
        rooms: rooms.rows,
        count: rooms.rows.length
      });
    } catch (error: any) {
      console.error('Error fetching resort rooms:', error);
      return this.error(error.message || 'Failed to fetch rooms', 500);
    }
  }
}

// ============================================================================
// GET /vendor/:id/rooms/availability - Get room availability
// ============================================================================

class GetRoomAvailabilityHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    try {
      const vendorId = context.event.pathParameters?.id || 
                      context.event.pathParameters?.vendorId;
      const checkInDate = context.event.queryStringParameters?.checkInDate;
      const checkOutDate = context.event.queryStringParameters?.checkOutDate;
      const petSize = context.event.queryStringParameters?.petSize; // small, medium, large

      if (!vendorId) {
        return this.error('Vendor ID is required', 400);
      }

      if (!checkInDate || !checkOutDate) {
        return this.error('Check-in and check-out dates are required', 400);
      }

      // Get all rooms
      const allRooms = await query(`
        SELECT * FROM resort_rooms
        WHERE vendor_id = $1 AND is_active = true
        ORDER BY room_number ASC
      `, [vendorId]);

      // Get bookings for the date range
      const bookings = await query(`
        SELECT 
          b.id,
          b.room_id,
          b.check_in_date,
          b.check_out_date,
          b.status
        FROM bookings b
        WHERE b.vendor_id = $1
          AND b.service_type = 'pet_resort'
          AND b.status IN ('confirmed', 'in_progress')
          AND (
            (b.check_in_date <= $2 AND b.check_out_date >= $2) OR
            (b.check_in_date <= $3 AND b.check_out_date >= $3) OR
            (b.check_in_date >= $2 AND b.check_out_date <= $3)
          )
      `, [vendorId, checkInDate, checkOutDate]);

      // Calculate availability for each room
      const availability = allRooms.rows.map((room: any) => {
        const roomBookings = bookings.rows.filter((b: any) => b.room_id === room.id);
        
        // Check if room can accommodate the pet size
        const canAccommodate = !petSize || 
          (petSize === 'small' && room.accommodates_small) ||
          (petSize === 'medium' && room.accommodates_medium) ||
          (petSize === 'large' && room.accommodates_large);
        
        // Check if room is available (no conflicting bookings)
        const isAvailable = canAccommodate && roomBookings.length === 0;

        return {
          ...room,
          canAccommodate,
          isAvailable,
          currentBookings: roomBookings.length,
          bookings: roomBookings,
          nightlyPrice: room.nightly_price,
          amenities: room.amenities || []
        };
      });

      return this.success({
        checkInDate,
        checkOutDate,
        petSize: petSize || null,
        rooms: availability,
        availableRooms: availability.filter((r: any) => r.isAvailable),
        count: availability.length
      });
    } catch (error: any) {
      console.error('Error fetching room availability:', error);
      return this.error(error.message || 'Failed to fetch room availability', 500);
    }
  }
}

// ============================================================================
// POST /vendor/:id/rooms - Create new room (vendor only)
// ============================================================================

class CreateRoomHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    try {
      const vendorId = context.event.pathParameters?.id || 
                      context.event.pathParameters?.vendorId ||
                      context.userId;
      const body = this.parseBody(context.event);
      const { 
        room_number, 
        room_type, 
        capacity, 
        nightly_price,
        accommodates_small,
        accommodates_medium,
        accommodates_large,
        amenities,
        description,
        images
      } = body;

      if (!vendorId) {
        return this.error('Vendor ID is required', 400);
      }

      if (!room_number || !room_type || !nightly_price) {
        return this.error('Room number, type, and nightly price are required', 400);
      }

      // Check if room number already exists
      const existing = await query(`
        SELECT id FROM resort_rooms
        WHERE vendor_id = $1 AND room_number = $2
      `, [vendorId, room_number]);

      if (existing.rows.length > 0) {
        return this.error('Room number already exists', 400);
      }

      // Create room
      const newRoom = await query(`
        INSERT INTO resort_rooms (
          vendor_id,
          room_number,
          room_type,
          capacity,
          nightly_price,
          accommodates_small,
          accommodates_medium,
          accommodates_large,
          amenities,
          description,
          images,
          is_active,
          created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, true, NOW())
        RETURNING *
      `, [
        vendorId,
        room_number,
        room_type,
        capacity || 1,
        nightly_price,
        accommodates_small !== false,
        accommodates_medium !== false,
        accommodates_large !== false,
        amenities ? JSON.stringify(amenities) : null,
        description || null,
        images ? JSON.stringify(images) : null
      ]);

      return this.success({
        room: newRoom.rows[0],
        message: 'Room created successfully'
      });
    } catch (error: any) {
      console.error('Error creating room:', error);
      return this.error(error.message || 'Failed to create room', 500);
    }
  }
}

// ============================================================================
// PUT /vendor/:id/rooms/:roomId - Update room (vendor only)
// ============================================================================

class UpdateRoomHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    try {
      const vendorId = context.event.pathParameters?.id || 
                      context.event.pathParameters?.vendorId ||
                      context.userId;
      const roomId = context.event.pathParameters?.roomId;
      const body = this.parseBody(context.event);
      const { 
        room_type,
        capacity,
        nightly_price,
        accommodates_small,
        accommodates_medium,
        accommodates_large,
        amenities,
        description,
        images,
        is_active
      } = body;

      if (!vendorId || !roomId) {
        return this.error('Vendor ID and Room ID are required', 400);
      }

      // Verify room belongs to vendor
      const room = await query(`
        SELECT id FROM resort_rooms
        WHERE id = $1 AND vendor_id = $2
      `, [roomId, vendorId]);

      if (room.rows.length === 0) {
        return this.error('Room not found', 404);
      }

      // Build update query dynamically
      const updates: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;

      if (room_type !== undefined) {
        updates.push(`room_type = $${paramIndex++}`);
        values.push(room_type);
      }
      if (capacity !== undefined) {
        updates.push(`capacity = $${paramIndex++}`);
        values.push(capacity);
      }
      if (nightly_price !== undefined) {
        updates.push(`nightly_price = $${paramIndex++}`);
        values.push(nightly_price);
      }
      if (accommodates_small !== undefined) {
        updates.push(`accommodates_small = $${paramIndex++}`);
        values.push(accommodates_small);
      }
      if (accommodates_medium !== undefined) {
        updates.push(`accommodates_medium = $${paramIndex++}`);
        values.push(accommodates_medium);
      }
      if (accommodates_large !== undefined) {
        updates.push(`accommodates_large = $${paramIndex++}`);
        values.push(accommodates_large);
      }
      if (amenities !== undefined) {
        updates.push(`amenities = $${paramIndex++}`);
        values.push(JSON.stringify(amenities));
      }
      if (description !== undefined) {
        updates.push(`description = $${paramIndex++}`);
        values.push(description);
      }
      if (images !== undefined) {
        updates.push(`images = $${paramIndex++}`);
        values.push(JSON.stringify(images));
      }
      if (is_active !== undefined) {
        updates.push(`is_active = $${paramIndex++}`);
        values.push(is_active);
      }

      if (updates.length === 0) {
        return this.error('No fields to update', 400);
      }

      updates.push(`updated_at = NOW()`);
      values.push(roomId, vendorId);

      const updated = await query(`
        UPDATE resort_rooms
        SET ${updates.join(', ')}
        WHERE id = $${paramIndex} AND vendor_id = $${paramIndex + 1}
        RETURNING *
      `, values);

      return this.success({
        room: updated.rows[0],
        message: 'Room updated successfully'
      });
    } catch (error: any) {
      console.error('Error updating room:', error);
      return this.error(error.message || 'Failed to update room', 500);
    }
  }
}

// ============================================================================
// REGISTER ENDPOINTS
// ============================================================================

export function registerPetResortEndpoints(app: Hono) {
  const getRoomsHandler = new GetResortRoomsHandler();
  const getAvailabilityHandler = new GetRoomAvailabilityHandler();
  const createRoomHandler = new CreateRoomHandler();
  const updateRoomHandler = new UpdateRoomHandler();

  app.get('/vendor/:id/rooms', async (c) => {
    const event = createApiGatewayEvent(c.req);
    const context = createLambdaContext();
    const result = await getRoomsHandler.execute(event, context);
    return c.json(JSON.parse(result.body), result.statusCode);
  });

  app.get('/vendor/:id/rooms/availability', async (c) => {
    const event = createApiGatewayEvent(c.req);
    const context = createLambdaContext();
    const result = await getAvailabilityHandler.execute(event, context);
    return c.json(JSON.parse(result.body), result.statusCode);
  });

  app.post('/vendor/:id/rooms', async (c) => {
    const event = createApiGatewayEvent(c.req);
    const context = createLambdaContext();
    const result = await createRoomHandler.execute(event, context);
    return c.json(JSON.parse(result.body), result.statusCode);
  });

  app.put('/vendor/:id/rooms/:roomId', async (c) => {
    const event = createApiGatewayEvent(c.req);
    const context = createLambdaContext();
    const result = await updateRoomHandler.execute(event, context);
    return c.json(JSON.parse(result.body), result.statusCode);
  });
}

// Helper to convert Hono request to API Gateway event (for compatibility)
function createApiGatewayEvent(req: any): any {
  return {
    pathParameters: req.param ? Object.fromEntries(Object.entries(req.param())) : {},
    queryStringParameters: req.query ? Object.fromEntries(Object.entries(req.query())) : {},
    body: req.body ? JSON.stringify(req.body) : null,
    headers: req.header ? Object.fromEntries(Object.entries(req.header())) : {},
    requestContext: {
      authorizer: {
        claims: {
          sub: req.header?.('x-user-id') || 'test-user'
        }
      }
    }
  };
}

function createLambdaContext(): any {
  return {};
}

