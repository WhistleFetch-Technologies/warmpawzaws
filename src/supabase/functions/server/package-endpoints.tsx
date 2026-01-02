import { Hono } from 'hono';

/**
 * PACKAGE & MEMBERSHIP SYSTEM
 * 
 * Supports:
 * - Service Bundles (multiple services packaged together)
 * - Time-Based Packages (valid for X days)
 * - Appointment Packages (limited/unlimited appointments)
 * - Memberships (benefits + discounts)
 * - Subscriptions (recurring benefits)
 */

export function packageEndpoints(app: Hono, kvStore: any) {
  
  // ============================================
  // VENDOR ENDPOINTS - Package Management
  // ============================================

  /**
   * Create new package
   * POST /make-server-3dd53475/vendor/:vendorId/packages
   */
  app.post('/make-server-3dd53475/vendor/:vendorId/packages', async (c) => {
    try {
      const { vendorId } = c.req.param();
      const packageData = await c.req.json();
      
      console.log('📦 [PACKAGE] Creating package for vendor:', vendorId);
      
      const packageId = `pkg_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      
      const packageObj = {
        id: packageId,
        vendorId,
        
        // Basic Info
        packageName: packageData.packageName,
        packageType: packageData.packageType, // 'bundle', 'time_based', 'appointment', 'membership', 'subscription'
        description: packageData.description,
        category: packageData.category, // For filtering
        
        // Pricing
        originalPrice: packageData.originalPrice || 0,
        packagePrice: packageData.packagePrice,
        discount: packageData.discount || 0,
        discountPercentage: packageData.discountPercentage || 0,
        
        // Validity
        validityType: packageData.validityType, // 'days', 'months', 'years', 'unlimited'
        validityPeriod: packageData.validityPeriod, // Number of days/months
        
        // Usage Limits
        usageType: packageData.usageType, // 'sessions', 'appointments', 'unlimited'
        totalSessions: packageData.totalSessions || 0,
        unlimitedUsage: packageData.unlimitedUsage || false,
        
        // Included Services
        includedServices: packageData.includedServices || [], // Array of service IDs
        includedServicesDetails: packageData.includedServicesDetails || [], // Service names & descriptions
        
        // Benefits (for memberships)
        benefits: packageData.benefits || [],
        membershipPerks: packageData.membershipPerks || {
          priorityBooking: false,
          discountOnServices: 0,
          freeAddOns: [],
          dedicatedSupport: false,
          exclusiveOffers: false
        },
        
        // Terms & Conditions
        terms: packageData.terms || [],
        refundPolicy: packageData.refundPolicy || '',
        cancellationPolicy: packageData.cancellationPolicy || '',
        
        // Subscription (if applicable)
        isRecurring: packageData.isRecurring || false,
        billingCycle: packageData.billingCycle || 'monthly', // 'monthly', 'quarterly', 'yearly'
        
        // Status
        status: 'pending', // Pending admin approval
        isActive: false,
        
        // Metadata
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        publishedAt: null,
        approvedAt: null,
        
        // Analytics
        totalPurchases: 0,
        totalRevenue: 0,
        activeSubscribers: 0
      };
      
      // Save package
      await kvStore.set(`package:vendor:${vendorId}:${packageId}`, packageObj);
      await kvStore.set(`package:${packageId}`, packageObj);
      
      console.log('✅ [PACKAGE] Package created:', packageId);
      
      return c.json({
        success: true,
        packageId,
        package: packageObj
      });
    } catch (error) {
      console.error('❌ [PACKAGE] Error creating package:', error);
      return c.json({ error: String(error) }, 500);
    }
  });

  /**
   * Get all packages for a vendor
   * GET /make-server-3dd53475/vendor/:vendorId/packages
   */
  app.get('/make-server-3dd53475/vendor/:vendorId/packages', async (c) => {
    try {
      const { vendorId } = c.req.param();
      
      console.log('📋 [PACKAGE] Fetching packages for vendor:', vendorId);
      
      const packages = await kvStore.getByPrefix(`package:vendor:${vendorId}:`);
      
      console.log('✅ [PACKAGE] Found packages:', packages.length);
      
      return c.json({
        success: true,
        packages: packages || [],
        total: packages?.length || 0
      });
    } catch (error) {
      console.error('❌ [PACKAGE] Error fetching packages:', error);
      return c.json({ error: String(error) }, 500);
    }
  });

  /**
   * Update package
   * PUT /make-server-3dd53475/vendor/:vendorId/packages/:packageId
   */
  app.put('/make-server-3dd53475/vendor/:vendorId/packages/:packageId', async (c) => {
    try {
      const { vendorId, packageId } = c.req.param();
      const updates = await c.req.json();
      
      console.log('🔄 [PACKAGE] Updating package:', packageId);
      
      const existingPackage = await kvStore.get(`package:${packageId}`);
      
      if (!existingPackage) {
        return c.json({ error: 'Package not found' }, 404);
      }
      
      if (existingPackage.vendorId !== vendorId) {
        return c.json({ error: 'Unauthorized' }, 403);
      }
      
      const updatedPackage = {
        ...existingPackage,
        ...updates,
        updatedAt: new Date().toISOString(),
        // Reset to pending if approved package is modified
        status: existingPackage.status === 'approved' ? 'pending' : existingPackage.status
      };
      
      await kvStore.set(`package:${packageId}`, updatedPackage);
      await kvStore.set(`package:vendor:${vendorId}:${packageId}`, updatedPackage);
      
      console.log('✅ [PACKAGE] Package updated:', packageId);
      
      return c.json({
        success: true,
        package: updatedPackage
      });
    } catch (error) {
      console.error('❌ [PACKAGE] Error updating package:', error);
      return c.json({ error: String(error) }, 500);
    }
  });

  /**
   * Delete package
   * DELETE /make-server-3dd53475/vendor/:vendorId/packages/:packageId
   */
  app.delete('/make-server-3dd53475/vendor/:vendorId/packages/:packageId', async (c) => {
    try {
      const { vendorId, packageId } = c.req.param();
      
      console.log('🗑️ [PACKAGE] Deleting package:', packageId);
      
      const existingPackage = await kvStore.get(`package:${packageId}`);
      
      if (!existingPackage) {
        return c.json({ error: 'Package not found' }, 404);
      }
      
      if (existingPackage.vendorId !== vendorId) {
        return c.json({ error: 'Unauthorized' }, 403);
      }
      
      // Check if package has active purchases
      const purchases = await kvStore.getByPrefix(`package:purchase:package:${packageId}:`);
      const activePurchases = purchases.filter((p: any) => p.status === 'active');
      
      if (activePurchases.length > 0) {
        return c.json({ 
          error: 'Cannot delete package with active purchases',
          activePurchases: activePurchases.length
        }, 400);
      }
      
      await kvStore.del(`package:${packageId}`);
      await kvStore.del(`package:vendor:${vendorId}:${packageId}`);
      
      console.log('✅ [PACKAGE] Package deleted:', packageId);
      
      return c.json({ success: true });
    } catch (error) {
      console.error('❌ [PACKAGE] Error deleting package:', error);
      return c.json({ error: String(error) }, 500);
    }
  });

  /**
   * Get package sales analytics
   * GET /make-server-3dd53475/vendor/:vendorId/packages/:packageId/sales
   */
  app.get('/make-server-3dd53475/vendor/:vendorId/packages/:packageId/sales', async (c) => {
    try {
      const { vendorId, packageId } = c.req.param();
      
      console.log('📊 [PACKAGE] Fetching sales for package:', packageId);
      
      const purchases = await kvStore.getByPrefix(`package:purchase:package:${packageId}:`);
      
      const totalSales = purchases.length;
      const totalRevenue = purchases.reduce((sum: number, p: any) => sum + (p.amount || 0), 0);
      const activePurchases = purchases.filter((p: any) => p.status === 'active').length;
      const expiredPurchases = purchases.filter((p: any) => p.status === 'expired').length;
      
      return c.json({
        success: true,
        analytics: {
          totalSales,
          totalRevenue,
          activePurchases,
          expiredPurchases,
          purchases
        }
      });
    } catch (error) {
      console.error('❌ [PACKAGE] Error fetching sales:', error);
      return c.json({ error: String(error) }, 500);
    }
  });

  // ============================================
  // CUSTOMER ENDPOINTS - Browse & Purchase
  // ============================================

  /**
   * Browse all approved packages
   * GET /make-server-3dd53475/customer/packages
   */
  app.get('/make-server-3dd53475/customer/packages', async (c) => {
    try {
      const { category, vendorId, packageType } = c.req.query();
      
      console.log('🛍️ [PACKAGE] Customer browsing packages');
      
      // Get all packages
      let allPackages = await kvStore.getByPrefix('package:vendor:');
      
      // Filter approved and active only
      allPackages = allPackages.filter((pkg: any) => 
        pkg.status === 'approved' && pkg.isActive
      );
      
      // Apply filters
      if (category) {
        allPackages = allPackages.filter((pkg: any) => pkg.category === category);
      }
      
      if (vendorId) {
        allPackages = allPackages.filter((pkg: any) => pkg.vendorId === vendorId);
      }
      
      if (packageType) {
        allPackages = allPackages.filter((pkg: any) => pkg.packageType === packageType);
      }
      
      // Enrich with vendor details
      const enrichedPackages = await Promise.all(
        allPackages.map(async (pkg: any) => {
          const vendor = await kvStore.get(`vendor:${pkg.vendorId}`);
          return {
            ...pkg,
            vendorDetails: {
              businessName: vendor?.businessName || 'Unknown',
              rating: vendor?.rating || 0,
              totalReviews: vendor?.totalReviews || 0,
              location: vendor?.location || {},
              address: vendor?.address || ''
            }
          };
        })
      );
      
      console.log('✅ [PACKAGE] Found packages:', enrichedPackages.length);
      
      return c.json({
        success: true,
        packages: enrichedPackages,
        total: enrichedPackages.length
      });
    } catch (error) {
      console.error('❌ [PACKAGE] Error browsing packages:', error);
      return c.json({ error: String(error) }, 500);
    }
  });

  /**
   * Get package details
   * GET /make-server-3dd53475/customer/packages/:packageId
   */
  app.get('/make-server-3dd53475/customer/packages/:packageId', async (c) => {
    try {
      const { packageId } = c.req.param();
      
      console.log('📦 [PACKAGE] Fetching package details:', packageId);
      
      const packageObj = await kvStore.get(`package:${packageId}`);
      
      if (!packageObj) {
        return c.json({ error: 'Package not found' }, 404);
      }
      
      // Get vendor details
      const vendor = await kvStore.get(`vendor:${packageObj.vendorId}`);
      
      const enrichedPackage = {
        ...packageObj,
        vendorDetails: {
          businessName: vendor?.businessName || 'Unknown',
          rating: vendor?.rating || 0,
          totalReviews: vendor?.totalReviews || 0,
          location: vendor?.location || {},
          address: vendor?.address || '',
          phone: vendor?.phone || ''
        }
      };
      
      return c.json({
        success: true,
        package: enrichedPackage
      });
    } catch (error) {
      console.error('❌ [PACKAGE] Error fetching package:', error);
      return c.json({ error: String(error) }, 500);
    }
  });

  /**
   * Purchase package
   * POST /make-server-3dd53475/customer/:customerId/packages/:packageId/purchase
   */
  app.post('/make-server-3dd53475/customer/:customerId/packages/:packageId/purchase', async (c) => {
    try {
      const { customerId, packageId } = c.req.param();
      const { paymentMethod, paymentId } = await c.req.json();
      
      console.log('💳 [PACKAGE] Processing purchase:', { customerId, packageId });
      
      const packageObj = await kvStore.get(`package:${packageId}`);
      
      if (!packageObj) {
        return c.json({ error: 'Package not found' }, 404);
      }
      
      if (packageObj.status !== 'approved' || !packageObj.isActive) {
        return c.json({ error: 'Package not available' }, 400);
      }
      
      const purchaseId = `pur_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      
      // Calculate validity
      let expiryDate = null;
      if (packageObj.validityType !== 'unlimited') {
        const now = new Date();
        if (packageObj.validityType === 'days') {
          now.setDate(now.getDate() + packageObj.validityPeriod);
        } else if (packageObj.validityType === 'months') {
          now.setMonth(now.getMonth() + packageObj.validityPeriod);
        } else if (packageObj.validityType === 'years') {
          now.setFullYear(now.getFullYear() + packageObj.validityPeriod);
        }
        expiryDate = now.toISOString();
      }
      
      const purchase = {
        id: purchaseId,
        customerId,
        packageId,
        vendorId: packageObj.vendorId,
        
        // Package snapshot
        packageName: packageObj.packageName,
        packageType: packageObj.packageType,
        packagePrice: packageObj.packagePrice,
        
        // Validity
        purchasedAt: new Date().toISOString(),
        activatedAt: new Date().toISOString(),
        expiryDate,
        
        // Usage
        totalSessions: packageObj.totalSessions || 0,
        remainingSessions: packageObj.totalSessions || 0,
        unlimitedUsage: packageObj.unlimitedUsage || false,
        usageHistory: [],
        
        // Payment
        amount: packageObj.packagePrice,
        paymentMethod,
        paymentId,
        paymentStatus: 'completed',
        
        // Status
        status: 'active', // 'active', 'expired', 'cancelled', 'used_up'
        
        // Subscription
        isRecurring: packageObj.isRecurring || false,
        nextBillingDate: packageObj.isRecurring ? expiryDate : null,
        
        // Metadata
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      // Save purchase
      await kvStore.set(`package:purchase:${purchaseId}`, purchase);
      await kvStore.set(`package:purchase:customer:${customerId}:${purchaseId}`, purchase);
      await kvStore.set(`package:purchase:package:${packageId}:${purchaseId}`, purchase);
      await kvStore.set(`customer:package:${customerId}:${purchaseId}`, purchase);
      
      // Update package analytics
      const updatedPackage = {
        ...packageObj,
        totalPurchases: (packageObj.totalPurchases || 0) + 1,
        totalRevenue: (packageObj.totalRevenue || 0) + packageObj.packagePrice,
        activeSubscribers: (packageObj.activeSubscribers || 0) + 1
      };
      await kvStore.set(`package:${packageId}`, updatedPackage);
      await kvStore.set(`package:vendor:${packageObj.vendorId}:${packageId}`, updatedPackage);
      
      console.log('✅ [PACKAGE] Purchase completed:', purchaseId);
      
      return c.json({
        success: true,
        purchaseId,
        purchase
      });
    } catch (error) {
      console.error('❌ [PACKAGE] Error processing purchase:', error);
      return c.json({ error: String(error) }, 500);
    }
  });

  /**
   * Get customer's packages
   * GET /make-server-3dd53475/customer/:customerId/packages
   */
  app.get('/make-server-3dd53475/customer/:customerId/packages', async (c) => {
    try {
      const { customerId } = c.req.param();
      const { status } = c.req.query();
      
      console.log('📋 [PACKAGE] Fetching customer packages:', customerId);
      
      let purchases = await kvStore.getByPrefix(`customer:package:${customerId}:`);
      
      // Filter by status if provided
      if (status) {
        purchases = purchases.filter((p: any) => p.status === status);
      }
      
      // Check and update expired packages
      const now = new Date();
      purchases = await Promise.all(
        purchases.map(async (purchase: any) => {
          if (purchase.expiryDate && new Date(purchase.expiryDate) < now && purchase.status === 'active') {
            purchase.status = 'expired';
            await kvStore.set(`package:purchase:${purchase.id}`, purchase);
            await kvStore.set(`customer:package:${customerId}:${purchase.id}`, purchase);
          }
          
          // Check if sessions used up
          if (!purchase.unlimitedUsage && purchase.remainingSessions <= 0 && purchase.status === 'active') {
            purchase.status = 'used_up';
            await kvStore.set(`package:purchase:${purchase.id}`, purchase);
            await kvStore.set(`customer:package:${customerId}:${purchase.id}`, purchase);
          }
          
          return purchase;
        })
      );
      
      console.log('✅ [PACKAGE] Found customer packages:', purchases.length);
      
      return c.json({
        success: true,
        packages: purchases,
        total: purchases.length
      });
    } catch (error) {
      console.error('❌ [PACKAGE] Error fetching customer packages:', error);
      return c.json({ error: String(error) }, 500);
    }
  });

  /**
   * Redeem/Use package session
   * POST /make-server-3dd53475/customer/:customerId/packages/:purchaseId/redeem
   */
  app.post('/make-server-3dd53475/customer/:customerId/packages/:purchaseId/redeem', async (c) => {
    try {
      const { customerId, purchaseId } = c.req.param();
      const { serviceId, bookingId, notes } = await c.req.json();
      
      console.log('🎟️ [PACKAGE] Redeeming package session:', purchaseId);
      
      const purchase = await kvStore.get(`package:purchase:${purchaseId}`);
      
      if (!purchase) {
        return c.json({ error: 'Package not found' }, 404);
      }
      
      if (purchase.customerId !== customerId) {
        return c.json({ error: 'Unauthorized' }, 403);
      }
      
      if (purchase.status !== 'active') {
        return c.json({ error: `Package is ${purchase.status}` }, 400);
      }
      
      // Check validity
      if (purchase.expiryDate && new Date(purchase.expiryDate) < new Date()) {
        purchase.status = 'expired';
        await kvStore.set(`package:purchase:${purchaseId}`, purchase);
        await kvStore.set(`customer:package:${customerId}:${purchaseId}`, purchase);
        return c.json({ error: 'Package expired' }, 400);
      }
      
      // Check remaining sessions
      if (!purchase.unlimitedUsage) {
        if (purchase.remainingSessions <= 0) {
          purchase.status = 'used_up';
          await kvStore.set(`package:purchase:${purchaseId}`, purchase);
          await kvStore.set(`customer:package:${customerId}:${purchaseId}`, purchase);
          return c.json({ error: 'No sessions remaining' }, 400);
        }
        
        purchase.remainingSessions -= 1;
      }
      
      // Add usage record
      const usageId = `use_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      const usage = {
        id: usageId,
        serviceId,
        bookingId,
        notes,
        redeemedAt: new Date().toISOString()
      };
      
      purchase.usageHistory.push(usage);
      purchase.updatedAt = new Date().toISOString();
      
      // Update purchase
      await kvStore.set(`package:purchase:${purchaseId}`, purchase);
      await kvStore.set(`customer:package:${customerId}:${purchaseId}`, purchase);
      
      console.log('✅ [PACKAGE] Session redeemed. Remaining:', purchase.remainingSessions);
      
      return c.json({
        success: true,
        remainingSessions: purchase.remainingSessions,
        unlimitedUsage: purchase.unlimitedUsage,
        usage
      });
    } catch (error) {
      console.error('❌ [PACKAGE] Error redeeming session:', error);
      return c.json({ error: String(error) }, 500);
    }
  });

  /**
   * Get package usage history
   * GET /make-server-3dd53475/customer/:customerId/packages/:purchaseId/history
   */
  app.get('/make-server-3dd53475/customer/:customerId/packages/:purchaseId/history', async (c) => {
    try {
      const { customerId, purchaseId } = c.req.param();
      
      console.log('📊 [PACKAGE] Fetching usage history:', purchaseId);
      
      const purchase = await kvStore.get(`package:purchase:${purchaseId}`);
      
      if (!purchase) {
        return c.json({ error: 'Package not found' }, 404);
      }
      
      if (purchase.customerId !== customerId) {
        return c.json({ error: 'Unauthorized' }, 403);
      }
      
      return c.json({
        success: true,
        usageHistory: purchase.usageHistory || [],
        totalUsed: purchase.usageHistory?.length || 0,
        remainingSessions: purchase.remainingSessions,
        unlimitedUsage: purchase.unlimitedUsage
      });
    } catch (error) {
      console.error('❌ [PACKAGE] Error fetching history:', error);
      return c.json({ error: String(error) }, 500);
    }
  });

  // ============================================
  // ADMIN ENDPOINTS - Package Approval
  // ============================================

  /**
   * Get all pending packages
   * GET /make-server-3dd53475/admin/packages/pending
   */
  app.get('/make-server-3dd53475/admin/packages/pending', async (c) => {
    try {
      console.log('📋 [ADMIN-PACKAGE] Fetching pending packages');
      
      const allPackages = await kvStore.getByPrefix('package:vendor:');
      const pendingPackages = allPackages.filter((pkg: any) => pkg.status === 'pending');
      
      // Enrich with vendor details
      const enrichedPackages = await Promise.all(
        pendingPackages.map(async (pkg: any) => {
          const vendor = await kvStore.get(`vendor:${pkg.vendorId}`);
          return {
            ...pkg,
            vendorDetails: {
              businessName: vendor?.businessName || 'Unknown',
              phone: vendor?.phone || '',
              email: vendor?.email || ''
            }
          };
        })
      );
      
      console.log('✅ [ADMIN-PACKAGE] Found pending packages:', enrichedPackages.length);
      
      return c.json({
        success: true,
        packages: enrichedPackages,
        total: enrichedPackages.length
      });
    } catch (error) {
      console.error('❌ [ADMIN-PACKAGE] Error fetching pending packages:', error);
      return c.json({ error: String(error) }, 500);
    }
  });

  /**
   * Approve/Reject package
   * POST /make-server-3dd53475/admin/packages/:packageId/review
   */
  app.post('/make-server-3dd53475/admin/packages/:packageId/review', async (c) => {
    try {
      const { packageId } = c.req.param();
      const { action, notes } = await c.req.json();
      
      console.log('🔄 [ADMIN-PACKAGE] Reviewing package:', { packageId, action });
      
      const packageObj = await kvStore.get(`package:${packageId}`);
      
      if (!packageObj) {
        return c.json({ error: 'Package not found' }, 404);
      }
      
      const updatedPackage = {
        ...packageObj,
        status: action, // 'approved' or 'rejected'
        isActive: action === 'approved',
        adminNotes: notes,
        reviewedAt: new Date().toISOString(),
        approvedAt: action === 'approved' ? new Date().toISOString() : null,
        publishedAt: action === 'approved' ? new Date().toISOString() : null,
        updatedAt: new Date().toISOString()
      };
      
      await kvStore.set(`package:${packageId}`, updatedPackage);
      await kvStore.set(`package:vendor:${packageObj.vendorId}:${packageId}`, updatedPackage);
      
      // If approved, create category index for easy customer browsing
      if (action === 'approved' && packageObj.category) {
        await kvStore.set(`package:category:${packageObj.category}:${packageId}`, updatedPackage);
      }
      
      console.log('✅ [ADMIN-PACKAGE] Package reviewed:', packageId);
      
      return c.json({
        success: true,
        package: updatedPackage
      });
    } catch (error) {
      console.error('❌ [ADMIN-PACKAGE] Error reviewing package:', error);
      return c.json({ error: String(error) }, 500);
    }
  });

  console.log('✅ Package endpoints registered');
}
