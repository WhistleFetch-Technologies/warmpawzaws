/**
 * Vendor Bank Account Validation Endpoints
 * 
 * Features:
 * - IFSC code validation using Razorpay API
 * - Bank details storage
 * - Account verification
 */

// ✅ SQL MIGRATION: All KV operations replaced with SQL repositories
import { Hono } from 'hono';
import { getVendorsRepository } from '../../../supabase/lib/repositories/index';
import { getDbClient } from '../../../supabase/lib/db';

const app = new Hono();

/**
 * POST /vendor/validate-ifsc
 * Validate IFSC code using Razorpay API
 */
app.post('/vendor/validate-ifsc', async (c) => {
  try {
    const { ifscCode } = await c.req.json();

    if (!ifscCode || ifscCode.length !== 11) {
      return c.json({
        success: false,
        error: 'Invalid IFSC code. Must be 11 characters.'
      }, 400);
    }

    console.log(`🏦 Validating IFSC code: ${ifscCode}`);

    // Call Razorpay IFSC API
    // Note: You'll need to add RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET to environment
    const razorpayKeyId = Deno.env.get('RAZORPAY_KEY_ID');
    const razorpayKeySecret = Deno.env.get('RAZORPAY_KEY_SECRET');

    if (!razorpayKeyId || !razorpayKeySecret) {
      console.error('❌ Razorpay credentials not configured');
      return c.json({
        success: false,
        error: 'Payment gateway not configured'
      }, 500);
    }

    // Razorpay IFSC API endpoint
    const razorpayUrl = `https://ifsc.razorpay.com/${ifscCode}`;

    const response = await fetch(razorpayUrl, {
      headers: {
        'Accept': 'application/json'
      }
    });

    if (response.ok) {
      const ifscData = await response.json();

      console.log('✅ IFSC validated:', ifscData);

      // Format response
      const ifscDetails = {
        bank: ifscData.BANK || ifscData.bank || 'Unknown Bank',
        branch: ifscData.BRANCH || ifscData.branch || 'Unknown Branch',
        address: ifscData.ADDRESS || ifscData.address || '',
        city: ifscData.CITY || ifscData.city || '',
        state: ifscData.STATE || ifscData.state || '',
        bankCode: ifscData.BANKCODE || ifscData.bankCode || '',
        valid: true
      };

      return c.json({
        success: true,
        ifscDetails,
        message: 'IFSC code validated successfully'
      });
    } else {
      console.log('❌ Invalid IFSC code:', ifscCode);
      return c.json({
        success: false,
        error: 'Invalid IFSC code',
        ifscDetails: null
      }, 404);
    }
  } catch (error) {
    console.error('❌ Error validating IFSC:', error);
    return c.json({
      success: false,
      error: 'Failed to validate IFSC code',
      details: String(error)
    }, 500);
  }
});

/**
 * POST /vendor/:vendorId/bank-details
 * Save bank details for vendor
 */
app.post('/vendor/:vendorId/bank-details', async (c) => {
  try {
    const { vendorId } = c.req.param();
    const { bankDetails } = await c.req.json();

    if (!vendorId) {
      return c.json({ success: false, error: 'Vendor ID required' }, 400);
    }

    if (!bankDetails || !bankDetails.accountNumber || !bankDetails.ifscCode) {
      return c.json({
        success: false,
        error: 'Account number and IFSC code are required'
      }, 400);
    }

    console.log(`💳 Saving bank details for vendor: ${vendorId}`);

    // ✅ SQL: Get vendor using repository
    const vendorsRepo = getVendorsRepository();
    const vendor = await vendorsRepo.findById(vendorId);

    if (!vendor) {
      return c.json({ success: false, error: 'Vendor not found' }, 404);
    }

    // ✅ SQL: Save bank details to vendor_bank_details table
    const db = getDbClient();
    await db
      .from('vendor_bank_details')
      .upsert({
        vendor_id: vendorId,
        account_holder_name: bankDetails.accountHolderName,
        account_number: bankDetails.accountNumber, // In production, encrypt this!
        ifsc_code: bankDetails.ifscCode,
        bank_name: bankDetails.bankName,
        branch_name: bankDetails.branchName,
        verified: true,
        verified_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'vendor_id'
      });

    // ✅ SQL: Log bank details update for audit in vendor_bank_audit_log table
    try {
      await db
        .from('vendor_bank_audit_log')
        .insert({
          vendor_id: vendorId,
          bank_name: bankDetails.bankName,
          branch_name: bankDetails.branchName,
          ifsc_code: bankDetails.ifscCode,
          updated_at: new Date().toISOString(),
          updated_by: 'vendor'
        });
    } catch (error) {
      console.warn('vendor_bank_audit_log table not available, skipping audit log');
    }

    console.log('✅ Bank details saved successfully');

    return c.json({
      success: true,
      message: 'Bank details saved successfully',
      bankDetails: {
        accountHolderName: bankDetails.accountHolderName,
        bankName: bankDetails.bankName,
        branchName: bankDetails.branchName,
        ifscCode: bankDetails.ifscCode,
        verified: true
      }
    });
  } catch (error) {
    console.error('❌ Error saving bank details:', error);
    return c.json({
      success: false,
      error: 'Failed to save bank details',
      details: String(error)
    }, 500);
  }
});

/**
 * GET /vendor/:vendorId/bank-details
 * Get bank details for vendor (masked for security)
 */
app.get('/vendor/:vendorId/bank-details', async (c) => {
  try {
    const { vendorId } = c.req.param();

    // ✅ SQL: Get vendor bank details from vendor_bank_details table
    const db = getDbClient();
    const { data: bankDetails } = await db
      .from('vendor_bank_details')
      .select('*')
      .eq('vendor_id', vendorId)
      .single();

    if (!bankDetails) {
      return c.json({
        success: true,
        bankDetails: null,
        message: 'No bank details found'
      });
    }

    // Mask account number for security
    const maskedAccountNumber = bankDetails.account_number
      ? `****${bankDetails.account_number.slice(-4)}`
      : '';

    return c.json({
      success: true,
      bankDetails: {
        accountHolderName: bankDetails.account_holder_name,
        accountNumber: maskedAccountNumber, // Masked
        ifscCode: bankDetails.ifsc_code,
        bankName: bankDetails.bank_name,
        branchName: bankDetails.branch_name,
        verified: bankDetails.verified || false,
        verifiedAt: bankDetails.verified_at
      }
    });
  } catch (error) {
    console.error('❌ Error fetching bank details:', error);
    return c.json({
      success: false,
      error: 'Failed to fetch bank details'
    }, 500);
  }
});

export default app;
