/**
 * ============================================================================
 * STAFF MANAGEMENT ENDPOINTS - LAMBDA VERSION
 * ============================================================================
 * 
 * Handles staff management for vendors:
 * - Staff CRUD operations
 * - Staff discovery (for customer booking)
 * - Staff availability & scheduling
 * - Staff specializations
 * 
 * Migrated from: supabase/functions/server/staff-discovery-endpoints.tsx
 * 
 * Date: 2025-01-28
 * Migration: Supabase to AWS Lambda
 * ============================================================================
 */

import { Hono } from 'hono';
import { select, insert, update, query } from '../database/rds-connection';

/**
 * Calculate distance between two coordinates (Haversine formula)
 */
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // Distance in km
}

export function registerStaffEndpoints(app: Hono) {
  // ============================================
  // STAFF DISCOVERY (Customer-facing)
  // ============================================

  /**
   * GET /customer/discover-staff
   * Discover staff members by service style preferences
   */
  app.get("/customer/discover-staff", async (c) => {
    try {
      const roleId = c.req.query('roleId');
      const serviceStyle = c.req.query('serviceStyle');
      const latitude = c.req.query('latitude');
      const longitude = c.req.query('longitude');
      const maxDistance = parseFloat(c.req.query('maxDistance') || '50');
      const serviceId = c.req.query('serviceId');
      const vendorId = c.req.query('vendorId');

      if (!roleId) {
        return c.json({ error: 'roleId is required' }, 400);
      }

      if (!serviceStyle || !['at_home', 'at_center', 'tele'].includes(serviceStyle)) {
        return c.json({ error: 'serviceStyle is required (at_home, at_center, or tele)' }, 400);
      }

      const customerLat = latitude ? parseFloat(latitude) : null;
      const customerLng = longitude ? parseFloat(longitude) : null;

      // Get staff matching criteria
      let staffQuery = `
        SELECT s.*, v.business_name as vendor_name, v.city, v.state
        FROM staff s
        INNER JOIN vendors v ON s.vendor_id = v.id
        WHERE s.is_active = true
          AND v.status = 'approved'
          AND v.is_active = true
      `;

      const params: any[] = [];
      let paramIndex = 1;

      if (vendorId) {
        staffQuery += ` AND s.vendor_id = $${paramIndex}`;
        params.push(vendorId);
        paramIndex++;
      }

      if (roleId) {
        // Staff table uses 'role' TEXT column, not 'role_id'
        // Check if roleId is a UUID (role.id) or role name
        const role = await query('SELECT name, id FROM roles WHERE name = $1 OR id = $1', [roleId]);
        if (role.rows.length > 0) {
          // Use role name to match staff.role column
          staffQuery += ` AND s.role = $${paramIndex}`;
          params.push(role.rows[0].name);
          paramIndex++;
        }
      }

      if (serviceId) {
        // Check if staff has this service
        staffQuery += ` AND EXISTS (
          SELECT 1 FROM staff_services ss 
          WHERE ss.staff_id = s.id AND ss.service_id = $${paramIndex}
        )`;
        params.push(serviceId);
        paramIndex++;
      }

      const staffResults = await query(staffQuery, params);
      let eligibleStaff = staffResults.rows;

      // Filter by service style availability
      if (serviceStyle === 'at_home' && customerLat && customerLng) {
        // Filter by distance and home service availability
        eligibleStaff = eligibleStaff
          .filter((staff: any) => {
            if (!staff.latitude || !staff.longitude) return false;
            const distance = calculateDistance(
              customerLat,
              customerLng,
              parseFloat(staff.latitude),
              parseFloat(staff.longitude)
            );
            return distance <= maxDistance;
          })
          .map((staff: any) => {
            const distance = calculateDistance(
              customerLat,
              customerLng,
              parseFloat(staff.latitude),
              parseFloat(staff.longitude)
            );
            return { ...staff, distance };
          })
          .sort((a: any, b: any) => a.distance - b.distance);
      } else if (serviceStyle === 'at_center') {
        // Filter staff available at center
        eligibleStaff = eligibleStaff.filter((staff: any) => 
          staff.service_styles && JSON.parse(staff.service_styles || '[]').includes('at_center')
        );
      } else if (serviceStyle === 'tele') {
        // Filter staff available for tele
        eligibleStaff = eligibleStaff.filter((staff: any) => 
          staff.service_styles && JSON.parse(staff.service_styles || '[]').includes('tele')
        );
      }

      // Get availability for each staff
      const staffWithAvailability = await Promise.all(
        eligibleStaff.map(async (staff: any) => {
          const availability = await query(
            `SELECT * FROM staff_availability 
             WHERE staff_id = $1 
             AND available_date >= CURRENT_DATE
             ORDER BY available_date, available_time_start
             LIMIT 7`,
            [staff.id]
          );

          return {
            ...staff,
            availability: availability.rows,
            nextAvailableSlot: availability.rows[0] || null,
          };
        })
      );

      return c.json({
        success: true,
        staff: staffWithAvailability,
        total: staffWithAvailability.length,
      });
    } catch (error: any) {
      console.error('Error discovering staff:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  // ============================================
  // STAFF CRUD (Vendor-facing)
  // ============================================

  /**
   * GET /vendor/:vendorId/staff
   * Get all staff for a vendor
   */
  app.get("/vendor/:vendorId/staff", async (c) => {
    try {
      const { vendorId } = c.req.param();
      const staff = await select('staff',
        { vendor_id: vendorId },
        { orderBy: 'created_at', orderDirection: 'DESC' }
      );

      // Enrich with services and availability
      const enrichedStaff = await Promise.all(
        staff.map(async (s: any) => {
          const services = await query(
            'SELECT ss.*, sv.name as service_name FROM staff_services ss INNER JOIN services sv ON ss.service_id = sv.id WHERE ss.staff_id = $1',
            [s.id]
          );
          return {
            ...s,
            services: services.rows,
          };
        })
      );

      return c.json({ success: true, staff: enrichedStaff, total: enrichedStaff.length });
    } catch (error: any) {
      console.error('Error fetching staff:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * POST /vendor/:vendorId/staff
   * Create a new staff member
   */
  app.post("/vendor/:vendorId/staff", async (c) => {
    try {
      const { vendorId } = c.req.param();
      const staffData = await c.req.json();

      // Resolve role name if roleId is provided
      let roleName = staffData.role || staffData.roleId || staffData.role_id;
      if (roleName && roleName.length === 36 && roleName.includes('-')) {
        // Looks like UUID, resolve to role name
        const role = await query('SELECT name FROM roles WHERE id = $1', [roleName]);
        if (role.rows.length > 0) {
          roleName = role.rows[0].name;
        }
      }

      const staff = await insert('staff', {
        vendor_id: vendorId,
        name: staffData.name,
        phone: staffData.phone,
        email: staffData.email || null,
        role: roleName, // Staff table uses 'role' TEXT column, not 'role_id'
        experience_years: staffData.experienceYears || staffData.experience_years || null,
        is_active: staffData.isActive !== false,
      });

      // Add services if provided
      if (staffData.services && Array.isArray(staffData.services)) {
        for (const serviceId of staffData.services) {
          await insert('staff_services', {
            staff_id: staff[0].id,
            service_id: serviceId,
          });
        }
      }

      return c.json({ success: true, staff: staff[0], message: 'Staff member created successfully' });
    } catch (error: any) {
      console.error('Error creating staff:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * PUT /vendor/:vendorId/staff/:staffId
   * Update staff member
   */
  app.put("/vendor/:vendorId/staff/:staffId", async (c) => {
    try {
      const { staffId } = c.req.param();
      const staffData = await c.req.json();

      const updated = await update('staff',
        { id: staffId },
        {
          name: staffData.name,
          phone: staffData.phone,
          email: staffData.email,
          specialization: staffData.specialization,
          experience_years: staffData.experienceYears || staffData.experience_years,
          service_styles: staffData.serviceStyles || staffData.service_styles,
          latitude: staffData.latitude,
          longitude: staffData.longitude,
          is_active: staffData.isActive,
        }
      );

      if (updated.length === 0) {
        return c.json({ error: 'Staff member not found' }, 404);
      }

      // Update services if provided
      if (staffData.services && Array.isArray(staffData.services)) {
        // Delete existing services
        await query('DELETE FROM staff_services WHERE staff_id = $1', [staffId]);
        // Insert new services
        for (const serviceId of staffData.services) {
          await insert('staff_services', {
            staff_id: staffId,
            service_id: serviceId,
          });
        }
      }

      return c.json({ success: true, staff: updated[0], message: 'Staff member updated successfully' });
    } catch (error: any) {
      console.error('Error updating staff:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * DELETE /vendor/:vendorId/staff/:staffId
   * Delete (deactivate) staff member
   */
  app.delete("/vendor/:vendorId/staff/:staffId", async (c) => {
    try {
      const { staffId } = c.req.param();

      await update('staff',
        { id: staffId },
        { is_active: false }
      );

      return c.json({ success: true, message: 'Staff member deactivated successfully' });
    } catch (error: any) {
      console.error('Error deactivating staff:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  // ============================================
  // STAFF AVAILABILITY
  // ============================================

  /**
   * GET /vendor/:vendorId/staff/:staffId/availability
   * Get staff availability
   */
  app.get("/vendor/:vendorId/staff/:staffId/availability", async (c) => {
    try {
      const { staffId } = c.req.param();
      const startDate = c.req.query('startDate') || new Date().toISOString().split('T')[0];
      const endDate = c.req.query('endDate');

      let availabilityQuery = `
        SELECT * FROM staff_availability 
        WHERE staff_id = $1 
        AND available_date >= $2
      `;
      const params: any[] = [staffId, startDate];

      if (endDate) {
        availabilityQuery += ` AND available_date <= $3`;
        params.push(endDate);
      }

      availabilityQuery += ` ORDER BY available_date, available_time_start`;

      const availability = await query(availabilityQuery, params);

      return c.json({ success: true, availability: availability.rows });
    } catch (error: any) {
      console.error('Error fetching staff availability:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * POST /vendor/:vendorId/staff/:staffId/availability
   * Set staff availability
   */
  app.post("/vendor/:vendorId/staff/:staffId/availability", async (c) => {
    try {
      const { staffId } = c.req.param();
      const availabilityData = await c.req.json();

      // Handle single or bulk availability
      const availabilities = Array.isArray(availabilityData) ? availabilityData : [availabilityData];

      const results = [];
      for (const avail of availabilities) {
        const result = await insert('staff_availability', {
          staff_id: staffId,
          available_date: avail.availableDate || avail.available_date,
          available_time_start: avail.availableTimeStart || avail.available_time_start,
          available_time_end: avail.availableTimeEnd || avail.available_time_end,
          is_available: avail.isAvailable !== false,
        });
        results.push(result[0]);
      }

      return c.json({ success: true, availability: results, message: 'Availability set successfully' });
    } catch (error: any) {
      console.error('Error setting staff availability:', error);
      return c.json({ error: error.message }, 500);
    }
  });
}

