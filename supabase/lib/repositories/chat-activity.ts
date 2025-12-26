/**
 * ============================================================================
 * CHAT ACTIVITY REPOSITORY
 * ============================================================================
 * 
 * Repository for chat activity tracking.
 * Replaces: chat:booking:{bookingId}:lastActivity KV keys
 * 
 * RULES:
 * ❌ NO KV imports allowed
 * ✅ All operations use SQL only
 * 
 * Date: 2024-12-22
 * ============================================================================
 */

import { getDbClient, selectQuery, insertQuery, updateQuery, upsertQuery } from "../db.ts";
import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";

export interface ChatActivity {
  id: string;
  booking_id: string;
  last_activity_at: string;
  last_message_id?: string | null;
  updated_at: string;
}

export class ChatActivityRepository {
  private client: SupabaseClient;

  constructor(client?: SupabaseClient) {
    this.client = client || getDbClient();
  }

  /**
   * Update or create last activity for a booking
   */
  async updateLastActivity(bookingId: string, messageId?: string): Promise<ChatActivity> {
    const results = await upsertQuery<ChatActivity>(
      "chat_activity",
      {
        booking_id: bookingId,
        last_activity_at: new Date().toISOString(),
        last_message_id: messageId || null,
        updated_at: new Date().toISOString(),
      },
      {
        conflictColumns: ["booking_id"],
        updateColumns: ["last_activity_at", "last_message_id", "updated_at"],
      }
    );

    if (!results[0]) {
      throw new Error("Failed to update chat activity");
    }

    return results[0];
  }

  /**
   * Get last activity for a booking
   */
  async findByBooking(bookingId: string): Promise<ChatActivity | null> {
    const results = await selectQuery<ChatActivity>("chat_activity", 
      { booking_id: bookingId },
      { limit: 1 }
    );

    return results[0] || null;
  }
}

let repositoryInstance: ChatActivityRepository | null = null;

export function getChatActivityRepository(): ChatActivityRepository {
  if (!repositoryInstance) {
    repositoryInstance = new ChatActivityRepository();
  }
  return repositoryInstance;
}

