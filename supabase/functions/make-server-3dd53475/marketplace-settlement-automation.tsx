import { Hono } from "npm:hono";
import { sendSuccess, sendError } from "./response-utils.ts";

/**
 * 💰 MARKETPLACE SETTLEMENT AUTOMATION
 * 
 * Phase 7C: Payment & Settlement - Rule 15 Implementation
 * 
 * Features:
 * - Automated settlement processing via Razorpay
 * - Marketplace mode payouts
 * - Commission deduction
 * - Settlement scheduling
 */

interface MarketplaceSettlement {
  settlementId: string;
  vendorId: string;
  bookingId: string;
  amount: number;
  commission: number;
  netAmount: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  razorpayPayoutId?: string;
  scheduledAt: string;
  processedAt?: string;
  failureReason?: string;
  createdAt: string;
  updatedAt: string;
}

export function marketplaceSettlementAutomationEndpoints(app: Hono, kv: any) {
  const BASE_PATH = "/make-server-3dd53475";

  // ========================================
  // PROCESS SETTLEMENT (RAZORPAY)
  // ========================================
  app.post(`${BASE_PATH}/payment/settlement/process-razorpay`, async (c) => {
    try {
      const {
        vendorId,
        bookingId,
        amount,
        commission,
      } = await c.req.json();

      if (!vendorId || !bookingId || !amount) {
        return sendError(c, 'Required fields missing', 400);
      }

      const settlementId = `settle_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      const commissionAmount = commission || (amount * 0.15); // Default 15% commission
      const netAmount = amount - commissionAmount;

      const settlement: MarketplaceSettlement = {
        settlementId,
        vendorId,
        bookingId,
        amount,
        commission: commissionAmount,
        netAmount,
        status: 'pending',
        scheduledAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // Schedule for next day
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await kv.set(`settlement_${settlementId}`, settlement);

      // Add to vendor's settlements
      const vendorSettlements = await kv.get(`vendor_settlements_${vendorId}`) || [];
      vendorSettlements.push(settlementId);
      await kv.set(`vendor_settlements_${vendorId}`, vendorSettlements);

      // Add to pending settlements
      const pendingSettlements = await kv.get('pending_settlements') || [];
      pendingSettlements.push(settlementId);
      await kv.set('pending_settlements', pendingSettlements);

      console.log(`✅ Settlement created: ${settlementId} for vendor ${vendorId} - ₹${netAmount}`);

      return sendSuccess(c, { settlement }, 'Settlement created successfully');
    } catch (error) {
      console.error('Error processing settlement:', error);
      return sendError(c, error, 500);
    }
  });

  // ========================================
  // GET PENDING SETTLEMENTS
  // ========================================
  app.get(`${BASE_PATH}/payment/settlement/pending`, async (c) => {
    try {
      const pendingIds = await kv.get('pending_settlements') || [];

      const settlements = await Promise.all(
        pendingIds.map((id: string) => kv.get(`settlement_${id}`))
      );

      const validSettlements = settlements.filter(Boolean);

      return sendSuccess(c, { settlements: validSettlements, count: validSettlements.length });
    } catch (error) {
      console.error('Error getting pending settlements:', error);
      return sendError(c, error, 500);
    }
  });

  // ========================================
  // GET VENDOR SETTLEMENTS
  // ========================================
  app.get(`${BASE_PATH}/payment/settlement/vendor/:vendorId`, async (c) => {
    try {
      const vendorId = c.req.param('vendorId');

      const settlementIds = await kv.get(`vendor_settlements_${vendorId}`) || [];

      const settlements = await Promise.all(
        settlementIds.map((id: string) => kv.get(`settlement_${id}`))
      );

      const validSettlements = settlements.filter(Boolean);

      // Sort by creation date (newest first)
      validSettlements.sort((a: any, b: any) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );

      return sendSuccess(c, { settlements: validSettlements, count: validSettlements.length });
    } catch (error) {
      console.error('Error getting vendor settlements:', error);
      return sendError(c, error, 500);
    }
  });

  // ========================================
  // UPDATE SETTLEMENT STATUS
  // ========================================
  app.put(`${BASE_PATH}/payment/settlement/:settlementId/status`, async (c) => {
    try {
      const settlementId = c.req.param('settlementId');
      const { status, razorpayPayoutId, failureReason } = await c.req.json();

      const settlement = await kv.get(`settlement_${settlementId}`);

      if (!settlement) {
        return sendError(c, 'Settlement not found', 404);
      }

      settlement.status = status;

      if (razorpayPayoutId) {
        settlement.razorpayPayoutId = razorpayPayoutId;
      }

      if (failureReason) {
        settlement.failureReason = failureReason;
      }

      if (status === 'completed' || status === 'failed') {
        settlement.processedAt = new Date().toISOString();

        // Remove from pending
        const pendingSettlements = await kv.get('pending_settlements') || [];
        const index = pendingSettlements.indexOf(settlementId);
        if (index > -1) {
          pendingSettlements.splice(index, 1);
          await kv.set('pending_settlements', pendingSettlements);
        }
      }

      settlement.updatedAt = new Date().toISOString();

      await kv.set(`settlement_${settlementId}`, settlement);

      console.log(`✅ Settlement status updated: ${settlementId} - ${status}`);

      return sendSuccess(c, { settlement }, 'Settlement status updated successfully');
    } catch (error) {
      console.error('Error updating settlement status:', error);
      return sendError(c, error, 500);
    }
  });

  // ========================================
  // AUTO-SCHEDULE SETTLEMENTS
  // ========================================
  app.post(`${BASE_PATH}/payment/settlement/auto-schedule`, async (c) => {
    try {
      const { vendorId, frequency } = await c.req.json();

      if (!vendorId || !frequency) {
        return sendError(c, 'vendorId and frequency are required', 400);
      }

      const validFrequencies = ['daily', 'weekly', 'biweekly', 'monthly'];
      if (!validFrequencies.includes(frequency)) {
        return sendError(c, `Invalid frequency. Must be one of: ${validFrequencies.join(', ')}`, 400);
      }

      const schedule = {
        vendorId,
        frequency,
        nextSettlementDate: calculateNextSettlementDate(frequency),
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await kv.set(`settlement_schedule_${vendorId}`, schedule);

      console.log(`✅ Auto-settlement scheduled for vendor ${vendorId}: ${frequency}`);

      return sendSuccess(c, { schedule }, 'Auto-settlement scheduled successfully');
    } catch (error) {
      console.error('Error scheduling settlements:', error);
      return sendError(c, error, 500);
    }
  });

  // Helper function
  function calculateNextSettlementDate(frequency: string): string {
    const now = new Date();
    
    switch (frequency) {
      case 'daily':
        now.setDate(now.getDate() + 1);
        break;
      case 'weekly':
        now.setDate(now.getDate() + 7);
        break;
      case 'biweekly':
        now.setDate(now.getDate() + 14);
        break;
      case 'monthly':
        now.setMonth(now.getMonth() + 1);
        break;
    }
    
    return now.toISOString();
  }

  console.log('✅ Marketplace Settlement Automation endpoints registered');
}
