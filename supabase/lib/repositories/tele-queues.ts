/**
 * ============================================================================
 * TELE CONSULTATION QUEUES REPOSITORY
 * ============================================================================
 * 
 * Repository for tele consultation queue management
 * Replaces: tele:queue:{queueId} KV keys
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

export interface TeleQueue {
  id: string;
  role_id: string;
  booking_id: string;
  customer_id: string;
  queue_position: number;
  joined_at: string;
  assigned_at: string | null;
  estimated_wait_minutes: number | null;
  waiting_time_seconds: number;
  status: 'waiting' | 'assigned' | 'completed' | 'cancelled';
  created_at: string;
  updated_at: string;
}

export interface CreateTeleQueueInput {
  role_id: string;
  booking_id: string;
  customer_id: string;
  queue_position: number;
  estimated_wait_minutes?: number;
  status?: 'waiting' | 'assigned' | 'completed' | 'cancelled';
}

export interface UpdateTeleQueueInput {
  queue_position?: number;
  assigned_at?: string;
  estimated_wait_minutes?: number;
  waiting_time_seconds?: number;
  status?: 'waiting' | 'assigned' | 'completed' | 'cancelled';
}

// ============================================================================
// REPOSITORY CLASS
// ============================================================================

export class TeleQueuesRepository {
  private client: SupabaseClient;

  constructor(client?: SupabaseClient) {
    this.client = client || getDbClient();
  }

  /**
   * Get queue entry by booking ID
   */
  async findByBookingId(bookingId: string): Promise<TeleQueue | null> {
    const results = await selectQuery<any>("tele_queues", { booking_id: bookingId }, { limit: 1 });
    if (results.length === 0) return null;
    return this.mapQueue(results[0]);
  }

  /**
   * Get queue entries by role and status
   */
  async findByRoleAndStatus(roleId: string, status: string): Promise<TeleQueue[]> {
    const results = await selectQuery<any>("tele_queues", { role_id: roleId, status }, { 
      orderBy: "queue_position",
      orderDirection: "asc"
    });
    return results.map((r: any) => this.mapQueue(r));
  }

  /**
   * Get next queue position for a role
   */
  async getNextQueuePosition(roleId: string): Promise<number> {
    const waitingQueues = await this.findByRoleAndStatus(roleId, 'waiting');
    if (waitingQueues.length === 0) return 1;
    const maxPosition = Math.max(...waitingQueues.map(q => q.queue_position));
    return maxPosition + 1;
  }

  /**
   * Create queue entry
   */
  async create(input: CreateTeleQueueInput): Promise<TeleQueue> {
    const data: any = {
      role_id: input.role_id,
      booking_id: input.booking_id,
      customer_id: input.customer_id,
      queue_position: input.queue_position,
      estimated_wait_minutes: input.estimated_wait_minutes || null,
      waiting_time_seconds: 0,
      status: input.status || 'waiting',
    };

    const results = await insertQuery<any>("tele_queues", data);
    return this.mapQueue(results[0]);
  }

  /**
   * Update queue entry
   */
  async update(queueId: string, input: UpdateTeleQueueInput): Promise<TeleQueue> {
    const data: any = {
      ...input,
      updated_at: new Date().toISOString(),
    };

    const results = await updateQuery<any>("tele_queues", { id: queueId }, data);
    if (!results[0]) {
      throw new Error(`Queue entry not found: ${queueId}`);
    }
    return this.mapQueue(results[0]);
  }

  /**
   * Assign queue entry (move from waiting to assigned)
   */
  async assign(queueId: string, estimatedWaitMinutes?: number): Promise<TeleQueue> {
    return this.update(queueId, {
      status: 'assigned',
      assigned_at: new Date().toISOString(),
      estimated_wait_minutes: estimatedWaitMinutes || null,
    });
  }

  /**
   * Complete queue entry
   */
  async complete(queueId: string): Promise<TeleQueue> {
    return this.update(queueId, {
      status: 'completed',
    });
  }

  /**
   * Cancel queue entry
   */
  async cancel(queueId: string): Promise<TeleQueue> {
    return this.update(queueId, {
      status: 'cancelled',
    });
  }

  /**
   * Map database row to TeleQueue interface
   */
  private mapQueue(row: any): TeleQueue {
    return {
      id: row.id,
      role_id: row.role_id,
      booking_id: row.booking_id,
      customer_id: row.customer_id,
      queue_position: row.queue_position,
      joined_at: row.joined_at,
      assigned_at: row.assigned_at,
      estimated_wait_minutes: row.estimated_wait_minutes,
      waiting_time_seconds: row.waiting_time_seconds || 0,
      status: row.status,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

let repositoryInstance: TeleQueuesRepository | null = null;

export function getTeleQueuesRepository(): TeleQueuesRepository {
  if (!repositoryInstance) {
    repositoryInstance = new TeleQueuesRepository();
  }
  return repositoryInstance;
}

