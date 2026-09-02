import type { Context } from 'hono';
import { withTransaction } from '../../../database/rds-connection';
import { dbFindTicketByToken, dbLockTicket, dbMarkTicketCheckedIn } from '../repos/event-tickets.repo';
import { executeRequireVendorEvents, executeResolveAdminId } from './event-auth.service';

export async function executeVerifyTicket(c: Context) {
  const auth = await executeRequireVendorEvents(c);
  const adminId = executeResolveAdminId(c);
  if (!auth.ok && !adminId) return c.json({ error: 'Authentication required' }, 401);
  try {
    const token = c.req.param('bookingReference') || c.req.query('token') || '';
    const ticket = await dbFindTicketByToken(token);
    if (!ticket) return c.json({ error: 'Ticket not found' }, 404);
    if (auth.ok && String(ticket.event_vendor_id || ticket.vendor_id) !== auth.vendorId) {
      return c.json({ error: 'Ticket does not belong to this vendor' }, 403);
    }
    return c.json({
      success: true,
      ticket: {
        id: ticket.id,
        ticket_index: ticket.ticket_index,
        check_in_status: ticket.check_in_status,
        payment_status: ticket.payment_status,
        booking_reference: ticket.booking_reference,
        event: { id: ticket.event_id, name: ticket.event_name },
        pet_snapshot: ticket.pet_snapshot,
        declarations: ticket.declarations,
      },
    });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
}

export async function executeCheckInTicket(c: Context) {
  const auth = await executeRequireVendorEvents(c);
  const adminId = executeResolveAdminId(c);
  if (!auth.ok && !adminId) return c.json({ error: 'Authentication required' }, 401);
  try {
    const body = await c.req.json().catch(() => ({} as Record<string, unknown>));
    let ticketId = String(c.req.param('ticketId') || body.ticketId || body.ticket_id || '');
    if (!ticketId) {
      const registrationId = String(c.req.param('registrationId') || '');
      if (!registrationId) return c.json({ error: 'Ticket id is required' }, 400);
      const { dbListTicketsForRegistration } = await import('../repos/event-tickets.repo');
      const tickets = await dbListTicketsForRegistration(registrationId);
      if (tickets.length === 1) ticketId = String(tickets[0].id);
      else return c.json({ error: 'ticketId is required when a registration has multiple tickets' }, 400);
    }
    const actorId = auth.ok ? auth.vendorId : String(adminId);
    const result = await withTransaction(async (client) => {
      const ticket = await dbLockTicket(client, ticketId);
      if (!ticket) return { status: 404 as const, error: 'Ticket not found' };
      if (auth.ok && String(ticket.event_vendor_id || ticket.vendor_id) !== auth.vendorId) {
        return { status: 403 as const, error: 'Ticket does not belong to this vendor' };
      }
      if (ticket.registration_status === 'cancelled') {
        return { status: 400 as const, error: 'Registration is cancelled' };
      }
      if (!['paid', 'waived'].includes(String(ticket.payment_status))) {
        return { status: 400 as const, error: 'Ticket is not paid' };
      }
      if (ticket.check_in_status === 'checked_in') {
        return {
          status: 200 as const,
          already_checked_in: true,
          check_in_time: ticket.check_in_time,
        };
      }
      await dbMarkTicketCheckedIn(client, String(ticket.id), actorId);
      return { status: 200 as const, already_checked_in: false };
    });
    if ('error' in result) return c.json({ error: result.error }, result.status);
    return c.json({
      success: true,
      already_checked_in: result.already_checked_in === true,
      message: result.already_checked_in ? 'already_checked_in' : 'Customer checked in successfully',
      check_in_time: result.check_in_time || new Date().toISOString(),
    });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
}
