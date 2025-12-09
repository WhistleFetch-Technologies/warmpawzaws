import { Hono } from 'npm:hono';
import * as kv from './kv_store.tsx';

const app = new Hono();

// ============================================
// UNIVERSAL SUBSCRIPTION TIER SYSTEM
// Supports: Vendor Tiers, Customer Tiers, P2P Service Tiers
// ============================================

interface SubscriptionTier {
  id: string;
  tierType: 'vendor' | 'customer' | 'p2p_service'; // Universal tier types
  tierName: string;
  description: string;
  pricing: {
    monthly: number;
    quarterly?: number;
    sixMonths?: number;
    annual?: number;
  };
  commissionRate: number; // Percentage (0-100)
  benefits: {
    freeDelivery?: boolean;
    priorityDelivery?: boolean;
    prioritySupport?: boolean;
    chatUnlock?: boolean;
    unlimitedMatches?: boolean;
    featuredListing?: boolean;
    analyticsAccess?: boolean;
    customBranding?: boolean;
    [key: string]: any;
  };
  applicableVendorRoles?: string[]; // For vendor tiers
  applicableServiceTypes?: string[]; // For P2P service tiers
  isActive: boolean;
  metadata: {
    maxPets?: number; // For customer tiers
    maxStaff?: number; // For vendor tiers
    maxListings?: number;
    [key: string]: any;
  };
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

interface VendorSubscription {
  id: string;
  vendorId: string;
  tierId: string;
  status: 'active' | 'expired' | 'cancelled' | 'pending';
  startDate: string;
  endDate: string;
  autoRenew: boolean;
  paymentId?: string;
  createdAt: string;
  updatedAt: string;
}

interface CustomerSubscription {
  id: string;
  customerId: string;
  tierId: string;
  status: 'active' | 'expired' | 'cancelled' | 'pending';
  startDate: string;
  endDate: string;
  autoRenew: boolean;
  paymentId?: string;
  metadata: {
    serviceType?: string; // e.g., 'mating_dating'
    appliesTo: 'user' | 'pet'; // User-level or pet-level
    coveredPets?: string[]; // Multi-pet support
  };
  createdAt: string;
  updatedAt: string;
}

// ============================================
// ADMIN: SUBSCRIPTION TIER MANAGEMENT
// ============================================

// Create Subscription Tier
app.post('/admin/subscription-tiers', async (c) => {
  try {
    const body = await c.req.json();
    const {
      tierType,
      tierName,
      description,
      pricing,
      commissionRate,
      benefits,
      applicableVendorRoles,
      applicableServiceTypes,
      metadata,
      createdBy
    } = body;

    // Validation
    if (!tierType || !tierName || !pricing || commissionRate === undefined) {
      return c.json({ success: false, error: 'Missing required fields' }, 400);
    }

    if (!['vendor', 'customer', 'p2p_service'].includes(tierType)) {
      return c.json({ success: false, error: 'Invalid tier type' }, 400);
    }

    const tierId = `tier_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const tier: SubscriptionTier = {
      id: tierId,
      tierType,
      tierName,
      description: description || '',
      pricing,
      commissionRate,
      benefits: benefits || {},
      applicableVendorRoles: applicableVendorRoles || [],
      applicableServiceTypes: applicableServiceTypes || [],
      isActive: true,
      metadata: metadata || {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: createdBy || 'admin'
    };

    await kv.set(`subscription_tier:${tierId}`, tier);

    // Index by type for easy retrieval
    const tiersByType = await kv.get(`subscription_tiers:${tierType}`) || [];
    tiersByType.push(tierId);
    await kv.set(`subscription_tiers:${tierType}`, tiersByType);

    // Index all tiers
    const allTiers = await kv.get('subscription_tiers:all') || [];
    allTiers.push(tierId);
    await kv.set('subscription_tiers:all', allTiers);

    return c.json({ 
      success: true, 
      tier,
      message: 'Subscription tier created successfully' 
    });
  } catch (error) {
    console.error('Error creating subscription tier:', error);
    return c.json({ success: false, error: error.message }, 500);
  }
});

// Get All Subscription Tiers (with optional filter)
app.get('/admin/subscription-tiers', async (c) => {
  try {
    const tierType = c.req.query('tierType'); // Filter by type
    const includeInactive = c.req.query('includeInactive') === 'true';

    let tierIds: string[] = [];
    
    if (tierType) {
      tierIds = await kv.get(`subscription_tiers:${tierType}`) || [];
    } else {
      tierIds = await kv.get('subscription_tiers:all') || [];
    }

    const tiers = await Promise.all(
      tierIds.map(async (id) => await kv.get(`subscription_tier:${id}`))
    );

    const validTiers = tiers.filter(t => t !== null);

    // Filter out inactive tiers if needed
    const filteredTiers = includeInactive 
      ? validTiers 
      : validTiers.filter(t => t.isActive);

    return c.json({ 
      success: true, 
      tiers: filteredTiers,
      count: filteredTiers.length 
    });
  } catch (error) {
    console.error('Error fetching subscription tiers:', error);
    return c.json({ success: false, error: error.message }, 500);
  }
});

// Get Single Subscription Tier
app.get('/admin/subscription-tiers/:tierId', async (c) => {
  try {
    const { tierId } = c.req.param();

    const tier = await kv.get(`subscription_tier:${tierId}`);

    if (!tier) {
      return c.json({ success: false, error: 'Tier not found' }, 404);
    }

    return c.json({ success: true, tier });
  } catch (error) {
    console.error('Error fetching subscription tier:', error);
    return c.json({ success: false, error: error.message }, 500);
  }
});

// Update Subscription Tier
app.put('/admin/subscription-tiers/:tierId', async (c) => {
  try {
    const { tierId } = c.req.param();
    const updates = await c.req.json();

    const existingTier = await kv.get(`subscription_tier:${tierId}`);

    if (!existingTier) {
      return c.json({ success: false, error: 'Tier not found' }, 404);
    }

    const updatedTier = {
      ...existingTier,
      ...updates,
      id: tierId, // Prevent ID change
      createdAt: existingTier.createdAt, // Prevent timestamp change
      updatedAt: new Date().toISOString()
    };

    await kv.set(`subscription_tier:${tierId}`, updatedTier);

    return c.json({ 
      success: true, 
      tier: updatedTier,
      message: 'Subscription tier updated successfully' 
    });
  } catch (error) {
    console.error('Error updating subscription tier:', error);
    return c.json({ success: false, error: error.message }, 500);
  }
});

// Delete/Deactivate Subscription Tier
app.delete('/admin/subscription-tiers/:tierId', async (c) => {
  try {
    const { tierId } = c.req.param();
    const hardDelete = c.req.query('hardDelete') === 'true';

    const existingTier = await kv.get(`subscription_tier:${tierId}`);

    if (!existingTier) {
      return c.json({ success: false, error: 'Tier not found' }, 404);
    }

    if (hardDelete) {
      // Hard delete - remove completely
      await kv.del(`subscription_tier:${tierId}`);

      // Remove from indexes
      const tiersByType = await kv.get(`subscription_tiers:${existingTier.tierType}`) || [];
      const updatedTiersByType = tiersByType.filter(id => id !== tierId);
      await kv.set(`subscription_tiers:${existingTier.tierType}`, updatedTiersByType);

      const allTiers = await kv.get('subscription_tiers:all') || [];
      const updatedAllTiers = allTiers.filter(id => id !== tierId);
      await kv.set('subscription_tiers:all', updatedAllTiers);

      return c.json({ success: true, message: 'Tier deleted permanently' });
    } else {
      // Soft delete - just deactivate
      const deactivatedTier = {
        ...existingTier,
        isActive: false,
        updatedAt: new Date().toISOString()
      };

      await kv.set(`subscription_tier:${tierId}`, deactivatedTier);

      return c.json({ 
        success: true, 
        tier: deactivatedTier,
        message: 'Tier deactivated successfully' 
      });
    }
  } catch (error) {
    console.error('Error deleting subscription tier:', error);
    return c.json({ success: false, error: error.message }, 500);
  }
});

// ============================================
// VENDOR SUBSCRIPTION MANAGEMENT
// ============================================

// Subscribe Vendor to Tier
app.post('/vendor/:vendorId/subscribe', async (c) => {
  try {
    const { vendorId } = c.req.param();
    const { tierId, duration, paymentId } = await c.req.json();

    // Validate tier
    const tier = await kv.get(`subscription_tier:${tierId}`);
    if (!tier || !tier.isActive) {
      return c.json({ success: false, error: 'Invalid or inactive tier' }, 400);
    }

    if (tier.tierType !== 'vendor') {
      return c.json({ success: false, error: 'Tier is not for vendors' }, 400);
    }

    // Calculate end date based on duration
    const startDate = new Date();
    const endDate = new Date(startDate);
    
    switch (duration) {
      case 'monthly':
        endDate.setMonth(endDate.getMonth() + 1);
        break;
      case 'quarterly':
        endDate.setMonth(endDate.getMonth() + 3);
        break;
      case 'sixMonths':
        endDate.setMonth(endDate.getMonth() + 6);
        break;
      case 'annual':
        endDate.setFullYear(endDate.getFullYear() + 1);
        break;
      default:
        return c.json({ success: false, error: 'Invalid duration' }, 400);
    }

    const subscriptionId = `vsub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const subscription: VendorSubscription = {
      id: subscriptionId,
      vendorId,
      tierId,
      status: 'active',
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      autoRenew: true,
      paymentId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    await kv.set(`vendor_subscription:${subscriptionId}`, subscription);
    await kv.set(`vendor_subscription:vendor:${vendorId}`, subscriptionId);

    return c.json({ 
      success: true, 
      subscription,
      message: 'Vendor subscribed successfully' 
    });
  } catch (error) {
    console.error('Error subscribing vendor:', error);
    return c.json({ success: false, error: error.message }, 500);
  }
});

// Get Vendor Subscription
app.get('/vendor/:vendorId/subscription', async (c) => {
  try {
    const { vendorId } = c.req.param();

    const subscriptionId = await kv.get(`vendor_subscription:vendor:${vendorId}`);
    
    if (!subscriptionId) {
      return c.json({ 
        success: true, 
        subscription: null,
        message: 'No active subscription' 
      });
    }

    const subscription = await kv.get(`vendor_subscription:${subscriptionId}`);
    const tier = subscription ? await kv.get(`subscription_tier:${subscription.tierId}`) : null;

    return c.json({ 
      success: true, 
      subscription,
      tier
    });
  } catch (error) {
    console.error('Error fetching vendor subscription:', error);
    return c.json({ success: false, error: error.message }, 500);
  }
});

// ============================================
// CUSTOMER SUBSCRIPTION MANAGEMENT
// ============================================

// Subscribe Customer to Tier (User-level subscription)
app.post('/customer/:customerId/subscribe', async (c) => {
  try {
    const { customerId } = c.req.param();
    const { tierId, duration, paymentId, serviceType, coveredPets } = await c.req.json();

    // Validate tier
    const tier = await kv.get(`subscription_tier:${tierId}`);
    if (!tier || !tier.isActive) {
      return c.json({ success: false, error: 'Invalid or inactive tier' }, 400);
    }

    if (tier.tierType !== 'customer' && tier.tierType !== 'p2p_service') {
      return c.json({ success: false, error: 'Tier is not for customers' }, 400);
    }

    // Calculate end date
    const startDate = new Date();
    const endDate = new Date(startDate);
    
    switch (duration) {
      case 'monthly':
        endDate.setMonth(endDate.getMonth() + 1);
        break;
      case 'quarterly':
        endDate.setMonth(endDate.getMonth() + 3);
        break;
      case 'sixMonths':
        endDate.setMonth(endDate.getMonth() + 6);
        break;
      case 'annual':
        endDate.setFullYear(endDate.getFullYear() + 1);
        break;
      default:
        return c.json({ success: false, error: 'Invalid duration' }, 400);
    }

    const subscriptionId = `csub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const subscription: CustomerSubscription = {
      id: subscriptionId,
      customerId,
      tierId,
      status: 'active',
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      autoRenew: true,
      paymentId,
      metadata: {
        serviceType: serviceType || 'general',
        appliesTo: 'user', // User-level subscription
        coveredPets: coveredPets || [] // Multi-pet support
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    await kv.set(`customer_subscription:${subscriptionId}`, subscription);
    
    // Index by customer and service type
    const customerSubKey = serviceType 
      ? `customer_subscription:customer:${customerId}:${serviceType}`
      : `customer_subscription:customer:${customerId}`;
    
    await kv.set(customerSubKey, subscriptionId);

    return c.json({ 
      success: true, 
      subscription,
      message: 'Customer subscribed successfully' 
    });
  } catch (error) {
    console.error('Error subscribing customer:', error);
    return c.json({ success: false, error: error.message }, 500);
  }
});

// Get Customer Subscription
app.get('/customer/:customerId/subscription', async (c) => {
  try {
    const { customerId } = c.req.param();
    const serviceType = c.req.query('serviceType'); // Optional filter

    const customerSubKey = serviceType 
      ? `customer_subscription:customer:${customerId}:${serviceType}`
      : `customer_subscription:customer:${customerId}`;

    const subscriptionId = await kv.get(customerSubKey);
    
    if (!subscriptionId) {
      return c.json({ 
        success: true, 
        subscription: null,
        hasActiveSubscription: false,
        message: 'No active subscription' 
      });
    }

    const subscription = await kv.get(`customer_subscription:${subscriptionId}`);
    const tier = subscription ? await kv.get(`subscription_tier:${subscription.tierId}`) : null;

    // Check if subscription is still valid
    const isActive = subscription && 
                     subscription.status === 'active' && 
                     new Date(subscription.endDate) > new Date();

    return c.json({ 
      success: true, 
      subscription,
      tier,
      hasActiveSubscription: isActive
    });
  } catch (error) {
    console.error('Error fetching customer subscription:', error);
    return c.json({ success: false, error: error.message }, 500);
  }
});

// Check if Customer has Active Subscription for a Service
app.get('/customer/:customerId/subscription/check', async (c) => {
  try {
    const { customerId } = c.req.param();
    const serviceType = c.req.query('serviceType'); // e.g., 'mating_dating'

    if (!serviceType) {
      return c.json({ success: false, error: 'Service type required' }, 400);
    }

    const subscriptionId = await kv.get(`customer_subscription:customer:${customerId}:${serviceType}`);
    
    if (!subscriptionId) {
      return c.json({ 
        success: true, 
        hasAccess: false,
        requiresSubscription: true
      });
    }

    const subscription = await kv.get(`customer_subscription:${subscriptionId}`);
    
    const isActive = subscription && 
                     subscription.status === 'active' && 
                     new Date(subscription.endDate) > new Date();

    return c.json({ 
      success: true, 
      hasAccess: isActive,
      requiresSubscription: !isActive,
      subscription: isActive ? subscription : null
    });
  } catch (error) {
    console.error('Error checking customer subscription:', error);
    return c.json({ success: false, error: error.message }, 500);
  }
});

// Cancel Subscription
app.post('/subscription/:subscriptionId/cancel', async (c) => {
  try {
    const { subscriptionId } = c.req.param();

    // Try both vendor and customer subscription keys
    let subscription = await kv.get(`vendor_subscription:${subscriptionId}`);
    let isVendor = true;

    if (!subscription) {
      subscription = await kv.get(`customer_subscription:${subscriptionId}`);
      isVendor = false;
    }

    if (!subscription) {
      return c.json({ success: false, error: 'Subscription not found' }, 404);
    }

    const updatedSubscription = {
      ...subscription,
      status: 'cancelled',
      autoRenew: false,
      updatedAt: new Date().toISOString()
    };

    const key = isVendor 
      ? `vendor_subscription:${subscriptionId}`
      : `customer_subscription:${subscriptionId}`;

    await kv.set(key, updatedSubscription);

    return c.json({ 
      success: true, 
      subscription: updatedSubscription,
      message: 'Subscription cancelled successfully' 
    });
  } catch (error) {
    console.error('Error cancelling subscription:', error);
    return c.json({ success: false, error: error.message }, 500);
  }
});

// Get Commission Rate for Vendor
app.get('/vendor/:vendorId/commission-rate', async (c) => {
  try {
    const { vendorId } = c.req.param();

    const subscriptionId = await kv.get(`vendor_subscription:vendor:${vendorId}`);
    
    if (!subscriptionId) {
      // Return default commission rate if no subscription
      return c.json({ 
        success: true, 
        commissionRate: 15, // Default 15%
        hasSubscription: false
      });
    }

    const subscription = await kv.get(`vendor_subscription:${subscriptionId}`);
    
    if (!subscription || subscription.status !== 'active') {
      return c.json({ 
        success: true, 
        commissionRate: 15,
        hasSubscription: false
      });
    }

    const tier = await kv.get(`subscription_tier:${subscription.tierId}`);
    
    return c.json({ 
      success: true, 
      commissionRate: tier?.commissionRate || 15,
      hasSubscription: true,
      tier
    });
  } catch (error) {
    console.error('Error fetching commission rate:', error);
    return c.json({ success: false, error: error.message }, 500);
  }
});

export default app;
