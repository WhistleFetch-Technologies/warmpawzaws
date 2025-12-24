/**
 * ============================================================================
 * MARKETPLACE SETTLEMENT AUTOMATION - SQL-ONLY VERSION
 * ============================================================================
 * 
 * REFACTORED: Removed all KV usage, using SQL repositories only
 * 
 * Features:
 * - Automated settlement processing via Razorpay
 * - Marketplace mode payouts
 * - Commission deduction
 * - Settlement scheduling
 * 
 * RULES:
 * ❌ NO KV imports allowed
 * ✅ All operations use SQL only
 * 
 * Date: 2024-12-23
 * Migration: Phase 1, Task 1.4 - KV to SQL
 * ============================================================================
 */

import { Hono } from "npm:hono";
import { sendSuccess, sendError } from "./response-utils.ts";
import { getSettlementsRepository } from "../../lib/repositories/settlements.ts";
import { getVendorsRepository } from "../../lib/repositories/vendors.ts";
import { getDbClient } from "../../lib/db.ts";

export function marketplaceSettlementAutomationEndpointsSQL(app: Hono) {
  const BASE_PATH = "/make-server-3dd53475";
  const settlementsRepo = getSettlementsRepository();
  const db = getDbClient();

  // Helper: Resolve vendor ID
  async function resolveVendorId(identifier: string): Promise<string | null> {
    const vendorsRepo = getVendorsRepository();
    return await vendorsRepo.resolveVendorId(identifier);
  }

  // Helper: Calculate next settlement date
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
    
    return now.toISOString().split('T')[0];
  }

  // ========================================
  // PROCESS SETTLEMENT (RAZORPAY)
  // ========================================
  app.post(`${BASE_PATH}/payment/settlement/process-razorpay`, async (c) => {
    try {
      const {
        vendorId: paramVendorId,
        bookingId,
        paymentId,
        amount,
        commission,
      } = await c.req.json();

      if (!paramVendorId || !amount) {
        return sendError(c, 'Required fields missing: vendorId, amount', 400);
      }

      // ✅ CRITICAL FIX: Resolve vendorId to UUID
      const resolvedVendorId = await resolveVendorId(paramVendorId);
      
      if (!resolvedVendorId) {
        console.error(`❌ [SETTLEMENT-SQL] Vendor not found or invalid ID format: ${paramVendorId}`);
        return sendError(c, 'Vendor not found or invalid ID format', 404);
      }

      const commissionAmount = commission || (amount * 0.15); // Default 15% commission
      const netAmount = amount - commissionAmount;

      // ✅ SQL: Create settlement
      const settlement = await settlementsRepo.create({
        vendor_id: resolvedVendorId,
        booking_id: bookingId || undefined,
        payment_id: paymentId || undefined,
        settlement_amount: amount,
        commission_amount: commissionAmount,
        vendor_amount: netAmount,
        settlement_date: new Date().toISOString().split('T')[0],
      });

      console.log(`✅ [SETTLEMENT-SQL] Settlement created: ${settlement.id} for vendor ${paramVendorId} (resolved: ${resolvedVendorId}) - ₹${netAmount}`);

      // Map to API response format
      const settlementResponse = {
        settlementId: settlement.id,
        vendorId: settlement.vendor_id,
        bookingId: settlement.booking_id,
        paymentId: settlement.payment_id,
        amount: settlement.settlement_amount,
        commission: settlement.commission_amount,
        netAmount: settlement.vendor_amount,
        status: settlement.settlement_status,
        razorpayPayoutId: settlement.razorpay_settlement_id,
        scheduledAt: settlement.settlement_date,
        processedAt: settlement.processed_at,
        createdAt: settlement.created_at,
        updatedAt: settlement.created_at, // Use created_at as updated_at initially
      };

      return sendSuccess(c, { settlement: settlementResponse }, 'Settlement created successfully');
    } catch (error) {
      console.error('❌ [SETTLEMENT-SQL] Error processing settlement:', error);
      return sendError(c, `Failed to process settlement: ${String(error)}`, 500);
    }
  });

  // ========================================
  // GET PENDING SETTLEMENTS
  // ========================================
  app.get(`${BASE_PATH}/payment/settlement/pending`, async (c) => {
    try {
      // ✅ SQL: Get pending settlements
      const { data: settlements, error } = await db
        .from("settlements")
        .select("*")
        .eq("settlement_status", "pending")
        .order("created_at", { ascending: false });

      if (error) {
        throw error;
      }

      const settlementsResponse = (settlements || []).map((s: any) => ({
        settlementId: s.id,
        vendorId: s.vendor_id,
        bookingId: s.booking_id,
        paymentId: s.payment_id,
        amount: s.settlement_amount,
        commission: s.commission_amount,
        netAmount: s.vendor_amount,
        status: s.settlement_status,
        razorpayPayoutId: s.razorpay_settlement_id,
        scheduledAt: s.settlement_date,
        processedAt: s.processed_at,
        createdAt: s.created_at,
        updatedAt: s.created_at,
      }));

      console.log(`✅ [SETTLEMENT-SQL] Found ${settlementsResponse.length} pending settlements`);

      return sendSuccess(c, { 
        settlements: settlementsResponse, 
        count: settlementsResponse.length 
      });
    } catch (error) {
      console.error('❌ [SETTLEMENT-SQL] Error getting pending settlements:', error);
      return sendError(c, `Failed to get pending settlements: ${String(error)}`, 500);
    }
  });

  // ========================================
  // GET VENDOR SETTLEMENTS
  // ========================================
  app.get(`${BASE_PATH}/payment/settlement/vendor/:vendorId`, async (c) => {
    try {
      const { vendorId: paramVendorId } = c.req.param();

      // ✅ CRITICAL FIX: Resolve vendorId to UUID
      const resolvedVendorId = await resolveVendorId(paramVendorId);
      
      if (!resolvedVendorId) {
        console.error(`❌ [SETTLEMENT-SQL] Vendor not found or invalid ID format: ${paramVendorId}`);
        return sendError(c, 'Vendor not found or invalid ID format', 404);
      }

      // ✅ SQL: Get vendor settlements
      const settlements = await settlementsRepo.findByVendor(resolvedVendorId);

      const settlementsResponse = settlements.map((s) => ({
        settlementId: s.id,
        vendorId: s.vendor_id,
        bookingId: s.booking_id,
        paymentId: s.payment_id,
        amount: s.settlement_amount,
        commission: s.commission_amount,
        netAmount: s.vendor_amount,
        status: s.settlement_status,
        razorpayPayoutId: s.razorpay_settlement_id,
        scheduledAt: s.settlement_date,
        processedAt: s.processed_at,
        completedAt: s.completed_at,
        createdAt: s.created_at,
        updatedAt: s.created_at,
      }));

      console.log(`✅ [SETTLEMENT-SQL] Found ${settlementsResponse.length} settlements for vendor ${paramVendorId}`);

      return sendSuccess(c, { 
        settlements: settlementsResponse, 
        count: settlementsResponse.length 
      });
    } catch (error) {
      console.error('❌ [SETTLEMENT-SQL] Error getting vendor settlements:', error);
      return sendError(c, `Failed to get vendor settlements: ${String(error)}`, 500);
    }
  });

  // ========================================
  // UPDATE SETTLEMENT STATUS
  // ========================================
  app.put(`${BASE_PATH}/payment/settlement/:settlementId/status`, async (c) => {
    try {
      const { settlementId } = c.req.param();
      const { status, razorpayPayoutId, failureReason } = await c.req.json();

      // ✅ SQL: Get settlement
      const settlement = await settlementsRepo.findById(settlementId);

      if (!settlement) {
        return sendError(c, 'Settlement not found', 404);
      }

      // ✅ SQL: Update settlement
      const updateData: any = {
        settlement_status: status,
      };

      if (razorpayPayoutId) {
        updateData.razorpay_settlement_id = razorpayPayoutId;
      }

      if (failureReason) {
        updateData.failure_reason = failureReason;
      }

      if (status === 'completed' || status === 'failed') {
        updateData.processed_at = new Date().toISOString();
        if (status === 'completed') {
          updateData.completed_at = new Date().toISOString();
        }
      }

      const updatedSettlement = await settlementsRepo.update(settlementId, updateData);

      console.log(`✅ [SETTLEMENT-SQL] Settlement status updated: ${settlementId} - ${status}`);

      const settlementResponse = {
        settlementId: updatedSettlement.id,
        vendorId: updatedSettlement.vendor_id,
        bookingId: updatedSettlement.booking_id,
        paymentId: updatedSettlement.payment_id,
        amount: updatedSettlement.settlement_amount,
        commission: updatedSettlement.commission_amount,
        netAmount: updatedSettlement.vendor_amount,
        status: updatedSettlement.settlement_status,
        razorpayPayoutId: updatedSettlement.razorpay_settlement_id,
        scheduledAt: updatedSettlement.settlement_date,
        processedAt: updatedSettlement.processed_at,
        completedAt: updatedSettlement.completed_at,
        createdAt: updatedSettlement.created_at,
        updatedAt: updatedSettlement.created_at,
      };

      return sendSuccess(c, { settlement: settlementResponse }, 'Settlement status updated successfully');
    } catch (error) {
      console.error('❌ [SETTLEMENT-SQL] Error updating settlement status:', error);
      return sendError(c, `Failed to update settlement status: ${String(error)}`, 500);
    }
  });

  // ========================================
  // AUTO-SCHEDULE SETTLEMENTS
  // ========================================
  app.post(`${BASE_PATH}/payment/settlement/auto-schedule`, async (c) => {
    try {
      const { vendorId: paramVendorId, frequency } = await c.req.json();

      if (!paramVendorId || !frequency) {
        return sendError(c, 'vendorId and frequency are required', 400);
      }

      const validFrequencies = ['daily', 'weekly', 'biweekly', 'monthly'];
      if (!validFrequencies.includes(frequency)) {
        return sendError(c, `Invalid frequency. Must be one of: ${validFrequencies.join(', ')}`, 400);
      }

      // ✅ CRITICAL FIX: Resolve vendorId to UUID
      const resolvedVendorId = await resolveVendorId(paramVendorId);
      
      if (!resolvedVendorId) {
        return sendError(c, 'Vendor not found or invalid ID format', 404);
      }

      const nextSettlementDate = calculateNextSettlementDate(frequency);

      // ✅ SQL: Create or update settlement schedule
      // Check if schedule exists
      const { data: existingSchedule } = await db
        .from("settlement_schedules")
        .select("*")
        .eq("vendor_id", resolvedVendorId)
        .maybeSingle();

      let schedule;
      if (existingSchedule) {
        // Update existing schedule
        const { data: updated, error } = await db
          .from("settlement_schedules")
          .update({
            schedule_type: frequency,
            is_active: true,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existingSchedule.id)
          .select()
          .single();

        if (error) throw error;
        schedule = updated;
      } else {
        // Create new schedule
        const scheduleData: any = {
          vendor_id: resolvedVendorId,
          schedule_type: frequency,
          is_active: true,
        };

        // Set day based on frequency
        if (frequency === 'weekly') {
          scheduleData.day_of_week = new Date().getDay();
        } else if (frequency === 'monthly') {
          scheduleData.day_of_month = new Date().getDate();
        }

        const { data: created, error } = await db
          .from("settlement_schedules")
          .insert(scheduleData)
          .select()
          .single();

        if (error) throw error;
        schedule = created;
      }

      console.log(`✅ [SETTLEMENT-SQL] Auto-settlement scheduled for vendor ${paramVendorId} (resolved: ${resolvedVendorId}): ${frequency}`);

      return sendSuccess(c, { 
        schedule: {
          id: schedule.id,
          vendorId: schedule.vendor_id,
          frequency: schedule.schedule_type,
          nextSettlementDate,
          isActive: schedule.is_active,
        }
      }, 'Auto-settlement scheduled successfully');
    } catch (error) {
      console.error('❌ [SETTLEMENT-SQL] Error scheduling settlements:', error);
      return sendError(c, `Failed to schedule settlements: ${String(error)}`, 500);
    }
  });

  console.log('✅ [SETTLEMENT-SQL] Marketplace Settlement Automation endpoints registered (SQL-only)');
}

