import type { Context } from 'hono';
/**
 * ============================================================================
 * SPECIALIZED SERVICE FLOWS - 360 DEGREE CUSTOMER-VENDOR MATCHING
 * ============================================================================
 * 
 * Complete end-to-end flows for specialized pet services:
 * - Adoption: Pet catalog, adoption requests, applications
 * - Breeder: Puppy listings, purchase inquiries, reservations
 * - Peer to Peer: Pet matching, match requests, messaging
 * - Pet Holidays: Package builder, bookings, itinerary
 * - Relocation: Quote calculator, booking, tracking
 * 
 * Date: 2026-01-19
 * ============================================================================
 */

import { Hono } from 'hono';
import { select, insert, update, query } from '../../../../database/rds-connection';
import { isValidUUID } from '../../../../types/entities';

export async function customerHolidaypackagesGetHandler(c: Context) {
    try {
      const destination = c.req.query('destination');
      const durationMin = c.req.query('durationMin');
      const durationMax = c.req.query('durationMax');
      const priceMax = c.req.query('priceMax');
      const tourType = c.req.query('tourType');
      const petType = c.req.query('petType');
      const limit = parseInt(c.req.query('limit') || '20', 10);
      const offset = parseInt(c.req.query('offset') || '0', 10);

      let packageQuery = `
        SELECT 
          hp.*,
          v.business_name as vendor_name,
          v.city as vendor_city,
          v.phone as vendor_phone,
          COALESCE((SELECT AVG(rating) FROM reviews WHERE vendor_id = v.id), 0) as vendor_rating,
          COALESCE((SELECT COUNT(*) FROM bookings WHERE package_id = hp.id AND status = 'completed'), 0) as bookings_count
        FROM holiday_packages hp
        INNER JOIN vendors v ON hp.vendor_id = v.id
        WHERE hp.is_active = true
        AND v.status = 'approved'
        AND v.is_active = true
      `;

      const params: any[] = [];
      let paramIndex = 1;

      if (destination) {
        packageQuery += ` AND hp.destination ILIKE $${paramIndex}`;
        params.push(`%${destination}%`);
        paramIndex++;
      }

      if (durationMin) {
        packageQuery += ` AND hp.duration_days >= $${paramIndex}`;
        params.push(parseInt(durationMin, 10));
        paramIndex++;
      }

      if (durationMax) {
        packageQuery += ` AND hp.duration_days <= $${paramIndex}`;
        params.push(parseInt(durationMax, 10));
        paramIndex++;
      }

      if (priceMax) {
        packageQuery += ` AND hp.price <= $${paramIndex}`;
        params.push(parseFloat(priceMax));
        paramIndex++;
      }

      if (tourType) {
        packageQuery += ` AND hp.tour_type = $${paramIndex}`;
        params.push(tourType);
        paramIndex++;
      }

      packageQuery += ` ORDER BY hp.featured DESC NULLS LAST, vendor_rating DESC NULLS LAST LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
      params.push(limit, offset);

      const packages = await query(packageQuery, params).catch(() => ({ rows: [] }));

      return c.json({
        success: true,
        packages: packages.rows.map((pkg: any) => ({
          id: pkg.id,
          title: pkg.title || pkg.name,
          destination: pkg.destination,
          durationDays: pkg.duration_days,
          price: pkg.price,
          groupSize: pkg.group_size,
          tourType: pkg.tour_type,
          description: pkg.description,
          images: typeof pkg.images === 'string' ? JSON.parse(pkg.images) : pkg.images || [],
          inclusions: typeof pkg.inclusions === 'string' ? JSON.parse(pkg.inclusions) : pkg.inclusions || [],
          exclusions: typeof pkg.exclusions === 'string' ? JSON.parse(pkg.exclusions) : pkg.exclusions || [],
          itinerary: typeof pkg.itinerary === 'string' ? JSON.parse(pkg.itinerary) : pkg.itinerary || [],
          petTypesAllowed: pkg.pet_types_allowed || ['dog', 'cat'],
          nextDeparture: pkg.next_departure,
          vendor: {
            id: pkg.vendor_id,
            name: pkg.vendor_name,
            city: pkg.vendor_city,
            rating: parseFloat(pkg.vendor_rating || '0').toFixed(1),
          },
          bookingsCount: parseInt(pkg.bookings_count || '0', 10),
          featured: pkg.featured,
        })),
        total: packages.rows.length,
      });
    } catch (error: any) {
      console.error('Error fetching holiday packages:', error);
      return c.json({ success: true, packages: [], total: 0 });
    }
}
