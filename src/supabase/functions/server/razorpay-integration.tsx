/**
 * Razorpay Integration for Warmpawz
 * Handles payment processing and vendor payouts via Razorpay
 */

import { Hono } from 'npm:hono';
import * as kv from './kv_store.tsx';
import { createHmac } from 'node:crypto';

// Razorpay credentials from environment
const RAZORPAY_KEY_ID = Deno.env.get('RAZORPAY_KEY_ID') || '';
const RAZORPAY_KEY_SECRET = Deno.env.get('RAZORPAY_KEY_SECRET') || '';
const RAZORPAY_WEBHOOK_SECRET = Deno.env.get('RAZORPAY_WEBHOOK_SECRET') || '';

// Base64 encode credentials for API auth
const RAZORPAY_AUTH = btoa(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`);
const RAZORPAY_API_BASE = 'https://api.razorpay.com/v1';

/**
 * Create Razorpay Order
 */
export async function createRazorpayOrder(amount: number, bookingId?: string, orderId?: string) {
  try {
    const response = await fetch(`${RAZORPAY_API_BASE}/orders`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${RAZORPAY_AUTH}`,
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
    // Create signature string
    const signatureString = `${orderId}|${paymentId}`;
    
    // Generate HMAC SHA256
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(RAZORPAY_KEY_SECRET),
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
    const response = await fetch(`${RAZORPAY_API_BASE}/payments/${paymentId}`, {
      headers: {
        'Authorization': `Basic ${RAZORPAY_AUTH}`,
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
    const response = await fetch(`${RAZORPAY_API_BASE}/payments/${paymentId}/transfers`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${RAZORPAY_AUTH}`,
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
    const response = await fetch(`${RAZORPAY_API_BASE}/payments/${paymentId}/refund`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${RAZORPAY_AUTH}`,
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
    const response = await fetch(`${RAZORPAY_API_BASE}/accounts`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${RAZORPAY_AUTH}`,
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
      return c.json({
        success: true,
        key: RAZORPAY_KEY_ID,
        enabled: !!RAZORPAY_KEY_ID && !!RAZORPAY_KEY_SECRET
      });
    } catch (error: any) {
      console.error('Error fetching Razorpay config:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * POST /razorpay/webhook
   * Handle Razorpay webhooks with signature verification
   */
  app.post('/make-server-3dd53475/razorpay/webhook', async (c) => {
    try {
      const rawBody = await c.req.text();
      const signature = c.req.header('X-Razorpay-Signature') || '';
      const body = JSON.parse(rawBody);
      
      console.log('📨 Razorpay webhook received:', body.event);
      
      // ✅ CRITICAL FIX: Verify webhook signature
      try {
        // Get webhook secret from environment variable
        const webhookSecret = RAZORPAY_WEBHOOK_SECRET || Deno.env.get('RAZORPAY_WEBHOOK_SECRET') || '';
        
        if (!webhookSecret) {
          console.error('❌ RAZORPAY_WEBHOOK_SECRET not configured');
          // In production, reject if webhook secret is missing
          if (Deno.env.get('ENV') === 'production') {
            return c.json({ error: 'Webhook secret not configured' }, 500);
          }
          // In development, log warning but continue (for testing without webhook secret)
          console.warn('⚠️ Webhook signature verification skipped: RAZORPAY_WEBHOOK_SECRET not set');
        } else {
          // Use static import (consistent with other files in codebase)
          const expectedSignature = createHmac('sha256', webhookSecret)
            .update(rawBody)
            .digest('hex');
          
          if (signature !== expectedSignature) {
            console.error('❌ Invalid webhook signature');
            console.error('Expected:', expectedSignature.substring(0, 20) + '...');
            console.error('Received:', signature.substring(0, 20) + '...');
            return c.json({ error: 'Invalid signature' }, 401);
          }
          
          console.log('✅ Webhook signature verified');
        }
      } catch (sigError) {
        console.error('❌ Signature verification error:', sigError);
        // In production, reject invalid signatures
        // For development, log but continue
        if (Deno.env.get('ENV') === 'production') {
          return c.json({ error: 'Invalid signature' }, 401);
        }
      }
      
      // Handle different events with state updates
      
      switch (body.event) {
        case 'payment.captured': {
          // Payment successful - update payment and booking status
          const paymentEntity = body.payload.payment.entity;
          const razorpayPaymentId = paymentEntity.id;
          
          console.log('✅ Payment captured:', razorpayPaymentId);
          
          // Find payment by razorpayPaymentId or orderId
          const orderId = paymentEntity.order_id;
          let payment = null;
          
          // ✅ FIX: Cache payment lookup - only fetch once
          // Fetch all payments once and reuse for both order ID and payment ID lookups
          if (orderId || razorpayPaymentId) {
            const allPayments = await kv.getByPrefix('payment:');
            
            // Try to find by order ID first (more reliable)
            if (orderId) {
              payment = allPayments.find((p: any) => 
                p.razorpayOrderId === orderId
              );
            }
            
            // Fallback: find by payment ID
            if (!payment && razorpayPaymentId) {
              payment = allPayments.find((p: any) => 
                p.razorpayPaymentId === razorpayPaymentId
              );
            }
          }
          
          if (payment) {
            payment.status = 'completed';
            payment.completedAt = new Date().toISOString();
            payment.razorpayPaymentId = razorpayPaymentId;
            await kv.set(`payment:${payment.id}`, payment);
            
            // Update booking status
            if (payment.bookingId) {
              const booking = await kv.get(`booking:${payment.bookingId}`);
              if (booking) {
                booking.paymentStatus = 'paid';
                booking.razorpayPaymentId = razorpayPaymentId; // ✅ FIX: Store for settlements
                booking.status = booking.status === 'pending' ? 'confirmed' : booking.status;
                booking.paidAt = new Date().toISOString();
                await kv.set(`booking:${payment.bookingId}`, booking);
                console.log(`✅ Updated booking ${payment.bookingId} to confirmed`);
              }
            }
            
            // ✅ FIX: Update order status if payment is for an order
            if (payment.orderId) {
              const order = await kv.get(`order:${payment.orderId}`);
              if (order) {
                order.paymentStatus = 'paid';
                order.razorpayPaymentId = razorpayPaymentId; // ✅ FIX: Store for settlements
                order.paidAt = new Date().toISOString();
                await kv.set(`order:${payment.orderId}`, order);
                console.log(`✅ Updated order ${payment.orderId} payment status`);
              }
            }
          }
          break;
        }
          
        case 'payment.failed': {
          // Payment failed - update payment and booking status
          const paymentEntity = body.payload.payment.entity;
          const razorpayPaymentId = paymentEntity.id;
          
          console.log('❌ Payment failed:', razorpayPaymentId);
          
          const orderId = paymentEntity.order_id;
          let payment = null;
          
          // ✅ FIX: Cache payment lookup - only fetch once
          if (orderId || razorpayPaymentId) {
            const allPayments = await kv.getByPrefix('payment:');
            
            if (orderId) {
              payment = allPayments.find((p: any) => 
                p.razorpayOrderId === orderId
              );
            }
            
            if (!payment && razorpayPaymentId) {
              payment = allPayments.find((p: any) => 
                p.razorpayPaymentId === razorpayPaymentId
              );
            }
          }
          
          if (payment) {
            payment.status = 'failed';
            payment.failedAt = new Date().toISOString();
            payment.failureReason = paymentEntity.error_description || 'Payment failed';
            await kv.set(`payment:${payment.id}`, payment);
            
            // Update booking status
            if (payment.bookingId) {
              const booking = await kv.get(`booking:${payment.bookingId}`);
              if (booking && booking.status === 'pending') {
                booking.paymentStatus = 'failed';
                booking.status = 'cancelled';
                booking.cancelledAt = new Date().toISOString();
                booking.cancellationReason = 'Payment failed';
                await kv.set(`booking:${payment.bookingId}`, booking);
                console.log(`✅ Updated booking ${payment.bookingId} to cancelled`);
              }
            }
          }
          break;
        }
          
        case 'refund.created': {
          // Refund created - update payment and booking
          const refundEntity = body.payload.refund.entity;
          const razorpayPaymentId = refundEntity.payment_id;
          
          console.log('💰 Refund created:', refundEntity.id);
          
          const allPayments = await kv.getByPrefix('payment:');
          const payment = allPayments.find((p: any) => 
            p.razorpayPaymentId === razorpayPaymentId
          );
          
          if (payment) {
            payment.refundStatus = 'processing';
            payment.refundAmount = refundEntity.amount / 100; // Convert from paise
            payment.refundId = refundEntity.id;
            await kv.set(`payment:${payment.id}`, payment);
            
            // Update booking if fully refunded
            if (payment.bookingId && refundEntity.amount === payment.amount * 100) {
              const booking = await kv.get(`booking:${payment.bookingId}`);
              if (booking) {
                booking.refundStatus = 'processing';
                booking.refundAmount = payment.refundAmount;
                await kv.set(`booking:${payment.bookingId}`, booking);
              }
            }
          }
          break;
        }
          
        case 'refund.processed': {
          // Refund processed - update payment and booking
          const refundEntity = body.payload.refund.entity;
          const razorpayPaymentId = refundEntity.payment_id;
          
          console.log('✅ Refund processed:', refundEntity.id);
          
          const allPayments = await kv.getByPrefix('payment:');
          const payment = allPayments.find((p: any) => 
            p.razorpayPaymentId === razorpayPaymentId
          );
          
          if (payment) {
            payment.refundStatus = 'completed';
            payment.refundCompletedAt = new Date().toISOString();
            await kv.set(`payment:${payment.id}`, payment);
            
            // Update booking
            if (payment.bookingId) {
              const booking = await kv.get(`booking:${payment.bookingId}`);
              if (booking) {
                booking.refundStatus = 'completed';
                booking.refundCompletedAt = new Date().toISOString();
                await kv.set(`booking:${payment.bookingId}`, booking);
              }
            }
          }
          break;
        }
          
        case 'transfer.processed': {
          // Transfer processed - marketplace settlement completed
          const transferEntity = body.payload.transfer.entity;
          
          console.log('💸 Transfer processed:', transferEntity.id);
          
          // Update vendor payout status
          const vendorId = transferEntity.notes?.vendorId;
          if (vendorId) {
            const vendor = await kv.get(`vendor:${vendorId}`);
            if (vendor) {
              vendor.lastPayoutDate = new Date().toISOString();
              vendor.totalPayouts = (vendor.totalPayouts || 0) + (transferEntity.amount / 100);
              await kv.set(`vendor:${vendorId}`, vendor);
              console.log(`✅ Updated vendor ${vendorId} payout status`);
            }
          }
          break;
        }
      }
      
      return c.json({ success: true });
    } catch (error: any) {
      console.error('Error handling webhook:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  console.log('✅ Razorpay endpoints registered');
}
