/**
 * ============================================================================
 * SELLER ANALYTICS ENDPOINTS - SQL-ONLY VERSION
 * ============================================================================
 * 
 * Enhanced Seller Analytics for E-commerce
 * 
 * Features:
 * - Product performance analytics
 * - Sales trends analysis
 * - Customer insights
 * - Inventory analytics
 * - Revenue analytics
 * 
 * RULES:
 * ❌ NO KV imports allowed
 * ✅ All operations use SQL only
 * 
 * Date: 2024-12-23
 * Migration: Phase 3, Task 3.1 - Enhance Seller Analytics
 * ============================================================================
 */

import { Hono } from "npm:hono";
import { sendSuccess, sendError } from "./response-utils.ts";
import { getProductsRepository } from "../../lib/repositories/products.ts";
import { getVendorsRepository } from "../../lib/repositories/vendors.ts";
import { getOrdersRepository } from "../../lib/repositories/orders.ts";
import { getCustomersRepository } from "../../lib/repositories/customers.ts";
import { getReviewsRepository } from "../../lib/repositories/reviews.ts";
import { getDbClient } from "../../lib/db.ts";

export function sellerAnalyticsEndpointsSQL(app: Hono) {
  const BASE_PATH = "/make-server-3dd53475";
  const productsRepo = getProductsRepository();
  const vendorsRepo = getVendorsRepository();
  const ordersRepo = getOrdersRepository();
  const customersRepo = getCustomersRepository();
  const reviewsRepo = getReviewsRepository();
  const db = getDbClient();

  // Helper: Resolve vendor ID
  async function resolveVendorId(identifier: string): Promise<string | null> {
    return await vendorsRepo.resolveVendorId(identifier);
  }

  // ============================================
  // PRODUCT PERFORMANCE ANALYTICS
  // ============================================

  /**
   * GET /vendor/:vendorId/analytics/products
   * Get product performance analytics
   */
  app.get(`${BASE_PATH}/vendor/:vendorId/analytics/products`, async (c) => {
    try {
      const { vendorId: paramVendorId } = c.req.param();
      const period = c.req.query('period') || 'month';
      const limit = parseInt(c.req.query('limit') || '50');

      const resolvedVendorId = await resolveVendorId(paramVendorId);
      if (!resolvedVendorId) {
        return sendError(c, 'Vendor not found or invalid ID format', 404);
      }

      // Get all products
      const products = await productsRepo.findByVendor(resolvedVendorId);

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

      // Get orders in period
      const orders = await ordersRepo.findByVendor(resolvedVendorId);
      const filteredOrders = orders.filter(order => {
        const orderDate = new Date(order.created_at);
        return orderDate >= startDate && order.order_status !== 'cancelled';
      });

      const orderIds = filteredOrders.map(o => o.id);
      const { data: orderItems } = await db
        .from('order_items')
        .select('*')
        .in('order_id', orderIds.length > 0 ? orderIds : ['00000000-0000-0000-0000-000000000000']);

      // Get reviews for products
      const { data: productReviews } = await db
        .from('reviews')
        .select('*')
        .in('product_id', products.map(p => p.id).filter(Boolean));

      // Calculate product performance
      const productPerformance = products.map(product => {
        const items = (orderItems || []).filter(item => item.product_id === product.id);
        const totalSold = items.reduce((sum, item) => sum + item.quantity, 0);
        const totalRevenue = items.reduce((sum, item) => sum + item.total_price, 0);
        const totalCost = (product.cost_price || 0) * totalSold;
        const totalProfit = totalRevenue - totalCost;
        const margin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;

        // Get reviews for this product
        const reviews = (productReviews || []).filter(r => r.product_id === product.id);
        const avgRating = reviews.length > 0
          ? reviews.reduce((sum, r) => sum + (r.rating || 0), 0) / reviews.length
          : 0;

        // Calculate views (if we had a views table, would query it here)
        // For now, estimate based on orders (conversion rate assumption)
        const estimatedViews = totalSold > 0 ? Math.round(totalSold / 0.05) : 0; // 5% conversion rate assumption
        const conversionRate = estimatedViews > 0 ? (totalSold / estimatedViews) * 100 : 0;

        return {
          product_id: product.id,
          product_name: product.name,
          sku: product.sku,
          category: product.category,
          price: product.price,
          cost_price: product.cost_price || 0,
          stock: product.stock,
          is_active: product.is_active,
          // Sales metrics
          total_sold: totalSold,
          total_revenue: Math.round(totalRevenue * 100) / 100,
          total_cost: Math.round(totalCost * 100) / 100,
          total_profit: Math.round(totalProfit * 100) / 100,
          margin_percentage: Math.round(margin * 100) / 100,
          // Engagement metrics
          estimated_views: estimatedViews,
          conversion_rate: Math.round(conversionRate * 100) / 100,
          // Review metrics
          total_reviews: reviews.length,
          average_rating: Math.round(avgRating * 100) / 100,
          // Performance indicators
          is_best_seller: totalSold >= 10, // Threshold: 10+ units sold
          is_low_performer: totalSold === 0 && product.is_active,
          needs_restock: product.stock <= (product.min_stock || 5),
        };
      });

      // Sort by revenue (best sellers first)
      productPerformance.sort((a, b) => b.total_revenue - a.total_revenue);

      // Get top and bottom performers
      const bestSellers = productPerformance.filter(p => p.is_best_seller).slice(0, 10);
      const lowPerformers = productPerformance.filter(p => p.is_low_performer).slice(0, 10);
      const needsRestock = productPerformance.filter(p => p.needs_restock);

      return sendSuccess(c, {
        period,
        summary: {
          total_products: products.length,
          active_products: products.filter(p => p.is_active).length,
          total_sold: productPerformance.reduce((sum, p) => sum + p.total_sold, 0),
          total_revenue: productPerformance.reduce((sum, p) => sum + p.total_revenue, 0),
          total_profit: productPerformance.reduce((sum, p) => sum + p.total_profit, 0),
          average_margin: productPerformance.length > 0
            ? productPerformance.reduce((sum, p) => sum + p.margin_percentage, 0) / productPerformance.length
            : 0,
        },
        products: productPerformance.slice(0, limit),
        best_sellers: bestSellers,
        low_performers: lowPerformers,
        needs_restock: needsRestock,
      });
    } catch (error) {
      console.error('❌ [SELLER-ANALYTICS] Error fetching product analytics:', error);
      return sendError(c, `Failed to fetch product analytics: ${String(error)}`, 500);
    }
  });

  // ============================================
  // SALES TRENDS ANALYTICS
  // ============================================

  /**
   * GET /vendor/:vendorId/analytics/sales-trends
   * Get sales trends analysis
   */
  app.get(`${BASE_PATH}/vendor/:vendorId/analytics/sales-trends`, async (c) => {
    try {
      const { vendorId: paramVendorId } = c.req.param();
      const period = c.req.query('period') || 'month'; // day, week, month, year
      const granularity = c.req.query('granularity') || 'day'; // hour, day, week, month

      const resolvedVendorId = await resolveVendorId(paramVendorId);
      if (!resolvedVendorId) {
        return sendError(c, 'Vendor not found or invalid ID format', 404);
      }

      // Get orders
      const orders = await ordersRepo.findByVendor(resolvedVendorId);
      const completedOrders = orders.filter(o => 
        o.order_status === 'delivered' || o.order_status === 'completed'
      );

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

      const filteredOrders = completedOrders.filter(order => {
        const orderDate = new Date(order.created_at);
        return orderDate >= startDate;
      });

      // Group by time period
      const trends: Record<string, any> = {};
      const categoryRevenue: Record<string, number> = {};

      for (const order of filteredOrders) {
        const orderDate = new Date(order.created_at);
        let key: string;

        if (granularity === 'hour') {
          key = `${orderDate.toISOString().split('T')[0]} ${orderDate.getHours()}:00`;
        } else if (granularity === 'day') {
          key = orderDate.toISOString().split('T')[0];
        } else if (granularity === 'week') {
          const weekStart = new Date(orderDate);
          weekStart.setDate(weekStart.getDate() - weekStart.getDay());
          key = weekStart.toISOString().split('T')[0];
        } else {
          key = `${orderDate.getFullYear()}-${String(orderDate.getMonth() + 1).padStart(2, '0')}`;
        }

        if (!trends[key]) {
          trends[key] = {
            period: key,
            orders: 0,
            revenue: 0,
            average_order_value: 0,
          };
        }

        trends[key].orders += 1;
        trends[key].revenue += order.total_amount;

        // Get order items for category breakdown
        const { data: orderItems } = await db
          .from('order_items')
          .select('product_id, total_price')
          .eq('order_id', order.id);

        for (const item of orderItems || []) {
          if (item.product_id) {
            const product = await productsRepo.findById(item.product_id);
            if (product?.category) {
              categoryRevenue[product.category] = (categoryRevenue[product.category] || 0) + item.total_price;
            }
          }
        }
      }

      // Calculate AOV for each period
      Object.keys(trends).forEach(key => {
        trends[key].average_order_value = trends[key].orders > 0
          ? trends[key].revenue / trends[key].orders
          : 0;
      });

      const trendArray = Object.values(trends).sort((a: any, b: any) => 
        a.period.localeCompare(b.period)
      );

      // Calculate metrics
      const totalRevenue = filteredOrders.reduce((sum, o) => sum + o.total_amount, 0);
      const totalOrders = filteredOrders.length;
      const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

      // Calculate growth (compare first half vs second half)
      const midpoint = Math.floor(trendArray.length / 2);
      const firstHalfRevenue = trendArray.slice(0, midpoint).reduce((sum: number, t: any) => sum + t.revenue, 0);
      const secondHalfRevenue = trendArray.slice(midpoint).reduce((sum: number, t: any) => sum + t.revenue, 0);
      const growthRate = firstHalfRevenue > 0 ? ((secondHalfRevenue - firstHalfRevenue) / firstHalfRevenue) * 100 : 0;

      return sendSuccess(c, {
        period,
        granularity,
        summary: {
          total_orders: totalOrders,
          total_revenue: Math.round(totalRevenue * 100) / 100,
          average_order_value: Math.round(averageOrderValue * 100) / 100,
          growth_rate: Math.round(growthRate * 100) / 100,
        },
        trends: trendArray,
        category_breakdown: Object.entries(categoryRevenue)
          .map(([category, revenue]) => ({
            category,
            revenue: Math.round(revenue * 100) / 100,
            percentage: Math.round((revenue / totalRevenue) * 100 * 100) / 100,
          }))
          .sort((a, b) => b.revenue - a.revenue),
      });
    } catch (error) {
      console.error('❌ [SELLER-ANALYTICS] Error fetching sales trends:', error);
      return sendError(c, `Failed to fetch sales trends: ${String(error)}`, 500);
    }
  });

  // ============================================
  // CUSTOMER INSIGHTS
  // ============================================

  /**
   * GET /vendor/:vendorId/analytics/customers
   * Get customer insights
   */
  app.get(`${BASE_PATH}/vendor/:vendorId/analytics/customers`, async (c) => {
    try {
      const { vendorId: paramVendorId } = c.req.param();
      const period = c.req.query('period') || 'month';

      const resolvedVendorId = await resolveVendorId(paramVendorId);
      if (!resolvedVendorId) {
        return sendError(c, 'Vendor not found or invalid ID format', 404);
      }

      // Get orders
      const orders = await ordersRepo.findByVendor(resolvedVendorId);
      const completedOrders = orders.filter(o => 
        o.order_status === 'delivered' || o.order_status === 'completed'
      );

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

      const filteredOrders = completedOrders.filter(order => {
        const orderDate = new Date(order.created_at);
        return orderDate >= startDate;
      });

      // Get all orders (for lifetime value calculation)
      const allOrders = await ordersRepo.findByVendor(resolvedVendorId);
      const allCompletedOrders = allOrders.filter(o => 
        o.order_status === 'delivered' || o.order_status === 'completed'
      );

      // Calculate customer metrics
      const customerMap: Record<string, any> = {};

      for (const order of allCompletedOrders) {
        if (!customerMap[order.customer_id]) {
          const customer = await customersRepo.findById(order.customer_id);
          customerMap[order.customer_id] = {
            customer_id: order.customer_id,
            customer_name: customer?.full_name || 'Unknown',
            customer_phone: customer?.phone || '',
            total_orders: 0,
            total_spent: 0,
            first_order_date: order.created_at,
            last_order_date: order.created_at,
            average_order_value: 0,
            is_repeat_customer: false,
          };
        }

        const customer = customerMap[order.customer_id];
        customer.total_orders += 1;
        customer.total_spent += order.total_amount;
        if (new Date(order.created_at) < new Date(customer.first_order_date)) {
          customer.first_order_date = order.created_at;
        }
        if (new Date(order.created_at) > new Date(customer.last_order_date)) {
          customer.last_order_date = order.created_at;
        }
      }

      // Calculate averages and flags
      Object.values(customerMap).forEach((customer: any) => {
        customer.average_order_value = customer.total_orders > 0
          ? customer.total_spent / customer.total_orders
          : 0;
        customer.is_repeat_customer = customer.total_orders > 1;
      });

      const customerList = Object.values(customerMap);

      // Filter to period
      const periodCustomers = customerList.filter((c: any) => {
        const lastOrderDate = new Date(c.last_order_date);
        return lastOrderDate >= startDate;
      });

      // Calculate metrics
      const totalCustomers = customerList.length;
      const newCustomers = periodCustomers.filter((c: any) => {
        const firstOrderDate = new Date(c.first_order_date);
        return firstOrderDate >= startDate;
      }).length;
      const repeatCustomers = customerList.filter((c: any) => c.is_repeat_customer).length;
      const repeatPurchaseRate = totalCustomers > 0 ? (repeatCustomers / totalCustomers) * 100 : 0;

      const totalRevenue = periodCustomers.reduce((sum: number, c: any) => sum + c.total_spent, 0);
      const customerAcquisitionCost = 0; // Would need marketing spend data
      const customerLifetimeValue = customerList.reduce((sum: number, c: any) => sum + c.total_spent, 0) / totalCustomers || 0;

      // Top customers
      const topCustomers = customerList
        .sort((a: any, b: any) => b.total_spent - a.total_spent)
        .slice(0, 10);

      return sendSuccess(c, {
        period,
        summary: {
          total_customers: totalCustomers,
          new_customers: newCustomers,
          repeat_customers: repeatCustomers,
          repeat_purchase_rate: Math.round(repeatPurchaseRate * 100) / 100,
          customer_lifetime_value: Math.round(customerLifetimeValue * 100) / 100,
          customer_acquisition_cost: customerAcquisitionCost,
          total_revenue: Math.round(totalRevenue * 100) / 100,
        },
        top_customers: topCustomers.map((c: any) => ({
          customer_id: c.customer_id,
          customer_name: c.customer_name,
          total_orders: c.total_orders,
          total_spent: Math.round(c.total_spent * 100) / 100,
          average_order_value: Math.round(c.average_order_value * 100) / 100,
          is_repeat_customer: c.is_repeat_customer,
        })),
        customer_segments: {
          high_value: customerList.filter((c: any) => c.total_spent >= 10000).length,
          medium_value: customerList.filter((c: any) => c.total_spent >= 5000 && c.total_spent < 10000).length,
          low_value: customerList.filter((c: any) => c.total_spent < 5000).length,
        },
      });
    } catch (error) {
      console.error('❌ [SELLER-ANALYTICS] Error fetching customer insights:', error);
      return sendError(c, `Failed to fetch customer insights: ${String(error)}`, 500);
    }
  });

  // ============================================
  // INVENTORY ANALYTICS
  // ============================================

  /**
   * GET /vendor/:vendorId/analytics/inventory
   * Get inventory analytics
   */
  app.get(`${BASE_PATH}/vendor/:vendorId/analytics/inventory`, async (c) => {
    try {
      const { vendorId: paramVendorId } = c.req.param();

      const resolvedVendorId = await resolveVendorId(paramVendorId);
      if (!resolvedVendorId) {
        return sendError(c, 'Vendor not found or invalid ID format', 404);
      }

      const products = await productsRepo.findByVendor(resolvedVendorId);

      // Get order items for turnover calculation
      const orders = await ordersRepo.findByVendor(resolvedVendorId);
      const completedOrders = orders.filter(o => 
        o.order_status === 'delivered' || o.order_status === 'completed'
      );

      const orderIds = completedOrders.map(o => o.id);
      const { data: orderItems } = await db
        .from('order_items')
        .select('*')
        .in('order_id', orderIds.length > 0 ? orderIds : ['00000000-0000-0000-0000-000000000000']);

      // Calculate inventory metrics
      let totalInventoryValue = 0;
      let totalInventoryCost = 0;
      const lowStockProducts: any[] = [];
      const outOfStockProducts: any[] = [];
      const overstockProducts: any[] = [];
      const turnoverData: Record<string, any> = {};

      for (const product of products) {
        const costValue = (product.cost_price || 0) * product.stock;
        const retailValue = product.price * product.stock;

        totalInventoryCost += costValue;
        totalInventoryValue += retailValue;

        // Stock status
        if (product.stock === 0) {
          outOfStockProducts.push({
            product_id: product.id,
            product_name: product.name,
            sku: product.sku,
            stock: product.stock,
          });
        } else if (product.stock <= (product.min_stock || 5)) {
          lowStockProducts.push({
            product_id: product.id,
            product_name: product.name,
            sku: product.sku,
            stock: product.stock,
            min_stock: product.min_stock || 5,
          });
        } else if (product.stock > 100) { // Threshold for overstock
          overstockProducts.push({
            product_id: product.id,
            product_name: product.name,
            sku: product.sku,
            stock: product.stock,
          });
        }

        // Calculate turnover
        const items = (orderItems || []).filter(item => item.product_id === product.id);
        const totalSold = items.reduce((sum, item) => sum + item.quantity, 0);
        const turnoverRate = product.stock > 0 ? (totalSold / product.stock) : 0;

        if (totalSold > 0) {
          turnoverData[product.id] = {
            product_id: product.id,
            product_name: product.name,
            stock: product.stock,
            total_sold: totalSold,
            turnover_rate: Math.round(turnoverRate * 100) / 100,
            days_to_sell_out: turnoverRate > 0 ? Math.round((product.stock / totalSold) * 30) : null, // Assuming monthly rate
          };
        }
      }

      const averageTurnoverRate = Object.values(turnoverData).length > 0
        ? Object.values(turnoverData).reduce((sum: number, t: any) => sum + t.turnover_rate, 0) / Object.values(turnoverData).length
        : 0;

      // Reorder recommendations
      const reorderRecommendations = lowStockProducts.map(product => {
        const turnover = turnoverData[product.product_id];
        const recommendedQuantity = turnover
          ? Math.ceil(turnover.total_sold / 30 * 60) // 60 days supply based on 30-day sales
          : product.min_stock * 2;

        return {
          ...product,
          recommended_quantity: recommendedQuantity,
          estimated_days_until_out: turnover?.days_to_sell_out || null,
        };
      });

      return sendSuccess(c, {
        summary: {
          total_products: products.length,
          total_inventory_value: Math.round(totalInventoryValue * 100) / 100,
          total_inventory_cost: Math.round(totalInventoryCost * 100) / 100,
          potential_profit: Math.round((totalInventoryValue - totalInventoryCost) * 100) / 100,
          average_turnover_rate: Math.round(averageTurnoverRate * 100) / 100,
        },
        stock_status: {
          low_stock_count: lowStockProducts.length,
          out_of_stock_count: outOfStockProducts.length,
          overstock_count: overstockProducts.length,
          low_stock_products: lowStockProducts,
          out_of_stock_products: outOfStockProducts,
          overstock_products: overstockProducts,
        },
        turnover_analysis: Object.values(turnoverData).sort((a: any, b: any) => b.turnover_rate - a.turnover_rate),
        reorder_recommendations: reorderRecommendations,
      });
    } catch (error) {
      console.error('❌ [SELLER-ANALYTICS] Error fetching inventory analytics:', error);
      return sendError(c, `Failed to fetch inventory analytics: ${String(error)}`, 500);
    }
  });

  console.log('✅ [SELLER-ANALYTICS-SQL] Seller analytics endpoints registered (SQL-only)');
}

