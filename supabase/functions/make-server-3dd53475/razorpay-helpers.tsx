/**
 * ============================================================================
 * RAZORPAY HELPER FUNCTIONS
 * ============================================================================
 * 
 * SQL-only Razorpay integration helpers
 * 
 * Date: 2025-01-27
 * ============================================================================
 */

import { getRazorpayCredentials } from './razorpay-credentials-helper.tsx';

export interface RazorpayOrderInput {
  amount: number; // in paise
  currency?: string;
  receipt?: string;
  notes?: Record<string, string>;
}

export interface RazorpayOrderResponse {
  id: string;
  entity: string;
  amount: number;
  amount_paid: number;
  amount_due: number;
  currency: string;
  receipt: string;
  status: string;
  attempts: number;
  notes: Record<string, string>;
  created_at: number;
}

export interface RazorpayPaymentVerificationInput {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

/**
 * Create Razorpay order
 */
export async function createRazorpayOrder(input: RazorpayOrderInput): Promise<RazorpayOrderResponse> {
  const credentials = await getRazorpayCredentials();
  
  if (!credentials.enabled || !credentials.keyId || !credentials.keySecret) {
    throw new Error('Razorpay not configured');
  }
  
  const orderData = {
    amount: input.amount,
    currency: input.currency || 'INR',
    receipt: input.receipt || `rcpt_${Date.now()}`,
    notes: input.notes || {}
  };
  
  const response = await fetch('https://api.razorpay.com/v1/orders', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Basic ' + btoa(`${credentials.keyId}:${credentials.keySecret}`)
    },
    body: JSON.stringify(orderData)
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Razorpay API error: ${error.error?.description || 'Unknown error'}`);
  }
  
  return await response.json();
}

/**
 * Verify Razorpay payment signature
 */
export async function verifyRazorpayPayment(input: RazorpayPaymentVerificationInput): Promise<boolean> {
  const credentials = await getRazorpayCredentials();
  
  if (!credentials.enabled || !credentials.keySecret) {
    throw new Error('Razorpay not configured');
  }
  
  // Import crypto for HMAC verification
  const crypto = await import('npm:crypto');
  const hmac = crypto.createHmac('sha256', credentials.keySecret);
  hmac.update(`${input.razorpay_order_id}|${input.razorpay_payment_id}`);
  const generatedSignature = hmac.digest('hex');
  
  return generatedSignature === input.razorpay_signature;
}

