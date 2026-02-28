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
 * 
 * Date: 2025-01-28
 * Migration: Supabase to AWS Lambda
 * ============================================================================
 */

import { Hono } from 'hono';
import { select, insert, update, query } from '../database/rds-connection';
import { checkVendorCapability } from '../middleware/capability-enforcement';
import { normalizeDbRow, normalizeDbRows, extractEntityIds } from '../utils/entity-extractor';
import { isValidUUID } from '../types/entities';

// Utility function to generate booking reference
function generateBookingReference(): string {
  const date = new Date();
  const dateStr = date.toISOString().split('T')[0].replace(/-/g, '');
  const random = Math.floor(Math.random() * 1000000).toString().padStart(6, '0');
  return `EVT-${dateStr}-${random}`;
}

// Utility function to generate QR code data
function generateQRCodeData(registrationId: string, bookingReference: string, eventId: string, customerName: string): string {
  return JSON.stringify({
    type: 'event_registration',
    registrationId,
    bookingReference,
    eventId,
    customerName,
    timestamp: new Date().toISOString(),
  });
}

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
   * Create a new event (vendor endpoint - requires vendor authentication)
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
        created_by: 'vendor',
        approval_status: 'pending', // Vendor events need approval
      });

      return c.json({
        success: true,
        event: event[0],
        message: 'Event created successfully. Waiting for admin approval.',
      });
    } catch (error: any) {
      console.error('Error creating event:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * POST /vendor/events
   * Create event as vendor (explicit vendor endpoint)
   * Requires 'events' capability
   */
  app.post("/vendor/events", async (c) => {
    try {
      // Get vendor ID from auth token or request
      const vendorId = c.req.header('x-vendor-id') || (await c.req.json()).vendorId;
      
      if (!vendorId) {
        return c.json({ error: 'Vendor ID is required' }, 400);
      }

      // Check if vendor has events capability
      const hasEventsCapability = await checkVendorCapability(vendorId, 'events');
      if (!hasEventsCapability) {
        return c.json({ error: 'Vendor does not have events management capability' }, 403);
      }

      const eventData = await c.req.json();
      const {
        name,
        description,
        category,
        eventDate,
        startTime,
        endTime,
        venue,
        registrationRequired,
        maxAttendees,
        maxBookings,
        fees,
        pricePerBooking,
        imageUrl,
        tags,
        inclusions,
        exclusions,
        termsAndConditions,
        cancellationPolicy,
        refundPolicy,
        registrationRules,
      } = eventData;

      if (!name || !eventDate || !startTime) {
        return c.json({ error: 'name, eventDate, and startTime are required' }, 400);
      }

      // Build venue object with proper structure
      const venueObj = typeof venue === 'string' 
        ? { address: venue }
        : venue || {};

      const event = await insert('events', {
        vendor_id: vendorId,
        name,
        description: description || null,
        category: category || 'other',
        event_date: eventDate,
        start_time: startTime,
        end_time: endTime || null,
        venue: venueObj,
        registration_required: registrationRequired !== false,
        max_attendees: maxAttendees || null,
        max_bookings: maxBookings || maxAttendees || null,
        fees: fees || pricePerBooking || null,
        price_per_booking: pricePerBooking || fees || null,
        image_url: imageUrl || null,
        tags: tags || [],
        inclusions: inclusions || [],
        exclusions: exclusions || [],
        terms_and_conditions: termsAndConditions || null,
        cancellation_policy: cancellationPolicy || null,
        refund_policy: refundPolicy || null,
        registration_rules: registrationRules || {},
        status: 'draft',
        current_attendees: 0,
        created_by: 'vendor',
        approval_status: 'pending',
      });

      return c.json({
        success: true,
        event: event[0],
        message: 'Event created successfully. Waiting for admin approval.',
      });
    } catch (error: any) {
      console.error('Error creating vendor event:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * GET /vendor/events
   * Get vendor's events
   * Requires 'events' capability
   */
  app.get("/vendor/events", async (c) => {
    try {
      const vendorId = c.req.query('vendorId') || c.req.header('x-vendor-id');
      const status = c.req.query('status');
      const approvalStatus = c.req.query('approvalStatus');

      if (!vendorId) {
        return c.json({ error: 'Vendor ID is required' }, 400);
      }

      // Check if vendor has events capability
      const hasEventsCapability = await checkVendorCapability(vendorId, 'events');
      if (!hasEventsCapability) {
        return c.json({ error: 'Vendor does not have events management capability' }, 403);
      }

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

      if (approvalStatus) {
        eventsQuery += ` AND approval_status = $${paramIndex}`;
        params.push(approvalStatus);
        paramIndex++;
      }

      eventsQuery += ` ORDER BY event_date DESC, created_at DESC`;

      const events = await query(eventsQuery, params).catch(() => ({ rows: [] }));

      return c.json({
        success: true,
        events: events.rows,
        total: events.rows.length,
      });
    } catch (error: any) {
      console.error('Error fetching vendor events:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * PUT /vendor/events/:eventId
   * Update vendor's event (only if pending or draft)
   * Requires 'events' capability
   */
  app.put("/vendor/events/:eventId", async (c) => {
    try {
      const { eventId } = c.req.param();
      const vendorId = c.req.header('x-vendor-id') || (await c.req.json()).vendorId;
      const eventData = await c.req.json();

      if (!vendorId) {
        return c.json({ error: 'Vendor ID is required' }, 400);
      }

      // Check if vendor has events capability
      const hasEventsCapability = await checkVendorCapability(vendorId, 'events');
      if (!hasEventsCapability) {
        return c.json({ error: 'Vendor does not have events management capability' }, 403);
      }

      // Check if event exists and belongs to vendor
      const existingEvents = await select('events', { id: eventId, vendor_id: vendorId });
      if (existingEvents.length === 0) {
        return c.json({ error: 'Event not found or access denied' }, 404);
      }

      const existingEvent = existingEvents[0];

      // Only allow updates if pending approval or draft
      if (existingEvent.approval_status === 'approved' && existingEvent.status !== 'draft') {
        return c.json({ error: 'Cannot update approved/published events. Contact admin for changes.' }, 403);
      }

      const updateData: any = {};
      if (eventData.name !== undefined) updateData.name = eventData.name;
      if (eventData.description !== undefined) updateData.description = eventData.description;
      if (eventData.category !== undefined) updateData.category = eventData.category;
      if (eventData.event_date !== undefined) updateData.event_date = eventData.event_date;
      if (eventData.start_time !== undefined) updateData.start_time = eventData.start_time;
      if (eventData.end_time !== undefined) updateData.end_time = eventData.end_time;
      if (eventData.venue !== undefined) {
        updateData.venue = typeof eventData.venue === 'string' ? { address: eventData.venue } : eventData.venue;
      }
      if (eventData.max_attendees !== undefined) {
        updateData.max_attendees = eventData.max_attendees;
        updateData.registration_required = eventData.max_attendees ? true : false;
      }
      if (eventData.max_bookings !== undefined) updateData.max_bookings = eventData.max_bookings;
      if (eventData.price_per_booking !== undefined) updateData.price_per_booking = eventData.price_per_booking;
      if (eventData.fees !== undefined) {
        updateData.fees = eventData.fees;
        if (!updateData.price_per_booking) updateData.price_per_booking = eventData.fees;
      }
      if (eventData.inclusions !== undefined) updateData.inclusions = eventData.inclusions;
      if (eventData.exclusions !== undefined) updateData.exclusions = eventData.exclusions;
      if (eventData.terms_and_conditions !== undefined) updateData.terms_and_conditions = eventData.terms_and_conditions;
      if (eventData.cancellation_policy !== undefined) updateData.cancellation_policy = eventData.cancellation_policy;
      if (eventData.refund_policy !== undefined) updateData.refund_policy = eventData.refund_policy;
      if (eventData.registration_rules !== undefined) updateData.registration_rules = eventData.registration_rules;
      if (eventData.image_url !== undefined) updateData.image_url = eventData.image_url;
      if (eventData.tags !== undefined) updateData.tags = eventData.tags;

      // If updating, reset approval status to pending
      if (existingEvent.approval_status === 'approved') {
        updateData.approval_status = 'pending';
      }

      await update('events', { id: eventId, vendor_id: vendorId }, updateData);

      const updatedEvents = await select('events', { id: eventId });
      return c.json({
        success: true,
        event: updatedEvents[0],
        message: 'Event updated successfully',
      });
    } catch (error: any) {
      console.error('Error updating vendor event:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * POST /vendor/events/:eventId/submit
   * Submit event for approval
   */
  app.post("/vendor/events/:eventId/submit", async (c) => {
    try {
      const { eventId } = c.req.param();
      const vendorId = c.req.header('x-vendor-id') || (await c.req.json()).vendorId;

      if (!vendorId) {
        return c.json({ error: 'Vendor ID is required' }, 400);
      }

      const existingEvents = await select('events', { id: eventId, vendor_id: vendorId });
      if (existingEvents.length === 0) {
        return c.json({ error: 'Event not found or access denied' }, 404);
      }

      const event = existingEvents[0];

      if (event.approval_status === 'approved') {
        return c.json({ error: 'Event is already approved' }, 400);
      }

      await update('events', { id: eventId }, {
        approval_status: 'pending',
        status: 'draft', // Keep as draft until approved
      });

      return c.json({
        success: true,
        message: 'Event submitted for approval',
      });
    } catch (error: any) {
      console.error('Error submitting event:', error);
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
        AND e.approval_status = 'approved'
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

      // Check max bookings
      const maxBookings = event.max_bookings || event.max_attendees;
      if (maxBookings) {
        const currentBookings = await query(
          `SELECT COUNT(*) as count FROM event_registrations WHERE event_id = $1 AND status = 'confirmed'`,
          [eventId]
        ).catch(() => ({ rows: [{ count: 0 }] }));
        
        const currentCount = parseInt(currentBookings.rows[0]?.count || '0', 10);
        if (currentCount >= maxBookings) {
          return c.json({ error: 'Event is fully booked' }, 400);
        }
      }

      // Generate booking reference and QR code
      const bookingReference = generateBookingReference();
      
      // Determine payment amount
      const paymentAmount = event.price_per_booking || event.fees || 0;
      
      // Create registration
      const registration = await insert('event_registrations', {
        event_id: eventId,
        customer_id: customerId,
        vendor_id: event.vendor_id,
        attendee_name: attendeeName,
        attendee_email: attendeeEmail || null,
        attendee_phone: attendeePhone,
        number_of_people: numberOfPeople || 1,
        pets: pets || [],
        special_requirements: specialRequirements || null,
        payment_status: paymentAmount > 0 ? 'pending' : 'waived',
        payment_amount: paymentAmount > 0 ? paymentAmount : null,
        status: 'confirmed',
        booking_reference: bookingReference,
        qr_code: generateQRCodeData('', bookingReference, eventId, attendeeName), // Will update with actual registration ID
      });

      // Update QR code with actual registration ID
      const registrationId = registration[0].id;
      const qrCodeData = generateQRCodeData(registrationId, bookingReference, eventId, attendeeName);
      await update('event_registrations', { id: registrationId }, { qr_code: qrCodeData });
      
      const finalRegistration = await select('event_registrations', { id: registrationId });

      // Update event attendee count
      await update('events',
        { id: eventId },
        { current_attendees: (event.current_attendees || 0) + 1 }
      );

      return c.json({
        success: true,
        registration: {
          ...finalRegistration[0],
          booking_reference: bookingReference,
          qr_code: qrCodeData,
        },
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
          event_name: String(r.event_title || ''),
          registered_at: String(r.created_at || new Date().toISOString()),
          status: r.status || 'confirmed',
          qr_code: r.qr_code || undefined,
          booking_reference: r.booking_reference || undefined,
          attendee_name: r.attendee_name || undefined,
          attendee_phone: r.attendee_phone || undefined,
          attendee_email: r.attendee_email || undefined,
          number_of_people: r.number_of_people || 1,
          payment_status: r.payment_status || undefined,
          payment_amount: r.payment_amount ? parseFloat(r.payment_amount) : undefined,
          check_in_status: r.check_in_status || undefined,
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

      // For admin-created events, vendor_id can be null (after migration 604)
      // If vendor_id is not provided, we'll set it to null for admin-created events
      const finalVendorId = vendor_id || null;
      
      if (!finalVendorId) {
        console.log('[Events] Creating admin event without vendor_id');
      }

      const event = await insert('events', {
        vendor_id: finalVendorId,
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

  /**
   * GET /admin/events/pending
   * Get events pending approval
   */
  app.get("/admin/events/pending", async (c) => {
    try {
      const events = await query(
        `SELECT e.*, v.business_name as vendor_name, v.city as vendor_city
         FROM events e
         LEFT JOIN vendors v ON e.vendor_id = v.id
         WHERE e.approval_status = 'pending'
         ORDER BY e.created_at ASC`,
        []
      ).catch(() => ({ rows: [] }));

      return c.json({
        success: true,
        events: events.rows,
        total: events.rows.length,
      });
    } catch (error: any) {
      console.error('Error fetching pending events:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * POST /admin/events/:eventId/approve
   * Approve an event
   */
  app.post("/admin/events/:eventId/approve", async (c) => {
    try {
      const { eventId } = c.req.param();
      const adminId = c.req.header('x-admin-id') || (await c.req.json()).adminId;

      const existingEvents = await select('events', { id: eventId });
      if (existingEvents.length === 0) {
        return c.json({ error: 'Event not found' }, 404);
      }

      const event = existingEvents[0];

      if (event.approval_status === 'approved') {
        return c.json({ error: 'Event is already approved' }, 400);
      }

      await update('events', { id: eventId }, {
        approval_status: 'approved',
        status: 'published', // Auto-publish when approved
        reviewed_by: adminId || null,
        reviewed_at: new Date().toISOString(),
        rejection_reason: null,
      });

      return c.json({
        success: true,
        message: 'Event approved and published successfully',
      });
    } catch (error: any) {
      console.error('Error approving event:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * POST /admin/events/:eventId/reject
   * Reject an event
   */
  app.post("/admin/events/:eventId/reject", async (c) => {
    try {
      const { eventId } = c.req.param();
      const { reason } = await c.req.json();
      const adminId = c.req.header('x-admin-id') || (await c.req.json()).adminId;

      if (!reason) {
        return c.json({ error: 'Rejection reason is required' }, 400);
      }

      const existingEvents = await select('events', { id: eventId });
      if (existingEvents.length === 0) {
        return c.json({ error: 'Event not found' }, 404);
      }

      await update('events', { id: eventId }, {
        approval_status: 'rejected',
        status: 'draft',
        reviewed_by: adminId || null,
        reviewed_at: new Date().toISOString(),
        rejection_reason: reason,
      });

      return c.json({
        success: true,
        message: 'Event rejected successfully',
      });
    } catch (error: any) {
      console.error('Error rejecting event:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * GET /events/verify/:bookingReference
   * Verify booking by reference number (for vendor/admin check-in)
   */
  app.get("/events/verify/:bookingReference", async (c) => {
    try {
      const { bookingReference } = c.req.param();

      const registrations = await query(
        `SELECT r.*, e.name as event_name, e.event_date, e.start_time, e.end_time, 
                e.venue, v.business_name as vendor_name, c.name as customer_name
         FROM event_registrations r
         INNER JOIN events e ON r.event_id = e.id
         LEFT JOIN vendors v ON e.vendor_id = v.id
         LEFT JOIN customers c ON r.customer_id = c.id
         WHERE r.booking_reference = $1`,
        [bookingReference]
      ).catch(() => ({ rows: [] }));

      if (registrations.rows.length === 0) {
        return c.json({ error: 'Booking not found' }, 404);
      }

      const registration = registrations.rows[0];

      return c.json({
        success: true,
        registration: {
          id: registration.id,
          booking_reference: registration.booking_reference,
          attendee_name: registration.attendee_name,
          attendee_phone: registration.attendee_phone,
          attendee_email: registration.attendee_email,
          number_of_people: registration.number_of_people,
          check_in_status: registration.check_in_status,
          check_in_time: registration.check_in_time,
          payment_status: registration.payment_status,
          event: {
            id: registration.event_id,
            name: registration.event_name,
            event_date: registration.event_date,
            start_time: registration.start_time,
            end_time: registration.end_time,
            venue: registration.venue,
            vendor_name: registration.vendor_name,
          },
        },
      });
    } catch (error: any) {
      console.error('Error verifying booking:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * POST /events/registrations/:registrationId/check-in
   * Check in a customer (vendor/admin)
   * Vendor requires 'events' capability
   */
  app.post("/events/registrations/:registrationId/check-in", async (c) => {
    try {
      const { registrationId } = c.req.param();
      const checkedInBy = c.req.header('x-vendor-id') || c.req.header('x-admin-id') || (await c.req.json()).checkedInBy;
      const isAdmin = c.req.header('x-admin-id');

      // If vendor, check capability
      if (!isAdmin && checkedInBy) {
        const hasEventsCapability = await checkVendorCapability(checkedInBy, 'events');
        if (!hasEventsCapability) {
          return c.json({ error: 'Vendor does not have events management capability' }, 403);
        }
      }

      const existingRegistrations = await select('event_registrations', { id: registrationId });
      if (existingRegistrations.length === 0) {
        return c.json({ error: 'Registration not found' }, 404);
      }

      const registration = existingRegistrations[0];

      if (registration.check_in_status === 'checked_in') {
        return c.json({ error: 'Customer already checked in' }, 400);
      }

      await update('event_registrations', { id: registrationId }, {
        check_in_status: 'checked_in',
        check_in_time: new Date().toISOString(),
        checked_in_by: checkedInBy || null,
      });

      return c.json({
        success: true,
        message: 'Customer checked in successfully',
        check_in_time: new Date().toISOString(),
      });
    } catch (error: any) {
      console.error('Error checking in customer:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * GET /vendor/events/:eventId/registrations
   * Get registrations for vendor's event
   * Requires 'events' capability
   */
  app.get("/vendor/events/:eventId/registrations", async (c) => {
    try {
      const { eventId } = c.req.param();
      const vendorId = c.req.header('x-vendor-id') || c.req.query('vendorId');

      if (!vendorId) {
        return c.json({ error: 'Vendor ID is required' }, 400);
      }

      // Check if vendor has events capability
      const hasEventsCapability = await checkVendorCapability(vendorId, 'events');
      if (!hasEventsCapability) {
        return c.json({ error: 'Vendor does not have events management capability' }, 403);
      }

      // Verify event belongs to vendor
      const events = await select('events', { id: eventId, vendor_id: vendorId });
      if (events.length === 0) {
        return c.json({ error: 'Event not found or access denied' }, 404);
      }

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
      console.error('Error fetching event registrations:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * GET /events/registrations/:registrationId
   * Get registration details with QR code (customer)
   */
  app.get("/events/registrations/:registrationId", async (c) => {
    try {
      const { registrationId } = c.req.param();
      const customerId = c.req.query('customerId') || c.req.header('x-customer-id');

      const registrations = await query(
        `SELECT r.*, e.name as event_name, e.event_date, e.start_time, e.end_time, 
                e.venue, e.category, v.business_name as vendor_name
         FROM event_registrations r
         INNER JOIN events e ON r.event_id = e.id
         LEFT JOIN vendors v ON e.vendor_id = v.id
         WHERE r.id = $1 ${customerId ? 'AND r.customer_id = $2' : ''}`,
        customerId ? [registrationId, customerId] : [registrationId]
      ).catch(() => ({ rows: [] }));

      if (registrations.rows.length === 0) {
        return c.json({ error: 'Registration not found' }, 404);
      }

      const registration = registrations.rows[0];

      return c.json({
        success: true,
        registration: {
          id: registration.id,
          booking_reference: registration.booking_reference,
          qr_code: registration.qr_code,
          attendee_name: registration.attendee_name,
          attendee_phone: registration.attendee_phone,
          number_of_people: registration.number_of_people,
          check_in_status: registration.check_in_status,
          check_in_time: registration.check_in_time,
          payment_status: registration.payment_status,
          event: {
            id: registration.event_id,
            name: registration.event_name,
            event_date: registration.event_date,
            start_time: registration.start_time,
            end_time: registration.end_time,
            venue: registration.venue,
            category: registration.category,
            vendor_name: registration.vendor_name,
          },
        },
      });
    } catch (error: any) {
      console.error('Error fetching registration:', error);
      return c.json({ error: error.message }, 500);
    }
  });
}

