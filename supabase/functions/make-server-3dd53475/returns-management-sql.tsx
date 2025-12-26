/**
 * Returns Management for Warmpawz - SQL-ONLY VERSION
 * 
 * ✅ MIGRATED TO SQL: All KV operations replaced with SQL queries
 * 
 * Handles return requests, logistics, and refunds
 * 
 * Date: 2025-01-27
 * Migration: KV to SQL (19 KV operations → 0)
 * Endpoints: 8
 */

import { Hono } from 'npm:hono';
import { getDbClient } from '../../lib/db.ts';
import { createReturnOrder as createShiprocketReturn } from './shiprocket-integration.tsx';
import { getPlatformSettingsRepository } from '../../lib/repositories/platform-settings.ts';

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
    const db = getDbClient();
    
    // ✅ SQL: Get order details
    const { data: order, error: orderError } = await db
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .single();
    
    if (orderError || !order) {
      return { eligible: false, message: 'Order not found' };
    }

    // Check if order is delivered
    if (order.status !== 'delivered') {
      return { eligible: false, message: 'Order not yet delivered' };
    }

    // ✅ SQL: Get applicable return policy from platform_settings
    const policiesRepo = getPlatformSettingsRepository();
    const policiesData = await policiesRepo.getSetting('return_policies');
    const policies: ReturnPolicy[] = policiesData || [];
    
    // Find specific policy
    let policy = policies.find(p => p.productId === productId);
    if (!policy) {
      policy = policies.find(p => p.categoryId === order.category_id);
    }
    if (!policy) {
      policy = policies.find(p => p.vendorId === order.vendor_id);
    }
    if (!policy) {
      policy = policies.find(p => p.global === true);
    }

    if (!policy) {
      return { eligible: false, message: 'No return policy found for this product' };
    }

    // Check return window
    const deliveryDate = new Date(order.delivered_at || order.updated_at);
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
    const db = getDbClient();
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

    // ✅ SQL: Save return request to returns table
    const { error: insertError } = await db
      .from('returns')
      .insert({
        id: returnId,
        order_id: data.orderId,
        customer_id: data.customerId,
        vendor_id: data.vendorId,
        items: data.items,
        return_reason: data.returnReason,
        description: data.description,
        images: data.images || [],
        status: 'pending',
        pickup_address: data.pickupAddress,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });

    if (insertError) {
      console.error('Error inserting return:', insertError);
      throw insertError;
    }

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
    const db = getDbClient();
    
    // ✅ SQL: Get return request
    const { data: returnData, error: fetchError } = await db
      .from('returns')
      .select('*')
      .eq('id', returnId)
      .single();
    
    if (fetchError || !returnData) {
      throw new Error('Return request not found');
    }

    const returnRequest: ReturnRequest = {
      id: returnData.id,
      orderId: returnData.order_id,
      customerId: returnData.customer_id,
      vendorId: returnData.vendor_id,
      items: returnData.items || [],
      returnReason: returnData.return_reason,
      description: returnData.description,
      images: returnData.images || [],
      status: returnData.status,
      pickupAddress: returnData.pickup_address,
      logistics: returnData.logistics,
      refund: returnData.refund,
      createdAt: returnData.created_at,
      updatedAt: returnData.updated_at,
      approvedAt: returnData.approved_at,
      completedAt: returnData.completed_at
    };

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

    // ✅ SQL: Update return request
    await db
      .from('returns')
      .update({
        status: 'approved',
        approved_at: returnRequest.approvedAt,
        logistics: returnRequest.logistics,
        updated_at: returnRequest.updatedAt
      })
      .eq('id', returnId);

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
    const db = getDbClient();
    
    // ✅ SQL: Get return request
    const { data: returnData, error: fetchError } = await db
      .from('returns')
      .select('*')
      .eq('id', returnId)
      .single();
    
    if (fetchError || !returnData) {
      throw new Error('Return request not found');
    }

    const returnRequest: ReturnRequest = {
      id: returnData.id,
      orderId: returnData.order_id,
      customerId: returnData.customer_id,
      vendorId: returnData.vendor_id,
      items: returnData.items || [],
      returnReason: returnData.return_reason,
      description: returnData.description,
      images: returnData.images || [],
      status: returnData.status,
      pickupAddress: returnData.pickup_address,
      logistics: returnData.logistics,
      refund: returnData.refund,
      createdAt: returnData.created_at,
      updatedAt: returnData.updated_at,
      approvedAt: returnData.approved_at,
      completedAt: returnData.completed_at
    };

    // Calculate refund amount
    const totalAmount = returnRequest.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    
    // ✅ SQL: Get return policy
    const policiesRepo = getPlatformSettingsRepository();
    const policiesData = await policiesRepo.getSetting('return_policies');
    const policies: ReturnPolicy[] = policiesData || [];
    const policy = policies.find(p => p.vendorId === returnRequest.vendorId || p.global === true);
    
    const restockingFee = policy?.restockingFee || 0;
    const refundAmount = totalAmount * (1 - restockingFee / 100);

    // Process refund (integrate with payment gateway)
    returnRequest.refund = {
      amount: refundAmount,
      method: 'wallet', // or original_payment method
      status: 'processed',
      transactionId: `TXN_${Date.now()}`
    };

    returnRequest.status = 'refunded';
    returnRequest.completedAt = new Date().toISOString();
    returnRequest.updatedAt = new Date().toISOString();

    // ✅ SQL: Update return request
    await db
      .from('returns')
      .update({
        status: 'refunded',
        refund: returnRequest.refund,
        completed_at: returnRequest.completedAt,
        updated_at: returnRequest.updatedAt
      })
      .eq('id', returnId);

    // ✅ SQL: Credit to customer wallet
    const { data: walletData } = await db
      .from('customer_wallets')
      .select('*')
      .eq('customer_id', returnRequest.customerId)
      .single();
    
    if (walletData) {
      await db
        .from('customer_wallets')
        .update({
          balance: (walletData.balance || 0) + refundAmount,
          updated_at: new Date().toISOString()
        })
        .eq('customer_id', returnRequest.customerId);
    } else {
      await db
        .from('customer_wallets')
        .insert({
          customer_id: returnRequest.customerId,
          balance: refundAmount,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });
    }

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
      const db = getDbClient();
      const returnId = c.req.param('returnId');
      
      // ✅ SQL: Get return request
      const { data: returnData, error } = await db
        .from('returns')
        .select('*')
        .eq('id', returnId)
        .single();
      
      if (error || !returnData) {
        return c.json({ error: 'Return not found' }, 404);
      }
      
      const returnRequest: ReturnRequest = {
        id: returnData.id,
        orderId: returnData.order_id,
        customerId: returnData.customer_id,
        vendorId: returnData.vendor_id,
        items: returnData.items || [],
        returnReason: returnData.return_reason,
        description: returnData.description,
        images: returnData.images || [],
        status: returnData.status,
        pickupAddress: returnData.pickup_address,
        logistics: returnData.logistics,
        refund: returnData.refund,
        createdAt: returnData.created_at,
        updatedAt: returnData.updated_at,
        approvedAt: returnData.approved_at,
        completedAt: returnData.completed_at
      };
      
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
      const db = getDbClient();
      const customerId = c.req.param('customerId');
      
      // ✅ SQL: Get all returns for customer
      const { data: returns, error } = await db
        .from('returns')
        .select('*')
        .eq('customer_id', customerId)
        .order('created_at', { ascending: false });
      
      if (error) {
        throw error;
      }
      
      const mappedReturns = (returns || []).map((r: any) => ({
        id: r.id,
        orderId: r.order_id,
        customerId: r.customer_id,
        vendorId: r.vendor_id,
        items: r.items || [],
        returnReason: r.return_reason,
        description: r.description,
        images: r.images || [],
        status: r.status,
        pickupAddress: r.pickup_address,
        logistics: r.logistics,
        refund: r.refund,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
        approvedAt: r.approved_at,
        completedAt: r.completed_at
      }));
      
      return c.json({
        success: true,
        data: mappedReturns
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
      const policiesRepo = getPlatformSettingsRepository();
      const policies = await policiesRepo.getSetting('return_policies') || [];
      return c.json({ success: true, policies });
    } catch (error: any) {
      return c.json({ error: error.message }, 500);
    }
  });

  app.post('/make-server-3dd53475/returns/policies', async (c) => {
    try {
      const policiesRepo = getPlatformSettingsRepository();
      const policies: ReturnPolicy[] = await c.req.json();
      await policiesRepo.setSetting('return_policies', policies, 'object');
      return c.json({ success: true });
    } catch (error: any) {
      return c.json({ error: error.message }, 500);
    }
  });

  console.log('✅ Returns management endpoints registered (SQL-only)');
}

