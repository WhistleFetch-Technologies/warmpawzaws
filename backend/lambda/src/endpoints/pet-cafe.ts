/**
 * ============================================================================
 * PET CAFE ENDPOINTS
 * ============================================================================
 * 
 * Handles pet cafe operations:
 * - List cafes
 * - Table management
 * - Table availability
 * - Table bookings
 * 
 * Date: 2026-01-07
 * ============================================================================
 */

import { Hono } from 'hono';
import { BaseHandler, HandlerContext, HandlerResponse } from '../handler/base-handler';
import { query } from '../database/rds-connection';

// ============================================================================
// GET /vendors?role=pet_cafe - List all pet cafes (enhance existing)
// ============================================================================

// ============================================================================
// GET /vendor/:id/tables - Get tables for a cafe
// ============================================================================

class GetCafeTablesHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    try {
      const vendorId = context.event.pathParameters?.id || 
                      context.event.pathParameters?.vendorId ||
                      context.userId;

      if (!vendorId) {
        return this.error('Vendor ID is required', 400);
      }

      // Get all tables for the cafe
      const tables = await query(`
        SELECT 
          t.*,
          COUNT(b.id) FILTER (WHERE b.status IN ('confirmed', 'in_progress') 
            AND b.booking_date = CURRENT_DATE) as today_bookings
        FROM cafe_tables t
        LEFT JOIN bookings b ON t.id = b.table_id 
          AND b.service_type = 'pet_cafe'
          AND b.status IN ('confirmed', 'in_progress')
        WHERE t.vendor_id = $1
        GROUP BY t.id
        ORDER BY t.table_number ASC
      `, [vendorId]);

      return this.success({
        tables: tables.rows,
        count: tables.rows.length
      });
    } catch (error: any) {
      console.error('Error fetching cafe tables:', error);
      return this.error(error.message || 'Failed to fetch tables', 500);
    }
  }
}

// ============================================================================
// GET /vendor/:id/tables/availability - Get table availability
// ============================================================================

class GetTableAvailabilityHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    try {
      const vendorId = context.event.pathParameters?.id || 
                      context.event.pathParameters?.vendorId;
      const date = context.event.queryStringParameters?.date || 
                   new Date().toISOString().split('T')[0];
      const timeSlot = context.event.queryStringParameters?.timeSlot;
      const numberOfPax = parseInt(context.event.queryStringParameters?.numberOfPax || '1', 10);

      if (!vendorId) {
        return this.error('Vendor ID is required', 400);
      }

      // Get all tables
      const allTables = await query(`
        SELECT * FROM cafe_tables
        WHERE vendor_id = $1 AND is_active = true
        ORDER BY table_number ASC
      `, [vendorId]);

      // Get bookings for the date
      const bookings = await query(`
        SELECT 
          b.id,
          b.table_id,
          b.booking_time,
          b.duration_minutes,
          b.number_of_pax,
          b.status
        FROM bookings b
        WHERE b.vendor_id = $1
          AND b.service_type = 'pet_cafe'
          AND b.booking_date = $2
          AND b.status IN ('confirmed', 'in_progress')
      `, [vendorId, date]);

      // Calculate availability for each table
      const availability = allTables.rows.map((table: any) => {
        const tableBookings = bookings.rows.filter((b: any) => b.table_id === table.id);
        
        // Check if table can accommodate the party size
        const canAccommodate = table.capacity >= numberOfPax;
        
        // Check if table is available for the time slot (if provided)
        let isAvailable = canAccommodate && tableBookings.length < table.max_concurrent_bookings;
        
        if (timeSlot && isAvailable) {
          // Check if there's a booking conflict for the time slot
          const hasConflict = tableBookings.some((booking: any) => {
            const bookingStart = new Date(`${date}T${booking.booking_time}`);
            const bookingEnd = new Date(bookingStart.getTime() + (booking.duration_minutes || 60) * 60000);
            const requestedStart = new Date(`${date}T${timeSlot}`);
            const requestedEnd = new Date(requestedStart.getTime() + 60 * 60000); // Default 1 hour
            
            return (requestedStart < bookingEnd && requestedEnd > bookingStart);
          });
          
          isAvailable = !hasConflict;
        }

        return {
          ...table,
          canAccommodate,
          isAvailable,
          currentBookings: tableBookings.length,
          maxBookings: table.max_concurrent_bookings,
          bookings: tableBookings
        };
      });

      return this.success({
        date,
        timeSlot: timeSlot || null,
        numberOfPax,
        tables: availability,
        availableTables: availability.filter((t: any) => t.isAvailable),
        count: availability.length
      });
    } catch (error: any) {
      console.error('Error fetching table availability:', error);
      return this.error(error.message || 'Failed to fetch table availability', 500);
    }
  }
}

// ============================================================================
// POST /vendor/:id/tables - Create new table (vendor only)
// ============================================================================

class CreateTableHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    try {
      const vendorId = context.event.pathParameters?.id || 
                      context.event.pathParameters?.vendorId ||
                      context.userId;
      const body = this.parseBody(context.event);
      const { table_number, capacity, max_concurrent_bookings, location, description } = body;

      if (!vendorId) {
        return this.error('Vendor ID is required', 400);
      }

      if (!table_number || !capacity) {
        return this.error('Table number and capacity are required', 400);
      }

      // Check if table number already exists
      const existing = await query(`
        SELECT id FROM cafe_tables
        WHERE vendor_id = $1 AND table_number = $2
      `, [vendorId, table_number]);

      if (existing.rows.length > 0) {
        return this.error('Table number already exists', 400);
      }

      // Create table
      const newTable = await query(`
        INSERT INTO cafe_tables (
          vendor_id,
          table_number,
          capacity,
          max_concurrent_bookings,
          location,
          description,
          is_active,
          created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, true, NOW())
        RETURNING *
      `, [
        vendorId,
        table_number,
        capacity,
        max_concurrent_bookings || 1,
        location || null,
        description || null
      ]);

      return this.success({
        table: newTable.rows[0],
        message: 'Table created successfully'
      });
    } catch (error: any) {
      console.error('Error creating table:', error);
      return this.error(error.message || 'Failed to create table', 500);
    }
  }
}

// ============================================================================
// PUT /vendor/:id/tables/:tableId - Update table (vendor only)
// ============================================================================

class UpdateTableHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    try {
      const vendorId = context.event.pathParameters?.id || 
                      context.event.pathParameters?.vendorId ||
                      context.userId;
      const tableId = context.event.pathParameters?.tableId;
      const body = this.parseBody(context.event);
      const { capacity, max_concurrent_bookings, location, description, is_active } = body;

      if (!vendorId || !tableId) {
        return this.error('Vendor ID and Table ID are required', 400);
      }

      // Verify table belongs to vendor
      const table = await query(`
        SELECT id FROM cafe_tables
        WHERE id = $1 AND vendor_id = $2
      `, [tableId, vendorId]);

      if (table.rows.length === 0) {
        return this.error('Table not found', 404);
      }

      // Build update query dynamically
      const updates: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;

      if (capacity !== undefined) {
        updates.push(`capacity = $${paramIndex++}`);
        values.push(capacity);
      }
      if (max_concurrent_bookings !== undefined) {
        updates.push(`max_concurrent_bookings = $${paramIndex++}`);
        values.push(max_concurrent_bookings);
      }
      if (location !== undefined) {
        updates.push(`location = $${paramIndex++}`);
        values.push(location);
      }
      if (description !== undefined) {
        updates.push(`description = $${paramIndex++}`);
        values.push(description);
      }
      if (is_active !== undefined) {
        updates.push(`is_active = $${paramIndex++}`);
        values.push(is_active);
      }

      if (updates.length === 0) {
        return this.error('No fields to update', 400);
      }

      updates.push(`updated_at = NOW()`);
      values.push(tableId, vendorId);

      const updated = await query(`
        UPDATE cafe_tables
        SET ${updates.join(', ')}
        WHERE id = $${paramIndex} AND vendor_id = $${paramIndex + 1}
        RETURNING *
      `, values);

      return this.success({
        table: updated.rows[0],
        message: 'Table updated successfully'
      });
    } catch (error: any) {
      console.error('Error updating table:', error);
      return this.error(error.message || 'Failed to update table', 500);
    }
  }
}

// ============================================================================
// REGISTER ENDPOINTS
// ============================================================================

export function registerPetCafeEndpoints(app: Hono) {
  const getTablesHandler = new GetCafeTablesHandler();
  const getAvailabilityHandler = new GetTableAvailabilityHandler();
  const createTableHandler = new CreateTableHandler();
  const updateTableHandler = new UpdateTableHandler();

  app.get('/vendor/:id/tables', async (c) => {
    const event = createApiGatewayEvent(c.req);
    const context = createLambdaContext();
    const result = await getTablesHandler.execute(event, context);
    return c.json(JSON.parse(result.body), result.statusCode);
  });

  app.get('/vendor/:id/tables/availability', async (c) => {
    const event = createApiGatewayEvent(c.req);
    const context = createLambdaContext();
    const result = await getAvailabilityHandler.execute(event, context);
    return c.json(JSON.parse(result.body), result.statusCode);
  });

  app.post('/vendor/:id/tables', async (c) => {
    const event = createApiGatewayEvent(c.req);
    const context = createLambdaContext();
    const result = await createTableHandler.execute(event, context);
    return c.json(JSON.parse(result.body), result.statusCode);
  });

  app.put('/vendor/:id/tables/:tableId', async (c) => {
    const event = createApiGatewayEvent(c.req);
    const context = createLambdaContext();
    const result = await updateTableHandler.execute(event, context);
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

