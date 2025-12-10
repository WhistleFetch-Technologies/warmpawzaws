/**
 * Vendor Bank Account Validation Endpoints
 * 
 * Features:
 * - IFSC code validation using Razorpay API
 * - Bank details storage
 * - Account verification
 */

import { Hono } from 'npm:hono';
import * as kv from './kv_store.tsx';

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

    // Get vendor
    const vendor = await kv.get(`vendor:${vendorId}`);

    if (!vendor) {
      return c.json({ success: false, error: 'Vendor not found' }, 404);
    }

    // Update vendor with bank details
    const updatedVendor = {
      ...vendor,
      bankDetails: {
        accountHolderName: bankDetails.accountHolderName,
        accountNumber: bankDetails.accountNumber, // In production, encrypt this!
        ifscCode: bankDetails.ifscCode,
        bankName: bankDetails.bankName,
        branchName: bankDetails.branchName,
        verified: true,
        verifiedAt: new Date().toISOString()
      },
      bankDetailsUpdatedAt: new Date().toISOString()
    };

    await kv.set(`vendor:${vendorId}`, updatedVendor);

    // Log bank details update for audit
    await kv.set(`vendor:${vendorId}:bank-update:${Date.now()}`, {
      vendorId,
      bankName: bankDetails.bankName,
      branchName: bankDetails.branchName,
      ifscCode: bankDetails.ifscCode,
      updatedAt: new Date().toISOString(),
      updatedBy: 'vendor'
    });

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

    const vendor = await kv.get(`vendor:${vendorId}`);

    if (!vendor) {
      return c.json({ success: false, error: 'Vendor not found' }, 404);
    }

    if (!vendor.bankDetails) {
      return c.json({
        success: true,
        bankDetails: null,
        message: 'No bank details found'
      });
    }

    // Mask account number for security
    const maskedAccountNumber = vendor.bankDetails.accountNumber
      ? `****${vendor.bankDetails.accountNumber.slice(-4)}`
      : '';

    return c.json({
      success: true,
      bankDetails: {
        accountHolderName: vendor.bankDetails.accountHolderName,
        accountNumber: maskedAccountNumber, // Masked
        ifscCode: vendor.bankDetails.ifscCode,
        bankName: vendor.bankDetails.bankName,
        branchName: vendor.bankDetails.branchName,
        verified: vendor.bankDetails.verified || false,
        verifiedAt: vendor.bankDetails.verifiedAt
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
