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

/** Vendor phone-as-username + password login (no OTP). Username uses same normalization as customer phone login. */
export const VendorPasswordLoginRequestSchema = z.object({
  username: z.string().min(3).max(64),
  password: z.string().min(1),
  role: z.enum(['vendor']).optional(),
});

/** Authenticated first-time vendor password setup (parity with customer set-password body). */
export const VendorSetPasswordRequestSchema = z
  .object({
    password: z.string().optional(),
    newPassword: z.string().optional(),
    new_password: z.string().optional(),
    confirmPassword: z.string().optional(),
    confirm_password: z.string().optional(),
  })
  .transform((o) => {
    const password = (o.password || o.newPassword || o.new_password || '').trim();
    const confirmPassword = (o.confirmPassword || o.confirm_password || '').trim();
    return { password, confirmPassword };
  })
  .pipe(
    z
      .object({
        password: z.string().min(8, 'Password must be at least 8 characters'),
        confirmPassword: z.string().min(8, 'Confirm password must be at least 8 characters'),
      })
      .refine((d) => d.password === d.confirmPassword, {
        message: 'Passwords do not match',
        path: ['confirmPassword'],
      })
  );

/** Customer forgot password — request OTP to registered phone only (server-side). */
export const CustomerForgotPasswordRequestSchema = z.object({
  username: z.string().min(1).max(256),
});

export const CustomerForgotPasswordVerifyOtpSchema = z.object({
  username: z.string().min(1).max(256),
  otp: z.string().regex(/^\d{6}$/, 'OTP must be 6 digits'),
});

export const CustomerForgotPasswordResetSchema = z.object({
  resetToken: z.string().min(10).max(8192),
  newPassword: z.string().min(8, 'Password must be at least 8 characters'),
  confirmPassword: z.string().min(8, 'Password must be at least 8 characters'),
});

/** Vendor forgot password — same request shapes as customer; server resolves phone or email. */
export const VendorForgotPasswordRequestSchema = z.object({
  username: z.string().min(1).max(256),
});

export const VendorForgotPasswordVerifyOtpSchema = z.object({
  username: z.string().min(1).max(256),
  otp: z.string().regex(/^\d{6}$/, 'OTP must be 6 digits'),
});

export const VendorForgotPasswordResetSchema = z.object({
  resetToken: z.string().min(10).max(8192),
  newPassword: z.string().min(8, 'Password must be at least 8 characters'),
  confirmPassword: z.string().min(8, 'Password must be at least 8 characters'),
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
export type VendorPasswordLoginRequest = z.infer<typeof VendorPasswordLoginRequestSchema>;
export type VendorSetPasswordRequest = z.infer<typeof VendorSetPasswordRequestSchema>;
export type CustomerForgotPasswordRequest = z.infer<typeof CustomerForgotPasswordRequestSchema>;
export type CustomerForgotPasswordVerifyOtp = z.infer<typeof CustomerForgotPasswordVerifyOtpSchema>;
export type CustomerForgotPasswordReset = z.infer<typeof CustomerForgotPasswordResetSchema>;
export type VendorForgotPasswordRequest = z.infer<typeof VendorForgotPasswordRequestSchema>;
export type VendorForgotPasswordVerifyOtp = z.infer<typeof VendorForgotPasswordVerifyOtpSchema>;
export type VendorForgotPasswordReset = z.infer<typeof VendorForgotPasswordResetSchema>;
export type AdminLoginRequest = z.infer<typeof AdminLoginRequestSchema>;
export type RefreshTokenRequest = z.infer<typeof RefreshTokenRequestSchema>;
export type AuthToken = z.infer<typeof AuthTokenSchema>;
export type User = z.infer<typeof UserSchema>;
export type AuthResponse = z.infer<typeof AuthResponseSchema>;

