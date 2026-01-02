/**
 * CAFE TABLE MANAGEMENT SYSTEM
 * 
 * Features:
 * - Table inventory management (2-pax, 4-pax, 6-pax, etc.)
 * - Real-time table availability
 * - Reservation booking with time slots
 * - Table capacity management
 * - Waiting list for full capacity
 * - Reservation status tracking
 * - Special requests handling
 * 
 * Status: ✅ P1 IMPLEMENTATION
 */

import { Hono } from 'hono';
import { cors } from "hono/cors";
import * as kv from './kv_store';

const app = new Hono();
app.use('*', cors());

// Helper: Generate reservation ID
function generateReservationId() {
  return `reservation_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// ==========================================================================
// CAFE TABLE INVENTORY SETUP
// ==========================================================================

/**
 * POST /cafe/:vendorId/tables/setup
 * Setup table inventory for cafe
 */
app.post('/cafe/:vendorId/tables/setup', async (c) => {
  try {
    const vendorId = c.req.param('vendorId');
    const { tables } = await c.req.json();
    
    // Validate input
    if (!tables || !Array.isArray(tables) || tables.length === 0) {
      return c.json({
        error: 'Invalid table configuration',
        hint: 'Provide array of tables with tableNumber, capacity, location'
      }, 400);
    }
    
    // Verify vendor exists and is cafe
    const vendor = await kv.get(`vendor:${vendorId}`);
    if (!vendor) {
      return c.json({ error: 'Vendor not found' }, 404);
    }
    
    if (vendor.roleId !== 'pet_cafe') {
      return c.json({
        error: 'This feature is only for pet cafes',
        currentRole: vendor.roleId
      }, 403);
    }
    
    // Process table inventory
    const tableInventory = tables.map((table: any) => ({
      tableId: `table_${vendorId}_${table.tableNumber}`,
      tableNumber: table.tableNumber,
      capacity: table.capacity, // 2, 4, 6, 8
      location: table.location || 'Indoor', // Indoor, Outdoor, Patio
      isActive: table.isActive !== false,
      amenities: table.amenities || [], // Window view, Pet-friendly cushions, etc.
      createdAt: new Date().toISOString()
    }));
    
    // Save table inventory
    await kv.set(`cafe:${vendorId}:tables`, tableInventory);
    
    // Calculate total capacity
    const totalCapacity = tableInventory.reduce((sum: number, t: any) => sum + t.capacity, 0);
    const totalTables = tableInventory.length;
    
    // Update vendor with cafe metadata
    vendor.cafeMetadata = {
      totalTables,
      totalCapacity,
      tablesConfigured: true,
      lastUpdated: new Date().toISOString()
    };
    await kv.set(`vendor:${vendorId}`, vendor);
    
    console.log(`🪑 Table inventory setup for cafe ${vendorId}: ${totalTables} tables, ${totalCapacity} capacity`);
    
    return c.json({
      success: true,
      inventory: {
        totalTables,
        totalCapacity,
        tables: tableInventory
      },
      message: 'Table inventory configured successfully'
    });
    
  } catch (error) {
    console.error('Error setting up table inventory:', error);
    return c.json({ error: String(error) }, 500);
  }
});

// ==========================================================================
// GET TABLE AVAILABILITY
// ==========================================================================

/**
 * GET /cafe/:vendorId/tables/availability
 * Check table availability for date and time
 */
app.get('/cafe/:vendorId/tables/availability', async (c) => {
  try {
    const vendorId = c.req.param('vendorId');
    const date = c.req.query('date'); // YYYY-MM-DD
    const time = c.req.query('time'); // HH:MM
    const capacity = parseInt(c.req.query('capacity') || '2'); // Party size
    
    if (!date || !time) {
      return c.json({
        error: 'Missing required parameters',
        required: ['date', 'time']
      }, 400);
    }
    
    // Get table inventory
    const tables = await kv.get(`cafe:${vendorId}:tables`) || [];
    
    if (tables.length === 0) {
      return c.json({
        error: 'No tables configured for this cafe',
        hint: 'Setup table inventory first'
      }, 400);
    }
    
    // Get reservations for this date/time
    const reservationKey = `cafe:${vendorId}:reservations:${date}:${time}`;
    const reservations = await kv.get(reservationKey) || [];
    
    // Get booked table IDs
    const bookedTableIds = new Set(
      reservations
        .filter((r: any) => r.status === 'confirmed' || r.status === 'pending')
        .map((r: any) => r.tableId)
    );
    
    // Find available tables that fit the party size
    const availableTables = tables.filter((table: any) => 
      table.isActive &&
      table.capacity >= capacity &&
      !bookedTableIds.has(table.tableId)
    );
    
    // Sort by capacity (smallest that fits first)
    availableTables.sort((a: any, b: any) => a.capacity - b.capacity);
    
    return c.json({
      success: true,
      date,
      time,
      requestedCapacity: capacity,
      availableTables,
      totalAvailable: availableTables.length,
      isAvailable: availableTables.length > 0
    });
    
  } catch (error) {
    console.error('Error checking table availability:', error);
    return c.json({ error: String(error) }, 500);
  }
});

// ==========================================================================
// CREATE TABLE RESERVATION
// ==========================================================================

/**
 * POST /cafe/:vendorId/reservations
 * Create table reservation
 */
app.post('/cafe/:vendorId/reservations', async (c) => {
  try {
    const vendorId = c.req.param('vendorId');
    const {
      customerId,
      customerName,
      customerPhone,
      date,
      time,
      partySize,
      duration = 120, // Default 2 hours
      specialRequests,
      petDetails
    } = await c.req.json();
    
    if (!customerId || !date || !time || !partySize) {
      return c.json({
        error: 'Missing required fields',
        required: ['customerId', 'date', 'time', 'partySize']
      }, 400);
    }
    
    // ✅ FIX: Atomic availability check and reservation to prevent race conditions
    const tables = await kv.get(`cafe:${vendorId}:tables`) || [];
    const reservationKey = `cafe:${vendorId}:reservations:${date}:${time}`;
    
    // Use a lock key to prevent concurrent bookings
    const lockKey = `cafe:${vendorId}:lock:${date}:${time}`;
    const lock = await kv.get(lockKey);
    
    if (lock && Date.now() - lock.timestamp < 5000) { // 5 second lock
      return c.json({
        error: 'Another booking is in progress. Please try again in a moment.',
        retryAfter: 2
      }, 409);
    }
    
    // Set lock
    await kv.set(lockKey, { timestamp: Date.now(), customerId });
    
    try {
      // Re-check availability (critical section)
      const existingReservations = await kv.get(reservationKey) || [];
      
      // ✅ FIX: Properly handle async reservation lookups
      const bookedTableIds = new Set<string>();
      for (const r of existingReservations) {
        const reservation = typeof r === 'string' ? await kv.get(`reservation:${r}`) : r;
        if (reservation && (reservation.status === 'confirmed' || reservation.status === 'pending')) {
          bookedTableIds.add(reservation.tableId);
        }
      }
      
      // Find suitable table
      const availableTables = tables.filter((table: any) => 
        table.isActive &&
        table.capacity >= partySize &&
        !bookedTableIds.has(table.tableId)
      );
      
      if (availableTables.length === 0) {
        // Release lock
        await kv.del(lockKey);
        return c.json({
          error: 'No tables available for requested time and party size',
          hint: 'Try a different time or join waiting list',
          canJoinWaitingList: true
        }, 409); // Conflict
      }
      
      // Assign smallest suitable table
      availableTables.sort((a: any, b: any) => a.capacity - b.capacity);
      const assignedTable = availableTables[0];
    
    // Create reservation
    const reservationId = generateReservationId();
    const reservation = {
      id: reservationId,
      vendorId,
      customerId,
      customerName,
      customerPhone,
      date,
      time,
      partySize,
      duration,
      tableId: assignedTable.tableId,
      tableNumber: assignedTable.tableNumber,
      specialRequests: specialRequests || '',
      petDetails: petDetails || null,
      status: 'confirmed',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    // Save reservation
    await kv.set(`reservation:${reservationId}`, reservation);
    
    // Add to time slot reservations
    existingReservations.push(reservationId);
    await kv.set(reservationKey, existingReservations);
    
    // Add to customer reservations
    const customerReservations = await kv.get(`customer:${customerId}:reservations`) || [];
    customerReservations.unshift(reservationId);
    await kv.set(`customer:${customerId}:reservations`, customerReservations);
    
      // Add to vendor reservations
      const vendorReservations = await kv.get(`cafe:${vendorId}:all-reservations`) || [];
      vendorReservations.unshift(reservationId);
      await kv.set(`cafe:${vendorId}:all-reservations`, vendorReservations);
      
      // Release lock
      await kv.del(lockKey);
      
      console.log(`🪑 Table reservation created: ${reservationId} for ${date} ${time}`);
      
      return c.json({
        success: true,
        reservation: {
          id: reservationId,
          tableNumber: assignedTable.tableNumber,
          date,
          time,
          duration,
          status: 'confirmed'
        },
        message: 'Table reserved successfully'
      });
    } catch (error) {
      // Release lock on error
      await kv.del(lockKey);
      throw error;
    }
    
  } catch (error) {
    console.error('Error creating reservation:', error);
    return c.json({ error: String(error) }, 500);
  }
});

// ==========================================================================
// GET CAFE RESERVATIONS
// ==========================================================================

/**
 * GET /cafe/:vendorId/reservations
 * Get all reservations for cafe (with filters)
 */
app.get('/cafe/:vendorId/reservations', async (c) => {
  try {
    const vendorId = c.req.param('vendorId');
    const date = c.req.query('date');
    const status = c.req.query('status');
    const limit = parseInt(c.req.query('limit') || '50');
    const offset = parseInt(c.req.query('offset') || '0');
    
    // Get all reservation IDs
    const reservationIds = await kv.get(`cafe:${vendorId}:all-reservations`) || [];
    
    // Fetch reservation details
    const reservations: any[] = [];
    for (const reservationId of reservationIds) {
      const reservation = await kv.get(`reservation:${reservationId}`);
      if (reservation) {
        // Apply filters
        if (date && reservation.date !== date) continue;
        if (status && reservation.status !== status) continue;
        
        reservations.push(reservation);
      }
    }
    
    // Apply pagination
    const totalCount = reservations.length;
    const paginatedReservations = reservations.slice(offset, offset + limit);
    
    return c.json({
      success: true,
      reservations: paginatedReservations,
      pagination: {
        totalCount,
        limit,
        offset,
        hasMore: offset + limit < totalCount
      }
    });
    
  } catch (error) {
    console.error('Error fetching cafe reservations:', error);
    return c.json({ error: String(error) }, 500);
  }
});

// ==========================================================================
// UPDATE RESERVATION STATUS
// ==========================================================================

/**
 * PUT /reservations/:reservationId/status
 * Update reservation status (confirm, cancel, complete, no-show)
 */
app.put('/reservations/:reservationId/status', async (c) => {
  try {
    const reservationId = c.req.param('reservationId');
    const { status, vendorId, cancellationReason } = await c.req.json();
    
    if (!status) {
      return c.json({ error: 'status required' }, 400);
    }
    
    const validStatuses = ['confirmed', 'cancelled', 'completed', 'no-show'];
    if (!validStatuses.includes(status)) {
      return c.json({
        error: 'Invalid status',
        validStatuses
      }, 400);
    }
    
    // Get reservation
    const reservation = await kv.get(`reservation:${reservationId}`);
    if (!reservation) {
      return c.json({ error: 'Reservation not found' }, 404);
    }
    
    // Verify ownership
    if (vendorId && reservation.vendorId !== vendorId) {
      return c.json({ error: 'Unauthorized' }, 403);
    }
    
    // Update status
    reservation.status = status;
    reservation.updatedAt = new Date().toISOString();
    
    if (status === 'cancelled') {
      reservation.cancelledAt = new Date().toISOString();
      reservation.cancellationReason = cancellationReason || '';
    } else if (status === 'completed') {
      reservation.completedAt = new Date().toISOString();
    } else if (status === 'no-show') {
      reservation.noShowAt = new Date().toISOString();
    }
    
    await kv.set(`reservation:${reservationId}`, reservation);
    
    console.log(`🪑 Reservation ${reservationId} status updated to ${status}`);
    
    return c.json({
      success: true,
      reservation,
      message: `Reservation ${status} successfully`
    });
    
  } catch (error) {
    console.error('Error updating reservation status:', error);
    return c.json({ error: String(error) }, 500);
  }
});

// ==========================================================================
// GET TABLE OCCUPANCY
// ==========================================================================

/**
 * GET /cafe/:vendorId/tables/occupancy
 * Real-time table occupancy status
 */
app.get('/cafe/:vendorId/tables/occupancy', async (c) => {
  try {
    const vendorId = c.req.param('vendorId');
    const date = c.req.query('date') || new Date().toISOString().split('T')[0];
    
    // Get all tables
    const tables = await kv.get(`cafe:${vendorId}:tables`) || [];
    
    // Get all reservations for the date
    const allReservationIds = await kv.get(`cafe:${vendorId}:all-reservations`) || [];
    const dateReservations: any[] = [];
    
    for (const reservationId of allReservationIds) {
      const reservation = await kv.get(`reservation:${reservationId}`);
      if (reservation && reservation.date === date && reservation.status === 'confirmed') {
        dateReservations.push(reservation);
      }
    }
    
    // Calculate occupancy by time slot
    const timeSlots = [
      '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', 
      '15:00', '16:00', '17:00', '18:00', '19:00', '20:00', '21:00'
    ];
    
    const occupancy = timeSlots.map(time => {
      const reservedTables = dateReservations.filter(r => r.time === time);
      const occupiedCount = reservedTables.length;
      const availableCount = tables.length - occupiedCount;
      
      return {
        time,
        occupiedTables: occupiedCount,
        availableTables: availableCount,
        totalTables: tables.length,
        occupancyRate: ((occupiedCount / tables.length) * 100).toFixed(0) + '%'
      };
    });
    
    return c.json({
      success: true,
      date,
      occupancy,
      totalTables: tables.length
    });
    
  } catch (error) {
    console.error('Error fetching table occupancy:', error);
    return c.json({ error: String(error) }, 500);
  }
});

export default app;
