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
import type { Pool } from "../db";
export interface Notification {
    id: string;
    recipient_type: string;
    recipient_id: string;
    notification_type: string;
    title: string;
    message: string;
    channels: any;
    data?: any;
    is_read: boolean;
    read_at?: string | null;
    created_at: string;
}
export interface CreateNotificationInput {
    recipient_type?: string;
    recipient_id?: string;
    notification_type: string;
    title: string;
    message: string;
    channels?: any;
    data?: any;
    user_id?: string | null;
    type?: string;
}
export declare class NotificationsRepository {
    private pool;
    constructor(pool?: Pool);
    private getPool;
    create(input: CreateNotificationInput): Promise<Notification>;
    findByRecipient(recipientType: string, recipientId: string, options?: {
        limit?: number;
        offset?: number;
        unreadOnly?: boolean;
    }): Promise<Notification[]>;
    markAsRead(notificationId: string): Promise<Notification>;
}
export declare function getNotificationsRepository(): NotificationsRepository;
//# sourceMappingURL=notifications.d.ts.map