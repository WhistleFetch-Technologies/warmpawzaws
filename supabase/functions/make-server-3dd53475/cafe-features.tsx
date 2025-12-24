/**
 * ============================================================================
 * CAFE FEATURES - SQL-ONLY VERSION
 * ============================================================================
 * 
 * REFACTORED: Removed all KV usage, using SQL repositories only
 * 
 * Features:
 * - Table management
 * - Party packages (stored in service_packages)
 * - Availability checking
 * - Cafe profile & menu (stored in vendor metadata)
 * 
 * RULES:
 * ❌ NO KV imports allowed
 * ✅ All operations use SQL only
 * ✅ Proper error handling
 * ✅ CRUD operations via repositories
 * 
 * Date: 2025-01-27
 * Migration: Phase 2 - Critical Flow Migration
 * ============================================================================
 */

import { Hono } from "npm:hono";
import { getCafeTablesRepository } from "../../lib/repositories/cafe-tables.ts";
import { getVendorsRepository } from "../../lib/repositories/vendors.ts";
import { getBookingsRepository } from "../../lib/repositories/bookings.ts";
import { getPackagesRepository } from "../../lib/repositories/packages.ts";

export function registerCafeFeatures(app: Hono) {
  const BASE = '/make-server-3dd53475';
  const cafeTablesRepo = getCafeTablesRepository();
  const vendorsRepo = getVendorsRepository();
  const bookingsRepo = getBookingsRepository();
  const packagesRepo = getPackagesRepository();

  // ==========================================
  // 1. TABLE MANAGEMENT
  // ==========================================

  /**
   * POST /make-server-3dd53475/cafe/tables
   * Create a new table configuration
   */
  app.post(`${BASE}/cafe/tables`, async (c) => {
    try {
      const { vendorId, name, capacity, section, isOutdoor } = await c.req.json();
      
      if (!vendorId || !name || !capacity) {
        return c.json({ error: 'Missing required fields: vendorId, name, capacity' }, 400);
      }

      // ✅ SQL: Create table
      const newTable = await cafeTablesRepo.create({
        vendorId,
        tableNumber: name,
        name,
        capacity: Number(capacity),
        section: section || 'Main Area',
        isOutdoor: isOutdoor || false,
        isActive: true,
      });

      return c.json({ success: true, table: newTable });
    } catch (error) {
      return c.json({ error: String(error) }, 500);
    }
  });

  /**
   * GET /make-server-3dd53475/cafe/tables/:vendorId
   * Get all tables for a vendor
   */
  app.get(`${BASE}/cafe/tables/:vendorId`, async (c) => {
    try {
      const { vendorId } = c.req.param();
      
      // ✅ SQL: Get tables
      const tables = await cafeTablesRepo.findByVendor(vendorId, { isActive: true });

      return c.json({ success: true, tables });
    } catch (error) {
      return c.json({ error: String(error) }, 500);
    }
  });

  /**
   * DELETE /make-server-3dd53475/cafe/tables/:tableId
   * Soft delete a table
   */
  app.delete(`${BASE}/cafe/tables/:tableId`, async (c) => {
    try {
      const { tableId } = c.req.param();
      
      // ✅ SQL: Soft delete table
      const deleted = await cafeTablesRepo.delete(tableId);
      
      if (!deleted) {
        return c.json({ error: 'Table not found' }, 404);
      }

      return c.json({ success: true, message: 'Table deleted' });
    } catch (error) {
      return c.json({ error: String(error) }, 500);
    }
  });

  // ==========================================
  // 2. PARTY PACKAGES
  // ==========================================

  /**
   * POST /make-server-3dd53475/cafe/packages
   * Create a party package
   */
  app.post(`${BASE}/cafe/packages`, async (c) => {
    try {
      const { vendorId, name, description, price, minPax, maxPax, duration, inclusions } = await c.req.json();
      
      if (!vendorId || !name || !price) {
        return c.json({ error: 'Missing required fields' }, 400);
      }

      // ✅ SQL: Create package (stored in service_packages with service_type='cafe_party')
      // Store cafe-specific details in includes array
      const cafePackageIncludes = [
        ...(inclusions || []),
        `minPax:${Number(minPax) || 1}`,
        `maxPax:${Number(maxPax) || 100}`,
        `duration:${Number(duration) || 120}`
      ];
      
      const newPackage = await packagesRepo.createPackage({
        vendorId,
        name,
        description,
        serviceType: 'cafe_party',
        price: Number(price),
        totalSessions: 1,
        pricePerSession: Number(price),
        includes: cafePackageIncludes,
        isActive: true,
      });

      return c.json({ success: true, package: newPackage });
    } catch (error) {
      return c.json({ error: String(error) }, 500);
    }
  });

  /**
   * GET /make-server-3dd53475/cafe/packages/:vendorId
   * List party packages
   */
  app.get(`${BASE}/cafe/packages/:vendorId`, async (c) => {
    try {
      const { vendorId } = c.req.param();
      
      // ✅ SQL: Get packages (filter by service_type='cafe_party')
      const packages = await packagesRepo.getVendorPackages(vendorId, 'cafe_party');

      return c.json({ success: true, packages });
    } catch (error) {
      return c.json({ error: String(error) }, 500);
    }
  });

  // ==========================================
  // 3. AVAILABILITY CHECK (PAX-BASED)
  // ==========================================

  /**
   * GET /make-server-3dd53475/cafe/availability
   * Check if there is a table with enough capacity for the requested time
   * Query: vendorId, date, time, pax
   */
  app.get(`${BASE}/cafe/availability`, async (c) => {
    try {
      const vendorId = c.req.query('vendorId');
      const date = c.req.query('date');
      const time = c.req.query('time');
      const pax = Number(c.req.query('pax'));

      if (!vendorId || !date || !time || !pax) {
        return c.json({ error: 'Missing params: vendorId, date, time, pax' }, 400);
      }

      // ✅ SQL: Get all tables for vendor with sufficient capacity
      const allTables = await cafeTablesRepo.findByVendor(vendorId, { isActive: true });
      const suitableTables = allTables.filter((t: any) => t.capacity >= pax);

      // If no table can fit this PAX, return false immediately
      if (suitableTables.length === 0) {
         return c.json({ success: true, available: false, message: 'No table with sufficient capacity' });
      }

      // ✅ SQL: Check existing bookings for this time slot
      const bookings = await bookingsRepo.findAll({
        status: undefined, // Get all non-cancelled bookings
      });

      const occupiedTableIds = new Set();

      for (const booking of bookings) {
        if (booking.vendor_id === vendorId &&
            booking.status !== 'cancelled' && 
            booking.booking_date === date &&
            booking.notes) {
          try {
            const notes = typeof booking.notes === 'string' ? JSON.parse(booking.notes) : booking.notes;
            if (notes.tableId && booking.booking_time === time) {
              occupiedTableIds.add(notes.tableId);
            }
          } catch (e) {
            // Ignore parse errors
          }
        }
      }

      // Find available tables
      const availableTables = suitableTables.filter((t: any) => !occupiedTableIds.has(t.id));

      return c.json({
        success: true,
        available: availableTables.length > 0,
        availableTablesCount: availableTables.length,
        suggestedTables: availableTables
      });

    } catch (error) {
      return c.json({ error: String(error) }, 500);
    }
  });

  // ==========================================
  // 4. CAFE PROFILE MANAGEMENT
  // ==========================================

  /**
   * GET /make-server-3dd53475/cafe/profile/:vendorId
   * Get detailed cafe profile
   */
  app.get(`${BASE}/cafe/profile/:vendorId`, async (c) => {
    try {
      const { vendorId } = c.req.param();
      
      // ✅ SQL: Get vendor
      const vendor = await vendorsRepo.findById(vendorId);
      if (!vendor) {
        return c.json({ error: 'Vendor not found' }, 404);
      }

      // Get cafe profile and menu from vendor metadata
      const cafeProfile = (vendor.metadata as any)?.cafeProfile || {};
      const menu = (vendor.metadata as any)?.cafeMenu || [];

      return c.json({
        success: true,
        profile: {
          id: vendorId,
          name: vendor.business_name,
          description: cafeProfile.description || vendor.description || 'Welcome to our pet cafe!',
          address: vendor.address || 'Address not available',
          rating: (vendor as any).rating || 5.0,
          reviewsCount: (vendor as any).reviewsCount || 0,
          costForTwo: cafeProfile.costForTwo || 500,
          cuisines: cafeProfile.cuisines || ['Cafe', 'Snacks'],
          photos: cafeProfile.photos || (vendor as any).gallery || [],
          amenities: cafeProfile.amenities || ['Pet Friendly', 'WiFi'],
          openHours: cafeProfile.openHours || '9:00 AM - 9:00 PM',
          phone: vendor.phone,
          coordinates: vendor.address ? { lat: (vendor as any).latitude || 0, lng: (vendor as any).longitude || 0 } : { lat: 0, lng: 0 },
          menu: menu
        }
      });
    } catch (error) {
      return c.json({ error: String(error) }, 500);
    }
  });

  /**
   * POST /make-server-3dd53475/cafe/profile/:vendorId
   */
  app.post(`${BASE}/cafe/profile/:vendorId`, async (c) => {
    try {
      const { vendorId } = c.req.param();
      const body = await c.req.json();
      
      // ✅ SQL: Get vendor
      const vendor = await vendorsRepo.findById(vendorId);
      if (!vendor) {
        return c.json({ error: 'Vendor not found' }, 404);
      }

      // ✅ SQL: Update vendor metadata with cafe profile
      const metadata = vendor.metadata || {};
      (metadata as any).cafeProfile = {
        ...(metadata as any).cafeProfile,
        ...body,
        updatedAt: new Date().toISOString()
      };

      await vendorsRepo.update(vendorId, {
        metadata: metadata,
      });

      return c.json({ success: true, profile: (metadata as any).cafeProfile });
    } catch (error) {
      return c.json({ error: String(error) }, 500);
    }
  });

  /**
   * POST /make-server-3dd53475/cafe/menu/:vendorId
   */
  app.post(`${BASE}/cafe/menu/:vendorId`, async (c) => {
    try {
      const { vendorId } = c.req.param();
      const { menu } = await c.req.json();
      
      // ✅ SQL: Get vendor
      const vendor = await vendorsRepo.findById(vendorId);
      if (!vendor) {
        return c.json({ error: 'Vendor not found' }, 404);
      }

      // ✅ SQL: Update vendor metadata with cafe menu
      const metadata = vendor.metadata || {};
      (metadata as any).cafeMenu = menu;

      await vendorsRepo.update(vendorId, {
        metadata: metadata,
      });

      return c.json({ success: true });
    } catch (error) {
      return c.json({ error: String(error) }, 500);
    }
  });

  console.log('✅ Cafe Features (SQL) registered');
}

