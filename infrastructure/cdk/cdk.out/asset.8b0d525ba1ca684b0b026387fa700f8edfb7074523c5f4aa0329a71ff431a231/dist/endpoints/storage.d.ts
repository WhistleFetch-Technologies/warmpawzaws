/**
 * ============================================================================
 * STORAGE HANDLER ENDPOINTS - LAMBDA VERSION
 * ============================================================================
 *
 * Handles file uploads and storage:
 * - Upload single file
 * - Upload multiple files
 * - Generate presigned URLs
 * - Delete files
 *
 * Migrated from: supabase/functions/server/storage-handler.tsx
 *
 * Date: 2025-01-28
 * Migration: Supabase to AWS Lambda (S3)
 * ============================================================================
 */
import { Hono } from 'hono';
export declare function registerStorageEndpoints(app: Hono): void;
//# sourceMappingURL=storage.d.ts.map