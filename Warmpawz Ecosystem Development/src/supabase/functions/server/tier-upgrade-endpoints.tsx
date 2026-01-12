import { Hono } from "npm:hono";
import { sendSuccess, sendError } from "./response-utils.ts";

/**
 * ⭐ TIER UPGRADE ENDPOINTS
 * 
 * Complete vendor tier system with upgrade flow
 * 
 * Features:
 * - Multiple tier levels (Free, Basic, Pro, Enterprise)
 * - Feature-based restrictions
 * - Upgrade/downgrade flow
 * - Payment integration
 * - Trial periods
 * - Usage tracking
 * - Benefits visualization
 * - Auto-renewal
 */

interface TierPlan {
  tierId: string;
  tierName: string;
  tierLevel: number; // 0=Free, 1=Basic, 2=Pro, 3=Enterprise
  pricing: {
    monthly: number;
    annual: number;
    currency: string;
    annualDiscount: number; // percentage
  };
  features: {
    maxStaff: number;
    maxServices: number;
    maxProducts: number;
    maxPhotos: number;
    bookingsPerMonth: number;
    videoConsultation: boolean;
    advancedAnalytics: boolean;
    prioritySupport: boolean;
    customBranding: boolean;
    apiAccess: boolean;
    multiLocation: boolean;
    bulkOperations: boolean;
    dedicatedManager: boolean;
    whiteLabel: boolean;
  };
  highlights: string[];
  restrictions: string[];
  billingCycle: 'monthly' | 'annual';
  trialDays?: number;
  isPopular: boolean;
  isActive: boolean;
  createdAt: string;
}

interface VendorSubscription {
  subscriptionId: string;
  vendorId: string;
  tierId: string;
  tierName: string;
  tierLevel: number;
  status: 'trial' | 'active' | 'expired' | 'cancelled' | 'past_due';
  billingCycle: 'monthly' | 'annual';
  pricing: {
    amount: number;
    currency: string;
  };
  paymentMethod?: {
    type: 'card' | 'upi' | 'bank_transfer';
    last4?: string;
  };
  startDate: string;
  endDate: string;
  nextBillingDate?: string;
  trialEndsAt?: string;
  cancelledAt?: string;
  cancellationReason?: string;
  autoRenew: boolean;
  usage: {
    staff: number;
    services: number;
    products: number;
    photos: number;
    bookingsThisMonth: number;
  };
  paymentHistory: Array<{
    paymentId: string;
    amount: number;
    date: string;
    status: 'success' | 'failed';
    invoiceUrl?: string;
  }>;
  createdAt: string;
  updatedAt: string;
}

interface UpgradeRequest {
  requestId: string;
  vendorId: string;
  currentTierId: string;
  requestedTierId: string;
  requestedTierName: string;
  billingCycle: 'monthly' | 'annual';
  amount: number;
  status: 'pending' | 'payment_pending' | 'approved' | 'rejected' | 'completed';
  paymentId?: string;
  razorpayOrderId?: string;
  razorpayPaymentId?: string;
  approvedBy?: string;
  approvedAt?: string;
  rejectionReason?: string;
  createdAt: string;
  completedAt?: string;
}

// Default tier plans
const DEFAULT_TIERS: TierPlan[] = [
  {
    tierId: 'free',
    tierName: 'Free',
    tierLevel: 0,
    pricing: {
      monthly: 0,
      annual: 0,
      currency: 'INR',
      annualDiscount: 0
    },
    features: {
      maxStaff: 2,
      maxServices: 5,
      maxProducts: 10,
      maxPhotos: 10,
      bookingsPerMonth: 50,
      videoConsultation: false,
      advancedAnalytics: false,
      prioritySupport: false,
      customBranding: false,
      apiAccess: false,
      multiLocation: false,
      bulkOperations: false,
      dedicatedManager: false,
      whiteLabel: false
    },
    highlights: [
      'Up to 2 staff members',
      '5 services',
      '50 bookings/month',
      'Basic analytics',
      'Community support'
    ],
    restrictions: [
      'No video consultation',
      'Limited analytics',
      'Warmpawz branding'
    ],
    billingCycle: 'monthly',
    trialDays: 0,
    isPopular: false,
    isActive: true,
    createdAt: new Date().toISOString()
  },
  {
    tierId: 'basic',
    tierName: 'Basic',
    tierLevel: 1,
    pricing: {
      monthly: 999,
      annual: 9990,
      currency: 'INR',
      annualDiscount: 17
    },
    features: {
      maxStaff: 5,
      maxServices: 20,
      maxProducts: 50,
      maxPhotos: 50,
      bookingsPerMonth: 200,
      videoConsultation: true,
      advancedAnalytics: false,
      prioritySupport: false,
      customBranding: false,
      apiAccess: false,
      multiLocation: false,
      bulkOperations: false,
      dedicatedManager: false,
      whiteLabel: false
    },
    highlights: [
      'Up to 5 staff members',
      '20 services',
      '200 bookings/month',
      'Video consultation',
      'Email support'
    ],
    restrictions: [
      'No advanced analytics',
      'Single location only'
    ],
    billingCycle: 'monthly',
    trialDays: 14,
    isPopular: false,
    isActive: true,
    createdAt: new Date().toISOString()
  },
  {
    tierId: 'pro',
    tierName: 'Pro',
    tierLevel: 2,
    pricing: {
      monthly: 2999,
      annual: 29990,
      currency: 'INR',
      annualDiscount: 17
    },
    features: {
      maxStaff: 20,
      maxServices: 100,
      maxProducts: 200,
      maxPhotos: 200,
      bookingsPerMonth: 1000,
      videoConsultation: true,
      advancedAnalytics: true,
      prioritySupport: true,
      customBranding: true,
      apiAccess: true,
      multiLocation: true,
      bulkOperations: true,
      dedicatedManager: false,
      whiteLabel: false
    },
    highlights: [
      'Up to 20 staff members',
      '100 services',
      '1000 bookings/month',
      'Advanced analytics',
      'Priority support',
      'Custom branding',
      'API access',
      'Multi-location support'
    ],
    restrictions: [],
    billingCycle: 'monthly',
    trialDays: 14,
    isPopular: true,
    isActive: true,
    createdAt: new Date().toISOString()
  },
  {
    tierId: 'enterprise',
    tierName: 'Enterprise',
    tierLevel: 3,
    pricing: {
      monthly: 9999,
      annual: 99990,
      currency: 'INR',
      annualDiscount: 17
    },
    features: {
      maxStaff: -1, // Unlimited
      maxServices: -1,
      maxProducts: -1,
      maxPhotos: -1,
      bookingsPerMonth: -1,
      videoConsultation: true,
      advancedAnalytics: true,
      prioritySupport: true,
      customBranding: true,
      apiAccess: true,
      multiLocation: true,
      bulkOperations: true,
      dedicatedManager: true,
      whiteLabel: true
    },
    highlights: [
      'Unlimited everything',
      'White-label solution',
      'Dedicated account manager',
      '24/7 priority support',
      'Custom integrations',
      'SLA guarantee'
    ],
    restrictions: [],
    billingCycle: 'monthly',
    trialDays: 30,
    isPopular: false,
    isActive: true,
    createdAt: new Date().toISOString()
  }
];

// Initialize default tiers
async function ensureDefaultTiers(kv: any) {
  for (const tier of DEFAULT_TIERS) {
    const existing = await kv.get(`tier:plan:${tier.tierId}`);
    if (!existing) {
      await kv.set(`tier:plan:${tier.tierId}`, tier);
      console.log(`✅ Default tier created: ${tier.tierName}`);
    }
  }
}

export function tierUpgradeEndpoints(app: Hono, kv: any) {
  const BASE_PATH = "/make-server-3dd53475";

  // Initialize tiers on first call
  let tiersInitialized = false;

  /**
   * GET /tier/plans
   * Get all tier plans
   */
  app.get(`${BASE_PATH}/tier/plans`, async (c) => {
    try {
      if (!tiersInitialized) {
        await ensureDefaultTiers(kv);
        tiersInitialized = true;
      }

      const allTiers = await kv.getByPrefix('tier:plan:') || [];
      
      const plans = allTiers
        .map((item: any) => item.value || item)
        .filter((tier: any) => tier.isActive)
        .sort((a: any, b: any) => a.tierLevel - b.tierLevel);

      return sendSuccess(c, {
        count: plans.length,
        plans
      });

    } catch (error) {
      console.error('❌ Error fetching tier plans:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * GET /tier/subscription/vendor/:vendorId
   * Get vendor's subscription
   */
  app.get(`${BASE_PATH}/tier/subscription/vendor/:vendorId`, async (c) => {
    try {
      const { vendorId } = c.req.param();

      const allSubscriptions = await kv.getByPrefix('tier:subscription:') || [];
      
      const subscription = allSubscriptions
        .map((item: any) => item.value || item)
        .find((sub: any) => sub.vendorId === vendorId && 
          ['trial', 'active'].includes(sub.status));

      if (!subscription) {
        // Return free tier by default
        const freeTier = await kv.get('tier:plan:free');
        
        return sendSuccess(c, {
          vendorId,
          subscription: {
            tierId: 'free',
            tierName: 'Free',
            tierLevel: 0,
            status: 'active',
            features: freeTier?.features || DEFAULT_TIERS[0].features
          }
        });
      }

      // Get tier details
      const tier = await kv.get(`tier:plan:${subscription.tierId}`);

      return sendSuccess(c, {
        vendorId,
        subscription: {
          ...subscription,
          tierDetails: tier
        }
      });

    } catch (error) {
      console.error('❌ Error fetching subscription:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * POST /tier/upgrade/request
   * Request tier upgrade
   */
  app.post(`${BASE_PATH}/tier/upgrade/request`, async (c) => {
    try {
      const body = await c.req.json();
      const { vendorId, requestedTierId, billingCycle = 'monthly' } = body;

      if (!vendorId || !requestedTierId) {
        return sendError(c, 'Missing required fields', 400);
      }

      const tier = await kv.get(`tier:plan:${requestedTierId}`);
      
      if (!tier) {
        return sendError(c, 'Tier plan not found', 404);
      }

      if (requestedTierId === 'free') {
        return sendError(c, 'Cannot upgrade to free tier', 400);
      }

      const amount = billingCycle === 'annual' ? tier.pricing.annual : tier.pricing.monthly;

      const requestId = `UPG-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

      const request: UpgradeRequest = {
        requestId,
        vendorId,
        currentTierId: 'free', // Get from current subscription
        requestedTierId,
        requestedTierName: tier.tierName,
        billingCycle,
        amount,
        status: 'pending',
        createdAt: new Date().toISOString()
      };

      await kv.set(`tier:upgrade:${requestId}`, request);

      console.log(`✅ Tier upgrade requested: ${requestId}`);

      return sendSuccess(c, {
        request: {
          requestId,
          tierName: tier.tierName,
          amount,
          billingCycle,
          status: 'pending'
        }
      }, 'Upgrade request created successfully');

    } catch (error) {
      console.error('❌ Error creating upgrade request:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * POST /tier/upgrade/:requestId/complete
   * Complete upgrade after payment
   */
  app.post(`${BASE_PATH}/tier/upgrade/:requestId/complete`, async (c) => {
    try {
      const { requestId } = c.req.param();
      const { paymentId, razorpayOrderId, razorpayPaymentId } = await c.req.json();

      const request = await kv.get(`tier:upgrade:${requestId}`);
      
      if (!request) {
        return sendError(c, 'Upgrade request not found', 404);
      }

      if (request.status !== 'pending') {
        return sendError(c, 'Request already processed', 400);
      }

      // Get tier details
      const tier = await kv.get(`tier:plan:${request.requestedTierId}`);

      const subscriptionId = `SUB-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

      const startDate = new Date();
      const endDate = new Date(startDate);
      
      if (request.billingCycle === 'annual') {
        endDate.setFullYear(endDate.getFullYear() + 1);
      } else {
        endDate.setMonth(endDate.getMonth() + 1);
      }

      const subscription: VendorSubscription = {
        subscriptionId,
        vendorId: request.vendorId,
        tierId: request.requestedTierId,
        tierName: tier.tierName,
        tierLevel: tier.tierLevel,
        status: tier.trialDays ? 'trial' : 'active',
        billingCycle: request.billingCycle,
        pricing: {
          amount: request.amount,
          currency: tier.pricing.currency
        },
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        nextBillingDate: endDate.toISOString(),
        trialEndsAt: tier.trialDays 
          ? new Date(startDate.getTime() + tier.trialDays * 24 * 60 * 60 * 1000).toISOString()
          : undefined,
        autoRenew: true,
        usage: {
          staff: 0,
          services: 0,
          products: 0,
          photos: 0,
          bookingsThisMonth: 0
        },
        paymentHistory: paymentId ? [{
          paymentId,
          amount: request.amount,
          date: new Date().toISOString(),
          status: 'success'
        }] : [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await kv.set(`tier:subscription:${subscriptionId}`, subscription);

      // Update request
      request.status = 'completed';
      request.paymentId = paymentId;
      request.razorpayOrderId = razorpayOrderId;
      request.razorpayPaymentId = razorpayPaymentId;
      request.completedAt = new Date().toISOString();

      await kv.set(`tier:upgrade:${requestId}`, request);

      console.log(`✅ Tier upgrade completed: ${subscriptionId}`);

      return sendSuccess(c, {
        subscriptionId,
        tierName: tier.tierName,
        status: subscription.status,
        endDate: subscription.endDate,
        trialEndsAt: subscription.trialEndsAt
      }, 'Upgrade completed successfully');

    } catch (error) {
      console.error('❌ Error completing upgrade:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * POST /tier/subscription/:subscriptionId/cancel
   * Cancel subscription
   */
  app.post(`${BASE_PATH}/tier/subscription/:subscriptionId/cancel`, async (c) => {
    try {
      const { subscriptionId } = c.req.param();
      const { reason } = await c.req.json();

      const subscription = await kv.get(`tier:subscription:${subscriptionId}`);
      
      if (!subscription) {
        return sendError(c, 'Subscription not found', 404);
      }

      subscription.status = 'cancelled';
      subscription.cancelledAt = new Date().toISOString();
      subscription.cancellationReason = reason;
      subscription.autoRenew = false;
      subscription.updatedAt = new Date().toISOString();

      await kv.set(`tier:subscription:${subscriptionId}`, subscription);

      console.log(`✅ Subscription cancelled: ${subscriptionId}`);

      return sendSuccess(c, { subscriptionId }, 'Subscription cancelled successfully');

    } catch (error) {
      console.error('❌ Error cancelling subscription:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * GET /tier/check-limit/:vendorId
   * Check if vendor can perform action based on tier limits
   */
  app.get(`${BASE_PATH}/tier/check-limit/:vendorId`, async (c) => {
    try {
      const { vendorId } = c.req.param();
      const resource = c.req.query('resource'); // staff, services, products, photos
      const currentCount = parseInt(c.req.query('currentCount') || '0');

      const allSubscriptions = await kv.getByPrefix('tier:subscription:') || [];
      
      const subscription = allSubscriptions
        .map((item: any) => item.value || item)
        .find((sub: any) => sub.vendorId === vendorId && 
          ['trial', 'active'].includes(sub.status));

      let limit = 0;
      
      if (subscription) {
        const tier = await kv.get(`tier:plan:${subscription.tierId}`);
        const resourceKey = `max${resource.charAt(0).toUpperCase()}${resource.slice(1)}`;
        limit = tier?.features[resourceKey] || 0;
      } else {
        // Free tier
        const freeTier = await kv.get('tier:plan:free');
        const resourceKey = `max${resource.charAt(0).toUpperCase()}${resource.slice(1)}`;
        limit = freeTier?.features[resourceKey] || 0;
      }

      const allowed = limit === -1 || currentCount < limit; // -1 means unlimited

      return sendSuccess(c, {
        resource,
        currentCount,
        limit: limit === -1 ? 'unlimited' : limit,
        allowed,
        remaining: limit === -1 ? 'unlimited' : Math.max(0, limit - currentCount)
      });

    } catch (error) {
      console.error('❌ Error checking limit:', error);
      return sendError(c, error, 500);
    }
  });

  console.log('✅ Tier Upgrade Endpoints registered');
}
