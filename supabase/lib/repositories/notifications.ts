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
  user_id: string | null;
  notification_type: string;
  title: string;
  message: string;
  data: any; // JSONB
  is_read: boolean;
  is_sent: boolean;
  sent_at?: string | null;
  created_at: string;
}

export interface CreateNotificationInput {
  user_id: string;
  notification_type: string;
  title: string;
  message: string;
  data?: any;
}

export class NotificationsRepository {
  private client: SupabaseClient;

  constructor(client?: SupabaseClient) {
    this.client = client || getDbClient();
  }

  async create(input: CreateNotificationInput): Promise<Notification> {
    const results = await insertQuery<Notification>("notifications", {
      user_id: input.user_id,
      notification_type: input.notification_type,
      title: input.title,
      message: input.message,
      data: input.data || {},
      is_read: false,
      is_sent: false,
    });
    
    if (!results[0]) {
      throw new Error("Failed to create notification");
    }
    
    return results[0];
  }

  async findByUser(userId: string, options?: {
    limit?: number;
    offset?: number;
    unreadOnly?: boolean;
  }): Promise<Notification[]> {
    const filters: any = {
      user_id: userId,
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

  // Legacy method for backward compatibility
  async findByRecipient(recipientType: string, recipientId: string, options?: {
    limit?: number;
    offset?: number;
    unreadOnly?: boolean;
  }): Promise<Notification[]> {
    // For now, treat recipient_id as user_id
    // This maintains backward compatibility while we migrate
    return this.findByUser(recipientId, options);
  }

  async markAsRead(notificationId: string): Promise<Notification> {
    const results = await updateQuery<Notification>(
      "notifications",
      { id: notificationId },
      {
        is_read: true,
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

