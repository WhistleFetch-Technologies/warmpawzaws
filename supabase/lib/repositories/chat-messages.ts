/**
 * ============================================================================
 * CHAT MESSAGES REPOSITORY
 * ============================================================================
 * 
 * Repository for booking chat messages.
 * Replaces: chat:booking:{bookingId}:messages KV keys
 * 
 * RULES:
 * ❌ NO KV imports allowed
 * ✅ All operations use SQL only
 * 
 * Date: 2024-12-22
 * ============================================================================
 */

import { getDbClient, selectQuery, insertQuery, updateQuery } from "../db.ts";
import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";

export interface ChatMessage {
  id: string;
  message_id: string;
  booking_id: string;
  sender_phone: string;
  sender_name: string;
  sender_type: 'customer' | 'vendor' | 'staff';
  message: string;
  message_type: 'text' | 'image' | 'video' | 'pdf' | 'file';
  file_id?: string | null;
  file_name?: string | null;
  file_type?: string | null;
  file_size?: number | null;
  is_read: boolean;
  read_at?: string | null;
  created_at: string;
}

export interface CreateChatMessageInput {
  message_id: string;
  booking_id: string;
  sender_phone: string;
  sender_name: string;
  sender_type: 'customer' | 'vendor' | 'staff';
  message: string;
  message_type?: 'text' | 'image' | 'video' | 'pdf' | 'file';
  file_id?: string;
  file_name?: string;
  file_type?: string;
  file_size?: number;
}

export class ChatMessagesRepository {
  private client: SupabaseClient;

  constructor(client?: SupabaseClient) {
    this.client = client || getDbClient();
  }

  /**
   * Create a new chat message
   */
  async create(input: CreateChatMessageInput): Promise<ChatMessage> {
    const results = await insertQuery<ChatMessage>("chat_messages", {
      message_id: input.message_id,
      booking_id: input.booking_id,
      sender_phone: input.sender_phone,
      sender_name: input.sender_name,
      sender_type: input.sender_type,
      message: input.message,
      message_type: input.message_type || 'text',
      file_id: input.file_id || null,
      file_name: input.file_name || null,
      file_type: input.file_type || null,
      file_size: input.file_size || null,
      is_read: false,
    });

    if (!results[0]) {
      throw new Error("Failed to create chat message");
    }

    return results[0];
  }

  /**
   * Get all messages for a booking
   */
  async findByBooking(bookingId: string): Promise<ChatMessage[]> {
    return selectQuery<ChatMessage>("chat_messages", 
      { booking_id: bookingId },
      {
        orderBy: "created_at",
        orderDirection: "asc",
      }
    );
  }

  /**
   * Mark messages as read
   */
  async markAsRead(bookingId: string, readerPhone: string): Promise<void> {
    await this.client
      .from("chat_messages")
      .update({
        is_read: true,
        read_at: new Date().toISOString(),
      })
      .eq("booking_id", bookingId)
      .neq("sender_phone", readerPhone)
      .is("is_read", false);
  }

  /**
   * Get unread count for a booking
   */
  async getUnreadCount(bookingId: string, readerPhone: string): Promise<number> {
    const { count } = await this.client
      .from("chat_messages")
      .select("*", { count: "exact", head: true })
      .eq("booking_id", bookingId)
      .neq("sender_phone", readerPhone)
      .eq("is_read", false);

    return count || 0;
  }
}

let repositoryInstance: ChatMessagesRepository | null = null;

export function getChatMessagesRepository(): ChatMessagesRepository {
  if (!repositoryInstance) {
    repositoryInstance = new ChatMessagesRepository();
  }
  return repositoryInstance;
}

