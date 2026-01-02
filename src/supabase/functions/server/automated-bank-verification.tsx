import { Hono } from "hono";
import { sendSuccess, sendError } from "./response-utils";

/**
 * 🏦 AUTOMATED BANK VERIFICATION (RAZORPAY)
 * 
 * Phase 7C: Payment & Settlement - Rule 15 Implementation
 * 
 * Features:
 * - Automated bank account verification via Razorpay
 * - Penny drop verification
 * - Bank account validation
 * - Fund account creation
 */

interface BankVerification {
  accountId: string;
  vendorId: string;
  accountNumber: string;
  ifscCode: string;
  accountHolderName: string;
  verificationStatus: 'pending' | 'verified' | 'failed';
  razorpayFundAccountId?: string;
  verifiedAt?: string;
  pennyDropAmount?: number;
  pennyDropReference?: string;
  failureReason?: string;
  createdAt: string;
  updatedAt: string;
}

// ✅ SQL MIGRATION: All KV operations replaced with SQL repositories
import {
  getBankAccountsRepository,
  getVendorBankAuditRepository,
  getDbClient
} from '../../../supabase/lib/repositories/index';

export function automatedBankVerificationEndpoints(app: Hono) {
  const BASE_PATH = "/make-server-3dd53475";

  // ========================================
  // VERIFY BANK ACCOUNT (RAZORPAY)
  // ========================================
  app.post(`${BASE_PATH}/payment/bank-account/verify-razorpay`, async (c) => {
    try {
      const {
        vendorId,
        accountNumber,
        ifscCode,
        accountHolderName,
      } = await c.req.json();

      if (!vendorId || !accountNumber || !ifscCode || !accountHolderName) {
        return sendError(c, 'Required fields missing', 400);
      }

      const accountId = `bank_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // In production, this would call Razorpay API
      // For now, we'll simulate the verification
      const verification: BankVerification = {
        accountId,
        vendorId,
        accountNumber,
        ifscCode,
        accountHolderName,
        verificationStatus: 'pending',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // ✅ SQL: Store bank verification in vendor_bank_details table
      const bankAccountsRepo = getBankAccountsRepository();
      await bankAccountsRepo.create({
        vendor_id: vendorId,
        account_holder_name: accountHolderName,
        account_number: accountNumber,
        ifsc_code: ifscCode,
        account_type: 'savings',
        is_primary: false,
        verification_status: 'pending'
      });

      // Simulate Razorpay verification (in production, call Razorpay API)
      setTimeout(async () => {
        // ✅ SQL: Update verification status in vendor_bank_details table
        const bankAccountsRepo = getBankAccountsRepository();
        const accounts = await bankAccountsRepo.findByVendor(vendorId);
        const account = accounts.find(acc => acc.account_number === accountNumber);
        if (account) {
          await bankAccountsRepo.update(account.id, {
            verification_status: 'verified',
            razorpay_account_id: `fa_${Math.random().toString(36).substr(2, 15)}`
          });
        }
      }, 2000);

      console.log(`✅ Bank verification initiated: ${accountId}`);

      return sendSuccess(c, { verification }, 'Bank verification initiated successfully');
    } catch (error) {
      console.error('Error initiating bank verification:', error);
      return sendError(c, error, 500);
    }
  });

  // ========================================
  // GET VERIFICATION STATUS
  // ========================================
  app.get(`${BASE_PATH}/payment/bank-account/verification-status/:accountId`, async (c) => {
    try {
      const accountId = c.req.param('accountId');

      // ✅ SQL: Get verification status from vendor_bank_details table
      const bankAccountsRepo = getBankAccountsRepository();
      const account = await bankAccountsRepo.findById(accountId);

      if (!account) {
        return sendError(c, 'Bank verification not found', 404);
      }

      const verification = {
        accountId: account.id,
        vendorId: account.vendor_id,
        accountNumber: account.account_number_masked,
        ifscCode: account.ifsc_code,
        accountHolderName: account.account_holder_name,
        verificationStatus: account.verification_status,
        razorpayFundAccountId: account.razorpay_account_id,
        verifiedAt: account.last_verification_attempt,
        createdAt: account.created_at,
        updatedAt: account.updated_at
      };

      return sendSuccess(c, { verification });
    } catch (error) {
      console.error('Error getting verification status:', error);
      return sendError(c, error, 500);
    }
  });

  // ========================================
  // PENNY DROP VERIFICATION
  // ========================================
  app.post(`${BASE_PATH}/payment/bank-account/penny-drop`, async (c) => {
    try {
      const {
        accountId,
        amount,
      } = await c.req.json();

      if (!accountId) {
        return sendError(c, 'accountId is required', 400);
      }

      // ✅ SQL: Get verification from vendor_bank_details table
      const bankAccountsRepo = getBankAccountsRepository();
      const account = await bankAccountsRepo.findById(accountId);

      if (!account) {
        return sendError(c, 'Bank verification not found', 404);
      }

      // Simulate penny drop (in production, use Razorpay API)
      const pennyDropAmount = amount || (Math.random() * 0.99 + 0.01).toFixed(2);
      const pennyDropReference = `PD${Date.now()}`;

      // ✅ SQL: Update verification status
      await bankAccountsRepo.update(accountId, {
        verification_status: 'verified',
        verification_method: 'penny_drop',
        verification_details: {
          pennyDropAmount: parseFloat(pennyDropAmount),
          pennyDropReference
        }
      });

      const verification = {
        accountId: account.id,
        vendorId: account.vendor_id,
        accountNumber: account.account_number_masked,
        ifscCode: account.ifsc_code,
        accountHolderName: account.account_holder_name,
        verificationStatus: 'verified',
        pennyDropAmount: parseFloat(pennyDropAmount),
        pennyDropReference,
        verifiedAt: new Date().toISOString(),
        createdAt: account.created_at,
        updatedAt: new Date().toISOString()
      };

      console.log(`✅ Penny drop completed: ${accountId} - ₹${pennyDropAmount}`);

      return sendSuccess(c, { verification, pennyDropAmount, pennyDropReference }, 'Penny drop verification successful');
    } catch (error) {
      console.error('Error in penny drop:', error);
      return sendError(c, error, 500);
    }
  });

  // ========================================
  // GET VENDOR BANK ACCOUNT
  // ========================================
  app.get(`${BASE_PATH}/payment/bank-account/:vendorId`, async (c) => {
    try {
      const vendorId = c.req.param('vendorId');

      // ✅ SQL: Get vendor's primary bank account from vendor_bank_details table
      const bankAccountsRepo = getBankAccountsRepository();
      const account = await bankAccountsRepo.findPrimaryByVendor(vendorId);

      if (!account) {
        return sendSuccess(c, { verification: null });
      }

      const verification = {
        accountId: account.id,
        vendorId: account.vendor_id,
        accountNumber: account.account_number_masked,
        ifscCode: account.ifsc_code,
        accountHolderName: account.account_holder_name,
        verificationStatus: account.verification_status,
        razorpayFundAccountId: account.razorpay_account_id,
        verifiedAt: account.last_verification_attempt,
        createdAt: account.created_at,
        updatedAt: account.updated_at
      };

      return sendSuccess(c, { verification });
    } catch (error) {
      console.error('Error getting vendor bank account:', error);
      return sendError(c, error, 500);
    }
  });

  // ========================================
  // UPDATE BANK ACCOUNT
  // ========================================
  app.put(`${BASE_PATH}/payment/bank-account/:accountId/update`, async (c) => {
    try {
      const accountId = c.req.param('accountId');
      const updates = await c.req.json();

      // ✅ SQL: Get verification from vendor_bank_details table
      const bankAccountsRepo = getBankAccountsRepository();
      const account = await bankAccountsRepo.findById(accountId);

      if (!account) {
        return sendError(c, 'Bank verification not found', 404);
      }

      // Build update data
      const updateData: any = {
        updated_at: new Date().toISOString()
      };

      if (updates.accountNumber) updateData.account_number = updates.accountNumber;
      if (updates.ifscCode) updateData.ifsc_code = updates.ifscCode;
      if (updates.accountHolderName) updateData.account_holder_name = updates.accountHolderName;

      // If account details changed, reset verification
      if (updates.accountNumber || updates.ifscCode) {
        updateData.verification_status = 'pending';
        updateData.razorpay_account_id = null;
        updateData.last_verification_attempt = null;
      }

      await bankAccountsRepo.update(accountId, updateData);

      // Get updated account
      const updatedAccount = await bankAccountsRepo.findById(accountId);
      const verification = {
        accountId: updatedAccount!.id,
        vendorId: updatedAccount!.vendor_id,
        accountNumber: updatedAccount!.account_number_masked,
        ifscCode: updatedAccount!.ifsc_code,
        accountHolderName: updatedAccount!.account_holder_name,
        verificationStatus: updatedAccount!.verification_status,
        razorpayFundAccountId: updatedAccount!.razorpay_account_id,
        verifiedAt: updatedAccount!.last_verification_attempt,
        createdAt: updatedAccount!.created_at,
        updatedAt: updatedAccount!.updated_at
      };

      console.log(`✅ Bank account updated: ${accountId}`);

      return sendSuccess(c, { verification }, 'Bank account updated successfully');
    } catch (error) {
      console.error('Error updating bank account:', error);
      return sendError(c, error, 500);
    }
  });

  console.log('✅ Automated Bank Verification endpoints registered');
}
