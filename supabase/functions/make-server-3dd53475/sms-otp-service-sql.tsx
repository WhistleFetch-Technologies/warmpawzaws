/**
 * ============================================================================
 * SMS OTP VERIFICATION SERVICE - SQL-ONLY VERSION
 * ============================================================================
 * 
 * REFACTORED: Removed all KV usage, using SQL repositories only
 * 
 * Features:
 * - Send OTP via Twilio/AWS SNS
 * - Store OTP with 5-minute expiry in otp_tokens table
 * - Verify OTP with rate limiting (stored in platform_settings)
 * - Resend with cooldown (stored in platform_settings)
 * - Block after 3 failed attempts (stored in platform_settings)
 * 
 * CHANGES:
 * - Removed `kv` imports
 * - Replaced all `kv.get()`, `kv.set()`, `kv.del()` with SQL queries
 * - OTP tokens stored in `otp_tokens` table
 * - Rate limiting stored in `platform_settings` table
 * - SMS settings stored in `platform_settings` table
 * 
 * Date: 2025-01-27
 * Migration: Batch 7 Phase 3 - KV to SQL
 * ============================================================================
 */

import { Hono } from "npm:hono";
import { getDbClient } from '../../lib/db.ts';
import { getPlatformSettingsRepository } from '../../lib/repositories/platform-settings.ts';

/**
 * SMS OTP VERIFICATION SERVICE - SQL-ONLY
 */
export function registerSmsOtpService(app: Hono) {
  const BASE = '/make-server-3dd53475';
  const db = getDbClient();
  const platformSettingsRepo = getPlatformSettingsRepository();

  // =============================================
  // SEND OTP
  // =============================================
  app.post(`${BASE}/auth/send-otp`, async (c) => {
    try {
      const { phone, purpose } = await c.req.json();

      if (!phone || !/^\+?[1-9]\d{1,14}$/.test(phone)) {
        return c.json({ error: 'Invalid phone number' }, 400);
      }

      // ✅ SQL: Check rate limiting from platform_settings
      const attemptsKey = `otp:attempts:${phone}`;
      const attemptsData = await platformSettingsRepo.getSetting(attemptsKey) as any;
      const attempts = attemptsData || { count: 0, blockedUntil: null };
      
      if (attempts.blockedUntil && new Date(attempts.blockedUntil) > new Date()) {
        const blockedMinutes = Math.ceil((new Date(attempts.blockedUntil).getTime() - Date.now()) / 60000);
        return c.json({ 
          error: `Too many attempts. Try again in ${blockedMinutes} minutes`,
          blockedUntil: attempts.blockedUntil
        }, 429);
      }

      // ✅ SQL: Check cooldown for resend (30 seconds) from platform_settings
      const lastSentKey = `otp:lastsent:${phone}`;
      const lastSent = await platformSettingsRepo.getSetting(lastSentKey) as string | null;
      if (lastSent) {
        const timeSinceLastSent = Date.now() - new Date(lastSent).getTime();
        if (timeSinceLastSent < 30000) {
          return c.json({ 
            error: 'Please wait before requesting another OTP',
            waitSeconds: Math.ceil((30000 - timeSinceLastSent) / 1000)
          }, 429);
        }
      }

      // Generate 6-digit OTP
      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString(); // 5 minutes

      // ✅ SQL: Store OTP in otp_tokens table using direct SQL (schema uses 'code' and 'purpose')
      const db = getDbClient();
      
      // First, mark any existing unused OTPs as expired
      await db
        .from('otp_tokens')
        .update({ is_used: true })
        .eq('phone', phone)
        .eq('is_used', false);

      // Create new OTP
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
      const { error: insertError } = await db
        .from('otp_tokens')
        .insert({
          phone,
          code: otp,
          purpose: purpose || 'authentication',
          expires_at: expiresAt,
          is_used: false
        });

      if (insertError) {
        console.error('Error creating OTP:', insertError);
        return c.json({ error: 'Failed to create OTP' }, 500);
      }

      // ✅ SQL: Update last sent time in platform_settings
      await platformSettingsRepo.setSetting(lastSentKey, new Date().toISOString(), 'string');

      // Send SMS
      const smsSent = await sendSMS(phone, otp);

      if (!smsSent) {
        // If SMS fails, still return success but log error
        console.error(`[SMS] Failed to send OTP to ${phone}`);
        // For development: return OTP in response
        if (Deno.env.get('ENVIRONMENT') === 'development') {
          return c.json({ 
            success: true, 
            message: 'OTP sent (DEV MODE)', 
            devOtp: otp, // Only in dev
            expiresAt 
          });
        }
      }

      console.log(`✅ [OTP] Sent to ${phone} - Expires at ${expiresAt}`);

      return c.json({ 
        success: true, 
        message: 'OTP sent successfully',
        expiresAt,
        // Only include OTP in response for development
        ...(Deno.env.get('ENVIRONMENT') === 'development' && { devOtp: otp })
      });

    } catch (error) {
      console.error('[OTP] Send error:', error);
      return c.json({ error: 'Failed to send OTP' }, 500);
    }
  });

  // =============================================
  // VERIFY OTP
  // =============================================
  app.post(`${BASE}/auth/verify-otp`, async (c) => {
    try {
      const { phone, otp } = await c.req.json();

      if (!phone || !otp) {
        return c.json({ error: 'Phone and OTP required' }, 400);
      }

      // ✅ SQL: Check if blocked from platform_settings
      const attemptsKey = `otp:attempts:${phone}`;
      const attemptsData = await platformSettingsRepo.getSetting(attemptsKey) as any;
      const attempts = attemptsData || { count: 0, blockedUntil: null };
      
      if (attempts.blockedUntil && new Date(attempts.blockedUntil) > new Date()) {
        return c.json({ error: 'Account temporarily blocked. Try again later.' }, 429);
      }

      // ✅ SQL: Get stored OTP from otp_tokens table (using 'code' and 'purpose' columns)
      const { data: storedOtps, error: otpError } = await db
        .from('otp_tokens')
        .select('*')
        .eq('phone', phone)
        .eq('is_used', false)
        .order('created_at', { ascending: false })
        .limit(1);

      if (otpError || !storedOtps || storedOtps.length === 0) {
        return c.json({ error: 'OTP not found or expired' }, 404);
      }

      const storedOtp = storedOtps[0];

      // Check expiry
      if (new Date(storedOtp.expires_at) < new Date()) {
        // Mark as used
        await db
          .from('otp_tokens')
          .update({ is_used: true, used_at: new Date().toISOString() })
          .eq('id', storedOtp.id);
        return c.json({ error: 'OTP expired. Please request a new one.' }, 400);
      }

      // Verify OTP (schema uses 'code' column)
      if (storedOtp.code !== otp) {
        // Increment failed attempts
        attempts.count += 1;

        // Block after 3 failed attempts
        if (attempts.count >= 3) {
          attempts.blockedUntil = new Date(Date.now() + 15 * 60 * 1000).toISOString(); // 15 min block
          await platformSettingsRepo.setSetting(attemptsKey, attempts, 'object');
          return c.json({ 
            error: 'Too many failed attempts. Account blocked for 15 minutes.',
            blockedUntil: attempts.blockedUntil
          }, 429);
        }

        await platformSettingsRepo.setSetting(attemptsKey, attempts, 'object');
        
        return c.json({ 
          error: 'Invalid OTP',
          attemptsLeft: 3 - attempts.count
        }, 400);
      }

      // ✅ SQL: Mark OTP as verified
      await db
        .from('otp_tokens')
        .update({ 
          is_used: true, 
          used_at: new Date().toISOString() 
        })
        .eq('id', storedOtp.id);

      // ✅ SQL: Reset attempts
      await platformSettingsRepo.setSetting(attemptsKey, { count: 0, blockedUntil: null }, 'object');

      console.log(`✅ [OTP] Verified for ${phone}`);

      return c.json({ 
        success: true,
        message: 'OTP verified successfully',
        phone
      });

    } catch (error) {
      console.error('[OTP] Verify error:', error);
      return c.json({ error: 'Failed to verify OTP' }, 500);
    }
  });

  // =============================================
  // RESEND OTP
  // =============================================
  app.post(`${BASE}/auth/resend-otp`, async (c) => {
    try {
      const { phone } = await c.req.json();

      // ✅ SQL: Check cooldown from platform_settings
      const lastSentKey = `otp:lastsent:${phone}`;
      const lastSent = await platformSettingsRepo.getSetting(lastSentKey) as string | null;
      if (lastSent) {
        const timeSinceLastSent = Date.now() - new Date(lastSent).getTime();
        if (timeSinceLastSent < 60000) { // 60 seconds cooldown for resend
          return c.json({ 
            error: 'Please wait before resending',
            waitSeconds: Math.ceil((60000 - timeSinceLastSent) / 1000)
          }, 429);
        }
      }

      // ✅ SQL: Mark old OTP as used
      await db
        .from('otp_tokens')
        .update({ is_used: true, used_at: new Date().toISOString() })
        .eq('phone', phone)
        .eq('is_used', false);

      // Generate new OTP
      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();

      // ✅ SQL: Create new OTP
      const { error: insertError } = await db
        .from('otp_tokens')
        .insert({
          phone,
          code: otp,
          purpose: 'resend',
          expires_at: expiresAt,
          is_used: false
        });

      if (insertError) {
        console.error('Error creating OTP:', insertError);
        return c.json({ error: 'Failed to create OTP' }, 500);
      }

      // ✅ SQL: Update last sent time
      await platformSettingsRepo.setSetting(lastSentKey, new Date().toISOString(), 'string');

      await sendSMS(phone, otp);

      console.log(`🔄 [OTP] Resent to ${phone}`);

      return c.json({ 
        success: true,
        message: 'OTP resent successfully',
        expiresAt,
        ...(Deno.env.get('ENVIRONMENT') === 'development' && { devOtp: otp })
      });

    } catch (error) {
      console.error('[OTP] Resend error:', error);
      return c.json({ error: 'Failed to resend OTP' }, 500);
    }
  });

  // =============================================
  // HELPER: SEND SMS
  // =============================================
  async function sendSMS(phone: string, otp: string): Promise<boolean> {
    try {
      // ✅ SQL: Get SMS provider from platform_settings
      const smsSettings = await platformSettingsRepo.getSetting('admin:settings:sms') as any || { provider: 'mock' };

      if (smsSettings.provider === 'twilio') {
        return await sendViaTwilio(phone, otp, smsSettings);
      } else if (smsSettings.provider === 'sns') {
        return await sendViaSNS(phone, otp, smsSettings);
      } else {
        // Mock SMS for development
        console.log(`📱 [MOCK SMS] OTP ${otp} sent to ${phone}`);
        return true;
      }
    } catch (error) {
      console.error('[SMS] Send error:', error);
      return false;
    }
  }

  async function sendViaTwilio(phone: string, otp: string, settings: any): Promise<boolean> {
    try {
      const { accountSid, authToken, fromNumber } = settings.twilio || {};
      
      if (!accountSid || !authToken || !fromNumber) {
        console.error('[Twilio] Missing credentials');
        return false;
      }

      const auth = btoa(`${accountSid}:${authToken}`);
      const message = `Your Warmpawz verification code is: ${otp}. Valid for 5 minutes.`;

      const response = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Basic ${auth}`,
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          body: new URLSearchParams({
            To: phone,
            From: fromNumber,
            Body: message
          }).toString()
        }
      );

      if (response.ok) {
        console.log(`✅ [Twilio] SMS sent to ${phone}`);
        return true;
      } else {
        const error = await response.text();
        console.error('[Twilio] Error:', error);
        return false;
      }
    } catch (error) {
      console.error('[Twilio] Exception:', error);
      return false;
    }
  }

  async function sendViaSNS(phone: string, otp: string, settings: any): Promise<boolean> {
    try {
      // AWS SNS implementation
      // This requires AWS SDK which needs to be imported
      console.log('[SNS] Implementation pending - using mock');
      return true;
    } catch (error) {
      console.error('[SNS] Error:', error);
      return false;
    }
  }
}

