/**
 * ============================================================================
 * FILE UPLOAD ENDPOINTS - LAMBDA VERSION
 * ============================================================================
 *
 * Handles file uploads to S3:
 * - Generate presigned URLs for upload
 * - Get file URLs
 * - Delete files
 *
 * Date: 2025-01-28
 * Migration: Supabase to AWS Lambda
 * ============================================================================
 */
import { Hono } from 'hono';
export declare function registerFileUploadEndpoints(app: Hono): void;
//# sourceMappingURL=file-upload.d.ts.map