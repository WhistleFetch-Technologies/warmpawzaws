"use strict";
/**
 * DATABASE SCHEMA & UTILITY FUNCTIONS
 *
 * Common types and utility functions used across the backend
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateId = generateId;
exports.createSession = createSession;
// ============================================
// UTILITY FUNCTIONS
// ============================================
/**
 * Generate a unique ID with a prefix
 * ✅ FIX: For 'user' prefix, generate UUID format (required by database)
 */
function generateId(prefix) {
    // ✅ FIX: For user IDs, generate UUID format (database expects UUID)
    if (prefix === 'user') {
        // Use crypto.randomUUID() for user IDs to match database UUID type
        if (typeof crypto !== 'undefined' && crypto.randomUUID) {
            return crypto.randomUUID();
        }
        // Fallback: Generate UUID v4 format manually
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
            const r = Math.random() * 16 | 0;
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }
    // For other prefixes, use original format
    return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(7)}`;
}
/**
 * Create a session token
 */
function createSession(userId, role) {
    const sessionId = generateId('session');
    const token = `${sessionId}_${userId}_${role}_${Date.now()}`;
    return btoa(token); // Base64 encode
}
//# sourceMappingURL=database-schema.js.map