/**
 * ============================================================================
 * ADMIN ECOMMERCE DASHBOARD ENDPOINTS - SQL-ONLY VERSION
 * ============================================================================
 * 
 * Admin Ecommerce Dashboard
 * 
 * Features:
 * - Marketplace overview
 * - Vendor management with metrics
 * - Product management
 * - Order management
 * - Policy management
 * - Platform commission tracking
 * 
 * RULES:
 * ❌ NO KV imports allowed
 * ✅ All operations use SQL only
 * 
 * Date: 2024-12-23
 * Migration: Phase 3, Task 3.3 - Create Admin Ecommerce Dashboard
 * ============================================================================
 */

import { Hono } from "npm:hono";
import { sendSuccess, sendError } from "./response-utils.ts";
import { getVendorsRepository } from "../../lib/repositories/vendors.ts";
import { getProductsRepository } from "../../lib/repositories/products.ts";
import { getOrdersRepository } from "../../lib/repositories/orders.ts";
import { getEcommercePoliciesRepository } from "../../lib/repositories/ecommerce-policies.ts";
import { getSettlementsRepository } from "../../lib/repositories/settlements.ts";
import { getPaymentsRepository } from "../../lib/repositories/payments.ts";
import { getCustomersRepository } from "../../lib/repositories/customers.ts";
import { getDbClient } from "../../lib/db.ts";

export function adminEcommerceDashboardEndpointsSQL(app: Hono) {
  const BASE_PATH = "/make-server-3dd53475";
  const vendorsRepo = getVendorsRepository();
  const productsRepo = getProductsRepository();
  const ordersRepo = getOrdersRepository();
  const policiesRepo = getEcommercePoliciesRepository();
  const settlementsRepo = getSettlementsRepository();
  const paymentsRepo = getPaymentsRepository();
  const db = getDbClient();

  // ============================================
  // MARKETPLACE OVERVIEW
  // ============================================

  /**
   * GET /admin/ecommerce/overview
   * Get marketplace overview
   */
  app.get(`${BASE_PATH}/admin/ecommerce/overview`, async (c) => {
    try {
      const period = c.req.query('period') || 'month';

      // Calculate date range
      const now = new Date();
      let startDate: Date;
      switch (period) {
        case 'day':
          startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
          break;
        case 'week':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case 'month':
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        case 'year':
          startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
          break;
        default:
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      }

      // Get all vendors
      const allVendors = await vendorsRepo.findAll();
      const activeVendors = allVendors.filter(v => v.is_active);

      // Get all products
      const allProducts = await productsRepo.findAll({ isActive: true });
      const activeProducts = allProducts.filter(p => p.is_active);

      // Get all orders
      const allOrders = await ordersRepo.findAll();
      const filteredOrders = allOrders.filter(order => {
        const orderDate = new Date(order.created_at);
        return orderDate >= startDate;
      });

      const completedOrders = filteredOrders.filter(o => 
        o.order_status === 'delivered' || o.order_status === 'completed'
      );

      // Calculate revenue
      const totalRevenue = completedOrders.reduce((sum, o) => sum + o.total_amount, 0);

      // Get settlements for platform commission
      const allSettlements = await settlementsRepo.findAll();
      const filteredSettlements = allSettlements.filter(s => {
        const settlementDate = new Date(s.created_at);
        return settlementDate >= startDate;
      });

      const platformCommission = filteredSettlements.reduce((sum, s) => sum + s.commission_amount, 0);

      // Get payments
      const allPayments = await paymentsRepo.findAll();
      const filteredPayments = allPayments.filter(p => {
        const paymentDate = new Date(p.created_at);
        return paymentDate >= startDate;
      });

      const successfulPayments = filteredPayments.filter(p => p.status === 'completed' || p.status === 'success');
      const totalPaymentVolume = successfulPayments.reduce((sum, p) => sum + p.amount, 0);

      // Calculate growth (compare with previous period)
      const previousStartDate = new Date(startDate.getTime() - (now.getTime() - startDate.getTime()));
      const previousOrders = allOrders.filter(order => {
        const orderDate = new Date(order.created_at);
        return orderDate >= previousStartDate && orderDate < startDate;
      });
      const previousRevenue = previousOrders
        .filter(o => o.order_status === 'delivered' || o.order_status === 'completed')
        .reduce((sum, o) => sum + o.total_amount, 0);

      const revenueGrowth = previousRevenue > 0
        ? ((totalRevenue - previousRevenue) / previousRevenue) * 100
        : 0;

      return sendSuccess(c, {
        period,
        summary: {
          total_vendors: allVendors.length,
          active_vendors: activeVendors.length,
          total_products: allProducts.length,
          active_products: activeProducts.length,
          total_orders: filteredOrders.length,
          completed_orders: completedOrders.length,
          total_revenue: Math.round(totalRevenue * 100) / 100,
          platform_commission: Math.round(platformCommission * 100) / 100,
          total_payment_volume: Math.round(totalPaymentVolume * 100) / 100,
          revenue_growth: Math.round(revenueGrowth * 100) / 100,
        },
        metrics: {
          average_order_value: completedOrders.length > 0
            ? Math.round((totalRevenue / completedOrders.length) * 100) / 100
            : 0,
          order_completion_rate: filteredOrders.length > 0
            ? Math.round((completedOrders.length / filteredOrders.length) * 100 * 100) / 100
            : 0,
          products_per_vendor: activeVendors.length > 0
            ? Math.round((activeProducts.length / activeVendors.length) * 100) / 100
            : 0,
        },
      });
    } catch (error) {
      console.error('❌ [ADMIN-ECOMMERCE] Error fetching overview:', error);
      return sendError(c, `Failed to fetch overview: ${String(error)}`, 500);
    }
  });

  // ============================================
  // VENDOR MANAGEMENT
  // ============================================

  /**
   * GET /admin/ecommerce/vendors
   * Get vendor list with metrics
   */
  app.get(`${BASE_PATH}/admin/ecommerce/vendors`, async (c) => {
    try {
      const limit = parseInt(c.req.query('limit') || '50');
      const offset = parseInt(c.req.query('offset') || '0');
      const status = c.req.query('status'); // active, inactive

      const allVendors = await vendorsRepo.findAll();
      let vendors = allVendors;

      if (status === 'active') {
        vendors = vendors.filter(v => v.is_active);
      } else if (status === 'inactive') {
        vendors = vendors.filter(v => !v.is_active);
      }

      // Get metrics for each vendor
      const vendorsWithMetrics = await Promise.all(
        vendors.slice(offset, offset + limit).map(async (vendor) => {
          const vendorProducts = await productsRepo.findByVendor(vendor.id);
          const vendorOrders = await ordersRepo.findByVendor(vendor.id);
          const completedOrders = vendorOrders.filter(o => 
            o.order_status === 'delivered' || o.order_status === 'completed'
          );

          const totalRevenue = completedOrders.reduce((sum, o) => sum + o.total_amount, 0);
          const vendorSettlements = await settlementsRepo.findByVendor(vendor.id);
          const totalCommission = vendorSettlements.reduce((sum, s) => sum + s.commission_amount, 0);
          const totalPayout = vendorSettlements.reduce((sum, s) => sum + s.vendor_amount, 0);

          return {
            vendor_id: vendor.id,
            vendor_name: vendor.business_name || vendor.businessName || 'Unknown',
            vendor_phone: vendor.phone,
            vendor_email: vendor.email,
            role_id: vendor.role_id,
            is_active: vendor.is_active,
            metrics: {
              total_products: vendorProducts.length,
              active_products: vendorProducts.filter(p => p.is_active).length,
              total_orders: vendorOrders.length,
              completed_orders: completedOrders.length,
              total_revenue: Math.round(totalRevenue * 100) / 100,
              platform_commission: Math.round(totalCommission * 100) / 100,
              vendor_payout: Math.round(totalPayout * 100) / 100,
              average_order_value: completedOrders.length > 0
                ? Math.round((totalRevenue / completedOrders.length) * 100) / 100
                : 0,
            },
          };
        })
      );

      return sendSuccess(c, {
        vendors: vendorsWithMetrics,
        total: vendors.length,
        limit,
        offset,
      });
    } catch (error) {
      console.error('❌ [ADMIN-ECOMMERCE] Error fetching vendors:', error);
      return sendError(c, `Failed to fetch vendors: ${String(error)}`, 500);
    }
  });

  // ============================================
  // PRODUCT MANAGEMENT
  // ============================================

  /**
   * GET /admin/ecommerce/products
   * Get all products with management info
   */
  app.get(`${BASE_PATH}/admin/ecommerce/products`, async (c) => {
    try {
      const limit = parseInt(c.req.query('limit') || '50');
      const offset = parseInt(c.req.query('offset') || '0');
      const status = c.req.query('status'); // active, inactive
      const vendorId = c.req.query('vendor_id');

      let products = await productsRepo.findAll();

      if (status === 'active') {
        products = products.filter(p => p.is_active);
      } else if (status === 'inactive') {
        products = products.filter(p => !p.is_active);
      }

      if (vendorId) {
        products = products.filter(p => p.vendor_id === vendorId);
      }

      // Get vendor info and order stats for each product
      const productsWithInfo = await Promise.all(
        products.slice(offset, offset + limit).map(async (product) => {
          const vendor = product.vendor_id ? await vendorsRepo.findById(product.vendor_id) : null;

          // Get order items for this product
          const { data: orderItems } = await db
            .from('order_items')
            .select('quantity, total_price, order_id')
            .eq('product_id', product.id);

          const totalSold = orderItems?.reduce((sum, item) => sum + item.quantity, 0) || 0;
          const totalRevenue = orderItems?.reduce((sum, item) => sum + item.total_price, 0) || 0;

          return {
            product_id: product.id,
            product_name: product.name,
            sku: product.sku,
            category: product.category,
            vendor_id: product.vendor_id,
            vendor_name: vendor?.business_name || vendor?.businessName || 'Unknown',
            price: product.price,
            cost_price: product.cost_price || 0,
            stock: product.stock,
            is_active: product.is_active,
            sales: {
              total_sold: totalSold,
              total_revenue: Math.round(totalRevenue * 100) / 100,
            },
          };
        })
      );

      return sendSuccess(c, {
        products: productsWithInfo,
        total: products.length,
        limit,
        offset,
      });
    } catch (error) {
      console.error('❌ [ADMIN-ECOMMERCE] Error fetching products:', error);
      return sendError(c, `Failed to fetch products: ${String(error)}`, 500);
    }
  });

  // ============================================
  // ORDER MANAGEMENT
  // ============================================

  /**
   * GET /admin/ecommerce/orders
   * Get all orders for admin
   */
  app.get(`${BASE_PATH}/admin/ecommerce/orders`, async (c) => {
    try {
      const limit = parseInt(c.req.query('limit') || '50');
      const offset = parseInt(c.req.query('offset') || '0');
      const status = c.req.query('status');
      const vendorId = c.req.query('vendor_id');

      let orders = await ordersRepo.findAll();

      if (status) {
        orders = orders.filter(o => o.order_status === status);
      }

      if (vendorId) {
        orders = orders.filter(o => o.vendor_id === vendorId);
      }

      // Sort by created_at desc
      orders.sort((a, b) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      // Get customer and vendor info
      const ordersWithInfo = await Promise.all(
        orders.slice(offset, offset + limit).map(async (order) => {
          const customer = await customersRepo.findById(order.customer_id);
          const vendor = order.vendor_id ? await vendorsRepo.findById(order.vendor_id) : null;

          // Get order items
          const { data: orderItems } = await db
            .from('order_items')
            .select('*')
            .eq('order_id', order.id);

          return {
            order_id: order.id,
            order_number: order.order_number,
            customer_id: order.customer_id,
            customer_name: customer?.full_name || 'Unknown',
            customer_phone: customer?.phone || '',
            vendor_id: order.vendor_id,
            vendor_name: vendor?.business_name || vendor?.businessName || 'Unknown',
            order_status: order.order_status,
            payment_status: order.payment_status,
            total_amount: order.total_amount,
            items_count: orderItems?.length || 0,
            created_at: order.created_at,
            updated_at: order.updated_at,
          };
        })
      );

      return sendSuccess(c, {
        orders: ordersWithInfo,
        total: orders.length,
        limit,
        offset,
      });
    } catch (error) {
      console.error('❌ [ADMIN-ECOMMERCE] Error fetching orders:', error);
      return sendError(c, `Failed to fetch orders: ${String(error)}`, 500);
    }
  });

  // ============================================
  // POLICY MANAGEMENT
  // ============================================

  /**
   * GET /admin/ecommerce/policies
   * Get all policies
   */
  app.get(`${BASE_PATH}/admin/ecommerce/policies`, async (c) => {
    try {
      const policyType = c.req.query('policy_type');
      const vendorId = c.req.query('vendor_id');

      // Get all vendors to fetch their policies
      const vendors = vendorId ? [await vendorsRepo.findById(vendorId)].filter(Boolean) : await vendorsRepo.findAll();

      const allPolicies: any[] = [];
      for (const vendor of vendors) {
        const policies = await policiesRepo.findByVendor(vendor.id, {
          policyType: policyType || undefined,
        });
        allPolicies.push(...policies.map(p => ({
          ...p,
          vendor_name: vendor.business_name || vendor.businessName || 'Unknown',
        })));
      }

      return sendSuccess(c, {
        policies: allPolicies,
        total: allPolicies.length,
      });
    } catch (error) {
      console.error('❌ [ADMIN-ECOMMERCE] Error fetching policies:', error);
      return sendError(c, `Failed to fetch policies: ${String(error)}`, 500);
    }
  });

  console.log('✅ [ADMIN-ECOMMERCE-SQL] Admin ecommerce dashboard endpoints registered (SQL-only)');
}

