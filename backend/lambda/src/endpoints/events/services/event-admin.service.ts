import type { Context } from 'hono';
import {
  dbInsertEvent,
  dbListAdminEvents,
  dbListPendingEvents,
  dbSelectEventById,
  dbUpdateEvent,
} from '../repos/events.repo';
import { executeResolveAdminId } from './event-auth.service';
import { mapAdminEvent } from './event-mappers';

export async function executeAdminListEvents(c: Context) {
  try {
    const events = await dbListAdminEvents({
      status: c.req.query('status') || undefined,
      category: c.req.query('category') || undefined,
    });
    return c.json(events.map(mapAdminEvent));
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
}

export async function executeAdminPendingEvents(c: Context) {
  try {
    const events = await dbListPendingEvents();
    return c.json({ success: true, events: events.map(mapAdminEvent), total: events.length });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
}

export async function executeAdminGetEvent(c: Context) {
  try {
    const event = await dbSelectEventById(c.req.param('eventId'));
    if (!event) return c.json({ error: 'Event not found' }, 404);
    return c.json(mapAdminEvent(event));
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
}

export async function executeAdminCreateEvent(c: Context) {
  try {
    const eventData = await c.req.json();
    if (!eventData.title || !eventData.start_date || !eventData.start_time) {
      return c.json({ error: 'title, start_date, and start_time are required' }, 400);
    }
    const venue = typeof eventData.location === 'string' ? { address: eventData.location } : eventData.location || {};
    const event = await dbInsertEvent({
      vendor_id: eventData.vendor_id || null,
      name: eventData.title,
      description: eventData.description || null,
      category: eventData.category || 'other',
      event_date: eventData.start_date,
      end_date: eventData.end_date || eventData.start_date,
      start_time: eventData.start_time,
      end_time: eventData.end_time || null,
      venue,
      registration_required: eventData.max_participants ? true : false,
      max_attendees: eventData.max_participants || null,
      fees: eventData.fees || null,
      image_url: eventData.image_url || null,
      tags: eventData.tags || [],
      status: eventData.status || 'draft',
      current_attendees: 0,
      created_by: 'admin',
      approval_status: 'approved',
    });
    return c.json({ success: true, event, message: 'Event created successfully' });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
}

export async function executeAdminUpdateEvent(c: Context) {
  try {
    const eventId = c.req.param('eventId');
    const existing = await dbSelectEventById(eventId);
    if (!existing) return c.json({ error: 'Event not found' }, 404);
    const eventData = await c.req.json();
    const updateData: Record<string, unknown> = {};
    if (eventData.title !== undefined) updateData.name = eventData.title;
    if (eventData.description !== undefined) updateData.description = eventData.description;
    if (eventData.category !== undefined) updateData.category = eventData.category;
    if (eventData.start_date !== undefined) updateData.event_date = eventData.start_date;
    if (eventData.end_date !== undefined) updateData.end_date = eventData.end_date;
    if (eventData.start_time !== undefined) updateData.start_time = eventData.start_time;
    if (eventData.end_time !== undefined) updateData.end_time = eventData.end_time;
    if (eventData.location !== undefined) {
      updateData.venue = typeof eventData.location === 'string' ? { address: eventData.location } : eventData.location;
    }
    if (eventData.max_participants !== undefined) updateData.max_attendees = eventData.max_participants;
    if (eventData.vendor_id !== undefined) updateData.vendor_id = eventData.vendor_id;
    if (eventData.image_url !== undefined) updateData.image_url = eventData.image_url;
    if (eventData.fees !== undefined) updateData.fees = eventData.fees;
    if (eventData.tags !== undefined) updateData.tags = eventData.tags;
    if (eventData.status !== undefined) updateData.status = eventData.status;
    await dbUpdateEvent(eventId, updateData);
    const updated = await dbSelectEventById(eventId);
    return c.json({ success: true, event: mapAdminEvent(updated || {}), message: 'Event updated successfully' });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
}

export async function executeAdminDeleteEvent(c: Context) {
  try {
    const eventId = c.req.param('eventId');
    const existing = await dbSelectEventById(eventId);
    if (!existing) return c.json({ error: 'Event not found' }, 404);
    await dbUpdateEvent(eventId, { status: 'cancelled' });
    return c.json({ success: true, message: 'Event deleted successfully' });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
}

export async function executeApproveEvent(c: Context) {
  if (!executeResolveAdminId(c)) return c.json({ error: 'Admin authentication required' }, 401);
  try {
    const eventId = c.req.param('eventId');
    const existing = await dbSelectEventById(eventId);
    if (!existing) return c.json({ error: 'Event not found' }, 404);
    if (existing.approval_status === 'approved') return c.json({ error: 'Event is already approved' }, 400);
    const adminId = executeResolveAdminId(c);
    await dbUpdateEvent(eventId, {
      approval_status: 'approved',
      status: 'published',
      reviewed_by: null,
      reviewed_at: new Date().toISOString(),
      rejection_reason: null,
    });
    return c.json({
      success: true,
      message: 'Event approved and published successfully',
      reviewed_by_actor: adminId,
    });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
}

export async function executeRejectEvent(c: Context) {
  if (!executeResolveAdminId(c)) return c.json({ error: 'Admin authentication required' }, 401);
  try {
    const eventId = c.req.param('eventId');
    const body = await c.req.json();
    if (!body.reason) return c.json({ error: 'Rejection reason is required' }, 400);
    const existing = await dbSelectEventById(eventId);
    if (!existing) return c.json({ error: 'Event not found' }, 404);
    const adminId = executeResolveAdminId(c);
    await dbUpdateEvent(eventId, {
      approval_status: 'rejected',
      status: 'draft',
      reviewed_by: null,
      reviewed_at: new Date().toISOString(),
      rejection_reason: body.reason,
    });
    return c.json({ success: true, message: 'Event rejected successfully', reviewed_by_actor: adminId });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
}
