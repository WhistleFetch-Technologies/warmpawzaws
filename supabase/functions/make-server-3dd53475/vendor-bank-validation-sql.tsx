/**
 * Vendor Bank Account Validation Endpoints - SQL VERSION
 * 
 * ✅ MIGRATED: All KV operations replaced with SQL repository calls
 * - kv.get('vendor:${vendorId}') → VendorsRepository.findById()
 * - kv.set('vendor:${vendorId}') → BankAccountsRepository.create() or update()
 * - kv.set('vendor:${vendorId}:bank-update:...') → BankAccountsRepository.createVerification()
 * 
 * Features:
 * - IFSC code validation using Razorpay API
 * - Bank details storage in vendor_bank_details table
 * - Account verification in bank_verifications table
 */

import { Hono } from 'npm:hono';
import { getVendorsRepository, getBankAccountsRepository } from '../../lib/repositories/index.ts';

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
 * ✅ MIGRATED: Uses BankAccountsRepository
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

    // ✅ MIGRATED: Get vendor from SQL
    const vendorsRepo = getVendorsRepository();
    const vendor = await vendorsRepo.findById(vendorId);

    if (!vendor) {
      return c.json({ success: false, error: 'Vendor not found' }, 404);
    }

    // ✅ MIGRATED: Create or update bank account in SQL
    const bankAccountsRepo = getBankAccountsRepository();
    
    // Check if vendor already has a primary bank account
    const existingAccount = await bankAccountsRepo.findPrimaryByVendor(vendorId);
    
    let bankAccount;
    if (existingAccount) {
      // Update existing account
      bankAccount = await bankAccountsRepo.update(existingAccount.id, {
        account_holder_name: bankDetails.accountHolderName,
        ifsc_code: bankDetails.ifscCode,
        bank_name: bankDetails.bankName,
        branch_name: bankDetails.branchName,
        verification_status: 'pending'
      });
    } else {
      // Create new account
      bankAccount = await bankAccountsRepo.create({
        vendor_id: vendorId,
        account_holder_name: bankDetails.accountHolderName,
        account_number: bankDetails.accountNumber,
        ifsc_code: bankDetails.ifscCode,
        bank_name: bankDetails.bankName,
        branch_name: bankDetails.branchName,
        account_type: 'savings',
        is_primary: true
      });
    }

    // ✅ MIGRATED: Create verification record for audit
    await bankAccountsRepo.createVerification({
      vendor_id: vendorId,
      bank_detail_id: bankAccount.id,
      verification_method: 'manual',
      verification_status: 'pending'
    });

    console.log('✅ Bank details saved successfully');

    return c.json({
      success: true,
      message: 'Bank details saved successfully',
      bankDetails: {
        accountHolderName: bankAccount.account_holder_name,
        bankName: bankAccount.bank_name,
        branchName: bankAccount.branch_name,
        ifscCode: bankAccount.ifsc_code,
        verified: bankAccount.verification_status === 'verified'
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
 * ✅ MIGRATED: Uses BankAccountsRepository
 */
app.get('/vendor/:vendorId/bank-details', async (c) => {
  try {
    const { vendorId } = c.req.param();

    // ✅ MIGRATED: Get vendor from SQL
    const vendorsRepo = getVendorsRepository();
    const vendor = await vendorsRepo.findById(vendorId);

    if (!vendor) {
      return c.json({ success: false, error: 'Vendor not found' }, 404);
    }

    // ✅ MIGRATED: Get bank accounts from SQL
    const bankAccountsRepo = getBankAccountsRepository();
    const bankAccounts = await bankAccountsRepo.findByVendor(vendorId);

    if (bankAccounts.length === 0) {
      return c.json({
        success: true,
        bankDetails: null,
        message: 'No bank details found'
      });
    }

    // Get primary account or first account
    const primaryAccount = bankAccounts.find(a => a.is_primary) || bankAccounts[0];

    // Mask account number for security
    const maskedAccountNumber = primaryAccount.account_number_masked || 
      (primaryAccount.account_number ? `****${primaryAccount.account_number.slice(-4)}` : '');

    return c.json({
      success: true,
      bankDetails: {
        accountHolderName: primaryAccount.account_holder_name,
        accountNumber: maskedAccountNumber, // Masked
        ifscCode: primaryAccount.ifsc_code,
        bankName: primaryAccount.bank_name,
        branchName: primaryAccount.branch_name,
        verified: primaryAccount.verification_status === 'verified',
        verifiedAt: primaryAccount.last_verification_attempt
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

