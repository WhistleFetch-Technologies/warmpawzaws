// ✅ SQL MIGRATION: All KV operations replaced with SQL repositories
import { Hono } from "hono";
import { format, addDays, parseISO, eachDayOfInterval } from "date-fns";
import { sendSuccess, sendError } from "./response-utils";
import { 
  getBoardingRoomsRepository,
  getBookingsRepository,
  getDbClient
} from '../../../supabase/lib/repositories/index';

/**
 * Resort & Boarding Inventory Management
 * Handles date-range availability and inventory tracking
 */
export function registerResortInventory(app: Hono) {

  // ==========================================
  // 1. ROOM CONFIGURATION (With Inventory Count)
  // ==========================================

  /**
   * POST /make-server-3dd53475/resort/rooms
   * Create or Update a room category with total inventory count
   */
  app.post("/make-server-3dd53475/resort/rooms", async (c) => {
    try {
      const { vendorId, name, description, price, maxOccupancy, totalInventory, amenities, images } = await c.req.json();

      if (!vendorId || !name || !price) {
        return sendError(c, 'Missing required fields: vendorId, name, price', 400);
      }

      // ✅ SQL: Create room in boarding_rooms table
      const boardingRoomsRepo = getBoardingRoomsRepository();
      const room = await boardingRoomsRepo.create({
        vendorId,
        name,
        description: description || '',
        dayPrice: Number(price),
        nightPrice: Number(price),
        capacity: Number(maxOccupancy) || 2,
        totalUnits: Number(totalInventory) || 1, // Total physical rooms of this type
        amenities: amenities || [],
        photos: images || [],
        isActive: true
      });

      return sendSuccess(c, { room });
    } catch (error) {
      return sendError(c, error, 500);
    }
  });

  /**
   * GET /make-server-3dd53475/resort/rooms/:vendorId
   */
  app.get("/make-server-3dd53475/resort/rooms/:vendorId", async (c) => {
    try {
      const { vendorId } = c.req.param();
      // ✅ SQL: Get rooms from boarding_rooms table
      const boardingRoomsRepo = getBoardingRoomsRepository();
      const rooms = await boardingRoomsRepo.findByVendor(vendorId, { isActive: true });

      return sendSuccess(c, { rooms });
    } catch (error) {
      return sendError(c, error, 500);
    }
  });

  // ==========================================
  // 2. INVENTORY CHECK (Date Range)
  // ==========================================

  /**
   * GET /make-server-3dd53475/resort/availability
   * Check availability for a specific date range
   * Query: vendorId, roomId, fromDate (YYYY-MM-DD), toDate (YYYY-MM-DD), quantity
   */
  app.get("/make-server-3dd53475/resort/availability", async (c) => {
    try {
      const vendorId = c.req.query('vendorId');
      const roomId = c.req.query('roomId');
      const fromDateStr = c.req.query('fromDate'); // YYYY-MM-DD
      const toDateStr = c.req.query('toDate');     // YYYY-MM-DD
      const quantity = Number(c.req.query('quantity') || 1);

      if (!vendorId || !roomId || !fromDateStr || !toDateStr) {
        return sendError(c, 'Missing params: vendorId, roomId, fromDate, toDate', 400);
      }

      // ✅ SQL: 1. Get Room Details from boarding_rooms table
      const boardingRoomsRepo = getBoardingRoomsRepository();
      const room = await boardingRoomsRepo.findById(roomId);
      if (!room) {
        return sendError(c, 'Room not found', 404);
      }

      // 2. Generate array of dates to check
      const start = parseISO(fromDateStr);
      const end = parseISO(toDateStr);
      
      // If same day booking (day use), check just that day. If overnight, check check-in through day before check-out
      // Logic: You need the room for the night of the date.
      // If booking Jan 1 to Jan 3 (2 nights), we check availability for Jan 1 and Jan 2.
      const nights = eachDayOfInterval({ start, end: addDays(end, -1) }); // Exclude checkout day

      let isAvailable = true;
      const dailyAvailability = [];

      // ✅ SQL: 3. Check each night by counting bookings for each date
      const bookingsRepo = getBookingsRepository();
      const db = getDbClient();
      
      for (const dateObj of nights) {
        const dateStr = format(dateObj, 'yyyy-MM-dd');
        
        // Count bookings for this room on this date
        const { data: bookings } = await db
          .from('bookings')
          .select('id', { count: 'exact' })
          .eq('service_id', roomId) // Assuming roomId is stored as service_id
          .eq('booking_date', dateStr)
          .in('status', ['confirmed', 'in_progress', 'completed']);
        
        const bookedCount = bookings?.length || 0;
        const available = room.totalUnits - bookedCount;

        dailyAvailability.push({ date: dateStr, available, total: room.totalUnits });

        if (available < quantity) {
          isAvailable = false;
        }
      }

      return sendSuccess(c, { 
        isAvailable, 
        requestedQuantity: quantity,
        dailyAvailability,
        roomDetails: {
            name: room.name,
            totalInventory: room.totalUnits
        }
      });

    } catch (error) {
      return sendError(c, error, 500);
    }
  });

  /**
   * POST /make-server-3dd53475/resort/book
   * Internal utility to Reserve Inventory (Call this when booking is confirmed)
   */
  app.post("/make-server-3dd53475/resort/reserve-inventory", async (c) => {
    try {
      const { roomId, fromDate, toDate, quantity } = await c.req.json();
      
      const start = parseISO(fromDate);
      const end = parseISO(toDate);
      const nights = eachDayOfInterval({ start, end: addDays(end, -1) });

      // ✅ SQL: Reserve inventory by creating bookings (or updating inventory table if exists)
      // Note: Inventory reservation happens when booking is created/confirmed
      // This endpoint should be called after booking confirmation
      const db = getDbClient();
      
      // Store inventory reservation in resort_inventory table (if exists) or bookings table
      for (const dateObj of nights) {
        const dateStr = format(dateObj, 'yyyy-MM-dd');
        
        // Check if resort_inventory table exists, otherwise use bookings count
        // For now, we'll rely on bookings table to track inventory
        // The actual reservation happens when booking is created with status 'confirmed'
        // This is just a marker that inventory should be reserved
        await db
          .from('resort_inventory_reservations')
          .upsert({
            room_id: roomId,
            date: dateStr,
            reserved_quantity: Number(quantity) || 1,
            updated_at: new Date().toISOString()
          }, {
            onConflict: 'room_id,date'
          });
      }

      return sendSuccess(c, { message: 'Inventory reserved' });
    } catch (error) {
      return sendError(c, error, 500);
    }
  });
}
