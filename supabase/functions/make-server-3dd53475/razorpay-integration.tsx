/**
 * Razorpay Integration for Warmpawz
 * Handles payment processing and vendor payouts via Razorpay
 * 
 * ✅ UPDATED: Uses centralized credentials helper from platform settings
 */

import { Hono } from 'npm:hono';
import * as kv from './kv_store.tsx';
import { getRazorpayCredentials, getRazorpayApiBase, getRazorpayAuthHeader } from './razorpay-credentials-helper.tsx';

const RAZORPAY_API_BASE = 'https://api.razorpay.com/v1';

/**
 * Create Razorpay Order
 */
export async function createRazorpayOrder(amount: number, bookingId?: string, orderId?: string) {
  try {
    // ✅ Get credentials from platform settings
    const authHeader = await getRazorpayAuthHeader();
    
    const response = await fetch(`${RAZORPAY_API_BASE}/orders`, {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount: amount * 100, // Convert to paise
        currency: 'INR',
        receipt: bookingId || orderId || `receipt_${Date.now()}`,
        notes: {
          bookingId: bookingId || '',
          orderId: orderId || '',
          platform: 'warmpawz'
        }
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Razorpay order creation failed: ${JSON.stringify(error)}`);
    }

    const order = await response.json();
    console.log('✅ Razorpay order created:', order.id);
    return order;
  } catch (error) {
    console.error('❌ Razorpay order creation error:', error);
    throw error;
  }
}

/**
 * Verify Razorpay Payment Signature
 */
export async function verifyRazorpaySignature(
  orderId: string, 
  paymentId: string, 
  signature: string
): Promise<boolean> {
  try {
    // ✅ Get credentials from platform settings
    const credentials = await getRazorpayCredentials();
    if (!credentials.keySecret) {
      throw new Error('Razorpay key secret not configured');
    }
    
    // Create signature string
    const signatureString = `${orderId}|${paymentId}`;
    
    // Generate HMAC SHA256
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(credentials.keySecret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    
    const signatureBuffer = await crypto.subtle.sign(
      'HMAC',
      key,
      encoder.encode(signatureString)
    );
    
    // Convert to hex
    const expectedSignature = Array.from(new Uint8Array(signatureBuffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
    
    const isValid = expectedSignature === signature;
    console.log(isValid ? '✅ Signature verified' : '❌ Signature verification failed');
    return isValid;
  } catch (error) {
    console.error('❌ Signature verification error:', error);
    return false;
  }
}

/**
 * Fetch Payment Details from Razorpay
 */
export async function fetchRazorpayPayment(paymentId: string) {
  try {
    // ✅ Get credentials from platform settings
    const authHeader = await getRazorpayAuthHeader();
    
    const response = await fetch(`${RAZORPAY_API_BASE}/payments/${paymentId}`, {
      headers: {
        'Authorization': authHeader,
      }
    });

    if (!response.ok) {
      throw new Error('Payment fetch failed');
    }

    return await response.json();
  } catch (error) {
    console.error('❌ Fetch payment error:', error);
    throw error;
  }
}

/**
 * Create Razorpay Transfer (for vendor payouts)
 * Uses Razorpay Route for splitting payments
 */
export async function createRazorpayTransfer(
  vendorAccountId: string,
  amount: number,
  paymentId: string,
  notes: any = {}
) {
  try {
    // ✅ Get credentials from platform settings
    const authHeader = await getRazorpayAuthHeader();
    
    const response = await fetch(`${RAZORPAY_API_BASE}/payments/${paymentId}/transfers`, {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        transfers: [
          {
            account: vendorAccountId,
            amount: amount * 100, // Convert to paise
            currency: 'INR',
            notes: notes,
            linked_account_notes: [notes]
          }
        ]
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Transfer creation failed: ${JSON.stringify(error)}`);
    }

    const transfer = await response.json();
    console.log('✅ Razorpay transfer created:', transfer);
    return transfer;
  } catch (error) {
    console.error('❌ Transfer creation error:', error);
    throw error;
  }
}

/**
 * Process Refund via Razorpay
 */
export async function createRazorpayRefund(paymentId: string, amount: number, notes: any = {}) {
  try {
    // ✅ Get credentials from platform settings
    const authHeader = await getRazorpayAuthHeader();
    
    const response = await fetch(`${RAZORPAY_API_BASE}/payments/${paymentId}/refund`, {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount: amount * 100, // Convert to paise
        notes: notes
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Refund creation failed: ${JSON.stringify(error)}`);
    }

    const refund = await response.json();
    console.log('✅ Razorpay refund created:', refund.id);
    return refund;
  } catch (error) {
    console.error('❌ Refund creation error:', error);
    throw error;
  }
}

/**
 * Create Linked Account for Vendor (Razorpay Route)
 */
export async function createLinkedAccount(vendor: any) {
  try {
    // ✅ Get credentials from platform settings
    const authHeader = await getRazorpayAuthHeader();
    
    const response = await fetch(`${RAZORPAY_API_BASE}/accounts`, {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: vendor.email,
        phone: vendor.phone,
        type: 'route',
        legal_business_name: vendor.businessName,
        business_type: 'individual', // or 'partnership', 'llp', 'private_limited', etc.
        contact_name: vendor.fullName || vendor.ownerName,
        profile: {
          category: 'healthcare',
          subcategory: 'clinic',
          addresses: {
            registered: {
              street1: vendor.address?.street,
              street2: vendor.address?.landmark,
              city: vendor.address?.city,
              state: vendor.address?.state,
              postal_code: vendor.address?.pincode,
              country: 'IN'
            }
          }
        },
        legal_info: {
          pan: vendor.documents?.find((d: any) => d.type === 'pan')?.number || '',
          gst: vendor.gstNumber || ''
        },
        notes: {
          vendorId: vendor.id,
          roleId: vendor.roleId,
          platform: 'warmpawz'
        }
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Linked account creation failed: ${JSON.stringify(error)}`);
    }

    const account = await response.json();
    console.log('✅ Razorpay linked account created:', account.id);
    return account;
  } catch (error) {
    console.error('❌ Linked account creation error:', error);
    throw error;
  }
}

/**
 * Razorpay Endpoints for Hono
 */
export function razorpayEndpoints(app: Hono) {
  
  /**
   * GET /razorpay/config
   * Get Razorpay configuration for frontend
   */
  app.get('/make-server-3dd53475/razorpay/config', async (c) => {
    try {
      // ✅ Get credentials from platform settings
      const credentials = await getRazorpayCredentials();
      
      return c.json({
        success: true,
        key: credentials.keyId,
        enabled: credentials.enabled && !!credentials.keyId && !!credentials.keySecret
      });
    } catch (error: any) {
      console.error('Error fetching Razorpay config:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * POST /razorpay/webhook
   * Handle Razorpay webhooks
   */
  app.post('/make-server-3dd53475/razorpay/webhook', async (c) => {
    try {
      const body = await c.req.json();
      const signature = c.req.header('X-Razorpay-Signature') || '';
      
      // Verify webhook signature
      // TODO: Implement webhook signature verification
      
      console.log('📨 Razorpay webhook received:', body.event);
      
      // Handle different events
      switch (body.event) {
        case 'payment.captured':
          // Payment successful
          console.log('✅ Payment captured:', body.payload.payment.entity.id);
          break;
          
        case 'payment.failed':
          // Payment failed
          console.log('❌ Payment failed:', body.payload.payment.entity.id);
          break;
          
        case 'refund.created':
          // Refund created
          console.log('💰 Refund created:', body.payload.refund.entity.id);
          break;
          
        case 'transfer.processed':
          // Transfer processed
          console.log('💸 Transfer processed:', body.payload.transfer.entity.id);
          break;
      }
      
      return c.json({ success: true });
    } catch (error: any) {
      console.error('Error handling webhook:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  console.log('✅ Razorpay endpoints registered');
}
