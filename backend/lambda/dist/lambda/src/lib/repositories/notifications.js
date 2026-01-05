"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationsRepository = void 0;
exports.getNotificationsRepository = getNotificationsRepository;
const db_1 = require("../db");
class NotificationsRepository {
    pool = null;
    constructor(pool) {
        if (pool) {
            this.pool = pool;
        }
    }
    async getPool() {
        if (!this.pool) {
            this.pool = await (0, db_1.getDbClient)();
        }
        return this.pool;
    }
    async create(input) {
        // Support both user_id (legacy) and recipient_id/recipient_type patterns
        const recipientType = input.recipient_type || (input.user_id ? 'user' : 'vendor');
        const recipientId = input.recipient_id || input.user_id || '';
        const results = await (0, db_1.insertQuery)("notifications", {
            recipient_type: recipientType,
            recipient_id: recipientId,
            notification_type: input.notification_type,
            title: input.title,
            message: input.message,
            channels: input.channels || {},
            data: input.data || null,
            is_read: false,
        });
        if (!results[0]) {
            throw new Error("Failed to create notification");
        }
        return results[0];
    }
    async findByRecipient(recipientType, recipientId, options) {
        const filters = {
            recipient_type: recipientType,
            recipient_id: recipientId,
        };
        if (options?.unreadOnly) {
            filters.is_read = false;
        }
        return (0, db_1.selectQuery)("notifications", filters, {
            limit: options?.limit,
            offset: options?.offset,
            orderBy: "created_at",
            orderDirection: "desc",
        });
    }
    async markAsRead(notificationId) {
        const results = await (0, db_1.updateQuery)("notifications", { id: notificationId }, {
            is_read: true,
            read_at: new Date().toISOString(),
        });
        if (!results[0]) {
            throw new Error(`Notification not found: ${notificationId}`);
        }
        return results[0];
    }
}
exports.NotificationsRepository = NotificationsRepository;
let repositoryInstance = null;
function getNotificationsRepository() {
    if (!repositoryInstance) {
        repositoryInstance = new NotificationsRepository();
    }
    return repositoryInstance;
}
//# sourceMappingURL=notifications.js.map