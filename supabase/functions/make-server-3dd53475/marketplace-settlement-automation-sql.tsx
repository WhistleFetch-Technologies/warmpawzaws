/**
 * ============================================================================
 * MARKETPLACE SETTLEMENT AUTOMATION - SQL-ONLY VERSION
 * ============================================================================
 * 
 * REFACTORED: Removed all KV usage, using SQL repositories only
 * 
 * Phase 7C: Payment & Settlement - Rule 15 Implementation
 * 
 * Features:
 * - Automated settlement processing via Razorpay
 * - Marketplace mode payouts
 * - Commission deduction
 * - Settlement scheduling
 * 
 * CHANGES:
 * - Removed `kv` parameter from function signature
 * - Replaced all `kv.get()`, `kv.set()` with SQL repository calls
 * - Uses `SettlementsRepository` and `settlement_schedules` table
 * 
 * Date: 2025-01-27
 * Migration: Agent-3 - KV to SQL (Batch 10)
 * KV Operations Removed: 14
 * ============================================================================
 */

import { Hono } from "npm:hono";
import { sendSuccess, sendError } from "./response-utils.ts";
import { getSettlementsRepository } from '../../lib/repositories/settlements.ts';
import { getDbClient } from '../../lib/db.ts';

export function marketplaceSettlementAutomationEndpoints(app: Hono) {
  const BASE_PATH = "/make-server-3dd53475";
  const db = getDbClient();
  const settlementsRepo = getSettlementsRepository();

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

      const commissionAmount = commission || (amount * 0.15); // Default 15% commission
      const netAmount = amount - commissionAmount;

      // ✅ SQL: Create settlement
      const settlement = await settlementsRepo.create({
        vendor_id: vendorId,
        booking_id: bookingId,
        settlement_amount: amount,
        commission_amount: commissionAmount,
        vendor_amount: netAmount,
        settlement_date: new Date().toISOString().split('T')[0],
      });

      console.log(`✅ Settlement created: ${settlement.id} for vendor ${vendorId} - ₹${netAmount}`);

      return sendSuccess(c, { 
        settlement: {
          settlementId: settlement.id,
          vendorId: settlement.vendor_id,
          bookingId: settlement.booking_id,
          amount: settlement.settlement_amount,
          commission: settlement.commission_amount,
          netAmount: settlement.vendor_amount,
          status: settlement.settlement_status,
          createdAt: settlement.created_at,
        }
      }, 'Settlement created successfully');
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
      // ✅ SQL: Get all pending settlements
      const { data: settlements, error } = await db
        .from('settlements')
        .select('*')
        .eq('settlement_status', 'pending')
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      const mappedSettlements = (settlements || []).map(s => ({
        settlementId: s.id,
        vendorId: s.vendor_id,
        bookingId: s.booking_id,
        amount: s.total_amount,
        commission: s.commission_amount,
        netAmount: s.net_amount,
        status: s.settlement_status,
        createdAt: s.created_at,
      }));

      return sendSuccess(c, { 
        settlements: mappedSettlements, 
        count: mappedSettlements.length 
      });
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

      // ✅ SQL: Get all settlements for vendor
      const settlements = await settlementsRepo.findByVendor(vendorId);

      const mappedSettlements = settlements.map(s => ({
        settlementId: s.id,
        vendorId: s.vendor_id,
        bookingId: s.booking_id,
        amount: s.settlement_amount,
        commission: s.commission_amount,
        netAmount: s.vendor_amount,
        status: s.settlement_status,
        razorpayPayoutId: s.razorpay_settlement_id,
        createdAt: s.created_at,
        processedAt: s.processed_at,
      }));

      return sendSuccess(c, { 
        settlements: mappedSettlements, 
        count: mappedSettlements.length 
      });
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

      // ✅ SQL: Get settlement
      const settlement = await settlementsRepo.findById(settlementId);

      if (!settlement) {
        return sendError(c, 'Settlement not found', 404);
      }

      // ✅ SQL: Update settlement
      const updatedSettlement = await settlementsRepo.update(settlementId, {
        settlement_status: status,
        razorpay_settlement_id: razorpayPayoutId,
        failure_reason: failureReason,
        processed_at: (status === 'completed' || status === 'failed') ? new Date().toISOString() : undefined,
      });

      console.log(`✅ Settlement status updated: ${settlementId} - ${status}`);

      return sendSuccess(c, { 
        settlement: {
          settlementId: updatedSettlement.id,
          vendorId: updatedSettlement.vendor_id,
          bookingId: updatedSettlement.booking_id,
          amount: updatedSettlement.settlement_amount,
          commission: updatedSettlement.commission_amount,
          netAmount: updatedSettlement.vendor_amount,
          status: updatedSettlement.settlement_status,
          razorpayPayoutId: updatedSettlement.razorpay_settlement_id,
          createdAt: updatedSettlement.created_at,
          processedAt: updatedSettlement.processed_at,
        }
      }, 'Settlement status updated successfully');
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

      const nextSettlementDate = calculateNextSettlementDate(frequency);

      // ✅ SQL: Create or update settlement schedule
      const { data: existingSchedule } = await db
        .from('settlement_schedules')
        .select('*')
        .eq('vendor_id', vendorId)
        .maybeSingle();

      let schedule;
      if (existingSchedule) {
        // Update existing schedule
        const { data: updated } = await db
          .from('settlement_schedules')
          .update({
            schedule_type: frequency,
            is_active: true,
          })
          .eq('id', existingSchedule.id)
          .select()
          .single();
        schedule = updated;
      } else {
        // Create new schedule
        const { data: created } = await db
          .from('settlement_schedules')
          .insert({
            vendor_id: vendorId,
            schedule_type: frequency,
            is_active: true,
          })
          .select()
          .single();
        schedule = created;
      }

      console.log(`✅ Auto-settlement scheduled for vendor ${vendorId}: ${frequency}`);

      return sendSuccess(c, { 
        schedule: {
          vendorId: schedule.vendor_id,
          frequency: schedule.schedule_type,
          isActive: schedule.is_active,
          createdAt: schedule.created_at,
        }
      }, 'Auto-settlement scheduled successfully');
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

  console.log('✅ Marketplace Settlement Automation endpoints registered (SQL-only)');
}
