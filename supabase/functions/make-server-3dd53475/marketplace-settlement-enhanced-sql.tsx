/**
 * ============================================================================
 * RAZORPAY MARKETPLACE SETTLEMENT SYSTEM - SQL-ONLY VERSION
 * ============================================================================
 * 
 * REFACTORED: Removed all KV usage, using SQL repositories only
 * 
 * Complete marketplace payment settlement with commission calculation
 * 
 * Features:
 * - Razorpay marketplace mode (route payments)
 * - Automated commission deduction (integrated with tier system)
 * - Settlement scheduling and automation
 * - Payout management
 * - Transaction reconciliation
 * - Vendor earnings dashboard
 * 
 * CHANGES:
 * - Removed `kv` parameter from function signature
 * - Replaced all `kv.get()`, `kv.set()`, `kv.getByPrefix()` with repository calls
 * - Settlements stored in `settlements` table
 * - Vendor account info stored in `vendors.metadata` JSONB field
 * - Platform settings from `platform_settings` table
 * - Bookings from `bookings` table
 * 
 * Date: 2025-01-27
 * Migration: Phase 2 - KV to SQL Migration
 * ============================================================================
 */

import { Hono } from "npm:hono";
import { sendSuccess, sendError } from "./response-utils.ts";
import { getSettlementsRepository } from '../../lib/repositories/settlements.ts';
import { getPayoutsRepository } from '../../lib/repositories/payouts.ts';
import { getBookingsRepository } from '../../lib/repositories/bookings.ts';
import { getVendorsRepository } from '../../lib/repositories/vendors.ts';
import { getPlatformSettingsRepository } from '../../lib/repositories/platform-settings.ts';
import { getDbClient } from '../../lib/db.ts';

interface Settlement {
  id: string;
  vendorId: string;
  period: string; // YYYY-MM
  
  // Financials
  totalBookings: number;
  totalRevenue: number;
  totalCommission: number;
  totalEarnings: number;
  
  // Tier info
  tier: string;
  commissionRate: number;
  
  // Settlement
  status: 'pending' | 'processing' | 'completed' | 'failed';
  scheduledDate: string;
  processedDate?: string;
  
  // Razorpay
  transferId?: string;
  accountId?: string;
  
  // Breakdown
  bookings: {
    bookingId: string;
    amount: number;
    commission: number;
    earnings: number;
    date: string;
  }[];
  
  // Notes
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

interface VendorAccount {
  vendorId: string;
  razorpayAccountId?: string;
  accountStatus: 'pending' | 'active' | 'suspended';
  
  // Bank details
  bankName?: string;
  accountNumber?: string;
  ifscCode?: string;
  accountHolderName?: string;
  
  // Verification
  verified: boolean;
  verifiedAt?: string;
  
  // Settlement config
  settlementSchedule: 'daily' | 'weekly' | 'monthly';
  minimumSettlement: number;
  
  // Stats
  totalSettlements: number;
  totalEarnings: number;
  pendingAmount: number;
  
  createdAt: string;
  updatedAt: string;
}

export function marketplaceSettlementEnhanced(app: Hono) {
  const BASE_PATH = "/make-server-3dd53475";
  const settlementsRepo = getSettlementsRepository();
  const payoutsRepo = getPayoutsRepository();
  const bookingsRepo = getBookingsRepository();
  const vendorsRepo = getVendorsRepository();
  const platformSettingsRepo = getPlatformSettingsRepository();
  const db = getDbClient();

  /**
   * Get or create vendor account (stored in vendors.metadata)
   */
  async function getVendorAccount(vendorId: string): Promise<VendorAccount> {
    const vendor = await vendorsRepo.findById(vendorId);
    
    if (!vendor) {
      throw new Error(`Vendor not found: ${vendorId}`);
    }

    // Get account from metadata or create default
    const metadata = (vendor as any).metadata || {};
    let account: VendorAccount = metadata.account || {
      vendorId,
      accountStatus: 'pending',
      verified: false,
      settlementSchedule: 'monthly',
      minimumSettlement: 1000,
      totalSettlements: 0,
      totalEarnings: 0,
      pendingAmount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    // Ensure vendorId matches
    account.vendorId = vendorId;
    
    return account;
  }

  /**
   * Save vendor account to metadata
   */
  async function saveVendorAccount(account: VendorAccount): Promise<void> {
    const vendor = await vendorsRepo.findById(account.vendorId);
    if (!vendor) {
      throw new Error(`Vendor not found: ${account.vendorId}`);
    }

    const metadata = (vendor as any).metadata || {};
    metadata.account = account;
    
    await vendorsRepo.update(account.vendorId, {
      metadata: metadata as any
    } as any);
  }

  /**
   * Create Razorpay linked account for vendor
   */
  async function createRazorpayAccount(vendorId: string, bankDetails: any) {
    try {
      // Get Razorpay credentials from platform settings
      const { data: platformSettings } = await db
        .from('platform_settings')
        .select('setting_value')
        .eq('setting_key', 'platform_settings')
        .maybeSingle();
      
      const razorpayConfig = platformSettings?.setting_value?.razorpay || {};
      
      if (!razorpayConfig.keyId || !razorpayConfig.keySecret) {
        throw new Error('Razorpay not configured');
      }

      const auth = btoa(`${razorpayConfig.keyId}:${razorpayConfig.keySecret}`);

      // Create linked account in Razorpay
      const response = await fetch('https://api.razorpay.com/v1/accounts', {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email: bankDetails.email,
          phone: bankDetails.phone,
          type: 'route',
          legal_business_name: bankDetails.businessName,
          business_type: 'partnership',
          contact_name: bankDetails.contactName,
          profile: {
            category: 'healthcare',
            subcategory: 'veterinary'
          },
          legal_info: {
            pan: bankDetails.pan,
            gst: bankDetails.gst
          }
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(`Razorpay error: ${error.error?.description || 'Unknown error'}`);
      }

      const account = await response.json();
      return account.id;

    } catch (error) {
      console.error('❌ Error creating Razorpay account:', error);
      throw error;
    }
  }

  /**
   * Verify bank account using Razorpay
   */
  async function verifyBankAccount(accountId: string, bankDetails: any) {
    try {
      const { data: platformSettings } = await db
        .from('platform_settings')
        .select('setting_value')
        .eq('setting_key', 'platform_settings')
        .maybeSingle();
      
      const razorpayConfig = platformSettings?.setting_value?.razorpay || {};
      
      const auth = btoa(`${razorpayConfig.keyId}:${razorpayConfig.keySecret}`);

      // Add bank account to linked account
      const response = await fetch(`https://api.razorpay.com/v1/accounts/${accountId}/bank_accounts`, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ifsc_code: bankDetails.ifscCode,
          account_number: bankDetails.accountNumber,
          beneficiary_name: bankDetails.accountHolderName
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(`Bank verification error: ${error.error?.description || 'Unknown error'}`);
      }

      const result = await response.json();
      return result;

    } catch (error) {
      console.error('❌ Error verifying bank account:', error);
      throw error;
    }
  }

  /**
   * Calculate settlement for vendor
   */
  async function calculateSettlement(vendorId: string, period: string): Promise<Settlement> {
    // Get vendor for tier info
    const vendor = await vendorsRepo.findById(vendorId);
    if (!vendor) {
      throw new Error(`Vendor not found: ${vendorId}`);
    }

    // Get all completed bookings for the vendor in the period
    const [year, month] = period.split('-').map(Number);
    const periodStart = new Date(year, month - 1, 1).toISOString();
    const periodEnd = new Date(year, month, 0, 23, 59, 59).toISOString();

    const allBookings = await bookingsRepo.findByVendor(vendorId);
    
    const vendorBookings = allBookings.filter((b: any) => {
      if (b.status !== 'completed') return false;
      
      const bookingDate = new Date(b.completed_at || b.created_at);
      return bookingDate >= new Date(periodStart) && bookingDate <= new Date(periodEnd);
    });

    // Get commission rate from vendor tier
    const commissionRate = vendor.commission_percentage || 5.0;
    const tier = vendor.tier || 'Bronze';

    // Calculate totals
    let totalRevenue = 0;
    let totalCommission = 0;
    const bookingBreakdown = [];

    for (const booking of vendorBookings) {
      const amount = parseFloat(booking.total_amount?.toString() || '0');
      const commission = (amount * commissionRate) / 100;
      const earnings = amount - commission;

      totalRevenue += amount;
      totalCommission += commission;

      bookingBreakdown.push({
        bookingId: booking.id,
        amount,
        commission,
        earnings,
        date: booking.completed_at || booking.created_at
      });
    }

    const settlementId = `STL-${period}-${vendorId}`;
    
    const settlement: Settlement = {
      id: settlementId,
      vendorId,
      period,
      totalBookings: vendorBookings.length,
      totalRevenue,
      totalCommission,
      totalEarnings: totalRevenue - totalCommission,
      tier,
      commissionRate,
      status: 'pending',
      scheduledDate: getNextSettlementDate(period),
      bookings: bookingBreakdown,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    return settlement;
  }

  /**
   * Get next settlement date (1st of next month)
   */
  function getNextSettlementDate(period: string): string {
    const [year, month] = period.split('-').map(Number);
    const nextMonth = month === 12 ? 1 : month + 1;
    const nextYear = month === 12 ? year + 1 : year;
    
    return `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`;
  }

  /**
   * Process settlement payout via Razorpay
   */
  async function processSettlement(settlement: Settlement) {
    try {
      const account = await getVendorAccount(settlement.vendorId);
      
      if (!account.razorpayAccountId) {
        throw new Error('Vendor Razorpay account not configured');
      }

      if (!account.verified) {
        throw new Error('Vendor account not verified');
      }

      const { data: platformSettings } = await db
        .from('platform_settings')
        .select('setting_value')
        .eq('setting_key', 'platform_settings')
        .maybeSingle();
      
      const razorpayConfig = platformSettings?.setting_value?.razorpay || {};
      
      const auth = btoa(`${razorpayConfig.keyId}:${razorpayConfig.keySecret}`);

      // Create transfer (payout)
      const transferAmount = Math.floor(settlement.totalEarnings * 100); // Convert to paise

      const response = await fetch('https://api.razorpay.com/v1/transfers', {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          account: account.razorpayAccountId,
          amount: transferAmount,
          currency: 'INR',
          notes: {
            settlement_id: settlement.id,
            period: settlement.period,
            vendor_id: settlement.vendorId
          }
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(`Transfer error: ${error.error?.description || 'Unknown error'}`);
      }

      const transfer = await response.json();
      
      // Create settlement record in SQL
      const [year, month] = settlement.period.split('-').map(Number);
      const periodStart = new Date(year, month - 1, 1).toISOString().split('T')[0];
      const periodEnd = new Date(year, month, 0).toISOString().split('T')[0];

      const settlementRecord = await settlementsRepo.create({
        vendor_id: settlement.vendorId,
        settlement_amount: settlement.totalRevenue,
        commission_amount: settlement.totalCommission,
        vendor_amount: settlement.totalEarnings,
        razorpay_settlement_id: transfer.id
      });

      // Update settlement status
      await settlementsRepo.update(settlementRecord.id, {
        settlement_status: 'completed',
        completed_at: new Date().toISOString()
      });

      // Update vendor account stats
      account.totalSettlements++;
      account.totalEarnings += settlement.totalEarnings;
      account.pendingAmount -= settlement.totalEarnings;
      account.updatedAt = new Date().toISOString();
      
      await saveVendorAccount(account);

      console.log(`✅ Settlement processed: ${settlement.id}, Amount: ₹${settlement.totalEarnings}`);

      return transfer;

    } catch (error: any) {
      console.error('❌ Error processing settlement:', error);
      
      // Try to save failed settlement if we have an ID
      if (settlement.id) {
        try {
          const existing = await settlementsRepo.findById(settlement.id);
          if (existing) {
            await settlementsRepo.update(settlement.id, {
              settlement_status: 'failed'
            });
          }
        } catch (e) {
          // Ignore errors updating failed settlement
        }
      }
      
      throw error;
    }
  }

  // ============================================
  // VENDOR ENDPOINTS
  // ============================================

  /**
   * GET /vendor/:vendorId/account
   * Get vendor payment account details
   */
  app.get(`${BASE_PATH}/vendor/:vendorId/account`, async (c) => {
    try {
      const { vendorId } = c.req.param();

      const account = await getVendorAccount(vendorId);

      return sendSuccess(c, { account });

    } catch (error) {
      console.error('❌ Error fetching vendor account:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * POST /vendor/:vendorId/account/setup
   * Setup vendor payment account
   */
  app.post(`${BASE_PATH}/vendor/:vendorId/account/setup`, async (c) => {
    try {
      const { vendorId } = c.req.param();
      const bankDetails = await c.req.json();

      console.log(`💰 Setting up payment account for vendor ${vendorId}`);

      // Create or update account
      const account = await getVendorAccount(vendorId);

      // Create Razorpay linked account
      const razorpayAccountId = await createRazorpayAccount(vendorId, bankDetails);

      // Update account
      account.razorpayAccountId = razorpayAccountId;
      account.bankName = bankDetails.bankName;
      account.accountNumber = bankDetails.accountNumber;
      account.ifscCode = bankDetails.ifscCode;
      account.accountHolderName = bankDetails.accountHolderName;
      account.accountStatus = 'active';
      account.updatedAt = new Date().toISOString();

      await saveVendorAccount(account);

      // Verify bank account
      await verifyBankAccount(razorpayAccountId, bankDetails);

      account.verified = true;
      account.verifiedAt = new Date().toISOString();
      await saveVendorAccount(account);

      console.log(`✅ Payment account setup complete for vendor ${vendorId}`);

      return sendSuccess(c, { account, message: 'Payment account setup successfully' });

    } catch (error) {
      console.error('❌ Error setting up account:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * GET /vendor/:vendorId/settlements
   * Get vendor settlements
   */
  app.get(`${BASE_PATH}/vendor/:vendorId/settlements`, async (c) => {
    try {
      const { vendorId } = c.req.param();
      const { status, period } = c.req.query();

      const settlements = await settlementsRepo.findByVendor(vendorId);

      let filtered = settlements.filter((s: any) => {
        if (status && s.settlement_status !== status) return false;
        // Period filtering would need to check settlement_period_start/end
        return true;
      });

      // Convert to Settlement interface format
      const formatted = filtered.map((s: any) => ({
        id: s.id,
        vendorId: s.vendor_id,
        period: s.settlement_date?.substr(0, 7) || '',
        totalBookings: 0, // Would need to count from bookings
        totalRevenue: s.settlement_amount,
        totalCommission: s.commission_amount,
        totalEarnings: s.vendor_amount,
        tier: '', // Would need to get from vendor
        commissionRate: 0,
        status: s.settlement_status,
        scheduledDate: s.settlement_date || '',
        processedDate: s.processed_at || undefined,
        transferId: s.razorpay_settlement_id || undefined,
        bookings: [],
        createdAt: s.created_at,
        updatedAt: s.updated_at || s.created_at
      }));

      return sendSuccess(c, { settlements: formatted, total: formatted.length });

    } catch (error) {
      console.error('❌ Error fetching settlements:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * GET /vendor/:vendorId/settlements/current
   * Get current month settlement (pending)
   */
  app.get(`${BASE_PATH}/vendor/:vendorId/settlements/current`, async (c) => {
    try {
      const { vendorId } = c.req.param();

      const currentPeriod = new Date().toISOString().substr(0, 7); // YYYY-MM
      
      const settlement = await calculateSettlement(vendorId, currentPeriod);

      return sendSuccess(c, { settlement });

    } catch (error) {
      console.error('❌ Error calculating current settlement:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * GET /vendor/:vendorId/earnings
   * Get vendor earnings dashboard
   */
  app.get(`${BASE_PATH}/vendor/:vendorId/earnings`, async (c) => {
    try {
      const { vendorId } = c.req.param();

      const account = await getVendorAccount(vendorId);
      const vendor = await vendorsRepo.findById(vendorId);
      
      if (!vendor) {
        return sendError(c, 'Vendor not found', 404);
      }

      // Get current month settlement
      const currentPeriod = new Date().toISOString().substr(0, 7);
      const currentSettlement = await calculateSettlement(vendorId, currentPeriod);

      // Get recent settlements
      const recentSettlements = await settlementsRepo.findByVendor(vendorId, { limit: 6 });

      const earnings = {
        account,
        tier: {
          current: vendor.tier || 'Bronze',
          commissionRate: vendor.commission_percentage || 5.0
        },
        currentMonth: {
          period: currentPeriod,
          totalBookings: currentSettlement.totalBookings,
          totalRevenue: currentSettlement.totalRevenue,
          totalCommission: currentSettlement.totalCommission,
          totalEarnings: currentSettlement.totalEarnings
        },
        lifetime: {
          totalSettlements: account.totalSettlements,
          totalEarnings: account.totalEarnings,
          pendingAmount: account.pendingAmount
        },
        recentSettlements: recentSettlements.map((s: any) => ({
          id: s.id,
          period: s.settlement_date?.substr(0, 7) || '',
          totalEarnings: s.vendor_amount,
          status: s.settlement_status,
          createdAt: s.created_at
        }))
      };

      return sendSuccess(c, { earnings });

    } catch (error) {
      console.error('❌ Error fetching earnings:', error);
      return sendError(c, error, 500);
    }
  });

  // ============================================
  // ADMIN ENDPOINTS
  // ============================================

  /**
   * GET /admin/settlements/pending
   * Get all pending settlements
   */
  app.get(`${BASE_PATH}/admin/settlements/pending`, async (c) => {
    try {
      const { data: settlements, error } = await db
        .from('settlements')
        .select('*')
        .eq('settlement_status', 'pending')
        .order('settlement_period_start', { ascending: true });

      if (error) throw error;

      const formatted = (settlements || []).map((s: any) => ({
        id: s.id,
        vendorId: s.vendor_id,
        period: s.settlement_period_start?.substr(0, 7) || '',
        totalRevenue: parseFloat(s.total_amount?.toString() || '0'),
        totalCommission: parseFloat(s.commission_amount?.toString() || '0'),
        totalEarnings: parseFloat(s.net_amount?.toString() || '0'),
        status: s.settlement_status,
        scheduledDate: s.settlement_period_end || '',
        createdAt: s.created_at
      }));

      return sendSuccess(c, { settlements: formatted, total: formatted.length });

    } catch (error) {
      console.error('❌ Error fetching pending settlements:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * POST /admin/settlements/:settlementId/process
   * Process settlement manually
   */
  app.post(`${BASE_PATH}/admin/settlements/:settlementId/process`, async (c) => {
    try {
      const { settlementId } = c.req.param();

      const settlementRecord = await settlementsRepo.findById(settlementId);

      if (!settlementRecord) {
        return sendError(c, 'Settlement not found', 404);
      }

      if (settlementRecord.settlement_status !== 'pending') {
        return sendError(c, 'Settlement already processed', 400);
      }

      // Update status to processing
      await settlementsRepo.update(settlementId, {
        settlement_status: 'processing'
      });

      // Convert to Settlement format for processing
      const vendor = await vendorsRepo.findById(settlementRecord.vendor_id);
      const settlement: Settlement = {
        id: settlementId,
        vendorId: settlementRecord.vendor_id,
        period: settlementRecord.settlement_date?.substr(0, 7) || '',
        totalBookings: 0,
        totalRevenue: settlementRecord.settlement_amount,
        totalCommission: settlementRecord.commission_amount,
        totalEarnings: settlementRecord.vendor_amount,
        tier: vendor?.tier || 'Bronze',
        commissionRate: vendor?.commission_percentage || 5.0,
        status: 'processing',
        scheduledDate: settlementRecord.settlement_date || '',
        bookings: [],
        createdAt: settlementRecord.created_at,
        updatedAt: settlementRecord.created_at
      };

      // Process payout
      await processSettlement(settlement);

      return sendSuccess(c, { settlement, message: 'Settlement processed successfully' });

    } catch (error) {
      console.error('❌ Error processing settlement:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * GET /admin/settlements/analytics
   * Get settlement analytics
   */
  app.get(`${BASE_PATH}/admin/settlements/analytics`, async (c) => {
    try {
      const { data: settlements, error } = await db
        .from('settlements')
        .select('*');

      if (error) throw error;

      const analytics = {
        total: settlements?.length || 0,
        byStatus: {
          pending: 0,
          processing: 0,
          completed: 0,
          failed: 0
        },
        totalRevenue: 0,
        totalCommission: 0,
        totalPayouts: 0,
        averageCommissionRate: 0
      };

      (settlements || []).forEach((s: any) => {
        const status = s.settlement_status;
        if (status in analytics.byStatus) {
          analytics.byStatus[status as keyof typeof analytics.byStatus]++;
        }
        
        analytics.totalRevenue += parseFloat(s.total_amount?.toString() || '0');
        analytics.totalCommission += parseFloat(s.commission_amount?.toString() || '0');
        
        if (status === 'completed') {
          analytics.totalPayouts += parseFloat(s.net_amount?.toString() || '0');
        }
      });

      if (settlements && settlements.length > 0) {
        // Calculate average commission rate from vendor data
        const vendorIds = [...new Set(settlements.map((s: any) => s.vendor_id))];
        let totalRate = 0;
        for (const vendorId of vendorIds) {
          const vendor = await vendorsRepo.findById(vendorId);
          if (vendor) {
            totalRate += vendor.commission_percentage || 0;
          }
        }
        analytics.averageCommissionRate = vendorIds.length > 0 ? totalRate / vendorIds.length : 0;
      }

      return sendSuccess(c, { analytics });

    } catch (error) {
      console.error('❌ Error fetching analytics:', error);
      return sendError(c, error, 500);
    }
  });

  console.log('✅ Marketplace Settlement Enhanced (SQL-only) registered');
}

