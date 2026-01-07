/**
 * ============================================================================
 * CHAT ENDPOINTS - LAMBDA VERSION
 * ============================================================================
 *
 * Handles chat/messaging:
 * - Get conversation for booking
 * - Send messages
 * - Mark messages as read
 *
 * Note: Requires chat_messages table (create migration if needed)
 *
 * Migrated from: supabase/functions/make-server-3dd53475/chat-endpoints-sql.tsx
 *
 * Date: 2025-01-28
 * Migration: Supabase to AWS Lambda
 * ============================================================================
 */
import { Hono } from 'hono';
export declare function registerChatEndpoints(app: Hono): void;
//# sourceMappingURL=chat.d.ts.map