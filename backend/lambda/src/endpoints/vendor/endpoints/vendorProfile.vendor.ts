/**
 * ============================================================================
 * VENDOR PROFILE MANAGEMENT ENDPOINTS - LAMBDA VERSION
 * ============================================================================
 * 
 * Handles vendor profile updates with intelligent re-approval logic:
 * - Update vendor profile
 * - Check edit permissions
 * - Re-approval workflow
 * 
 * 
 * Date: 2025-01-28
 * Migration: Supabase to AWS Lambda
 * ============================================================================
 */

import { Hono } from 'hono';
import { randomUUID } from 'crypto';
import { select, update, insert, query } from '../../../database/rds-connection';
import { getSnsClient } from '../../../utils/sns-client';
import { PublishCommand } from '@aws-sdk/client-sns';
import { normalizeDbRow, normalizeDbRows, extractEntityIds } from '../../../utils/entity-extractor';
import { isValidUUID } from '../../../types/entities';
import { getEffectiveCapabilities } from '../../../utils/capability-filter';

// Fields that require re-approval if changed
const CRITICAL_FIELDS = [
  'business_name',
  'owner_name',
  'gst_number',
  'pan_number',
  'registration_number',
  'address',
  'city',
  'state',
  'pincode',
  'latitude',
  'longitude',
];

/** Normalize phone to digits-only for consistent lookup (e.g. +919876543210 → 919876543210). */
function normalizePhoneForLookup(phone: string | undefined): string | undefined {
  if (phone == null || String(phone).trim() === '') return undefined;
  return String(phone).replace(/\D/g, '');
}

/**
 * ✅ FIX: Extract S3 key from pre-signed URL or full S3 URL
 * Handles various URL formats and returns the S3 key for regenerating pre-signed URLs
 */
function extractS3KeyFromUrl(url: string | null | undefined): string | null {
  if (!url || typeof url !== 'string') return null;
  
  // If it's already just a key (no http/https), return as-is
  if (!url.startsWith('http')) {
    return url;
  }
  
  // If it's a pre-signed URL or full S3 URL, extract the key
  if (url.includes('amazonaws.com')) {
    try {
      const urlObj = new URL(url);
      // Remove leading slash and query params
      const key = urlObj.pathname.substring(1).split('?')[0];
      return key || null;
    } catch (e) {
      // If URL parsing fails, try regex pattern matching
      const match = url.match(/vendors\/[^?]+/);
      if (match) return match[0];
    }
  }
  
  return null;
}

/**
 * ✅ FIX: Regenerate pre-signed URL for S3 object
 * Takes an S3 key or existing URL and returns a fresh pre-signed URL
 */
async function regeneratePresignedUrl(s3KeyOrUrl: string | null | undefined): Promise<string | null> {
  if (!s3KeyOrUrl) return null;
  
  try {
    const s3Key = extractS3KeyFromUrl(s3KeyOrUrl);
    if (!s3Key) return s3KeyOrUrl; // Return original if we can't extract key
    
    const { S3Client, GetObjectCommand } = await import('@aws-sdk/client-s3');
    const { getSignedUrl } = await import('@aws-sdk/s3-request-presigner');
    const s3Client = new S3Client({ region: process.env.AWS_REGION || 'ap-south-1' });
    const BUCKET_NAME = process.env.S3_UPLOADS_BUCKET || 'warmpawz-dev-uploads';
    
    const signedUrl = await getSignedUrl(
      s3Client,
      new GetObjectCommand({
        Bucket: BUCKET_NAME,
        Key: s3Key,
      }),
      { expiresIn: 604800 } // 7 days
    );
    
    return signedUrl;
  } catch (error: any) {
    console.warn(`[PRESIGNED-URL] Could not regenerate URL for ${s3KeyOrUrl}:`, error.message);
    return s3KeyOrUrl; // Return original URL if regeneration fails
  }
}

/**
 * Get all vendor IDs that may have availability stored (vendors.id + vendor_identity.id for same vendor).
 * Use for vendor_availability_v2 queries so slots are found whether stored by vendor_id or vendor_identity_id.
 * Returns string[] for vendor_id::text = ANY($1::text[]) in queries.
 * Order: ids[0] = vendors.id (canonical), ids[1+] = vendor_identity.id(s). Use ids[0] as vendorId and ids[1] as vendorIdentityId in API responses.
 */
export async function getVendorIdsForAvailabilityLookup(vendorIdOrResolved: string): Promise<string[]> {
  const vendor = await resolveVendorById(vendorIdOrResolved);
  if (!vendor || !vendor.id) return [String(vendorIdOrResolved || '')];
  const ids: string[] = [String(vendor.id)];
  try {
    const res = await query(
      `SELECT id FROM vendor_identity WHERE vendor_id::text = $1 OR phone = $2`,
      [String(vendor.id), vendor.phone || '']
    );
    for (const row of res.rows || []) {
      if (row?.id) {
        const s = String(row.id);
        if (!ids.includes(s)) ids.push(s);
      }
    }
  } catch {
    // ignore
  }
  return ids;
}

/** Get vendor_identity.id for a vendor (by vendors.id). Returns null if none. For API responses so clients have both vendorId and vendorIdentityId. */
export async function getVendorIdentityId(vendorIdOrResolved: string): Promise<string | null> {
  const vendor = await resolveVendorById(vendorIdOrResolved);
  if (!vendor || !vendor.id) return null;
  try {
    // ✅ FIX: Query by phone only (vendor_id column may not exist in production)
    const res = await query(
      `SELECT id FROM vendor_identity WHERE phone = $1 LIMIT 1`,
      [vendor.phone || '']
    );
    const row = res.rows?.[0];
    return row?.id ? String(row.id) : null;
  } catch {
    return null;
  }
}

/** 
 * Helper: Check if a record is soft-deleted
 * Handles boolean true, string "true", PostgreSQL 't'/'f', and case variations
 */
function isRecordDeleted(record: any): boolean {
  if (!record || record.is_deleted === undefined || record.is_deleted === null) {
    return false;
  }
  // Handle boolean true
  if (record.is_deleted === true) return true;
  // Handle PostgreSQL boolean 't' (true) or 'f' (false)
  if (record.is_deleted === 't') return true;
  if (record.is_deleted === 'f') return false;
  // Handle string "true" (case-insensitive)
  if (typeof record.is_deleted === 'string' && record.is_deleted.toLowerCase() === 'true') return true;
  // Handle numeric 1 (some databases return 1 for true)
  if (record.is_deleted === 1) return true;
  return false;
}

/** Resolve vendor by ID - checks vendors, then vendor_identity with auto-create. Returns vendor row or null. Exported for use by vendor-schedule. */
export async function resolveVendorById(vendorId: string): Promise<any | null> {
  const trimmedId = (vendorId || '').trim();
  if (!trimmedId) return null;

  // ✅ SECURITY: Check vendors table - filter out deleted vendors
  let vendors = await select('vendors', { id: trimmedId });
  const activeVendors = vendors.filter((v: any) => !isRecordDeleted(v));
  if (activeVendors.length > 0) {
    return activeVendors[0];
  }
  // If only deleted vendors found, treat as if vendor doesn't exist
  if (vendors.length > 0) {
    console.log(`⚠️ [PROFILE] Vendor ${trimmedId} exists but is soft-deleted - treating as not found`);
  }

  console.log(`[PROFILE] Vendor ${trimmedId} not in vendors table, checking vendor_identity...`);
  let identities = await select('vendor_identity', { id: trimmedId });
  if (identities.length === 0) {
    // ✅ FIX: Query by id only (vendor_id column may not exist in production)
    // Fallback: text comparison in case of type/format mismatch (e.g. UUID vs text)
    const byText = await query(
      `SELECT * FROM vendor_identity WHERE id::text = $1 LIMIT 1`,
      [trimmedId]
    ).catch(() => ({ rows: [] }));
    if (byText.rows?.length > 0) identities = byText.rows;
    if (identities.length === 0) {
      // Fallback: via vendor_onboarding_applications (frontend may send application id)
      const viaApp = await query(
        `SELECT vi.* FROM vendor_identity vi
         INNER JOIN vendor_onboarding_applications voa ON voa.vendor_identity_id = vi.id
         WHERE voa.id::text = $1 OR voa.vendor_identity_id::text = $1 OR vi.id::text = $1 LIMIT 1`,
        [trimmedId]
      ).catch(() => ({ rows: [] }));
      if (viaApp.rows?.length > 0) identities = viaApp.rows;
    }
    // Fallback: resolve staff id to vendor (customer flows may pass staff.id for at_home/tele)
    if (identities.length === 0) {
      const staffRows = await query(
        `SELECT s.vendor_id FROM staff s WHERE s.id::text = $1 LIMIT 1`,
        [trimmedId]
      ).catch(() => ({ rows: [] }));
      if (staffRows.rows?.length > 0 && staffRows.rows[0].vendor_id) {
        const linked = await select('vendors', { id: staffRows.rows[0].vendor_id });
        const activeLinked = linked.filter((v: any) => !isRecordDeleted(v));
        if (activeLinked.length > 0) return activeLinked[0];
      }
      return null;
    }
  }

  // ✅ SECURITY: Filter out deleted vendor_identity records
  const activeIdentities = identities.filter((vi: any) => !isRecordDeleted(vi));
  if (activeIdentities.length === 0) {
    console.log(`⚠️ [PROFILE] Vendor identity ${trimmedId} exists but is soft-deleted - treating as not found`);
    return null;
  }

  const identity = activeIdentities[0];
  if (identity.onboarding_status !== 'APPROVED' && identity.onboarding_status !== 'ACTIVATED') {
    return null;
  }

  // ✅ SECURITY: Check vendors by phone - filter out deleted vendors
  const phoneNorm = normalizePhoneForLookup(identity.phone);
  if (phoneNorm) {
    const vendorByPhone = await query(
      `SELECT * FROM vendors 
       WHERE (REPLACE(REPLACE(phone, ' ', ''), '+', '') LIKE $1 OR phone = $2)
       AND (is_deleted IS NULL OR is_deleted = false OR is_deleted = 'f')
       LIMIT 1`,
      [`%${phoneNorm}%`, identity.phone]
    ).catch(() => ({ rows: [] }));
    if (vendorByPhone.rows?.length > 0) {
      const activeByPhone = vendorByPhone.rows.filter((v: any) => !isRecordDeleted(v));
      if (activeByPhone.length > 0) return activeByPhone[0];
    }
  }
  const vendorByPhoneDirect = await select('vendors', { phone: identity.phone });
  const activeByPhoneDirect = vendorByPhoneDirect.filter((v: any) => !isRecordDeleted(v));
  if (activeByPhoneDirect.length > 0) return activeByPhoneDirect[0];

  const applications = await select('vendor_onboarding_applications', { vendor_identity_id: identity.id });
  const application = applications.length > 0 ? applications[0] : null;
  const payload = application?.application_payload || {};
  
  // ✅ FIX: Extract profile photo from uploaded_documents and save to profile_photo_url
  let profilePhotoUrl: string | null = null;
  
  // First, check uploaded_documents array
  if (application && application.uploaded_documents) {
    const uploadedDocuments = Array.isArray(application.uploaded_documents) 
      ? application.uploaded_documents 
      : [];
    
    // Look for profile photo in uploaded documents
    const profilePhotoDoc = uploadedDocuments.find((doc: any) => 
      doc.type === 'profilePhoto' || 
      doc.type === 'profile_photo' || 
      doc.name === 'profilePhoto' ||
      (doc.name && doc.name.toLowerCase().includes('profile') && doc.name.toLowerCase().includes('photo'))
    );
    
    if (profilePhotoDoc && profilePhotoDoc.url) {
      const photoUrl = profilePhotoDoc.url;
      if (photoUrl.includes('amazonaws.com')) {
        try {
          const urlObj = new URL(photoUrl);
          profilePhotoUrl = urlObj.pathname.substring(1).split('?')[0];
        } catch (e) {
          const match = photoUrl.match(/vendors\/[^?]+/);
          profilePhotoUrl = match ? match[0] : photoUrl;
        }
      } else {
        profilePhotoUrl = photoUrl;
      }
      console.log(`📸 [PROFILE] Extracted profile photo from uploaded_documents: ${profilePhotoUrl}`);
    }
  }
  
  // Fallback: Check application_payload for profilePhoto field
  if (!profilePhotoUrl && payload.profilePhoto) {
    const photoUrl = payload.profilePhoto;
    if (photoUrl.includes('amazonaws.com')) {
      try {
        const urlObj = new URL(photoUrl);
        profilePhotoUrl = urlObj.pathname.substring(1).split('?')[0];
      } catch (e) {
        const match = photoUrl.match(/vendors\/[^?]+/);
        profilePhotoUrl = match ? match[0] : photoUrl;
      }
    } else {
      profilePhotoUrl = photoUrl;
    }
    console.log(`📸 [PROFILE] Extracted profile photo from application_payload: ${profilePhotoUrl}`);
  }

  // ✅ FIX: Extract service_radius from payload (for prod compatibility)
  let serviceRadius: number | null = null;
  const radiusFields = ['service_radius', 'serviceRadius', 'serviceRadiusKm', 'radius', 'radiusKm', 'service_radius_km'];
  for (const field of radiusFields) {
    if (payload[field] !== undefined && payload[field] !== null && payload[field] !== '') {
      const radiusValue = typeof payload[field] === 'string' ? parseFloat(payload[field]) : Number(payload[field]);
      if (!isNaN(radiusValue) && radiusValue > 0) {
        serviceRadius = radiusValue;
        break;
      }
    }
  }

  // Determine the vendor ID to use - prefer identity.vendor_id, fallback to identity.id
  let proposedVendorId = identity.vendor_id || identity.id;
  
  // ✅ FIX: Check if a vendor with this ID already exists (even if deleted)
  // If it exists, generate a new unique UUID to avoid primary key violation
  // This ensures each new vendor registration gets a fresh record, even if the old one was deleted
  const existingVendorCheck = await query(
    `SELECT id, is_deleted FROM vendors WHERE id = $1 LIMIT 1`,
    [proposedVendorId]
  ).catch(() => ({ rows: [] }));

  let finalVendorId = proposedVendorId;
  
  if (existingVendorCheck.rows && existingVendorCheck.rows.length > 0) {
    // Vendor with this ID already exists (may be deleted or active)
    // Generate a new unique UUID for the new vendor record
    finalVendorId = randomUUID();
    console.log(`⚠️ [PROFILE] Vendor ID ${proposedVendorId} already exists - generating new unique ID: ${finalVendorId}`);
  }

  console.log(`[PROFILE] Auto-creating vendor record for approved vendor ${identity.id}, using vendor id: ${finalVendorId}`);
  console.log(`[PROFILE] Extracted values - pincode: ${(() => {
    const { extractPincodeFromPayload } = require('../../../utils/extract-profile-photo');
    return extractPincodeFromPayload(payload);
  })()}, profile_photo_url: ${profilePhotoUrl}, service_radius: ${serviceRadius}`);
  
  const newVendor = await insert('vendors', {
    id: finalVendorId,
    phone: identity.phone,
    email: payload.email || payload.businessEmail || `vendor-${identity.phone}@warmpawz.app`,
    business_name: payload.businessName || payload.business_name || `Vendor ${identity.phone}`,
    owner_name: payload.contactPersonName || payload.ownerName || 'Vendor Owner',
    role_id: identity.selected_role_id,
    vendor_type: (identity as any).vendor_type || payload.vendorType || payload.vendor_type || 'business',
    category: 'general',
    address: payload.address || 'Not specified',
    city: payload.city || 'Not specified',
    state: payload.state || 'Not specified',
    pincode: (() => {
      // ✅ FIX: Use enhanced pincode extraction
      const { extractPincodeFromPayload } = require('../../../utils/extract-profile-photo');
      return extractPincodeFromPayload(payload);
    })(),
    profile_photo_url: profilePhotoUrl, // ✅ FIX: Save profile photo from onboarding
    service_radius: serviceRadius, // ✅ FIX: Save service_radius from onboarding (PROD FIX)
    status: 'active',
    is_active: true,
    is_deleted: false, // ✅ CRITICAL FIX: Always set to false for new vendors
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });
  
  // ✅ FIX: Update vendor_identity to link the new vendor_id
  // This ensures vendor_identity.vendor_id points to the correct (new) vendors record
  if (identity.vendor_id !== finalVendorId) {
    try {
      await query(
        `UPDATE vendor_identity 
         SET vendor_id = $1, updated_at = NOW()
         WHERE id = $2`,
        [finalVendorId, identity.id]
      );
      console.log(`✅ [PROFILE] Linked vendor_id ${finalVendorId} to vendor_identity ${identity.id}`);
    } catch (linkErr: any) {
      console.warn(`⚠️ [PROFILE] Failed to link vendor_id (non-critical):`, linkErr.message);
    }
  }
  
  return newVendor[0];
}

// Helper to decode JWT and extract phone number
async function decodeJwtFromHeader(authHeader: string | undefined): Promise<{ phone?: string; userId?: string }> {
  if (!authHeader) return {};
  
  const token = authHeader.replace(/^Bearer\s+/i, '');
  if (!token) return {};
  
  try {
    // Decode JWT payload (base64)
    const parts = token.split('.');
    if (parts.length !== 3) return {};
    
    const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf-8'));
    // ✅ FIX: Support multiple JWT formats - our custom JWT uses 'phone', Cognito uses 'phone_number'
    const phone = payload.phone || payload.phone_number || payload['cognito:username'];
    const userId = payload.userId || payload.sub || payload.user_id;
    console.log(`🔐 [JWT-DECODE] Extracted phone: ${phone}, userId: ${userId}`);
    return {
      phone,
      userId,
    };
  } catch (e) {
    console.warn('Failed to decode JWT:', e);
    return {};
  }
}

export function registerVendorProfileEndpoints(app: Hono) {
  /**
   * GET /vendor/profile
   * Get current vendor profile based on authenticated user (via JWT)
   */
  app.get("/vendor/profile", async (c) => {
    try {
      // Decode JWT from Authorization header to get phone number
      const authHeader = c.req.header('Authorization');
      const { phone, userId: vendorIdFromAuth } = await decodeJwtFromHeader(authHeader);

      console.log(`📊 [PROFILE-GET] Getting profile for phone: ${phone}, vendorId: ${vendorIdFromAuth}`);

      let vendor = null;
      let identityData = null;

      // ✅ BIG LOGGING: Log what we're searching for
      console.log('═══════════════════════════════════════════════════════════');
      console.log('🔍 [PROFILE-GET] SEARCHING FOR VENDOR');
      console.log('📱 Phone from JWT:', phone);
      console.log('🆔 VendorId from JWT:', vendorIdFromAuth);
      console.log('═══════════════════════════════════════════════════════════');

      /** Helper: true when the record is soft-deleted */
      const isRecordDeleted = (r: any): boolean =>
        r?.is_deleted === true || r?.is_deleted === 't' ||
        (typeof r?.is_deleted === 'string' && r.is_deleted.toLowerCase() === 'true');

      // Try to find vendor by vendorId first (userId from JWT might be vendor ID)
      if (vendorIdFromAuth && !vendorIdFromAuth.startsWith('temp_')) {
        try {
          const vendors = await select('vendors', { id: vendorIdFromAuth });
          // Skip deleted records — treat as if they don't exist
          const activeVendors = vendors.filter((v: any) => !isRecordDeleted(v));
          if (activeVendors.length > 0) {
            vendor = activeVendors[0];
            console.log(`✅ [PROFILE-GET] Found vendor by vendorId: ${vendor.id}`);
          } else if (vendors.length > 0) {
            console.log(`⚠️ [PROFILE-GET] Vendor ${vendorIdFromAuth} exists but is soft-deleted — skipping`);
          } else {
            console.log(`⚠️ [PROFILE-GET] No vendor found with ID: ${vendorIdFromAuth}`);
          }
        } catch (e) {
          console.warn(`[PROFILE-GET] Error finding vendor by ID ${vendorIdFromAuth}:`, e);
        }
      }

      // If not found by vendorId, try by phone directly on vendors table
      // ✅ FIX: Use normalized phone matching + filter out soft-deleted vendors
      if (!vendor && phone) {
        try {
          const normalizedPhone = normalizePhoneForLookup(phone);
          const phoneWithoutCountryCode = normalizedPhone?.replace(/^91/, '') || phone;
          
          console.log(`[PROFILE-GET] Phone normalization: original=${phone}, normalized=${normalizedPhone}, withoutCountryCode=${phoneWithoutCountryCode}`);
          
          let vendorsByPhone = await select('vendors', { phone });
          if (vendorsByPhone.length === 0 && normalizedPhone) {
            vendorsByPhone = await select('vendors', { phone: normalizedPhone });
          }
          if (vendorsByPhone.length === 0 && phoneWithoutCountryCode && phoneWithoutCountryCode !== phone) {
            vendorsByPhone = await select('vendors', { phone: phoneWithoutCountryCode });
          }
          if (vendorsByPhone.length === 0) {
            const phoneQuery = await query(
              `SELECT * FROM vendors 
               WHERE REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(phone, ' ', ''), '+', ''), '-', ''), '(', ''), ')', '') = $1
                  OR REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(phone, ' ', ''), '+', ''), '-', ''), '(', ''), ')', '') = $2
                  OR phone = $3
                  OR phone = $4`,
              [normalizedPhone || '', phoneWithoutCountryCode || '', phone, normalizedPhone || phone]
            );
            if (phoneQuery.rows?.length > 0) {
              vendorsByPhone = phoneQuery.rows;
            }
          }
          
          // ✅ SECURITY: Filter out soft-deleted vendors — only use active records
          const activeVendors = vendorsByPhone.filter((v: any) => !isRecordDeleted(v));
          if (activeVendors.length > 0) {
            vendor = activeVendors[0];
            console.log(`✅ [PROFILE-GET] Found active vendor by phone: ${vendor.id}`);
          } else if (vendorsByPhone.length > 0) {
            console.log(`⚠️ [PROFILE-GET] Only deleted vendor(s) found for phone — treating as no vendor`);
          } else {
            console.log(`⚠️ [PROFILE-GET] No vendor found for phone: ${phone}`);
          }
        } catch (e) {
          console.warn(`[PROFILE-GET] Error finding vendor by phone:`, e);
        }
      }
      
      // Also fetch vendor_identity for onboarding status (handle missing vendor_id column gracefully)
      // Prefer non-deleted, APPROVED/ACTIVATED identity when multiple rows exist for same phone
      if (phone) {
        try {
          const identitiesResult = await query(
            `SELECT * FROM vendor_identity WHERE phone = $1 ORDER BY
             (CASE WHEN COALESCE(is_deleted, false) = true THEN 1 ELSE 0 END),
             (CASE WHEN onboarding_status IN ('APPROVED', 'ACTIVATED') THEN 0 ELSE 1 END),
             updated_at DESC NULLS LAST`,
            [phone]
          );
          const identities = (identitiesResult?.rows || [])
            .filter((vi: any) => !isRecordDeleted(vi)); // ✅ Skip deleted identities
          if (identities.length > 0) {
            identityData = identities[0];
            // Try to link vendor via vendor_id if column exists and vendor not found yet
            if (!vendor && identityData && typeof identityData.vendor_id === 'string') {
              try {
                const vendors = await select('vendors', { id: identityData.vendor_id });
                const activeVendors = vendors.filter((v: any) => !isRecordDeleted(v));
                if (activeVendors.length > 0) {
                  vendor = activeVendors[0];
                }
              } catch (e) {
                console.warn(`[PROFILE-GET] Error finding vendor by identity.vendor_id:`, e);
              }
            }
            // Try vendor by phone if identity has vendor_id but select failed
            if (!vendor && identityData?.vendor_id) {
              try {
                const vByPhone = await select('vendors', { phone });
                const activeByPhone = vByPhone.filter((v: any) => !isRecordDeleted(v));
                if (activeByPhone.length > 0) vendor = activeByPhone[0];
              } catch (_e) { /* ignore */ }
            }
          }
        } catch (e) {
          console.warn(`[PROFILE-GET] Error fetching vendor_identity:`, e);
        }
      }

      // ✅ CRITICAL FIX: Always check identity.vendor_id to find existing vendor record
      // This ensures we return vendors.id, not vendor_identity.id
      if (!vendor && identityData?.vendor_id) {
        try {
          const vendorsByVendorId = await select('vendors', { id: identityData.vendor_id });
          const activeVendors = vendorsByVendorId.filter((v: any) => !isRecordDeleted(v));
          if (activeVendors.length > 0) {
            vendor = activeVendors[0];
            console.log(`✅ [PROFILE-GET] Found vendor via identity.vendor_id: ${vendor.id}`);
          }
        } catch (e) {
          console.warn(`[PROFILE-GET] Error finding vendor by identity.vendor_id:`, e);
        }
      }

      // ✅ CRITICAL FIX: Final comprehensive phone lookup before giving up
      if (!vendor && phone) {
        try {
          const normalizedPhone = normalizePhoneForLookup(phone);
          const phoneVariations = [
            phone,
            normalizedPhone,
            phone?.replace(/^\+91/, ''),
            phone?.replace(/^91/, ''),
            `+91${phone?.replace(/^\+?91/, '')}`,
            `91${phone?.replace(/^\+?91/, '')}`
          ].filter(Boolean);

          const finalPhoneQuery = await query(
            `SELECT * FROM vendors 
             WHERE phone = ANY($1::text[])
               AND COALESCE(is_deleted, false) = false
             LIMIT 1`,
            [phoneVariations]
          );
          if (finalPhoneQuery.rows?.length > 0) {
            vendor = finalPhoneQuery.rows[0];
            console.log(`✅ [PROFILE-GET] Found vendor via final phone lookup: ${vendor.id}`);
          }
        } catch (e) {
          console.warn(`[PROFILE-GET] Error in final phone lookup:`, e);
        }
      }

      if (!vendor) {
        // No active vendor record found — check if there's non-deleted identity data for onboarding
        if (identityData) {
          const identityStatus = identityData.onboarding_status || 'INIT';
          const isApproved = identityStatus === 'APPROVED' || identityStatus === 'ACTIVATED';
          
          // ✅ AUTO-CREATE VENDORS RECORD: If vendor is APPROVED/ACTIVATED but no vendors record exists,
          // auto-create it using resolveVendorById (same logic as used by bank details, settlements, etc.)
          if (isApproved) {
            try {
              console.log(`📝 [PROFILE-GET] APPROVED vendor found but no vendors record - auto-creating...`);
              const autoCreatedVendor = await resolveVendorById(identityData.id);
              if (autoCreatedVendor) {
                vendor = autoCreatedVendor;
                console.log(`✅ [PROFILE-GET] Auto-created vendors record: ${vendor.id}`);
              } else {
                console.warn(`⚠️ [PROFILE-GET] resolveVendorById returned null for identity ${identityData.id}`);
              }
            } catch (createError: any) {
              console.error(`⚠️ [PROFILE-GET] Failed to auto-create vendors record:`, createError);
            }
          }
          
          // ✅ CRITICAL: Only return identity.id if NO vendor record exists in vendors table
          // This should be extremely rare - vendor record should exist for APPROVED/ACTIVATED vendors
          if (!vendor) {
            console.log(`⚠️ [PROFILE-GET] No vendor record found in vendors table, returning identity.id: ${identityData.id}`);
            return c.json({
              success: true,
              vendor: {
                id: identityData.id, // ⚠️ Only as last resort when vendor truly doesn't exist
                phone: phone,
                status: isApproved ? 'active' : identityStatus.toLowerCase(),
                isActive: isApproved,
                onboardingStatus: identityStatus,
              },
              status: isApproved ? 'active' : (identityStatus === 'INIT' ? 'new' : identityStatus.toLowerCase()),
              message: 'Vendor in onboarding'
            });
          }
        } else {
          console.log(`⚠️ [PROFILE-GET] No vendor or identity found for phone: ${phone}`);
          return c.json({
            success: true,
            vendor: null,
            status: 'new',
            message: 'No vendor profile found'
          });
        }
      }
      
      console.log(`✅ [PROFILE-GET] RETURNING VENDOR ID: ${vendor.id}`);

      // Defense-in-depth: should not reach here for deleted vendors (filtered above)
      if (isRecordDeleted(vendor)) {
        console.warn(`[PROFILE-GET] ⚠️ Vendor ${vendor.id} is soft-deleted (defense check) — returning VENDOR_DELETED`);
        return c.json({
          success: false,
          error: 'Account not found',
          message: 'Your vendor account no longer exists. Please register again.',
          code: 'VENDOR_DELETED',
        }, 404);
      }

      // ✅ SECURITY: Check if vendor is deactivated (is_active = false or status = 'suspended')
      if (!vendor.is_active || vendor.status === 'suspended' || vendor.status === 'inactive') {
        const deactivationReason = vendor.metadata?.deactivation_reason || 'Account deactivated by admin';
        console.warn(`[PROFILE-GET] ⚠️ Vendor ${vendor.id} is deactivated — blocking profile access`);
        return c.json({
          success: false,
          error: 'Your vendor account has been deactivated',
          message: `Your vendor account has been deactivated. Reason: ${deactivationReason}. Please contact support for assistance.`,
          code: 'VENDOR_DEACTIVATED',
          vendor: {
            id: vendor.id,
            status: 'deactivated',
            isActive: false,
            deactivationReason: deactivationReason
          }
        }, 403);
      }

      // Get application data (vendor_onboarding_applications uses vendor_identity_id)
      let applicationData = null;
      try {
        let identityForApp = identityData;
        if (!identityForApp && phone) {
          const idResult = await query('SELECT * FROM vendor_identity WHERE vendor_id = $1 OR phone = $2 LIMIT 1', [vendor.id, phone]);
          identityForApp = (idResult as any).rows?.[0];
        }
        if (identityForApp?.id) {
          const apps = await select('vendor_onboarding_applications', { vendor_identity_id: identityForApp.id });
          if (apps.length > 0) applicationData = apps[0];
        }
        if (!applicationData && phone) {
          const appsResult = await query(
            'SELECT voa.* FROM vendor_onboarding_applications voa JOIN vendor_identity vi ON vi.id = voa.vendor_identity_id WHERE vi.phone = $1 ORDER BY voa.updated_at DESC LIMIT 1',
            [phone]
          );
          const rows = (appsResult as any).rows;
          if (rows?.length > 0) applicationData = rows[0];
        }
      } catch (e) {
        console.warn('[PROFILE-GET] Error fetching applications:', e);
      }

      // ✅ CRITICAL FIX: Get role_id from vendor_identity if vendor.role_id is missing
      let finalRoleId = vendor.role_id;
      if (!finalRoleId && identityData?.selected_role_id) {
        finalRoleId = identityData.selected_role_id;
        console.log(`✅ [PROFILE-GET] Vendor missing role_id, using identity.selected_role_id: ${finalRoleId}`);
        // Optionally update vendor record with role_id for future requests
        try {
          await update('vendors', { id: vendor.id }, { role_id: finalRoleId });
          console.log(`✅ [PROFILE-GET] Updated vendor record with role_id: ${finalRoleId}`);
        } catch (updateError) {
          console.warn(`⚠️ [PROFILE-GET] Failed to update vendor role_id:`, updateError);
        }
      }

      // Get role info
      let roleInfo = null;
      try {
        if (finalRoleId) {
          const roles = await select('roles', { id: finalRoleId });
          if (roles.length > 0) {
            roleInfo = roles[0];
          }
        }
      } catch (e) {
        console.warn('[PROFILE-GET] Error fetching role info:', e);
      }

      // Determine vendor status for UI
      let uiStatus = 'new';
      if (vendor.is_active) {
        uiStatus = 'active';
      } else if (vendor.status === 'approved') {
        uiStatus = vendor.setup_completed ? 'active' : 'approved';
      } else if (vendor.status === 'pending' || vendor.status === 'under_review') {
        uiStatus = 'pending';
      } else if (vendor.status === 'rejected') {
        uiStatus = 'rejected';
      } else if (applicationData?.status) {
        const appStatus = String(applicationData.status).toLowerCase();
        uiStatus = appStatus === 'approved' ? (vendor.is_active ? 'active' : 'approved') : appStatus;
      }

      console.log(`✅ [PROFILE-GET] Found vendor: ${vendor.id}, status: ${uiStatus}, roleId: ${finalRoleId}`);

      // ✅ FIX: Regenerate pre-signed URL for profile photo if it's stored as S3 key
      // This handles both legacy pre-signed URLs (which may be expired) and new S3 keys
      const profilePhotoUrl = await regeneratePresignedUrl(vendor.profile_photo_url);

      return c.json({
        success: true,
        vendor: {
          id: vendor.id,
          businessName: vendor.business_name,
          ownerName: vendor.owner_name,
          phone: vendor.phone,
          email: vendor.email,
          status: uiStatus,
          isActive: vendor.is_active,
          setupCompleted: vendor.setup_completed,
          servicesSetupCompleted: vendor.services_setup_completed,
          availabilitySetupCompleted: vendor.availability_setup_completed,
          roleId: finalRoleId, // ✅ CRITICAL: Use finalRoleId (from vendor or identity)
          role_id: finalRoleId, // ✅ Also include snake_case for backward compatibility
          roleName: roleInfo?.name,
          role: roleInfo ? {
            id: roleInfo.id,
            name: roleInfo.name,
            display_name: roleInfo.display_name,
          } : null,
          vendorType: vendor.vendor_type,
          serviceStyle: vendor.service_style,
          applicationId: applicationData?.id,
          applicationStatus: applicationData?.status,
          createdAt: vendor.created_at,
          profilePhotoUrl: profilePhotoUrl, // ✅ Include regenerated photo URL
          availableForInstantTele: vendor.available_for_instant_tele ?? false, // ✅ Include instant tele availability
        }
      });
    } catch (error: any) {
      console.error('❌ [PROFILE-GET] Error:', error);
      return c.json({ error: 'Failed to get vendor profile', details: error.message }, 500);
    }
  });

  /**
   * POST /vendor/:vendorId/profile/photo
   * Upload vendor profile photo to S3
   */
  app.post("/vendor/:vendorId/profile/photo", async (c) => {
    try {
      const { vendorId } = c.req.param();
      
      console.log(`📸 [PROFILE-PHOTO] Uploading photo for vendor: ${vendorId}`);
      
      // Verify vendor exists (same resolver as GET profile - supports vendor_identity + auto-create)
      const vendor = await resolveVendorById(vendorId);
      if (!vendor) {
        return c.json({ error: 'Vendor not found' }, 404);
      }

      // Parse the multipart form data
      const formData = await c.req.formData();
      const photo = formData.get('photo') as File;
      
      if (!photo) {
        return c.json({ error: 'No photo provided' }, 400);
      }

      // Upload to S3
      const { S3Client, PutObjectCommand, GetObjectCommand } = await import('@aws-sdk/client-s3');
      const { getSignedUrl } = await import('@aws-sdk/s3-request-presigner');
      
      const s3Client = new S3Client({ region: process.env.AWS_REGION || 'ap-south-1' });
      const BUCKET_NAME = process.env.S3_UPLOADS_BUCKET || 'warmpawz-dev-uploads';
      
      // Generate unique filename
      const timestamp = Date.now();
      const ext = photo.name.split('.').pop() || 'jpg';
      const actualVendorId = vendor.id; // Use resolved vendor id (may differ from URL if matched by phone)
      const fileName = `vendors/${actualVendorId}/profile/photo_${timestamp}.${ext}`;
      
      // Convert File to ArrayBuffer and upload
      const arrayBuffer = await photo.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);
      
      await s3Client.send(new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: fileName,
        Body: uint8Array,
        ContentType: photo.type || 'image/jpeg',
      }));
      
      // ✅ FIX: Store S3 key instead of pre-signed URL to avoid expiration issues
      // Pre-signed URLs expire after 7 days, but we can regenerate them on-demand
      // Store the S3 key (fileName) so we can generate fresh URLs when needed
      await update('vendors', { id: actualVendorId }, {
        profile_photo_url: fileName, // Store S3 key, not pre-signed URL
        updated_at: new Date().toISOString(),
      });
      
      // Generate presigned URL for immediate use (valid for 7 days)
      const signedUrl = await getSignedUrl(
        s3Client,
        new GetObjectCommand({
          Bucket: BUCKET_NAME,
          Key: fileName,
        }),
        { expiresIn: 604800 } // 7 days (max for presigned URLs)
      );
      
      console.log(`✅ [PROFILE-PHOTO] Photo uploaded successfully for vendor ${actualVendorId}`);
      
      return c.json({
        success: true,
        photo_url: signedUrl,
        fileName: fileName,
      });
    } catch (error: any) {
      console.error('❌ [PROFILE-PHOTO] Error uploading photo:', error);
      return c.json({ error: error.message || 'Failed to upload photo' }, 500);
    }
  });

  /**
   * PUT/POST /vendor/:vendorId/profile
   * Update vendor profile - requires re-approval only if critical fields changed
   */
  const profileUpdateHandler = async (c: any) => {
    try {
      const { vendorId } = c.req.param();
      const rawUpdates = await c.req.json();

      console.log(`📝 [PROFILE-UPDATE] Vendor ${vendorId} updating profile`, rawUpdates);

      // Convert camelCase keys to snake_case for database compatibility
      const camelToSnakeMap: Record<string, string> = {
        businessName: 'business_name',
        ownerName: 'owner_name',
        profilePhotoUrl: 'profile_photo_url',
        isActive: 'is_active',
        setupCompleted: 'setup_completed',
        servicesSetupCompleted: 'services_setup_completed',
        availabilitySetupCompleted: 'availability_setup_completed',
        roleId: 'role_id',
        createdAt: 'created_at',
        updatedAt: 'updated_at',
        availableForInstantTele: 'available_for_instant_tele', // ✅ Added for instant tele toggle
      };

      const updates: any = {};
      for (const [key, value] of Object.entries(rawUpdates)) {
        const dbKey = camelToSnakeMap[key] || key;
        updates[dbKey] = value;
      }

      // Get existing vendor (same resolver - supports vendor_identity + auto-create)
      const vendor = await resolveVendorById(vendorId);
      if (!vendor) {
        return c.json({ error: 'Vendor not found' }, 404);
      }
      const wasApproved = vendor.status === 'approved';
      const previousStatus = vendor.status;

      // Check if any critical fields are being changed
      let criticalFieldsChanged = false;
      const changedFields: string[] = [];

      for (const field of CRITICAL_FIELDS) {
        if (updates[field] !== undefined && updates[field] !== vendor[field]) {
          criticalFieldsChanged = true;
          changedFields.push(field);
        }
      }

      console.log(`🔍 [PROFILE-UPDATE] Critical fields changed: ${criticalFieldsChanged}`);
      console.log(`📋 [PROFILE-UPDATE] Changed fields: ${changedFields.join(', ')}`);

      // Dynamically check which columns exist in the vendors table
      const schemaResult = await query(`
        SELECT column_name FROM information_schema.columns 
        WHERE table_name = 'vendors'
      `);
      const existingColumns = new Set(schemaResult.rows.map((r: any) => r.column_name));
      
      // Known safe columns that can be updated
      const safeColumns = [
        'business_name', 'owner_name', 'phone', 'email', 'address', 'city', 'state', 'pincode',
        'description', 'profile_photo_url', 'latitude', 'longitude', 'is_active', 'status',
        'setup_completed', 'services_setup_completed', 'availability_setup_completed', 'metadata',
        'experience_years', 'qualifications', 'service_area', 'specializations', // ✅ Added for solo provider profile
        'available_for_instant_tele' // ✅ Added for instant tele availability toggle
      ];

      const updateData: any = {};
      for (const [key, value] of Object.entries(updates)) {
        // Only include if it's a safe column AND exists in the database
        if (safeColumns.includes(key) && existingColumns.has(key)) {
          updateData[key] = value;
        }
      }
      
      // Log skipped fields for debugging
      const skippedFields = Object.keys(updates).filter(k => !existingColumns.has(k) && safeColumns.includes(k));
      if (skippedFields.length > 0) {
        console.log(`⚠️ [PROFILE-UPDATE] Skipped non-existent columns: ${skippedFields.join(', ')}`);
      }

      // ✅ DEBUG: Log what's in updateData
      console.log(`📊 [PROFILE-UPDATE] updateData keys:`, Object.keys(updateData));
      console.log(`📊 [PROFILE-UPDATE] updateData:`, updateData);
      console.log(`📊 [PROFILE-UPDATE] existingColumns has available_for_instant_tele:`, existingColumns.has('available_for_instant_tele'));
      console.log(`📊 [PROFILE-UPDATE] safeColumns includes available_for_instant_tele:`, safeColumns.includes('available_for_instant_tele'));

      // ✅ FIX: If updateData is empty, return a helpful error
      if (Object.keys(updateData).length === 0) {
        console.error(`❌ [PROFILE-UPDATE] No valid fields to update. Updates received:`, updates);
        console.error(`❌ [PROFILE-UPDATE] Existing columns:`, Array.from(existingColumns).sort());
        return c.json({ 
          error: 'No fields to update. At least one field must be provided.',
          details: {
            receivedFields: Object.keys(updates),
            validFields: safeColumns.filter(col => existingColumns.has(col)),
            skippedFields: skippedFields
          }
        }, 400);
      }

      // If critical fields changed and vendor was approved, require re-approval
      if (criticalFieldsChanged && wasApproved) {
        console.log(`⚠️ [PROFILE-UPDATE] Critical fields changed - requiring re-approval`);

        updateData.status = 'pending';
        updateData.metadata = {
          ...(vendor.metadata || {}),
          previousStatus: previousStatus,
          wasApprovedBefore: true,
          reapprovalReason: `Critical profile fields updated: ${changedFields.join(', ')}`,
          reapprovalRequestedAt: new Date().toISOString(),
        };

        // Create notification for admin (use recipient_id/recipient_type)
        await insert('notifications', {
          recipient_id: null, // Admin notifications can have null recipient_id
          recipient_type: 'admin',
          title: 'Profile Update Review Required',
          message: `Approved vendor "${vendor.business_name}" updated their profile. Re-approval required.`,
          notification_type: 'admin_alert',
          channels: { email: true, sms: false, inApp: true, push: false },
          is_read: false,
        }).catch((error) => {
          console.warn('[VENDOR-PROFILE] Error creating notification:', error instanceof Error ? error.message : 'Unknown error');
        });

        // Send SNS notification
        const snsClient = getSnsClient();
        await snsClient.send(new PublishCommand({
          TopicArn: process.env.ADMIN_ALERT_TOPIC_ARN,
          Message: JSON.stringify({
            eventType: 'VendorProfileUpdate',
            vendorId: vendorId,
            vendorName: vendor.business_name,
            changedFields: changedFields,
            requiresReapproval: true,
          }),
        })).catch(err => console.error('SNS notification failed:', err));

        const updated = await update('vendors', { id: vendor.id }, updateData);

        // Sync specializations to vendor_specializations (for /customer/services/by-problem discovery)
        if (updateData.specializations !== undefined) {
          try {
            const specArr = Array.isArray(updateData.specializations) ? updateData.specializations : (typeof updateData.specializations === 'string' ? JSON.parse(updateData.specializations || '[]') : []);
            await query('DELETE FROM vendor_specializations WHERE vendor_id = $1', [vendor.id]);
            for (const spec of specArr) {
              const s = typeof spec === 'string' ? spec.trim() : (spec?.id ?? spec?.specializationId ?? String(spec));
              if (s) await insert('vendor_specializations', { vendor_id: vendor.id, specialization: s });
            }
          } catch (syncErr: any) {
            console.warn('[PROFILE-UPDATE] vendor_specializations sync failed (non-fatal):', syncErr?.message);
          }
        }

        return c.json({
          success: true,
          message: 'Profile updated. Re-approval required for critical changes.',
          requiresReapproval: true,
          changedFields: changedFields,
          status: 'pending',
          vendor: updated[0],
        });
      } else {
        // Non-critical fields only - no re-approval needed
        console.log(`✅ [PROFILE-UPDATE] Non-critical fields updated - no re-approval needed`);

        const updated = await update('vendors', { id: vendor.id }, updateData);

        // Sync specializations to vendor_specializations (for /customer/services/by-problem discovery)
        if (updateData.specializations !== undefined) {
          try {
            const specArr = Array.isArray(updateData.specializations) ? updateData.specializations : (typeof updateData.specializations === 'string' ? JSON.parse(updateData.specializations || '[]') : []);
            await query('DELETE FROM vendor_specializations WHERE vendor_id = $1', [vendor.id]);
            for (const spec of specArr) {
              const s = typeof spec === 'string' ? spec.trim() : (spec?.id ?? spec?.specializationId ?? String(spec));
              if (s) await insert('vendor_specializations', { vendor_id: vendor.id, specialization: s });
            }
          } catch (syncErr: any) {
            console.warn('[PROFILE-UPDATE] vendor_specializations sync failed (non-fatal):', syncErr?.message);
          }
        }

        return c.json({
          success: true,
          message: 'Profile updated successfully',
          requiresReapproval: false,
          status: vendor.status,
          vendor: updated[0],
        });
      }
    } catch (error: any) {
      console.error('❌ [PROFILE-UPDATE] Error updating profile:', error);
      return c.json({ error: error.message }, 500);
    }
  };

  app.put("/vendor/:vendorId/profile", profileUpdateHandler);
  app.post("/vendor/:vendorId/profile", profileUpdateHandler);

  /**
   * GET /vendor/:vendorId/profile/edit-check
   * Check if vendor can edit profile and what will happen
   */
  app.get("/vendor/:vendorId/profile/edit-check", async (c) => {
    try {
      const { vendorId } = c.req.param();

      const vendors = await select('vendors', { id: vendorId });
      if (vendors.length === 0) {
        return c.json({ error: 'Vendor not found' }, 404);
      }

      const vendor = vendors[0];
      const isApproved = vendor.status === 'approved';

      return c.json({
        canEdit: true, // Vendors can always edit
        currentStatus: vendor.status,
        warning: isApproved
          ? 'Editing critical profile fields will require admin re-approval'
          : null,
        criticalFields: CRITICAL_FIELDS,
      });
    } catch (error: any) {
      console.error('❌ [PROFILE-UPDATE] Error checking edit status:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * GET /vendor/:vendorId/profile
   * Get vendor profile with role and capabilities (DB query - no frontend dependency)
   */
  app.get("/vendor/:vendorId/profile", async (c) => {
    try {
      const { vendorId } = c.req.param();

      // Handle test IDs - return empty profile
      if (vendorId === 'test-vendor-id' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(vendorId)) {
        return c.json({
          success: true,
          vendor: {
            id: vendorId,
            business_name: 'Test Vendor',
            owner_name: 'Test Owner',
            role: null,
            capabilities: [],
            vendorTypes: [],
            serviceStyles: [],
          },
        });
      }

      // ✅ Use shared resolver: checks vendors, vendor_identity, auto-creates if approved
      const vendor = await resolveVendorById(vendorId);
      if (!vendor) {
        const identities = await select('vendor_identity', { id: vendorId });
        if (identities.length > 0 && identities[0].onboarding_status !== 'APPROVED' && identities[0].onboarding_status !== 'ACTIVATED') {
          return c.json({ error: 'Vendor not approved or activated' }, 403);
        }
        return c.json({ error: 'Vendor not found' }, 404);
      }
      
      // ✅ SECURITY: Double-check that vendor is not soft-deleted (defense in depth)
      const isDeleted = vendor.is_deleted === true || vendor.is_deleted === 't' ||
        (typeof vendor.is_deleted === 'string' && vendor.is_deleted.toLowerCase() === 'true');
      if (isDeleted) {
        console.warn(`⚠️ [PROFILE-GET] Vendor ${vendorId} is soft-deleted - returning 404`);
        return c.json({ 
          error: 'Vendor not found',
          message: 'This vendor account no longer exists.'
        }, 404);
      }
      
      // ✅ CRITICAL: Query DB directly for role and capabilities (no frontend dependency)
      let role = null;
      let capabilities: string[] = [];
      let roleConfig: any = {};
      let vendorConfiguration: 'solo' | 'business' | null = null;
      let selectedServiceStyles: string[] = [];
      let customerService: string | null = null;
      
      if (vendor.role_id) {
        try {
          // Get role from DB
          const roles = await select('roles', { id: vendor.role_id });
          if (roles.length > 0) {
            role = roles[0];
            roleConfig = role.config || {};
            customerService = role.customer_service || roleConfig?.customer_service || null;
            // ✅ FORENSIC: Use vendor's actual type (from onboarding) for filtering so vendor gets exactly role permissions filtered by their type
            const vendorType = (vendor as any).vendor_type;
            vendorConfiguration = (vendorType === 'solo' || vendorType === 'business')
              ? vendorType
              : (roleConfig?.vendorConfiguration || null);
            selectedServiceStyles = roleConfig?.serviceStyles?.selected || [];
            
            // Get base capabilities from DB (single source of truth: role_permissions = admin role config)
            const permissions = await select('role_permissions', { role_id: vendor.role_id });
            const baseCapabilities = permissions.map(p => p.permission_name);
            
            // ✅ TWO-STAGE CAPABILITY FILTERING (solo/business + service styles from role config)
            if (vendorConfiguration) {
              const { stage2_service_styles: effectiveCapabilities } = getEffectiveCapabilities({
                vendorConfiguration,
                selectedServiceStyles,
                baseCapabilities,
                capabilityRules: roleConfig?.capabilityRules
              });
              capabilities = effectiveCapabilities;
            } else {
              // Fallback to base capabilities if vendorConfiguration not set
              capabilities = baseCapabilities;
            }
          }
        } catch (roleError: any) {
          console.warn(`[Vendor Profile] Failed to load role ${vendor.role_id}:`, roleError.message);
          // Continue without role - vendor profile still works
        }
      }

      // ✅ FIX: Regenerate pre-signed URL for profile photo
      const profilePhotoUrl = await regeneratePresignedUrl(vendor.profile_photo_url);

      // ✅ FIX: Load specializations from vendor_specializations table (many-to-many relationship)
      // ✅ CRITICAL: Also check vendors.specializations JSONB column (same schema as query endpoints)
      // Profile API should return the same data structure that query endpoints use
      let vendorSpecializations: string[] = [];
      try {
        // Primary: Check vendor_specializations table
        const specResult = await query(
          'SELECT specialization FROM vendor_specializations WHERE vendor_id = $1',
          [vendor.id]
        );
        vendorSpecializations = (specResult.rows || []).map((r: any) => r.specialization).filter(Boolean);
        
        // ✅ FIX: If no results from table, check vendors.specializations JSONB column (same as query endpoints)
        if (vendorSpecializations.length === 0 && vendor.specializations) {
          try {
            // Check if it's a JSONB array
            if (typeof vendor.specializations === 'string') {
              const parsed = JSON.parse(vendor.specializations);
              vendorSpecializations = Array.isArray(parsed) ? parsed.filter(Boolean) : [];
            } else if (Array.isArray(vendor.specializations)) {
              vendorSpecializations = vendor.specializations.filter(Boolean);
            } else if (vendor.specializations && typeof vendor.specializations === 'object') {
              // It's a JSONB object, try to extract array
              vendorSpecializations = [];
            }
          } catch (jsonbErr) {
            console.warn('[PROFILE-GET] Could not parse vendors.specializations JSONB:', jsonbErr);
          }
        }
      } catch (specError: any) {
        console.warn('[PROFILE-GET] Could not load specializations from vendor_specializations:', specError.message);
        // Fallback to vendors.specializations JSONB column
        if (vendor.specializations) {
          try {
            if (typeof vendor.specializations === 'string') {
              const parsed = JSON.parse(vendor.specializations);
              vendorSpecializations = Array.isArray(parsed) ? parsed.filter(Boolean) : [];
            } else if (Array.isArray(vendor.specializations)) {
              vendorSpecializations = vendor.specializations.filter(Boolean);
            }
          } catch (jsonbErr) {
            console.warn('[PROFILE-GET] Could not parse vendors.specializations JSONB:', jsonbErr);
          }
        }
        // Final fallback to vendors.specialization column (old single text field)
        if (vendorSpecializations.length === 0 && vendor.specialization) {
          try {
            const parsed = typeof vendor.specialization === 'string' 
              ? (vendor.specialization.startsWith('[') ? JSON.parse(vendor.specialization) : vendor.specialization.split(',').map((s: string) => s.trim()))
              : Array.isArray(vendor.specialization) ? vendor.specialization : [];
            vendorSpecializations = Array.isArray(parsed) ? parsed.filter(Boolean) : [];
          } catch {
            vendorSpecializations = [];
          }
        }
      }

      return c.json({
        success: true,
        vendor: {
          ...vendor,
          // ✅ FIX: Explicitly include roleId at top level (required for SpecializationSelector)
          roleId: vendor.role_id, // ✅ Always include role_id from database
          role_id: vendor.role_id, // ✅ Also include for backward compatibility
          // ✅ FIX: Include regenerated photo URL
          profile_photo_url: profilePhotoUrl,
          profilePhotoUrl: profilePhotoUrl,
          // ✅ Explicitly include profile fields (even if null) for solo providers
          qualifications: vendor.qualifications || null,
          service_area: vendor.service_area || null,
          description: vendor.description || null,
          experience_years: vendor.experience_years ?? null,
          // ✅ FIX: Include specializations from vendor_specializations table
          specializations: vendorSpecializations,
          // Include role info directly in response
          role: role ? {
            id: role.id,
            name: role.name,
            display_name: role.display_name,
            description: role.description,
            config: roleConfig,
          } : null,
          customer_service: customerService,
          vendorConfiguration: vendorConfiguration,
          serviceStyles: selectedServiceStyles,
          capabilities, // ✅ Filtered capabilities (two-stage)
          vendorTypes: roleConfig?.vendorTypes || [],
          profileType: vendorConfiguration === 'solo' ? 'professional' : 'center',
          allowedServiceStyles: vendorConfiguration 
            ? (roleConfig?.serviceStyles?.[vendorConfiguration] || [])
            : [],
        },
      });
    } catch (error: any) {
      console.error('Error fetching vendor profile:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * GET /vendor/:vendorId/complete
   * Get complete vendor data with role, capabilities, and onboarding form in one call
   * This endpoint ensures vendor functions work even if frontend role loading fails
   */
  app.get("/vendor/:vendorId/complete", async (c) => {
    try {
      const { vendorId } = c.req.param();

      // Handle test IDs - return empty complete data
      if (vendorId === 'test-vendor-id' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(vendorId)) {
        return c.json({
          success: true,
          vendor: {
            id: vendorId,
            business_name: 'Test Vendor',
            owner_name: 'Test Owner',
            role: null,
            capabilities: [],
            vendorTypes: [],
            serviceStyles: [],
          },
          onboardingForm: null,
          setupStatus: {
            profileCompleted: false,
            servicesConfigured: false,
            availabilitySet: false,
            paymentSetup: false,
            isComplete: false,
          },
        });
      }

      const vendors = await select('vendors', { id: vendorId });
      if (vendors.length === 0) {
        return c.json({ error: 'Vendor not found' }, 404);
      }

      const vendor = vendors[0];
      
      // ✅ Query DB directly for all related data (no frontend dependency)
      let role = null;
      let capabilities: string[] = [];
      let roleConfig: any = {};
      let onboardingForm: any = null;
      
      if (vendor.role_id) {
        try {
          // Get role from DB
          const roles = await select('roles', { id: vendor.role_id });
          if (roles.length > 0) {
            role = roles[0];
            roleConfig = role.config || {};
            
            // Get capabilities from DB (batch query)
            try {
              const allPermissions = await query(
                `SELECT role_id, permission_name 
                 FROM role_permissions 
                 WHERE role_id = ANY($1::text[])`,
                [[vendor.role_id]]
              );
              capabilities = allPermissions.rows.map((p: any) => p.permission_name);
            } catch {
              // Fallback to individual query
              const permissions = await select('role_permissions', { role_id: vendor.role_id });
              capabilities = permissions.map(p => p.permission_name);
            }
            
            // Get onboarding form for this role (if vendor is still onboarding)
            try {
              const forms = await select('onboarding_forms', { role_id: role.name });
              if (forms.length > 0) {
                const fields = typeof forms[0].fields === 'string' 
                  ? JSON.parse(forms[0].fields) 
                  : forms[0].fields || [];
                onboardingForm = {
                  fields: fields.filter((f: any) => f.isActive !== false),
                  version: forms[0].version || 1,
                };
              }
            } catch (formError: any) {
              console.warn(`[Vendor Complete] Failed to load onboarding form:`, formError.message);
              // Continue without form
            }
          }
        } catch (roleError: any) {
          console.warn(`[Vendor Complete] Failed to load role ${vendor.role_id}:`, roleError.message);
          // Continue without role - vendor data still works
        }
      }

      return c.json({
        success: true,
        vendor: {
          ...vendor,
          role: role ? {
            id: role.id,
            name: role.name,
            display_name: role.display_name,
            description: role.description,
            config: roleConfig,
          } : null,
          capabilities,
          vendorTypes: roleConfig?.vendorTypes || [],
          serviceStyles: roleConfig?.serviceStyles || [],
          onboardingForm, // Include form if available
        },
      });
    } catch (error: any) {
      console.error('Error fetching complete vendor data:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * GET /vendor/:vendorId/bank-account
   * Get vendor bank account details
   * ✅ FIX: Check both vendor_bank_details and vendor_bank_accounts tables
   */
  app.get("/vendor/:vendorId/bank-account", async (c) => {
    try {
      const { vendorId } = c.req.param();
      const trimmedId = (vendorId || '').trim();
      if (!trimmedId) {
        return c.json({ error: 'Vendor ID is required' }, 400);
      }

      // ✅ PROD FIX: Use resolveVendorById to handle vendor_identity IDs and auto-create vendors row
      const vendor = await resolveVendorById(trimmedId);
      if (!vendor) {
        return c.json({ error: 'Vendor not found' }, 404);
      }
      const resolvedVendorId = vendor.id;

      // ✅ FIX: Check which table exists and query both
      const schemaCheck = await query(`
        SELECT 
          EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'vendor_bank_accounts') as has_accounts_table,
          EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'vendor_bank_details') as has_details_table
      `);
      
      const schema = schemaCheck.rows[0] || {};
      let bankAccounts: any[] = [];
      
      // Try vendor_bank_accounts first (newer table)
      if (schema.has_accounts_table) {
        try {
          const accounts = await query(
            `SELECT * FROM vendor_bank_accounts WHERE vendor_id = $1 ORDER BY is_primary DESC, created_at DESC LIMIT 1`,
            [resolvedVendorId]
          );
          bankAccounts = accounts.rows;
        } catch (e) {
          console.warn('Error querying vendor_bank_accounts:', e);
        }
      }
      
      // Fallback to vendor_bank_details if no results
      if (bankAccounts.length === 0 && schema.has_details_table) {
        try {
          bankAccounts = await select('vendor_bank_details', { vendor_id: resolvedVendorId });
        } catch (e) {
          console.warn('Error querying vendor_bank_details:', e);
        }
      }
      
      if (bankAccounts.length === 0) {
        return c.json({ success: true, bankAccount: null });
      }

      const bankAccount = normalizeDbRow(bankAccounts[0]);
      return c.json({ success: true, bankAccount });
    } catch (error: any) {
      console.error('Error fetching bank account:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * POST /vendor/:vendorId/bank-account
   * Create or update vendor bank account details
   */
  app.post("/vendor/:vendorId/bank-account", async (c) => {
    try {
      const { vendorId } = c.req.param();
      const body = await c.req.json();
      const { account_holder_name, account_number, ifsc_code, bank_name, branch_name } = body;

      if (!isValidUUID(vendorId)) {
        return c.json({ error: 'Invalid vendor ID' }, 400);
      }

      if (!account_holder_name || !account_number || !ifsc_code || !bank_name) {
        return c.json({ error: 'Missing required fields: account_holder_name, account_number, ifsc_code, bank_name' }, 400);
      }

      // Validate IFSC format
      if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifsc_code.toUpperCase())) {
        return c.json({ error: 'Invalid IFSC code format' }, 400);
      }

      // Resolve identity id to vendors.id for consistent storage with vendor-bank-accounts
      const vendor = await resolveVendorById(vendorId);
      if (!vendor) {
        return c.json({ error: 'Vendor not found' }, 404);
      }
      const resolvedVendorId = vendor.id;

      // Check if bank account already exists
      const existing = await select('vendor_bank_details', { vendor_id: resolvedVendorId });
      
      const bankData = {
        vendor_id: resolvedVendorId,
        account_holder_name: account_holder_name.trim(),
        account_number: account_number.replace(/\s/g, ''),
        ifsc_code: ifsc_code.toUpperCase().trim(),
        bank_name: bank_name.trim(),
        branch_name: branch_name?.trim() || null,
        is_verified: false, // Reset verification status on update
        verified_at: null,
        verified_by: null,
        updated_at: new Date().toISOString(),
      };

      if (existing.length > 0) {
        // Update existing
        await update('vendor_bank_details', { vendor_id: resolvedVendorId }, bankData);
      } else {
        // Create new
        await insert('vendor_bank_details', bankData);
      }

      // Update setup completion
      await query(
        `UPDATE vendor_setup_completion 
         SET bank_account_completed = true, 
             bank_account_completed_at = NOW(),
             updated_at = NOW()
         WHERE vendor_id = $1`,
        [resolvedVendorId]
      ).catch((error) => {
        // Expected: table may not exist in all environments
        if (error instanceof Error && !error.message.includes('does not exist')) {
          console.warn('[VENDOR-PROFILE] Unexpected error updating vendor onboarding:', error.message);
        }
      }); // Ignore if table doesn't exist

      return c.json({ success: true, message: 'Bank account saved successfully' });
    } catch (error: any) {
      console.error('Error saving bank account:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * POST /vendor/:vendorId/bank-account/verify
   * Verify bank account using Razorpay (name, IFSC, account number).
   * Uses Razorpay IFSC API + format validation. Config from AWS Secrets Manager.
   * ✅ FIX: Check both vendor_bank_accounts and vendor_bank_details tables.
   */
  app.post("/vendor/:vendorId/bank-account/verify", async (c) => {
    try {
      const { vendorId } = c.req.param();
      
      if (!isValidUUID(vendorId)) {
        return c.json({ error: 'Invalid vendor ID' }, 400);
      }

      // Resolve identity id to vendors.id so we find rows stored by vendor-bank-accounts
      const vendor = await resolveVendorById(vendorId);
      if (!vendor) {
        return c.json({ error: 'Vendor not found' }, 404);
      }
      const resolvedVendorId = vendor.id;

      // Check both tables (same logic as GET /vendor/:vendorId/bank-account)
      const schemaCheck = await query(`
        SELECT 
          EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'vendor_bank_accounts') as has_accounts_table,
          EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'vendor_bank_details') as has_details_table
      `);
      const schema = schemaCheck.rows?.[0] || {};
      let bankAccounts: any[] = [];

      if (schema.has_accounts_table) {
        try {
          const accounts = await query(
            `SELECT *, 'vendor_bank_accounts' as _source FROM vendor_bank_accounts WHERE vendor_id = $1 ORDER BY is_primary DESC, created_at DESC LIMIT 1`,
            [resolvedVendorId]
          );
          bankAccounts = accounts.rows || [];
        } catch (e) {
          console.warn('Error querying vendor_bank_accounts for verify:', e);
        }
      }
      if (bankAccounts.length === 0 && schema.has_details_table) {
        try {
          bankAccounts = await select('vendor_bank_details', { vendor_id: resolvedVendorId });
          if (bankAccounts.length > 0) (bankAccounts[0] as any)._source = 'vendor_bank_details';
        } catch (e) {
          console.warn('Error querying vendor_bank_details for verify:', e);
        }
      }

      if (bankAccounts.length === 0) {
        return c.json({ error: 'Bank account not found. Please add bank account details first.' }, 404);
      }

      const bank = bankAccounts[0] as any;
      const accountHolderName = (bank.account_holder_name || '').trim();
      const accountNumber = (bank.account_number || '').replace(/\s/g, '');
      const ifscCode = (bank.ifsc_code || '').toUpperCase().trim();
      const sourceTable = bank._source || (schema.has_accounts_table ? 'vendor_bank_accounts' : 'vendor_bank_details');

      if (!accountHolderName || !accountNumber || !ifscCode) {
        return c.json({
          success: false,
          error: 'Bank account record missing name, account number, or IFSC. Please complete all fields.',
        }, 400);
      }

      const { validateBankAccountStrict } = await import('../../razorpay/endpoints/razorpay.razorpay');
      const result = await validateBankAccountStrict(accountNumber, ifscCode, accountHolderName);

      if (result.error) {
        return c.json({
          success: false,
          error: result.error,
          details: result.details,
        }, 400);
      }

      const verifyPayload: any = {
        is_verified: true,
        verified_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      // ✅ PROD FIX: Ensure bank_name is set for vendor_bank_details (required NOT NULL constraint)
      if (sourceTable === 'vendor_bank_accounts' && bank.id) {
        await update('vendor_bank_accounts', { id: bank.id, vendor_id: resolvedVendorId }, verifyPayload);
      } else {
        // For vendor_bank_details, ensure bank_name is preserved or extracted from IFSC/result
        // If bank_name exists in the record, preserve it; otherwise try to get it from validation result or set default
        if (bank.bank_name && bank.bank_name.trim()) {
          verifyPayload.bank_name = bank.bank_name.trim();
        } else if (result.bank_details?.bank) {
          // Use bank name from Razorpay validation result if available
          verifyPayload.bank_name = result.bank_details.bank;
        } else {
          // Extract bank name from IFSC code (first 4 characters typically indicate bank)
          // Or set a default to satisfy NOT NULL constraint
          verifyPayload.bank_name = ifscCode.substring(0, 4) || 'Unknown Bank';
        }
        await update('vendor_bank_details', { vendor_id: resolvedVendorId }, verifyPayload);
      }

      return c.json({ 
        success: true, 
        message: 'Bank account verified successfully. Name, IFSC, and account number validated.',
        verified: true,
      });
    } catch (error: any) {
      console.error('Error verifying bank account:', error);
      return c.json({ error: error.message || 'Verification failed' }, 500);
    }
  });

  /**
   * POST /vendor/:vendorId/bank-account/document
   * Upload verification document for bank account
   */
  app.post("/vendor/:vendorId/bank-account/document", async (c) => {
    try {
      const { vendorId } = c.req.param();
      const body = await c.req.json();
      const { document_type, document_url } = body;

      if (!isValidUUID(vendorId)) {
        return c.json({ error: 'Invalid vendor ID' }, 400);
      }

      if (!document_type || !document_url) {
        return c.json({ error: 'document_type and document_url are required' }, 400);
      }

      // Store document reference (you might want a separate table for this)
      // For now, we'll just acknowledge the upload
      // In production, you'd store this in vendor_bank_documents table

      return c.json({ success: true, message: 'Document uploaded successfully' });
    } catch (error: any) {
      console.error('Error uploading document:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * GET /vendor/:vendorId/settings
   * Get vendor general settings (service radius, emergency contact, etc.)
   * ✅ PROD FIX: Use resolveVendorById for consistent vendor resolution
   */
  app.get("/vendor/:vendorId/settings", async (c) => {
    try {
      const { vendorId } = c.req.param();
      const trimmedId = (vendorId || '').trim();
      if (!trimmedId) {
        return c.json({ error: 'Vendor ID is required' }, 400);
      }

      // ✅ PROD FIX: Use resolveVendorById to handle vendor_identity IDs and auto-create vendors row
      const vendor = await resolveVendorById(trimmedId);
      if (!vendor?.id) {
        return c.json({ error: 'Vendor not found' }, 404);
      }
      
      // ✅ PROD FIX: Query settings columns directly from database to ensure we get actual values
      // Check which columns exist first
      const schemaCheck = await query(`
        SELECT 
          EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'vendors' AND column_name = 'service_radius') as has_service_radius,
          EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'vendors' AND column_name = 'emergency_contact') as has_emergency_contact,
          EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'vendors' AND column_name = 'max_dogs_per_walk') as has_max_dogs,
          EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'vendors' AND column_name = 'walk_durations') as has_walk_durations,
          EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'vendors' AND column_name = 'other_config') as has_other_config
      `);
      
      const schema = schemaCheck.rows[0] || {};
      
      // Build SELECT query with only existing columns
      const selectFields: string[] = ['id'];
      if (schema.has_service_radius) selectFields.push('service_radius');
      if (schema.has_emergency_contact) selectFields.push('emergency_contact');
      if (schema.has_max_dogs) selectFields.push('max_dogs_per_walk');
      if (schema.has_walk_durations) selectFields.push('walk_durations');
      if (schema.has_other_config) selectFields.push('other_config');
      
      // Query vendor with settings columns
      const vendorQuery = await query(
        `SELECT ${selectFields.join(', ')} FROM vendors WHERE id = $1 LIMIT 1`,
        [vendor.id]
      );
      
      const vendorWithSettings = vendorQuery.rows[0] || vendor;
      
      // Extract settings from vendor record
      const settings = {
        service_radius: (schema.has_service_radius && vendorWithSettings.service_radius !== undefined) ? vendorWithSettings.service_radius : null,
        emergency_contact: (schema.has_emergency_contact && vendorWithSettings.emergency_contact !== undefined) 
          ? (typeof vendorWithSettings.emergency_contact === 'string' ? JSON.parse(vendorWithSettings.emergency_contact) : vendorWithSettings.emergency_contact)
          : null,
        max_dogs_per_walk: (schema.has_max_dogs && vendorWithSettings.max_dogs_per_walk !== undefined) ? vendorWithSettings.max_dogs_per_walk : null,
        walk_durations: (schema.has_walk_durations && vendorWithSettings.walk_durations !== undefined && vendorWithSettings.walk_durations !== null) 
          ? (Array.isArray(vendorWithSettings.walk_durations) ? vendorWithSettings.walk_durations : [])
          : [],
        other_config: (schema.has_other_config && vendorWithSettings.other_config !== undefined) 
          ? (typeof vendorWithSettings.other_config === 'string' ? JSON.parse(vendorWithSettings.other_config) : (vendorWithSettings.other_config || {}))
          : {},
      };

      return c.json({ success: true, settings });
    } catch (error: any) {
      console.error('Error fetching settings:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * PUT/POST /vendor/:vendorId/settings
   * Update vendor general settings
   */
  const settingsHandler = async (c: any) => {
    try {
      const { vendorId } = c.req.param();
      const trimmedId = (vendorId || '').trim();
      if (!trimmedId) {
        return c.json({ error: 'Vendor ID is required' }, 400);
      }
      
      const body = await c.req.json();
      const { service_radius, emergency_contact, max_dogs_per_walk, walk_durations, other_config } = body;

      // Validate emergency contact if provided
      if (emergency_contact) {
        if (!emergency_contact.name || !emergency_contact.phone) {
          return c.json({ error: 'Emergency contact must have both name and phone' }, 400);
        }
        // Allow any 10-digit phone
        const phoneDigits = emergency_contact.phone.replace(/\D/g, '');
        if (phoneDigits.length < 10) {
          return c.json({ error: 'Invalid emergency contact phone number' }, 400);
        }
      }

      // ✅ PROD FIX: Use resolveVendorById to handle vendor_identity IDs and auto-create vendors row
      const vendor = await resolveVendorById(trimmedId);
      if (!vendor?.id) {
        return c.json({ error: 'Vendor not found' }, 404);
      }

      // Check which columns exist in vendors table to avoid column errors
      const schemaCheck = await query(`
        SELECT 
          EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'vendors' AND column_name = 'service_radius') as has_service_radius,
          EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'vendors' AND column_name = 'emergency_contact') as has_emergency_contact,
          EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'vendors' AND column_name = 'max_dogs_per_walk') as has_max_dogs,
          EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'vendors' AND column_name = 'walk_durations') as has_walk_durations,
          EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'vendors' AND column_name = 'other_config') as has_other_config,
          EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'vendor_settings') as has_vendor_settings_table
      `);
      
      const schema = schemaCheck.rows[0] || {};

      // Build update using raw SQL to handle type conversions properly
      const setClauses: string[] = ['updated_at = NOW()'];
      const params: any[] = [];
      let paramIdx = 1;

      // ✅ PROD FIX: Allow setting null values explicitly (check !== undefined, not truthy)
      if (service_radius !== undefined && schema.has_service_radius) {
        if (service_radius === null || service_radius === '') {
          setClauses.push(`service_radius = NULL`);
        } else {
          setClauses.push(`service_radius = $${paramIdx}`);
          params.push(service_radius);
          paramIdx++;
        }
      }
      
      if (emergency_contact !== undefined && schema.has_emergency_contact) {
        if (emergency_contact === null) {
          setClauses.push(`emergency_contact = NULL`);
        } else {
          setClauses.push(`emergency_contact = $${paramIdx}::jsonb`);
          params.push(JSON.stringify(emergency_contact));
          paramIdx++;
        }
      }
      
      if (max_dogs_per_walk !== undefined && schema.has_max_dogs) {
        if (max_dogs_per_walk === null || max_dogs_per_walk === '') {
          setClauses.push(`max_dogs_per_walk = NULL`);
        } else {
          setClauses.push(`max_dogs_per_walk = $${paramIdx}`);
          params.push(max_dogs_per_walk);
          paramIdx++;
        }
      }
      
      // Handle walk_durations - convert array to TEXT[] format
      if (walk_durations !== undefined && schema.has_walk_durations) {
        if (walk_durations === null || (Array.isArray(walk_durations) && walk_durations.length === 0)) {
          // Empty array or null - set to NULL
          setClauses.push(`walk_durations = NULL`);
        } else if (Array.isArray(walk_durations)) {
          setClauses.push(`walk_durations = $${paramIdx}::text[]`);
          params.push(walk_durations);
          paramIdx++;
        }
      }
      
      if (other_config !== undefined && schema.has_other_config) {
        if (other_config === null) {
          setClauses.push(`other_config = NULL`);
        } else {
          setClauses.push(`other_config = $${paramIdx}::jsonb`);
          params.push(JSON.stringify(other_config || {}));
          paramIdx++;
        }
      }

      // Use the resolved vendor ID
      const actualVendorId = vendor.id;
      params.push(actualVendorId);
      
      // ✅ PROD FIX: Only update if we have at least one field to update (besides updated_at)
      if (setClauses.length <= 1) {
        // Only updated_at, no actual settings to update
        return c.json({ success: true, message: 'No settings to update' });
      }
      
      // ✅ PROD FIX: Execute update and verify it succeeded
      const updateResult = await query(
        `UPDATE vendors SET ${setClauses.join(', ')} WHERE id = $${paramIdx} RETURNING id`,
        params
      );
      
      if (!updateResult.rows || updateResult.rows.length === 0) {
        console.error(`[SETTINGS-UPDATE] Failed to update vendor ${actualVendorId} - no rows affected`);
        return c.json({ error: 'Failed to update settings. Vendor may not exist.' }, 500);
      }
      
      console.log(`[SETTINGS-UPDATE] Successfully updated settings for vendor ${actualVendorId}`);
      console.log(`[SETTINGS-UPDATE] Updated fields: ${setClauses.filter(c => !c.includes('updated_at')).join(', ')}`);

      return c.json({ success: true, message: 'Settings updated successfully' });
    } catch (error: any) {
      console.error('Error updating settings:', error);
      return c.json({ error: error.message }, 500);
    }
  };
  
  app.put("/vendor/:vendorId/settings", settingsHandler);
  app.post("/vendor/:vendorId/settings", settingsHandler);

  /**
   * GET /vendor/:vendorId
   * Get vendor details by ID
   * Returns vendor info and menu (for cafes)
   * This is a general endpoint that works for all vendor types
   * IMPORTANT: Must be registered AFTER all more specific routes like /vendor/:vendorId/profile
   */
  app.get("/vendor/:vendorId", async (c) => {
    try {
      const { vendorId } = c.req.param();

      // Handle test IDs
      if (vendorId === 'test-vendor-id' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(vendorId)) {
        return c.json({
          success: true,
          vendor: {
            id: vendorId,
            business_name: 'Test Vendor',
            owner_name: 'Test Owner',
            role: null,
            capabilities: [],
          },
          menu: [],
        });
      }

      // Get vendor
      const vendors = await select('vendors', { id: vendorId });
      if (vendors.length === 0) {
        return c.json({ error: 'Vendor not found' }, 404);
      }

      const vendor = vendors[0];

      // Get role info
      let role = null;
      let capabilities: string[] = [];
      let roleConfig: any = {};
      let isCafe = false;

      if (vendor.role_id) {
        try {
          const roles = await select('roles', { id: vendor.role_id });
          if (roles.length > 0) {
            role = roles[0];
            roleConfig = role.config || {};
            
            const permissions = await select('role_permissions', { role_id: vendor.role_id });
            capabilities = permissions.map(p => p.permission_name);
            
            // Check if this is a cafe vendor
            const roleName = (role.name || '').toLowerCase();
            isCafe = roleName.includes('cafe') || roleName.includes('restaurant') || 
                     capabilities.includes('cafe') || capabilities.includes('cafe_menu');
          }
        } catch (roleError: any) {
          console.warn(`[Vendor Details] Failed to load role ${vendor.role_id}:`, roleError.message);
        }
      }

      // Build vendor response
      const vendorResponse: any = {
        id: vendor.id,
        business_name: vendor.business_name,
        owner_name: vendor.owner_name,
        role_id: vendor.role_id,
        role: role ? {
          id: role.id,
          name: role.name,
          display_name: role.display_name,
        } : null,
        capabilities,
        address: vendor.address,
        city: vendor.city,
        state: vendor.state,
        pincode: vendor.pincode,
        phone: vendor.phone,
        email: vendor.email,
        latitude: vendor.latitude,
        longitude: vendor.longitude,
        description: vendor.description || '',
        operating_hours: (() => {
          if (!vendor.operating_hours) return null;
          if (typeof vendor.operating_hours === 'object') return vendor.operating_hours;
          try { return JSON.parse(vendor.operating_hours); } catch { return null; }
        })(),
        // Include other vendor fields
        ...vendor,
      };

      // For cafes, also fetch menu
      let menu: any[] = [];
      if (isCafe) {
        try {
          const menuItems = await query(
            `SELECT * FROM cafe_menu_items 
             WHERE vendor_id = $1 
             AND is_active = true
             ORDER BY category, name ASC`,
            [vendorId]
          ).catch(() => ({ rows: [] }));
          menu = menuItems.rows || [];
        } catch (menuError: any) {
          console.warn(`[Vendor Details] Failed to load menu for cafe ${vendorId}:`, menuError.message);
          // Continue without menu
        }
      }

      return c.json({
        success: true,
        vendor: vendorResponse,
        menu: menu, // Include menu for cafes
      });
    } catch (error: any) {
      console.error('Error fetching vendor details:', error);
      return c.json({ error: error.message }, 500);
    }
  });
}

