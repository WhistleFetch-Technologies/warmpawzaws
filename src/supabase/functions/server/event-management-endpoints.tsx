/**
 * Event Management Endpoints
 * Handles events for shelters (adoption drives, fundraisers) and cafes (pet parties, meetups)
 */

import { Hono } from 'npm:hono';
import * as kv from './kv_store.tsx';

const app = new Hono();

// Event structure
interface Event {
  id: string;
  vendorId: string;
  vendorType: 'shelter' | 'cafe' | 'other';
  name: string;
  description: string;
  category: 'adoption_drive' | 'fundraiser' | 'awareness_campaign' | 'volunteer_drive' | 
            'pet_party' | 'meetup' | 'training_workshop' | 'contest' | 'other';
  eventDate: string;
  startTime: string;
  endTime: string;
  duration: number; // in minutes
  venue: {
    type: 'at_center' | 'external' | 'online';
    address?: string;
    coordinates?: {
      lat: number;
      lng: number;
    };
    capacity?: number;
    meetingLink?: string;
  };
  registrationRequired: boolean;
  registrationDeadline?: string;
  maxAttendees?: number;
  currentAttendees: number;
  fees?: number; // Entry fee if applicable
  status: 'draft' | 'published' | 'ongoing' | 'completed' | 'cancelled';
  imageUrl?: string;
  tags: string[];
  
  // Shelter-specific fields
  adoptionGoal?: number; // For adoption drives
  fundraisingGoal?: number; // For fundraisers
  amountRaised?: number;
  animalsAvailable?: number;
  animalsAdopted?: number;
  
  // Cafe-specific fields
  petFriendly?: boolean;
  allowedPets?: string[]; // ['dogs', 'cats', etc.]
  menu?: {
    name: string;
    price: number;
  }[];
  activities?: string[];
  
  // Common fields
  organizers?: string[];
  sponsors?: string[];
  specialGuests?: string[];
  requirements?: string[]; // What attendees need to bring
  notes?: string;
  
  createdAt: string;
  updatedAt: string;
}

// Event Registration structure
interface EventRegistration {
  id: string;
  eventId: string;
  vendorId: string;
  attendeeName: string;
  attendeeEmail: string;
  attendeePhone: string;
  numberOfPeople: number;
  pets?: {
    name: string;
    type: string;
    breed: string;
  }[];
  specialRequirements?: string;
  paymentStatus: 'pending' | 'paid' | 'waived';
  paymentAmount?: number;
  transactionId?: string;
  checkInStatus: 'pending' | 'checked_in' | 'no_show';
  checkInTime?: string;
  status: 'confirmed' | 'waitlist' | 'cancelled';
  createdAt: string;
  updatedAt: string;
}

/**
 * GET /vendor/events/:vendorId/list
 * Get all events for a vendor
 */
app.get('/:vendorId/list', async (c) => {
  try {
    const vendorId = c.req.param('vendorId');
    const { status, category, upcoming } = c.req.query();
    
    let events = await kv.getByPrefix<Event>(`event:${vendorId}:`);
    
    // Filter by status
    if (status) {
      events = events.filter(e => e.status === status);
    }
    
    // Filter by category
    if (category) {
      events = events.filter(e => e.category === category);
    }
    
    // Filter upcoming events
    if (upcoming === 'true') {
      const now = new Date();
      events = events.filter(e => new Date(e.eventDate) >= now && e.status !== 'completed');
    }
    
    // Sort by event date
    events.sort((a, b) => new Date(a.eventDate).getTime() - new Date(b.eventDate).getTime());
    
    // Calculate stats
    const stats = {
      total: events.length,
      upcoming: events.filter(e => new Date(e.eventDate) >= new Date() && e.status !== 'completed').length,
      ongoing: events.filter(e => e.status === 'ongoing').length,
      completed: events.filter(e => e.status === 'completed').length,
      totalAttendees: events.reduce((sum, e) => sum + e.currentAttendees, 0)
    };
    
    return c.json({
      success: true,
      events,
      stats
    });
  } catch (error) {
    console.error('Error fetching events:', error);
    return c.json({ 
      success: false, 
      error: 'Failed to fetch events',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * POST /vendor/events/:vendorId/create
 * Create a new event
 */
app.post('/:vendorId/create', async (c) => {
  try {
    const vendorId = c.req.param('vendorId');
    const body = await c.req.json();
    
    const eventId = `event-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date().toISOString();
    
    // Calculate duration if not provided
    let duration = body.duration;
    if (!duration && body.startTime && body.endTime) {
      const start = new Date(`2000-01-01 ${body.startTime}`);
      const end = new Date(`2000-01-01 ${body.endTime}`);
      duration = (end.getTime() - start.getTime()) / (1000 * 60);
    }
    
    const event: Event = {
      id: eventId,
      vendorId,
      vendorType: body.vendorType || 'other',
      name: body.name,
      description: body.description,
      category: body.category,
      eventDate: body.eventDate,
      startTime: body.startTime,
      endTime: body.endTime,
      duration,
      venue: body.venue,
      registrationRequired: body.registrationRequired || false,
      registrationDeadline: body.registrationDeadline,
      maxAttendees: body.maxAttendees,
      currentAttendees: 0,
      fees: body.fees,
      status: 'draft',
      imageUrl: body.imageUrl,
      tags: body.tags || [],
      
      // Shelter-specific
      adoptionGoal: body.adoptionGoal,
      fundraisingGoal: body.fundraisingGoal,
      amountRaised: 0,
      animalsAvailable: body.animalsAvailable,
      animalsAdopted: 0,
      
      // Cafe-specific
      petFriendly: body.petFriendly,
      allowedPets: body.allowedPets,
      menu: body.menu,
      activities: body.activities,
      
      // Common
      organizers: body.organizers,
      sponsors: body.sponsors,
      specialGuests: body.specialGuests,
      requirements: body.requirements,
      notes: body.notes,
      
      createdAt: now,
      updatedAt: now
    };
    
    await kv.set(`event:${vendorId}:${eventId}`, event);
    
    return c.json({
      success: true,
      event,
      message: 'Event created successfully'
    });
  } catch (error) {
    console.error('Error creating event:', error);
    return c.json({ 
      success: false, 
      error: 'Failed to create event',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * PUT /vendor/events/:vendorId/:eventId
 * Update an event
 */
app.put('/:vendorId/:eventId', async (c) => {
  try {
    const { vendorId, eventId } = c.req.param();
    const body = await c.req.json();
    
    const existing = await kv.get<Event>(`event:${vendorId}:${eventId}`);
    
    if (!existing) {
      return c.json({ 
        success: false, 
        error: 'Event not found' 
      }, 404);
    }
    
    const updated: Event = {
      ...existing,
      ...body,
      id: eventId,
      vendorId,
      updatedAt: new Date().toISOString()
    };
    
    await kv.set(`event:${vendorId}:${eventId}`, updated);
    
    return c.json({
      success: true,
      event: updated,
      message: 'Event updated successfully'
    });
  } catch (error) {
    console.error('Error updating event:', error);
    return c.json({ 
      success: false, 
      error: 'Failed to update event',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * PUT /vendor/events/:vendorId/:eventId/status
 * Update event status
 */
app.put('/:vendorId/:eventId/status', async (c) => {
  try {
    const { vendorId, eventId } = c.req.param();
    const { status } = await c.req.json();
    
    const event = await kv.get<Event>(`event:${vendorId}:${eventId}`);
    
    if (!event) {
      return c.json({ 
        success: false, 
        error: 'Event not found' 
      }, 404);
    }
    
    const updated: Event = {
      ...event,
      status,
      updatedAt: new Date().toISOString()
    };
    
    await kv.set(`event:${vendorId}:${eventId}`, updated);
    
    return c.json({
      success: true,
      event: updated,
      message: 'Event status updated'
    });
  } catch (error) {
    console.error('Error updating event status:', error);
    return c.json({ 
      success: false, 
      error: 'Failed to update event status',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * GET /vendor/events/:vendorId/:eventId/registrations
 * Get registrations for an event
 */
app.get('/:vendorId/:eventId/registrations', async (c) => {
  try {
    const { vendorId, eventId } = c.req.param();
    const { status } = c.req.query();
    
    let registrations = await kv.getByPrefix<EventRegistration>(`event-registration:${eventId}:`);
    
    if (status) {
      registrations = registrations.filter(r => r.status === status);
    }
    
    // Sort by registration date
    registrations.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    
    const stats = {
      total: registrations.length,
      confirmed: registrations.filter(r => r.status === 'confirmed').length,
      waitlist: registrations.filter(r => r.status === 'waitlist').length,
      checkedIn: registrations.filter(r => r.checkInStatus === 'checked_in').length,
      noShow: registrations.filter(r => r.checkInStatus === 'no_show').length,
      totalPeople: registrations.reduce((sum, r) => sum + r.numberOfPeople, 0)
    };
    
    return c.json({
      success: true,
      registrations,
      stats
    });
  } catch (error) {
    console.error('Error fetching registrations:', error);
    return c.json({ 
      success: false, 
      error: 'Failed to fetch registrations',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * POST /vendor/events/:vendorId/:eventId/register
 * Register for an event
 */
app.post('/:vendorId/:eventId/register', async (c) => {
  try {
    const { vendorId, eventId } = c.req.param();
    const body = await c.req.json();
    
    // Get event details
    const event = await kv.get<Event>(`event:${vendorId}:${eventId}`);
    
    if (!event) {
      return c.json({ 
        success: false, 
        error: 'Event not found' 
      }, 404);
    }
    
    // Check if event is full
    let status: 'confirmed' | 'waitlist' = 'confirmed';
    if (event.maxAttendees && event.currentAttendees >= event.maxAttendees) {
      status = 'waitlist';
    }
    
    const registrationId = `reg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date().toISOString();
    
    const registration: EventRegistration = {
      id: registrationId,
      eventId,
      vendorId,
      attendeeName: body.attendeeName,
      attendeeEmail: body.attendeeEmail,
      attendeePhone: body.attendeePhone,
      numberOfPeople: body.numberOfPeople || 1,
      pets: body.pets,
      specialRequirements: body.specialRequirements,
      paymentStatus: event.fees ? 'pending' : 'waived',
      paymentAmount: event.fees,
      transactionId: body.transactionId,
      checkInStatus: 'pending',
      status,
      createdAt: now,
      updatedAt: now
    };
    
    await kv.set(`event-registration:${eventId}:${registrationId}`, registration);
    
    // Update event attendee count if confirmed
    if (status === 'confirmed') {
      const updatedEvent: Event = {
        ...event,
        currentAttendees: event.currentAttendees + (body.numberOfPeople || 1),
        updatedAt: now
      };
      await kv.set(`event:${vendorId}:${eventId}`, updatedEvent);
    }
    
    return c.json({
      success: true,
      registration,
      message: status === 'confirmed' ? 'Registration confirmed' : 'Added to waitlist'
    });
  } catch (error) {
    console.error('Error registering for event:', error);
    return c.json({ 
      success: false, 
      error: 'Failed to register for event',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * PUT /vendor/events/:vendorId/:eventId/registrations/:registrationId/checkin
 * Check in attendee
 */
app.put('/:vendorId/:eventId/registrations/:registrationId/checkin', async (c) => {
  try {
    const { vendorId, eventId, registrationId } = c.req.param();
    
    const registration = await kv.get<EventRegistration>(`event-registration:${eventId}:${registrationId}`);
    
    if (!registration) {
      return c.json({ 
        success: false, 
        error: 'Registration not found' 
      }, 404);
    }
    
    const updated: EventRegistration = {
      ...registration,
      checkInStatus: 'checked_in',
      checkInTime: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    await kv.set(`event-registration:${eventId}:${registrationId}`, updated);
    
    return c.json({
      success: true,
      registration: updated,
      message: 'Attendee checked in successfully'
    });
  } catch (error) {
    console.error('Error checking in attendee:', error);
    return c.json({ 
      success: false, 
      error: 'Failed to check in attendee',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * GET /vendor/events/:vendorId/dashboard
 * Get comprehensive event dashboard data
 */
app.get('/:vendorId/dashboard', async (c) => {
  try {
    const vendorId = c.req.param('vendorId');
    
    const events = await kv.getByPrefix<Event>(`event:${vendorId}:`);
    
    const now = new Date();
    const upcoming = events.filter(e => new Date(e.eventDate) >= now && e.status !== 'completed');
    const ongoing = events.filter(e => e.status === 'ongoing');
    const completed = events.filter(e => e.status === 'completed');
    
    // Get all registrations for upcoming events
    const upcomingRegistrations = [];
    for (const event of upcoming) {
      const regs = await kv.getByPrefix<EventRegistration>(`event-registration:${event.id}:`);
      upcomingRegistrations.push(...regs);
    }
    
    const stats = {
      events: {
        total: events.length,
        upcoming: upcoming.length,
        ongoing: ongoing.length,
        completed: completed.length,
        draft: events.filter(e => e.status === 'draft').length
      },
      attendance: {
        totalRegistered: upcomingRegistrations.length,
        confirmed: upcomingRegistrations.filter(r => r.status === 'confirmed').length,
        waitlist: upcomingRegistrations.filter(r => r.status === 'waitlist').length
      },
      shelter: {
        totalAdoptions: completed.reduce((sum, e) => sum + (e.animalsAdopted || 0), 0),
        totalFundsRaised: completed.reduce((sum, e) => sum + (e.amountRaised || 0), 0)
      }
    };
    
    return c.json({
      success: true,
      stats,
      upcomingEvents: upcoming.slice(0, 5),
      ongoingEvents: ongoing
    });
  } catch (error) {
    console.error('Error fetching dashboard:', error);
    return c.json({ 
      success: false, 
      error: 'Failed to fetch dashboard',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * DELETE /vendor/events/:vendorId/:eventId
 * Delete an event
 * ✅ FIX: Priority 2 Gap #1 - Add DELETE endpoint
 */
app.delete('/:vendorId/:eventId', async (c) => {
  try {
    const { vendorId, eventId } = c.req.param();
    
    const event = await kv.get<Event>(`event:${vendorId}:${eventId}`);
    
    if (!event) {
      return c.json({ 
        success: false, 
        error: 'Event not found' 
      }, 404);
    }
    
    // Delete the event
    await kv.del(`event:${vendorId}:${eventId}`);
    
    // Delete all registrations for this event
    const registrations = await kv.getByPrefix<EventRegistration>(`event-registration:${eventId}:`);
    for (const registration of registrations) {
      await kv.del(`event-registration:${eventId}:${registration.id}`);
    }
    
    console.log(`✅ Event deleted successfully: ${eventId} with ${registrations.length} registrations`);
    
    return c.json({
      success: true,
      message: 'Event deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting event:', error);
    return c.json({ 
      success: false, 
      error: 'Failed to delete event',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

export default app;