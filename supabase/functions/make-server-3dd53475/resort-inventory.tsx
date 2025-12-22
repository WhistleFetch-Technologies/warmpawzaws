import { Hono } from "npm:hono";
import { format, addDays, parseISO, eachDayOfInterval } from "npm:date-fns";
import * as kv from "./kv_store.tsx";
import { sendSuccess, sendError } from "./response-utils.ts";

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

      const roomId = `room_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      
      const room = {
        id: roomId,
        vendorId,
        name,
        description,
        price: Number(price),
        maxOccupancy: Number(maxOccupancy) || 2,
        totalInventory: Number(totalInventory) || 1, // Total physical rooms of this type
        amenities: amenities || [],
        images: images || [],
        isActive: true,
        createdAt: new Date().toISOString()
      };

      // Save Room Definition
      await kv.set(`resort:room:${roomId}`, room);
      
      // Index by Vendor
      const vendorRoomsKey = `vendor:${vendorId}:rooms`;
      const vendorRooms = await kv.get(vendorRoomsKey) || [];
      vendorRooms.push(roomId);
      await kv.set(vendorRoomsKey, vendorRooms);

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
      const vendorRoomsKey = `vendor:${vendorId}:rooms`;
      const roomIds = await kv.get(vendorRoomsKey) || [];
      
      const rooms = [];
      for (const id of roomIds) {
        const room = await kv.get(`resort:room:${id}`);
        if (room && room.isActive) {
          rooms.push(room);
        }
      }

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

      // 1. Get Room Details (to know total capacity)
      const room = await kv.get(`resort:room:${roomId}`);
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

      // 3. Check each night
      for (const dateObj of nights) {
        const dateStr = format(dateObj, 'yyyy-MM-dd');
        const inventoryKey = `inventory:resort:${roomId}:${dateStr}`;
        
        // Get current bookings count for this date
        const bookedCount = await kv.get(inventoryKey) || 0;
        const available = room.totalInventory - bookedCount;

        dailyAvailability.push({ date: dateStr, available, total: room.totalInventory });

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
            totalInventory: room.totalInventory
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

      // Simple transaction simulation
      // In a real DB we'd use row locking. Here we just increment.
      for (const dateObj of nights) {
        const dateStr = format(dateObj, 'yyyy-MM-dd');
        const inventoryKey = `inventory:resort:${roomId}:${dateStr}`;
        
        const currentBooked = await kv.get(inventoryKey) || 0;
        await kv.set(inventoryKey, currentBooked + (Number(quantity) || 1));
      }

      return sendSuccess(c, { message: 'Inventory reserved' });
    } catch (error) {
      return sendError(c, error, 500);
    }
  });
}
