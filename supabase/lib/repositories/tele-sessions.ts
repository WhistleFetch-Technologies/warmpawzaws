/**
 * ============================================================================
 * TELE CONSULTATION SESSIONS REPOSITORY
 * ============================================================================
 * 
 * Repository for tele consultation video call sessions
 * Replaces: tele_session:{sessionId} KV keys
 * 
 * RULES:
 * ❌ NO KV imports allowed
 * ✅ All operations use SQL only
 * 
 * Date: 2025-01-27
 * ============================================================================
 */

import { getDbClient, selectQuery, insertQuery, updateQuery } from "../db.ts";
import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";

// ============================================================================
// TYPES
// ============================================================================

export interface TeleSession {
  id: string;
  booking_id: string;
  customer_id: string;
  staff_id: string;
  call_status: 'ringing' | 'active' | 'ended' | 'rejected' | 'cancelled';
  initiated_by: 'customer' | 'staff';
  initiated_at: string;
  accepted_at: string | null;
  ended_at: string | null;
  rejected_at: string | null;
  rejection_reason: string | null;
  ended_by: 'customer' | 'staff' | null;
  duration_seconds: number;
  session_link: string | null;
  meeting_id: string | null;
  attendee_tokens: { customer?: string; staff?: string } | null;
  chat_enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateTeleSessionInput {
  booking_id: string;
  customer_id: string;
  staff_id: string;
  call_status?: 'ringing' | 'active' | 'ended' | 'rejected' | 'cancelled';
  initiated_by: 'customer' | 'staff';
  session_link?: string;
  meeting_id?: string;
  attendee_tokens?: { customer?: string; staff?: string };
  chat_enabled?: boolean;
}

export interface UpdateTeleSessionInput {
  call_status?: 'ringing' | 'active' | 'ended' | 'rejected' | 'cancelled';
  accepted_at?: string;
  ended_at?: string;
  rejected_at?: string;
  rejection_reason?: string;
  ended_by?: 'customer' | 'staff';
  duration_seconds?: number;
  session_link?: string;
  meeting_id?: string;
  attendee_tokens?: { customer?: string; staff?: string };
}

// ============================================================================
// REPOSITORY CLASS
// ============================================================================

export class TeleSessionsRepository {
  private client: SupabaseClient;

  constructor(client?: SupabaseClient) {
    this.client = client || getDbClient();
  }

  /**
   * Get tele session by booking ID
   */
  async findByBookingId(bookingId: string): Promise<TeleSession | null> {
    const results = await selectQuery<any>("tele_sessions", { booking_id: bookingId }, { limit: 1 });
    if (results.length === 0) return null;
    return this.mapSession(results[0]);
  }

  /**
   * Get tele session by ID
   */
  async findById(sessionId: string): Promise<TeleSession | null> {
    const results = await selectQuery<any>("tele_sessions", { id: sessionId }, { limit: 1 });
    if (results.length === 0) return null;
    return this.mapSession(results[0]);
  }

  /**
   * Create tele session
   */
  async create(input: CreateTeleSessionInput): Promise<TeleSession> {
    const data: any = {
      booking_id: input.booking_id,
      customer_id: input.customer_id,
      staff_id: input.staff_id,
      call_status: input.call_status || 'ringing',
      initiated_by: input.initiated_by,
      initiated_at: new Date().toISOString(),
      session_link: input.session_link || null,
      meeting_id: input.meeting_id || null,
      attendee_tokens: input.attendee_tokens || null,
      chat_enabled: input.chat_enabled ?? true,
    };

    const results = await insertQuery<any>("tele_sessions", data);
    return this.mapSession(results[0]);
  }

  /**
   * Update tele session
   */
  async update(sessionId: string, input: UpdateTeleSessionInput): Promise<TeleSession> {
    const data: any = {
      ...input,
      updated_at: new Date().toISOString(),
    };

    const results = await updateQuery<any>("tele_sessions", { id: sessionId }, data);
    if (!results[0]) {
      throw new Error(`Tele session not found: ${sessionId}`);
    }
    return this.mapSession(results[0]);
  }

  /**
   * Accept call
   */
  async accept(sessionId: string): Promise<TeleSession> {
    return this.update(sessionId, {
      call_status: 'active',
      accepted_at: new Date().toISOString(),
    });
  }

  /**
   * Reject call
   */
  async reject(sessionId: string, reason?: string): Promise<TeleSession> {
    return this.update(sessionId, {
      call_status: 'rejected',
      rejected_at: new Date().toISOString(),
      rejection_reason: reason || null,
    });
  }

  /**
   * End call
   */
  async end(sessionId: string, endedBy: 'customer' | 'staff', durationSeconds?: number): Promise<TeleSession> {
    const startTime = await this.findById(sessionId);
    let duration = durationSeconds;
    
    if (!duration && startTime?.accepted_at) {
      const start = new Date(startTime.accepted_at).getTime();
      const end = new Date().getTime();
      duration = Math.floor((end - start) / 1000);
    }

    return this.update(sessionId, {
      call_status: 'ended',
      ended_at: new Date().toISOString(),
      ended_by: endedBy,
      duration_seconds: duration || 0,
    });
  }

  /**
   * Map database row to TeleSession interface
   */
  private mapSession(row: any): TeleSession {
    return {
      id: row.id,
      booking_id: row.booking_id,
      customer_id: row.customer_id,
      staff_id: row.staff_id,
      call_status: row.call_status,
      initiated_by: row.initiated_by,
      initiated_at: row.initiated_at,
      accepted_at: row.accepted_at,
      ended_at: row.ended_at,
      rejected_at: row.rejected_at,
      rejection_reason: row.rejection_reason,
      ended_by: row.ended_by,
      duration_seconds: row.duration_seconds || 0,
      session_link: row.session_link,
      meeting_id: row.meeting_id,
      attendee_tokens: row.attendee_tokens,
      chat_enabled: row.chat_enabled ?? true,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

let repositoryInstance: TeleSessionsRepository | null = null;

export function getTeleSessionsRepository(): TeleSessionsRepository {
  if (!repositoryInstance) {
    repositoryInstance = new TeleSessionsRepository();
  }
  return repositoryInstance;
}

