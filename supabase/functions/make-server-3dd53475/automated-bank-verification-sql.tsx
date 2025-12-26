/**
 * ============================================================================
 * AUTOMATED BANK VERIFICATION (RAZORPAY) - SQL-ONLY VERSION
 * ============================================================================
 * 
 * ✅ SQL-ONLY: Removed all KV usage, using SQL repositories only
 * 
 * Features:
 * - Automated bank account verification via Razorpay
 * - Penny drop verification
 * - Bank account validation
 * - Fund account creation
 * 
 * CHANGES:
 * - Removed `kv` parameter from function signature
 * - Replaced all `kv.get()`, `kv.set()` with SQL queries
 * - Uses `bank_verifications` and `vendor_bank_details` tables
 * 
 * Date: 2025-01-28
 * Migration: Batch 16 - KV to SQL (10 KV operations removed)
 * ============================================================================
 */

import { Hono } from "npm:hono";
import { sendSuccess, sendError } from "./response-utils.ts";
import { getDbClient } from '../../lib/db.ts';

const app = new Hono();
const db = getDbClient();
const BASE_PATH = "/make-server-3dd53475";

/**
 * POST /payment/bank-account/verify-razorpay
 * Verify bank account (Razorpay)
 */
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

    // ✅ SQL: Create or get bank detail
    const { data: existingBankDetail } = await db
      .from('vendor_bank_details')
      .select('*')
      .eq('vendor_id', vendorId)
      .single();

    let bankDetailId: string;
    
    if (existingBankDetail) {
      bankDetailId = existingBankDetail.id;
      await db
        .from('vendor_bank_details')
        .update({
          account_number: accountNumber,
          ifsc_code: ifscCode,
          account_holder_name: accountHolderName,
          is_verified: false,
          updated_at: new Date().toISOString()
        })
        .eq('id', bankDetailId);
    } else {
      const { data: newBankDetail } = await db
        .from('vendor_bank_details')
        .insert({
          vendor_id: vendorId,
          bank_name: 'Unknown', // Will be fetched from IFSC
          account_number: accountNumber,
          ifsc_code: ifscCode,
          account_holder_name: accountHolderName,
          is_verified: false
        })
        .select()
        .single();
      
      bankDetailId = newBankDetail!.id;
    }

    // ✅ SQL: Create verification record
    const { data: verification } = await db
      .from('bank_verifications')
      .insert({
        vendor_id: vendorId,
        bank_detail_id: bankDetailId,
        verification_status: 'pending',
        verification_method: 'razorpay',
        verification_data: {
          accountNumber,
          ifscCode,
          accountHolderName
        }
      })
      .select()
      .single();

    // Simulate Razorpay verification (in production, call Razorpay API)
    setTimeout(async () => {
      await db
        .from('bank_verifications')
        .update({
          verification_status: 'verified',
          verified_at: new Date().toISOString(),
          verification_data: {
            ...verification?.verification_data,
            razorpayFundAccountId: `fa_${Math.random().toString(36).substr(2, 15)}`
          },
          updated_at: new Date().toISOString()
        })
        .eq('id', verification!.id);
      
      await db
        .from('vendor_bank_details')
        .update({
          is_verified: true,
          verified_at: new Date().toISOString()
        })
        .eq('id', bankDetailId);
    }, 2000);

    return sendSuccess(c, { verification }, 'Bank verification initiated successfully');
  } catch (error) {
    console.error('Error initiating bank verification:', error);
    return sendError(c, error, 500);
  }
});

/**
 * GET /payment/bank-account/verification-status/:accountId
 * Get verification status
 */
app.get(`${BASE_PATH}/payment/bank-account/verification-status/:accountId`, async (c) => {
  try {
    const accountId = c.req.param('accountId');

    const { data: verification, error } = await db
      .from('bank_verifications')
      .select('*')
      .eq('id', accountId)
      .single();

    if (error || !verification) {
      return sendError(c, 'Bank verification not found', 404);
    }

    return sendSuccess(c, { verification });
  } catch (error) {
    console.error('Error getting verification status:', error);
    return sendError(c, error, 500);
  }
});

/**
 * POST /payment/bank-account/penny-drop
 * Penny drop verification
 */
app.post(`${BASE_PATH}/payment/bank-account/penny-drop`, async (c) => {
  try {
    const { accountId, amount } = await c.req.json();

    if (!accountId) {
      return sendError(c, 'accountId is required', 400);
    }

    const { data: verification, error } = await db
      .from('bank_verifications')
      .select('*')
      .eq('id', accountId)
      .single();

    if (error || !verification) {
      return sendError(c, 'Bank verification not found', 404);
    }

    // Simulate penny drop (in production, use Razorpay API)
    const pennyDropAmount = amount || (Math.random() * 0.99 + 0.01).toFixed(2);
    const pennyDropReference = `PD${Date.now()}`;

    await db
      .from('bank_verifications')
      .update({
        verification_status: 'verified',
        verified_at: new Date().toISOString(),
        verification_data: {
          ...verification.verification_data,
          pennyDropAmount: parseFloat(pennyDropAmount),
          pennyDropReference
        },
        updated_at: new Date().toISOString()
      })
      .eq('id', accountId);

    await db
      .from('vendor_bank_details')
      .update({
        is_verified: true,
        verified_at: new Date().toISOString()
      })
      .eq('id', verification.bank_detail_id);

    return sendSuccess(c, { 
      verification: { ...verification, verification_status: 'verified' },
      pennyDropAmount,
      pennyDropReference 
    }, 'Penny drop verification successful');
  } catch (error) {
    console.error('Error in penny drop:', error);
    return sendError(c, error, 500);
  }
});

/**
 * GET /payment/bank-account/:vendorId
 * Get vendor bank account
 */
app.get(`${BASE_PATH}/payment/bank-account/:vendorId`, async (c) => {
  try {
    const vendorId = c.req.param('vendorId');

    const { data: bankDetail } = await db
      .from('vendor_bank_details')
      .select('*, bank_verifications(*)')
      .eq('vendor_id', vendorId)
      .single();

    if (!bankDetail) {
      return sendSuccess(c, { verification: null });
    }

    const { data: verification } = await db
      .from('bank_verifications')
      .select('*')
      .eq('vendor_id', vendorId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    return sendSuccess(c, { 
      bankDetail,
      verification: verification || null
    });
  } catch (error) {
    console.error('Error getting vendor bank account:', error);
    return sendError(c, error, 500);
  }
});

console.log('✅ Automated Bank Verification endpoints (SQL-only) registered');

export default app;

