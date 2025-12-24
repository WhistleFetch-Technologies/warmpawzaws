/**
 * PACKAGE & MEMBERSHIP SYSTEM - SQL VERSION
 * ✅ MIGRATED TO SQL: NO KV STORE - All data from SQL
 * 
 * Supports:
 * - Service Bundles (multiple services packaged together)
 * - Time-Based Packages (valid for X days)
 * - Appointment Packages (limited/unlimited appointments)
 * - Memberships (benefits + discounts)
 * - Subscriptions (recurring benefits)
 */

import { Hono } from 'npm:hono@4';
import { getPackagesRepository } from '../../lib/repositories/packages.ts';
import { getVendorsRepository } from '../../lib/repositories/vendors.ts';
import { getDbClient } from '../../lib/db.ts';
import { sendSuccess, sendError } from './response-utils.ts';

export function packageEndpointsSQL(app: Hono) {
  const packagesRepo = getPackagesRepository();
  const vendorsRepo = getVendorsRepository();
  const client = getDbClient();

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
      
      console.log('📦 [PACKAGE-SQL] Creating package for vendor:', vendorId);
      
      // Map package data to repository format
      const newPackage = await packagesRepo.createPackage({
        vendorId,
        name: packageData.packageName,
        description: packageData.description || '',
        serviceType: packageData.category || 'general',
        totalSessions: packageData.totalSessions || 0,
        price: parseFloat(packageData.packagePrice || 0),
        discountPercent: packageData.discountPercentage || 0,
        validityDays: packageData.validityPeriod || (packageData.validityType === 'days' ? packageData.validityPeriod : 90),
        isActive: false, // Pending admin approval
      });
      
      console.log('✅ [PACKAGE-SQL] Package created:', newPackage.packageId);
      
      return sendSuccess(c, {
        packageId: newPackage.packageId,
        package: newPackage
      });
    } catch (error) {
      console.error('❌ [PACKAGE-SQL] Error creating package:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * Get all packages for a vendor
   * GET /make-server-3dd53475/vendor/:vendorId/packages
   */
  app.get('/make-server-3dd53475/vendor/:vendorId/packages', async (c) => {
    try {
      const { vendorId } = c.req.param();
      const serviceType = c.req.query('serviceType');
      
      console.log('📋 [PACKAGE-SQL] Fetching packages for vendor:', vendorId);
      
      const packages = await packagesRepo.getVendorPackages(vendorId, serviceType || undefined);
      
      console.log('✅ [PACKAGE-SQL] Found packages:', packages.length);
      
      return sendSuccess(c, {
        packages: packages || [],
        total: packages?.length || 0
      });
    } catch (error) {
      console.error('❌ [PACKAGE-SQL] Error fetching packages:', error);
      return sendError(c, error, 500);
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
      
      console.log('🔄 [PACKAGE-SQL] Updating package:', packageId);
      
      const existingPackage = await packagesRepo.getPackageById(packageId);
      
      if (!existingPackage) {
        return sendError(c, 'Package not found', 404);
      }
      
      if (existingPackage.vendorId !== vendorId) {
        return sendError(c, 'Unauthorized', 403);
      }
      
      // Map updates to repository format
      const updateData: any = {};
      if (updates.packageName) updateData.name = updates.packageName;
      if (updates.description !== undefined) updateData.description = updates.description;
      if (updates.packagePrice !== undefined) updateData.price = parseFloat(updates.packagePrice);
      if (updates.totalSessions !== undefined) updateData.totalSessions = updates.totalSessions;
      if (updates.validityPeriod !== undefined) updateData.validityDays = updates.validityPeriod;
      
      const updatedPackage = await packagesRepo.updatePackage(packageId, updateData);
      
      if (!updatedPackage) {
        return sendError(c, 'Failed to update package', 500);
      }
      
      console.log('✅ [PACKAGE-SQL] Package updated:', packageId);
      
      return sendSuccess(c, {
        package: updatedPackage
      });
    } catch (error) {
      console.error('❌ [PACKAGE-SQL] Error updating package:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * Delete package
   * DELETE /make-server-3dd53475/vendor/:vendorId/packages/:packageId
   */
  app.delete('/make-server-3dd53475/vendor/:vendorId/packages/:packageId', async (c) => {
    try {
      const { vendorId, packageId } = c.req.param();
      
      console.log('🗑️ [PACKAGE-SQL] Deleting package:', packageId);
      
      const existingPackage = await packagesRepo.getPackageById(packageId);
      
      if (!existingPackage) {
        return sendError(c, 'Package not found', 404);
      }
      
      if (existingPackage.vendorId !== vendorId) {
        return sendError(c, 'Unauthorized', 403);
      }
      
      // Check if package has active purchases
      const { data: activePurchases } = await client
        .from('package_purchases')
        .select('id')
        .eq('package_id', packageId)
        .eq('status', 'active');
      
      if (activePurchases && activePurchases.length > 0) {
        return sendError(c, {
          error: 'Cannot delete package with active purchases',
          activePurchases: activePurchases.length
        }, 400);
      }
      
      const deleted = await packagesRepo.deletePackage(packageId);
      
      if (!deleted) {
        return sendError(c, 'Failed to delete package', 500);
      }
      
      console.log('✅ [PACKAGE-SQL] Package deleted:', packageId);
      
      return sendSuccess(c, {});
    } catch (error) {
      console.error('❌ [PACKAGE-SQL] Error deleting package:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * Get package sales analytics
   * GET /make-server-3dd53475/vendor/:vendorId/packages/:packageId/sales
   */
  app.get('/make-server-3dd53475/vendor/:vendorId/packages/:packageId/sales', async (c) => {
    try {
      const { vendorId, packageId } = c.req.param();
      
      console.log('📊 [PACKAGE-SQL] Fetching sales for package:', packageId);
      
      const analytics = await packagesRepo.getPackageSalesAnalytics(packageId);
      
      return sendSuccess(c, {
        analytics
      });
    } catch (error) {
      console.error('❌ [PACKAGE-SQL] Error fetching sales:', error);
      return sendError(c, error, 500);
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
      
      console.log('🛍️ [PACKAGE-SQL] Customer browsing packages');
      
      // Get all active packages from SQL
      const { data: packages, error: packagesError } = await client
        .from('service_packages')
        .select('*')
        .eq('is_active', true);
      
      if (packagesError) {
        throw packagesError;
      }
      
      // Apply filters
      let filteredPackages = packages || [];
      
      if (vendorId) {
        filteredPackages = filteredPackages.filter((pkg: any) => pkg.vendor_id === vendorId);
      }
      
      // Enrich with vendor details
      const enrichedPackages = await Promise.all(
        filteredPackages.map(async (pkg: any) => {
          const vendor = await vendorsRepo.findById(pkg.vendor_id);
          return {
            id: pkg.id,
            packageId: pkg.package_id,
            vendorId: pkg.vendor_id,
            packageName: pkg.name,
            description: pkg.description,
            packagePrice: parseFloat(pkg.price),
            totalSessions: pkg.total_sessions,
            validityDays: pkg.validity_days,
            vendorDetails: {
              businessName: vendor?.business_name || 'Unknown',
              rating: 0, // Would need to calculate from reviews
              totalReviews: 0, // Would need to count from reviews
              address: vendor?.address || '',
              city: vendor?.city || '',
            }
          };
        })
      );
      
      console.log('✅ [PACKAGE-SQL] Found packages:', enrichedPackages.length);
      
      return sendSuccess(c, {
        packages: enrichedPackages,
        total: enrichedPackages.length
      });
    } catch (error) {
      console.error('❌ [PACKAGE-SQL] Error browsing packages:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * Get package details
   * GET /make-server-3dd53475/customer/packages/:packageId
   */
  app.get('/make-server-3dd53475/customer/packages/:packageId', async (c) => {
    try {
      const { packageId } = c.req.param();
      
      console.log('📦 [PACKAGE-SQL] Fetching package details:', packageId);
      
      const packageObj = await packagesRepo.getPackageById(packageId);
      
      if (!packageObj) {
        return sendError(c, 'Package not found', 404);
      }
      
      // Get vendor details
      const vendor = await vendorsRepo.findById(packageObj.vendorId);
      
      const enrichedPackage = {
        ...packageObj,
        vendorDetails: {
          businessName: vendor?.business_name || 'Unknown',
          rating: 0,
          totalReviews: 0,
          address: vendor?.address || '',
          city: vendor?.city || '',
          phone: vendor?.phone || ''
        }
      };
      
      return sendSuccess(c, {
        package: enrichedPackage
      });
    } catch (error) {
      console.error('❌ [PACKAGE-SQL] Error fetching package:', error);
      return sendError(c, error, 500);
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
      
      console.log('💳 [PACKAGE-SQL] Processing purchase:', { customerId, packageId });
      
      const packageObj = await packagesRepo.getPackageById(packageId);
      
      if (!packageObj) {
        return sendError(c, 'Package not found', 404);
      }
      
      if (!packageObj.isActive) {
        return sendError(c, 'Package not available', 400);
      }
      
      const purchaseId = `pur_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      
      // Calculate validity
      let expiresAt = null;
      if (packageObj.validityDays && packageObj.validityDays > 0) {
        const now = new Date();
        now.setDate(now.getDate() + packageObj.validityDays);
        expiresAt = now.toISOString();
      }
      
      // Create purchase
      const purchase = await packagesRepo.createPurchase({
        purchaseId,
        packageId: packageObj.packageId,
        customerId,
        vendorId: packageObj.vendorId,
        packageName: packageObj.name,
        packageType: 'bundle', // Default type
        packagePrice: packageObj.price,
        totalSessions: packageObj.totalSessions,
        unlimitedUsage: packageObj.totalSessions === 0, // Unlimited if totalSessions is 0
        expiresAt,
        paymentMethod,
        paymentId,
        isRecurring: false,
        nextBillingDate: null,
      });
      
      console.log('✅ [PACKAGE-SQL] Purchase completed:', purchaseId);
      
      return sendSuccess(c, {
        purchaseId: purchase.id,
        purchase
      });
    } catch (error) {
      console.error('❌ [PACKAGE-SQL] Error processing purchase:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * Get customer's packages (alias for query param version)
   * GET /make-server-3dd53475/customer/packages/my-packages?customerId=...
   */
  app.get('/make-server-3dd53475/customer/packages/my-packages', async (c) => {
    try {
      const customerId = c.req.query('customerId');
      const status = c.req.query('status');
      
      if (!customerId) {
        return sendError(c, 'customerId query parameter is required', 400);
      }
      
      console.log('📋 [PACKAGE-SQL] Fetching customer packages (query param):', customerId);
      
      const purchases = await packagesRepo.getCustomerPurchases(customerId, status || undefined);
      
      // Check and update expired packages
      const now = new Date();
      const updatedPurchases = await Promise.all(
        purchases.map(async (purchase: any) => {
          if (purchase.expires_at && new Date(purchase.expires_at) < now && purchase.status === 'active') {
            await packagesRepo.updatePurchase(purchase.id, { status: 'expired' });
            purchase.status = 'expired';
          }
          
          // Check if sessions used up
          if (!purchase.unlimited_usage && purchase.remaining_sessions <= 0 && purchase.status === 'active') {
            await packagesRepo.updatePurchase(purchase.id, { status: 'used_up' });
            purchase.status = 'used_up';
          }
          
          return purchase;
        })
      );
      
      console.log('✅ [PACKAGE-SQL] Found customer packages:', updatedPurchases.length);
      
      return sendSuccess(c, {
        packages: updatedPurchases,
        total: updatedPurchases.length
      });
    } catch (error) {
      console.error('❌ [PACKAGE-SQL] Error fetching customer packages:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * Get customer's packages
   * GET /make-server-3dd53475/customer/:customerId/packages
   */
  app.get('/make-server-3dd53475/customer/:customerId/packages', async (c) => {
    try {
      const { customerId } = c.req.param();
      const status = c.req.query('status');
      
      console.log('📋 [PACKAGE-SQL] Fetching customer packages:', customerId);
      
      const purchases = await packagesRepo.getCustomerPurchases(customerId, status || undefined);
      
      // Check and update expired packages
      const now = new Date();
      const updatedPurchases = await Promise.all(
        purchases.map(async (purchase: any) => {
          if (purchase.expires_at && new Date(purchase.expires_at) < now && purchase.status === 'active') {
            await packagesRepo.updatePurchase(purchase.id, { status: 'expired' });
            purchase.status = 'expired';
          }
          
          // Check if sessions used up
          if (!purchase.unlimited_usage && purchase.remaining_sessions <= 0 && purchase.status === 'active') {
            await packagesRepo.updatePurchase(purchase.id, { status: 'used_up' });
            purchase.status = 'used_up';
          }
          
          return purchase;
        })
      );
      
      console.log('✅ [PACKAGE-SQL] Found customer packages:', updatedPurchases.length);
      
      return sendSuccess(c, {
        packages: updatedPurchases,
        total: updatedPurchases.length
      });
    } catch (error) {
      console.error('❌ [PACKAGE-SQL] Error fetching customer packages:', error);
      return sendError(c, error, 500);
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
      
      console.log('🎟️ [PACKAGE-SQL] Redeeming package session:', purchaseId);
      
      const purchase = await packagesRepo.getPurchaseById(purchaseId);
      
      if (!purchase) {
        return sendError(c, 'Package not found', 404);
      }
      
      if (purchase.customer_id !== customerId) {
        return sendError(c, 'Unauthorized', 403);
      }
      
      if (purchase.status !== 'active') {
        return sendError(c, `Package is ${purchase.status}`, 400);
      }
      
      // Check validity
      if (purchase.expires_at && new Date(purchase.expires_at) < new Date()) {
        await packagesRepo.updatePurchase(purchaseId, { status: 'expired' });
        return sendError(c, 'Package expired', 400);
      }
      
      // Check remaining sessions
      if (!purchase.unlimited_usage) {
        if (purchase.remaining_sessions <= 0) {
          await packagesRepo.updatePurchase(purchaseId, { status: 'used_up' });
          return sendError(c, 'No sessions remaining', 400);
        }
        
        // Decrement remaining sessions
        await packagesRepo.updatePurchase(purchaseId, {
          remainingSessions: purchase.remaining_sessions - 1
        });
      }
      
      // Create package session record
      const { data: session, error: sessionError } = await client
        .from('package_sessions')
        .insert({
          package_purchase_id: purchase.id,
          customer_id: customerId,
          vendor_id: purchase.vendor_id,
          booking_id: bookingId || null,
          session_number: purchase.total_sessions - (purchase.remaining_sessions - 1),
          status: 'completed',
          redeemed_at: new Date().toISOString(),
          completed_at: new Date().toISOString(),
        })
        .select()
        .single();
      
      if (sessionError) {
        console.error('Error creating package session:', sessionError);
      }
      
      const updatedPurchase = await packagesRepo.getPurchaseById(purchaseId);
      
      console.log('✅ [PACKAGE-SQL] Session redeemed. Remaining:', updatedPurchase?.remaining_sessions);
      
      return sendSuccess(c, {
        remainingSessions: updatedPurchase?.remaining_sessions || 0,
        unlimitedUsage: purchase.unlimited_usage,
        usage: session
      });
    } catch (error) {
      console.error('❌ [PACKAGE-SQL] Error redeeming session:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * Get package usage history
   * GET /make-server-3dd53475/customer/:customerId/packages/:purchaseId/history
   */
  app.get('/make-server-3dd53475/customer/:customerId/packages/:purchaseId/history', async (c) => {
    try {
      const { customerId, purchaseId } = c.req.param();
      
      console.log('📊 [PACKAGE-SQL] Fetching usage history:', purchaseId);
      
      const purchase = await packagesRepo.getPurchaseById(purchaseId);
      
      if (!purchase) {
        return sendError(c, 'Package not found', 404);
      }
      
      if (purchase.customer_id !== customerId) {
        return sendError(c, 'Unauthorized', 403);
      }
      
      // Get package sessions
      const { data: sessions, error: sessionsError } = await client
        .from('package_sessions')
        .select('*')
        .eq('package_purchase_id', purchase.id)
        .order('redeemed_at', { ascending: false });
      
      if (sessionsError) {
        console.error('Error fetching sessions:', sessionsError);
      }
      
      return sendSuccess(c, {
        usageHistory: sessions || [],
        totalUsed: sessions?.length || 0,
        remainingSessions: purchase.remaining_sessions,
        unlimitedUsage: purchase.unlimited_usage
      });
    } catch (error) {
      console.error('❌ [PACKAGE-SQL] Error fetching history:', error);
      return sendError(c, error, 500);
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
      console.log('📋 [ADMIN-PACKAGE-SQL] Fetching pending packages');
      
      // Get all packages that are not active (pending approval)
      const { data: packages, error: packagesError } = await client
        .from('service_packages')
        .select('*')
        .eq('is_active', false);
      
      if (packagesError) {
        throw packagesError;
      }
      
      // Enrich with vendor details
      const enrichedPackages = await Promise.all(
        (packages || []).map(async (pkg: any) => {
          const vendor = await vendorsRepo.findById(pkg.vendor_id);
          return {
            id: pkg.id,
            packageId: pkg.package_id,
            vendorId: pkg.vendor_id,
            packageName: pkg.name,
            description: pkg.description,
            packagePrice: parseFloat(pkg.price),
            totalSessions: pkg.total_sessions,
            status: 'pending',
            isActive: false,
            vendorDetails: {
              businessName: vendor?.business_name || 'Unknown',
              phone: vendor?.phone || '',
              email: vendor?.email || ''
            }
          };
        })
      );
      
      console.log('✅ [ADMIN-PACKAGE-SQL] Found pending packages:', enrichedPackages.length);
      
      return sendSuccess(c, {
        packages: enrichedPackages,
        total: enrichedPackages.length
      });
    } catch (error) {
      console.error('❌ [ADMIN-PACKAGE-SQL] Error fetching pending packages:', error);
      return sendError(c, error, 500);
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
      
      console.log('🔄 [ADMIN-PACKAGE-SQL] Reviewing package:', { packageId, action });
      
      const packageObj = await packagesRepo.getPackageById(packageId);
      
      if (!packageObj) {
        return sendError(c, 'Package not found', 404);
      }
      
      // Update package status
      const updatedPackage = await packagesRepo.updatePackage(packageId, {
        isActive: action === 'approved'
      });
      
      if (!updatedPackage) {
        return sendError(c, 'Failed to update package', 500);
      }
      
      console.log('✅ [ADMIN-PACKAGE-SQL] Package reviewed:', packageId);
      
      return sendSuccess(c, {
        package: updatedPackage
      });
    } catch (error) {
      console.error('❌ [ADMIN-PACKAGE-SQL] Error reviewing package:', error);
      return sendError(c, error, 500);
    }
  });

  console.log('✅ Package endpoints (SQL) registered');
}

