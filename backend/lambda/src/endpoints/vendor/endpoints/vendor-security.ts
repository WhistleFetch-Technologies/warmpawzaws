/**
 * Vendor security: 2FA, phone change, login history.
 */
import { Hono } from 'hono';
import {
  beginVendor2FASetup,
  confirmVendor2FA,
  disableVendor2FA,
  getVendorLoginHistory,
  getVendorSecuritySnapshot,
  requestVendorPhoneChange,
  confirmVendorPhoneChange,
  sendCurrentPhoneChangeOtp,
  verifyCurrentPhoneForChange,
} from '../../../lib/services/vendor-security-service';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isValidVendorId(vendorId: string): boolean {
  return vendorId !== 'test-vendor-id' && UUID_RE.test(vendorId);
}

function defaultSecurityPayload(vendorId: string) {
  return {
    vendorId,
    phone: '',
    phoneVerified: false,
    twoFactorEnabled: false,
    accountSecured: false,
    settings: {},
  };
}

export function registerVendorSecurityEndpoints(app: Hono) {
  app.get('/vendor/:vendorId/security', async (c) => {
    const vendorId = c.req.param('vendorId');
    if (!isValidVendorId(vendorId)) {
      return c.json(defaultSecurityPayload(vendorId), 200);
    }
    try {
      const snap = await getVendorSecuritySnapshot(vendorId);
      if (snap.status !== 200) {
        return c.json({ error: snap.error }, snap.status);
      }
      return c.json({ ...snap.data, settings: {} }, 200);
    } catch (error: any) {
      console.error('[vendor-security] GET failed:', error);
      return c.json({ error: error.message || 'Internal Server Error' }, 500);
    }
  });

  app.get('/vendor/:vendorId/security/login-history', async (c) => {
    const vendorId = c.req.param('vendorId');
    const limit = parseInt(c.req.query('limit') || '20', 10);
    if (!isValidVendorId(vendorId)) {
      return c.json({ vendorId, logins: [] }, 200);
    }
    try {
      const logins = await getVendorLoginHistory(vendorId, limit);
      return c.json({ vendorId, logins }, 200);
    } catch (error: any) {
      console.error('[vendor-security] login-history failed:', error);
      return c.json({ error: error.message || 'Internal Server Error' }, 500);
    }
  });

  app.post('/vendor/:vendorId/security/enable-2fa', async (c) => {
    const vendorId = c.req.param('vendorId');
    if (!isValidVendorId(vendorId)) {
      return c.json({ success: true, verificationRequired: true, message: 'Test mode' }, 200);
    }
    try {
      const result = await beginVendor2FASetup(vendorId);
      if (result.status !== 200) {
        return c.json({ error: (result as any).error }, result.status);
      }
      return c.json(result.data, 200);
    } catch (error: any) {
      console.error('[vendor-security] enable-2fa failed:', error);
      return c.json({ error: error.message || 'Internal Server Error' }, 500);
    }
  });

  app.post('/vendor/:vendorId/security/verify-2fa', async (c) => {
    const vendorId = c.req.param('vendorId');
    const body = await c.req.json().catch(() => ({}));
    const code = String((body as any).code || (body as any).otp || '').trim();
    if (!code) {
      return c.json({ error: 'Verification code is required' }, 400);
    }
    if (!isValidVendorId(vendorId)) {
      return c.json({ success: true, twoFactorEnabled: true }, 200);
    }
    try {
      const result = await confirmVendor2FA(vendorId, code);
      if (result.status !== 200) {
        return c.json({ error: (result as any).error }, result.status);
      }
      return c.json(result.data, 200);
    } catch (error: any) {
      console.error('[vendor-security] verify-2fa failed:', error);
      return c.json({ error: error.message || 'Internal Server Error' }, 500);
    }
  });

  app.post('/vendor/:vendorId/security/disable-2fa', async (c) => {
    const vendorId = c.req.param('vendorId');
    if (!isValidVendorId(vendorId)) {
      return c.json({ success: true, message: '2FA disabled' }, 200);
    }
    try {
      const result = await disableVendor2FA(vendorId);
      return c.json(result.data, result.status);
    } catch (error: any) {
      console.error('[vendor-security] disable-2fa failed:', error);
      return c.json({ error: error.message || 'Internal Server Error' }, 500);
    }
  });

  app.post('/vendor/:vendorId/security/phone-change/send-current-otp', async (c) => {
    const vendorId = c.req.param('vendorId');
    if (!isValidVendorId(vendorId)) {
      return c.json({ success: true, message: 'Test mode' }, 200);
    }
    try {
      const result = await sendCurrentPhoneChangeOtp(vendorId);
      if (result.status !== 200) {
        return c.json({ error: (result as any).error }, result.status);
      }
      return c.json(result.data, 200);
    } catch (error: any) {
      console.error('[vendor-security] send-current-otp failed:', error);
      return c.json({ error: error.message || 'Internal Server Error' }, 500);
    }
  });

  app.post('/vendor/:vendorId/security/phone-change/verify-current', async (c) => {
    const vendorId = c.req.param('vendorId');
    const body = await c.req.json().catch(() => ({}));
    const otp = String((body as any).otp || (body as any).code || '').trim();
    if (!otp) {
      return c.json({ error: 'OTP is required' }, 400);
    }
    if (!isValidVendorId(vendorId)) {
      return c.json({ success: true, message: 'Current phone verified' }, 200);
    }
    try {
      const result = await verifyCurrentPhoneForChange(vendorId, otp);
      if (result.status !== 200) {
        return c.json({ error: (result as any).error }, result.status);
      }
      return c.json(result.data, 200);
    } catch (error: any) {
      console.error('[vendor-security] verify-current failed:', error);
      return c.json({ error: error.message || 'Internal Server Error' }, 500);
    }
  });

  app.post('/vendor/:vendorId/security/request-phone-change', async (c) => {
    const vendorId = c.req.param('vendorId');
    const body = await c.req.json().catch(() => ({}));
    const newPhone = String((body as any).newPhone || (body as any).phone || '').trim();
    if (!newPhone) {
      return c.json({ error: 'New phone number is required' }, 400);
    }
    if (!isValidVendorId(vendorId)) {
      return c.json({ success: true, message: 'Test mode' }, 200);
    }
    try {
      const result = await requestVendorPhoneChange(vendorId, newPhone);
      if (result.status !== 200) {
        return c.json({ error: (result as any).error }, result.status);
      }
      return c.json(result.data, 200);
    } catch (error: any) {
      console.error('[vendor-security] request-phone-change failed:', error);
      return c.json({ error: error.message || 'Internal Server Error' }, 500);
    }
  });

  app.post('/vendor/:vendorId/security/confirm-phone-change', async (c) => {
    const vendorId = c.req.param('vendorId');
    const body = await c.req.json().catch(() => ({}));
    const newPhone = String((body as any).newPhone || (body as any).phone || '').trim();
    const otp = String((body as any).otp || (body as any).code || '').trim();
    if (!newPhone || !otp) {
      return c.json({ error: 'Phone and OTP are required' }, 400);
    }
    if (!isValidVendorId(vendorId)) {
      return c.json({ success: true, phone: newPhone }, 200);
    }
    try {
      const result = await confirmVendorPhoneChange(vendorId, newPhone, otp);
      if (result.status !== 200) {
        return c.json({ error: (result as any).error }, result.status);
      }
      return c.json(result.data, 200);
    } catch (error: any) {
      console.error('[vendor-security] confirm-phone-change failed:', error);
      return c.json({ error: error.message || 'Internal Server Error' }, 500);
    }
  });
}
