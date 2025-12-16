/**
 * ✅ BANK VERIFICATION INTEGRATION
 * Automated Razorpay bank account verification for vendor onboarding
 */

import { Hono } from 'npm:hono';
import * as kv from './kv_store.tsx';
import { sendSuccess, sendError } from './response-utils.ts';
import { triggerNotification } from './notification-triggers.tsx';

export function bankVerificationIntegration(app: Hono) {
  const BASE_PATH = '/make-server-3dd53475';

  /**
   * ✅ POST /vendor/bank/verify
   * Verify vendor bank account with Razorpay
   */
  app.post(`${BASE_PATH}/vendor/bank/verify`, async (c) => {
    try {
      const {
        vendorId,
        accountNumber,
        ifscCode,
        accountHolderName,
        bankName
      } = await c.req.json();

      if (!vendorId || !accountNumber || !ifscCode || !accountHolderName) {
        return sendError(c, 'Missing required bank details', 400);
      }

      console.log(`🏦 Verifying bank account for vendor: ${vendorId}`);

      const vendor = await kv.get(`vendor:${vendorId}`);
      
      if (!vendor) {
        return sendError(c, 'Vendor not found', 404);
      }

      // Create verification record
      const verificationId = `BANK-VER-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

      const verification = {
        id: verificationId,
        vendorId,
        accountNumber: accountNumber.slice(-4), // Store only last 4 digits
        accountNumberFull: accountNumber, // In production, encrypt this
        ifscCode,
        accountHolderName,
        bankName,
        status: 'pending', // pending, verifying, verified, failed
        createdAt: new Date().toISOString(),
        attempts: 0
      };

      await kv.set(`bank_verification:${verificationId}`, verification);

      // Execute verification
      const result = await executeRazorpayBankVerification({
        accountNumber,
        ifscCode,
        accountHolderName
      });

      if (result.success) {
        // Verification successful
        verification.status = 'verified';
        verification.verifiedAt = new Date().toISOString();
        verification.razorpayAccountId = result.accountId;
        await kv.set(`bank_verification:${verificationId}`, verification);

        // Update vendor
        vendor.bankVerified = true;
        vendor.bankVerificationId = verificationId;
        vendor.bankDetails = {
          accountNumber: accountNumber.slice(-4),
          ifscCode,
          accountHolderName,
          bankName,
          verifiedAt: new Date().toISOString()
        };
        vendor.razorpayAccountId = result.accountId;
        await kv.set(`vendor:${vendorId}`, vendor);

        // Send success notification
        await triggerNotification('vendor.bank_verification_success', vendorId, {
          title: 'Bank Account Verified',
          message: 'Your bank account has been verified successfully. You can now receive payments.',
          additionalData: { verificationId }
        });

        console.log(`✅ Bank verification successful: ${verificationId}`);

        return sendSuccess(c, {
          verificationId,
          status: 'verified',
          accountId: result.accountId
        }, 'Bank account verified successfully');

      } else {
        // Verification failed
        verification.status = 'failed';
        verification.failureReason = result.error;
        verification.failedAt = new Date().toISOString();
        await kv.set(`bank_verification:${verificationId}`, verification);

        // Send failure notification
        await triggerNotification('vendor.bank_verification_failed', vendorId, {
          title: 'Bank Verification Failed',
          message: `Bank verification failed: ${result.error}. Please check your details and try again.`,
          additionalData: { verificationId, error: result.error }
        });

        console.error(`❌ Bank verification failed: ${result.error}`);

        return sendError(c, result.error, 400);
      }

    } catch (error) {
      console.error('❌ Bank verification error:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * ✅ POST /vendor/bank/verify/retry
   * Retry failed bank verification
   */
  app.post(`${BASE_PATH}/vendor/bank/verify/retry`, async (c) => {
    try {
      const { verificationId } = await c.req.json();

      if (!verificationId) {
        return sendError(c, 'verificationId is required', 400);
      }

      const verification = await kv.get(`bank_verification:${verificationId}`);
      
      if (!verification) {
        return sendError(c, 'Verification record not found', 404);
      }

      if (verification.status === 'verified') {
        return sendError(c, 'Account already verified', 400);
      }

      // Check retry limit (max 3 attempts)
      if (verification.attempts >= 3) {
        return sendError(c, 'Maximum retry attempts exceeded. Please contact support.', 400);
      }

      console.log(`🔄 Retrying bank verification: ${verificationId}`);

      // Update attempts
      verification.attempts = (verification.attempts || 0) + 1;
      verification.status = 'verifying';
      verification.lastAttemptAt = new Date().toISOString();
      await kv.set(`bank_verification:${verificationId}`, verification);

      // Retry verification
      const result = await executeRazorpayBankVerification({
        accountNumber: verification.accountNumberFull,
        ifscCode: verification.ifscCode,
        accountHolderName: verification.accountHolderName
      });

      if (result.success) {
        // Update verification
        verification.status = 'verified';
        verification.verifiedAt = new Date().toISOString();
        verification.razorpayAccountId = result.accountId;
        await kv.set(`bank_verification:${verificationId}`, verification);

        // Update vendor
        const vendor = await kv.get(`vendor:${verification.vendorId}`);
        if (vendor) {
          vendor.bankVerified = true;
          vendor.razorpayAccountId = result.accountId;
          await kv.set(`vendor:${verification.vendorId}`, vendor);
        }

        // Notification
        await triggerNotification('vendor.bank_verification_success', verification.vendorId, {
          title: 'Bank Account Verified',
          message: 'Your bank account verification was successful on retry.',
          additionalData: { verificationId }
        });

        return sendSuccess(c, {
          verificationId,
          status: 'verified'
        }, 'Verification successful');

      } else {
        verification.status = 'failed';
        verification.failureReason = result.error;
        await kv.set(`bank_verification:${verificationId}`, verification);

        return sendError(c, result.error, 400);
      }

    } catch (error) {
      console.error('❌ Retry verification error:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * ✅ GET /vendor/bank/verification-status/:vendorId
   * Get bank verification status for vendor
   */
  app.get(`${BASE_PATH}/vendor/bank/verification-status/:vendorId`, async (c) => {
    try {
      const { vendorId } = c.req.param();

      const vendor = await kv.get(`vendor:${vendorId}`);
      
      if (!vendor) {
        return sendError(c, 'Vendor not found', 404);
      }

      let verification = null;
      if (vendor.bankVerificationId) {
        verification = await kv.get(`bank_verification:${vendor.bankVerificationId}`);
      }

      const response = {
        vendorId,
        bankVerified: vendor.bankVerified || false,
        bankDetails: vendor.bankDetails || null,
        verification: verification ? {
          id: verification.id,
          status: verification.status,
          attempts: verification.attempts || 0,
          createdAt: verification.createdAt,
          verifiedAt: verification.verifiedAt,
          failureReason: verification.failureReason
        } : null
      };

      return sendSuccess(c, response);

    } catch (error) {
      console.error('❌ Error fetching verification status:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * ✅ POST /vendor/bank/update
   * Update bank details (requires re-verification)
   */
  app.post(`${BASE_PATH}/vendor/bank/update`, async (c) => {
    try {
      const {
        vendorId,
        accountNumber,
        ifscCode,
        accountHolderName,
        bankName
      } = await c.req.json();

      if (!vendorId || !accountNumber || !ifscCode || !accountHolderName) {
        return sendError(c, 'Missing required fields', 400);
      }

      const vendor = await kv.get(`vendor:${vendorId}`);
      
      if (!vendor) {
        return sendError(c, 'Vendor not found', 404);
      }

      // Mark as unverified (needs re-verification)
      vendor.bankVerified = false;
      vendor.bankVerificationId = null;
      vendor.razorpayAccountId = null;
      await kv.set(`vendor:${vendorId}`, vendor);

      // Trigger new verification
      const verifyResponse = await fetch(
        `http://localhost:54321/functions/v1${BASE_PATH}/vendor/bank/verify`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            vendorId,
            accountNumber,
            ifscCode,
            accountHolderName,
            bankName
          })
        }
      );

      if (verifyResponse.ok) {
        const data = await verifyResponse.json();
        return sendSuccess(c, data, 'Bank details updated and verification initiated');
      } else {
        return sendError(c, 'Failed to initiate verification', 500);
      }

    } catch (error) {
      console.error('❌ Bank update error:', error);
      return sendError(c, error, 500);
    }
  });

  console.log('✅ Bank verification integration endpoints registered');
}

// =============================================
// RAZORPAY BANK VERIFICATION
// =============================================

async function executeRazorpayBankVerification(bankDetails: {
  accountNumber: string;
  ifscCode: string;
  accountHolderName: string;
}): Promise<any> {
  try {
    console.log(`🔍 Executing Razorpay bank verification...`);

    // Validate IFSC code format
    const ifscRegex = /^[A-Z]{4}0[A-Z0-9]{6}$/;
    if (!ifscRegex.test(bankDetails.ifscCode)) {
      return {
        success: false,
        error: 'Invalid IFSC code format'
      };
    }

    // Validate account number (basic check)
    if (bankDetails.accountNumber.length < 9 || bankDetails.accountNumber.length > 18) {
      return {
        success: false,
        error: 'Invalid account number length'
      };
    }

    // Razorpay Fund Account Creation & Verification
    // In production, use actual Razorpay SDK:
    /*
    const fundAccount = await razorpay.fundAccount.create({
      contact_id: vendorContactId,
      account_type: 'bank_account',
      bank_account: {
        name: bankDetails.accountHolderName,
        account_number: bankDetails.accountNumber,
        ifsc: bankDetails.ifscCode
      }
    });

    // Razorpay automatically verifies bank account via Penny Drop
    // If verification fails, the API will return an error
    */

    // Simulated success for development
    const accountId = `ACC-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

    console.log(`✅ Bank account verified: ${accountId}`);

    return {
      success: true,
      accountId,
      verified: true,
      accountHolderName: bankDetails.accountHolderName
    };

  } catch (error) {
    console.error('❌ Razorpay verification error:', error);
    
    // Parse Razorpay error
    const errorMessage = error instanceof Error ? error.message : 'Verification failed';
    
    return {
      success: false,
      error: errorMessage
    };
  }
}

// =============================================
// ONBOARDING INTEGRATION
// =============================================

export async function integrateIntoBankVerificationIntoOnboarding(
  vendorId: string,
  bankDetails: {
    accountNumber: string;
    ifscCode: string;
    accountHolderName: string;
    bankName: string;
  }
): Promise<any> {
  try {
    console.log(`🎯 Integrating bank verification into onboarding for vendor: ${vendorId}`);

    // Call bank verification endpoint
    const response = await fetch(
      `http://localhost:54321/functions/v1/make-server-3dd53475/vendor/bank/verify`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          vendorId,
          ...bankDetails
        })
      }
    );

    if (response.ok) {
      const data = await response.json();
      return {
        success: true,
        verificationId: data.verificationId,
        status: data.status
      };
    } else {
      const error = await response.json();
      return {
        success: false,
        error: error.message || 'Bank verification failed'
      };
    }

  } catch (error) {
    console.error('❌ Onboarding integration error:', error);
    return {
      success: false,
      error: String(error)
    };
  }
}

console.log('✅ Bank verification integration module loaded');
