"use strict";
/**
 * ============================================================================
 * VENDOR API CONTRACTS
 * ============================================================================
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.VendorListResponseSchema = exports.GetVendorResponseSchema = exports.SubmitApplicationResponseSchema = exports.VendorRoleSchema = exports.VendorOnboardingApplicationSchema = exports.VendorSchema = exports.UpdateVendorProfileRequestSchema = exports.AdminReviewApplicationRequestSchema = exports.SelectVendorTypeRequestSchema = exports.SelectVendorRoleRequestSchema = exports.SubmitVendorApplicationRequestSchema = void 0;
const zod_1 = require("zod");
// ============================================================================
// REQUEST SCHEMAS
// ============================================================================
exports.SubmitVendorApplicationRequestSchema = zod_1.z.object({
    phone: zod_1.z.string().regex(/^\+?[1-9]\d{1,14}$/, 'Invalid phone number format'),
    application_payload: zod_1.z.record(zod_1.z.unknown()), // Dynamic based on role
    uploaded_documents: zod_1.z.array(zod_1.z.object({
        type: zod_1.z.string(),
        url: zod_1.z.string().url(),
        name: zod_1.z.string(),
    })).optional(),
});
exports.SelectVendorRoleRequestSchema = zod_1.z.object({
    phone: zod_1.z.string().regex(/^\+?[1-9]\d{1,14}$/, 'Invalid phone number format'),
    role_id: zod_1.z.string().uuid('Invalid role ID format'),
});
exports.SelectVendorTypeRequestSchema = zod_1.z.object({
    phone: zod_1.z.string().regex(/^\+?[1-9]\d{1,14}$/, 'Invalid phone number format'),
    vendor_type: zod_1.z.enum(['solo', 'business'], {
        errorMap: () => ({ message: 'Vendor type must be solo or business' }),
    }),
});
exports.AdminReviewApplicationRequestSchema = zod_1.z.object({
    action: zod_1.z.enum(['APPROVE', 'REQUEST_CLARIFICATION', 'REJECT'], {
        errorMap: () => ({ message: 'Action must be APPROVE, REQUEST_CLARIFICATION, or REJECT' }),
    }),
    admin_id: zod_1.z.string().uuid('Invalid admin ID format'),
    comments: zod_1.z.string().max(2000, 'Comments too long').optional(),
    rejection_reason: zod_1.z.string().max(500, 'Rejection reason too long').optional(),
});
exports.UpdateVendorProfileRequestSchema = zod_1.z.object({
    business_name: zod_1.z.string().min(1, 'Business name required').max(200, 'Business name too long').optional(),
    owner_name: zod_1.z.string().min(1, 'Owner name required').max(100, 'Owner name too long').optional(),
    email: zod_1.z.string().email('Invalid email format').optional(),
    address: zod_1.z.string().max(500, 'Address too long').optional(),
    city: zod_1.z.string().max(100, 'City name too long').optional(),
    state: zod_1.z.string().max(100, 'State name too long').optional(),
    pincode: zod_1.z.string().regex(/^\d{6}$/, 'Invalid pincode format').optional(),
    latitude: zod_1.z.number().min(-90).max(90).optional(),
    longitude: zod_1.z.number().min(-180).max(180).optional(),
    description: zod_1.z.string().max(2000, 'Description too long').optional(),
    logo_url: zod_1.z.string().url('Invalid logo URL').optional(),
    cover_image_url: zod_1.z.string().url('Invalid cover image URL').optional(),
});
// ============================================================================
// RESPONSE SCHEMAS
// ============================================================================
exports.VendorSchema = zod_1.z.object({
    id: zod_1.z.string().uuid(),
    phone: zod_1.z.string(),
    email: zod_1.z.string().nullable(),
    business_name: zod_1.z.string(),
    owner_name: zod_1.z.string(),
    role_id: zod_1.z.string().uuid().nullable(),
    vendor_type: zod_1.z.enum(['solo', 'business']),
    status: zod_1.z.enum(['pending', 'approved', 'rejected', 'active', 'inactive', 'suspended']),
    tier: zod_1.z.string(),
    address: zod_1.z.string().nullable(),
    city: zod_1.z.string().nullable(),
    state: zod_1.z.string().nullable(),
    pincode: zod_1.z.string().nullable(),
    latitude: zod_1.z.number().nullable(),
    longitude: zod_1.z.number().nullable(),
    description: zod_1.z.string().nullable(),
    logo_url: zod_1.z.string().nullable(),
    cover_image_url: zod_1.z.string().nullable(),
    onboarding_status: zod_1.z.string(),
    createdAt: zod_1.z.string().datetime(),
    updatedAt: zod_1.z.string().datetime(),
});
exports.VendorOnboardingApplicationSchema = zod_1.z.object({
    id: zod_1.z.string().uuid(),
    vendor_identity_id: zod_1.z.string().uuid(),
    role_id: zod_1.z.string().uuid(),
    vendor_type: zod_1.z.enum(['solo', 'business']),
    status: zod_1.z.enum(['DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'CLARIFICATION_REQUIRED', 'ACTIVATED']),
    application_payload: zod_1.z.record(zod_1.z.unknown()),
    uploaded_documents: zod_1.z.array(zod_1.z.unknown()),
    form_version: zod_1.z.string(),
    admin_comments: zod_1.z.string().nullable(),
    rejection_reason: zod_1.z.string().nullable(),
    reviewed_by: zod_1.z.string().uuid().nullable(),
    reviewed_at: zod_1.z.string().datetime().nullable(),
    submitted_at: zod_1.z.string().datetime().nullable(),
    createdAt: zod_1.z.string().datetime(),
    updatedAt: zod_1.z.string().datetime(),
});
exports.VendorRoleSchema = zod_1.z.object({
    id: zod_1.z.string().uuid(),
    name: zod_1.z.string(),
    display_name: zod_1.z.string(),
    description: zod_1.z.string().nullable(),
    is_active: zod_1.z.boolean(),
    config: zod_1.z.record(zod_1.z.unknown()).optional(),
    capabilities: zod_1.z.array(zod_1.z.string()).optional(),
});
exports.SubmitApplicationResponseSchema = zod_1.z.object({
    success: zod_1.z.literal(true),
    data: zod_1.z.object({
        message: zod_1.z.string(),
        applicationId: zod_1.z.string().uuid(),
        nextStep: zod_1.z.string(),
    }),
});
exports.GetVendorResponseSchema = zod_1.z.object({
    success: zod_1.z.literal(true),
    data: zod_1.z.object({
        vendor: exports.VendorSchema,
    }),
});
exports.VendorListResponseSchema = zod_1.z.object({
    success: zod_1.z.literal(true),
    data: zod_1.z.object({
        vendors: zod_1.z.array(exports.VendorSchema),
        total: zod_1.z.number(),
        page: zod_1.z.number().optional(),
        limit: zod_1.z.number().optional(),
    }),
});
