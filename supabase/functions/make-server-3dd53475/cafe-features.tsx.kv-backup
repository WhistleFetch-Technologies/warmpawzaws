import { Hono } from "npm:hono";
import * as kv from "./kv_store.tsx";

export function registerCafeFeatures(app: Hono) {

  // ==========================================
  // 1. TABLE MANAGEMENT
  // ==========================================

  /**
   * POST /make-server-3dd53475/cafe/tables
   * Create a new table configuration
   */
  app.post("/make-server-3dd53475/cafe/tables", async (c) => {
    try {
      const { vendorId, name, capacity, section, isOutdoor } = await c.req.json();
      
      if (!vendorId || !name || !capacity) {
        return c.json({ error: 'Missing required fields: vendorId, name, capacity' }, 400);
      }

      const tableId = `table_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      
      const newTable = {
        id: tableId,
        vendorId,
        name,
        capacity: Number(capacity), // PAX capacity
        section: section || 'Main Area',
        isOutdoor: isOutdoor || false,
        isActive: true,
        createdAt: new Date().toISOString()
      };

      // Save Table
      await kv.set(`cafe:table:${tableId}`, newTable);
      
      // Index by Vendor
      const vendorTablesKey = `vendor:${vendorId}:tables`;
      const vendorTables = await kv.get(vendorTablesKey) || [];
      vendorTables.push(tableId);
      await kv.set(vendorTablesKey, vendorTables);

      return c.json({ success: true, table: newTable });
    } catch (error) {
      return c.json({ error: String(error) }, 500);
    }
  });

  /**
   * GET /make-server-3dd53475/cafe/tables/:vendorId
   * Get all tables for a vendor
   */
  app.get("/make-server-3dd53475/cafe/tables/:vendorId", async (c) => {
    try {
      const { vendorId } = c.req.param();
      const vendorTablesKey = `vendor:${vendorId}:tables`;
      const tableIds = await kv.get(vendorTablesKey) || [];
      
      const tables = [];
      for (const id of tableIds) {
        const table = await kv.get(`cafe:table:${id}`);
        if (table && table.isActive) {
          tables.push(table);
        }
      }

      return c.json({ success: true, tables });
    } catch (error) {
      return c.json({ error: String(error) }, 500);
    }
  });

  /**
   * DELETE /make-server-3dd53475/cafe/tables/:tableId
   * Soft delete a table
   */
  app.delete("/make-server-3dd53475/cafe/tables/:tableId", async (c) => {
    try {
      const { tableId } = c.req.param();
      const table = await kv.get(`cafe:table:${tableId}`);
      
      if (!table) return c.json({ error: 'Table not found' }, 404);
      
      table.isActive = false;
      await kv.set(`cafe:table:${tableId}`, table);

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
  app.post("/make-server-3dd53475/cafe/packages", async (c) => {
    try {
      const { vendorId, name, description, price, minPax, maxPax, duration, inclusions } = await c.req.json();
      
      if (!vendorId || !name || !price) {
        return c.json({ error: 'Missing required fields' }, 400);
      }

      const packageId = `party_pkg_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      
      const newPackage = {
        id: packageId,
        vendorId,
        name,
        description,
        price: Number(price),
        minPax: Number(minPax) || 1,
        maxPax: Number(maxPax) || 100,
        duration: Number(duration) || 120, // Minutes
        inclusions: inclusions || [], // Array of strings (e.g., "Cake", "Decor")
        isActive: true,
        createdAt: new Date().toISOString()
      };

      await kv.set(`cafe:package:${packageId}`, newPackage);
      
      const vendorPkgKey = `vendor:${vendorId}:party_packages`;
      const vendorPkgs = await kv.get(vendorPkgKey) || [];
      vendorPkgs.push(packageId);
      await kv.set(vendorPkgKey, vendorPkgs);

      return c.json({ success: true, package: newPackage });
    } catch (error) {
      return c.json({ error: String(error) }, 500);
    }
  });

  /**
   * GET /make-server-3dd53475/cafe/packages/:vendorId
   * List party packages
   */
  app.get("/make-server-3dd53475/cafe/packages/:vendorId", async (c) => {
    try {
      const { vendorId } = c.req.param();
      const vendorPkgKey = `vendor:${vendorId}:party_packages`;
      const pkgIds = await kv.get(vendorPkgKey) || [];
      
      const packages = [];
      for (const id of pkgIds) {
        const pkg = await kv.get(`cafe:package:${id}`);
        if (pkg && pkg.isActive) {
          packages.push(pkg);
        }
      }

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
  app.get("/make-server-3dd53475/cafe/availability", async (c) => {
    try {
      const vendorId = c.req.query('vendorId');
      const date = c.req.query('date');
      const time = c.req.query('time');
      const pax = Number(c.req.query('pax'));

      if (!vendorId || !date || !time || !pax) {
        return c.json({ error: 'Missing params: vendorId, date, time, pax' }, 400);
      }

      // 1. Get all tables for vendor
      const vendorTablesKey = `vendor:${vendorId}:tables`;
      const tableIds = await kv.get(vendorTablesKey) || [];
      const allTables = [];
      for (const id of tableIds) {
        const t = await kv.get(`cafe:table:${id}`);
        if (t && t.isActive && t.capacity >= pax) {
          allTables.push(t);
        }
      }

      // If no table can fit this PAX, return false immediately
      if (allTables.length === 0) {
         return c.json({ success: true, available: false, message: 'No table with sufficient capacity' });
      }

      // 2. Check existing bookings for this time slot
      // Note: This is a simplified check. A real system would check duration overlaps.
      // We'll assume a standard 90 min slot for now or check exact matches.
      const vendorBookingsKey = `vendor:${vendorId}:bookings`;
      const bookingIds = await kv.get(vendorBookingsKey) || [];
      
      const occupiedTableIds = new Set();

      for (const bId of bookingIds) {
        const booking = await kv.get(`booking:${bId}`);
        if (booking && 
            booking.status !== 'cancelled' && 
            booking.status !== 'rejected' && 
            booking.bookingDate === date && 
            booking.tableId) {
            
            // Check time overlap (Simple equality for MVP, ideally range check)
            if (booking.bookingTime === time) {
              occupiedTableIds.add(booking.tableId);
            }
        }
      }

      // 3. Find available tables
      const availableTables = allTables.filter(t => !occupiedTableIds.has(t.id));

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
  app.get("/make-server-3dd53475/cafe/profile/:vendorId", async (c) => {
    try {
      const { vendorId } = c.req.param();
      
      const vendor = await kv.get(`vendor:${vendorId}`);
      if (!vendor) return c.json({ error: 'Vendor not found' }, 404);

      const cafeProfile = await kv.get(`cafe:profile:${vendorId}`) || {};
      const menu = await kv.get(`cafe:menu:${vendorId}`) || [];

      return c.json({
        success: true,
        profile: {
          id: vendorId,
          name: vendor.businessName || vendor.fullName,
          description: cafeProfile.description || vendor.description || 'Welcome to our pet cafe!',
          address: vendor.address || 'Address not available',
          rating: vendor.rating || 5.0,
          reviewsCount: vendor.reviewsCount || 0,
          costForTwo: cafeProfile.costForTwo || 500,
          cuisines: cafeProfile.cuisines || ['Cafe', 'Snacks'],
          photos: cafeProfile.photos || vendor.gallery || [],
          amenities: cafeProfile.amenities || ['Pet Friendly', 'WiFi'],
          openHours: cafeProfile.openHours || '9:00 AM - 9:00 PM',
          phone: vendor.phone,
          coordinates: vendor.location || { lat: 0, lng: 0 },
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
  app.post("/make-server-3dd53475/cafe/profile/:vendorId", async (c) => {
    try {
      const { vendorId } = c.req.param();
      const body = await c.req.json();
      const profile = { ...body, updatedAt: new Date().toISOString() };
      await kv.set(`cafe:profile:${vendorId}`, profile);
      return c.json({ success: true, profile });
    } catch (error) {
      return c.json({ error: String(error) }, 500);
    }
  });

  /**
   * POST /make-server-3dd53475/cafe/menu/:vendorId
   */
  app.post("/make-server-3dd53475/cafe/menu/:vendorId", async (c) => {
    try {
      const { vendorId } = c.req.param();
      const { menu } = await c.req.json();
      await kv.set(`cafe:menu:${vendorId}`, menu);
      return c.json({ success: true });
    } catch (error) {
      return c.json({ error: String(error) }, 500);
    }
  });

}