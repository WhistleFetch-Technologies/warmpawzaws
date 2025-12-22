/**
 * ============================================================================
 * SETTLEMENT SERVICE - IDEMPOTENT
 * ============================================================================
 * 
 * Settlement processing with idempotency and refund exclusion
 * 
 * Date: 2025-01-27
 * ============================================================================
 */

import { getDbClient } from "../db.ts";

export interface SettlementResult {
  settlementId: string;
  vendorId: string;
  totalAmount: number;
  commissionAmount: number;
  netAmount: number;
  bookingCount: number;
  alreadySettled: boolean;
}

/**
 * Calculate and create settlement for vendor
 * Excludes refunded bookings automatically
 */
export async function calculateSettlement(
  vendorId: string,
  periodStart: Date,
  periodEnd: Date,
  holdPeriodDays: number = 7
): Promise<SettlementResult | null> {
  const client = getDbClient();
  
  // Calculate cutoff date (hold period)
  const cutoffDate = new Date(periodEnd);
  cutoffDate.setDate(cutoffDate.getDate() - holdPeriodDays);
  
  // Get completed bookings that passed hold period
  // Exclude refunded bookings
  const { data: bookings, error: bookingsError } = await client
    .from('bookings')
    .select(`
      id,
      total_amount,
      payment_id,
      payments!inner (
        id,
        amount,
        platform_commission,
        vendor_amount,
        commission_rate,
        payment_status
      )
    `)
    .eq('vendor_id', vendorId)
    .eq('status', 'completed')
    .neq('payment_status', 'refunded')
    .neq('payment_status', 'partially_refunded')
    .gte('completed_at', periodStart.toISOString())
    .lte('completed_at', periodEnd.toISOString())
    .lte('completed_at', cutoffDate.toISOString());
  
  if (bookingsError) {
    throw new Error(`Failed to fetch bookings: ${bookingsError.message}`);
  }
  
  if (!bookings || bookings.length === 0) {
    return null; // No bookings to settle
  }
  
  // Check which bookings are already settled
  const bookingIds = bookings.map((b: any) => b.id);
  const { data: settledBookings } = await client
    .from('settlement_booking_mappings')
    .select('booking_id')
    .in('booking_id', bookingIds);
  
  const settledBookingIds = new Set(settledBookings?.map((sb: any) => sb.booking_id) || []);
  
  // Filter out already settled bookings
  const eligibleBookings = bookings.filter((b: any) => !settledBookingIds.has(b.id));
  
  if (eligibleBookings.length === 0) {
    // All bookings already settled
    return {
      settlementId: '',
      vendorId,
      totalAmount: 0,
      commissionAmount: 0,
      netAmount: 0,
      bookingCount: 0,
      alreadySettled: true
    };
  }
  
  // Calculate totals
  let totalAmount = 0;
  let commissionAmount = 0;
  let netAmount = 0;
  const paymentIds: string[] = [];
  
  for (const booking of eligibleBookings) {
    const payment = booking.payments;
    if (payment && payment.payment_status === 'completed') {
      totalAmount += parseFloat(payment.amount || 0);
      commissionAmount += parseFloat(payment.platform_commission || 0);
      netAmount += parseFloat(payment.vendor_amount || 0);
      paymentIds.push(payment.id);
    }
  }
  
  // Check minimum payout
  const { data: payoutRule } = await client
    .from('payout_rules')
    .select('min_payout_amount')
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();
  
  const minPayout = payoutRule?.min_payout_amount || 1000;
  if (netAmount < minPayout) {
    return null; // Below minimum payout
  }
  
  // Create settlement with idempotency
  const { data: settlement, error: settlementError } = await client
    .rpc('create_settlement', {
      p_vendor_id: vendorId,
      p_period_start: periodStart.toISOString().split('T')[0],
      p_period_end: periodEnd.toISOString().split('T')[0],
      p_payment_ids: paymentIds,
      p_total_amount: totalAmount,
      p_commission_amount: commissionAmount,
      p_net_amount: netAmount
    });
  
  if (settlementError) {
    throw new Error(`Failed to create settlement: ${settlementError.message}`);
  }
  
  return {
    settlementId: settlement,
    vendorId,
    totalAmount,
    commissionAmount,
    netAmount,
    bookingCount: eligibleBookings.length,
    alreadySettled: false
  };
}

/**
 * Get vendor settlements
 */
export async function getVendorSettlements(
  vendorId: string,
  limit: number = 50,
  offset: number = 0
) {
  const client = getDbClient();
  
  const { data: settlements, error } = await client
    .from('settlements')
    .select('*')
    .eq('vendor_id', vendorId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);
  
  if (error) {
    throw new Error(`Failed to fetch settlements: ${error.message}`);
  }
  
  return settlements || [];
}

