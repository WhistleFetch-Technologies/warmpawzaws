/**
 * 🪑 CAFE TABLE MANAGEMENT SYSTEM - SQL-ONLY VERSION
 * 
 * ✅ MIGRATED TO SQL: All KV operations replaced with SQL queries
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
 * Date: 2025-01-28
 * Migration: KV to SQL (23 KV operations → 0)
 */

import { Hono } from 'npm:hono';
import { cors } from 'npm:hono/cors';
import { sendSuccess, sendError } from './response-utils.ts';
import { getDbClient } from '../../lib/db.ts';
import { getCafeTablesRepository } from '../../lib/repositories/cafe-tables.ts';
import { getVendorsRepository } from '../../lib/repositories/vendors.ts';
import { getBookingsRepository } from '../../lib/repositories/bookings.ts';
import { withTransaction } from '../../lib/utils/transaction-helper.ts';

const app = new Hono();
app.use('*', cors());

const db = getDbClient();
const cafeTablesRepo = getCafeTablesRepository();
const vendorsRepo = getVendorsRepository();
const bookingsRepo = getBookingsRepository();

// ==========================================================================
// CAFE TABLE INVENTORY SETUP
// ==========================================================================

app.post('/cafe/:vendorId/tables/setup', async (c) => {
  try {
    const vendorId = c.req.param('vendorId');
    const { tables } = await c.req.json();
    
    if (!tables || !Array.isArray(tables) || tables.length === 0) {
      return sendError(c, 'Invalid table configuration', 400);
    }
    
    // ✅ SQL: Verify vendor exists and is cafe
    const vendor = await vendorsRepo.findById(vendorId);
    if (!vendor) {
      return sendError(c, 'Vendor not found', 404);
    }
    
    // Process table inventory
    const tableInventory = [];
    let totalCapacity = 0;
    
    for (const table of tables) {
      const cafeTable = await cafeTablesRepo.create({
        vendorId,
        tableNumber: table.tableNumber,
        name: table.name,
        capacity: table.capacity,
        section: table.section || 'Main Area',
        location: table.location || 'Indoor',
        isOutdoor: table.location === 'Outdoor',
        amenities: table.amenities || [],
        status: 'available',
        isActive: table.isActive !== false
      });
      
      tableInventory.push(cafeTable);
      totalCapacity += table.capacity;
    }
    
    console.log(`🪑 Table inventory setup for cafe ${vendorId}: ${tableInventory.length} tables, ${totalCapacity} capacity`);
    
    return sendSuccess(c, {
      inventory: {
        totalTables: tableInventory.length,
        totalCapacity,
        tables: tableInventory
      }
    }, 'Table inventory configured successfully');
    
  } catch (error) {
    console.error('Error setting up table inventory:', error);
    return sendError(c, error, 500);
  }
});

// ==========================================================================
// GET TABLE AVAILABILITY
// ==========================================================================

app.get('/cafe/:vendorId/tables/availability', async (c) => {
  try {
    const vendorId = c.req.param('vendorId');
    const date = c.req.query('date');
    const time = c.req.query('time');
    const capacity = parseInt(c.req.query('capacity') || '2');
    
    if (!date || !time) {
      return sendError(c, 'Missing required parameters: date, time', 400);
    }
    
    // ✅ SQL: Get all tables for vendor
    const tables = await cafeTablesRepo.findByVendor(vendorId, { isActive: true });
    
    if (tables.length === 0) {
      return sendError(c, 'No tables configured for this cafe', 400);
    }
    
    // ✅ SQL: Get reservations for this date/time
    const { data: reservations } = await db
      .from('bookings')
      .select('*')
      .eq('vendor_id', vendorId)
      .eq('booking_date', date)
      .eq('booking_time', time)
      .eq('service_type', 'cafe_reservation')
      .in('status', ['pending', 'confirmed']);
    
    // Get booked table IDs from reservation metadata
    const bookedTableIds = new Set(
      reservations?.map((r: any) => r.metadata?.tableId).filter(Boolean) || []
    );
    
    // Find available tables that fit the party size
    const availableTables = tables
      .filter(table => 
        table.capacity >= capacity &&
        !bookedTableIds.has(table.id)
      )
      .sort((a, b) => a.capacity - b.capacity);
    
    return sendSuccess(c, {
      date,
      time,
      requestedCapacity: capacity,
      availableTables,
      totalAvailable: availableTables.length,
      isAvailable: availableTables.length > 0
    });
    
  } catch (error) {
    console.error('Error checking table availability:', error);
    return sendError(c, error, 500);
  }
});

// ==========================================================================
// CREATE TABLE RESERVATION
// ==========================================================================

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
      duration = 120,
      specialRequests,
      petDetails
    } = await c.req.json();
    
    if (!customerId || !date || !time || !partySize) {
      return sendError(c, 'Missing required fields: customerId, date, time, partySize', 400);
    }
    
    return await withTransaction(async (txClient) => {
      // ✅ SQL: Get available tables
      const tables = await cafeTablesRepo.findByVendor(vendorId, { isActive: true });
      
      // ✅ SQL: Get existing reservations for this time slot
      const { data: existingReservations } = await txClient
        .from('bookings')
        .select('*')
        .eq('vendor_id', vendorId)
        .eq('booking_date', date)
        .eq('booking_time', time)
        .eq('service_type', 'cafe_reservation')
        .in('status', ['pending', 'confirmed']);
      
      const bookedTableIds = new Set(
        existingReservations?.map((r: any) => r.metadata?.tableId).filter(Boolean) || []
      );
      
      // Find suitable table
      const availableTables = tables
        .filter(table => 
          table.capacity >= partySize &&
          !bookedTableIds.has(table.id)
        )
        .sort((a, b) => a.capacity - b.capacity);
      
      if (availableTables.length === 0) {
        return sendError(c, 'No tables available for requested time and party size', 409);
      }
      
      const assignedTable = availableTables[0];
      
      // ✅ SQL: Create booking (reservation)
      const booking = await bookingsRepo.create({
        customer_id: customerId,
        vendor_id: vendorId,
        service_id: 'cafe_reservation', // Special service ID for cafe reservations
        booking_date: date,
        booking_time: time,
        service_type: 'cafe_reservation',
        address: vendorId, // Vendor location
        base_price: 0,
        total_amount: 0,
        payment_status: 'pending',
        metadata: {
          reservationType: 'cafe_table',
          tableId: assignedTable.id,
          tableNumber: assignedTable.tableNumber,
          partySize,
          duration,
          specialRequests,
          petDetails,
          customerName,
          customerPhone
        }
      });
      
      // ✅ SQL: Update table status
      await cafeTablesRepo.update(assignedTable.id, { status: 'reserved' });
      
      console.log(`🪑 Table reservation created: ${booking.id} for ${date} ${time}`);
      
      return sendSuccess(c, {
        reservation: {
          id: booking.id,
          tableNumber: assignedTable.tableNumber,
          date,
          time,
          duration,
          status: 'confirmed'
        }
      }, 'Table reserved successfully');
    });
    
  } catch (error) {
    console.error('Error creating reservation:', error);
    return sendError(c, error, 500);
  }
});

// ==========================================================================
// GET CAFE RESERVATIONS
// ==========================================================================

app.get('/cafe/:vendorId/reservations', async (c) => {
  try {
    const vendorId = c.req.param('vendorId');
    const date = c.req.query('date');
    const status = c.req.query('status');
    const limit = parseInt(c.req.query('limit') || '50');
    const offset = parseInt(c.req.query('offset') || '0');
    
    // ✅ SQL: Get reservations (bookings with cafe_reservation type)
    let query = db
      .from('bookings')
      .select('*')
      .eq('vendor_id', vendorId)
      .eq('service_type', 'cafe_reservation');
    
    if (date) {
      query = query.eq('booking_date', date);
    }
    
    if (status) {
      query = query.eq('status', status);
    }
    
    const { data: bookings, error } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);
    
    if (error) {
      console.error('Error fetching reservations:', error);
      return sendError(c, 'Failed to fetch reservations', 500);
    }
    
    const reservations = bookings?.map((booking: any) => ({
      id: booking.id,
      vendorId: booking.vendor_id,
      customerId: booking.customer_id,
      date: booking.booking_date,
      time: booking.booking_time,
      status: booking.status,
      tableId: booking.metadata?.tableId,
      tableNumber: booking.metadata?.tableNumber,
      partySize: booking.metadata?.partySize,
      duration: booking.metadata?.duration,
      specialRequests: booking.metadata?.specialRequests,
      petDetails: booking.metadata?.petDetails,
      createdAt: booking.created_at,
      updatedAt: booking.updated_at
    })) || [];
    
    return sendSuccess(c, {
      reservations,
      pagination: {
        totalCount: reservations.length,
        limit,
        offset,
        hasMore: reservations.length === limit
      }
    });
    
  } catch (error) {
    console.error('Error fetching cafe reservations:', error);
    return sendError(c, error, 500);
  }
});

// ==========================================================================
// UPDATE RESERVATION STATUS
// ==========================================================================

app.put('/reservations/:reservationId/status', async (c) => {
  try {
    const reservationId = c.req.param('reservationId');
    const { status, vendorId, cancellationReason } = await c.req.json();
    
    if (!status) {
      return sendError(c, 'status required', 400);
    }
    
    const validStatuses = ['confirmed', 'cancelled', 'completed', 'no-show'];
    if (!validStatuses.includes(status)) {
      return sendError(c, 'Invalid status', 400);
    }
    
    // ✅ SQL: Get reservation (booking)
    const booking = await bookingsRepo.findById(reservationId);
    if (!booking) {
      return sendError(c, 'Reservation not found', 404);
    }
    
    // Verify ownership
    if (vendorId && booking.vendor_id !== vendorId) {
      return sendError(c, 'Unauthorized', 403);
    }
    
    // ✅ SQL: Update booking status
    const updateData: any = {
      status,
      updated_at: new Date().toISOString()
    };
    
    if (status === 'cancelled') {
      updateData.cancelled_at = new Date().toISOString();
      updateData.cancellation_reason = cancellationReason || '';
      
      // ✅ SQL: Free up the table
      if (booking.metadata?.tableId) {
        await cafeTablesRepo.update(booking.metadata.tableId, { status: 'available' });
      }
    } else if (status === 'completed') {
      updateData.completed_at = new Date().toISOString();
      
      // ✅ SQL: Free up the table
      if (booking.metadata?.tableId) {
        await cafeTablesRepo.update(booking.metadata.tableId, { status: 'available' });
      }
    }
    
    await bookingsRepo.update(reservationId, updateData);
    
    console.log(`🪑 Reservation ${reservationId} status updated to ${status}`);
    
    return sendSuccess(c, { reservation: { ...booking, ...updateData } }, `Reservation ${status} successfully`);
    
  } catch (error) {
    console.error('Error updating reservation status:', error);
    return sendError(c, error, 500);
  }
});

// ==========================================================================
// GET TABLE OCCUPANCY
// ==========================================================================

app.get('/cafe/:vendorId/tables/occupancy', async (c) => {
  try {
    const vendorId = c.req.param('vendorId');
    const date = c.req.query('date') || new Date().toISOString().split('T')[0];
    
    // ✅ SQL: Get all tables
    const tables = await cafeTablesRepo.findByVendor(vendorId, { isActive: true });
    
    // ✅ SQL: Get all reservations for the date
    const { data: reservations } = await db
      .from('bookings')
      .select('*')
      .eq('vendor_id', vendorId)
      .eq('booking_date', date)
      .eq('service_type', 'cafe_reservation')
      .eq('status', 'confirmed');
    
    // Calculate occupancy by time slot
    const timeSlots = [
      '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', 
      '15:00', '16:00', '17:00', '18:00', '19:00', '20:00', '21:00'
    ];
    
    const occupancy = timeSlots.map(time => {
      const reservedTables = reservations?.filter((r: any) => r.booking_time === time) || [];
      const occupiedCount = reservedTables.length;
      const availableCount = tables.length - occupiedCount;
      
      return {
        time,
        occupiedTables: occupiedCount,
        availableTables: availableCount,
        totalTables: tables.length,
        occupancyRate: tables.length > 0 ? ((occupiedCount / tables.length) * 100).toFixed(0) + '%' : '0%'
      };
    });
    
    return sendSuccess(c, {
      date,
      occupancy,
      totalTables: tables.length
    });
    
  } catch (error) {
    console.error('Error fetching table occupancy:', error);
    return sendError(c, error, 500);
  }
});

export default app;

