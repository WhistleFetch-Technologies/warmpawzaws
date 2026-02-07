/**
 * ============================================================================
 * VENDOR API CONTRACTS
 * ============================================================================
 */

import { z } from 'zod';

// ============================================================================
// REQUEST SCHEMAS
// ============================================================================

export const SubmitVendorApplicationRequestSchema = z.object({
  // ✅ FIX: More lenient phone validation - accepts 10-15 digits with optional + prefix
  // Handles: 9876543210, +919876543210, 919876543210, etc.
  phone: z.string().min(10, 'Phone must be at least 10 digits').max(16, 'Phone too long')
    .transform(p => p.replace(/\D/g, '')), // Remove non-digits for storage
  application_payload: z.record(z.unknown()), // Dynamic based on role
  // ✅ FIX: Make documents more flexible - URL can be empty or missing during submission
  uploaded_documents: z.array(z.object({
    type: z.string(),
    url: z.string().optional().default(''), // URL is optional during submission
    name: z.string().optional().default(''),
  })).optional().default([]),
});

export const SelectVendorRoleRequestSchema = z.object({
  phone: z.string().regex(/^\+?[1-9]\d{1,14}$/, 'Invalid phone number format'),
  role_id: z.string().uuid('Invalid role ID format'),
});

export const SelectVendorTypeRequestSchema = z.object({
  phone: z.string().regex(/^\+?[1-9]\d{1,14}$/, 'Invalid phone number format'),
  vendor_type: z.enum(['solo', 'business'], {
    errorMap: () => ({ message: 'Vendor type must be solo or business' }),
  }),
});

export const AdminReviewApplicationRequestSchema = z.object({
  action: z.enum(['APPROVE', 'REQUEST_CLARIFICATION', 'REJECT'], {
    errorMap: () => ({ message: 'Action must be APPROVE, REQUEST_CLARIFICATION, or REJECT' }),
  }),
  admin_id: z.string().min(1, 'Admin ID is required'), // Allow non-UUID (e.g. "admin") for compatibility
  comments: z.string().max(2000, 'Comments too long').optional(),
  rejection_reason: z.string().max(500, 'Rejection reason too long').optional(),
});

export const UpdateVendorProfileRequestSchema = z.object({
  business_name: z.string().min(1, 'Business name required').max(200, 'Business name too long').optional(),
  owner_name: z.string().min(1, 'Owner name required').max(100, 'Owner name too long').optional(),
  email: z.string().email('Invalid email format').optional(),
  address: z.string().max(500, 'Address too long').optional(),
  city: z.string().max(100, 'City name too long').optional(),
  state: z.string().max(100, 'State name too long').optional(),
  pincode: z.string().regex(/^\d{6}$/, 'Invalid pincode format').optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  description: z.string().max(2000, 'Description too long').optional(),
  logo_url: z.string().url('Invalid logo URL').optional(),
  cover_image_url: z.string().url('Invalid cover image URL').optional(),
});

// ============================================================================
// RESPONSE SCHEMAS
// ============================================================================

export const VendorSchema = z.object({
  id: z.string().uuid(),
  phone: z.string(),
  email: z.string().nullable(),
  business_name: z.string(),
  owner_name: z.string(),
  role_id: z.string().uuid().nullable(),
  vendor_type: z.enum(['solo', 'business']),
  status: z.enum(['pending', 'approved', 'rejected', 'active', 'inactive', 'suspended']),
  tier: z.string(),
  address: z.string().nullable(),
  city: z.string().nullable(),
  state: z.string().nullable(),
  pincode: z.string().nullable(),
  latitude: z.number().nullable(),
  longitude: z.number().nullable(),
  description: z.string().nullable(),
  logo_url: z.string().nullable(),
  cover_image_url: z.string().nullable(),
  onboarding_status: z.string(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const VendorOnboardingApplicationSchema = z.object({
  id: z.string().uuid(),
  vendor_identity_id: z.string().uuid(),
  role_id: z.string().uuid(),
  vendor_type: z.enum(['solo', 'business']),
  status: z.enum(['DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'CLARIFICATION_REQUIRED', 'ACTIVATED']),
  application_payload: z.record(z.unknown()),
  uploaded_documents: z.array(z.unknown()),
  form_version: z.string(),
  admin_comments: z.string().nullable(),
  rejection_reason: z.string().nullable(),
  reviewed_by: z.string().uuid().nullable(),
  reviewed_at: z.string().datetime().nullable(),
  submitted_at: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const VendorRoleSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  display_name: z.string(),
  description: z.string().nullable(),
  is_active: z.boolean(),
  config: z.record(z.unknown()).optional(),
  capabilities: z.array(z.string()).optional(),
});

export const SubmitApplicationResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    message: z.string(),
    applicationId: z.string().uuid(),
    nextStep: z.string(),
  }),
});

export const GetVendorResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    vendor: VendorSchema,
  }),
});

export const VendorListResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    vendors: z.array(VendorSchema),
    total: z.number(),
    page: z.number().optional(),
    limit: z.number().optional(),
  }),
});

// ============================================================================
// TYPES
// ============================================================================

export type SubmitVendorApplicationRequest = z.infer<typeof SubmitVendorApplicationRequestSchema>;
export type SelectVendorRoleRequest = z.infer<typeof SelectVendorRoleRequestSchema>;
export type SelectVendorTypeRequest = z.infer<typeof SelectVendorTypeRequestSchema>;
export type AdminReviewApplicationRequest = z.infer<typeof AdminReviewApplicationRequestSchema>;
export type UpdateVendorProfileRequest = z.infer<typeof UpdateVendorProfileRequestSchema>;
export type Vendor = z.infer<typeof VendorSchema>;
export type VendorOnboardingApplication = z.infer<typeof VendorOnboardingApplicationSchema>;
export type VendorRole = z.infer<typeof VendorRoleSchema>;
export type SubmitApplicationResponse = z.infer<typeof SubmitApplicationResponseSchema>;
export type GetVendorResponse = z.infer<typeof GetVendorResponseSchema>;
export type VendorListResponse = z.infer<typeof VendorListResponseSchema>;

