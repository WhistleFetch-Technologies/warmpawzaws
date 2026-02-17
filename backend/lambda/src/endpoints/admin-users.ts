/**
 * ============================================================================
 * ADMIN USERS — Create, OTP set/reset password, GET /admin/me, GET /admin/audit-log
 * ============================================================================
 * Production-grade. No self-registration; admin creates user, OTP sent to phone; user sets password.
 * ============================================================================
 */

import { Hono } from 'hono';
import { query, select, insert, update } from '../database/rds-connection';
import { hashPassword } from '../utils/password-utils';
import { sendSMS } from '../utils/sms-service';
import {
  getAdminIdentity,
  getAdminPermissions,
  requirePermission,
  logAdminAction,
  type AdminIdentity,
} from './admin-auth-helpers';
import { requireAdminAuth } from './admin';

const OTP_EXPIRY_MINUTES = 10;
const OTP_RATE_LIMIT_MINUTES = 5;
const ADMIN_OTP_PURPOSES = ['admin_set_password', 'admin_reset_password'] as const;

function normalizePhone(phone: string): string {
  const raw = String(phone || '').trim();
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 10) return `+91${digits}`;
  if (digits.startsWith('91') && digits.length === 12) return `+${digits}`;
  if (raw.startsWith('+')) return raw;
  return digits ? `+${digits}` : raw;
}

function generateOTP(): string {
  return process.env.UAT_MODE === 'true'
    ? '123456'
    : Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * Require admin auth (must be run after main requireAdminAuth that sets context).
 * Returns 401/403 if not authorized.
 */
async function requireAdminAuthWithContext(c: any): Promise<{ admin: AdminIdentity; permissions: string[] } | null> {
  const admin = getAdminIdentity(c);
  const permissions = getAdminPermissions(c);
  if (admin && permissions) return { admin, permissions };
  return null;
}

export function registerAdminUserEndpoints(app: Hono) {
  // -------------------------------------------------------------------------
  // GET /admin/me — Return current admin and permissions (for sidebar/route guard)
  // -------------------------------------------------------------------------
  app.get('/admin/me', async (c) => {
    const authResult = await requireAdminAuth(c);
    if (!authResult.authorized) {
      return c.json({ success: false, error: authResult.error || 'Not authenticated' }, 401);
    }
    const admin = getAdminIdentity(c);
    const permissions = getAdminPermissions(c);
    if (!admin) {
      return c.json({ success: false, error: 'Not authenticated' }, 401);
    }
    return c.json({
      success: true,
      admin: {
        id: admin.id,
        email: admin.email,
        name: admin.name,
        phone: admin.phone ?? undefined,
        role: admin.role,
      },
      permissions,
    });
  });

  // -------------------------------------------------------------------------
  // POST /admin/users — Create admin user (no password); send OTP to phone
  // -------------------------------------------------------------------------
  app.post('/admin/users', async (c) => {
    const authResult = await requireAdminAuth(c);
    if (!authResult.authorized) return c.json({ success: false, error: authResult.error || 'Authentication required' }, 401);
    const ctx = await requireAdminAuthWithContext(c);
    if (!ctx) return c.json({ success: false, error: 'Authentication required' }, 401);
    if (!requirePermission(c, 'admin:users:create')) {
      return c.json({ success: false, error: 'Permission denied' }, 403);
    }

    const body = await c.req.json().catch(() => ({}));
    const { email, name, phone, admin_role_id } = body;
    if (!email || typeof email !== 'string' || !email.trim()) {
      return c.json({ success: false, error: 'Email is required' }, 400);
    }
    if (!phone || typeof phone !== 'string' || !phone.trim()) {
      return c.json({ success: false, error: 'Phone is required for OTP' }, 400);
    }

    const normalizedPhone = normalizePhone(phone);
    const emailTrim = email.trim().toLowerCase();
    const nameTrim = (name && String(name).trim()) || emailTrim;

    // Duplicate check
    const existing = await query(
      `SELECT id FROM admins WHERE LOWER(email) = $1 LIMIT 1`,
      [emailTrim]
    );
    if (existing.rows?.length) {
      return c.json({ success: false, error: 'Admin with this email already exists' }, 409);
    }

    // Rate limit OTP for this phone
    const recentOtp = await query(
      `SELECT id FROM otp_tokens WHERE phone = $1 AND purpose IN ('admin_set_password','admin_reset_password')
       AND created_at > NOW() - INTERVAL '1 minute' * $2 LIMIT 1`,
      [normalizedPhone, OTP_RATE_LIMIT_MINUTES]
    );
    if (recentOtp.rows?.length) {
      return c.json(
        { success: false, error: `OTP was already sent. Please wait ${OTP_RATE_LIMIT_MINUTES} minutes before requesting again.` },
        429
      );
    }

    // Resolve admin role (must be role_type = 'admin')
    let roleId: string | null = null;
    if (admin_role_id) {
      const roleRow = await query(
        `SELECT id FROM roles WHERE id = $1 AND role_type = 'admin' AND is_active = true LIMIT 1`,
        [admin_role_id]
      );
      if (roleRow.rows?.length) roleId = roleRow.rows[0].id;
    }
    if (!roleId) {
      const defaultRole = await query(
        `SELECT id FROM roles WHERE name = 'admin' AND role_type = 'admin' LIMIT 1`
      );
      roleId = defaultRole.rows?.[0]?.id ?? null;
    }

    const insertResult = await query(
      `INSERT INTO admins (email, name, phone, admin_role_id, is_active, created_at, updated_at)
       VALUES ($1, $2, $3, $4, true, NOW(), NOW())
       RETURNING id, email, name, phone`,
      [emailTrim, nameTrim, normalizedPhone, roleId]
    );
    const newAdmin = insertResult.rows[0];
    const adminId = newAdmin.id;

    const otp = generateOTP();
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + OTP_EXPIRY_MINUTES);
    await insert('otp_tokens', {
      phone: normalizedPhone,
      email: emailTrim,
      code: otp,
      purpose: 'admin_set_password',
      expires_at: expiresAt,
      is_used: false,
    });

    const message = `Your Warmpawz admin verification code is ${otp}. Valid for ${OTP_EXPIRY_MINUTES} minutes. Use it to set your password. Do not share.`;
    const sent = await sendSMS({ to: normalizedPhone, message, type: 'otp' }).catch((err) => {
      console.warn('[ADMIN USERS] SMS send failed:', (err as Error)?.message);
      return { success: false };
    });

    await logAdminAction({
      action: 'admin_user.created',
      performedBy: ctx.admin.id,
      resourceType: 'admin',
      resourceId: adminId,
      section: 'roles',
      details: { email: emailTrim, sentOtp: sent.success },
    });

    return c.json({
      success: true,
      message: 'User created. OTP sent to their phone for setting password.',
      adminId,
      admin: { id: adminId, email: emailTrim, name: nameTrim, phone: normalizedPhone },
      otpSent: sent.success,
    }, 201);
  });

  // -------------------------------------------------------------------------
  // POST /admin/users/verify-otp-set-password — Public; verify OTP and set password
  // -------------------------------------------------------------------------
  app.post('/admin/users/verify-otp-set-password', async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const { email, phone, otp, newPassword } = body;
    if (!email || !phone || !otp || !newPassword) {
      return c.json({ success: false, error: 'Email, phone, OTP and new password are required' }, 400);
    }
    const code = String(otp).trim();
    if (code.length !== 6) {
      return c.json({ success: false, error: 'Invalid OTP format' }, 400);
    }
    if (String(newPassword).length < 8) {
      return c.json({ success: false, error: 'Password must be at least 8 characters' }, 400);
    }

    const normalizedPhone = normalizePhone(phone);
    const emailTrim = String(email).trim().toLowerCase();

    const otpRows = await query(
      `SELECT id, email FROM otp_tokens
       WHERE phone = $1 AND code = $2 AND purpose IN ('admin_set_password','admin_reset_password')
         AND is_used = false AND expires_at > NOW()
       ORDER BY created_at DESC LIMIT 1`,
      [normalizedPhone, code]
    );
    if (!otpRows.rows?.length) {
      return c.json({ success: false, error: 'Invalid or expired OTP' }, 400);
    }
    const otpRecord = otpRows.rows[0];
    const otpEmail = (otpRecord.email || '').trim().toLowerCase();
    if (otpEmail && otpEmail !== emailTrim) {
      return c.json({ success: false, error: 'Invalid or expired OTP' }, 400);
    }

    await query(
      `UPDATE otp_tokens SET is_used = true, used_at = NOW() WHERE id = $1`,
      [otpRecord.id]
    );

    const adminRows = await query(
      `SELECT id FROM admins WHERE LOWER(email) = $1 LIMIT 1`,
      [otpEmail || emailTrim]
    );
    if (!adminRows.rows?.length) {
      return c.json({ success: false, error: 'Admin account not found' }, 404);
    }
    const targetAdminId = adminRows.rows[0].id;

    const passwordHash = await hashPassword(String(newPassword));
    await query(
      `UPDATE admins SET password_hash = $1, updated_at = NOW() WHERE id = $2`,
      [passwordHash, targetAdminId]
    );

    await logAdminAction({
      action: 'admin_password.set_via_otp',
      performedBy: targetAdminId,
      actorType: 'admin',
      resourceType: 'admin',
      resourceId: targetAdminId,
      section: 'roles',
      details: {},
    });

    return c.json({
      success: true,
      message: 'Password set successfully. You can log in with email and password.',
    });
  });

  // -------------------------------------------------------------------------
  // POST /admin/users/forgot-password — Public; request reset OTP by email (sends OTP to admin's phone)
  // -------------------------------------------------------------------------
  app.post('/admin/users/forgot-password', async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
    if (!email) {
      return c.json({ success: false, error: 'Email is required' }, 400);
    }

    const targetRows = await query(
      `SELECT id, email, name, phone FROM admins WHERE LOWER(email) = $1 AND is_active = true LIMIT 1`,
      [email]
    );
    // Generic message to avoid revealing whether email exists
    const genericSuccess = {
      success: true,
      message: 'If this email is registered, an OTP has been sent to your registered phone. Use the Set password page to enter the code and set a new password.',
    };
    if (!targetRows.rows?.length) {
      return c.json(genericSuccess, 200);
    }
    const target = targetRows.rows[0];
    const phone = target.phone ? normalizePhone(target.phone) : null;
    if (!phone) {
      return c.json(genericSuccess, 200);
    }

    const recentOtp = await query(
      `SELECT id FROM otp_tokens WHERE phone = $1 AND purpose = 'admin_reset_password'
       AND created_at > NOW() - INTERVAL '1 minute' * $2 LIMIT 1`,
      [phone, OTP_RATE_LIMIT_MINUTES]
    );
    if (recentOtp.rows?.length) {
      return c.json(
        { success: false, error: `Please wait ${OTP_RATE_LIMIT_MINUTES} minutes before requesting another code.` },
        429
      );
    }

    const otp = generateOTP();
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + OTP_EXPIRY_MINUTES);
    await insert('otp_tokens', {
      phone,
      email: target.email,
      code: otp,
      purpose: 'admin_reset_password',
      expires_at: expiresAt,
      is_used: false,
    });

    const message = `Your Warmpawz admin password reset code is ${otp}. Valid for ${OTP_EXPIRY_MINUTES} minutes. Do not share.`;
    const sent = await sendSMS({ to: phone, message, type: 'otp' }).catch((err) => {
      console.warn('[ADMIN USERS] Forgot-password OTP SMS failed:', (err as Error)?.message);
      return { success: false };
    });

    await logAdminAction({
      action: 'admin_password.forgot_requested',
      performedBy: target.id,
      actorType: 'admin',
      resourceType: 'admin',
      resourceId: target.id,
      section: 'roles',
      details: { targetEmail: target.email, sentOtp: sent.success },
    });

    return c.json(genericSuccess, 200);
  });

  // -------------------------------------------------------------------------
  // POST /admin/users/reset-password-request — Send OTP to user's phone (admin or self)
  // -------------------------------------------------------------------------
  app.post('/admin/users/reset-password-request', async (c) => {
    const authResult = await requireAdminAuth(c);
    if (!authResult.authorized) return c.json({ success: false, error: authResult.error || 'Authentication required' }, 401);
    const ctx = await requireAdminAuthWithContext(c);
    if (!ctx) return c.json({ success: false, error: 'Authentication required' }, 401);

    const body = await c.req.json().catch(() => ({}));
    const adminIdParam = body.adminId ?? body.admin_id;

    const targetAdminId = adminIdParam ? String(adminIdParam).trim() : ctx.admin.id;
    const isSelf = targetAdminId === ctx.admin.id;
    if (!isSelf && !requirePermission(c, 'admin:users:reset_password')) {
      return c.json({ success: false, error: 'Permission denied' }, 403);
    }

    const targetRows = await query(
      `SELECT id, email, name, phone FROM admins WHERE id = $1 AND is_active = true LIMIT 1`,
      [targetAdminId]
    );
    if (!targetRows.rows?.length) {
      return c.json({ success: false, error: 'User not found or inactive' }, 404);
    }
    const target = targetRows.rows[0];
    const phone = target.phone ? normalizePhone(target.phone) : null;
    if (!phone) {
      return c.json({ success: false, error: 'User has no phone number; cannot send OTP' }, 400);
    }

    const recentOtp = await query(
      `SELECT id FROM otp_tokens WHERE phone = $1 AND purpose = 'admin_reset_password'
       AND created_at > NOW() - INTERVAL '1 minute' * $2 LIMIT 1`,
      [phone, OTP_RATE_LIMIT_MINUTES]
    );
    if (recentOtp.rows?.length) {
      return c.json(
        { success: false, error: `Please wait ${OTP_RATE_LIMIT_MINUTES} minutes before requesting another OTP.` },
        429
      );
    }

    const otp = generateOTP();
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + OTP_EXPIRY_MINUTES);
    await insert('otp_tokens', {
      phone,
      email: target.email,
      code: otp,
      purpose: 'admin_reset_password',
      expires_at: expiresAt,
      is_used: false,
    });

    const message = `Your Warmpawz admin password reset code is ${otp}. Valid for ${OTP_EXPIRY_MINUTES} minutes. Do not share.`;
    const sent = await sendSMS({ to: phone, message, type: 'otp' }).catch((err) => {
      console.warn('[ADMIN USERS] Reset OTP SMS failed:', (err as Error)?.message);
      return { success: false };
    });

    await logAdminAction({
      action: 'admin_password.reset_requested',
      performedBy: ctx.admin.id,
      resourceType: 'admin',
      resourceId: targetAdminId,
      section: 'roles',
      details: { targetEmail: target.email, sentOtp: sent.success },
    });

    return c.json({
      success: true,
      message: 'OTP sent to user’s phone. They can set a new password using the set-password page.',
      otpSent: sent.success,
    });
  });

  // -------------------------------------------------------------------------
  // POST /admin/users/:id/send-set-password-otp — Resend OTP for first-time set password
  // -------------------------------------------------------------------------
  app.post('/admin/users/:id/send-set-password-otp', async (c) => {
    const authResult = await requireAdminAuth(c);
    if (!authResult.authorized) return c.json({ success: false, error: authResult.error || 'Authentication required' }, 401);
    const ctx = await requireAdminAuthWithContext(c);
    if (!ctx) return c.json({ success: false, error: 'Authentication required' }, 401);
    if (!requirePermission(c, 'admin:users:create') && !requirePermission(c, 'admin:users:edit')) {
      return c.json({ success: false, error: 'Permission denied' }, 403);
    }

    const id = c.req.param('id');
    const adminRows = await query(
      `SELECT id, email, name, phone FROM admins WHERE id = $1 AND is_active = true LIMIT 1`,
      [id]
    );
    if (!adminRows.rows?.length) {
      return c.json({ success: false, error: 'User not found' }, 404);
    }
    const target = adminRows.rows[0];
    const phone = target.phone ? normalizePhone(target.phone) : null;
    if (!phone) {
      return c.json({ success: false, error: 'User has no phone' }, 400);
    }

    const recentOtp = await query(
      `SELECT id FROM otp_tokens WHERE phone = $1 AND purpose = 'admin_set_password'
       AND created_at > NOW() - INTERVAL '1 minute' * $2 LIMIT 1`,
      [phone, OTP_RATE_LIMIT_MINUTES]
    );
    if (recentOtp.rows?.length) {
      return c.json(
        { success: false, error: `Please wait ${OTP_RATE_LIMIT_MINUTES} minutes before resending.` },
        429
      );
    }

    const otp = generateOTP();
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + OTP_EXPIRY_MINUTES);
    await insert('otp_tokens', {
      phone,
      email: target.email,
      code: otp,
      purpose: 'admin_set_password',
      expires_at: expiresAt,
      is_used: false,
    });

    const message = `Your Warmpawz admin verification code is ${otp}. Valid for ${OTP_EXPIRY_MINUTES} minutes. Use it to set your password. Do not share.`;
    const sent = await sendSMS({ to: phone, message, type: 'otp' }).catch((err) => {
      console.warn('[ADMIN USERS] Send set-password OTP failed:', (err as Error)?.message);
      return { success: false };
    });

    await logAdminAction({
      action: 'admin_user.send_set_password_otp',
      performedBy: ctx.admin.id,
      resourceType: 'admin',
      resourceId: id,
      section: 'roles',
      details: { sentOtp: sent.success },
    });

    return c.json({
      success: true,
      message: 'OTP sent to user’s phone.',
      otpSent: sent.success,
    });
  });

  // -------------------------------------------------------------------------
  // GET /admin/users — List admin users (with role and permissions summary)
  // -------------------------------------------------------------------------
  app.get('/admin/users', async (c) => {
    const authResult = await requireAdminAuth(c);
    if (!authResult.authorized) return c.json({ success: false, error: authResult.error || 'Authentication required' }, 401);
    const ctx = await requireAdminAuthWithContext(c);
    if (!ctx) return c.json({ success: false, error: 'Authentication required' }, 401);
    if (!requirePermission(c, 'admin:users:view')) {
      return c.json({ success: false, error: 'Permission denied' }, 403);
    }

    const list = await query(
      `SELECT a.id, a.email, a.name, a.phone, a.role, a.admin_role_id, a.is_active, a.created_at,
              r.name as role_name, r.display_name as role_display_name
       FROM admins a
       LEFT JOIN roles r ON r.id = a.admin_role_id
       ORDER BY a.created_at DESC`
    );
    const users = (list.rows || []).map((row: any) => ({
      id: row.id,
      email: row.email,
      name: row.name,
      phone: row.phone ?? undefined,
      role: row.role,
      admin_role_id: row.admin_role_id ?? undefined,
      role_name: row.role_name ?? undefined,
      role_display_name: row.role_display_name ?? undefined,
      is_active: row.is_active !== false,
      created_at: row.created_at,
    }));

    return c.json({ success: true, users });
  });

  // -------------------------------------------------------------------------
  // GET /admin/audit-log — List audit logs with filters (requires admin:audit:view)
  // -------------------------------------------------------------------------
  app.get('/admin/audit-log', async (c) => {
    const authResult = await requireAdminAuth(c);
    if (!authResult.authorized) return c.json({ success: false, error: authResult.error || 'Authentication required' }, 401);
    const ctx = await requireAdminAuthWithContext(c);
    if (!ctx) return c.json({ success: false, error: 'Authentication required' }, 401);
    if (!requirePermission(c, 'admin:audit:view')) {
      return c.json({ success: false, error: 'Permission denied' }, 403);
    }

    const section = c.req.query('section');
    const performedBy = c.req.query('performed_by');
    const resourceType = c.req.query('resource_type');
    const resourceId = c.req.query('resource_id');
    const action = c.req.query('action');
    const fromDate = c.req.query('from_date');
    const toDate = c.req.query('to_date');
    const limit = Math.min(parseInt(c.req.query('limit') || '50', 10) || 50, 200);
    const offset = Math.max(0, parseInt(c.req.query('offset') || '0', 10) || 0);

    const conditions: string[] = ['1=1'];
    const params: any[] = [];
    let idx = 1;
    if (section) {
      conditions.push(`details->>'section' = $${idx}`);
      params.push(section);
      idx++;
    }
    if (performedBy) {
      conditions.push(`performed_by = $${idx}`);
      params.push(performedBy);
      idx++;
    }
    if (resourceType) {
      conditions.push(`resource_type = $${idx}`);
      params.push(resourceType);
      idx++;
    }
    if (resourceId) {
      conditions.push(`resource_id::text = $${idx}`);
      params.push(resourceId);
      idx++;
    }
    if (action) {
      conditions.push(`action = $${idx}`);
      params.push(action);
      idx++;
    }
    if (fromDate) {
      conditions.push(`performed_at >= $${idx}::timestamptz`);
      params.push(fromDate);
      idx++;
    }
    if (toDate) {
      conditions.push(`performed_at <= $${idx}::timestamptz`);
      params.push(toDate);
      idx++;
    }
    params.push(limit, offset);

    const result = await query(
      `SELECT id, action, performed_by, actor_type, resource_type, resource_id, details, status, performed_at
       FROM audit_logs
       WHERE ${conditions.join(' AND ')}
       ORDER BY performed_at DESC
       LIMIT $${idx} OFFSET $${idx + 1}`,
      params
    );

    return c.json({
      success: true,
      logs: result.rows || [],
      count: (result.rows || []).length,
    });
  });
}
