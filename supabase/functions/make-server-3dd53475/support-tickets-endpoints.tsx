/**
 * SUPPORT TICKETS ENDPOINTS
 * ✅ SQL-ONLY: NO KV STORE
 * Customer support ticket system
 */

import { Hono } from "npm:hono";
import { getSupportTicketsRepository } from "../../lib/repositories/support-tickets.ts";
import { getCustomersRepository } from "../../lib/repositories/customers.ts";
import { getVendorsRepository } from "../../lib/repositories/vendors.ts";

export function registerSupportTicketsEndpoints(app: Hono) {
  const BASE = '/make-server-3dd53475';
  const ticketsRepo = getSupportTicketsRepository();
  const customersRepo = getCustomersRepository();
  const vendorsRepo = getVendorsRepository();

  // =============================================
  // CREATE TICKET
  // =============================================
  app.post(`${BASE}/support/tickets`, async (c) => {
    try {
      const body = await c.req.json();

      console.log(`[SUPPORT] Creating ticket (SQL)`);

      if (!body.subject || !body.description || !body.category) {
        return c.json({ 
          error: 'Subject, description, and category are required' 
        }, 400);
      }

      // Determine user type and ID
      let userId: string | undefined;
      let customerId: string | undefined;
      let vendorId: string | undefined;
      let staffId: string | undefined;

      if (body.customerId || body.phone) {
        const customer = body.customerId 
          ? await customersRepo.findById(body.customerId)
          : await customersRepo.findByPhone(body.phone);
        if (customer) {
          customerId = customer.id;
          userId = customer.userId;
        }
      }

      if (body.vendorId) {
        const vendor = await vendorsRepo.findById(body.vendorId);
        if (vendor) {
          vendorId = vendor.id;
          userId = vendor.userId;
        }
      }

      const ticket = await ticketsRepo.createTicket({
        customerId,
        vendorId,
        staffId: body.staffId,
        userId,
        subject: body.subject,
        description: body.description,
        category: body.category,
        priority: body.priority || 'medium',
        bookingId: body.bookingId,
        orderId: body.orderId,
        paymentId: body.paymentId,
        tags: body.tags || []
      });

      console.log(`✅ [SUPPORT] Created ticket: ${ticket.ticketId}`);

      return c.json({
        success: true,
        ticket,
        message: 'Ticket created successfully'
      });

    } catch (error) {
      console.error('[SUPPORT] Error:', error);
      return c.json({ error: 'Failed to create ticket' }, 500);
    }
  });

  // =============================================
  // GET USER TICKETS
  // =============================================
  app.get(`${BASE}/support/tickets`, async (c) => {
    try {
      const userId = c.req.query('userId');
      const customerId = c.req.query('customerId');
      const vendorId = c.req.query('vendorId');
      const status = c.req.query('status');

      if (!userId && !customerId && !vendorId) {
        return c.json({ error: 'userId, customerId, or vendorId is required' }, 400);
      }

      const searchId = userId || customerId || vendorId;
      const tickets = await ticketsRepo.getUserTickets(searchId!, status || undefined);

      return c.json({
        success: true,
        tickets,
        totalTickets: tickets.length
      });

    } catch (error) {
      console.error('[SUPPORT] Error:', error);
      return c.json({ error: 'Failed to fetch tickets' }, 500);
    }
  });

  // =============================================
  // GET TICKET BY ID
  // =============================================
  app.get(`${BASE}/support/tickets/:ticketId`, async (c) => {
    try {
      const { ticketId } = c.req.param();

      const ticket = await ticketsRepo.getTicketById(ticketId);

      if (!ticket) {
        return c.json({ error: 'Ticket not found' }, 404);
      }

      return c.json({
        success: true,
        ticket
      });

    } catch (error) {
      console.error('[SUPPORT] Error:', error);
      return c.json({ error: 'Failed to fetch ticket' }, 500);
    }
  });

  // =============================================
  // UPDATE TICKET
  // =============================================
  app.put(`${BASE}/support/tickets/:ticketId`, async (c) => {
    try {
      const { ticketId } = c.req.param();
      const body = await c.req.json();

      const updatedTicket = await ticketsRepo.updateTicket(ticketId, body);

      if (!updatedTicket) {
        return c.json({ error: 'Ticket not found or update failed' }, 404);
      }

      return c.json({
        success: true,
        ticket: updatedTicket,
        message: 'Ticket updated successfully'
      });

    } catch (error) {
      console.error('[SUPPORT] Error:', error);
      return c.json({ error: 'Failed to update ticket' }, 500);
    }
  });

  // =============================================
  // ASSIGN TICKET (Admin)
  // =============================================
  app.post(`${BASE}/support/tickets/:ticketId/assign`, async (c) => {
    try {
      const { ticketId } = c.req.param();
      const { assignedTo } = await c.req.json();

      if (!assignedTo) {
        return c.json({ error: 'assignedTo is required' }, 400);
      }

      const updatedTicket = await ticketsRepo.updateTicket(ticketId, {
        assignedTo,
        status: 'in_progress'
      });

      if (!updatedTicket) {
        return c.json({ error: 'Ticket not found' }, 404);
      }

      return c.json({
        success: true,
        ticket: updatedTicket,
        message: 'Ticket assigned successfully'
      });

    } catch (error) {
      console.error('[SUPPORT] Error:', error);
      return c.json({ error: 'Failed to assign ticket' }, 500);
    }
  });

  // =============================================
  // RESOLVE TICKET
  // =============================================
  app.post(`${BASE}/support/tickets/:ticketId/resolve`, async (c) => {
    try {
      const { ticketId } = c.req.param();
      const { resolution, resolvedBy } = await c.req.json();

      if (!resolution) {
        return c.json({ error: 'resolution is required' }, 400);
      }

      const updatedTicket = await ticketsRepo.updateTicket(ticketId, {
        resolution,
        resolvedBy,
        resolvedAt: new Date().toISOString(),
        status: 'resolved'
      });

      if (!updatedTicket) {
        return c.json({ error: 'Ticket not found' }, 404);
      }

      return c.json({
        success: true,
        ticket: updatedTicket,
        message: 'Ticket resolved successfully'
      });

    } catch (error) {
      console.error('[SUPPORT] Error:', error);
      return c.json({ error: 'Failed to resolve ticket' }, 500);
    }
  });

  // =============================================
  // GET ALL TICKETS (Admin)
  // =============================================
  app.get(`${BASE}/admin/support/tickets`, async (c) => {
    try {
      const status = c.req.query('status');
      const category = c.req.query('category');
      const priority = c.req.query('priority');
      const assignedTo = c.req.query('assignedTo');

      const tickets = await ticketsRepo.getAllTickets({
        status: status || undefined,
        category: category || undefined,
        priority: priority || undefined,
        assignedTo: assignedTo || undefined
      });

      return c.json({
        success: true,
        tickets,
        totalTickets: tickets.length
      });

    } catch (error) {
      console.error('[SUPPORT] Error:', error);
      return c.json({ error: 'Failed to fetch tickets' }, 500);
    }
  });
}

