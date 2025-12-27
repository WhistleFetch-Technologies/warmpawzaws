/**
 * ============================================================================
 * MARKETPLACE SETTLEMENT AUTOMATION - SQL VERSION
 * ============================================================================
 * 
 * Automated settlement processing via Razorpay
 * Replaces: settlement_*, vendor_settlements_*, pending_settlements, settlement_schedule_* KV keys
 * 
 * RULES:
 * ❌ NO KV imports allowed
 * ✅ All operations use SQL only
 * 
 * Date: 2025-01-27
 * ============================================================================
 */

import { Hono } from "npm:hono";
import { sendSuccess, sendError } from "./response-utils.ts";
import { getDbClient } from "../../lib/db.ts";

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

export function marketplaceSettlementAutomationEndpointsSQL(app: Hono) {
  const BASE_PATH = "/make-server-3dd53475";
  const db = getDbClient();

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

      const scheduledAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // Schedule for next day

      // ✅ SQL: Create settlement in database
      const { data: settlement, error } = await db
        .from('settlements')
        .insert({
          id: settlementId, // Use custom ID
          vendor_id: vendorId,
          total_amount: amount,
          commission_amount: commissionAmount,
          net_amount: netAmount,
          settlement_status: 'pending',
          settlement_period_start: new Date().toISOString().split('T')[0],
          settlement_period_end: scheduledAt.toISOString().split('T')[0],
          payment_ids: [bookingId], // Store bookingId as payment_id for now
          created_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating settlement:', error);
        return sendError(c, `Failed to create settlement: ${error.message}`, 500);
      }

      // ✅ SQL: Add to pending settlements (using pending_payouts table structure or a flag)
      // For now, settlements with status 'pending' are considered pending
      
      console.log(`✅ Settlement created: ${settlementId} for vendor ${vendorId} - ₹${netAmount}`);

      return sendSuccess(c, { 
        settlement: {
          settlementId,
          vendorId,
          bookingId,
          amount,
          commission: commissionAmount,
          netAmount,
          status: 'pending',
          scheduledAt: scheduledAt.toISOString(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
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
      // ✅ SQL: Get pending settlements
      const { data: settlements, error } = await db
        .from('settlements')
        .select('*')
        .eq('settlement_status', 'pending')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching pending settlements:', error);
        return sendError(c, 'Failed to fetch pending settlements', 500);
      }

      const formattedSettlements = (settlements || []).map((s: any) => ({
        settlementId: s.id,
        vendorId: s.vendor_id,
        bookingId: s.payment_ids?.[0] || null,
        amount: Number(s.total_amount),
        commission: Number(s.commission_amount),
        netAmount: Number(s.net_amount),
        status: s.settlement_status,
        scheduledAt: s.settlement_period_end,
        createdAt: s.created_at,
        updatedAt: s.updated_at || s.created_at
      }));

      return sendSuccess(c, { 
        settlements: formattedSettlements, 
        count: formattedSettlements.length 
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

      // ✅ SQL: Get vendor settlements
      const { data: settlements, error } = await db
        .from('settlements')
        .select('*')
        .eq('vendor_id', vendorId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching vendor settlements:', error);
        return sendError(c, 'Failed to fetch vendor settlements', 500);
      }

      const formattedSettlements = (settlements || []).map((s: any) => ({
        settlementId: s.id,
        vendorId: s.vendor_id,
        bookingId: s.payment_ids?.[0] || null,
        amount: Number(s.total_amount),
        commission: Number(s.commission_amount),
        netAmount: Number(s.net_amount),
        status: s.settlement_status,
        razorpayPayoutId: s.payout_id,
        scheduledAt: s.settlement_period_end,
        processedAt: s.processed_at,
        createdAt: s.created_at,
        updatedAt: s.updated_at || s.created_at
      }));

      return sendSuccess(c, { 
        settlements: formattedSettlements, 
        count: formattedSettlements.length 
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
      const { data: settlement, error: fetchError } = await db
        .from('settlements')
        .select('*')
        .eq('id', settlementId)
        .single();

      if (fetchError || !settlement) {
        return sendError(c, 'Settlement not found', 404);
      }

      // ✅ SQL: Update settlement status
      const updateData: any = {
        settlement_status: status,
        updated_at: new Date().toISOString()
      };

      if (status === 'completed' || status === 'failed') {
        updateData.processed_at = new Date().toISOString();
      }

      if (razorpayPayoutId) {
        // Link to payout if provided
        updateData.payout_id = razorpayPayoutId;
      }

      const { data: updatedSettlement, error: updateError } = await db
        .from('settlements')
        .update(updateData)
        .eq('id', settlementId)
        .select()
        .single();

      if (updateError) {
        console.error('Error updating settlement:', updateError);
        return sendError(c, 'Failed to update settlement', 500);
      }

      console.log(`✅ Settlement status updated: ${settlementId} - ${status}`);

      return sendSuccess(c, { 
        settlement: {
          settlementId: updatedSettlement.id,
          vendorId: updatedSettlement.vendor_id,
          bookingId: updatedSettlement.payment_ids?.[0] || null,
          amount: Number(updatedSettlement.total_amount),
          commission: Number(updatedSettlement.commission_amount),
          netAmount: Number(updatedSettlement.net_amount),
          status: updatedSettlement.settlement_status,
          razorpayPayoutId: updatedSettlement.payout_id,
          scheduledAt: updatedSettlement.settlement_period_end,
          processedAt: updatedSettlement.processed_at,
          failureReason: failureReason,
          createdAt: updatedSettlement.created_at,
          updatedAt: updatedSettlement.updated_at
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
        .single();

      const scheduleData: any = {
        vendor_id: vendorId,
        schedule_type: frequency,
        is_active: true,
        created_at: existingSchedule?.created_at || new Date().toISOString()
      };

      // Set day based on frequency
      if (frequency === 'weekly') {
        scheduleData.day_of_week = new Date().getDay();
      } else if (frequency === 'monthly') {
        scheduleData.day_of_month = new Date().getDate();
      }

      const { data: schedule, error } = await db
        .from('settlement_schedules')
        .upsert(scheduleData, {
          onConflict: 'vendor_id'
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating settlement schedule:', error);
        return sendError(c, 'Failed to create settlement schedule', 500);
      }

      console.log(`✅ Auto-settlement scheduled for vendor ${vendorId}: ${frequency}`);

      return sendSuccess(c, { 
        schedule: {
          vendorId: schedule.vendor_id,
          frequency: schedule.schedule_type,
          nextSettlementDate,
          isActive: schedule.is_active,
          createdAt: schedule.created_at
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
