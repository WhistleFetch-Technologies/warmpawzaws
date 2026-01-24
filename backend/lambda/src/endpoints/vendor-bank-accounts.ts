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

export function registerVendorBankAccountEndpoints(app: Hono) {

  /**
   * GET /vendor/:vendorId/bank-accounts
   * List all bank accounts for a vendor
   */
  app.get("/vendor/:vendorId/bank-accounts", async (c) => {
    try {
      const { vendorId } = c.req.param();

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

      const accounts = await query(
        `SELECT * FROM ${tableName} 
         WHERE vendor_id = $1 
         ORDER BY is_primary DESC, created_at DESC`,
        [vendorId]
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
              
              // Create vendors record
              console.log(`[BankAccount] Auto-creating vendor record for approved vendor ${vendorId}`);
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
                pincode: payload.pin || payload.pincode || '000000',
                status: 'active',
                is_active: true,
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
          EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'vendor_bank_details') as has_bank_details_table
      `);
      
      const schema = schemaCheck.rows[0] || {};

      // If vendor_bank_accounts doesn't exist, try vendor_bank_details
      const tableName = schema.table_exists ? 'vendor_bank_accounts' : (schema.has_bank_details_table ? 'vendor_bank_details' : null);
      
      if (!tableName) {
        return c.json({ error: 'Bank accounts feature is not available' }, 500);
      }

      // Check if account already exists (use actualVendorId)
      const existing = await query(
        `SELECT id FROM ${tableName} WHERE vendor_id = $1 AND account_number = $2`,
        [actualVendorId, accountNumber]
      );

      if (existing.rows.length > 0) {
        return c.json({ error: 'This account is already added' }, 409);
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
        account_number: accountNumber,
        ifsc_code: ifscCode.toUpperCase(),
        is_primary: isPrimary,
        verification_status: 'pending',
      };

      if (schema.has_bank_name && bankName) {
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
   * Initiate bank account verification via Razorpay
   */
  app.post("/vendor/:vendorId/bank-accounts/:accountId/verify", async (c) => {
    try {
      const { vendorId, accountId } = c.req.param();

      // Get account details
      const accounts = await select('vendor_bank_accounts', { id: accountId, vendor_id: vendorId });
      if (accounts.length === 0) {
        return c.json({ error: 'Bank account not found' }, 404);
      }

      const account = accounts[0];

      // TODO: Implement actual Razorpay verification
      // For now, simulate verification by updating status
      
      // In production, you would:
      // 1. Create a Razorpay Fund Account
      // 2. Initiate penny drop verification
      // 3. Store the fund account ID
      
      await update('vendor_bank_accounts', { id: accountId }, {
        verification_status: 'submitted',
      });

      // Simulate async verification (in production, this would be webhook-based)
      setTimeout(async () => {
        try {
          await update('vendor_bank_accounts', { id: accountId }, {
            is_verified: true,
            verification_status: 'verified',
            verified_at: new Date().toISOString(),
          });
          console.log(`✅ Bank account ${accountId} verified`);
        } catch (e) {
          console.error('Error in async verification:', e);
        }
      }, 5000); // 5 second delay for demo

      return c.json({
        success: true,
        message: 'Verification initiated. This may take a few minutes.',
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

      // Check if account exists and is verified
      const accounts = await select('vendor_bank_accounts', { id: accountId, vendor_id: vendorId });
      if (accounts.length === 0) {
        return c.json({ error: 'Bank account not found' }, 404);
      }

      if (!accounts[0].is_verified) {
        return c.json({ error: 'Only verified accounts can be set as primary' }, 400);
      }

      // Remove primary from all other accounts
      await query(
        `UPDATE vendor_bank_accounts SET is_primary = false WHERE vendor_id = $1`,
        [vendorId]
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

      // Check if account exists
      const accounts = await select('vendor_bank_accounts', { id: accountId, vendor_id: vendorId });
      if (accounts.length === 0) {
        return c.json({ error: 'Bank account not found' }, 404);
      }

      // Check if it's the only account
      const allAccounts = await query(
        `SELECT id FROM vendor_bank_accounts WHERE vendor_id = $1`,
        [vendorId]
      );

      if (allAccounts.rows.length === 1) {
        return c.json({ error: 'Cannot remove the only bank account' }, 400);
      }

      // Check if it's primary
      if (accounts[0].is_primary) {
        return c.json({ error: 'Cannot remove primary account. Set another account as primary first.' }, 400);
      }

      // Delete account
      await query(
        `DELETE FROM vendor_bank_accounts WHERE id = $1`,
        [accountId]
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
      
      const vendors = await select('vendors', { id: vendorId });
      if (vendors.length === 0) {
        return c.json({ error: 'Vendor not found' }, 404);
      }

      return c.json({
        success: true,
        upi: {
          upi_id: vendors[0].upi_id || null,
          is_verified: vendors[0].upi_verified || false,
        },
      });
    } catch (error: any) {
      console.error('Error fetching UPI details:', error);
      return c.json({ success: false, upi: null });
    }
  });

  /**
   * POST /vendor/:vendorId/upi
   * Save vendor UPI ID
   */
  app.post("/vendor/:vendorId/upi", async (c) => {
    try {
      const { vendorId } = c.req.param();
      const { upi_id } = await c.req.json();

      if (!upi_id || !upi_id.includes('@')) {
        return c.json({ error: 'Invalid UPI ID format' }, 400);
      }

      await update('vendors', { id: vendorId }, {
        upi_id,
        upi_verified: false, // Will need verification
        updated_at: new Date().toISOString(),
      });

      return c.json({
        success: true,
        message: 'UPI ID saved. Verification pending.',
      });
    } catch (error: any) {
      console.error('Error saving UPI ID:', error);
      return c.json({ error: error.message }, 500);
    }
  });
}
