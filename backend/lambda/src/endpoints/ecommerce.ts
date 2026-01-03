/**
 * ============================================================================
 * E-COMMERCE ENDPOINTS - LAMBDA VERSION
 * ============================================================================
 * 
 * Handles e-commerce features:
 * - Product catalog
 * - Shopping cart
 * - Order management
 * - Wishlist
 * 
 * Migrated from: supabase/functions/make-server-customer/customer-ecommerce-endpoints-sql.tsx
 * 
 * Date: 2025-01-28
 * Migration: Supabase to AWS Lambda
 * ============================================================================
 */

import { Hono } from 'hono';
import { select, insert, update, query, upsert } from '../database/rds-connection';

export function registerEcommerceEndpoints(app: Hono) {
  // ============================================
  // PRODUCT CATALOG
  // ============================================

  /**
   * GET /products
   * Get products with filters
   */
  app.get("/products", async (c) => {
    try {
      const vendorId = c.req.query('vendorId');
      const category = c.req.query('category');
      const search = c.req.query('search');
      const limit = parseInt(c.req.query('limit') || '50', 10);
      const offset = parseInt(c.req.query('offset') || '0', 10);

      let productQuery = `
        SELECT p.*, v.business_name as vendor_name
        FROM products p
        LEFT JOIN vendors v ON p.vendor_id = v.id
        WHERE p.is_active = true
      `;

      const params: any[] = [];
      let paramIndex = 1;

      if (vendorId) {
        productQuery += ` AND p.vendor_id = $${paramIndex}`;
        params.push(vendorId);
        paramIndex++;
      }

      if (category) {
        productQuery += ` AND p.category = $${paramIndex}`;
        params.push(category);
        paramIndex++;
      }

      if (search) {
        productQuery += ` AND (p.name ILIKE $${paramIndex} OR p.description ILIKE $${paramIndex})`;
        params.push(`%${search}%`);
        paramIndex++;
      }

      productQuery += ` ORDER BY p.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
      params.push(limit, offset);

      const products = await query(productQuery, params);

      return c.json({
        success: true,
        products: products.rows,
        total: products.rows.length,
      });
    } catch (error: any) {
      console.error('Error fetching products:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * GET /products/:productId
   * Get product details
   */
  app.get("/products/:productId", async (c) => {
    try {
      const { productId } = c.req.param();

      const products = await query(
        `SELECT p.*, v.business_name as vendor_name, v.city as vendor_city
         FROM products p
         LEFT JOIN vendors v ON p.vendor_id = v.id
         WHERE p.id = $1`,
        [productId]
      );

      if (products.rows.length === 0) {
        return c.json({ error: 'Product not found' }, 404);
      }

      return c.json({
        success: true,
        product: products.rows[0],
      });
    } catch (error: any) {
      console.error('Error fetching product:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  // ============================================
  // SHOPPING CART
  // ============================================

  /**
   * GET /cart/:customerId
   * Get customer cart
   */
  app.get("/cart/:customerId", async (c) => {
    try {
      const { customerId } = c.req.param();

      const cartItems = await query(
        `SELECT ci.*, p.name as product_name, p.price, p.images, v.business_name as vendor_name
         FROM cart_items ci
         INNER JOIN products p ON ci.product_id = p.id
         LEFT JOIN vendors v ON p.vendor_id = v.id
         WHERE ci.customer_id = $1
         ORDER BY ci.created_at DESC`,
        [customerId]
      );

      const subtotal = cartItems.rows.reduce((sum: number, item: any) => {
        return sum + (parseFloat(item.price || 0) * (item.quantity || 1));
      }, 0);

      return c.json({
        success: true,
        cart: {
          items: cartItems.rows,
          subtotal,
          total: subtotal, // Add tax/shipping if needed
          itemCount: cartItems.rows.length,
        },
      });
    } catch (error: any) {
      console.error('Error fetching cart:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * POST /cart/:customerId/items
   * Add item to cart
   */
  app.post("/cart/:customerId/items", async (c) => {
    try {
      const { customerId } = c.req.param();
      const { productId, quantity } = await c.req.json();

      if (!productId || !quantity) {
        return c.json({ error: 'productId and quantity are required' }, 400);
      }

      // Check if item already in cart
      const existing = await query(
        'SELECT * FROM cart_items WHERE customer_id = $1 AND product_id = $2',
        [customerId, productId]
      );

      if (existing.rows.length > 0) {
        // Update quantity
        const updated = await update('cart_items',
          { id: existing.rows[0].id },
          { quantity: (existing.rows[0].quantity || 0) + quantity }
        );
        return c.json({ success: true, cartItem: updated[0] });
      } else {
        // Add new item
        const newItem = await insert('cart_items', {
          customer_id: customerId,
          product_id: productId,
          quantity: quantity,
        });
        return c.json({ success: true, cartItem: newItem[0] });
      }
    } catch (error: any) {
      console.error('Error adding to cart:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * DELETE /cart/:customerId/items/:itemId
   * Remove item from cart
   */
  app.delete("/cart/:customerId/items/:itemId", async (c) => {
    try {
      const { itemId } = c.req.param();

      await query('DELETE FROM cart_items WHERE id = $1', [itemId]);

      return c.json({ success: true, message: 'Item removed from cart' });
    } catch (error: any) {
      console.error('Error removing from cart:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  // ============================================
  // ORDERS
  // ============================================

  /**
   * POST /orders
   * Create order from cart
   */
  app.post("/orders", async (c) => {
    try {
      const orderData = await c.req.json();
      const {
        customerId,
        vendorId,
        items,
        shippingAddress,
        paymentMethod,
        couponCode,
      } = orderData;

      if (!customerId || !items || items.length === 0) {
        return c.json({ error: 'customerId and items are required' }, 400);
      }

      // Calculate totals
      let subtotal = 0;
      const orderItems = [];

      for (const item of items) {
        const products = await select('products', { id: item.productId });
        if (products.length === 0) continue;

        const product = products[0];
        const itemTotal = parseFloat(product.price || 0) * (item.quantity || 1);
        subtotal += itemTotal;

        orderItems.push({
          product_id: item.productId,
          quantity: item.quantity,
          price: product.price,
          total: itemTotal,
        });
      }

      const taxAmount = subtotal * 0.18; // 18% GST (should come from settings)
      const shippingAmount = shippingAddress ? 50 : 0; // Should be calculated
      const totalAmount = subtotal + taxAmount + shippingAmount;

      // Generate order number
      const orderNumber = `ORD-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

      // Create order
      const order = await insert('orders', {
        customer_id: customerId,
        vendor_id: vendorId || null,
        order_number: orderNumber,
        order_status: 'pending',
        subtotal: subtotal,
        tax_amount: taxAmount,
        shipping_amount: shippingAmount,
        total_amount: totalAmount,
        payment_method: paymentMethod || 'online',
        coupon_code: couponCode || null,
        shipping_address: shippingAddress || null,
      });

      // Create order items
      for (const item of orderItems) {
        await insert('order_items', {
          order_id: order[0].id,
          product_id: item.product_id,
          quantity: item.quantity,
          price: item.price,
          total: item.total,
        });
      }

      // Clear cart
      await query('DELETE FROM cart_items WHERE customer_id = $1', [customerId]);

      return c.json({
        success: true,
        order: order[0],
        message: 'Order created successfully',
      });
    } catch (error: any) {
      console.error('Error creating order:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * GET /orders/:orderId
   * Get order details
   */
  app.get("/orders/:orderId", async (c) => {
    try {
      const { orderId } = c.req.param();

      const orders = await query(
        `SELECT o.*, c.name as customer_name, v.business_name as vendor_name
         FROM orders o
         LEFT JOIN customers c ON o.customer_id = c.id
         LEFT JOIN vendors v ON o.vendor_id = v.id
         WHERE o.id = $1`,
        [orderId]
      );

      if (orders.rows.length === 0) {
        return c.json({ error: 'Order not found' }, 404);
      }

      const order = orders.rows[0];

      // Get order items
      const items = await query(
        `SELECT oi.*, p.name as product_name, p.images
         FROM order_items oi
         LEFT JOIN products p ON oi.product_id = p.id
         WHERE oi.order_id = $1`,
        [orderId]
      );

      return c.json({
        success: true,
        order: {
          ...order,
          items: items.rows,
        },
      });
    } catch (error: any) {
      console.error('Error fetching order:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * GET /orders/customer/:customerId
   * Get customer orders
   */
  app.get("/orders/customer/:customerId", async (c) => {
    try {
      const { customerId } = c.req.param();

      const orders = await query(
        `SELECT o.*, v.business_name as vendor_name
         FROM orders o
         LEFT JOIN vendors v ON o.vendor_id = v.id
         WHERE o.customer_id = $1
         ORDER BY o.created_at DESC`,
        [customerId]
      );

      return c.json({
        success: true,
        orders: orders.rows,
        total: orders.rows.length,
      });
    } catch (error: any) {
      console.error('Error fetching customer orders:', error);
      return c.json({ error: error.message }, 500);
    }
  });
}

