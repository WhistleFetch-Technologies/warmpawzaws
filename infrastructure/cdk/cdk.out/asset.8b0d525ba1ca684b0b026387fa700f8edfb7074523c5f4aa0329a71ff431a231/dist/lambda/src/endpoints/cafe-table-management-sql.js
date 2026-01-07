"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.cafeTableManagementSQL = cafeTableManagementSQL;
const hono_1 = require("hono");
const cors_1 = require("hono/cors");
const response_utils_1 = require("./response-utils");
const db_1 = require("../lib/db");
const vendors_1 = require("../lib/repositories/vendors");
const bookings_1 = require("../lib/repositories/bookings");
const app = new hono_1.Hono();
app.use('*', (0, cors_1.cors)());
const vendorsRepo = (0, vendors_1.getVendorsRepository)();
const bookingsRepo = (0, bookings_1.getBookingsRepository)();
// ==========================================================================
// CAFE TABLE INVENTORY SETUP
// ==========================================================================
app.post('/cafe/:vendorId/tables/setup', async (c) => {
    try {
        const vendorId = c.req.param('vendorId');
        const { tables } = await c.req.json();
        if (!tables || !Array.isArray(tables) || tables.length === 0) {
            return (0, response_utils_1.sendError)(c, 'Invalid table configuration', 400);
        }
        // ✅ SQL: Verify vendor exists and is cafe
        const vendor = await vendorsRepo.findById(vendorId);
        if (!vendor) {
            return (0, response_utils_1.sendError)(c, 'Vendor not found', 404);
        }
        // Process table inventory
        const tableInventory = [];
        let totalCapacity = 0;
        const pool = await (0, db_1.getDbClient)();
        for (const table of tables) {
            const tableId = `table_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            const [cafeTable] = await (0, db_1.insertQuery)('cafe_tables', {
                id: tableId,
                vendor_id: vendorId,
                table_number: table.tableNumber,
                name: table.name,
                capacity: table.capacity,
                section: table.section || 'Main Area',
                location: table.location || 'Indoor',
                is_outdoor: table.location === 'Outdoor',
                amenities: JSON.stringify(table.amenities || []),
                status: 'available',
                is_active: table.isActive !== false,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            });
            tableInventory.push(cafeTable || { id: tableId, ...table });
            totalCapacity += table.capacity;
        }
        console.log(`🪑 Table inventory setup for cafe ${vendorId}: ${tableInventory.length} tables, ${totalCapacity} capacity`);
        return (0, response_utils_1.sendSuccess)(c, {
            inventory: {
                totalTables: tableInventory.length,
                totalCapacity,
                tables: tableInventory
            }
        }, 'Table inventory configured successfully');
    }
    catch (error) {
        console.error('Error setting up table inventory:', error);
        return (0, response_utils_1.sendError)(c, error, 500);
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
            return (0, response_utils_1.sendError)(c, 'Missing required parameters: date, time', 400);
        }
        // ✅ SQL: Get all tables for vendor
        const pool = await (0, db_1.getDbClient)();
        const tables = await (0, db_1.selectQuery)('cafe_tables', { vendor_id: vendorId, is_active: true });
        if (tables.length === 0) {
            return (0, response_utils_1.sendError)(c, 'No tables configured for this cafe', 400);
        }
        // ✅ SQL: Get reservations for this date/time
        const reservationsResult = await pool.query(`SELECT * FROM bookings 
       WHERE vendor_id = $1 AND booking_date = $2 AND booking_time = $3 
       AND service_type = $4 AND status IN ($5, $6)`, [vendorId, date, time, 'cafe_reservation', 'pending', 'confirmed']);
        const reservations = reservationsResult.rows || [];
        // Get booked table IDs from reservation metadata
        const bookedTableIds = new Set(reservations?.map((r) => r.metadata?.tableId).filter(Boolean) || []);
        // Find available tables that fit the party size
        const availableTables = tables
            .filter(table => table.capacity >= capacity &&
            !bookedTableIds.has(table.id))
            .sort((a, b) => a.capacity - b.capacity);
        return (0, response_utils_1.sendSuccess)(c, {
            date,
            time,
            requestedCapacity: capacity,
            availableTables,
            totalAvailable: availableTables.length,
            isAvailable: availableTables.length > 0
        });
    }
    catch (error) {
        console.error('Error checking table availability:', error);
        return (0, response_utils_1.sendError)(c, error, 500);
    }
});
// ==========================================================================
// CREATE TABLE RESERVATION
// ==========================================================================
app.post('/cafe/:vendorId/reservations', async (c) => {
    try {
        const vendorId = c.req.param('vendorId');
        const { customerId, customerName, customerPhone, date, time, partySize, duration = 120, specialRequests, petDetails } = await c.req.json();
        if (!customerId || !date || !time || !partySize) {
            return (0, response_utils_1.sendError)(c, 'Missing required fields: customerId, date, time, partySize', 400);
        }
        return await (0, db_1.withTransaction)(async (txClient) => {
            // ✅ SQL: Get available tables
            const tables = await (0, db_1.selectQuery)('cafe_tables', { vendor_id: vendorId, is_active: true });
            // ✅ SQL: Get existing reservations for this time slot
            const existingReservationsResult = await txClient.query(`SELECT * FROM bookings 
         WHERE vendor_id = $1 AND booking_date = $2 AND booking_time = $3 
         AND service_type = $4 AND status IN ($5, $6)`, [vendorId, date, time, 'cafe_reservation', 'pending', 'confirmed']);
            const existingReservations = existingReservationsResult.rows || [];
            const bookedTableIds = new Set(existingReservations?.map((r) => r.metadata?.tableId).filter(Boolean) || []);
            // Find suitable table
            const availableTables = tables
                .filter(table => table.capacity >= partySize &&
                !bookedTableIds.has(table.id))
                .sort((a, b) => a.capacity - b.capacity);
            if (availableTables.length === 0) {
                return (0, response_utils_1.sendError)(c, 'No tables available for requested time and party size', 409);
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
            await (0, db_1.updateQuery)('cafe_tables', { id: assignedTable.id }, { status: 'reserved', updated_at: new Date().toISOString() });
            console.log(`🪑 Table reservation created: ${booking.id} for ${date} ${time}`);
            return (0, response_utils_1.sendSuccess)(c, {
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
    }
    catch (error) {
        console.error('Error creating reservation:', error);
        return (0, response_utils_1.sendError)(c, error, 500);
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
        const pool = await (0, db_1.getDbClient)();
        let sql = 'SELECT * FROM bookings WHERE vendor_id = $1 AND service_type = $2';
        const params = [vendorId, 'cafe_reservation'];
        if (date) {
            params.push(date);
            sql += ` AND booking_date = $${params.length}`;
        }
        if (status) {
            params.push(status);
            sql += ` AND status = $${params.length}`;
        }
        sql += ' ORDER BY created_at DESC';
        if (limit) {
            params.push(limit);
            sql += ` LIMIT $${params.length}`;
        }
        if (offset) {
            params.push(offset);
            sql += ` OFFSET $${params.length}`;
        }
        const bookingsResult = await pool.query(sql, params);
        const bookings = bookingsResult.rows || [];
        const reservations = bookings?.map((booking) => ({
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
        return (0, response_utils_1.sendSuccess)(c, {
            reservations,
            pagination: {
                totalCount: reservations.length,
                limit,
                offset,
                hasMore: reservations.length === limit
            }
        });
    }
    catch (error) {
        console.error('Error fetching cafe reservations:', error);
        return (0, response_utils_1.sendError)(c, error, 500);
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
            return (0, response_utils_1.sendError)(c, 'status required', 400);
        }
        const validStatuses = ['confirmed', 'cancelled', 'completed', 'no-show'];
        if (!validStatuses.includes(status)) {
            return (0, response_utils_1.sendError)(c, 'Invalid status', 400);
        }
        // ✅ SQL: Get reservation (booking)
        const booking = await bookingsRepo.findById(reservationId);
        if (!booking) {
            return (0, response_utils_1.sendError)(c, 'Reservation not found', 404);
        }
        // Verify ownership
        if (vendorId && booking.vendor_id !== vendorId) {
            return (0, response_utils_1.sendError)(c, 'Unauthorized', 403);
        }
        // ✅ SQL: Update booking status
        const updateData = {
            status,
            updated_at: new Date().toISOString()
        };
        if (status === 'cancelled') {
            updateData.cancelled_at = new Date().toISOString();
            updateData.cancellation_reason = cancellationReason || '';
            // ✅ SQL: Free up the table
            if (booking.metadata?.tableId) {
                await (0, db_1.updateQuery)('cafe_tables', { id: booking.metadata.tableId }, { status: 'available', updated_at: new Date().toISOString() });
            }
        }
        else if (status === 'completed') {
            updateData.completed_at = new Date().toISOString();
            // ✅ SQL: Free up the table
            if (booking.metadata?.tableId) {
                await (0, db_1.updateQuery)('cafe_tables', { id: booking.metadata.tableId }, { status: 'available', updated_at: new Date().toISOString() });
            }
        }
        await bookingsRepo.update(reservationId, updateData);
        console.log(`🪑 Reservation ${reservationId} status updated to ${status}`);
        return (0, response_utils_1.sendSuccess)(c, { reservation: { ...booking, ...updateData } }, `Reservation ${status} successfully`);
    }
    catch (error) {
        console.error('Error updating reservation status:', error);
        return (0, response_utils_1.sendError)(c, error, 500);
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
        const pool = await (0, db_1.getDbClient)();
        const tables = await (0, db_1.selectQuery)('cafe_tables', { vendor_id: vendorId, is_active: true });
        // ✅ SQL: Get all reservations for the date
        const reservationsResult = await pool.query(`SELECT * FROM bookings 
       WHERE vendor_id = $1 AND booking_date = $2 
       AND service_type = $3 AND status = $4`, [vendorId, date, 'cafe_reservation', 'confirmed']);
        const reservations = reservationsResult.rows || [];
        // Calculate occupancy by time slot
        const timeSlots = [
            '09:00', '10:00', '11:00', '12:00', '13:00', '14:00',
            '15:00', '16:00', '17:00', '18:00', '19:00', '20:00', '21:00'
        ];
        const occupancy = timeSlots.map(time => {
            const reservedTables = reservations?.filter((r) => r.booking_time === time) || [];
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
        return (0, response_utils_1.sendSuccess)(c, {
            date,
            occupancy,
            totalTables: tables.length
        });
    }
    catch (error) {
        console.error('Error fetching table occupancy:', error);
        return (0, response_utils_1.sendError)(c, error, 500);
    }
});
function cafeTableManagementSQL(mainApp) {
    mainApp.route('/', app);
}
exports.default = cafeTableManagementSQL;
//# sourceMappingURL=cafe-table-management-sql.js.map