/**
 * ============================================================================
 * EVENT MANAGEMENT ENDPOINTS - LAMBDA VERSION
 * ============================================================================
 * 
 * Handles events (adoption drives, fundraisers, pet parties, meetups):
 * - Create/manage events
 * - Event registration
 * - Event discovery
 * 
 * Migrated from: supabase/functions/server/event-management-endpoints.tsx
 * 
 * Date: 2025-01-28
 * Migration: Supabase to AWS Lambda
 * ============================================================================
 */

import { Hono } from 'hono';
import { select, insert, update, query } from '../database/rds-connection';

export function registerEventEndpoints(app: Hono) {
  /**
   * GET /events/vendor/:vendorId
   * Get all events for a vendor
   */
  app.get("/events/vendor/:vendorId", async (c) => {
    try {
      const { vendorId } = c.req.param();
      const status = c.req.query('status');
      const category = c.req.query('category');
      const upcoming = c.req.query('upcoming') === 'true';

      let eventsQuery = `
        SELECT * FROM events
        WHERE vendor_id = $1
      `;

      const params: any[] = [vendorId];
      let paramIndex = 2;

      if (status) {
        eventsQuery += ` AND status = $${paramIndex}`;
        params.push(status);
        paramIndex++;
      }

      if (category) {
        eventsQuery += ` AND category = $${paramIndex}`;
        params.push(category);
        paramIndex++;
      }

      if (upcoming) {
        eventsQuery += ` AND event_date >= CURRENT_DATE AND status != 'completed'`;
      }

      eventsQuery += ` ORDER BY event_date ASC, start_time ASC`;

      const events = await query(eventsQuery, params).catch(() => ({ rows: [] }));

      // Calculate stats
      const allEvents = events.rows;
      const stats = {
        total: allEvents.length,
        upcoming: allEvents.filter((e: any) => new Date(e.event_date) >= new Date() && e.status !== 'completed').length,
        ongoing: allEvents.filter((e: any) => e.status === 'ongoing').length,
        completed: allEvents.filter((e: any) => e.status === 'completed').length,
        totalAttendees: allEvents.reduce((sum: number, e: any) => sum + (e.current_attendees || 0), 0),
      };

      return c.json({
        success: true,
        events: allEvents,
        stats,
      });
    } catch (error: any) {
      console.error('Error fetching events:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * POST /events
   * Create a new event
   */
  app.post("/events", async (c) => {
    try {
      const eventData = await c.req.json();
      const {
        vendorId,
        name,
        description,
        category,
        eventDate,
        startTime,
        endTime,
        venue,
        registrationRequired,
        maxAttendees,
        fees,
        imageUrl,
        tags,
      } = eventData;

      if (!vendorId || !name || !eventDate || !startTime) {
        return c.json({ error: 'vendorId, name, eventDate, and startTime are required' }, 400);
      }

      const event = await insert('events', {
        vendor_id: vendorId,
        name,
        description: description || null,
        category: category || 'other',
        event_date: eventDate,
        start_time: startTime,
        end_time: endTime || null,
        venue: venue || {},
        registration_required: registrationRequired || false,
        max_attendees: maxAttendees || null,
        fees: fees || null,
        image_url: imageUrl || null,
        tags: tags || [],
        status: 'draft',
        current_attendees: 0,
      });

      return c.json({
        success: true,
        event: event[0],
        message: 'Event created successfully',
      });
    } catch (error: any) {
      console.error('Error creating event:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * GET /events/discover
   * Discover events (customer-facing)
   */
  app.get("/events/discover", async (c) => {
    try {
      const category = c.req.query('category');
      const city = c.req.query('city');
      const upcoming = c.req.query('upcoming') !== 'false';

      let eventsQuery = `
        SELECT e.*, v.business_name as vendor_name, v.city as vendor_city
        FROM events e
        INNER JOIN vendors v ON e.vendor_id = v.id
        WHERE e.status = 'published'
        AND v.status = 'approved'
        AND v.is_active = true
      `;

      const params: any[] = [];
      let paramIndex = 1;

      if (category) {
        eventsQuery += ` AND e.category = $${paramIndex}`;
        params.push(category);
        paramIndex++;
      }

      if (city) {
        eventsQuery += ` AND v.city = $${paramIndex}`;
        params.push(city);
        paramIndex++;
      }

      if (upcoming) {
        eventsQuery += ` AND e.event_date >= CURRENT_DATE`;
      }

      eventsQuery += ` ORDER BY e.event_date ASC, e.start_time ASC LIMIT 50`;

      const events = await query(eventsQuery, params).catch(() => ({ rows: [] }));

      return c.json({
        success: true,
        events: events.rows,
        total: events.rows.length,
      });
    } catch (error: any) {
      console.error('Error discovering events:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * POST /events/:eventId/register
   * Register for an event
   */
  app.post("/events/:eventId/register", async (c) => {
    try {
      const { eventId } = c.req.param();
      const {
        customerId,
        attendeeName,
        attendeeEmail,
        attendeePhone,
        numberOfPeople,
        pets,
        specialRequirements,
      } = await c.req.json();

      if (!customerId || !attendeeName || !attendeePhone) {
        return c.json({ error: 'customerId, attendeeName, and attendeePhone are required' }, 400);
      }

      // Get event
      const events = await select('events', { id: eventId, status: 'published' });
      if (events.length === 0) {
        return c.json({ error: 'Event not found or not published' }, 404);
      }

      const event = events[0];

      // Check capacity
      if (event.max_attendees && (event.current_attendees || 0) >= event.max_attendees) {
        return c.json({ error: 'Event is full' }, 400);
      }

      // Create registration
      const registration = await insert('event_registrations', {
        event_id: eventId,
        customer_id: customerId,
        attendee_name: attendeeName,
        attendee_email: attendeeEmail || null,
        attendee_phone: attendeePhone,
        number_of_people: numberOfPeople || 1,
        pets: pets || [],
        special_requirements: specialRequirements || null,
        payment_status: event.fees ? 'pending' : 'waived',
        payment_amount: event.fees || null,
        status: 'confirmed',
      });

      // Update event attendee count
      await update('events',
        { id: eventId },
        { current_attendees: (event.current_attendees || 0) + 1 }
      );

      return c.json({
        success: true,
        registration: registration[0],
        message: 'Registered successfully',
      });
    } catch (error: any) {
      console.error('Error registering for event:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * GET /events/:eventId/registrations
   * Get event registrations (vendor)
   */
  app.get("/events/:eventId/registrations", async (c) => {
    try {
      const { eventId } = c.req.param();

      const registrations = await query(
        `SELECT r.*, c.name as customer_name, c.phone as customer_phone
         FROM event_registrations r
         LEFT JOIN customers c ON r.customer_id = c.id
         WHERE r.event_id = $1
         ORDER BY r.created_at DESC`,
        [eventId]
      ).catch(() => ({ rows: [] }));

      return c.json({
        success: true,
        registrations: registrations.rows,
        total: registrations.rows.length,
      });
    } catch (error: any) {
      console.error('Error fetching registrations:', error);
      return c.json({ error: error.message }, 500);
    }
  });
}

