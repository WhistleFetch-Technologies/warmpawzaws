/**
 * ============================================================================
 * NOTIFICATIONS REPOSITORY
 * ============================================================================
 * 
 * Repository for notification data access.
 * Replaces: notification-related KV operations
 * 
 * RULES:
 * ❌ NO KV imports allowed
 * ✅ All operations use SQL only
 * 
 * Date: 2024-12-22
 * ============================================================================
 */

import { getDbClient, insertQuery, selectQuery, updateQuery } from "../db.ts";
import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";

export interface Notification {
  id: string;
  recipient_type: string;
  recipient_id: string;
  notification_type: string;
  title: string;
  message: string;
  channels: any; // JSONB
  is_read: boolean;
  read_at?: string | null;
  created_at: string;
}

export interface CreateNotificationInput {
  recipient_type: string;
  recipient_id: string;
  notification_type: string;
  title: string;
  message: string;
  channels: any;
  data?: any;
}

export class NotificationsRepository {
  private client: SupabaseClient;

  constructor(client?: SupabaseClient) {
    this.client = client || getDbClient();
  }

  async create(input: CreateNotificationInput): Promise<Notification> {
    const results = await insertQuery<Notification>("notifications", {
      recipient_type: input.recipient_type,
      recipient_id: input.recipient_id,
      notification_type: input.notification_type,
      title: input.title,
      message: input.message,
      channels: input.channels,
      is_read: false,
    });
    
    if (!results[0]) {
      throw new Error("Failed to create notification");
    }
    
    return results[0];
  }

  async findByRecipient(recipientType: string, recipientId: string, options?: {
    limit?: number;
    offset?: number;
    unreadOnly?: boolean;
  }): Promise<Notification[]> {
    const filters: any = {
      recipient_type: recipientType,
      recipient_id: recipientId,
    };
    
    if (options?.unreadOnly) {
      filters.is_read = false;
    }
    
    return selectQuery<Notification>("notifications", filters, {
      limit: options?.limit,
      offset: options?.offset,
      orderBy: "created_at",
      orderDirection: "desc",
    });
  }

  async markAsRead(notificationId: string): Promise<Notification> {
    const results = await updateQuery<Notification>(
      "notifications",
      { id: notificationId },
      {
        is_read: true,
        read_at: new Date().toISOString(),
      }
    );
    
    if (!results[0]) {
      throw new Error(`Notification not found: ${notificationId}`);
    }
    
    return results[0];
  }
}

let repositoryInstance: NotificationsRepository | null = null;

export function getNotificationsRepository(): NotificationsRepository {
  if (!repositoryInstance) {
    repositoryInstance = new NotificationsRepository();
  }
  return repositoryInstance;
}

