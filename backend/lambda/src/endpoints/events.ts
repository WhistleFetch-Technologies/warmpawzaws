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

  /**
   * GET /events/my-registrations
   * Get customer's event registrations
   */
  app.get("/events/my-registrations", async (c) => {
    try {
      const customerId = c.req.query('customerId');
      
      if (!customerId) {
        return c.json({ success: true, registrations: [] });
      }

      const registrations = await query(
        `SELECT r.*, e.name as event_title, e.event_date, e.start_time, e.end_time, e.venue, e.category
         FROM event_registrations r
         INNER JOIN events e ON r.event_id = e.id
         WHERE r.customer_id = $1
         ORDER BY e.event_date DESC, e.start_time DESC`,
        [customerId]
      ).catch(() => ({ rows: [] }));

      return c.json({
        success: true,
        registrations: registrations.rows.map((r: any) => ({
          id: String(r.id),
          event_id: String(r.event_id),
          event_title: String(r.event_title || ''),
          registered_at: String(r.created_at || new Date().toISOString()),
          status: r.status || 'confirmed',
          qr_code: r.qr_code || undefined,
          event_date: String(r.event_date || ''),
          start_time: String(r.start_time || ''),
          end_time: String(r.end_time || ''),
          venue: typeof r.venue === 'object' ? (r.venue?.address || JSON.stringify(r.venue)) : String(r.venue || ''),
          category: r.category || 'other',
        })),
      });
    } catch (error: any) {
      console.error('Error fetching customer registrations:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * GET /admin/events
   * Get all events (admin view)
   */
  app.get("/admin/events", async (c) => {
    try {
      const status = c.req.query('status');
      const category = c.req.query('category');

      let eventsQuery = `
        SELECT e.*, v.business_name as vendor_name
        FROM events e
        LEFT JOIN vendors v ON e.vendor_id = v.id
        WHERE 1=1
      `;

      const params: any[] = [];
      let paramIndex = 1;

      if (status && status !== 'all') {
        eventsQuery += ` AND e.status = $${paramIndex}`;
        params.push(status);
        paramIndex++;
      }

      if (category) {
        eventsQuery += ` AND e.category = $${paramIndex}`;
        params.push(category);
        paramIndex++;
      }

      eventsQuery += ` ORDER BY e.event_date DESC, e.start_time DESC LIMIT 100`;

      const events = await query(eventsQuery, params).catch(() => ({ rows: [] }));

      // Transform to match frontend expected format
      const transformedEvents = (events.rows || []).map((e: any) => ({
        id: String(e.id || ''),
        title: String(e.name || ''),
        description: String(e.description || ''),
        start_date: String(e.event_date || ''),
        end_date: String(e.end_date || e.event_date || ''),
        start_time: String(e.start_time || ''),
        end_time: String(e.end_time || ''),
        location: typeof e.venue === 'object' ? (e.venue?.address || JSON.stringify(e.venue)) : String(e.venue || ''),
        max_participants: e.max_attendees ? parseInt(e.max_attendees, 10) : undefined,
        current_participants: e.current_attendees ? parseInt(e.current_attendees, 10) : 0,
        status: e.status || 'draft',
        category: e.category || 'other',
        vendor_id: e.vendor_id ? String(e.vendor_id) : undefined,
        vendor_name: e.vendor_name || undefined,
        image_url: e.image_url || undefined,
        fees: e.fees ? parseFloat(e.fees) : undefined,
        tags: Array.isArray(e.tags) ? e.tags : [],
        created_at: String(e.created_at || new Date().toISOString()),
      }));

      return c.json(transformedEvents);
    } catch (error: any) {
      console.error('Error fetching admin events:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * POST /admin/events
   * Create a new event (admin)
   */
  app.post("/admin/events", async (c) => {
    try {
      const eventData = await c.req.json();
      const {
        title,
        description,
        category,
        start_date,
        end_date,
        start_time,
        end_time,
        location,
        max_participants,
        vendor_id,
        image_url,
        fees,
        tags,
        status = 'draft',
      } = eventData;

      if (!title || !start_date || !start_time) {
        return c.json({ error: 'title, start_date, and start_time are required' }, 400);
      }

      const venue = typeof location === 'string' ? { address: location } : location || {};

      const event = await insert('events', {
        vendor_id: vendor_id || null,
        name: title,
        description: description || null,
        category: category || 'other',
        event_date: start_date,
        end_date: end_date || start_date,
        start_time: start_time,
        end_time: end_time || null,
        venue: venue,
        registration_required: max_participants ? true : false,
        max_attendees: max_participants || null,
        fees: fees || null,
        image_url: image_url || null,
        tags: tags || [],
        status: status,
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
   * PUT /admin/events/:eventId
   * Update an event (admin)
   */
  app.put("/admin/events/:eventId", async (c) => {
    try {
      const { eventId } = c.req.param();
      const eventData = await c.req.json();
      const {
        title,
        description,
        category,
        start_date,
        end_date,
        start_time,
        end_time,
        location,
        max_participants,
        vendor_id,
        image_url,
        fees,
        tags,
        status,
      } = eventData;

      // Check if event exists
      const existingEvents = await select('events', { id: eventId });
      if (existingEvents.length === 0) {
        return c.json({ error: 'Event not found' }, 404);
      }

      const updateData: any = {};
      if (title !== undefined) updateData.name = title;
      if (description !== undefined) updateData.description = description;
      if (category !== undefined) updateData.category = category;
      if (start_date !== undefined) updateData.event_date = start_date;
      if (end_date !== undefined) updateData.end_date = end_date;
      if (start_time !== undefined) updateData.start_time = start_time;
      if (end_time !== undefined) updateData.end_time = end_time;
      if (location !== undefined) {
        updateData.venue = typeof location === 'string' ? { address: location } : location;
      }
      if (max_participants !== undefined) {
        updateData.max_attendees = max_participants;
        updateData.registration_required = max_participants ? true : false;
      }
      if (vendor_id !== undefined) updateData.vendor_id = vendor_id;
      if (image_url !== undefined) updateData.image_url = image_url;
      if (fees !== undefined) updateData.fees = fees;
      if (tags !== undefined) updateData.tags = tags;
      if (status !== undefined) updateData.status = status;

      await update('events', { id: eventId }, updateData);

      const updatedEvents = await select('events', { id: eventId });
      const e = updatedEvents[0];

      return c.json({
        success: true,
        event: {
          id: String(e.id),
          title: String(e.name || ''),
          description: String(e.description || ''),
          start_date: String(e.event_date || ''),
          end_date: String(e.end_date || e.event_date || ''),
          start_time: String(e.start_time || ''),
          end_time: String(e.end_time || ''),
          location: typeof e.venue === 'object' ? (e.venue?.address || JSON.stringify(e.venue)) : String(e.venue || ''),
          max_participants: e.max_attendees ? parseInt(e.max_attendees, 10) : undefined,
          current_participants: e.current_attendees ? parseInt(e.current_attendees, 10) : 0,
          status: e.status || 'draft',
          category: e.category || 'other',
          vendor_id: e.vendor_id ? String(e.vendor_id) : undefined,
          image_url: e.image_url || undefined,
          fees: e.fees ? parseFloat(e.fees) : undefined,
          tags: Array.isArray(e.tags) ? e.tags : [],
          created_at: String(e.created_at || new Date().toISOString()),
        },
        message: 'Event updated successfully',
      });
    } catch (error: any) {
      console.error('Error updating event:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * DELETE /admin/events/:eventId
   * Delete an event (admin)
   */
  app.delete("/admin/events/:eventId", async (c) => {
    try {
      const { eventId } = c.req.param();

      // Check if event exists
      const existingEvents = await select('events', { id: eventId });
      if (existingEvents.length === 0) {
        return c.json({ error: 'Event not found' }, 404);
      }

      // Soft delete by updating status
      await update('events', { id: eventId }, { status: 'cancelled' });

      return c.json({
        success: true,
        message: 'Event deleted successfully',
      });
    } catch (error: any) {
      console.error('Error deleting event:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * GET /admin/events/:eventId
   * Get a single event (admin)
   */
  app.get("/admin/events/:eventId", async (c) => {
    try {
      const { eventId } = c.req.param();

      const events = await query(
        `SELECT e.*, v.business_name as vendor_name
         FROM events e
         LEFT JOIN vendors v ON e.vendor_id = v.id
         WHERE e.id = $1`,
        [eventId]
      ).catch(() => ({ rows: [] }));

      if (events.rows.length === 0) {
        return c.json({ error: 'Event not found' }, 404);
      }

      const e = events.rows[0];

      return c.json({
        id: String(e.id),
        title: String(e.name || ''),
        description: String(e.description || ''),
        start_date: String(e.event_date || ''),
        end_date: String(e.end_date || e.event_date || ''),
        start_time: String(e.start_time || ''),
        end_time: String(e.end_time || ''),
        location: typeof e.venue === 'object' ? (e.venue?.address || JSON.stringify(e.venue)) : String(e.venue || ''),
        max_participants: e.max_attendees ? parseInt(e.max_attendees, 10) : undefined,
        current_participants: e.current_attendees ? parseInt(e.current_attendees, 10) : 0,
        status: e.status || 'draft',
        category: e.category || 'other',
        vendor_id: e.vendor_id ? String(e.vendor_id) : undefined,
        vendor_name: e.vendor_name || undefined,
        image_url: e.image_url || undefined,
        fees: e.fees ? parseFloat(e.fees) : undefined,
        tags: Array.isArray(e.tags) ? e.tags : [],
        created_at: String(e.created_at || new Date().toISOString()),
      });
    } catch (error: any) {
      console.error('Error fetching event:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * GET /events/:eventId
   * Get a single event (public)
   */
  app.get("/events/:eventId", async (c) => {
    try {
      const { eventId } = c.req.param();

      const events = await query(
        `SELECT e.*, v.business_name as vendor_name, v.city as vendor_city
         FROM events e
         LEFT JOIN vendors v ON e.vendor_id = v.id
         WHERE e.id = $1`,
        [eventId]
      ).catch(() => ({ rows: [] }));

      if (events.rows.length === 0) {
        return c.json({ error: 'Event not found' }, 404);
      }

      const e = events.rows[0];

      return c.json({
        success: true,
        event: {
          id: String(e.id),
          title: String(e.name || ''),
          description: String(e.description || ''),
          category: e.category || 'other',
          organizer_name: e.vendor_name || 'Admin',
          organizer_type: e.vendor_id ? 'vendor' : 'admin',
          venue: typeof e.venue === 'object' ? (e.venue?.name || '') : String(e.venue || ''),
          address: typeof e.venue === 'object' ? (e.venue?.address || '') : '',
          city: e.vendor_city || '',
          start_date: String(e.event_date || ''),
          end_date: String(e.end_date || e.event_date || ''),
          start_time: String(e.start_time || ''),
          end_time: String(e.end_time || ''),
          image_url: e.image_url || undefined,
          registration_required: e.registration_required || false,
          registration_fee: e.fees ? parseFloat(e.fees) : 0,
          max_participants: e.max_attendees ? parseInt(e.max_attendees, 10) : undefined,
          registered_count: e.current_attendees ? parseInt(e.current_attendees, 10) : 0,
          is_featured: false,
          status: e.status || 'draft',
          tags: Array.isArray(e.tags) ? e.tags : [],
        },
      });
    } catch (error: any) {
      console.error('Error fetching event:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * GET /events/service/:serviceId
   * Get events related to a service
   */
  app.get("/events/service/:serviceId", async (c) => {
    try {
      const { serviceId } = c.req.param();

      // Get service to find vendor
      const services = await select('services', { id: serviceId });
      if (services.length === 0) {
        return c.json({ success: true, events: [] });
      }

      const service = services[0];
      const vendorId = service.vendor_id;

      // Get events for this vendor
      const events = await query(
        `SELECT e.*, v.business_name as vendor_name
         FROM events e
         LEFT JOIN vendors v ON e.vendor_id = v.id
         WHERE e.vendor_id = $1 AND e.status = 'published'
         ORDER BY e.event_date ASC, e.start_time ASC`,
        [vendorId]
      ).catch(() => ({ rows: [] }));

      return c.json({
        success: true,
        events: events.rows.map((e: any) => ({
          id: String(e.id),
          title: String(e.name || ''),
          description: String(e.description || ''),
          category: e.category || 'other',
          start_date: String(e.event_date || ''),
          end_date: String(e.end_date || e.event_date || ''),
          start_time: String(e.start_time || ''),
          end_time: String(e.end_time || ''),
          location: typeof e.venue === 'object' ? (e.venue?.address || JSON.stringify(e.venue)) : String(e.venue || ''),
          image_url: e.image_url || undefined,
          registration_fee: e.fees ? parseFloat(e.fees) : 0,
          max_participants: e.max_attendees ? parseInt(e.max_attendees, 10) : undefined,
          registered_count: e.current_attendees ? parseInt(e.current_attendees, 10) : 0,
          status: e.status || 'draft',
        })),
      });
    } catch (error: any) {
      console.error('Error fetching service events:', error);
      return c.json({ error: error.message }, 500);
    }
  });
}

