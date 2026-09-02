import type { Context } from 'hono';
import { dbDiscoverPublishedEvents, dbSelectPublishedEventById } from '../repos/events.repo';
import { mapPublicEvent } from './event-mappers';

export async function executeDiscoverEvents(c: Context) {
  try {
    const events = await dbDiscoverPublishedEvents({
      category: c.req.query('category') || undefined,
      city: c.req.query('city') || undefined,
      upcoming: c.req.query('upcoming') !== 'false',
    });
    return c.json({ success: true, events: events.map(mapPublicEvent), total: events.length });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
}

export async function executePublicEventDetail(c: Context) {
  try {
    const event = await dbSelectPublishedEventById(c.req.param('eventId'));
    if (!event) return c.json({ error: 'Event not found' }, 404);
    return c.json({ success: true, event: mapPublicEvent(event) });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
}
