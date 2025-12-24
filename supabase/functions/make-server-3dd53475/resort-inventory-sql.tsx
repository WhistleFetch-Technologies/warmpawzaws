/**
 * ============================================================================
 * RESORT & BOARDING INVENTORY MANAGEMENT - SQL-ONLY VERSION
 * ============================================================================
 * 
 * REFACTORED: Removed all KV usage, using SQL repositories only
 * 
 * Handles date-range availability and inventory tracking
 * 
 * CHANGES:
 * - Removed `kv` imports
 * - Replaced all `kv.get()`, `kv.set()` with repository calls
 * - Uses resort_room_configurations and resort_availability_calendar tables
 * 
 * Date: 2025-01-27
 * Migration: Phase 6 - Complete KV to SQL Migration
 * ============================================================================
 */

import { Hono } from "npm:hono";
import { format, addDays, parseISO, eachDayOfInterval } from "npm:date-fns";
import { sendSuccess, sendError } from "./response-utils.ts";
import { getResortPreCheckRepository } from "../../lib/repositories/resort-precheck.ts";
import { getDbClient } from "../../lib/db.ts";

export function registerResortInventory(app: Hono) {
  const preCheckRepo = getResortPreCheckRepository();
  const client = getDbClient();

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
      
      // ✅ SQL: Create room configuration
      // Map the simpler room structure to room_configuration structure
      const roomConfig = await preCheckRepo.createRoomConfiguration({
        config_id: roomId,
        vendor_id: vendorId,
        room_type: 'standard', // Default, can be made configurable
        room_size: 'medium', // Default, can be made configurable
        total_rooms: Number(totalInventory) || 1,
        available_rooms: Number(totalInventory) || 1,
        features: [],
        pricing: {
          dailyRate: Number(price),
          weeklyRate: Number(price) * 7 * 0.9, // 10% discount for weekly
          monthlyRate: Number(price) * 30 * 0.85 // 15% discount for monthly
        },
        amenities: amenities || [],
        pet_size_limit: 'any',
        max_occupancy: Number(maxOccupancy) || 2,
        photos: images || [],
        is_active: true
      });

      // Transform to match original interface
      const room = {
        id: roomConfig.config_id,
        vendorId: roomConfig.vendor_id,
        name: name,
        description: description || '',
        price: price,
        maxOccupancy: roomConfig.max_occupancy,
        totalInventory: roomConfig.total_rooms,
        amenities: roomConfig.amenities,
        images: roomConfig.photos,
        isActive: roomConfig.is_active,
        createdAt: roomConfig.created_at
      };

      return sendSuccess(c, { room });
    } catch (error) {
      console.error('Error creating resort room:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * GET /make-server-3dd53475/resort/rooms/:vendorId
   */
  app.get("/make-server-3dd53475/resort/rooms/:vendorId", async (c) => {
    try {
      const { vendorId } = c.req.param();

      // ✅ SQL: Get room configurations for vendor
      const configs = await preCheckRepo.getRoomConfigurationsByVendor(vendorId, true);

      // Transform to match original interface
      const rooms = configs.map(config => ({
        id: config.config_id,
        vendorId: config.vendor_id,
        name: config.room_type, // Use room_type as name (could be enhanced)
        description: '',
        price: config.pricing?.dailyRate || 0,
        maxOccupancy: config.max_occupancy,
        totalInventory: config.total_rooms,
        amenities: config.amenities,
        images: config.photos,
        isActive: config.is_active,
        createdAt: config.created_at
      }));

      return sendSuccess(c, { rooms });
    } catch (error) {
      console.error('Error fetching resort rooms:', error);
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

      // ✅ SQL: Get Room Details
      const roomConfig = await preCheckRepo.getRoomConfigurationByConfigId(roomId);
      if (!roomConfig) {
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
        
        // ✅ SQL: Get bookings for this room and date
        // Use bookings table to count overlapping bookings
        const { data: bookings, error: bookingsError } = await client
          .from('bookings')
          .select('id')
          .eq('vendor_id', vendorId)
          .eq('booking_date', dateStr)
          .neq('status', 'cancelled')
          .not('notes', 'is', null); // Assume notes contains room info if needed

        if (bookingsError) {
          console.error('Error fetching bookings:', bookingsError);
        }

        // For now, use a simple count. In production, you'd track room assignments in a separate table
        const bookedCount = bookings?.length || 0;
        const available = roomConfig.total_rooms - bookedCount;

        dailyAvailability.push({ 
          date: dateStr, 
          available, 
          total: roomConfig.total_rooms 
        });

        if (available < quantity) {
          isAvailable = false;
        }
      }

      return sendSuccess(c, { 
        isAvailable, 
        requestedQuantity: quantity,
        dailyAvailability,
        roomDetails: {
            name: roomConfig.room_type,
            totalInventory: roomConfig.total_rooms
        }
      });

    } catch (error) {
      console.error('Error checking availability:', error);
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
      
      // ✅ SQL: Update availability calendar
      // For each date in the range, update the booked count
      const start = parseISO(fromDate);
      const end = parseISO(toDate);
      const nights = eachDayOfInterval({ start, end: addDays(end, -1) });

      // Get room config to find vendor_id
      const roomConfig = await preCheckRepo.getRoomConfigurationByConfigId(roomId);
      if (!roomConfig) {
        return sendError(c, 'Room not found', 404);
      }

      // Update availability calendar for each date
      for (const dateObj of nights) {
        const dateStr = format(dateObj, 'yyyy-MM-dd');
        
        // ✅ SQL: Get or create availability calendar entry
        const { data: existing } = await client
          .from('resort_availability_calendar')
          .select('*')
          .eq('vendor_id', roomConfig.vendor_id)
          .eq('room_type', roomConfig.room_type)
          .eq('date', dateStr)
          .maybeSingle();

        const bookedCount = existing?.booked_count || 0;
        const newBookedCount = bookedCount + (Number(quantity) || 1);

        if (existing) {
          // Update existing entry
          await client
            .from('resort_availability_calendar')
            .update({
              booked_count: newBookedCount,
              available_count: roomConfig.total_rooms - newBookedCount,
              updated_at: new Date().toISOString()
            })
            .eq('id', existing.id);
        } else {
          // Create new entry
          await client
            .from('resort_availability_calendar')
            .insert({
              availability_id: `avail-${roomConfig.vendor_id}-${roomConfig.room_type}-${dateStr}`,
              vendor_id: roomConfig.vendor_id,
              room_type: roomConfig.room_type,
              date: dateStr,
              total_capacity: roomConfig.total_rooms,
              booked_count: newBookedCount,
              available_count: roomConfig.total_rooms - newBookedCount,
              blocked_slots: [],
              pricing: roomConfig.pricing
            });
        }
      }

      return sendSuccess(c, { message: 'Inventory reserved' });
    } catch (error) {
      console.error('Error reserving inventory:', error);
      return sendError(c, error, 500);
    }
  });
}

