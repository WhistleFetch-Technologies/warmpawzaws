/**
 * ============================================================================
 * UNIVERSAL MEDIA UPLOAD ENDPOINTS - SQL-ONLY VERSION
 * ============================================================================
 *
 * Centralized media upload endpoint for all file types
 * - Product images
 * - Profile photos (vendor, customer, staff, pet)
 * - Prescriptions
 * - Documents
 * - Banner images
 *
 * ✅ SQL-ONLY: All operations use SQL
 * ✅ S3 Integration: All files stored in S3
 *
 * Date: 2025-01-28
 * ============================================================================
 */
import { Hono } from 'hono';
export declare function registerMediaUploadEndpoints(app: Hono): void;
//# sourceMappingURL=media-upload-endpoints-sql.d.ts.map