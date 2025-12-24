/**
 * ============================================================================
 * ECOMMERCE ROUTES - SQL-ONLY VERSION
 * ============================================================================
 * 
 * REFACTORED: Removed all KV usage, using SQL repositories only
 * 
 * Features:
 * - Commission settings management
 * - Category management
 * - Product/Order/Inventory management
 * - Analytics
 * - Returns management
 * 
 * RULES:
 * ❌ NO KV imports allowed
 * ✅ All operations use SQL only
 * 
 * Date: 2024-12-23
 * Migration: Phase 1, Task 1.5 - KV to SQL
 * ============================================================================
 */

import { Hono } from 'npm:hono';
import { sendSuccess, sendError } from './response-utils.ts';
import { getEcommerceCategoriesRepository } from '../../lib/repositories/ecommerce-categories.ts';
import { getPlatformSettingsRepository } from '../../lib/repositories/platform-settings.ts';
import { getProductsRepository } from '../../lib/repositories/products.ts';
import { getOrdersRepository } from '../../lib/repositories/orders.ts';
import { getVendorsRepository } from '../../lib/repositories/vendors.ts';
import { getCommissionsRepository } from '../../lib/repositories/commissions.ts';
import { getDbClient } from '../../lib/db.ts';

const BASE_PATH = '/make-server-3dd53475';

export function ecommerceRoutesSQL(app: Hono) {
  const categoriesRepo = getEcommerceCategoriesRepository();
  const platformSettingsRepo = getPlatformSettingsRepository();
  const productsRepo = getProductsRepository();
  const ordersRepo = getOrdersRepository();
  const vendorsRepo = getVendorsRepository();
  const commissionsRepo = getCommissionsRepository();
  const db = getDbClient();

  // Helper: Resolve vendor ID
  async function resolveVendorId(identifier: string): Promise<string | null> {
    return await vendorsRepo.resolveVendorId(identifier);
  }

  // ============================================
  // COMMISSION SETTINGS
  // ============================================

  /**
   * GET /ecommerce/commission/settings
   * Get commission settings
   */
  app.get(`${BASE_PATH}/ecommerce/commission/settings`, async (c) => {
    try {
      // ✅ SQL: Get commission settings from platform_settings
      const { data: settings, error } = await db
        .from('platform_settings')
        .select('*')
        .eq('setting_key', 'ecommerce_commission')
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      const defaultSettings = {
        defaultRate: 15,
        rules: [],
        vendorTiers: []
      };

      const commissionSettings = settings?.setting_value || defaultSettings;

      console.log(`✅ [ECOMMERCE-ROUTES-SQL] Fetched commission settings`);
      return sendSuccess(c, { settings: commissionSettings });
    } catch (error) {
      console.error('❌ [ECOMMERCE-ROUTES-SQL] Error fetching commission settings:', error);
      return sendError(c, `Failed to fetch commission settings: ${String(error)}`, 500);
    }
  });

  /**
   * PUT /ecommerce/commission/settings
   * Update commission settings
   */
  app.put(`${BASE_PATH}/ecommerce/commission/settings`, async (c) => {
    try {
      const settings = await c.req.json();

      // ✅ SQL: Upsert commission settings
      const { data, error } = await db
        .from('platform_settings')
        .upsert({
          setting_key: 'ecommerce_commission',
          setting_value: settings,
          setting_type: 'object',
          description: 'Ecommerce commission settings',
          is_public: false,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'setting_key'
        })
        .select()
        .single();

      if (error) throw error;

      console.log(`✅ [ECOMMERCE-ROUTES-SQL] Updated commission settings`);
      return sendSuccess(c, { settings: data.setting_value, message: 'Commission settings updated' });
    } catch (error) {
      console.error('❌ [ECOMMERCE-ROUTES-SQL] Error updating commission settings:', error);
      return sendError(c, `Failed to update commission settings: ${String(error)}`, 500);
    }
  });

  /**
   * GET /ecommerce/commission/vendor/:vendorId
   * Get vendor commission rate
   */
  app.get(`${BASE_PATH}/ecommerce/commission/vendor/:vendorId`, async (c) => {
    try {
      const { vendorId: paramVendorId } = c.req.param();

      // ✅ CRITICAL FIX: Resolve vendorId to UUID
      const resolvedVendorId = await resolveVendorId(paramVendorId);
      
      if (!resolvedVendorId) {
        return sendError(c, 'Vendor not found or invalid ID format', 404);
      }

      // ✅ SQL: Get commission settings
      const { data: settings } = await db
        .from('platform_settings')
        .select('*')
        .eq('setting_key', 'ecommerce_commission')
        .maybeSingle();

      const defaultRate = 15;
      const commissionSettings = settings?.setting_value || { defaultRate };
      const rate = commissionSettings.sellerRates?.[paramVendorId] || commissionSettings.defaultRate || defaultRate;

      // ✅ SQL: Get vendor earnings from commissions
      const commissions = await commissionsRepo.findByVendor(resolvedVendorId);
      const totalEarnings = commissions
        .filter(c => c.status === 'completed')
        .reduce((sum, c) => sum + (c.vendor_amount || 0), 0);

      // ✅ SQL: Get pending payouts
      const { data: pendingPayouts } = await db
        .from('payouts')
        .select('amount')
        .eq('vendor_id', resolvedVendorId)
        .eq('status', 'pending');

      const pendingPayout = (pendingPayouts || []).reduce((sum: number, p: any) => sum + (p.amount || 0), 0);

      console.log(`✅ [ECOMMERCE-ROUTES-SQL] Fetched vendor commission for ${paramVendorId}`);
      return sendSuccess(c, {
        vendorId: paramVendorId,
        commissionRate: rate,
        totalEarnings,
        pendingPayout
      });
    } catch (error) {
      console.error('❌ [ECOMMERCE-ROUTES-SQL] Error fetching vendor commission:', error);
      return sendError(c, `Failed to fetch vendor commission: ${String(error)}`, 500);
    }
  });

  // ============================================
  // CATEGORIES
  // ============================================

  /**
   * GET /ecommerce/categories
   * Get all categories
   */
  app.get(`${BASE_PATH}/ecommerce/categories`, async (c) => {
    try {
      // ✅ SQL: Get categories
      let categories = await categoriesRepo.findAll({ isActive: true });

      // Seed default categories if none exist
      if (categories.length === 0) {
        await categoriesRepo.seedDefaultCategories();
        categories = await categoriesRepo.findAll({ isActive: true });
      }

      const categoriesResponse = categories.map(cat => ({
        id: cat.id,
        name: cat.name,
        description: cat.description,
        parentCategoryId: cat.parent_category_id,
        displayOrder: cat.display_order,
        isActive: cat.is_active,
      }));

      console.log(`✅ [ECOMMERCE-ROUTES-SQL] Fetched ${categoriesResponse.length} categories`);
      return sendSuccess(c, { categories: categoriesResponse });
    } catch (error) {
      console.error('❌ [ECOMMERCE-ROUTES-SQL] Error fetching categories:', error);
      return sendError(c, `Failed to fetch categories: ${String(error)}`, 500);
    }
  });

  /**
   * PUT /ecommerce/categories
   * Update categories (bulk)
   */
  app.put(`${BASE_PATH}/ecommerce/categories`, async (c) => {
    try {
      const { categories } = await c.req.json();

      if (!Array.isArray(categories)) {
        return sendError(c, 'Categories must be an array', 400);
      }

      // ✅ SQL: Update or create categories
      const results = [];
      for (const cat of categories) {
        if (cat.id) {
          // Update existing
          const updated = await categoriesRepo.update(cat.id, {
            name: cat.name,
            description: cat.description,
            parent_category_id: cat.parentCategoryId,
            display_order: cat.displayOrder,
            is_active: cat.isActive,
          });
          results.push(updated);
        } else {
          // Create new
          const created = await categoriesRepo.create({
            name: cat.name,
            description: cat.description,
            parent_category_id: cat.parentCategoryId,
            display_order: cat.displayOrder,
            is_active: cat.isActive,
          });
          results.push(created);
        }
      }

      console.log(`✅ [ECOMMERCE-ROUTES-SQL] Updated ${results.length} categories`);
      return sendSuccess(c, { categories: results, message: 'Categories updated' });
    } catch (error) {
      console.error('❌ [ECOMMERCE-ROUTES-SQL] Error updating categories:', error);
      return sendError(c, `Failed to update categories: ${String(error)}`, 500);
    }
  });

  /**
   * POST /ecommerce/categories
   * Create category
   */
  app.post(`${BASE_PATH}/ecommerce/categories`, async (c) => {
    try {
      const categoryData = await c.req.json();

      if (!categoryData.name) {
        return sendError(c, 'Category name is required', 400);
      }

      // ✅ SQL: Create category
      const category = await categoriesRepo.create({
        name: categoryData.name,
        description: categoryData.description,
        parent_category_id: categoryData.parentCategoryId,
        display_order: categoryData.displayOrder || 0,
        is_active: categoryData.isActive !== false,
      });

      console.log(`✅ [ECOMMERCE-ROUTES-SQL] Created category: ${category.id}`);
      return sendSuccess(c, { category }, 'Category created successfully');
    } catch (error) {
      console.error('❌ [ECOMMERCE-ROUTES-SQL] Error creating category:', error);
      return sendError(c, `Failed to create category: ${String(error)}`, 500);
    }
  });

  /**
   * DELETE /ecommerce/categories/:categoryId
   * Delete category
   */
  app.delete(`${BASE_PATH}/ecommerce/categories/:categoryId`, async (c) => {
    try {
      const { categoryId } = c.req.param();
      await categoriesRepo.delete(categoryId);

      console.log(`✅ [ECOMMERCE-ROUTES-SQL] Deleted category: ${categoryId}`);
      return sendSuccess(c, {}, 'Category deleted successfully');
    } catch (error) {
      console.error('❌ [ECOMMERCE-ROUTES-SQL] Error deleting category:', error);
      return sendError(c, `Failed to delete category: ${String(error)}`, 500);
    }
  });

  // ============================================
  // ADMIN PRODUCTS (PENDING)
  // ============================================

  /**
   * GET /ecommerce/admin/products/pending
   * Get pending products for approval
   */
  app.get(`${BASE_PATH}/ecommerce/admin/products/pending`, async (c) => {
    try {
      // ✅ SQL: Get pending products
      const { data: products, error } = await db
        .from('products')
        .select('*')
        .eq('is_active', false)
        .order('created_at', { ascending: false });

      if (error) throw error;

      console.log(`✅ [ECOMMERCE-ROUTES-SQL] Found ${products?.length || 0} pending products`);
      return sendSuccess(c, { products: products || [] });
    } catch (error) {
      console.error('❌ [ECOMMERCE-ROUTES-SQL] Error fetching pending products:', error);
      return sendError(c, `Failed to fetch pending products: ${String(error)}`, 500);
    }
  });

  // ============================================
  // ADMIN ORDERS
  // ============================================

  /**
   * GET /ecommerce/admin/orders
   * Get all orders (Admin)
   */
  app.get(`${BASE_PATH}/ecommerce/admin/orders`, async (c) => {
    try {
      const status = c.req.query('status');
      const limit = parseInt(c.req.query('limit') || '100');
      const offset = parseInt(c.req.query('offset') || '0');

      // ✅ SQL: Get orders
      let query = db
        .from('orders')
        .select('*')
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (status) {
        query = query.eq('order_status', status);
      }

      const { data: orders, error } = await query;

      if (error) throw error;

      console.log(`✅ [ECOMMERCE-ROUTES-SQL] Found ${orders?.length || 0} orders`);
      return sendSuccess(c, { orders: orders || [], total: orders?.length || 0 });
    } catch (error) {
      console.error('❌ [ECOMMERCE-ROUTES-SQL] Error fetching orders:', error);
      return sendError(c, `Failed to fetch orders: ${String(error)}`, 500);
    }
  });

  // ============================================
  // LOGISTICS VENDORS
  // ============================================

  /**
   * GET /ecommerce/logistics/vendors
   * Get logistics vendors
   */
  app.get(`${BASE_PATH}/ecommerce/logistics/vendors`, async (c) => {
    try {
      // ✅ SQL: Get logistics partners
      const partners = await platformSettingsRepo.getLogisticsPartners();

      const vendors = partners.map(p => ({
        id: p.partner_id,
        name: p.partner_name,
        active: p.enabled,
        rating: 4.5, // TODO: Calculate from reviews
      }));

      // Default vendors if none exist
      if (vendors.length === 0) {
        return sendSuccess(c, {
          vendors: [
            { id: 'fedex', name: 'FedEx', active: true, rating: 4.5 },
            { id: 'dhl', name: 'DHL', active: true, rating: 4.7 },
            { id: 'delhivery', name: 'Delhivery', active: true, rating: 4.2 },
            { id: 'dunzo', name: 'Dunzo', active: true, rating: 4.0 }
          ]
        });
      }

      console.log(`✅ [ECOMMERCE-ROUTES-SQL] Found ${vendors.length} logistics vendors`);
      return sendSuccess(c, { vendors });
    } catch (error) {
      console.error('❌ [ECOMMERCE-ROUTES-SQL] Error fetching logistics vendors:', error);
      return sendError(c, `Failed to fetch logistics vendors: ${String(error)}`, 500);
    }
  });

  /**
   * GET /ecommerce/logistics/vendors/available
   * Get available logistics vendors
   */
  app.get(`${BASE_PATH}/ecommerce/logistics/vendors/available`, async (c) => {
    try {
      // ✅ SQL: Get active logistics partners
      const partners = await platformSettingsRepo.getLogisticsPartners();
      const available = partners
        .filter(p => p.enabled)
        .map(p => ({
          id: p.partner_id,
          name: p.partner_name,
          active: p.enabled,
        }));

      console.log(`✅ [ECOMMERCE-ROUTES-SQL] Found ${available.length} available logistics vendors`);
      return sendSuccess(c, { vendors: available });
    } catch (error) {
      console.error('❌ [ECOMMERCE-ROUTES-SQL] Error fetching available logistics vendors:', error);
      return sendError(c, `Failed to fetch available logistics vendors: ${String(error)}`, 500);
    }
  });

  // ============================================
  // ANALYTICS
  // ============================================

  /**
   * GET /ecommerce/analytics/seller/:vendorId
   * Get seller analytics
   */
  app.get(`${BASE_PATH}/ecommerce/analytics/seller/:vendorId`, async (c) => {
    try {
      const { vendorId: paramVendorId } = c.req.param();

      // ✅ CRITICAL FIX: Resolve vendorId to UUID
      const resolvedVendorId = await resolveVendorId(paramVendorId);
      
      if (!resolvedVendorId) {
        return sendError(c, 'Vendor not found or invalid ID format', 404);
      }

      // ✅ SQL: Get vendor orders
      const orders = await ordersRepo.findByVendor(resolvedVendorId);

      // ✅ SQL: Get vendor products
      const products = await productsRepo.findByVendor(resolvedVendorId);

      // Calculate metrics
      const totalOrders = orders.length;
      const totalRevenue = orders
        .filter(o => o.order_status === 'delivered')
        .reduce((sum, o) => sum + (o.total_amount || 0), 0);

      const activeProducts = products.filter(p => p.is_active).length;
      const lowStockProducts = products.filter(p => (p.stock || 0) <= (p.min_stock || 10)).length;

      // ✅ SQL: Get commission settings
      const { data: settings } = await db
        .from('platform_settings')
        .select('*')
        .eq('setting_key', 'ecommerce_commission')
        .maybeSingle();

      const defaultRate = 15;
      const commissionSettings = settings?.setting_value || { defaultRate };
      const rate = commissionSettings.sellerRates?.[paramVendorId] || commissionSettings.defaultRate || defaultRate;
      const totalCommission = (totalRevenue * rate) / 100;
      const netEarnings = totalRevenue - totalCommission;

      const pendingOrders = orders.filter(o => o.order_status === 'pending' || o.order_status === 'confirmed').length;
      const completedOrders = orders.filter(o => o.order_status === 'delivered').length;

      console.log(`✅ [ECOMMERCE-ROUTES-SQL] Calculated analytics for vendor ${paramVendorId}`);

      return sendSuccess(c, {
        totalOrders,
        totalRevenue,
        totalCommission,
        netEarnings,
        commissionRate: rate,
        activeProducts,
        totalProducts: products.length,
        lowStockProducts,
        pendingOrders,
        completedOrders
      });
    } catch (error) {
      console.error('❌ [ECOMMERCE-ROUTES-SQL] Error fetching seller analytics:', error);
      return sendError(c, `Failed to fetch analytics: ${String(error)}`, 500);
    }
  });

  /**
   * GET /ecommerce/analytics/platform
   * Get platform analytics (Admin)
   */
  app.get(`${BASE_PATH}/ecommerce/analytics/platform`, async (c) => {
    try {
      // ✅ SQL: Get all orders
      const { data: allOrders } = await db
        .from('orders')
        .select('*');

      // ✅ SQL: Get all products
      const allProducts = await productsRepo.findAll();

      // ✅ SQL: Get all vendors
      const { data: allVendors } = await db
        .from('vendors')
        .select('id, status')
        .eq('role_id', 'pet_store'); // Filter ecommerce vendors

      const totalRevenue = (allOrders || []).reduce((sum: number, o: any) => sum + (o.total_amount || 0), 0);

      // ✅ SQL: Get commission settings
      const { data: settings } = await db
        .from('platform_settings')
        .select('*')
        .eq('setting_key', 'ecommerce_commission')
        .maybeSingle();

      const defaultRate = 15;
      const commissionSettings = settings?.setting_value || { defaultRate };
      const totalCommission = (totalRevenue * (commissionSettings.defaultRate || defaultRate)) / 100;

      console.log(`✅ [ECOMMERCE-ROUTES-SQL] Calculated platform analytics`);

      return sendSuccess(c, {
        totalSellers: allVendors?.length || 0,
        activeSellers: allVendors?.filter((v: any) => v.status === 'approved')?.length || 0,
        totalProducts: allProducts.length,
        activeProducts: allProducts.filter(p => p.is_active).length,
        totalOrders: allOrders?.length || 0,
        totalRevenue,
        totalCommission,
        pendingApprovals: allProducts.filter(p => !p.is_active).length
      });
    } catch (error) {
      console.error('❌ [ECOMMERCE-ROUTES-SQL] Error fetching platform analytics:', error);
      return sendError(c, `Failed to fetch analytics: ${String(error)}`, 500);
    }
  });

  /**
   * GET /ecommerce/analytics
   * Get detailed analytics with time series
   */
  app.get(`${BASE_PATH}/ecommerce/analytics`, async (c) => {
    try {
      const days = parseInt(c.req.query('days') || '30');
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      // ✅ SQL: Get orders in date range
      const { data: recentOrders } = await db
        .from('orders')
        .select('*')
        .gte('created_at', startDate.toISOString());

      // ✅ SQL: Get all products
      const allProducts = await productsRepo.findAll();

      // ✅ SQL: Get all vendors
      const { data: allVendors } = await db
        .from('vendors')
        .select('id, status, created_at')
        .eq('role_id', 'pet_store');

      // Calculate metrics
      const totalRevenue = (recentOrders || []).reduce((sum: number, o: any) => sum + (o.total_amount || 0), 0);

      // ✅ SQL: Get commission settings
      const { data: settings } = await db
        .from('platform_settings')
        .select('*')
        .eq('setting_key', 'ecommerce_commission')
        .maybeSingle();

      const defaultRate = 15;
      const commissionSettings = settings?.setting_value || { defaultRate };
      const totalCommission = (totalRevenue * (commissionSettings.defaultRate || defaultRate)) / 100;

      // Previous period comparison
      const prevStartDate = new Date(startDate);
      prevStartDate.setDate(prevStartDate.getDate() - days);

      const { data: prevOrders } = await db
        .from('orders')
        .select('*')
        .gte('created_at', prevStartDate.toISOString())
        .lt('created_at', startDate.toISOString());

      const prevRevenue = (prevOrders || []).reduce((sum: number, o: any) => sum + (o.total_amount || 0), 0);
      const revenueGrowth = prevRevenue > 0 ? ((totalRevenue - prevRevenue) / prevRevenue) * 100 : 0;
      const ordersGrowth = (prevOrders?.length || 0) > 0 ?
        (((recentOrders?.length || 0) - (prevOrders?.length || 0)) / (prevOrders?.length || 0)) * 100 : 0;

      // Product metrics
      const activeProducts = allProducts.filter(p => p.is_active).length;
      const pendingProducts = allProducts.filter(p => !p.is_active).length;
      const outOfStockProducts = allProducts.filter(p => (p.stock || 0) === 0).length;

      // Seller metrics
      const activeSellers = (allVendors || []).filter((v: any) => v.status === 'approved').length;
      const newSellers = (allVendors || []).filter((v: any) => {
        const createdDate = new Date(v.created_at);
        return createdDate >= startDate;
      }).length;

      // Order status breakdown
      const ordersByStatus = {
        pending: (recentOrders || []).filter((o: any) => o.order_status === 'pending').length,
        confirmed: (recentOrders || []).filter((o: any) => o.order_status === 'confirmed').length,
        processing: (recentOrders || []).filter((o: any) => o.order_status === 'processing').length,
        shipped: (recentOrders || []).filter((o: any) => o.order_status === 'shipped').length,
        delivered: (recentOrders || []).filter((o: any) => o.order_status === 'delivered').length,
        cancelled: (recentOrders || []).filter((o: any) => o.order_status === 'cancelled').length,
      };

      // Average order value
      const avgOrderValue = (recentOrders?.length || 0) > 0 ?
        totalRevenue / (recentOrders?.length || 0) : 0;

      // Top performing products
      const productSales: Record<string, { count: number; revenue: number; name: string }> = {};
      (recentOrders || []).forEach((order: any) => {
        // Get order items
        db.from('order_items')
          .select('*')
          .eq('order_id', order.id)
          .then(({ data: items }) => {
            (items || []).forEach((item: any) => {
              if (!productSales[item.product_id]) {
                productSales[item.product_id] = {
                  count: 0,
                  revenue: 0,
                  name: item.name || 'Unknown Product'
                };
              }
              productSales[item.product_id].count += item.quantity;
              productSales[item.product_id].revenue += item.total_price;
            });
          });
      });

      // Wait for product sales calculation
      await new Promise(resolve => setTimeout(resolve, 100));

      const topProducts = Object.entries(productSales)
        .map(([id, data]) => ({ productId: id, ...data }))
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 5);

      console.log(`✅ [ECOMMERCE-ROUTES-SQL] Calculated detailed analytics`);

      return sendSuccess(c, {
        dateRange: {
          start: startDate.toISOString(),
          end: new Date().toISOString(),
          days
        },
        revenue: {
          total: totalRevenue,
          growth: revenueGrowth,
          commission: totalCommission,
          avgOrderValue: Math.round(avgOrderValue),
        },
        orders: {
          total: recentOrders?.length || 0,
          growth: ordersGrowth,
          byStatus: ordersByStatus,
        },
        products: {
          total: allProducts.length,
          active: activeProducts,
          pending: pendingProducts,
          outOfStock: outOfStockProducts,
          topPerforming: topProducts,
        },
        sellers: {
          total: allVendors?.length || 0,
          active: activeSellers,
          new: newSellers,
        },
      });
    } catch (error) {
      console.error('❌ [ECOMMERCE-ROUTES-SQL] Error fetching analytics:', error);
      return sendError(c, `Failed to fetch analytics: ${String(error)}`, 500);
    }
  });

  console.log('✅ [ECOMMERCE-ROUTES-SQL] Ecommerce routes registered (SQL-only)');
}

