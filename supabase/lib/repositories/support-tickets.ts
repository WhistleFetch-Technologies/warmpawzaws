/**
 * SUPPORT TICKETS REPOSITORY
 * SQL-based repository for support tickets
 * NO KV STORE - All data from SQL
 */

import { getDbClient } from "../db.ts";
import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";

export interface SupportTicket {
  id: string;
  ticketId: string;
  customerId?: string;
  vendorId?: string;
  staffId?: string;
  userId?: string;
  subject: string;
  description: string;
  category: string;
  priority: string;
  status: string;
  bookingId?: string;
  orderId?: string;
  paymentId?: string;
  assignedTo?: string;
  assignedAt?: string;
  resolution?: string;
  resolvedAt?: string;
  resolvedBy?: string;
  tags?: string[];
  attachments?: any[];
  internalNotes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export class SupportTicketsRepository {
  private client: SupabaseClient;

  constructor(client?: SupabaseClient) {
    this.client = client || getDbClient();
  }

  /**
   * Create a new ticket
   */
  async createTicket(ticketData: Partial<SupportTicket>): Promise<SupportTicket> {
    try {
      const ticketId = `TKT-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;

      const insertData: any = {
        ticket_id: ticketId,
        customer_id: ticketData.customerId || null,
        vendor_id: ticketData.vendorId || null,
        staff_id: ticketData.staffId || null,
        user_id: ticketData.userId || null,
        subject: ticketData.subject!,
        description: ticketData.description!,
        category: ticketData.category!,
        priority: ticketData.priority || 'medium',
        status: ticketData.status || 'open',
        booking_id: ticketData.bookingId || null,
        order_id: ticketData.orderId || null,
        payment_id: ticketData.paymentId || null,
        tags: ticketData.tags || [],
        attachments: ticketData.attachments || [],
        internal_notes: ticketData.internalNotes || null
      };

      const { data, error } = await this.client
        .from('support_tickets')
        .insert(insertData)
        .select()
        .single();

      if (error) {
        throw error;
      }

      return this.mapTicketFromDb(data);
    } catch (error) {
      console.error('Error creating ticket:', error);
      throw error;
    }
  }

  /**
   * Get ticket by ID
   */
  async getTicketById(ticketId: string): Promise<SupportTicket | null> {
    try {
      const { data, error } = await this.client
        .from('support_tickets')
        .select('*')
        .or(`id.eq.${ticketId},ticket_id.eq.${ticketId}`)
        .single();

      if (error || !data) {
        return null;
      }

      return this.mapTicketFromDb(data);
    } catch (error) {
      console.error('Error getting ticket:', error);
      return null;
    }
  }

  /**
   * Get tickets for a user
   */
  async getUserTickets(userId: string, status?: string): Promise<SupportTicket[]> {
    try {
      let query = this.client
        .from('support_tickets')
        .select('*')
        .or(`customer_id.eq.${userId},vendor_id.eq.${userId},staff_id.eq.${userId},user_id.eq.${userId}`)
        .order('created_at', { ascending: false });

      if (status) {
        query = query.eq('status', status);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching user tickets:', error);
        return [];
      }

      return (data || []).map(this.mapTicketFromDb);
    } catch (error) {
      console.error('Error in getUserTickets:', error);
      return [];
    }
  }

  /**
   * Update ticket
   */
  async updateTicket(ticketId: string, updates: Partial<SupportTicket>): Promise<SupportTicket | null> {
    try {
      const updateData: any = {};

      if (updates.status !== undefined) updateData.status = updates.status;
      if (updates.priority !== undefined) updateData.priority = updates.priority;
      if (updates.assignedTo !== undefined) {
        updateData.assigned_to = updates.assignedTo;
        updateData.assigned_at = updates.assignedTo ? new Date().toISOString() : null;
      }
      if (updates.resolution !== undefined) updateData.resolution = updates.resolution;
      if (updates.resolvedAt !== undefined) updateData.resolved_at = updates.resolvedAt;
      if (updates.resolvedBy !== undefined) updateData.resolved_by = updates.resolvedBy;
      if (updates.tags !== undefined) updateData.tags = updates.tags;
      if (updates.attachments !== undefined) updateData.attachments = updates.attachments;
      if (updates.internalNotes !== undefined) updateData.internal_notes = updates.internalNotes;

      updateData.updated_at = new Date().toISOString();

      const { data, error } = await this.client
        .from('support_tickets')
        .update(updateData)
        .or(`id.eq.${ticketId},ticket_id.eq.${ticketId}`)
        .select()
        .single();

      if (error || !data) {
        return null;
      }

      return this.mapTicketFromDb(data);
    } catch (error) {
      console.error('Error updating ticket:', error);
      return null;
    }
  }

  /**
   * Get all tickets (admin)
   */
  async getAllTickets(filters?: {
    status?: string;
    category?: string;
    priority?: string;
    assignedTo?: string;
  }): Promise<SupportTicket[]> {
    try {
      let query = this.client
        .from('support_tickets')
        .select('*')
        .order('created_at', { ascending: false });

      if (filters?.status) {
        query = query.eq('status', filters.status);
      }
      if (filters?.category) {
        query = query.eq('category', filters.category);
      }
      if (filters?.priority) {
        query = query.eq('priority', filters.priority);
      }
      if (filters?.assignedTo) {
        query = query.eq('assigned_to', filters.assignedTo);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching tickets:', error);
        return [];
      }

      return (data || []).map(this.mapTicketFromDb);
    } catch (error) {
      console.error('Error in getAllTickets:', error);
      return [];
    }
  }

  /**
   * Map database row to SupportTicket
   */
  private mapTicketFromDb(row: any): SupportTicket {
    return {
      id: row.id,
      ticketId: row.ticket_id,
      customerId: row.customer_id || undefined,
      vendorId: row.vendor_id || undefined,
      staffId: row.staff_id || undefined,
      userId: row.user_id || undefined,
      subject: row.subject,
      description: row.description,
      category: row.category,
      priority: row.priority,
      status: row.status,
      bookingId: row.booking_id || undefined,
      orderId: row.order_id || undefined,
      paymentId: row.payment_id || undefined,
      assignedTo: row.assigned_to || undefined,
      assignedAt: row.assigned_at || undefined,
      resolution: row.resolution || undefined,
      resolvedAt: row.resolved_at || undefined,
      resolvedBy: row.resolved_by || undefined,
      tags: row.tags || [],
      attachments: row.attachments || [],
      internalNotes: row.internal_notes || undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }
}

let supportTicketsRepositoryInstance: SupportTicketsRepository | null = null;

export function getSupportTicketsRepository(): SupportTicketsRepository {
  if (!supportTicketsRepositoryInstance) {
    supportTicketsRepositoryInstance = new SupportTicketsRepository();
  }
  return supportTicketsRepositoryInstance;
}

