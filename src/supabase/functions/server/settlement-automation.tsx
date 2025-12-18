/**
 * Settlement Automation Service
 * Automated Razorpay marketplace settlements
 */

import { Hono } from 'npm:hono';
import * as kv from './kv_store.tsx';
import { createRazorpayTransfer } from './razorpay-integration.tsx';

interface Settlement {
  id: string;
  vendorId: string;
  vendorName: string;
  periodStart: string;
  periodEnd: string;
  totalAmount: number;
  commission: number;
  netAmount: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  transactions: string[]; // Booking/order IDs
  createdAt: string;
  processedAt?: string;
  transferId?: string;
}

/**
 * Calculate settlement for a vendor
 */
export async function calculateSettlement(
  vendorId: string,
  periodStart: string,
  periodEnd: string
): Promise<Settlement> {
  const vendor = await kv.get(`vendor:${vendorId}`);
  if (!vendor) {
    throw new Error('Vendor not found');
  }

  // Get all bookings/orders in period
  const allBookings = await kv.getByPrefix('booking:');
  const allOrders = await kv.getByPrefix('order:');

  const periodStartDate = new Date(periodStart);
  const periodEndDate = new Date(periodEnd);

  // Filter bookings in period
  const bookings = allBookings.filter((b: any) => {
    if (b.vendorId !== vendorId) return false;
    if (b.paymentStatus !== 'paid') return false;
    const bookingDate = new Date(b.createdAt || b.bookingDate);
    return bookingDate >= periodStartDate && bookingDate <= periodEndDate;
  });

  // Filter orders in period
  const orders = allOrders.filter((o: any) => {
    if (o.vendorId !== vendorId) return false;
    if (o.paymentStatus !== 'paid') return false;
    const orderDate = new Date(o.createdAt || o.orderDate);
    return orderDate >= periodStartDate && orderDate <= periodEndDate;
  });

  // Calculate totals
  const bookingAmount = bookings.reduce((sum: number, b: any) => 
    sum + (b.totalAmount || b.amount || 0), 0
  );
  const orderAmount = orders.reduce((sum: number, o: any) => 
    sum + (o.totalAmount || o.amount || 0), 0
  );

  const totalAmount = bookingAmount + orderAmount;

  // Get vendor tier for commission calculation
  const vendorTierId = await kv.get(`vendor:${vendorId}:tier_id`);
  const tiers = await kv.get('payment:tiers') || [];
  const tier = tiers.find((t: any) => t.id === vendorTierId) || tiers.find((t: any) => t.isDefault);
  const commissionRate = tier?.commissionRate || 15; // Default 15%

  const commission = Math.round((totalAmount * commissionRate) / 100);
  const netAmount = totalAmount - commission;

  const transactionIds = [
    ...bookings.map((b: any) => b.id),
    ...orders.map((o: any) => o.id),
  ];

  return {
    id: `settlement_${Date.now()}_${vendorId}`,
    vendorId,
    vendorName: vendor.businessName || vendor.name,
    periodStart,
    periodEnd,
    totalAmount,
    commission,
    netAmount,
    status: 'pending',
    transactions: transactionIds,
    createdAt: new Date().toISOString(),
  };
}

/**
 * Process settlement (transfer to vendor)
 */
export async function processSettlement(settlementId: string): Promise<void> {
  const settlement = await kv.get(`settlement:${settlementId}`);
  if (!settlement) {
    throw new Error('Settlement not found');
  }

  if (settlement.status !== 'pending') {
    throw new Error(`Settlement already ${settlement.status}`);
  }

  try {
    // Update status to processing
    settlement.status = 'processing';
    await kv.set(`settlement:${settlementId}`, settlement);

    // Get vendor Razorpay account ID
    const vendor = await kv.get(`vendor:${settlement.vendorId}`);
    if (!vendor) {
      throw new Error('Vendor not found');
    }

    const vendorAccountId = vendor.razorpayAccountId;
    if (!vendorAccountId) {
      throw new Error('Vendor Razorpay account not configured. Please complete bank account verification.');
    }

    // Get payment IDs from settlement transactions for Razorpay Route transfers
    // In Razorpay Route, we need to transfer from actual payment IDs
    // For marketplace settlements, we'll use the first payment ID or create a settlement payment
    
    const RAZORPAY_KEY_ID = Deno.env.get('RAZORPAY_KEY_ID') || '';
    const RAZORPAY_KEY_SECRET = Deno.env.get('RAZORPAY_KEY_SECRET') || '';
    
    if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
      throw new Error('Razorpay credentials not configured');
    }
    
    const RAZORPAY_AUTH = btoa(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`);
    const RAZORPAY_API_BASE = 'https://api.razorpay.com/v1';

    // Get payment IDs from bookings/orders in settlement
    // For marketplace mode, we need to transfer from actual payment IDs
    // Strategy: Get first payment ID from transactions, or use settlement payment
    let paymentIdForTransfer: string | null = null;
    
    // Try to get payment ID from first booking/order
    if (settlement.transactions && settlement.transactions.length > 0) {
      const firstTransactionId = settlement.transactions[0];
      const booking = await kv.get(`booking:${firstTransactionId}`);
      const order = booking ? null : await kv.get(`order:${firstTransactionId}`);
      
      if (booking?.razorpayPaymentId) {
        paymentIdForTransfer = booking.razorpayPaymentId;
      } else if (order?.razorpayPaymentId) {
        paymentIdForTransfer = order.razorpayPaymentId;
      }
    }
    
    let transfer: any;
    
    if (paymentIdForTransfer) {
      // Use Razorpay Route transfer from payment
      try {
        const transferResponse = await fetch(
          `${RAZORPAY_API_BASE}/payments/${paymentIdForTransfer}/transfers`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Basic ${RAZORPAY_AUTH}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              transfers: [
                {
                  account: vendorAccountId,
                  amount: Math.round(settlement.netAmount * 100), // Convert to paise
                  currency: 'INR',
                  notes: {
                    settlementId: settlement.id,
                    vendorId: settlement.vendorId,
                    period: `${settlement.periodStart} to ${settlement.periodEnd}`,
                  },
                  linked_account_notes: {
                    settlementId: settlement.id,
                  },
                },
              ],
            }),
          }
        );
        
        if (!transferResponse.ok) {
          const error = await transferResponse.json();
          throw new Error(`Razorpay transfer failed: ${JSON.stringify(error)}`);
        }
        
        transfer = await transferResponse.json();
        console.log(`✅ [SETTLEMENT] Razorpay transfer created: ${transfer.id}`);
      } catch (transferError) {
        console.error(`❌ [SETTLEMENT] Razorpay transfer error:`, transferError);
        throw transferError;
      }
    } else {
      // No payment ID available - create settlement payment first
      // In production, settlements should always have payment IDs
      // For now, mark as pending manual processing
      console.warn(`⚠️ [SETTLEMENT] No payment ID found for settlement ${settlementId}, marking for manual processing`);
      settlement.status = 'pending';
      settlement.notes = 'No payment ID available - requires manual processing';
      await kv.set(`settlement:${settlementId}`, settlement);
      throw new Error('No payment ID available for transfer. Settlement requires manual processing.');
    }

    // Update settlement
    settlement.status = 'completed';
    settlement.processedAt = new Date().toISOString();
    settlement.transferId = transfer.id;
    await kv.set(`settlement:${settlementId}`, settlement);

    // Store in vendor settlements list
    const vendorSettlementsKey = `vendor:${settlement.vendorId}:settlements`;
    const vendorSettlements = await kv.get(vendorSettlementsKey) || [];
    vendorSettlements.push(settlementId);
    await kv.set(vendorSettlementsKey, vendorSettlements);

    console.log(`✅ [SETTLEMENT] Processed settlement ${settlementId}: ₹${settlement.netAmount}`);
  } catch (error) {
    console.error(`❌ [SETTLEMENT] Error processing ${settlementId}:`, error);
    
    // Update status to failed
    settlement.status = 'failed';
    settlement.error = String(error);
    await kv.set(`settlement:${settlementId}`, settlement);
    
    throw error;
  }
}

/**
 * Auto-settle vendors (run daily/weekly)
 */
export async function autoSettleVendors(
  periodDays: number = 7
): Promise<void> {
  try {
    console.log(`🔄 [SETTLEMENT] Starting auto-settlement for ${periodDays} day period`);

    const periodEnd = new Date();
    const periodStart = new Date();
    periodStart.setDate(periodStart.getDate() - periodDays);

    const allVendors = await kv.getByPrefix('vendor:vendor_');
    const activeVendors = allVendors.filter(
      (v: any) => v.status === 'approved' && v.isActive
    );

    console.log(`📊 [SETTLEMENT] Processing ${activeVendors.length} vendors`);

    for (const vendor of activeVendors) {
      try {
        const settlement = await calculateSettlement(
          vendor.id,
          periodStart.toISOString(),
          periodEnd.toISOString()
        );

        if (settlement.totalAmount > 0) {
          // Save settlement
          await kv.set(`settlement:${settlement.id}`, settlement);

          // Auto-process if amount > threshold
          const minSettlementAmount = 100; // ₹100 minimum
          if (settlement.netAmount >= minSettlementAmount) {
            await processSettlement(settlement.id);
          } else {
            console.log(`⏸️ [SETTLEMENT] Settlement ${settlement.id} below threshold (₹${settlement.netAmount})`);
          }
        }
      } catch (error) {
        console.error(`❌ [SETTLEMENT] Error for vendor ${vendor.id}:`, error);
        // Continue with next vendor
      }
    }

    console.log(`✅ [SETTLEMENT] Auto-settlement completed`);
  } catch (error) {
    console.error('❌ [SETTLEMENT] Auto-settlement error:', error);
    throw error;
  }
}

/**
 * Register settlement endpoints
 */
export function registerSettlementEndpoints(app: Hono) {
  /**
   * Calculate settlement
   * POST /make-server-3dd53475/settlements/calculate
   */
  app.post('/make-server-3dd53475/settlements/calculate', async (c) => {
    try {
      const { vendorId, periodStart, periodEnd } = await c.req.json();

      if (!vendorId || !periodStart || !periodEnd) {
        return c.json({ error: 'Missing required fields' }, 400);
      }

      const settlement = await calculateSettlement(vendorId, periodStart, periodEnd);
      
      // Save settlement
      await kv.set(`settlement:${settlement.id}`, settlement);

      return c.json({
        success: true,
        settlement,
      });
    } catch (error) {
      return c.json({ error: String(error) }, 500);
    }
  });

  /**
   * Process settlement
   * POST /make-server-3dd53475/settlements/:settlementId/process
   */
  app.post('/make-server-3dd53475/settlements/:settlementId/process', async (c) => {
    try {
      const { settlementId } = c.req.param();
      await processSettlement(settlementId);

      const settlement = await kv.get(`settlement:${settlementId}`);

      return c.json({
        success: true,
        settlement,
      });
    } catch (error) {
      return c.json({ error: String(error) }, 500);
    }
  });

  /**
   * Get vendor settlements
   * GET /make-server-3dd53475/settlements/vendor/:vendorId
   */
  app.get('/make-server-3dd53475/settlements/vendor/:vendorId', async (c) => {
    try {
      const { vendorId } = c.req.param();
      const settlementsKey = `vendor:${vendorId}:settlements`;
      const settlementIds = await kv.get(settlementsKey) || [];

      const settlements = await Promise.all(
        settlementIds.map(async (id: string) => {
          return await kv.get(`settlement:${id}`);
        })
      );

      return c.json({
        success: true,
        settlements: settlements.filter(s => s),
      });
    } catch (error) {
      return c.json({ error: String(error) }, 500);
    }
  });

  /**
   * Trigger auto-settlement (admin only)
   * POST /make-server-3dd53475/settlements/auto-settle
   */
  app.post('/make-server-3dd53475/settlements/auto-settle', async (c) => {
    try {
      const { periodDays } = await c.req.json();
      await autoSettleVendors(periodDays || 7);

      return c.json({
        success: true,
        message: 'Auto-settlement completed',
      });
    } catch (error) {
      return c.json({ error: String(error) }, 500);
    }
  });
}
