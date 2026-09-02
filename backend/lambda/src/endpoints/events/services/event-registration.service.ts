import { randomBytes } from 'crypto';
import type { Context } from 'hono';
import { withTransaction } from '../../../database/rds-connection';
import {
  dbIncrementAttendees,
  dbLockEventForCapacity,
  dbSelectPublishedEventById,
} from '../repos/events.repo';
import {
  dbCountActiveTicketsForEvent,
  dbInsertRegistration,
  dbListCustomerRegistrations,
  dbListEventRegistrations,
  dbLockRegistration,
  dbSelectCustomerById,
  dbSelectPetOwned,
  dbSelectPetsByCustomer,
  dbSelectRegistrationById,
  dbUpdateRegistration,
} from '../repos/event-registrations.repo';
import { dbInsertTickets, dbListTicketsForRegistration, dbListTicketsForRegistrations } from '../repos/event-tickets.repo';
import { dbListRefundsForPayment } from '../repos/event-payments.repo';
import { executeResolveCustomerId, executeRequireVendorEvents } from './event-auth.service';
import { petSnapshot, prefillDeclarations } from './event-mappers';
import { notifyEventCustomer } from './event-notifications.service';

function bookingReference(): string {
  const dateStr = new Date().toISOString().split('T')[0].replace(/-/g, '');
  return `EVT-${dateStr}-${Math.floor(Math.random() * 1000000).toString().padStart(6, '0')}`;
}

export async function executePrefillPets(c: Context) {
  const customerId = await executeResolveCustomerId(c);
  if (!customerId) return c.json({ error: 'Authentication required' }, 401);
  try {
    const pets = await dbSelectPetsByCustomer(customerId);
    return c.json({
      success: true,
      pets: pets.map((pet) => ({
        ...pet,
        declarations: prefillDeclarations(pet),
      })),
    });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
}

export async function executeRegisterForEvent(c: Context) {
  const customerId = await executeResolveCustomerId(c);
  if (!customerId) return c.json({ error: 'Authentication required' }, 401);
  try {
    const eventId = c.req.param('eventId');
    const body = await c.req.json();
    const ticketQuantity = Math.max(1, parseInt(String(body.ticketQuantity || body.numberOfPeople || 1), 10));
    const assignments: Array<{ petId: string; declarations?: Record<string, unknown> }> = body.tickets || [];
    if (assignments.length !== ticketQuantity) {
      return c.json({ error: 'Each ticket must be assigned exactly one pet' }, 400);
    }
    const petIds = assignments.map((a) => String(a.petId || ''));
    if (new Set(petIds).size !== petIds.length) {
      return c.json({ error: 'The same pet cannot be assigned to multiple tickets' }, 400);
    }

    const customer = await dbSelectCustomerById(customerId);
    if (!customer) return c.json({ error: 'Customer profile not found' }, 400);

    const pets: Record<string, Record<string, unknown>> = {};
    for (const petId of petIds) {
      const pet = await dbSelectPetOwned(petId, customerId);
      if (!pet) return c.json({ error: 'Pet not found or not owned by customer' }, 403);
      pets[petId] = pet;
    }

    const event = await dbSelectPublishedEventById(eventId);
    if (!event) return c.json({ error: 'Event not found or not published' }, 404);

    const paymentAmount = Number(event.price_per_booking ?? event.fees ?? 0) * ticketQuantity;
    const waived = paymentAmount <= 0;

    const registration = await withTransaction(async (client) => {
      const locked = await dbLockEventForCapacity(client, eventId);
      if (!locked || String(locked.status) !== 'published' || String(locked.approval_status) !== 'approved') {
        throw Object.assign(new Error('Event not found or not published'), { status: 404 });
      }
      const capacity = Number(locked.max_bookings || locked.max_attendees || 0);
      const used = await dbCountActiveTicketsForEvent(client, eventId);
      if (capacity > 0 && used + ticketQuantity > capacity) {
        throw Object.assign(new Error('Event is fully booked'), { status: 400 });
      }

      const created = await dbInsertRegistration(client, {
        event_id: eventId,
        customer_id: customerId,
        vendor_id: locked.vendor_id || null,
        attendee_name: customer.name || customer.full_name || body.attendeeName || 'Customer',
        attendee_email: customer.email || body.attendeeEmail || null,
        attendee_phone: customer.phone || body.attendeePhone || '',
        number_of_people: ticketQuantity,
        pets: assignments.map((a) => ({ pet_id: a.petId })),
        special_requirements: body.specialRequirements || null,
        payment_status: waived ? 'waived' : 'pending',
        payment_amount: waived ? null : paymentAmount,
        status: waived ? 'confirmed' : 'pending_payment',
        booking_reference: bookingReference(),
      });

      const tickets = await dbInsertTickets(
        client,
        assignments.map((assignment, index) => {
          const pet = pets[assignment.petId];
          const prefilled = prefillDeclarations(pet);
          const declared = assignment.declarations || {};
          return {
            registration_id: created.id,
            ticket_index: index + 1,
            pet_id: assignment.petId,
            pet_snapshot: JSON.stringify(petSnapshot(pet)),
            declarations: JSON.stringify({
              vaccinated: declared.vaccinated ?? prefilled.vaccinated,
              social: declared.social ?? prefilled.social,
              trained: declared.trained ?? prefilled.trained,
              sources: prefilled.sources,
            }),
            qr_token: waived ? randomBytes(32).toString('hex') : null,
            check_in_status: 'pending',
          };
        })
      );

      await dbIncrementAttendees(client, eventId, ticketQuantity);
      return { created, tickets };
    });

    if (waived) {
      await notifyEventCustomer({
        customerId,
        type: 'event_booking_confirmation',
        title: 'Event tickets ready',
        message: `You are registered for ${event.name || 'the event'}. Your QR tickets are available.`,
        registrationId: String(registration.created.id),
        eventId,
      });
    }

    return c.json({
      success: true,
      registration: {
        ...registration.created,
        tickets: waived ? registration.tickets : registration.tickets.map((t) => ({ ...t, qr_token: undefined })),
        requires_payment: !waived,
      },
      message: waived ? 'Registered successfully' : 'Registration created. Complete payment to receive tickets.',
    });
  } catch (error: any) {
    return c.json({ error: error.message }, error.status || 500);
  }
}

export async function executeMyRegistrations(c: Context) {
  const customerId = await executeResolveCustomerId(c);
  if (!customerId) return c.json({ success: true, registrations: [] });
  try {
    const rows = await dbListCustomerRegistrations(customerId);
    const tickets = await dbListTicketsForRegistrations(rows.map((r) => String(r.id)));
    const ticketsByReg = new Map<string, typeof tickets>();
    for (const ticket of tickets) {
      const key = String(ticket.registration_id);
      const list = ticketsByReg.get(key) || [];
      list.push(ticket);
      ticketsByReg.set(key, list);
    }
    return c.json({
      success: true,
      registrations: rows.map((r) => ({
        id: String(r.id),
        event_id: String(r.event_id),
        event_title: String(r.event_title || ''),
        event_name: String(r.event_title || ''),
        registered_at: String(r.created_at || new Date().toISOString()),
        status: r.status || 'confirmed',
        booking_reference: r.booking_reference || undefined,
        attendee_name: r.attendee_name || undefined,
        number_of_people: r.number_of_people || 1,
        payment_status: r.payment_status || undefined,
        payment_amount: r.payment_amount ? parseFloat(String(r.payment_amount)) : undefined,
        check_in_status: r.check_in_status || undefined,
        event_date: String(r.event_date || ''),
        start_time: String(r.start_time || ''),
        end_time: String(r.end_time || ''),
        tickets: (r.payment_status === 'paid' || r.payment_status === 'waived'
          ? ticketsByReg.get(String(r.id)) || []
          : (ticketsByReg.get(String(r.id)) || []).map((t) => ({ ...t, qr_token: undefined }))),
      })),
    });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
}

export async function executeGetRegistration(c: Context) {
  const customerId = await executeResolveCustomerId(c);
  if (!customerId) return c.json({ error: 'Authentication required' }, 401);
  try {
    const registration = await dbSelectRegistrationById(c.req.param('registrationId'));
    if (!registration || String(registration.customer_id) !== customerId) {
      return c.json({ error: 'Registration not found' }, 404);
    }
    const tickets = await dbListTicketsForRegistration(String(registration.id));
    const paid = registration.payment_status === 'paid' || registration.payment_status === 'waived';
    return c.json({
      success: true,
      registration: {
        ...registration,
        qr_code: undefined,
        tickets: paid ? tickets : tickets.map((t) => ({ ...t, qr_token: undefined })),
      },
    });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
}

export async function executeVendorEventRegistrations(c: Context) {
  const auth = await executeRequireVendorEvents(c);
  if (!auth.ok) return c.json({ error: auth.error }, auth.status);
  try {
    const eventId = c.req.param('eventId');
    const { dbSelectEventById } = await import('../repos/events.repo');
    const event = await dbSelectEventById(eventId);
    if (!event || String(event.vendor_id) !== auth.vendorId) {
      return c.json({ error: 'Event not found or access denied' }, 404);
    }
    const registrations = await dbListEventRegistrations(eventId);
    const tickets = await dbListTicketsForRegistrations(registrations.map((r) => String(r.id)));
    return c.json({ success: true, registrations, tickets, total: registrations.length });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
}

export async function executeAdminEventRegistrations(c: Context) {
  const { executeResolveAdminId } = await import('./event-auth.service');
  if (!executeResolveAdminId(c)) return c.json({ error: 'Admin authentication required' }, 401);
  try {
    const eventId = c.req.param('eventId');
    const registrations = await dbListEventRegistrations(eventId);
    const tickets = await dbListTicketsForRegistrations(registrations.map((r) => String(r.id)));
    const refunds: Record<string, unknown[]> = {};
    for (const row of registrations) {
      if (row.payment_id) {
        refunds[String(row.id)] = await dbListRefundsForPayment(String(row.payment_id));
      }
    }
    return c.json({ success: true, registrations, tickets, refunds, total: registrations.length });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
}

export { dbLockRegistration, dbUpdateRegistration, bookingReference };
