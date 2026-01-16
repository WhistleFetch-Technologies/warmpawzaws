/**
 * ============================================================================
 * SERVICE DISCOVERY ENDPOINTS - LAMBDA VERSION
 * ============================================================================
 * 
 * Customer-facing service discovery and search:
 * - Multi-category search (Vet, Grooming, Training, Walker, etc.)
 * - Location-based filtering
 * - Rating filter
 * - Availability check
 * - Vendor profiles with services
 * 
 * Migrated from: supabase/functions/make-server-3dd53475/universal-service-discovery.tsx
 * 
 * Date: 2025-01-28
 * Migration: Supabase to AWS Lambda
 * ============================================================================
 */

import { Hono } from 'hono';
import { select, query } from '../database/rds-connection';
import { normalizeDbRow, normalizeDbRows, extractEntityIds } from '../utils/entity-extractor';
import { isValidUUID } from '../types/entities';

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

function getCategoryFromRole(roleId: string): string {
  const roleCategoryMap: Record<string, string> = {
    'vet_clinic': 'vet',
    'veterinarian': 'vet',
    'grooming_salon': 'grooming',
    'pet_groomer': 'grooming',
    'groomer': 'grooming',
    'trainer': 'training',
    'pet_trainer': 'training',
    'dog_walker': 'walker',
    'pet_walker': 'walker',
    'boarding_resort': 'boarding',
    'pet_boarding': 'boarding',
    'nutritionist': 'nutrition',
    'pet_nutritionist': 'nutrition',
    'ngo': 'adoption',
    'shelter': 'adoption',
    'breeder': 'adoption',
    'pet_store': 'marketplace',
  };
  return roleCategoryMap[roleId] || 'other';
}

export function registerServiceDiscoveryEndpoints(app: Hono) {
  /**
   * GET /customer/services
   * Get customer services list (alias for discover-services)
   */
  app.get("/customer/services", async (c) => {
    try {
      const category = c.req.query('category');
      const location = c.req.query('location');
      const minRating = c.req.query('minRating');
      const availability = c.req.query('availability');
      const petType = c.req.query('petType');
      const sortBy = c.req.query('sortBy') || 'rating';
      const latitude = c.req.query('latitude');
      const longitude = c.req.query('longitude');
      const roleId = c.req.query('roleId');
      const serviceStyle = c.req.query('serviceStyle');

      // Build vendor query
      let vendorQuery = `
        SELECT v.*, r.name as role_name, r.display_name as role_display_name
        FROM vendors v
        INNER JOIN roles r ON v.role_id = r.id
        WHERE v.status = 'approved' AND v.is_active = true
      `;

      const params: any[] = [];
      let paramIndex = 1;

      // Filter by category (role)
      if (category) {
        const categoryRoleMap: Record<string, string[]> = {
          'vet': ['vet_clinic', 'veterinarian'],
          'grooming': ['grooming_salon', 'pet_groomer', 'groomer'],
          'training': ['trainer', 'pet_trainer'],
          'walker': ['dog_walker', 'pet_walker'],
          'boarding': ['boarding_resort', 'pet_boarding'],
          'nutrition': ['nutritionist', 'pet_nutritionist'],
          'adoption': ['ngo', 'shelter', 'breeder'],
          'marketplace': ['pet_store'],
        };

        const targetRoles = categoryRoleMap[category] || [];
        if (targetRoles.length > 0) {
          vendorQuery += ` AND (r.name = ANY($${paramIndex}::text[]) OR r.id::text = $${paramIndex + 1})`;
          params.push(targetRoles, category);
          paramIndex += 2;
        }
      }

      if (roleId) {
        vendorQuery += ` AND (r.id::text = $${paramIndex} OR r.name = $${paramIndex + 1})`;
        params.push(roleId, roleId);
        paramIndex += 2;
      }

      // Get vendors
      const vendors = await query(vendorQuery, params);

      // Get services for each vendor
      const services = await Promise.all(
        vendors.rows.map(async (vendor: any) => {
          // Check if is_global column exists
          const serviceColumns = await query(
            `SELECT column_name FROM information_schema.columns 
             WHERE table_name = 'services' AND column_name = 'is_global'`
          );
          const hasIsGlobal = serviceColumns.rows.length > 0;
          
          const vendorServices = await query(
            `SELECT s.*, vs.custom_price, vs.custom_duration, vs.service_style
             FROM services s
             LEFT JOIN vendor_services vs ON s.id = vs.service_id AND vs.vendor_id = $1
             WHERE (vs.vendor_id = $1${hasIsGlobal ? ' OR s.is_global = true' : ''})
             AND s.is_active = true
             ${serviceStyle ? `AND vs.service_style = $2` : ''}
             ORDER BY s.name`,
            serviceStyle ? [vendor.id, serviceStyle] : [vendor.id]
          );

          return vendorServices.rows.map((service: any) => ({
            id: service.id,
            serviceId: service.id,
            serviceName: service.name,
            vendorId: vendor.id,
            vendorName: vendor.business_name,
            price: service.custom_price || service.base_price || 0,
            duration: service.custom_duration || service.duration_minutes || 30,
            serviceStyle: service.service_style || serviceStyle,
          }));
        })
      );

      return c.json({
        success: true,
        services: services.flat(),
      });
    } catch (error: any) {
      console.error('Error fetching customer services:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * GET /customer/discover-services
   * Main customer entry point for service discovery
   */
  app.get("/customer/discover-services", async (c) => {
    try {
      const category = c.req.query('category');
      const location = c.req.query('location');
      const minRating = c.req.query('minRating');
      const availability = c.req.query('availability');
      const petType = c.req.query('petType');
      const sortBy = c.req.query('sortBy') || 'rating';
      const latitude = c.req.query('latitude');
      const longitude = c.req.query('longitude');

      // Build vendor query
      let vendorQuery = `
        SELECT v.*, r.name as role_name, r.display_name as role_display_name
        FROM vendors v
        INNER JOIN roles r ON v.role_id = r.id
        WHERE v.status = 'approved' AND v.is_active = true
      `;

      const params: any[] = [];
      let paramIndex = 1;

      // Filter by category (role)
      if (category) {
        const categoryRoleMap: Record<string, string[]> = {
          'vet': ['vet_clinic', 'veterinarian'],
          'grooming': ['grooming_salon', 'pet_groomer', 'groomer'],
          'training': ['trainer', 'pet_trainer'],
          'walker': ['dog_walker', 'pet_walker'],
          'boarding': ['boarding_resort', 'pet_boarding'],
          'nutrition': ['nutritionist', 'pet_nutritionist'],
          'adoption': ['ngo', 'shelter', 'breeder'],
          'marketplace': ['pet_store'],
        };

        const targetRoles = categoryRoleMap[category] || [];
        if (targetRoles.length > 0) {
          vendorQuery += ` AND r.name = ANY($${paramIndex})`;
          params.push(targetRoles);
          paramIndex++;
        }
      }

      // Filter by location (text match)
      if (location) {
        vendorQuery += ` AND (
          v.city ILIKE $${paramIndex} OR 
          v.state ILIKE $${paramIndex} OR 
          v.address ILIKE $${paramIndex}
        )`;
        params.push(`%${location}%`);
        paramIndex++;
      }

      vendorQuery += ` ORDER BY v.created_at DESC`;

      const vendorResults = await query(vendorQuery, params);
      let vendors = vendorResults.rows;

      // Enrich vendors with services, reviews, and availability
      const enrichedVendors = await Promise.all(
        vendors.map(async (vendor: any) => {
          // Get services
          const services = await query(
            `SELECT s.*, vs.custom_price, vs.custom_duration, vs.is_enabled
             FROM services s
             LEFT JOIN vendor_services vs ON s.id = vs.service_id AND vs.vendor_id = $1
             WHERE vs.vendor_id = $1
             AND s.is_active = true
             AND (vs.is_enabled IS NULL OR vs.is_enabled = true)
             LIMIT 10`,
            [vendor.id]
          );

          // Get reviews and calculate rating
          const reviews = await query(
            `SELECT rating FROM reviews 
             WHERE vendor_id = $1 
             AND is_approved = true`,
            [vendor.id]
          );

          const avgRating = reviews.rows.length > 0
            ? reviews.rows.reduce((sum: number, r: any) => sum + (r.rating || 0), 0) / reviews.rows.length
            : 0;

          // Check availability (simplified - check if vendor has slots today)
          // Gracefully handle missing vendor_schedule_slots table
          let isAvailableToday = false;
          try {
            const tableCheck = await query(
              `SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = 'vendor_schedule_slots'
              )`
            );
            
            if (tableCheck.rows[0]?.exists) {
              const today = new Date();
              const dayOfWeek = today.getDay();
              const availabilityCheck = await query(
                `SELECT 1 FROM vendor_schedule_slots 
                 WHERE vendor_id = $1 
                 AND day_of_week = $2 
                 AND is_enabled = true 
                 LIMIT 1`,
                [vendor.id, dayOfWeek]
              );
              isAvailableToday = availabilityCheck.rows.length > 0;
            }
          } catch (error: any) {
            // Table doesn't exist or query failed, assume available
            console.warn('[Discover Services] vendor_schedule_slots check failed:', error.message);
            isAvailableToday = true; // Default to available
          }

          // Calculate distance if coordinates provided
          let distance: number | null = null;
          if (latitude && longitude && vendor.latitude && vendor.longitude) {
            distance = calculateDistance(
              parseFloat(latitude),
              parseFloat(longitude),
              parseFloat(vendor.latitude),
              parseFloat(vendor.longitude)
            );
          }

          return {
            id: vendor.id,
            vendorId: vendor.id,
            businessName: vendor.business_name,
            roleId: vendor.role_id,
            roleName: vendor.role_name,
            category: getCategoryFromRole(vendor.role_name),
            address: vendor.address,
            city: vendor.city,
            state: vendor.state,
            location: vendor.latitude && vendor.longitude ? {
              coordinates: { lat: parseFloat(vendor.latitude), lng: parseFloat(vendor.longitude) },
              address: vendor.address,
            } : null,
            rating: avgRating,
            totalReviews: reviews.rows.length,
            totalOfferings: services.rows.length,
            featuredOfferings: services.rows.slice(0, 3).map((s: any) => ({
              id: s.id,
              name: s.name,
              price: s.custom_price || s.base_price || 0,
              duration: s.custom_duration || s.duration_minutes || 0,
              serviceStyle: s.service_style,
              category: s.category,
            })),
            availabilityScore: isAvailableToday ? 100 : 0,
            isAvailableToday,
            distance,
            phone: vendor.phone,
            email: vendor.email,
            operatingHours: vendor.operating_hours ? JSON.parse(vendor.operating_hours) : null,
          };
        })
      );

      // Filter by rating
      if (minRating) {
        enrichedVendors.filter((v: any) => v.rating >= parseFloat(minRating));
      }

      // Sort
      if (sortBy === 'distance' && latitude && longitude) {
        enrichedVendors.sort((a: any, b: any) => {
          if (a.distance === null) return 1;
          if (b.distance === null) return -1;
          return a.distance - b.distance;
        });
      } else if (sortBy === 'rating') {
        enrichedVendors.sort((a: any, b: any) => b.rating - a.rating);
      } else if (sortBy === 'price') {
        enrichedVendors.sort((a: any, b: any) => {
          const aPrice = a.featuredOfferings[0]?.price || 0;
          const bPrice = b.featuredOfferings[0]?.price || 0;
          return aPrice - bPrice;
        });
      }

      return c.json({
        success: true,
        vendors: enrichedVendors,
        total: enrichedVendors.length,
        filters: {
          category,
          location,
          minRating,
          availability,
          petType,
          sortBy,
        },
      });
    } catch (error: any) {
      console.error('Error discovering services:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * GET /customer/vendor/:vendorId/available-slots
   * Get available time slots for a vendor based on their operating hours
   * ✅ FIX: Must be registered BEFORE /customer/vendor/:vendorId to avoid route conflict
   * ✅ FIX B6: Returns slots based on vendor timings instead of static slots
   */
  app.get("/customer/vendor/:vendorId/available-slots", async (c) => {
    try {
      const { vendorId } = c.req.param();
      const date = c.req.query('date');
      const serviceStyle = c.req.query('serviceStyle') || 'at_home';

      if (!date) {
        return c.json({ error: 'date parameter is required' }, 400);
      }

      // Get vendor with operating hours
      const vendors = await select('vendors', { id: vendorId });
      if (vendors.length === 0) {
        return c.json({ error: 'Vendor not found' }, 404);
      }

      const vendor = vendors[0];
      
      // ✅ FIX: Try to get operating hours from multiple sources
      let operatingHours: any = null;
      
      // 1. Try vendor.operating_hours column (if exists)
      if (vendor.operating_hours) {
        try {
          operatingHours = typeof vendor.operating_hours === 'string' 
            ? JSON.parse(vendor.operating_hours) 
            : vendor.operating_hours;
        } catch (e) {
          console.warn('[SLOTS] Failed to parse vendor.operating_hours:', e);
        }
      }

      // 2. Try metadata.operatingHours (fallback)
      if (!operatingHours && vendor.metadata) {
        try {
          const metadata = typeof vendor.metadata === 'string' 
            ? JSON.parse(vendor.metadata) 
            : vendor.metadata;
          operatingHours = metadata?.operatingHours || metadata?.operating_hours;
        } catch (e) {
          console.warn('[SLOTS] Failed to parse metadata:', e);
        }
      }
      
      // 3. Try vendor_facilities table (primary source for center profile)
      if (!operatingHours) {
        try {
          const facilities = await query(
            `SELECT operating_hours FROM vendor_facilities WHERE vendor_id = $1 LIMIT 1`,
            [vendorId]
          );
          if (facilities.rows.length > 0 && facilities.rows[0].operating_hours) {
            const facilityHours = facilities.rows[0].operating_hours;
            operatingHours = typeof facilityHours === 'string' 
              ? JSON.parse(facilityHours) 
              : facilityHours;
            console.log('[SLOTS] Loaded operating hours from vendor_facilities');
          }
        } catch (e) {
          console.warn('[SLOTS] Failed to load from vendor_facilities:', e);
        }
      }

      // Get day of week (0 = Sunday, 6 = Saturday)
      const requestedDate = new Date(date);
      const dayOfWeek = requestedDate.getDay();
      const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
      const dayName = dayNames[dayOfWeek];

      // Generate slots based on operating hours
      const slots: any[] = [];
      
      if (operatingHours && operatingHours[dayName]) {
        const daySchedule = operatingHours[dayName];
        
        if (daySchedule.isOpen && daySchedule.open && daySchedule.close) {
          // Generate 30-minute slots between open and close
          const [openHour, openMin] = daySchedule.open.split(':').map(Number);
          const [closeHour, closeMin] = daySchedule.close.split(':').map(Number);
          
          let currentHour = openHour;
          let currentMin = openMin;
          
          while (currentHour < closeHour || (currentHour === closeHour && currentMin < closeMin)) {
            const timeStr = `${String(currentHour).padStart(2, '0')}:${String(currentMin).padStart(2, '0')}`;
            
            // Check if slot is in the past (for today)
            const now = new Date();
            const slotDateTime = new Date(requestedDate);
            slotDateTime.setHours(currentHour, currentMin, 0, 0);
            const isPast = slotDateTime < now;
            
            slots.push({
              time: timeStr,
              available: !isPast,
            });
            
            // Increment by 30 minutes
            currentMin += 30;
            if (currentMin >= 60) {
              currentMin -= 60;
              currentHour += 1;
            }
          }
        }
      } else {
        // Fallback: If no operating hours, return default slots (9 AM - 6 PM)
        const defaultSlots = [
          '09:00', '09:30', '10:00', '10:30', '11:00', '11:30',
          '14:00', '14:30', '15:00', '15:30', '16:00', '16:30', '17:00', '17:30'
        ];
        slots.push(...defaultSlots.map(time => ({
          time,
          available: true
        })));
      }

      return c.json({
        success: true,
        slots,
        date,
        vendorId,
        serviceStyle
      });
    } catch (error: any) {
      console.error('Error fetching available slots:', error);
      return c.json({ error: error.message || 'Failed to fetch available slots' }, 500);
    }
  });

  /**
   * GET /customer/vendor/:vendorId
   * Get detailed vendor profile with all services
   * ✅ FIX: Must be registered AFTER /customer/vendor/:vendorId/available-slots to avoid route conflict
   */
  app.get("/customer/vendor/:vendorId", async (c) => {
    try {
      const { vendorId } = c.req.param();

      // Get vendor
      const vendors = await select('vendors', { id: vendorId });
      if (vendors.length === 0) {
        return c.json({ error: 'Vendor not found' }, 404);
      }

      const vendor = vendors[0];

      // Get role
      const roles = await select('roles', { id: vendor.role_id });
      const role = roles[0];

      // Get all services
      // Check if is_global column exists
      const serviceColumns = await query(
        `SELECT column_name FROM information_schema.columns 
         WHERE table_name = 'services' AND column_name = 'is_global'`
      );
      const hasIsGlobal = serviceColumns.rows.length > 0;
      
      const services = await query(
        `SELECT s.*, vs.custom_price, vs.custom_duration, vs.is_enabled, vs.service_style
         FROM services s
         LEFT JOIN vendor_services vs ON s.id = vs.service_id AND vs.vendor_id = $1
         WHERE (vs.vendor_id = $1${hasIsGlobal ? ' OR s.is_global = true' : ''})
         AND s.is_active = true
         AND (vs.is_enabled IS NULL OR vs.is_enabled = true)
         ORDER BY s.name`,
        [vendorId]
      );

      // Get reviews
      const reviews = await query(
        `SELECT r.*, c.full_name as customer_name
         FROM reviews r
         LEFT JOIN customers c ON r.customer_id = c.id
         WHERE r.vendor_id = $1 
         AND r.is_approved = true
         ORDER BY r.created_at DESC
         LIMIT 20`,
        [vendorId]
      );

      const avgRating = reviews.rows.length > 0
        ? reviews.rows.reduce((sum: number, r: any) => sum + (r.rating || 0), 0) / reviews.rows.length
        : 0;

      // Get staff (if applicable)
      const staff = await query(
        `SELECT s.* FROM staff s
         WHERE s.vendor_id = $1 
         AND s.is_active = true
         ORDER BY s.name`,
        [vendorId]
      );

      return c.json({
        success: true,
        vendor: {
          id: vendor.id,
          businessName: vendor.business_name,
          ownerName: vendor.owner_name,
          roleId: vendor.role_id,
          roleName: role?.name,
          category: getCategoryFromRole(role?.name || ''),
          address: vendor.address,
          city: vendor.city,
          state: vendor.state,
          pincode: vendor.pincode,
          phone: vendor.phone,
          email: vendor.email,
          latitude: vendor.latitude,
          longitude: vendor.longitude,
          rating: avgRating,
          totalReviews: reviews.rows.length,
          operatingHours: vendor.operating_hours ? JSON.parse(vendor.operating_hours) : null,
          description: vendor.description || '',
        },
        services: services.rows,
        reviews: reviews.rows,
        staff: staff.rows,
      });
    } catch (error: any) {
      console.error('Error fetching vendor profile:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * GET /customer/vendors/search
   * Search vendors by roleId and other filters
   * This is a compatibility endpoint for components that use /customer/vendors/search
   */
  app.get("/customer/vendors/search", async (c) => {
    try {
      const roleId = c.req.query('roleId');
      const searchQuery = c.req.query('query'); // Renamed to avoid shadowing the query function
      const location = c.req.query('location');
      const latitude = c.req.query('latitude');
      const longitude = c.req.query('longitude');
      const serviceStyle = c.req.query('serviceStyle');
      const limit = parseInt(c.req.query('limit') || '20', 10);
      const offset = parseInt(c.req.query('offset') || '0', 10);

      // Build vendor query
      let vendorQuery = `
        SELECT v.*, r.name as role_name, r.display_name as role_display_name
        FROM vendors v
        INNER JOIN roles r ON v.role_id = r.id
        WHERE v.status = 'approved' AND v.is_active = true
      `;

      const params: any[] = [];
      let paramIndex = 1;

      // Filter by roleId (primary filter)
      if (roleId) {
        vendorQuery += ` AND (r.id::text = $${paramIndex} OR r.name = $${paramIndex + 1})`;
        params.push(roleId, roleId);
        paramIndex += 2;
      }

      // Filter by search query (name, business_name, specialization)
      if (searchQuery) {
        vendorQuery += ` AND (
          v.business_name ILIKE $${paramIndex} OR 
          v.owner_name ILIKE $${paramIndex} OR
          v.specialization ILIKE $${paramIndex}
        )`;
        params.push(`%${searchQuery}%`);
        paramIndex++;
      }

      // Filter by location
      if (location) {
        vendorQuery += ` AND (
          v.city ILIKE $${paramIndex} OR 
          v.state ILIKE $${paramIndex} OR 
          v.address ILIKE $${paramIndex}
        )`;
        params.push(`%${location}%`);
        paramIndex++;
      }

      vendorQuery += ` ORDER BY v.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
      params.push(limit, offset);
      paramIndex += 2;

      const vendorResults = await query(vendorQuery, params);
      let vendors = vendorResults.rows;

      // Enrich vendors with additional data
      const enrichedVendors = await Promise.all(
        vendors.map(async (vendor: any) => {
          // Get average rating
          const reviews = await query(
            `SELECT AVG(rating) as avg_rating, COUNT(*) as review_count
             FROM reviews 
             WHERE vendor_id = $1 AND is_approved = true`,
            [vendor.id]
          );

          const avgRating = reviews.rows[0]?.avg_rating || 0;
          const reviewCount = reviews.rows[0]?.review_count || 0;

          // Calculate distance if coordinates provided
          let distance = null;
          if (latitude && longitude && vendor.latitude && vendor.longitude) {
            distance = calculateDistance(
              parseFloat(latitude),
              parseFloat(longitude),
              parseFloat(vendor.latitude),
              parseFloat(vendor.longitude)
            );
          }

          // Get services count
          const servicesCount = await query(
            `SELECT COUNT(*) as count
             FROM vendor_services vs
             INNER JOIN services s ON vs.service_id = s.id
             WHERE vs.vendor_id = $1 AND s.is_active = true AND vs.is_enabled = true`,
            [vendor.id]
          );

          return {
            ...vendor,
            id: vendor.id,
            vendorId: vendor.id,
            businessName: vendor.business_name,
            name: vendor.business_name || vendor.owner_name,
            rating: parseFloat(avgRating) || 0,
            reviewCount: parseInt(reviewCount) || 0,
            distance: distance ? parseFloat(distance.toFixed(2)) : null,
            servicesCount: parseInt(servicesCount.rows[0]?.count || '0'),
            priceRange: vendor.price_range || null,
            address: vendor.address,
            city: vendor.city,
            state: vendor.state,
          };
        })
      );

      // If serviceStyle is 'at_home' or 'tele', also return staff
      let staff: any[] = [];
      if (serviceStyle && ['at_home', 'tele'].includes(serviceStyle) && roleId) {
        const staffQuery = `
          SELECT s.*, v.business_name as vendor_name, v.city, v.state
          FROM staff s
          INNER JOIN vendors v ON s.vendor_id = v.id
          INNER JOIN roles r ON v.role_id = r.id
          WHERE s.is_active = true
            AND v.status = 'approved'
            AND v.is_active = true
            AND (r.id::text = $1 OR r.name = $2)
          LIMIT $3
        `;
        const staffResults = await query(staffQuery, [roleId, roleId, limit]);
        staff = staffResults.rows.map((s: any) => ({
          ...s,
          id: s.id,
          vendorId: s.vendor_id,
          name: s.name,
          rating: s.rating || 0,
        }));
      }

      return c.json({
        success: true,
        vendors: enrichedVendors,
        staff: staff.length > 0 ? staff : undefined,
        total: enrichedVendors.length,
        limit,
        offset,
      });
    } catch (error: any) {
      console.error('Error in /customer/vendors/search:', error);
      return c.json({ 
        success: false,
        error: error.message || 'Failed to search vendors',
        vendors: [],
        total: 0
      }, 500);
    }
  });

  /**
   * GET /customer/autocomplete
   * Search autocomplete suggestions
   */
  app.get("/customer/autocomplete", async (c) => {
    try {
      const q = c.req.query('q') || '';
      const limit = parseInt(c.req.query('limit') || '10', 10);

      if (!q || q.length < 2) {
        return c.json({ success: true, suggestions: [] });
      }

      // Search vendors
      const vendors = await query(
        `SELECT DISTINCT business_name as name, 'vendor' as type, id
         FROM vendors
         WHERE business_name ILIKE $1 AND status = 'approved' AND is_active = true
         LIMIT $2`,
        [`%${q}%`, limit]
      );

      // Search services
      const services = await query(
        `SELECT DISTINCT name, 'service' as type, id
         FROM services
         WHERE name ILIKE $1 AND is_active = true
         LIMIT $2`,
        [`%${q}%`, limit]
      );

      // Search problems
      const problems = await query(
        `SELECT DISTINCT problem_name as name, 'problem' as type, id
         FROM problem_grid
         WHERE problem_name ILIKE $1
         LIMIT $2`,
        [`%${q}%`, limit]
      );

      const suggestions = [
        ...vendors.rows.map((v: any) => ({ text: v.name, type: v.type, id: v.id })),
        ...services.rows.map((s: any) => ({ text: s.name, type: s.type, id: s.id })),
        ...problems.rows.map((p: any) => ({ text: p.name, type: p.type, id: p.id })),
      ].slice(0, limit);

      return c.json({ success: true, suggestions });
    } catch (error: any) {
      console.error('Error in autocomplete:', error);
      return c.json({ success: true, suggestions: [] });
    }
  });

  /**
   * GET /customer/radar/providers
   * Get providers within radar radius
   */
  app.get("/customer/radar/providers", async (c) => {
    try {
      const lat = parseFloat(c.req.query('lat') || '0');
      const lng = parseFloat(c.req.query('lng') || '0');
      const radius = parseFloat(c.req.query('radius') || '10'); // km
      const serviceType = c.req.query('serviceType') || '';

      if (!lat || !lng) {
        return c.json({ error: 'lat and lng are required' }, 400);
      }

      // Get vendors with location within radius
      const vendors = await query(
        `SELECT v.*, r.name as role_name,
         (6371 * acos(
           cos(radians($1)) * cos(radians(CAST(v.latitude AS FLOAT))) *
           cos(radians(CAST(v.longitude AS FLOAT)) - radians($2)) +
           sin(radians($1)) * sin(radians(CAST(v.latitude AS FLOAT)))
         )) AS distance_km
         FROM vendors v
         INNER JOIN roles r ON v.role_id = r.id
         WHERE v.status = 'approved' AND v.is_active = true
           AND v.latitude IS NOT NULL AND v.longitude IS NOT NULL
           ${serviceType ? `AND r.name ILIKE $3` : ''}
         HAVING distance_km <= $4
         ORDER BY distance_km ASC
         LIMIT 50`,
        serviceType ? [lat, lng, `%${serviceType}%`, radius] : [lat, lng, radius]
      );

      return c.json({
        success: true,
        providers: vendors.rows.map((v: any) => ({
          id: v.id,
          name: v.business_name,
          role: v.role_name,
          distance: parseFloat(v.distance_km?.toFixed(2) || '0'),
          latitude: v.latitude,
          longitude: v.longitude,
        })),
      });
    } catch (error: any) {
      console.error('Error fetching radar providers:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * GET /customer/vendors/discover-by-problem
   * Enhanced vendor discovery by problem
   */
  app.get("/customer/vendors/discover-by-problem", async (c) => {
    try {
      const problem = c.req.query('problem');
      const roleId = c.req.query('roleId');
      const latitude = c.req.query('latitude');
      const longitude = c.req.query('longitude');

      if (!problem) {
        return c.json({ error: 'problem is required' }, 400);
      }

      // Get vendors that handle this problem
      let queryText = `
        SELECT DISTINCT v.*, r.name as role_name, r.display_name as role_display_name
        FROM vendors v
        INNER JOIN roles r ON v.role_id = r.id
        WHERE v.status = 'approved' AND v.is_active = true
      `;

      const params: any[] = [];
      let paramIdx = 1;

      // Filter by problem (check specializations, services, or problem_grid)
      queryText += ` AND (
        v.specializations::text ILIKE $${paramIdx} OR
        EXISTS (
          SELECT 1 FROM services s
          WHERE s.vendor_id = v.id
          AND (s.name ILIKE $${paramIdx} OR s.description ILIKE $${paramIdx})
        )
      )`;
      params.push(`%${problem}%`);
      paramIdx++;

      if (roleId) {
        queryText += ` AND (r.id::text = $${paramIdx} OR r.name = $${paramIdx})`;
        params.push(roleId, roleId);
        paramIdx += 2;
      }

      // Add distance calculation if location provided
      if (latitude && longitude) {
        const lat = parseFloat(latitude);
        const lng = parseFloat(longitude);
        queryText = `
          SELECT *, 
          (6371 * acos(
            cos(radians($${paramIdx})) * cos(radians(CAST(latitude AS FLOAT))) *
            cos(radians(CAST(longitude AS FLOAT)) - radians($${paramIdx + 1})) +
            sin(radians($${paramIdx})) * sin(radians(CAST(latitude AS FLOAT)))
          )) AS distance_km
          FROM (${queryText}) subquery
          WHERE latitude IS NOT NULL AND longitude IS NOT NULL
          ORDER BY distance_km ASC
        `;
        params.push(lat, lng);
        paramIdx += 2;
      } else {
        queryText += ` ORDER BY v.created_at DESC`;
      }

      queryText += ` LIMIT 20`;

      const result = await query(queryText, params);

      return c.json({
        success: true,
        results: result.rows,
        roleConfig: roleId ? { roleId } : null,
      });
    } catch (error: any) {
      console.error('Error in discover-by-problem:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * GET /vendor/:vendorId/facility
   * Get vendor facility details
   */
  app.get("/vendor/:vendorId/facility", async (c) => {
    try {
      const { vendorId } = c.req.param();

      // Get vendor
      const vendors = await select('vendors', { id: vendorId });
      if (vendors.length === 0) {
        return c.json({ error: 'Vendor not found' }, 404);
      }

      const vendor = vendors[0];

      // Get services
      // Check if is_global column exists
      const serviceColumns = await query(
        `SELECT column_name FROM information_schema.columns 
         WHERE table_name = 'services' AND column_name = 'is_global'`
      );
      const hasIsGlobal = serviceColumns.rows.length > 0;
      
      const services = await query(
        `SELECT s.*, vs.custom_price, vs.custom_duration, vs.is_enabled, vs.service_style
         FROM services s
         LEFT JOIN vendor_services vs ON s.id = vs.service_id AND vs.vendor_id = $1
         WHERE (vs.vendor_id = $1${hasIsGlobal ? ' OR s.is_global = true' : ''})
         AND s.is_active = true
         AND (vs.is_enabled IS NULL OR vs.is_enabled = true)
         ORDER BY s.name`,
        [vendorId]
      );

      // Get rating
      const ratingResult = await query(
        `SELECT AVG(rating) as avg_rating, COUNT(*) as review_count
         FROM reviews
         WHERE vendor_id = $1 AND is_approved = true`,
        [vendorId]
      );

      // Get recent reviews
      const recentReviews = await query(
        `SELECT r.*, c.full_name as customer_name
         FROM reviews r
         LEFT JOIN customers c ON r.customer_id = c.id
         WHERE r.vendor_id = $1 AND r.is_approved = true
         ORDER BY r.created_at DESC
         LIMIT 5`,
        [vendorId]
      );

      // ✅ FIX: Extract facility data from vendor metadata and operating_hours
      const metadata = (vendor.metadata as any) || {};
      const operatingHours = vendor.operating_hours 
        ? (typeof vendor.operating_hours === 'string' 
            ? JSON.parse(vendor.operating_hours) 
            : vendor.operating_hours)
        : null;

      return c.json({
        success: true,
        vendor: {
          id: vendor.id,
          business_name: vendor.business_name,
          address: vendor.address,
          city: vendor.city,
          state: vendor.state,
          phone: vendor.phone,
          email: vendor.email,
        },
        facility: {
          address: vendor.address,
          city: vendor.city,
          state: vendor.state,
          pincode: vendor.pincode,
          latitude: vendor.latitude,
          longitude: vendor.longitude,
          description: vendor.description || '',
          amenities: metadata.amenities || [],
          photos: metadata.facility_photos || [],
          specializations: metadata.specializations || [],
          operatingHours: operatingHours || null,
        },
        services: services.rows || [],
        rating: {
          average: parseFloat(ratingResult.rows[0]?.avg_rating || '0'),
          count: parseInt(ratingResult.rows[0]?.review_count || '0', 10),
        },
        recentReviews: recentReviews.rows || [],
      });
    } catch (error: any) {
      console.error('Error fetching vendor facility:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * PUT /vendor/facility/:vendorId
   * Update vendor facility details (address, timings, amenities, etc.)
   * ✅ FIX: This endpoint was missing, causing 404 errors in UAT
   */
  app.put("/vendor/facility/:vendorId", async (c) => {
    try {
      const { vendorId } = c.req.param();
      const facilityData = await c.req.json();

      // Verify vendor exists
      const vendors = await select('vendors', { id: vendorId });
      if (vendors.length === 0) {
        return c.json({ error: 'Vendor not found' }, 404);
      }

      const vendor = vendors[0];

      // ✅ FIX: Build update data object, mapping frontend fields to database columns
      const updateData: any = {};
      
      // Address fields
      if (facilityData.address !== undefined) updateData.address = facilityData.address;
      if (facilityData.city !== undefined) updateData.city = facilityData.city;
      if (facilityData.state !== undefined) updateData.state = facilityData.state;
      if (facilityData.pincode !== undefined) updateData.pincode = facilityData.pincode;
      if (facilityData.country !== undefined) updateData.country = facilityData.country;
      
      // Location coordinates
      if (facilityData.latitude !== undefined) updateData.latitude = facilityData.latitude;
      if (facilityData.longitude !== undefined) updateData.longitude = facilityData.longitude;
      
      // Operating hours (stored as JSONB)
      if (facilityData.operatingHours !== undefined || facilityData.operating_hours !== undefined) {
        updateData.operating_hours = facilityData.operatingHours || facilityData.operating_hours;
      }
      
      // ✅ FIX: Build metadata object once to avoid overwriting
      const existingMetadata = (vendor.metadata as any) || {};
      const updatedMetadata: any = { ...existingMetadata };
      let metadataChanged = false;
      
      // Amenities (stored in metadata)
      if (facilityData.amenities !== undefined) {
        updatedMetadata.amenities = facilityData.amenities;
        metadataChanged = true;
      }
      
      // Custom amenities
      if (facilityData.customAmenities !== undefined) {
        updatedMetadata.customAmenities = facilityData.customAmenities;
        metadataChanged = true;
      }
      
      // Specializations (stored in metadata)
      if (facilityData.specializations !== undefined) {
        updatedMetadata.specializations = facilityData.specializations;
        metadataChanged = true;
      }
      
      // Facility photos (stored in metadata)
      if (facilityData.photos !== undefined || facilityData.facility_photos !== undefined) {
        updatedMetadata.facility_photos = facilityData.photos || facilityData.facility_photos;
        metadataChanged = true;
      }
      
      // Update metadata if any metadata fields changed
      if (metadataChanged) {
        // ✅ FIX B1: Check if metadata column exists before trying to update it
        // If column doesn't exist, we'll use a raw SQL query to add it first
        try {
          // Check if metadata column exists
          const { query } = await import('../database/rds-connection');
          const columnCheck = await query(
            `SELECT column_name FROM information_schema.columns 
             WHERE table_name = 'vendors' AND column_name = 'metadata'`
          );
          
          if (columnCheck.rows.length === 0) {
            // Column doesn't exist, add it
            console.log('[FACILITY] Metadata column missing, adding it...');
            await query('ALTER TABLE vendors ADD COLUMN IF NOT EXISTS metadata JSONB');
            console.log('[FACILITY] Metadata column added successfully');
          }
          
          updateData.metadata = updatedMetadata;
        } catch (metadataError: any) {
          console.error('[FACILITY] Error handling metadata column:', metadataError);
          // If metadata update fails, continue with other fields but log the error
          // Don't fail the entire request if metadata column is missing
          if (!metadataError.message?.includes('does not exist')) {
            throw metadataError;
          }
          // Skip metadata update if column truly doesn't exist
          console.warn('[FACILITY] Skipping metadata update - column may not exist');
        }
      }
      
      // Facility description
      if (facilityData.description !== undefined) updateData.description = facilityData.description;

      // ✅ FIX: Validate that at least one field is being updated
      if (Object.keys(updateData).length === 0) {
        return c.json({ error: 'No valid fields to update. Please provide at least one facility field' }, 400);
      }

      // Always update the updated_at timestamp
      updateData.updated_at = new Date().toISOString();

      // Update vendor record with facility information
      const { update } = await import('../database/rds-connection');
      const updated = await update('vendors', { id: vendorId }, updateData);

      if (updated.length === 0) {
        return c.json({ error: 'Failed to update facility' }, 500);
      }

      return c.json({
        success: true,
        message: 'Facility updated successfully',
        facility: {
          address: updated[0].address,
          city: updated[0].city,
          state: updated[0].state,
          pincode: updated[0].pincode,
          latitude: updated[0].latitude,
          longitude: updated[0].longitude,
          operating_hours: updated[0].operating_hours,
          amenities: (updated[0].metadata as any)?.amenities || [],
          photos: (updated[0].metadata as any)?.facility_photos || [],
        },
      });
    } catch (error: any) {
      console.error('Error updating vendor facility:', error);
      return c.json({ error: error.message || 'Failed to update facility' }, 500);
    }
  });


  /**
   * GET /customer/facility/:vendorId
   * Customer-facing endpoint to get vendor/clinic facility details
   */
  app.get("/customer/facility/:vendorId", async (c) => {
    try {
      const { vendorId } = c.req.param();
      
      if (!vendorId || !isValidUUID(vendorId)) {
        return c.json({ error: 'Valid vendor ID is required' }, 400);
      }

      // Get vendor details
      const vendorResult = await query(
        `SELECT v.*, r.name as role_name, r.display_name as role_display_name,
                r.config as role_config
         FROM vendors v
         LEFT JOIN roles r ON v.role_id = r.id
         WHERE v.id = $1`,
        [vendorId]
      );

      if (vendorResult.rows.length === 0) {
        return c.json({ error: 'Vendor not found', success: false }, 404);
      }

      const vendor = vendorResult.rows[0];

      // Get rating
      const ratingResult = await query(
        `SELECT AVG(rating) as avg_rating, COUNT(*) as review_count
         FROM reviews WHERE vendor_id = $1`,
        [vendorId]
      );

      // Get recent reviews
      const reviewsResult = await query(
        `SELECT r.*, c.full_name as customer_name
         FROM reviews r
         LEFT JOIN customers c ON r.customer_id = c.id
         WHERE r.vendor_id = $1
         ORDER BY r.created_at DESC LIMIT 5`,
        [vendorId]
      );

      // Get staff
      const staffResult = await query(
        `SELECT id, name, role, experience_years, is_active
         FROM staff WHERE vendor_id = $1 AND is_active = true`,
        [vendorId]
      );

      return c.json({
        success: true,
        vendor: {
          id: vendor.id,
          businessName: vendor.business_name,
          ownerName: vendor.owner_name,
          phone: vendor.phone,
          email: vendor.email,
          address: vendor.address,
          city: vendor.city,
          state: vendor.state,
          pincode: vendor.pincode,
          latitude: vendor.latitude,
          longitude: vendor.longitude,
          description: vendor.description,
          logoUrl: vendor.logo_url,
          coverImageUrl: vendor.cover_image_url,
          role: vendor.role_name,
          roleDisplayName: vendor.role_display_name,
        },
        facility: {
          address: vendor.address,
          city: vendor.city,
          state: vendor.state,
          pincode: vendor.pincode,
          latitude: vendor.latitude,
          longitude: vendor.longitude,
          photos: [], // TODO: Add facility photos
          amenities: vendor.amenities || [],
          operatingHours: vendor.operating_hours,
        },
        rating: {
          average: parseFloat(ratingResult.rows[0]?.avg_rating || '0').toFixed(1),
          count: parseInt(ratingResult.rows[0]?.review_count || '0', 10),
        },
        recentReviews: reviewsResult.rows.map(r => ({
          id: r.id,
          customerName: r.customer_name || 'Anonymous',
          rating: r.rating,
          comment: r.comment,
          date: r.created_at,
        })),
        staff: staffResult.rows.map(s => ({
          id: s.id,
          name: s.name,
          role: s.role,
          experienceYears: s.experience_years,
        })),
      });
    } catch (error: any) {
      console.error('Error fetching facility:', error);
      return c.json({ error: error.message, success: false }, 500);
    }
  });

  /**
   * GET /customer/clinic/:vendorId/services
   * Get services for a specific clinic/vendor
   */
  app.get("/customer/clinic/:vendorId/services", async (c) => {
    try {
      const { vendorId } = c.req.param();
      const serviceStyle = c.req.query('style') || c.req.query('serviceStyle');
      
      if (!vendorId || !isValidUUID(vendorId)) {
        return c.json({ error: 'Valid vendor ID is required', success: false }, 400);
      }

      // Get vendor services from vendor_services table
      let servicesQuery = `
        SELECT 
          vs.id,
          vs.service_id,
          vs.service_name,
          vs.service_style,
          vs.price,
          vs.duration_minutes as duration,
          vs.custom_description as description,
          vs.is_enabled,
          vs.publish_status,
          vs.category as category_name,
          vs.sub_category as sub_category_name,
          vs.is_custom_service as is_package,
          vs.metadata as package_details,
          s.name as base_service_name,
          s.description as base_description
        FROM vendor_services vs
        LEFT JOIN services s ON vs.service_id = s.id
        WHERE vs.vendor_id = $1 
          AND vs.is_enabled = true 
          AND vs.publish_status = 'published'
      `;
      
      const params: any[] = [vendorId];
      
      if (serviceStyle) {
        servicesQuery += ` AND vs.service_style = $2`;
        params.push(serviceStyle);
      }
      
      servicesQuery += ` ORDER BY vs.category, vs.service_name`;

      const servicesResult = await query(servicesQuery, params);

      const services = servicesResult.rows.map(s => ({
        id: s.id,
        serviceId: s.service_id,
        serviceName: s.service_name || s.base_service_name,
        description: s.description || s.base_description || '',
        price: parseFloat(s.price || 0),
        duration: s.duration || 30,
        serviceStyle: s.service_style,
        categoryName: s.category_name || s.category,
        subCategoryName: s.sub_category_name || s.sub_category,
        isPackage: s.is_package,
        packageDetails: s.package_details,
        isEnabled: s.is_enabled,
        publishStatus: s.publish_status,
      }));

      // Group by service style
      const groupedServices = {
        at_center: services.filter(s => s.serviceStyle === 'at_center'),
        at_home: services.filter(s => s.serviceStyle === 'at_home'),
        tele: services.filter(s => s.serviceStyle === 'tele'),
      };

      return c.json({
        success: true,
        services,
        grouped: groupedServices,
        total: services.length,
      });
    } catch (error: any) {
      console.error('Error fetching clinic services:', error);
      return c.json({ error: error.message, success: false }, 500);
    }
  });

  /**
   * GET /customer/services/by-style
   * Get available services filtered by style (tele, at_home, at_center)
   * 
   * ⚠️ CRITICAL BUSINESS RULE for at_home and tele:
   * - For BUSINESS ENTITIES (clinics, grooming centers): Return only VERIFIED STAFF MEMBERS
   * - For INDIVIDUAL PROVIDERS (home groomers, individual vets): Return the provider directly
   * - Only verified providers (mobile_verified = true) appear in results
   */
  app.get("/customer/services/by-style", async (c) => {
    try {
      const serviceStyle = c.req.query('style');
      const category = c.req.query('category');
      const latitude = c.req.query('latitude');
      const longitude = c.req.query('longitude');
      const radius = parseInt(c.req.query('radius') || '50', 10); // km
      
      if (!serviceStyle) {
        return c.json({ error: 'Service style is required (tele, at_home, at_center)', success: false }, 400);
      }

      const customerLat = latitude ? parseFloat(latitude) : null;
      const customerLng = longitude ? parseFloat(longitude) : null;

      // ========== FOR AT_CENTER: Return vendors directly ==========
      if (serviceStyle === 'at_center') {
        let vendorsQuery = `
          SELECT DISTINCT ON (v.id)
            v.id as vendor_id,
            v.business_name,
            v.owner_name,
            v.phone,
            v.address,
            v.city,
            v.latitude,
            v.longitude,
            r.name as role_name,
            r.display_name as role_display_name,
            (SELECT AVG(rating) FROM reviews WHERE vendor_id = v.id) as avg_rating,
            (SELECT COUNT(*) FROM reviews WHERE vendor_id = v.id) as review_count,
            'vendor' as provider_type
          FROM vendors v
          LEFT JOIN roles r ON v.role_id = r.id
          INNER JOIN vendor_services vs ON vs.vendor_id = v.id
          WHERE v.status = 'approved' 
            AND v.is_active = true
            AND vs.service_style = $1
            AND vs.is_enabled = true
            AND vs.publish_status = 'published'
        `;
        
        const params: any[] = [serviceStyle];
        let paramIndex = 2;

        if (category) {
          const categoryRoles: Record<string, string[]> = {
            'vet': ['veterinarian', 'vet_clinic'],
            'grooming': ['groomer', 'grooming_salon', 'pet_groomer'],
            'training': ['trainer', 'pet_trainer'],
          };
          const roles = categoryRoles[category.toLowerCase()];
          if (roles) {
            vendorsQuery += ` AND r.name = ANY($${paramIndex})`;
            params.push(roles);
            paramIndex++;
          }
        }

        vendorsQuery += ` ORDER BY v.id, avg_rating DESC NULLS LAST LIMIT 50`;

        const vendorsResult = await query(vendorsQuery, params);

        const vendorsWithServices = await Promise.all(
          vendorsResult.rows.map(async (vendor) => {
            const servicesResult = await query(
              `SELECT 
                vs.id,
                vs.service_id,
                vs.service_name,
                vs.price,
                vs.duration_minutes as duration,
                vs.custom_description as description,
                vs.category as category_name
               FROM vendor_services vs
               WHERE vs.vendor_id = $1 
                 AND vs.service_style = $2
                 AND vs.is_enabled = true
                 AND vs.publish_status = 'published'
               ORDER BY vs.price ASC`,
              [vendor.vendor_id, serviceStyle]
            );

            let distance = null;
            if (customerLat && customerLng && vendor.latitude && vendor.longitude) {
              distance = calculateDistance(customerLat, customerLng, parseFloat(vendor.latitude), parseFloat(vendor.longitude));
            }

            return {
              providerId: vendor.vendor_id,
              providerType: 'vendor',
              vendorId: vendor.vendor_id,
              name: vendor.business_name || vendor.owner_name,
              phone: vendor.phone,
              address: vendor.address,
              city: vendor.city,
              role: vendor.role_display_name || vendor.role_name,
              rating: parseFloat(vendor.avg_rating || '0').toFixed(1),
              reviewCount: parseInt(vendor.review_count || '0', 10),
              distance: distance ? parseFloat(distance.toFixed(2)) : null,
              isVerified: true, // Vendors don't need mobile verification
              services: servicesResult.rows.map(s => ({
                id: s.id,
                serviceId: s.service_id,
                name: s.service_name,
                price: parseFloat(s.price || 0),
                duration: s.duration || 30,
                description: s.description,
                category: s.category_name,
              })),
            };
          })
        );

        const filteredVendors = vendorsWithServices.filter(v => v.services.length > 0);

        return c.json({
          success: true,
          style: serviceStyle,
          providers: filteredVendors,
          total: filteredVendors.length,
        });
      }

      // ========== FOR AT_HOME and TELE: Return verified staff/individual providers ==========
      // 1. Get individual providers (staff with vendor_id = NULL and is_individual_provider = true)
      // 2. Get verified staff members from clinics/centers who are assigned to this service style

      const providers: any[] = [];

      // Category role mapping
      const categoryRoles: Record<string, string[]> = {
        'vet': ['Veterinarian', 'veterinarian', 'vet'],
        'grooming': ['Groomer', 'groomer', 'pet_groomer'],
        'training': ['Trainer', 'trainer', 'pet_trainer'],
        'walker': ['Walker', 'walker', 'pet_walker'],
      };

      const targetRoles = category ? (categoryRoles[category.toLowerCase()] || []) : [];

      // ========== 1. Get Individual Providers (no vendor_id, verified) ==========
      let individualQuery = `
        SELECT 
          s.id,
          s.name,
          s.phone,
          s.email,
          s.photo,
          s.role,
          s.experience_years,
          s.qualifications,
          s.default_location,
          s.is_individual_provider,
          s.mobile_verified,
          COALESCE((SELECT AVG(rating) FROM reviews WHERE staff_id = s.id), 0) as avg_rating,
          COALESCE((SELECT COUNT(*) FROM reviews WHERE staff_id = s.id), 0) as review_count
        FROM staff s
        WHERE s.is_active = true
          AND s.mobile_verified = true
          AND s.vendor_id IS NULL
          AND s.is_individual_provider = true
      `;

      const individualParams: any[] = [];
      let individualParamIdx = 1;

      if (targetRoles.length > 0) {
        individualQuery += ` AND s.role = ANY($${individualParamIdx})`;
        individualParams.push(targetRoles);
        individualParamIdx++;
      }

      // Check if staff has services with this style enabled
      individualQuery += ` AND EXISTS (
        SELECT 1 FROM staff_services ss 
        WHERE ss.staff_id = s.id 
          AND ss.enabled_by_staff = true 
          AND ss.is_active = true
          AND $${individualParamIdx} = ANY(ss.service_styles)
      )`;
      individualParams.push(serviceStyle);
      individualParamIdx++;

      const individualResult = await query(individualQuery, individualParams);

      for (const ind of individualResult.rows) {
        // Get services for this individual
        const servicesResult = await query(
          `SELECT 
            ss.id,
            ss.service_id,
            ss.price,
            ss.duration_minutes as duration,
            ss.service_styles,
            s.name as service_name,
            s.description,
            s.category
           FROM staff_services ss
           INNER JOIN services s ON ss.service_id = s.id
           WHERE ss.staff_id = $1 
             AND ss.enabled_by_staff = true 
             AND ss.is_active = true
             AND $2 = ANY(ss.service_styles)
           ORDER BY ss.price ASC`,
          [ind.id, serviceStyle]
        );

        // Calculate distance if location available
        let distance = null;
        if (customerLat && customerLng && ind.default_location) {
          const loc = typeof ind.default_location === 'string' 
            ? JSON.parse(ind.default_location) 
            : ind.default_location;
          if (loc.lat && loc.lng) {
            distance = calculateDistance(customerLat, customerLng, parseFloat(loc.lat), parseFloat(loc.lng));
          }
        }

        providers.push({
          providerId: ind.id,
          providerType: 'individual',
          staffId: ind.id,
          vendorId: null,
          name: ind.name,
          phone: ind.phone,
          photo: ind.photo,
          role: ind.role,
          experienceYears: ind.experience_years,
          qualifications: ind.qualifications,
          rating: parseFloat(ind.avg_rating || '0').toFixed(1),
          reviewCount: parseInt(ind.review_count || '0', 10),
          distance: distance ? parseFloat(distance.toFixed(2)) : null,
          isVerified: true,
          isIndividualProvider: true,
          services: servicesResult.rows.map(s => ({
            id: s.id,
            serviceId: s.service_id,
            name: s.service_name,
            price: parseFloat(s.price || 0),
            duration: s.duration || 30,
            description: s.description,
            category: s.category,
          })),
        });
      }

      // ========== 2. Get Verified Staff from Clinics/Centers ==========
      let staffQuery = `
        SELECT 
          s.id,
          s.name,
          s.phone,
          s.email,
          s.photo,
          s.role,
          s.experience_years,
          s.qualifications,
          s.default_location,
          s.mobile_verified,
          s.vendor_id,
          v.business_name as vendor_name,
          v.address as vendor_address,
          v.city as vendor_city,
          v.latitude as vendor_lat,
          v.longitude as vendor_lng,
          r.display_name as vendor_role_display,
          COALESCE((SELECT AVG(rating) FROM reviews WHERE staff_id = s.id), 0) as avg_rating,
          COALESCE((SELECT COUNT(*) FROM reviews WHERE staff_id = s.id), 0) as review_count
        FROM staff s
        INNER JOIN vendors v ON s.vendor_id = v.id
        LEFT JOIN roles r ON v.role_id = r.id
        WHERE s.is_active = true
          AND s.mobile_verified = true
          AND v.status = 'approved'
          AND v.is_active = true
          AND s.vendor_id IS NOT NULL
      `;

      const staffParams: any[] = [];
      let staffParamIdx = 1;

      // Filter by role
      if (targetRoles.length > 0) {
        staffQuery += ` AND s.role = ANY($${staffParamIdx})`;
        staffParams.push(targetRoles);
        staffParamIdx++;
      }

      // Check if staff has services with this style enabled
      staffQuery += ` AND EXISTS (
        SELECT 1 FROM staff_services ss 
        WHERE ss.staff_id = s.id 
          AND ss.enabled_by_staff = true 
          AND ss.is_active = true
          AND $${staffParamIdx} = ANY(ss.service_styles)
      )`;
      staffParams.push(serviceStyle);
      staffParamIdx++;

      const staffResult = await query(staffQuery, staffParams);

      for (const staff of staffResult.rows) {
        // Get services for this staff
        const servicesResult = await query(
          `SELECT 
            ss.id,
            ss.service_id,
            ss.price,
            ss.duration_minutes as duration,
            ss.service_styles,
            s.name as service_name,
            s.description,
            s.category
           FROM staff_services ss
           INNER JOIN services s ON ss.service_id = s.id
           WHERE ss.staff_id = $1 
             AND ss.enabled_by_staff = true 
             AND ss.is_active = true
             AND $2 = ANY(ss.service_styles)
           ORDER BY ss.price ASC`,
          [staff.id, serviceStyle]
        );

        // Calculate distance
        let distance = null;
        if (customerLat && customerLng) {
          // First try staff's default_location, then vendor's location
          let lat = null, lng = null;
          if (staff.default_location) {
            const loc = typeof staff.default_location === 'string' 
              ? JSON.parse(staff.default_location) 
              : staff.default_location;
            lat = loc.lat;
            lng = loc.lng;
          } else if (staff.vendor_lat && staff.vendor_lng) {
            lat = parseFloat(staff.vendor_lat);
            lng = parseFloat(staff.vendor_lng);
          }
          if (lat && lng) {
            distance = calculateDistance(customerLat, customerLng, lat, lng);
          }
        }

        providers.push({
          providerId: staff.id,
          providerType: 'staff',
          staffId: staff.id,
          vendorId: staff.vendor_id,
          vendorName: staff.vendor_name,
          name: staff.name,
          phone: staff.phone,
          photo: staff.photo,
          role: staff.role,
          experienceYears: staff.experience_years,
          qualifications: staff.qualifications,
          address: staff.vendor_address,
          city: staff.vendor_city,
          vendorRoleDisplay: staff.vendor_role_display,
          rating: parseFloat(staff.avg_rating || '0').toFixed(1),
          reviewCount: parseInt(staff.review_count || '0', 10),
          distance: distance ? parseFloat(distance.toFixed(2)) : null,
          isVerified: true,
          isIndividualProvider: false,
          services: servicesResult.rows.map(s => ({
            id: s.id,
            serviceId: s.service_id,
            name: s.service_name,
            price: parseFloat(s.price || 0),
            duration: s.duration || 30,
            description: s.description,
            category: s.category,
          })),
        });
      }

      // Filter providers with at least one service and sort by distance
      const filteredProviders = providers
        .filter(p => p.services.length > 0)
        .sort((a, b) => {
          // Sort by distance if available, otherwise by rating
          if (a.distance !== null && b.distance !== null) {
            return a.distance - b.distance;
          }
          return parseFloat(b.rating) - parseFloat(a.rating);
        });

      return c.json({
        success: true,
        style: serviceStyle,
        providers: filteredProviders,
        total: filteredProviders.length,
        // Also return as vendors for backward compatibility
        vendors: filteredProviders,
      });
    } catch (error: any) {
      console.error('Error fetching services by style:', error);
      return c.json({ error: error.message, success: false }, 500);
    }
  });

  /**
   * GET /vendors
   * List vendors by role (for customer app clinic/groomer listing)
   * Query params: role, city, status, limit
   */
  app.get("/vendors", async (c) => {
    try {
      const role = c.req.query('role');
      const city = c.req.query('city');
      const status = c.req.query('status') || 'approved';
      const limit = parseInt(c.req.query('limit') || '50', 10);

      let vendorQuery = `
        SELECT 
          v.id,
          v.business_name,
          v.owner_name,
          v.phone,
          v.address,
          v.city,
          v.latitude,
          v.longitude,
          v.status,
          v.role_id,
          r.name as role_name,
          r.display_name as role_display_name,
          COALESCE(
            (SELECT AVG(rating)::numeric(3,1) FROM reviews WHERE vendor_id = v.id),
            4.5
          ) as avg_rating,
          COALESCE(
            (SELECT COUNT(*) FROM reviews WHERE vendor_id = v.id),
            0
          ) as review_count,
          COALESCE(
            (SELECT COUNT(*) FROM bookings WHERE vendor_id = v.id AND status = 'completed'),
            0
          ) as completed_bookings
        FROM vendors v
        LEFT JOIN roles r ON v.role_id = r.id
        WHERE v.is_active = true
      `;

      const params: any[] = [];
      let paramIndex = 1;

      // Filter by status
      if (status) {
        vendorQuery += ` AND v.status = $${paramIndex}`;
        params.push(status);
        paramIndex++;
      }

      // Filter by role name
      if (role) {
        vendorQuery += ` AND (r.name = $${paramIndex} OR r.display_name ILIKE $${paramIndex + 1})`;
        params.push(role, `%${role}%`);
        paramIndex += 2;
      }

      // Filter by city
      if (city) {
        vendorQuery += ` AND v.city ILIKE $${paramIndex}`;
        params.push(`%${city}%`);
        paramIndex++;
      }

      vendorQuery += ` ORDER BY avg_rating DESC, completed_bookings DESC LIMIT $${paramIndex}`;
      params.push(limit);

      const result = await query(vendorQuery, params);

      const vendors = result.rows.map((v: any) => ({
        id: v.id,
        businessName: v.business_name || v.owner_name,
        ownerName: v.owner_name,
        phone: v.phone,
        address: v.address,
        city: v.city,
        latitude: v.latitude,
        longitude: v.longitude,
        status: v.status,
        roleId: v.role_id,
        roleName: v.role_name,
        roleDisplayName: v.role_display_name,
        rating: parseFloat(v.avg_rating || '4.5').toFixed(1),
        reviewCount: parseInt(v.review_count || '0', 10),
        completedBookings: parseInt(v.completed_bookings || '0', 10),
      }));

      return c.json({
        success: true,
        vendors: vendors,
        total: vendors.length,
      });
    } catch (error: any) {
      console.error('Error fetching vendors:', error);
      return c.json({ error: error.message, success: false }, 500);
    }
  });
}

