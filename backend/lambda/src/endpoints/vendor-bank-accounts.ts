/**
 * ============================================================================
 * VENDOR BANK ACCOUNTS - Razorpay Marketplace Integration
 * ============================================================================
 * 
 * Features:
 * - Add/remove bank accounts
 * - Verify accounts via Razorpay
 * - Set primary account for settlements
 * 
 * Date: 2026-01-19
 * ============================================================================
 */

import { Hono } from 'hono';
import { select, insert, update, query } from '../database/rds-connection';
import { resolveVendorById } from './vendor/endpoints/vendor-profile.vendor';

export function registerVendorBankAccountEndpoints(app: Hono) {

  /**
   * GET /vendor/:vendorId/bank-accounts
   * List all bank accounts for a vendor
   * ✅ Resolve identity id to vendors.id so list matches stored rows
   */
  app.get("/vendor/:vendorId/bank-accounts", async (c) => {
    try {
      const { vendorId } = c.req.param();

      const vendor = await resolveVendorById(vendorId);
      const resolvedVendorId = vendor?.id ?? vendorId;

      // ✅ FIX: Check which table exists (vendor_bank_accounts or vendor_bank_details)
      const schemaCheck = await query(`
        SELECT 
          EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'vendor_bank_accounts') as table_exists,
          EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'vendor_bank_details') as has_bank_details_table
      `);
      
      const schema = schemaCheck.rows[0] || {};
      const tableName = schema.table_exists ? 'vendor_bank_accounts' : (schema.has_bank_details_table ? 'vendor_bank_details' : null);
      
      if (!tableName) {
        return c.json({
          success: true,
          accounts: [],
        });
      }

      // ✅ PROD FIX: Only use is_primary in ORDER BY if table is vendor_bank_accounts (vendor_bank_details doesn't have this column)
      const orderByClause = schema.table_exists 
        ? 'ORDER BY is_primary DESC, created_at DESC' 
        : 'ORDER BY created_at DESC';
      
      const accounts = await query(
        `SELECT * FROM ${tableName} 
         WHERE vendor_id = $1 
         ${orderByClause}`,
        [resolvedVendorId]
      );

      return c.json({
        success: true,
        accounts: accounts.rows,
      });
    } catch (error: any) {
      console.error('Error fetching bank accounts:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * POST /vendor/:vendorId/bank-accounts or /vendor/:vendorId/bank-account
   * Add a new bank account
   */
  const addBankAccountHandler = async (c: any) => {
    try {
      const { vendorId } = c.req.param();
      const body = await c.req.json();
      
      // Support both camelCase and snake_case field names
      const accountHolderName = body.accountHolderName || body.account_holder_name;
      const accountNumber = body.accountNumber || body.account_number;
      const ifscCode = body.ifscCode || body.ifsc_code;
      const accountType = body.accountType || body.account_type;
      const bankName = body.bankName || body.bank_name;
      const branchName = body.branchName || body.branch_name;

      // Validation
      if (!accountHolderName || !accountNumber || !ifscCode) {
        return c.json({ error: 'Account holder name, account number, and IFSC code are required' }, 400);
      }

      // ✅ CRITICAL FIX: Ensure vendor exists in vendors table before inserting
      // If vendor only exists in vendor_identity (approved), we need to find or create the vendor record
      let actualVendorId = vendorId;
      const existingVendor = await select('vendors', { id: vendorId });
      if (existingVendor.length === 0) {
        console.log(`[BankAccount] Vendor ${vendorId} not found in vendors table, checking vendor_identity...`);
        const identities = await select('vendor_identity', { id: vendorId });
        if (identities.length > 0) {
          const identity = identities[0];
          if (identity.onboarding_status === 'APPROVED' || identity.onboarding_status === 'ACTIVATED') {
            // Check if vendor exists by phone (there might be an existing vendor with different ID)
            const vendorByPhone = await select('vendors', { phone: identity.phone });
            if (vendorByPhone.length > 0) {
              actualVendorId = vendorByPhone[0].id;
              console.log(`[BankAccount] Found existing vendor by phone: ${actualVendorId}`);
            } else {
              // Get application data for vendor details
              const applications = await select('vendor_onboarding_applications', { vendor_identity_id: vendorId });
              const application = applications.length > 0 ? applications[0] : null;
              const payload = application?.application_payload || {};
              
              // ✅ FIX: Extract profile photo and pincode from application
              const { extractProfilePhotoFromApplication, extractPincodeFromPayload } = await import('../utils/extract-profile-photo');
              const profilePhotoUrl = extractProfilePhotoFromApplication(application, payload);
              const pincodeValue = extractPincodeFromPayload(payload);
              
              // ✅ FIX: Extract service_radius from payload
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
              
              console.log(`[BankAccount] Auto-creating vendor record for approved vendor ${vendorId}`);
              const { resolveNewVendorOnboardingTier } = await import('../utils/onboarding-f100-tier');
              const tr = await resolveNewVendorOnboardingTier({
                email: payload.email,
                businessName: payload.businessName || payload.business_name,
              });
              const newVendor = await insert('vendors', {
                id: vendorId,
                phone: identity.phone,
                email: payload.email || `vendor-${identity.phone}@warmpawz.app`,
                business_name: payload.businessName || payload.business_name || `Vendor ${identity.phone}`,
                owner_name: payload.contactPersonName || payload.ownerName || 'Vendor Owner',
                role_id: identity.selected_role_id,
                category: 'general',
                address: payload.address || 'Not specified',
                city: payload.city || 'Not specified',
                state: payload.state || 'Not specified',
                pincode: pincodeValue, // ✅ FIX: Use enhanced pincode extraction
                profile_photo_url: profilePhotoUrl, // ✅ FIX: Save profile photo from onboarding
                service_radius: serviceRadius, // ✅ FIX: Save service_radius from onboarding
                status: 'active',
                is_active: true,
                is_deleted: false,
                tier: tr.tier,
                commission_percentage: tr.commission_percentage,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              });
              console.log(`[BankAccount] Created vendor record for ${vendorId}`);
            }
          } else {
            return c.json({ error: 'Vendor not approved or activated' }, 403);
          }
        } else {
          return c.json({ error: 'Vendor not found' }, 404);
        }
      }

      // Check what columns exist in the table
      const schemaCheck = await query(`
        SELECT 
          EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'vendor_bank_accounts') as table_exists,
          EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'vendor_bank_accounts' AND column_name = 'branch_name') as has_branch_name,
          EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'vendor_bank_accounts' AND column_name = 'bank_name') as has_bank_name,
          EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'vendor_bank_accounts' AND column_name = 'account_type') as has_account_type,
          EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'vendor_bank_details') as has_bank_details_table,
          EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'vendor_bank_details' AND column_name = 'bank_name') as vendor_bank_details_has_bank_name
      `);
      
      const schema = schemaCheck.rows[0] || {};

      // If vendor_bank_accounts doesn't exist, try vendor_bank_details
      const tableName = schema.table_exists ? 'vendor_bank_accounts' : (schema.has_bank_details_table ? 'vendor_bank_details' : null);
      
      if (!tableName) {
        return c.json({ error: 'Bank accounts feature is not available' }, 500);
      }

      // ✅ PROD FIX: vendor_bank_details requires bank_name (NOT NULL constraint)
      if (tableName === 'vendor_bank_details' && (!bankName || bankName.trim() === '')) {
        return c.json({ error: 'Bank name is required' }, 400);
      }

      // Check if account already exists (use actualVendorId)
      const existing = await query(
        `SELECT id FROM ${tableName} WHERE vendor_id = $1 AND account_number = $2`,
        [actualVendorId, accountNumber]
      );

      const updateData: any = {
        account_holder_name: accountHolderName,
        account_number: accountNumber.replace(/\s/g, ''),
        ifsc_code: ifscCode.toUpperCase(),
        updated_at: new Date().toISOString(),
      };
      if (schema.table_exists) {
        updateData.verification_status = 'pending';
      } else {
        updateData.is_verified = false;
      }
      // ✅ PROD FIX: Always set bank_name for vendor_bank_details (required NOT NULL), conditionally for vendor_bank_accounts
      if (tableName === 'vendor_bank_details') {
        updateData.bank_name = bankName || 'Unknown Bank'; // Required for vendor_bank_details
      } else if (schema.has_bank_name && bankName) {
        updateData.bank_name = bankName;
      }
      if (schema.has_branch_name && branchName) {
        updateData.branch_name = branchName;
      }
      if (schema.has_account_type) {
        updateData.account_type = accountType || 'savings';
      }

      if (existing.rows.length > 0) {
        // Update existing account so "Save & Verify" and changing account details work
        const existingId = existing.rows[0].id;
        await update(tableName, { id: existingId, vendor_id: actualVendorId }, updateData);
        const updated = await query(
          `SELECT * FROM ${tableName} WHERE id = $1 AND vendor_id = $2`,
          [existingId, actualVendorId]
        );
        return c.json({
          success: true,
          account: updated.rows?.[0] ?? existing.rows[0],
          message: 'Bank account updated successfully',
        });
      }

      // Check if this is the first account (use actualVendorId)
      const existingAccounts = await query(
        `SELECT id FROM ${tableName} WHERE vendor_id = $1`,
        [actualVendorId]
      );
      const isPrimary = existingAccounts.rows.length === 0;

      // Build insert data dynamically based on schema (use actualVendorId)
      const insertData: any = {
        vendor_id: actualVendorId,
        account_holder_name: accountHolderName,
        account_number: accountNumber.replace(/\s/g, ''),
        ifsc_code: ifscCode.toUpperCase(),
      };
      
      // ✅ PROD FIX: Only set is_primary if table is vendor_bank_accounts (vendor_bank_details doesn't have this column)
      if (schema.table_exists) {
        insertData.is_primary = isPrimary;
        insertData.verification_status = 'pending';
      } else {
        insertData.is_verified = false;
      }

      // ✅ PROD FIX: Always set bank_name for vendor_bank_details (required NOT NULL), conditionally for vendor_bank_accounts
      if (tableName === 'vendor_bank_details') {
        insertData.bank_name = bankName || 'Unknown Bank'; // Required for vendor_bank_details
      } else if (schema.has_bank_name && bankName) {
        insertData.bank_name = bankName;
      }
      if (schema.has_branch_name && branchName) {
        insertData.branch_name = branchName;
      }
      if (schema.has_account_type) {
        insertData.account_type = accountType || 'savings';
      }

      const result = await insert(tableName, insertData);

      return c.json({
        success: true,
        account: result[0],
        message: 'Bank account added successfully',
      });
    } catch (error: any) {
      console.error('Error adding bank account:', error);
      return c.json({ error: error.message }, 500);
    }
  };
  
  app.post("/vendor/:vendorId/bank-accounts", addBankAccountHandler);
  app.post("/vendor/:vendorId/bank-account", addBankAccountHandler);

  /**
   * POST /vendor/:vendorId/bank-accounts/:accountId/verify
   * Initiate bank account verification. Verification passes only when name, IFSC, and account number
   * are strictly validated (Razorpay verify-bank-account returns valid: true).
   */
  app.post("/vendor/:vendorId/bank-accounts/:accountId/verify", async (c) => {
    try {
      const { vendorId, accountId } = c.req.param();
      const resolvedVendorIdForSelect = (await resolveVendorById(vendorId))?.id ?? vendorId;

      const accounts = await select('vendor_bank_accounts', { id: accountId, vendor_id: resolvedVendorIdForSelect });
      if (accounts.length === 0) {
        return c.json({ error: 'Bank account not found' }, 404);
      }
      const account = accounts[0];

      const accountHolderName = account.account_holder_name || account.accountHolderName;
      const accountNumber = account.account_number || account.accountNumber;
      const ifscCode = (account.ifsc_code || account.ifscCode || '').toUpperCase();

      if (!accountHolderName || !accountNumber || !ifscCode) {
        return c.json({
          success: false,
          error: 'Bank account record missing name, account number, or IFSC. Cannot verify.',
        }, 400);
      }

      // Strict verification: call Razorpay verify-bank-account (valid only when name + IFSC + account all verified)
      const { getRazorpayConfig, getRazorpayAuthHeader } = await import('../utils/payments/razorpay-client');
      try {
        await getRazorpayConfig();
      } catch {
        return c.json({
          success: false,
          error: 'Razorpay not configured. Bank verification unavailable.',
        }, 503);
      }

      const verifyPayload = {
        account_number: String(accountNumber).replace(/\s/g, ''),
        ifsc_code: ifscCode,
        beneficiary_name: String(accountHolderName).trim(),
      };
      const verifyRes = await fetch(`${c.req.url.replace(c.req.path, '')}/razorpay/verify-bank-account`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(verifyPayload),
      });
      const verifyData = (verifyRes.ok ? await verifyRes.json().catch(() => ({})) : { valid: false }) as { valid?: boolean; error?: string; message?: string };

      if (verifyData.valid !== true) {
        await update('vendor_bank_accounts', { id: accountId }, {
          verification_status: 'failed',
          is_verified: false,
        });
        return c.json({
          success: false,
          valid: false,
          error: verifyData.error || 'Bank account verification failed',
          details: verifyData.message || 'Name, IFSC, and account number must all be valid and match. Verification requires Razorpay Fund Account Validation.',
        }, 400);
      }

      await update('vendor_bank_accounts', { id: accountId }, {
        is_verified: true,
        verification_status: 'verified',
        verified_at: new Date().toISOString(),
      });
      const resolvedVendorId = resolvedVendorIdForSelect;
      try {
        await query(
          `UPDATE vendors SET bank_verified = true, updated_at = NOW() WHERE id = $1`,
          [resolvedVendorId]
        );
      } catch (_) {}
      console.log(`✅ Bank account ${accountId} verified (strict check passed)`);

      return c.json({
        success: true,
        valid: true,
        message: 'Bank account verified successfully. You will receive automatic payouts as per your tier.',
      });
    } catch (error: any) {
      console.error('Error initiating verification:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * POST /vendor/:vendorId/bank-accounts/:accountId/set-primary
   * Set account as primary for settlements
   */
  app.post("/vendor/:vendorId/bank-accounts/:accountId/set-primary", async (c) => {
    try {
      const { vendorId, accountId } = c.req.param();
      const resolvedVendorId = (await resolveVendorById(vendorId))?.id ?? vendorId;

      // Check if account exists and is verified
      const accounts = await select('vendor_bank_accounts', { id: accountId, vendor_id: resolvedVendorId });
      if (accounts.length === 0) {
        return c.json({ error: 'Bank account not found' }, 404);
      }

      if (!accounts[0].is_verified) {
        return c.json({ error: 'Only verified accounts can be set as primary' }, 400);
      }

      // Remove primary from all other accounts
      await query(
        `UPDATE vendor_bank_accounts SET is_primary = false WHERE vendor_id = $1`,
        [resolvedVendorId]
      );

      // Set this account as primary
      await update('vendor_bank_accounts', { id: accountId }, {
        is_primary: true,
      });

      return c.json({
        success: true,
        message: 'Primary account updated',
      });
    } catch (error: any) {
      console.error('Error setting primary account:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * DELETE /vendor/:vendorId/bank-accounts/:accountId
   * Remove a bank account
   */
  app.delete("/vendor/:vendorId/bank-accounts/:accountId", async (c) => {
    try {
      const { vendorId, accountId } = c.req.param();
      const resolvedVendorId = (await resolveVendorById(vendorId))?.id ?? vendorId;

      // Check if account exists
      const accounts = await select('vendor_bank_accounts', { id: accountId, vendor_id: resolvedVendorId });
      if (accounts.length === 0) {
        return c.json({ error: 'Bank account not found' }, 404);
      }

      // Check if it's the only account
      const allAccounts = await query(
        `SELECT id FROM vendor_bank_accounts WHERE vendor_id = $1`,
        [resolvedVendorId]
      );

      if (allAccounts.rows.length === 1) {
        return c.json({ error: 'Cannot remove the only bank account' }, 400);
      }

      // Check if it's primary
      if (accounts[0].is_primary) {
        return c.json({ error: 'Cannot remove primary account. Set another account as primary first.' }, 400);
      }

      // Delete account (use resolved vendor id for consistency; row already matched by accountId)
      await query(
        `DELETE FROM vendor_bank_accounts WHERE id = $1 AND vendor_id = $2`,
        [accountId, resolvedVendorId]
      );

      return c.json({
        success: true,
        message: 'Bank account removed',
      });
    } catch (error: any) {
      console.error('Error removing bank account:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  // ============================================
  // UPI ENDPOINTS
  // ============================================

  /**
   * GET /vendor/:vendorId/upi
   * Get vendor UPI details
   */
  app.get("/vendor/:vendorId/upi", async (c) => {
    try {
      const { vendorId } = c.req.param();
      const trimmedId = (vendorId || '').trim();
      if (!trimmedId) {
        return c.json({ error: 'Vendor ID is required' }, 400);
      }

      // ✅ FIX: Use resolveVendorById to handle vendor_identity IDs and auto-create vendors row
      const vendor = await resolveVendorById(trimmedId);
      if (!vendor?.id) {
        return c.json({ error: 'Vendor not found' }, 404);
      }

      const savedUpi =
        vendor.upi_id != null && String(vendor.upi_id).trim() !== ''
          ? String(vendor.upi_id).trim()
          : null;

      return c.json({
        success: true,
        upi: {
          upi_id: savedUpi,
          is_verified: Boolean(vendor.upi_verified),
        },
      });
    } catch (error: any) {
      console.error('Error fetching UPI details:', error);
      return c.json({ error: error.message || 'Failed to fetch UPI details' }, 500);
    }
  });

  /**
   * POST /vendor/:vendorId/upi
   * Save vendor UPI ID
   */
  app.post("/vendor/:vendorId/upi", async (c) => {
    try {
      const { vendorId } = c.req.param();
      const trimmedId = (vendorId || '').trim();
      if (!trimmedId) {
        return c.json({ error: 'Vendor ID is required' }, 400);
      }

      const body = await c.req.json().catch(() => ({}));
      const rawUpi = body?.upi_id ?? body?.upiId;
      const upi_id = typeof rawUpi === 'string' ? rawUpi.trim() : rawUpi != null ? String(rawUpi).trim() : '';

      if (!upi_id || !upi_id.includes('@')) {
        return c.json({ error: 'Invalid UPI ID format' }, 400);
      }

      // ✅ FIX: Use resolveVendorById to handle vendor_identity IDs and auto-create vendors row
      const vendor = await resolveVendorById(trimmedId);
      if (!vendor?.id) {
        return c.json({ error: 'Vendor not found' }, 404);
      }

      const rows = await update('vendors', { id: vendor.id }, {
        upi_id,
        upi_verified: false, // Will need verification
        updated_at: new Date().toISOString(),
      });

      if (!rows?.length) {
        return c.json({ error: 'Failed to persist UPI ID' }, 500);
      }

      return c.json({
        success: true,
        message: 'UPI ID saved. Verification pending.',
        upi: {
          upi_id,
          is_verified: false,
        },
      });
    } catch (error: any) {
      console.error('Error saving UPI ID:', error);
      return c.json({ error: error.message }, 500);
    }
  });
}
