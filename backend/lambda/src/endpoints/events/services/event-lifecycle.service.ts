import type { Context } from 'hono';
import { dbInsertEvent, dbListVendorEvents, dbSelectEventById, dbUpdateEvent } from '../repos/events.repo';
import { executeRequireVendorEvents } from './event-auth.service';

export async function executeCreateVendorEvent(c: Context) {
  const auth = await executeRequireVendorEvents(c);
  if (!auth.ok) return c.json({ error: auth.error }, auth.status);
  try {
    const body = await c.req.json();
    const { name, eventDate, startTime } = body;
    if (!name || !eventDate || !startTime) {
      return c.json({ error: 'name, eventDate, and startTime are required' }, 400);
    }
    const venue = typeof body.venue === 'string' ? { address: body.venue } : body.venue || {};
    const event = await dbInsertEvent({
      vendor_id: auth.vendorId,
      name,
      description: body.description || null,
      category: body.category || 'other',
      event_date: eventDate,
      start_time: startTime,
      end_time: body.endTime || null,
      end_date: body.endDate || eventDate,
      venue,
      registration_required: body.registrationRequired !== false,
      max_attendees: body.maxAttendees || null,
      max_bookings: body.maxBookings || body.maxAttendees || null,
      fees: body.fees || body.pricePerBooking || null,
      price_per_booking: body.pricePerBooking || body.fees || null,
      image_url: body.imageUrl || null,
      tags: body.tags || [],
      inclusions: body.inclusions || [],
      exclusions: body.exclusions || [],
      terms_and_conditions: body.termsAndConditions || null,
      cancellation_policy: body.cancellationPolicy || null,
      refund_policy: body.refundPolicy || null,
      registration_rules: body.registrationRules || {},
      status: 'draft',
      current_attendees: 0,
      created_by: 'vendor',
      approval_status: 'draft',
    });
    return c.json({
      success: true,
      event,
      message: 'Event created successfully. Waiting for admin approval.',
    });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
}

export async function executeListVendorEvents(c: Context) {
  const auth = await executeRequireVendorEvents(c);
  if (!auth.ok) return c.json({ error: auth.error }, auth.status);
  try {
    const events = await dbListVendorEvents(auth.vendorId, {
      status: c.req.query('status') || undefined,
      approvalStatus: c.req.query('approvalStatus') || undefined,
    });
    return c.json({ success: true, events, total: events.length });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
}

export async function executeUpdateVendorEvent(c: Context) {
  const auth = await executeRequireVendorEvents(c);
  if (!auth.ok) return c.json({ error: auth.error }, auth.status);
  try {
    const eventId = c.req.param('eventId');
    const existing = await dbSelectEventById(eventId);
    if (!existing || String(existing.vendor_id) !== auth.vendorId) {
      return c.json({ error: 'Event not found or access denied' }, 404);
    }
    if (existing.approval_status === 'approved' && existing.status !== 'draft') {
      return c.json({ error: 'Cannot update approved/published events. Contact admin for changes.' }, 403);
    }
    const eventData = await c.req.json();
    const updateData: Record<string, unknown> = {};
    if (eventData.name !== undefined) updateData.name = eventData.name;
    if (eventData.description !== undefined) updateData.description = eventData.description;
    if (eventData.category !== undefined) updateData.category = eventData.category;
    if (eventData.event_date !== undefined || eventData.eventDate !== undefined) {
      updateData.event_date = eventData.event_date || eventData.eventDate;
    }
    if (eventData.start_time !== undefined || eventData.startTime !== undefined) {
      updateData.start_time = eventData.start_time || eventData.startTime;
    }
    if (eventData.end_time !== undefined || eventData.endTime !== undefined) {
      updateData.end_time = eventData.end_time || eventData.endTime;
    }
    if (eventData.venue !== undefined) {
      updateData.venue = typeof eventData.venue === 'string' ? { address: eventData.venue } : eventData.venue;
    }
    if (eventData.max_attendees !== undefined || eventData.maxAttendees !== undefined) {
      updateData.max_attendees = eventData.max_attendees ?? eventData.maxAttendees;
    }
    if (eventData.max_bookings !== undefined || eventData.maxBookings !== undefined) {
      updateData.max_bookings = eventData.max_bookings ?? eventData.maxBookings;
    }
    if (eventData.price_per_booking !== undefined || eventData.pricePerBooking !== undefined) {
      updateData.price_per_booking = eventData.price_per_booking ?? eventData.pricePerBooking;
    }
    if (eventData.fees !== undefined) updateData.fees = eventData.fees;
    if (eventData.inclusions !== undefined) updateData.inclusions = eventData.inclusions;
    if (eventData.exclusions !== undefined) updateData.exclusions = eventData.exclusions;
    if (eventData.terms_and_conditions !== undefined || eventData.termsAndConditions !== undefined) {
      updateData.terms_and_conditions = eventData.terms_and_conditions ?? eventData.termsAndConditions;
    }
    if (eventData.cancellation_policy !== undefined || eventData.cancellationPolicy !== undefined) {
      updateData.cancellation_policy = eventData.cancellation_policy ?? eventData.cancellationPolicy;
    }
    if (eventData.refund_policy !== undefined || eventData.refundPolicy !== undefined) {
      updateData.refund_policy = eventData.refund_policy ?? eventData.refundPolicy;
    }
    if (eventData.registration_rules !== undefined || eventData.registrationRules !== undefined) {
      updateData.registration_rules = eventData.registration_rules ?? eventData.registrationRules;
    }
    if (eventData.image_url !== undefined || eventData.imageUrl !== undefined) {
      updateData.image_url = eventData.image_url ?? eventData.imageUrl;
    }
    if (eventData.tags !== undefined) updateData.tags = eventData.tags;
    if (existing.approval_status === 'approved') updateData.approval_status = 'pending';
    await dbUpdateEvent(eventId, updateData);
    const updated = await dbSelectEventById(eventId);
    return c.json({ success: true, event: updated, message: 'Event updated successfully' });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
}

export async function executeSubmitVendorEvent(c: Context) {
  const auth = await executeRequireVendorEvents(c);
  if (!auth.ok) return c.json({ error: auth.error }, auth.status);
  try {
    const eventId = c.req.param('eventId');
    const existing = await dbSelectEventById(eventId);
    if (!existing || String(existing.vendor_id) !== auth.vendorId) {
      return c.json({ error: 'Event not found or access denied' }, 404);
    }
    if (existing.approval_status === 'approved') {
      return c.json({ error: 'Event is already approved' }, 400);
    }
    await dbUpdateEvent(eventId, { approval_status: 'pending', status: 'draft' });
    return c.json({ success: true, message: 'Event submitted for approval' });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
}
