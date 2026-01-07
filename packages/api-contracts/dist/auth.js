"use strict";
/**
 * ============================================================================
 * AUTHENTICATION API CONTRACTS
 * ============================================================================
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthResponseSchema = exports.UserSchema = exports.AuthTokenSchema = exports.RefreshTokenRequestSchema = exports.AdminLoginRequestSchema = exports.VerifyOtpRequestSchema = exports.SendOtpRequestSchema = void 0;
const zod_1 = require("zod");
// ============================================================================
// REQUEST SCHEMAS
// ============================================================================
exports.SendOtpRequestSchema = zod_1.z.object({
    phone: zod_1.z.string().regex(/^\+?[1-9]\d{1,14}$/, 'Invalid phone number format'),
    role: zod_1.z.enum(['customer', 'vendor', 'admin']).optional(),
});
exports.VerifyOtpRequestSchema = zod_1.z.object({
    phone: zod_1.z.string().regex(/^\+?[1-9]\d{1,14}$/, 'Invalid phone number format'),
    otp: zod_1.z.string().length(6, 'OTP must be 6 digits'),
    role: zod_1.z.enum(['customer', 'vendor', 'admin']).optional(),
});
exports.AdminLoginRequestSchema = zod_1.z.object({
    email: zod_1.z.string().email('Invalid email format'),
    password: zod_1.z.string().min(8, 'Password must be at least 8 characters'),
});
exports.RefreshTokenRequestSchema = zod_1.z.object({
    refresh_token: zod_1.z.string().min(1, 'Refresh token is required'),
});
// ============================================================================
// RESPONSE SCHEMAS
// ============================================================================
exports.AuthTokenSchema = zod_1.z.object({
    access_token: zod_1.z.string(),
    refresh_token: zod_1.z.string(),
    expires_in: zod_1.z.number(),
    token_type: zod_1.z.literal('Bearer'),
});
exports.UserSchema = zod_1.z.object({
    id: zod_1.z.string().uuid(),
    phone: zod_1.z.string().optional(),
    email: zod_1.z.string().email().optional(),
    name: zod_1.z.string().optional(),
    role: zod_1.z.enum(['customer', 'vendor', 'admin', 'staff']),
    is_active: zod_1.z.boolean(),
    created_at: zod_1.z.string().datetime(),
});
exports.AuthResponseSchema = zod_1.z.object({
    success: zod_1.z.literal(true),
    data: zod_1.z.object({
        token: exports.AuthTokenSchema,
        user: exports.UserSchema,
    }),
});
