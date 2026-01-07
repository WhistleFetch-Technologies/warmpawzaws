"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.packageEndpointsSQL = packageEndpointsSQL;
const db_1 = require("../lib/db");
const vendors_1 = require("../lib/repositories/vendors");
const response_utils_1 = require("./response-utils");
function packageEndpointsSQL(app) {
    const vendorsRepo = (0, vendors_1.getVendorsRepository)();
    // TODO: Create packages repository or use direct SQL queries
    const packagesRepo = {
        createPackage: async (data) => {
            const pool = await (0, db_1.getDbClient)();
            const result = await pool.query(`INSERT INTO packages (vendor_id, name, description, service_type, total_sessions, price, discount_percent, validity_days, is_active)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`, [data.vendorId, data.name, data.description, data.serviceType, data.totalSessions, data.price, data.discountPercent, data.validityDays, data.isActive]);
            return result.rows[0];
        },
        getVendorPackages: async (vendorId, serviceType) => {
            const pool = await (0, db_1.getDbClient)();
            const query = serviceType
                ? 'SELECT * FROM packages WHERE vendor_id = $1 AND service_type = $2 AND is_active = true'
                : 'SELECT * FROM packages WHERE vendor_id = $1 AND is_active = true';
            const result = await pool.query(query, serviceType ? [vendorId, serviceType] : [vendorId]);
            return result.rows;
        },
        getPackageById: async (packageId) => {
            const pool = await (0, db_1.getDbClient)();
            const result = await pool.query('SELECT * FROM packages WHERE id = $1', [packageId]);
            return result.rows[0] || null;
        },
        updatePackage: async (packageId, data) => {
            const pool = await (0, db_1.getDbClient)();
            const updates = [];
            const values = [];
            let paramCount = 1;
            Object.keys(data).forEach(key => {
                updates.push(`${key} = $${paramCount++}`);
                values.push(data[key]);
            });
            values.push(packageId);
            const result = await pool.query(`UPDATE packages SET ${updates.join(', ')}, updated_at = NOW() WHERE id = $${paramCount} RETURNING *`, values);
            return result.rows[0];
        },
        deletePackage: async (packageId) => {
            const pool = await (0, db_1.getDbClient)();
            await pool.query('UPDATE packages SET is_active = false, updated_at = NOW() WHERE id = $1', [packageId]);
            return { success: true };
        },
        getPackageSalesAnalytics: async (packageId) => {
            const pool = await (0, db_1.getDbClient)();
            const result = await pool.query(`SELECT COUNT(*) as total_purchases, SUM(price) as total_revenue 
         FROM package_purchases WHERE package_id = $1`, [packageId]);
            return result.rows[0] || { total_purchases: 0, total_revenue: 0 };
        },
        createPurchase: async (data) => {
            const pool = await (0, db_1.getDbClient)();
            const result = await pool.query(`INSERT INTO package_purchases (customer_id, package_id, price, sessions_used, status, expires_at)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`, [data.customerId, data.packageId, data.price, 0, 'active', data.expiresAt]);
            return result.rows[0];
        },
        getCustomerPurchases: async (customerId, status) => {
            const pool = await (0, db_1.getDbClient)();
            const query = status
                ? 'SELECT * FROM package_purchases WHERE customer_id = $1 AND status = $2'
                : 'SELECT * FROM package_purchases WHERE customer_id = $1';
            const result = await pool.query(query, status ? [customerId, status] : [customerId]);
            return result.rows;
        },
        updatePurchase: async (purchaseId, data) => {
            const pool = await (0, db_1.getDbClient)();
            const updates = [];
            const values = [];
            let paramCount = 1;
            Object.keys(data).forEach(key => {
                updates.push(`${key} = $${paramCount++}`);
                values.push(data[key]);
            });
            values.push(purchaseId);
            const result = await pool.query(`UPDATE package_purchases SET ${updates.join(', ')}, updated_at = NOW() WHERE id = $${paramCount} RETURNING *`, values);
            return result.rows[0];
        },
        getPurchaseById: async (purchaseId) => {
            const pool = await (0, db_1.getDbClient)();
            const result = await pool.query('SELECT * FROM package_purchases WHERE id = $1', [purchaseId]);
            return result.rows[0] || null;
        }
    };
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
            return (0, response_utils_1.sendSuccess)(c, {
                packageId: newPackage.packageId,
                package: newPackage
            });
        }
        catch (error) {
            console.error('❌ [PACKAGE-SQL] Error creating package:', error);
            return (0, response_utils_1.sendError)(c, error, 500);
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
            return (0, response_utils_1.sendSuccess)(c, {
                packages: packages || [],
                total: packages?.length || 0
            });
        }
        catch (error) {
            console.error('❌ [PACKAGE-SQL] Error fetching packages:', error);
            return (0, response_utils_1.sendError)(c, error, 500);
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
                return (0, response_utils_1.sendError)(c, 'Package not found', 404);
            }
            if (existingPackage.vendorId !== vendorId) {
                return (0, response_utils_1.sendError)(c, 'Unauthorized', 403);
            }
            // Map updates to repository format
            const updateData = {};
            if (updates.packageName)
                updateData.name = updates.packageName;
            if (updates.description !== undefined)
                updateData.description = updates.description;
            if (updates.packagePrice !== undefined)
                updateData.price = parseFloat(updates.packagePrice);
            if (updates.totalSessions !== undefined)
                updateData.totalSessions = updates.totalSessions;
            if (updates.validityPeriod !== undefined)
                updateData.validityDays = updates.validityPeriod;
            const updatedPackage = await packagesRepo.updatePackage(packageId, updateData);
            if (!updatedPackage) {
                return (0, response_utils_1.sendError)(c, 'Failed to update package', 500);
            }
            console.log('✅ [PACKAGE-SQL] Package updated:', packageId);
            return (0, response_utils_1.sendSuccess)(c, {
                package: updatedPackage
            });
        }
        catch (error) {
            console.error('❌ [PACKAGE-SQL] Error updating package:', error);
            return (0, response_utils_1.sendError)(c, error, 500);
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
                return (0, response_utils_1.sendError)(c, 'Package not found', 404);
            }
            if (existingPackage.vendorId !== vendorId) {
                return (0, response_utils_1.sendError)(c, 'Unauthorized', 403);
            }
            // Check if package has active purchases
            const pool = await (0, db_1.getDbClient)();
            const activePurchasesResult = await pool.query('SELECT id FROM package_purchases WHERE package_id = $1 AND status = $2', [packageId, 'active']);
            const activePurchases = activePurchasesResult.rows || [];
            if (activePurchases.length > 0) {
                return (0, response_utils_1.sendError)(c, `Cannot delete package with ${activePurchases.length} active purchases`, 400);
            }
            const deleted = await packagesRepo.deletePackage(packageId);
            if (!deleted) {
                return (0, response_utils_1.sendError)(c, 'Failed to delete package', 500);
            }
            console.log('✅ [PACKAGE-SQL] Package deleted:', packageId);
            return (0, response_utils_1.sendSuccess)(c, {});
        }
        catch (error) {
            console.error('❌ [PACKAGE-SQL] Error deleting package:', error);
            return (0, response_utils_1.sendError)(c, error, 500);
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
            return (0, response_utils_1.sendSuccess)(c, {
                analytics
            });
        }
        catch (error) {
            console.error('❌ [PACKAGE-SQL] Error fetching sales:', error);
            return (0, response_utils_1.sendError)(c, error, 500);
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
            const pool = await (0, db_1.getDbClient)();
            const packagesResult = await pool.query('SELECT * FROM service_packages WHERE is_active = $1', [true]);
            const packages = packagesResult.rows || [];
            // Apply filters
            let filteredPackages = packages || [];
            if (vendorId) {
                filteredPackages = filteredPackages.filter((pkg) => pkg.vendor_id === vendorId);
            }
            // Enrich with vendor details
            const enrichedPackages = await Promise.all(filteredPackages.map(async (pkg) => {
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
            }));
            console.log('✅ [PACKAGE-SQL] Found packages:', enrichedPackages.length);
            return (0, response_utils_1.sendSuccess)(c, {
                packages: enrichedPackages,
                total: enrichedPackages.length
            });
        }
        catch (error) {
            console.error('❌ [PACKAGE-SQL] Error browsing packages:', error);
            return (0, response_utils_1.sendError)(c, error, 500);
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
                return (0, response_utils_1.sendError)(c, 'Package not found', 404);
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
            return (0, response_utils_1.sendSuccess)(c, {
                package: enrichedPackage
            });
        }
        catch (error) {
            console.error('❌ [PACKAGE-SQL] Error fetching package:', error);
            return (0, response_utils_1.sendError)(c, error, 500);
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
                return (0, response_utils_1.sendError)(c, 'Package not found', 404);
            }
            if (!packageObj.isActive) {
                return (0, response_utils_1.sendError)(c, 'Package not available', 400);
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
            return (0, response_utils_1.sendSuccess)(c, {
                purchaseId: purchase.id,
                purchase
            });
        }
        catch (error) {
            console.error('❌ [PACKAGE-SQL] Error processing purchase:', error);
            return (0, response_utils_1.sendError)(c, error, 500);
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
                return (0, response_utils_1.sendError)(c, 'customerId query parameter is required', 400);
            }
            console.log('📋 [PACKAGE-SQL] Fetching customer packages (query param):', customerId);
            const purchases = await packagesRepo.getCustomerPurchases(customerId, status || undefined);
            // Check and update expired packages
            const now = new Date();
            const updatedPurchases = await Promise.all(purchases.map(async (purchase) => {
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
            }));
            console.log('✅ [PACKAGE-SQL] Found customer packages:', updatedPurchases.length);
            return (0, response_utils_1.sendSuccess)(c, {
                packages: updatedPurchases,
                total: updatedPurchases.length
            });
        }
        catch (error) {
            console.error('❌ [PACKAGE-SQL] Error fetching customer packages:', error);
            return (0, response_utils_1.sendError)(c, error, 500);
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
            const pool1 = await (0, db_1.getDbClient)();
            const filters = { customer_id: customerId };
            if (status)
                filters.status = status;
            let purchases = await (0, db_1.selectQuery)('package_purchases', filters);
            // Check and update expired packages
            const now = new Date();
            const updatedPurchases = await Promise.all(purchases.map(async (purchase) => {
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
            }));
            console.log('✅ [PACKAGE-SQL] Found customer packages:', updatedPurchases.length);
            return (0, response_utils_1.sendSuccess)(c, {
                packages: updatedPurchases,
                total: updatedPurchases.length
            });
        }
        catch (error) {
            console.error('❌ [PACKAGE-SQL] Error fetching customer packages:', error);
            return (0, response_utils_1.sendError)(c, error, 500);
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
            const dbPool8 = await (0, db_1.getDbClient)();
            const [purchase] = await (0, db_1.selectQuery)('package_purchases', { purchase_id: purchaseId }, { limit: 1 });
            if (!purchase) {
                return (0, response_utils_1.sendError)(c, 'Package not found', 404);
            }
            if (purchase.customer_id !== customerId) {
                return (0, response_utils_1.sendError)(c, 'Unauthorized', 403);
            }
            if (purchase.status !== 'active') {
                return (0, response_utils_1.sendError)(c, `Package is ${purchase.status}`, 400);
            }
            // Check validity
            if (purchase.expires_at && new Date(purchase.expires_at) < new Date()) {
                await (0, db_1.updateQuery)('package_purchases', { purchase_id: purchaseId }, { status: 'expired', updated_at: new Date().toISOString() });
                return (0, response_utils_1.sendError)(c, 'Package expired', 400);
            }
            // Check remaining sessions
            if (!purchase.unlimited_usage) {
                if (purchase.remaining_sessions <= 0) {
                    await (0, db_1.updateQuery)('package_purchases', { purchase_id: purchaseId }, { status: 'used_up', updated_at: new Date().toISOString() });
                    return (0, response_utils_1.sendError)(c, 'No sessions remaining', 400);
                }
                // Decrement remaining sessions
                await (0, db_1.updateQuery)('package_purchases', { purchase_id: purchaseId }, {
                    remaining_sessions: purchase.remaining_sessions - 1,
                    updated_at: new Date().toISOString()
                });
            }
            // Create package session record
            const dbPool9 = await (0, db_1.getDbClient)();
            const sessionRecords = await (0, db_1.insertQuery)('package_sessions', {
                package_purchase_id: purchase.id,
                customer_id: customerId,
                vendor_id: purchase.vendor_id,
                booking_id: bookingId || null,
                session_number: purchase.total_sessions - (purchase.remaining_sessions - 1),
                status: 'completed',
                redeemed_at: new Date().toISOString(),
                completed_at: new Date().toISOString(),
            });
            const session = sessionRecords[0];
            if (!session) {
                console.error('Error creating package session: No session returned');
            }
            const [updatedPurchase] = await (0, db_1.selectQuery)('package_purchases', { purchase_id: purchaseId }, { limit: 1 });
            console.log('✅ [PACKAGE-SQL] Session redeemed. Remaining:', updatedPurchase?.remaining_sessions);
            return (0, response_utils_1.sendSuccess)(c, {
                remainingSessions: updatedPurchase?.remaining_sessions || 0,
                unlimitedUsage: purchase.unlimited_usage,
                usage: session
            });
        }
        catch (error) {
            console.error('❌ [PACKAGE-SQL] Error redeeming session:', error);
            return (0, response_utils_1.sendError)(c, error, 500);
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
                return (0, response_utils_1.sendError)(c, 'Package not found', 404);
            }
            if (purchase.customer_id !== customerId) {
                return (0, response_utils_1.sendError)(c, 'Unauthorized', 403);
            }
            // Get package sessions
            const pool = await (0, db_1.getDbClient)();
            const sessionsResult = await pool.query('SELECT * FROM package_sessions WHERE package_purchase_id = $1 ORDER BY redeemed_at DESC', [purchase.id]);
            const sessions = sessionsResult.rows || [];
            return (0, response_utils_1.sendSuccess)(c, {
                usageHistory: sessions || [],
                totalUsed: sessions?.length || 0,
                remainingSessions: purchase.remaining_sessions,
                unlimitedUsage: purchase.unlimited_usage
            });
        }
        catch (error) {
            console.error('❌ [PACKAGE-SQL] Error fetching history:', error);
            return (0, response_utils_1.sendError)(c, error, 500);
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
            const pool = await (0, db_1.getDbClient)();
            const packagesResult = await pool.query('SELECT * FROM service_packages WHERE is_active = $1', [false]);
            const packages = packagesResult.rows || [];
            // Enrich with vendor details
            const enrichedPackages = await Promise.all((packages || []).map(async (pkg) => {
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
            }));
            console.log('✅ [ADMIN-PACKAGE-SQL] Found pending packages:', enrichedPackages.length);
            return (0, response_utils_1.sendSuccess)(c, {
                packages: enrichedPackages,
                total: enrichedPackages.length
            });
        }
        catch (error) {
            console.error('❌ [ADMIN-PACKAGE-SQL] Error fetching pending packages:', error);
            return (0, response_utils_1.sendError)(c, error, 500);
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
            const pool = await (0, db_1.getDbClient)();
            const [packageObj] = await (0, db_1.selectQuery)('service_packages', { id: packageId }, { limit: 1 });
            if (!packageObj) {
                return (0, response_utils_1.sendError)(c, 'Package not found', 404);
            }
            // Update package status
            const [updatedPackage] = await (0, db_1.updateQuery)('service_packages', { id: packageId }, {
                is_active: action === 'approved',
                updated_at: new Date().toISOString()
            });
            if (!updatedPackage) {
                return (0, response_utils_1.sendError)(c, 'Failed to update package', 500);
            }
            console.log('✅ [ADMIN-PACKAGE-SQL] Package reviewed:', packageId);
            return (0, response_utils_1.sendSuccess)(c, {
                package: updatedPackage
            });
        }
        catch (error) {
            console.error('❌ [ADMIN-PACKAGE-SQL] Error reviewing package:', error);
            return (0, response_utils_1.sendError)(c, error, 500);
        }
    });
    console.log('✅ Package endpoints (SQL) registered');
}
//# sourceMappingURL=package-endpoints-sql.js.map