/**
 * ============================================================================
 * BANK ACCOUNTS REPOSITORY
 * ============================================================================
 * 
 * Repository for vendor bank account data access.
 * Replaces: bank:account:{accountId} KV keys
 * 
 * RULES:
 * ❌ NO KV imports allowed
 * ✅ All operations use SQL only
 * ✅ All queries use prepared statements
 * 
 * Date: 2025-01-27
 * ============================================================================
 */

import { getDbClient, selectQuery, insertQuery, updateQuery, deleteQuery } from "../db.ts";

// ============================================================================
// TYPES
// ============================================================================

export interface BankAccount {
  id: string;
  vendor_id: string;
  account_holder_name: string;
  account_number: string;
  account_number_masked: string;
  ifsc_code: string;
  bank_name: string;
  branch_name?: string | null;
  account_type: 'savings' | 'current';
  is_primary: boolean;
  verification_status: 'pending' | 'verified' | 'failed' | 'under_review';
  verification_method?: 'penny_drop' | 'manual' | 'document' | null;
  verification_details?: any | null;
  razorpay_account_id?: string | null;
  failure_reason?: string | null;
  retry_count: number;
  last_verification_attempt?: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface BankVerification {
  id: string;
  vendor_id: string;
  bank_detail_id: string;
  verification_status: 'pending' | 'in_progress' | 'verified' | 'failed' | 'rejected';
  verification_method?: string | null;
  verification_data?: any | null;
  verified_at?: string | null;
  failure_reason?: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateBankAccountInput {
  vendor_id: string;
  account_holder_name: string;
  account_number: string;
  ifsc_code: string;
  bank_name: string;
  branch_name?: string;
  account_type?: 'savings' | 'current';
  is_primary?: boolean;
}

export interface UpdateBankAccountInput {
  account_holder_name?: string;
  ifsc_code?: string;
  bank_name?: string;
  branch_name?: string;
  account_type?: 'savings' | 'current';
  is_primary?: boolean;
  verification_status?: 'pending' | 'verified' | 'failed' | 'under_review';
  verification_method?: 'penny_drop' | 'manual' | 'document';
  verification_details?: any;
  razorpay_account_id?: string;
  failure_reason?: string;
  retry_count?: number;
  last_verification_attempt?: string;
  is_active?: boolean;
}

// ============================================================================
// REPOSITORY
// ============================================================================

export function getBankAccountsRepository() {
  return {
    /**
     * Create a new bank account
     */
    async create(input: CreateBankAccountInput): Promise<BankAccount> {
      // Mask account number (show only last 4 digits)
      const accountNumberMasked = `****${input.account_number.slice(-4)}`;

      // If this is primary, unset other primary accounts
      if (input.is_primary) {
        const db = getDbClient();
        await db
          .from('vendor_bank_details')
          .update({ is_primary: false, updated_at: new Date().toISOString() })
          .eq('vendor_id', input.vendor_id)
          .eq('is_primary', true);
      }

      const result = await insertQuery<BankAccount>(
        'vendor_bank_details',
        {
          vendor_id: input.vendor_id,
          account_holder_name: input.account_holder_name,
          account_number: input.account_number,
          account_number_masked: accountNumberMasked,
          ifsc_code: input.ifsc_code.toUpperCase(),
          bank_name: input.bank_name,
          branch_name: input.branch_name || null,
          account_type: input.account_type || 'savings',
          is_primary: input.is_primary || false,
          verification_status: 'pending',
          retry_count: 0,
          is_active: true
        }
      );

      return result[0];
    },

    /**
     * Find bank account by ID
     */
    async findById(accountId: string): Promise<BankAccount | null> {
      const result = await selectQuery<BankAccount>(
        'vendor_bank_details',
        { id: accountId },
        { limit: 1 }
      );
      return result[0] || null;
    },

    /**
     * Find all bank accounts for a vendor
     */
    async findByVendor(vendorId: string): Promise<BankAccount[]> {
      return await selectQuery<BankAccount>(
        'vendor_bank_details',
        { vendor_id: vendorId, is_active: true },
        { orderBy: 'is_primary', orderDirection: 'desc' }
      );
    },

    /**
     * Find primary bank account for a vendor
     */
    async findPrimaryByVendor(vendorId: string): Promise<BankAccount | null> {
      const result = await selectQuery<BankAccount>(
        'vendor_bank_details',
        { vendor_id: vendorId, is_primary: true, is_active: true },
        { limit: 1 }
      );
      return result[0] || null;
    },

    /**
     * Update bank account
     */
    async update(accountId: string, input: UpdateBankAccountInput): Promise<BankAccount> {
      // If setting as primary, unset other primary accounts
      if (input.is_primary) {
        const account = await this.findById(accountId);
        if (account) {
          const db = getDbClient();
          await db
            .from('vendor_bank_details')
            .update({ is_primary: false, updated_at: new Date().toISOString() })
            .eq('vendor_id', account.vendor_id)
            .neq('id', accountId)
            .eq('is_primary', true);
        }
      }

      const result = await updateQuery<BankAccount>(
        'vendor_bank_details',
        { id: accountId },
        { ...input, updated_at: new Date().toISOString() }
      );

      return result[0];
    },

    /**
     * Delete bank account (soft delete)
     */
    async delete(accountId: string): Promise<void> {
      await updateQuery(
        'vendor_bank_details',
        { id: accountId },
        { is_active: false, updated_at: new Date().toISOString() }
      );
    },

    /**
     * Create bank verification record
     */
    async createVerification(input: {
      vendor_id: string;
      bank_detail_id: string;
      verification_method?: string;
      verification_data?: any;
    }): Promise<BankVerification> {
      const result = await insertQuery<BankVerification>(
        'bank_verifications',
        {
          vendor_id: input.vendor_id,
          bank_detail_id: input.bank_detail_id,
          verification_status: 'pending',
          verification_method: input.verification_method || null,
          verification_data: input.verification_data || null
        }
      );

      return result[0];
    },

    /**
     * Update verification status
     */
    async updateVerification(
      verificationId: string,
      input: {
        verification_status: 'pending' | 'in_progress' | 'verified' | 'failed' | 'rejected';
        verification_data?: any;
        failure_reason?: string;
      }
    ): Promise<BankVerification> {
      const result = await updateQuery<BankVerification>(
        'bank_verifications',
        { id: verificationId },
        {
          ...input,
          verified_at: input.verification_status === 'verified' ? new Date().toISOString() : null,
          updated_at: new Date().toISOString()
        }
      );

      return result[0];
    },

    /**
     * Find verification by ID
     */
    async findVerificationById(verificationId: string): Promise<BankVerification | null> {
      const result = await selectQuery<BankVerification>(
        'bank_verifications',
        { id: verificationId },
        { limit: 1 }
      );
      return result[0] || null;
    },

    /**
     * Find verifications for a bank account
     */
    async findVerificationsByBankAccount(bankDetailId: string): Promise<BankVerification[]> {
      return await selectQuery<BankVerification>(
        'bank_verifications',
        { bank_detail_id: bankDetailId },
        { orderBy: 'created_at', orderDirection: 'desc' }
      );
    }
  };
}

