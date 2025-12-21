import { Hono } from "npm:hono";
import { sendSuccess, sendError } from "./response-utils.ts";

/**
 * 💰 RAZORPAY MARKETPLACE SETTLEMENT SYSTEM
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
 */

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

export function marketplaceSettlementEnhanced(app: Hono, kv: any) {
  const BASE_PATH = "/make-server-3dd53475";

  /**
   * Get or create vendor account
   */
  async function getVendorAccount(vendorId: string): Promise<VendorAccount> {
    let account = await kv.get(`vendor:${vendorId}:account`);
    
    if (!account) {
      account = {
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
      
      await kv.set(`vendor:${vendorId}:account`, account);
    }
    
    return account;
  }

  /**
   * Create Razorpay linked account for vendor
   */
  async function createRazorpayAccount(vendorId: string, bankDetails: any) {
    try {
      // Get Razorpay credentials from platform settings
      const platformSettings = await kv.get('platform_settings') || {};
      const razorpayConfig = platformSettings.razorpay || {};
      
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
      const platformSettings = await kv.get('platform_settings') || {};
      const razorpayConfig = platformSettings.razorpay || {};
      
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
    // Get all bookings for the period
    const allBookings = await kv.getByPrefix('booking:') || [];
    
    const vendorBookings = allBookings
      .map((item: any) => item.value || item)
      .filter((b: any) => {
        if (b.vendorId !== vendorId) return false;
        if (b.status !== 'completed') return false;
        
        const bookingMonth = new Date(b.completedAt || b.createdAt).toISOString().substr(0, 7);
        return bookingMonth === period;
      });

    // Get vendor tier for commission calculation
    const tierData = await kv.get(`vendor:${vendorId}:tier`) || {
      currentTier: 'bronze',
      commissionRate: 5.0
    };

    // Calculate totals
    let totalRevenue = 0;
    let totalCommission = 0;
    const bookingBreakdown = [];

    for (const booking of vendorBookings) {
      const amount = booking.totalAmount || 0;
      const commission = (amount * tierData.commissionRate) / 100;
      const earnings = amount - commission;

      totalRevenue += amount;
      totalCommission += commission;

      bookingBreakdown.push({
        bookingId: booking.id,
        amount,
        commission,
        earnings,
        date: booking.completedAt || booking.createdAt
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
      tier: tierData.currentTier,
      commissionRate: tierData.commissionRate,
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

      const platformSettings = await kv.get('platform_settings') || {};
      const razorpayConfig = platformSettings.razorpay || {};
      
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
      
      // Update settlement
      settlement.status = 'completed';
      settlement.processedDate = new Date().toISOString();
      settlement.transferId = transfer.id;
      settlement.updatedAt = new Date().toISOString();

      await kv.set(`settlement:${settlement.id}`, settlement);

      // Update vendor account
      account.totalSettlements++;
      account.totalEarnings += settlement.totalEarnings;
      account.pendingAmount -= settlement.totalEarnings;
      account.updatedAt = new Date().toISOString();
      
      await kv.set(`vendor:${settlement.vendorId}:account`, account);

      console.log(`✅ Settlement processed: ${settlement.id}, Amount: ₹${settlement.totalEarnings}`);

      return transfer;

    } catch (error) {
      console.error('❌ Error processing settlement:', error);
      
      settlement.status = 'failed';
      settlement.notes = (settlement.notes || '') + '\n' + error.message;
      settlement.updatedAt = new Date().toISOString();
      
      await kv.set(`settlement:${settlement.id}`, settlement);
      
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

      await kv.set(`vendor:${vendorId}:account`, account);

      // Verify bank account
      await verifyBankAccount(razorpayAccountId, bankDetails);

      account.verified = true;
      account.verifiedAt = new Date().toISOString();
      await kv.set(`vendor:${vendorId}:account`, account);

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

      const allSettlements = await kv.getByPrefix('settlement:') || [];

      const settlements = allSettlements
        .map((item: any) => item.value || item)
        .filter((s: any) => {
          if (s.vendorId !== vendorId) return false;
          if (status && s.status !== status) return false;
          if (period && s.period !== period) return false;
          return true;
        })
        .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      return sendSuccess(c, { settlements, total: settlements.length });

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
      const tierData = await kv.get(`vendor:${vendorId}:tier`) || {};

      // Get current month settlement
      const currentPeriod = new Date().toISOString().substr(0, 7);
      const currentSettlement = await calculateSettlement(vendorId, currentPeriod);

      // Get recent settlements
      const allSettlements = await kv.getByPrefix('settlement:') || [];
      const recentSettlements = allSettlements
        .map((item: any) => item.value || item)
        .filter((s: any) => s.vendorId === vendorId)
        .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 6);

      const earnings = {
        account,
        tier: {
          current: tierData.currentTier || 'bronze',
          commissionRate: tierData.commissionRate || 5.0
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
        recentSettlements
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
      const allSettlements = await kv.getByPrefix('settlement:') || [];

      const pendingSettlements = allSettlements
        .map((item: any) => item.value || item)
        .filter((s: any) => s.status === 'pending')
        .sort((a: any, b: any) => new Date(a.scheduledDate).getTime() - new Date(b.scheduledDate).getTime());

      return sendSuccess(c, { settlements: pendingSettlements, total: pendingSettlements.length });

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

      const settlement = await kv.get(`settlement:${settlementId}`);

      if (!settlement) {
        return sendError(c, 'Settlement not found', 404);
      }

      if (settlement.status !== 'pending') {
        return sendError(c, 'Settlement already processed', 400);
      }

      settlement.status = 'processing';
      await kv.set(`settlement:${settlementId}`, settlement);

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
      const allSettlements = await kv.getByPrefix('settlement:') || [];
      
      const settlements = allSettlements.map((item: any) => item.value || item);

      const analytics = {
        total: settlements.length,
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

      settlements.forEach((s: any) => {
        analytics.byStatus[s.status as keyof typeof analytics.byStatus]++;
        analytics.totalRevenue += s.totalRevenue || 0;
        analytics.totalCommission += s.totalCommission || 0;
        
        if (s.status === 'completed') {
          analytics.totalPayouts += s.totalEarnings || 0;
        }
        
        analytics.averageCommissionRate += s.commissionRate || 0;
      });

      if (settlements.length > 0) {
        analytics.averageCommissionRate /= settlements.length;
      }

      return sendSuccess(c, { analytics });

    } catch (error) {
      console.error('❌ Error fetching analytics:', error);
      return sendError(c, error, 500);
    }
  });

  console.log('✅ Marketplace Settlement Enhanced registered');
}
