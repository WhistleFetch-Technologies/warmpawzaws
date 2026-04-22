/**
 * ============================================================================
 * AUTHENTICATION API CONTRACTS
 * ============================================================================
 */

import { z } from 'zod';

// ============================================================================
// REQUEST SCHEMAS
// ============================================================================

export const SendOtpRequestSchema = z.object({
  phone: z.string().regex(/^\+?[1-9]\d{1,14}$/, 'Invalid phone number format'),
  role: z.enum(['customer', 'vendor', 'admin']).optional(),
});

export const VerifyOtpRequestSchema = z.object({
  phone: z.string().regex(/^\+?[1-9]\d{1,14}$/, 'Invalid phone number format'),
  otp: z.string().length(6, 'OTP must be 6 digits'),
  role: z.enum(['customer', 'vendor', 'admin']).optional(),
  /** Peer or vendor referral code (optional) */
  referralCode: z.string().max(64).optional(),
  pendingReferralCode: z.string().max(64).optional(),
});

/** Customer username + password login (no OTP). */
export const CustomerPasswordLoginRequestSchema = z.object({
  username: z.string().min(3).max(64),
  password: z.string().min(1),
  role: z.enum(['customer']).optional(),
});

export const AdminLoginRequestSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

export const RefreshTokenRequestSchema = z.object({
  refresh_token: z.string().min(1, 'Refresh token is required'),
});

// ============================================================================
// RESPONSE SCHEMAS
// ============================================================================

export const AuthTokenSchema = z.object({
  access_token: z.string(),
  refresh_token: z.string(),
  expires_in: z.number(),
  token_type: z.literal('Bearer'),
});

export const UserSchema = z.object({
  id: z.string().uuid(),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  name: z.string().optional(),
  role: z.enum(['customer', 'vendor', 'admin', 'staff']),
  is_active: z.boolean(),
  created_at: z.string().datetime(),
});

export const AuthResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    token: AuthTokenSchema,
    user: UserSchema,
  }),
});

// ============================================================================
// TYPES
// ============================================================================

export type SendOtpRequest = z.infer<typeof SendOtpRequestSchema>;
export type VerifyOtpRequest = z.infer<typeof VerifyOtpRequestSchema>;
export type CustomerPasswordLoginRequest = z.infer<typeof CustomerPasswordLoginRequestSchema>;
export type AdminLoginRequest = z.infer<typeof AdminLoginRequestSchema>;
export type RefreshTokenRequest = z.infer<typeof RefreshTokenRequestSchema>;
export type AuthToken = z.infer<typeof AuthTokenSchema>;
export type User = z.infer<typeof UserSchema>;
export type AuthResponse = z.infer<typeof AuthResponseSchema>;

