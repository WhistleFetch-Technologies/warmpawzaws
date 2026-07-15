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

export async function relocationServicesGetHandler(c: Context) {
    try {
      const origin = c.req.query('origin');
      const destination = c.req.query('destination');
      const transportType = c.req.query('transportType');
      const limit = parseInt(c.req.query('limit') || '20', 10);
      const offset = parseInt(c.req.query('offset') || '0', 10);

      let serviceQuery = `
        SELECT 
          v.*,
          r.name as role_name,
          r.display_name as role_display_name,
          COALESCE((SELECT AVG(rating) FROM reviews WHERE vendor_id = v.id), 0) as vendor_rating,
          COALESCE((SELECT COUNT(*) FROM bookings WHERE vendor_id = v.id AND service_type = 'pet_relocation' AND status = 'completed'), 0) as relocations_count
        FROM vendors v
        INNER JOIN roles r ON v.role_id = r.id
        WHERE r.name IN ('pet_relocation', 'pet_transport', 'relocation')
        AND v.status = 'approved'
        AND v.is_active = true
        AND COALESCE(v.is_online, true) = true
      `;

      const params: any[] = [];
      let paramIndex = 1;

      if (origin) {
        serviceQuery += ` AND (v.city ILIKE $${paramIndex} OR v.service_areas ILIKE $${paramIndex})`;
        params.push(`%${origin}%`);
        paramIndex++;
      }

      serviceQuery += ` ORDER BY vendor_rating DESC NULLS LAST LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
      params.push(limit, offset);

      const services = await query(serviceQuery, params).catch(() => ({ rows: [] }));

      return c.json({
        success: true,
        services: services.rows.map((service: any) => ({
          id: service.id,
          name: service.business_name,
          city: service.city,
          phone: service.phone,
          email: service.email,
          rating: parseFloat(service.vendor_rating || '0').toFixed(1),
          relocationsCount: parseInt(service.relocations_count || '0', 10),
          transportTypes: ['air', 'road'], // Could be stored in metadata
          serviceAreas: service.service_areas || 'Pan India',
        })),
        total: services.rows.length,
      });
    } catch (error: any) {
      console.error('Error fetching relocation services:', error);
      return c.json({ success: true, services: [], total: 0 });
    }
}
