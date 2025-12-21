/**
 * RAZORPAY MARKETPLACE PAYOUT API
 * 
 * Handles automatic payouts to vendors using Razorpay Marketplace API
 */

const RAZORPAY_KEY_ID = Deno.env.get('RAZORPAY_KEY_ID') || '';
const RAZORPAY_KEY_SECRET = Deno.env.get('RAZORPAY_KEY_SECRET') || '';
const RAZORPAY_AUTH = btoa(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`);
const RAZORPAY_API_BASE = 'https://api.razorpay.com/v1';

/**
 * Create payout to vendor's linked account
 */
export async function createRazorpayPayout(params: {
  accountId: string;
  amount: number;
  currency?: string;
  notes?: any;
}): Promise<any> {
  try {
    const response = await fetch(`${RAZORPAY_API_BASE}/payouts`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${RAZORPAY_AUTH}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        account_number: params.accountId,
        fund_account: {
          account_type: 'bank_account',
          bank_account: {
            name: params.notes?.accountHolderName || '',
            ifsc: params.notes?.ifsc || '',
            account_number: params.notes?.accountNumber || ''
          }
        },
        amount: params.amount * 100, // Convert to paise
        currency: params.currency || 'INR',
        mode: 'NEFT', // or 'IMPS', 'RTGS'
        purpose: 'payout',
        queue_if_low_balance: true,
        reference_id: `payout_${Date.now()}`,
        notes: params.notes || {}
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Razorpay payout failed: ${JSON.stringify(error)}`);
    }

    const payout = await response.json();
    console.log('✅ Razorpay payout created:', payout.id);
    return payout;
  } catch (error) {
    console.error('❌ Razorpay payout error:', error);
    throw error;
  }
}

/**
 * Verify bank account using Razorpay Fund Account API
 */
export async function verifyRazorpayBankAccount(params: {
  name: string;
  ifsc: string;
  accountNumber: string;
}): Promise<any> {
  try {
    // First, create a fund account
    const fundAccountResponse = await fetch(`${RAZORPAY_API_BASE}/fund_accounts`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${RAZORPAY_AUTH}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        account_type: 'bank_account',
        bank_account: {
          name: params.name,
          ifsc: params.ifsc,
          account_number: params.accountNumber
        },
        contact: {
          name: params.name,
          email: '', // Will be updated later
          contact: '', // Will be updated later
          type: 'vendor'
        }
      })
    });

    if (!fundAccountResponse.ok) {
      const error = await fundAccountResponse.json();
      throw new Error(`Fund account creation failed: ${JSON.stringify(error)}`);
    }

    const fundAccount = await fundAccountResponse.json();

    // Verify the fund account (penny drop)
    const verifyResponse = await fetch(`${RAZORPAY_API_BASE}/fund_accounts/${fundAccount.id}/verification`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${RAZORPAY_AUTH}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount: 1, // 1 paise for verification
        currency: 'INR'
      })
    });

    if (!verifyResponse.ok) {
      const error = await verifyResponse.json();
      throw new Error(`Bank verification failed: ${JSON.stringify(error)}`);
    }

    const verification = await verifyResponse.json();

    return {
      success: true,
      fundAccountId: fundAccount.id,
      verified: verification.status === 'verified',
      beneficiaryName: verification.beneficiary_name || params.name
    };
  } catch (error) {
    console.error('❌ Bank verification error:', error);
    throw error;
  }
}

/**
 * Get payout status
 */
export async function getRazorpayPayoutStatus(payoutId: string): Promise<any> {
  try {
    const response = await fetch(`${RAZORPAY_API_BASE}/payouts/${payoutId}`, {
      headers: {
        'Authorization': `Basic ${RAZORPAY_AUTH}`,
      }
    });

    if (!response.ok) {
      throw new Error('Payout fetch failed');
    }

    return await response.json();
  } catch (error) {
    console.error('❌ Get payout status error:', error);
    throw error;
  }
}

