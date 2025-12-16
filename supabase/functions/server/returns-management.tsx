/**
 * Returns Management for Warmpawz
 * Handles return requests, logistics, and refunds
 */

import { Hono } from 'npm:hono';
import * as kv from './kv_store.tsx';
import { createReturnOrder as createShiprocketReturn } from './shiprocket-integration.tsx';

export interface ReturnPolicy {
  productId?: string;
  categoryId?: string;
  vendorId?: string;
  global?: boolean;
  returnWindow: number; // Days
  conditions: {
    allowDefectiveReturns: boolean;
    allowChangeOfMind: boolean;
    allowWrongItem: boolean;
    allowDamagedInTransit: boolean;
  };
  returnShippingPaidBy: 'customer' | 'vendor' | 'platform';
  refundMethod: 'original_payment' | 'wallet' | 'store_credit';
  restockingFee?: number; // Percentage
  qualityCheckRequired: boolean;
}

export interface ReturnRequest {
  id: string;
  orderId: string;
  customerId: string;
  vendorId: string;
  items: Array<{
    productId: string;
    productName: string;
    quantity: number;
    price: number;
    reason: string;
  }>;
  returnReason: 'defective' | 'change_of_mind' | 'wrong_item' | 'damaged' | 'other';
  description: string;
  images?: string[];
  status: 'pending' | 'approved' | 'rejected' | 'picked_up' | 'received' | 'refunded' | 'cancelled';
  pickupAddress: {
    name: string;
    phone: string;
    street: string;
    city: string;
    state: string;
    pincode: string;
  };
  logistics?: {
    partner: string;
    awb?: string;
    trackingUrl?: string;
  };
  refund?: {
    amount: number;
    method: string;
    status: string;
    transactionId?: string;
  };
  createdAt: string;
  updatedAt: string;
  approvedAt?: string;
  completedAt?: string;
}

/**
 * Check if return is eligible based on policies
 */
async function checkReturnEligibility(
  orderId: string,
  productId: string,
  reason: string
): Promise<{ eligible: boolean; policy?: ReturnPolicy; message?: string }> {
  try {
    // Get order details
    const order = await kv.get(`order:${orderId}`);
    if (!order) {
      return { eligible: false, message: 'Order not found' };
    }

    // Check if order is delivered
    if (order.status !== 'delivered') {
      return { eligible: false, message: 'Order not yet delivered' };
    }

    // Get applicable return policy
    const policies: ReturnPolicy[] = await kv.get('admin:settings:return_policies') || [];
    
    // Find specific policy
    let policy = policies.find(p => p.productId === productId);
    if (!policy) {
      policy = policies.find(p => p.categoryId === order.categoryId);
    }
    if (!policy) {
      policy = policies.find(p => p.vendorId === order.vendorId);
    }
    if (!policy) {
      policy = policies.find(p => p.global === true);
    }

    if (!policy) {
      return { eligible: false, message: 'No return policy found for this product' };
    }

    // Check return window
    const deliveryDate = new Date(order.deliveredAt);
    const daysSinceDelivery = Math.floor(
      (Date.now() - deliveryDate.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (daysSinceDelivery > policy.returnWindow) {
      return { 
        eligible: false, 
        message: `Return window expired. Returns allowed within ${policy.returnWindow} days of delivery.` 
      };
    }

    // Check if reason is allowed
    const reasonAllowed = 
      (reason === 'defective' && policy.conditions.allowDefectiveReturns) ||
      (reason === 'change_of_mind' && policy.conditions.allowChangeOfMind) ||
      (reason === 'wrong_item' && policy.conditions.allowWrongItem) ||
      (reason === 'damaged' && policy.conditions.allowDamagedInTransit);

    if (!reasonAllowed) {
      return { eligible: false, message: 'Return reason not allowed for this product' };
    }

    return { eligible: true, policy };
  } catch (error) {
    console.error('Error checking return eligibility:', error);
    return { eligible: false, message: 'Error checking eligibility' };
  }
}

/**
 * Create return request
 */
async function createReturnRequest(data: Partial<ReturnRequest>): Promise<ReturnRequest> {
  try {
    const returnId = `RET_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const returnRequest: ReturnRequest = {
      id: returnId,
      orderId: data.orderId!,
      customerId: data.customerId!,
      vendorId: data.vendorId!,
      items: data.items!,
      returnReason: data.returnReason!,
      description: data.description!,
      images: data.images || [],
      status: 'pending',
      pickupAddress: data.pickupAddress!,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    // Save return request
    await kv.set(`return:${returnId}`, returnRequest);
    
    // Add to customer's returns list
    const customerReturns = await kv.get(`customer:${data.customerId}:returns`) || [];
    customerReturns.push(returnId);
    await kv.set(`customer:${data.customerId}:returns`, customerReturns);

    // Add to vendor's returns list
    const vendorReturns = await kv.get(`vendor:${data.vendorId}:returns`) || [];
    vendorReturns.push(returnId);
    await kv.set(`vendor:${data.vendorId}:returns`, vendorReturns);

    console.log(`✅ Return request created: ${returnId}`);
    return returnRequest;
  } catch (error) {
    console.error('Error creating return request:', error);
    throw error;
  }
}

/**
 * Approve return and schedule pickup
 */
async function approveReturn(returnId: string, logisticsPartner: string): Promise<any> {
  try {
    const returnRequest: ReturnRequest = await kv.get(`return:${returnId}`);
    if (!returnRequest) {
      throw new Error('Return request not found');
    }

    // Update status
    returnRequest.status = 'approved';
    returnRequest.approvedAt = new Date().toISOString();
    returnRequest.updatedAt = new Date().toISOString();

    // Create reverse logistics shipment
    let awb: string | undefined;
    
    if (logisticsPartner === 'shiprocket') {
      const result = await createShiprocketReturn({
        order_id: returnRequest.id,
        pickup_customer_name: returnRequest.pickupAddress.name,
        pickup_address: returnRequest.pickupAddress.street,
        pickup_city: returnRequest.pickupAddress.city,
        pickup_pincode: returnRequest.pickupAddress.pincode,
        pickup_state: returnRequest.pickupAddress.state,
        pickup_phone: returnRequest.pickupAddress.phone
      });
      awb = result.awb;
    }

    returnRequest.logistics = {
      partner: logisticsPartner,
      awb: awb || `AWB_${Date.now()}`,
      trackingUrl: awb ? `https://track.shiprocket.in/${awb}` : undefined
    };

    await kv.set(`return:${returnId}`, returnRequest);

    console.log(`✅ Return approved and pickup scheduled: ${returnId}`);
    return returnRequest;
  } catch (error) {
    console.error('Error approving return:', error);
    throw error;
  }
}

/**
 * Process refund for return
 */
async function processRefund(returnId: string): Promise<any> {
  try {
    const returnRequest: ReturnRequest = await kv.get(`return:${returnId}`);
    if (!returnRequest) {
      throw new Error('Return request not found');
    }

    // Calculate refund amount
    const totalAmount = returnRequest.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    
    // Apply restocking fee if applicable
    const policy = await kv.get(`return_policy:${returnRequest.orderId}`);
    const restockingFee = policy?.restockingFee || 0;
    const refundAmount = totalAmount * (1 - restockingFee / 100);

    // Process refund (integrate with payment gateway)
    // For now, mark as refunded
    returnRequest.refund = {
      amount: refundAmount,
      method: 'wallet', // or original_payment method
      status: 'processed',
      transactionId: `TXN_${Date.now()}`
    };

    returnRequest.status = 'refunded';
    returnRequest.completedAt = new Date().toISOString();
    returnRequest.updatedAt = new Date().toISOString();

    await kv.set(`return:${returnId}`, returnRequest);

    // Credit to customer wallet
    const walletKey = `wallet:${returnRequest.customerId}`;
    const wallet = await kv.get(walletKey) || { balance: 0 };
    wallet.balance += refundAmount;
    await kv.set(walletKey, wallet);

    console.log(`✅ Refund processed: ${returnId} - ₹${refundAmount}`);
    return returnRequest;
  } catch (error) {
    console.error('Error processing refund:', error);
    throw error;
  }
}

/**
 * Register Returns Management Endpoints
 */
export function registerReturnsManagementEndpoints(app: Hono) {
  
  /**
   * POST /returns/check-eligibility
   * Check if return is eligible
   */
  app.post('/make-server-3dd53475/returns/check-eligibility', async (c) => {
    try {
      const { orderId, productId, reason } = await c.req.json();
      const result = await checkReturnEligibility(orderId, productId, reason);
      
      return c.json({
        success: true,
        ...result
      });
    } catch (error: any) {
      console.error('Error checking return eligibility:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * POST /returns/create
   * Create return request
   */
  app.post('/make-server-3dd53475/returns/create', async (c) => {
    try {
      const data = await c.req.json();
      const returnRequest = await createReturnRequest(data);
      
      return c.json({
        success: true,
        data: returnRequest
      });
    } catch (error: any) {
      console.error('Error creating return request:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * POST /returns/:returnId/approve
   * Approve return and schedule pickup
   */
  app.post('/make-server-3dd53475/returns/:returnId/approve', async (c) => {
    try {
      const returnId = c.req.param('returnId');
      const { logisticsPartner } = await c.req.json();
      
      const result = await approveReturn(returnId, logisticsPartner);
      
      return c.json({
        success: true,
        data: result
      });
    } catch (error: any) {
      console.error('Error approving return:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * POST /returns/:returnId/refund
   * Process refund for return
   */
  app.post('/make-server-3dd53475/returns/:returnId/refund', async (c) => {
    try {
      const returnId = c.req.param('returnId');
      const result = await processRefund(returnId);
      
      return c.json({
        success: true,
        data: result
      });
    } catch (error: any) {
      console.error('Error processing refund:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * GET /returns/:returnId
   * Get return details
   */
  app.get('/make-server-3dd53475/returns/:returnId', async (c) => {
    try {
      const returnId = c.req.param('returnId');
      const returnRequest = await kv.get(`return:${returnId}`);
      
      if (!returnRequest) {
        return c.json({ error: 'Return not found' }, 404);
      }
      
      return c.json({
        success: true,
        data: returnRequest
      });
    } catch (error: any) {
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * GET /returns/customer/:customerId
   * Get customer's returns
   */
  app.get('/make-server-3dd53475/returns/customer/:customerId', async (c) => {
    try {
      const customerId = c.req.param('customerId');
      const returnIds = await kv.get(`customer:${customerId}:returns`) || [];
      
      const returns = await Promise.all(
        returnIds.map(async (id: string) => await kv.get(`return:${id}`))
      );
      
      return c.json({
        success: true,
        data: returns.filter(Boolean)
      });
    } catch (error: any) {
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * GET/POST /returns/policies
   * Manage return policies
   */
  app.get('/make-server-3dd53475/returns/policies', async (c) => {
    try {
      const policies = await kv.get('admin:settings:return_policies') || [];
      return c.json({ success: true, policies });
    } catch (error: any) {
      return c.json({ error: error.message }, 500);
    }
  });

  app.post('/make-server-3dd53475/returns/policies', async (c) => {
    try {
      const policies: ReturnPolicy[] = await c.req.json();
      await kv.set('admin:settings:return_policies', policies);
      return c.json({ success: true });
    } catch (error: any) {
      return c.json({ error: error.message }, 500);
    }
  });

  console.log('✅ Returns management endpoints registered');
}
