/**
 * ============================================================================
 * VENDOR REFERRAL ENDPOINTS - LAMBDA VERSION
 * ============================================================================
 * 
 * Handles vendor-to-vendor referral system:
 * - Get referral code
 * - Send referral invite via SMS
 * - Get referral stats
 * - Get referral history
 * 
 * Date: 2026-02-16
 * ============================================================================
 */

import { Hono } from 'hono';
import { select, insert, update, query } from '../database/rds-connection';
import { sendSMS } from '../utils/sms-service';
import { resolveVendorById } from './vendor-profile';

export function registerVendorReferralEndpoints(app: Hono) {
  /**
   * GET /vendor/:vendorId/referral
   * Get or create referral code for vendor
   */
  app.get("/vendor/:vendorId/referral", async (c) => {
    try {
      const { vendorId } = c.req.param();

      // Verify vendor exists
      const vendor = await resolveVendorById(vendorId);
      if (!vendor) {
        return c.json({ error: 'Vendor not found' }, 404);
      }
      const resolvedVendorId = vendor.id;

      // Get or create referral code
      let referrals = await select('vendor_referrals', { 
        referrer_vendor_id: resolvedVendorId,
        status: 'pending'
      });
      
      // If no pending referral exists, check for any existing referral code for this vendor
      if (referrals.length === 0) {
        const existingReferrals = await query(
          `SELECT referral_code FROM vendor_referrals 
           WHERE referrer_vendor_id = $1 
           ORDER BY created_at DESC 
           LIMIT 1`,
          [resolvedVendorId]
        );
        
        if (existingReferrals.rows.length > 0) {
          return c.json({
            success: true,
            referralCode: existingReferrals.rows[0].referral_code,
          });
        }
        
        // Generate new referral code
        const code = `VREF${resolvedVendorId.slice(-4).toUpperCase()}${Math.random().toString(36).substr(2, 4).toUpperCase()}`;
        const newReferral = await insert('vendor_referrals', {
          referrer_vendor_id: resolvedVendorId,
          referral_code: code,
          referred_phone: '', // Will be set when code is sent
          status: 'pending',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
        referrals = newReferral;
      }

      return c.json({
        success: true,
        referralCode: referrals[0].referral_code,
      });
    } catch (error: any) {
      console.error('Error fetching vendor referral code:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * POST /vendor/:vendorId/referral/invite
   * Send referral code via SMS
   */
  app.post("/vendor/:vendorId/referral/invite", async (c) => {
    try {
      const { vendorId } = c.req.param();
      const { phone, message } = await c.req.json();

      // Verify vendor exists
      const vendor = await resolveVendorById(vendorId);
      if (!vendor) {
        return c.json({ error: 'Vendor not found' }, 404);
      }
      const resolvedVendorId = vendor.id;

      if (!phone) {
        return c.json({ error: 'Phone number is required' }, 400);
      }

      // Normalize phone number
      const normalizedPhone = phone.replace(/\D/g, '');
      if (normalizedPhone.length < 10) {
        return c.json({ error: 'Invalid phone number' }, 400);
      }
      const fullPhone = normalizedPhone.length === 10 ? `+91${normalizedPhone}` : `+${normalizedPhone}`;

      // Check if a referral record already exists for this phone number
      const existingForPhone = await query(
        `SELECT * FROM vendor_referrals 
         WHERE referrer_vendor_id = $1 
         AND referred_phone = $2 
         LIMIT 1`,
        [resolvedVendorId, fullPhone]
      );

      let referralCode: string;
      let referralRecord: any;

      if (existingForPhone.rows.length > 0) {
        // Reuse existing record for this phone number
        referralRecord = existingForPhone.rows[0];
        referralCode = referralRecord.referral_code;
        console.log(`Reusing existing referral record ${referralRecord.id} for phone ${fullPhone}`);
      } else {
        // Get or create referral code for this vendor
        const vendorReferrals = await query(
          `SELECT referral_code FROM vendor_referrals 
           WHERE referrer_vendor_id = $1 
           ORDER BY created_at ASC 
           LIMIT 1`,
          [resolvedVendorId]
        );

        if (vendorReferrals.rows.length > 0) {
          // Use existing referral code for this vendor
          referralCode = vendorReferrals.rows[0].referral_code;
        } else {
          // Generate new unique referral code for this vendor
          // Keep trying until we get a unique code
          let attempts = 0;
          let isUnique = false;
          while (!isUnique && attempts < 10) {
            referralCode = `VREF${resolvedVendorId.slice(-4).toUpperCase()}${Math.random().toString(36).substr(2, 4).toUpperCase()}`;
            const checkUnique = await query(
              `SELECT id FROM vendor_referrals WHERE referral_code = $1 LIMIT 1`,
              [referralCode]
            );
            if (checkUnique.rows.length === 0) {
              isUnique = true;
            }
            attempts++;
          }
          if (!isUnique) {
            return c.json({ error: 'Failed to generate unique referral code. Please try again.' }, 500);
          }
        }

        // Create new referral record for this phone number
        const newReferral = await insert('vendor_referrals', {
          referrer_vendor_id: resolvedVendorId,
          referral_code: referralCode,
          referred_phone: fullPhone,
          status: 'pending',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
        referralRecord = newReferral[0];
      }

      // Get vendor details for personalized message
      const vendorName = vendor?.business_name || vendor?.owner_name || 'Warmpawz';

      // Create SMS message
      const smsMessage = message || 
        `🎉 Join Warmpawz as a vendor! Use referral code ${referralCode} during registration to get started. Referred by ${vendorName}. Download the vendor app or visit vendor.warmpawz.com`;

      // Send SMS
      try {
        const smsResult = await sendSMS({
          to: fullPhone,
          message: smsMessage,
          type: 'transactional',
        });

        if (!smsResult.success) {
          console.error('Failed to send SMS:', smsResult);
          return c.json({ 
            error: 'Failed to send SMS. Please try again later.' 
          }, 500);
        }

        console.log(`✅ Vendor referral SMS sent to ${fullPhone} with code ${referralCode}`);
      } catch (smsError: any) {
        console.error('Error sending referral SMS:', smsError);
        return c.json({ 
          error: 'Failed to send SMS. Please try again later.' 
        }, 500);
      }

      return c.json({
        success: true,
        message: 'Referral code sent successfully',
        referralCode,
        phone: fullPhone,
      });
    } catch (error: any) {
      console.error('Error sending vendor referral invite:', error);
      const errorMessage = error?.message || error?.detail || String(error) || 'Service Unavailable';
      console.error('Error details:', {
        message: error?.message,
        detail: error?.detail,
        code: error?.code,
        constraint: error?.constraint,
        stack: error?.stack,
      });
      return c.json({ 
        error: errorMessage,
        details: error?.constraint ? `Database constraint violation: ${error.constraint}` : undefined,
      }, 500);
    }
  });

  /**
   * GET /vendor/:vendorId/referral/stats
   * Get referral statistics
   */
  app.get("/vendor/:vendorId/referral/stats", async (c) => {
    try {
      const { vendorId } = c.req.param();

      // Verify vendor exists
      const vendor = await resolveVendorById(vendorId);
      if (!vendor) {
        return c.json({ error: 'Vendor not found' }, 404);
      }
      const resolvedVendorId = vendor.id;

      // Get total referrals
      const totalReferrals = await query(
        `SELECT COUNT(*) as count 
         FROM vendor_referrals 
         WHERE referrer_vendor_id = $1 
         AND status IN ('applied', 'approved')`,
        [resolvedVendorId]
      );

      // Get pending referrals (code sent but not used)
      const pendingReferrals = await query(
        `SELECT COUNT(*) as count 
         FROM vendor_referrals 
         WHERE referrer_vendor_id = $1 
         AND status = 'pending'`,
        [resolvedVendorId]
      );

      // Get applied referrals (code used but vendor not approved yet)
      const appliedReferrals = await query(
        `SELECT COUNT(*) as count 
         FROM vendor_referrals 
         WHERE referrer_vendor_id = $1 
         AND status = 'applied'`,
        [resolvedVendorId]
      );

      // Get approved referrals (vendor approved, points awarded)
      const approvedReferrals = await query(
        `SELECT COUNT(*) as count 
         FROM vendor_referrals 
         WHERE referrer_vendor_id = $1 
         AND status = 'approved'`,
        [resolvedVendorId]
      );

      // Get monthly stats
      const monthlyReferrals = await query(
        `SELECT COUNT(*) as count 
         FROM vendor_referrals 
         WHERE referrer_vendor_id = $1 
         AND status = 'approved'
         AND approved_at >= DATE_TRUNC('month', CURRENT_DATE)`,
        [resolvedVendorId]
      );

      return c.json({
        success: true,
        totalReferrals: parseInt(totalReferrals.rows[0]?.count || '0', 10),
        pendingReferrals: parseInt(pendingReferrals.rows[0]?.count || '0', 10),
        appliedReferrals: parseInt(appliedReferrals.rows[0]?.count || '0', 10),
        approvedReferrals: parseInt(approvedReferrals.rows[0]?.count || '0', 10),
        monthlyReferrals: parseInt(monthlyReferrals.rows[0]?.count || '0', 10),
      });
    } catch (error: any) {
      console.error('Error fetching vendor referral stats:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * GET /vendor/:vendorId/referral/history
   * Get referral history
   */
  app.get("/vendor/:vendorId/referral/history", async (c) => {
    try {
      const { vendorId } = c.req.param();
      const limit = parseInt(c.req.query('limit') || '50', 10);

      // Verify vendor exists
      const vendor = await resolveVendorById(vendorId);
      if (!vendor) {
        return c.json({ error: 'Vendor not found' }, 404);
      }
      const resolvedVendorId = vendor.id;

      const history = await query(
        `SELECT 
          vr.*,
          v.business_name as referred_vendor_name,
          v.owner_name as referred_vendor_owner,
          v.phone as referred_vendor_phone,
          v.status as referred_vendor_status
         FROM vendor_referrals vr
         LEFT JOIN vendors v ON vr.referred_vendor_id = v.id
         WHERE vr.referrer_vendor_id = $1
         ORDER BY vr.created_at DESC
         LIMIT $2`,
        [resolvedVendorId, limit]
      );

      return c.json({
        success: true,
        history: history.rows,
        count: history.rows.length,
      });
    } catch (error: any) {
      console.error('Error fetching vendor referral history:', error);
      return c.json({ error: error.message }, 500);
    }
  });
}
