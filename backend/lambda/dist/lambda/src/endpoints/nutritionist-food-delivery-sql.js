"use strict";
/**
 * ============================================================================
 * NUTRITIONIST FOOD DELIVERY SYSTEM - SQL-ONLY VERSION
 * ============================================================================
 *
 * ✅ SQL-ONLY: Removed all KV usage, using SQL repositories only
 *
 * Rule 8 Compliance: Hyperlocal Food Delivery for Nutritionists
 *
 * Features:
 * - Meal/Menu Management (for Nutritionists selling food)
 * - Subscription Ordering (Weekly/Monthly)
 * - Hyperlocal Delivery Integration
 * - Real-time Order Tracking
 *
 * CHANGES:
 * - Removed `kv` parameter from function signature
 * - Replaced all `kv.get()`, `kv.set()` with SQL queries
 * - Uses `products` table for meal items
 * - Uses `orders` and `order_items` tables for meal orders
 * - Uses `deliveries` table for delivery tracking
 *
 * Date: 2025-01-28
 * Migration: Batch 9 - 15 KV operations → 0
 * ============================================================================
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.nutritionistFoodDeliveryEndpointsSQL = nutritionistFoodDeliveryEndpointsSQL;
const response_utils_1 = require("./response-utils");
const db_1 = require("../lib/db");
const vendors_1 = require("../lib/repositories/vendors");
function nutritionistFoodDeliveryEndpointsSQL(app) {
    const BASE_PATH = '/make-server-3dd53475';
    const vendorsRepo = (0, vendors_1.getVendorsRepository)();
    // ==========================================
    // MENU MANAGEMENT (Nutritionist Side)
    // ==========================================
    /**
     * POST /nutritionist/meals/item
     * Add a meal item to the menu
     */
    app.post(`${BASE_PATH}/nutritionist/meals/item`, async (c) => {
        try {
            const body = await c.req.json();
            const { nutritionistId, name, price, type, description, dietaryTags, ingredients, nutritionalInfo, preparationTime, images } = body;
            if (!nutritionistId || !name || !price) {
                return (0, response_utils_1.sendError)(c, 'Missing required fields', 400);
            }
            // ✅ SQL: Verify nutritionist exists
            const vendor = await vendorsRepo.findById(nutritionistId);
            if (!vendor) {
                return (0, response_utils_1.sendError)(c, 'Nutritionist not found', 404);
            }
            // ✅ SQL: Create meal item as product
            const pool = await (0, db_1.getDbClient)();
            const mealItemId = `product_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            const [mealItem] = await (0, db_1.insertQuery)('products', {
                id: mealItemId,
                vendor_id: nutritionistId,
                name,
                description: description || '',
                category: 'nutritionist_meal',
                subcategory: type || 'fresh',
                price: parseFloat(price),
                sku: `MEAL-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`,
                stock_quantity: 999999, // Unlimited for meals
                is_active: true,
                images: JSON.stringify(images || []),
                tags: JSON.stringify(dietaryTags || []),
                metadata: JSON.stringify({
                    type,
                    dietaryTags,
                    ingredients: ingredients || [],
                    nutritionalInfo: nutritionalInfo || {},
                    preparationTime: preparationTime || 30
                }),
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            });
            return (0, response_utils_1.sendSuccess)(c, { mealItem }, 'Meal added to menu');
        }
        catch (error) {
            console.error('Error adding meal:', error);
            return (0, response_utils_1.sendError)(c, error, 500);
        }
    });
    /**
     * GET /nutritionist/:nutritionistId/menu
     * Get nutritionist's menu
     */
    app.get(`${BASE_PATH}/nutritionist/:nutritionistId/menu`, async (c) => {
        try {
            const { nutritionistId } = c.req.param();
            // ✅ SQL: Get all meal products for nutritionist
            const pool = await (0, db_1.getDbClient)();
            const products = await (0, db_1.selectQuery)('products', {
                vendor_id: nutritionistId,
                category: 'nutritionist_meal',
                is_active: true
            });
            const menu = products.map((p) => ({
                itemId: p.id,
                nutritionistId: p.vendor_id,
                name: p.name,
                description: p.description,
                type: p.metadata?.type || 'fresh',
                dietaryTags: p.tags || [],
                ingredients: p.metadata?.ingredients || [],
                nutritionalInfo: p.metadata?.nutritionalInfo || {},
                price: parseFloat(p.price || 0),
                isAvailable: p.is_active && p.stock > 0,
                preparationTime: p.metadata?.preparationTime || 30,
                images: p.images || []
            }));
            return (0, response_utils_1.sendSuccess)(c, { menu });
        }
        catch (error) {
            return (0, response_utils_1.sendError)(c, error, 500);
        }
    });
    // ==========================================
    // ORDERING & SUBSCRIPTIONS (Customer Side)
    // ==========================================
    /**
     * POST /nutritionist/meals/order
     * Place a meal order (One-time or Subscription)
     */
    app.post(`${BASE_PATH}/nutritionist/meals/order`, async (c) => {
        try {
            const body = await c.req.json();
            const { customerId, nutritionistId, items, type, subscriptionDetails, deliveryAddress, totalAmount } = body;
            if (!customerId || !nutritionistId || !items || !deliveryAddress) {
                return (0, response_utils_1.sendError)(c, 'Missing required fields', 400);
            }
            const orderNumber = `FOOD-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
            const now = new Date().toISOString();
            // ✅ SQL: Create order
            const pool = await (0, db_1.getDbClient)();
            const orderId = `order_${Date.now()}_${Math.random().toString(36).substring(7)}`;
            const orderResult = await pool.query(`INSERT INTO orders (
          id, customer_id, vendor_id, order_number, order_status, subtotal, total_amount,
          shipping_address, shipping_city, shipping_state, shipping_pincode,
          shipping_phone, payment_status, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
        RETURNING *`, [
                orderId, customerId, nutritionistId, orderNumber, 'pending', totalAmount, totalAmount,
                `${deliveryAddress.street}, ${deliveryAddress.city}, ${deliveryAddress.zip}`,
                deliveryAddress.city, deliveryAddress.state || '', deliveryAddress.zip,
                deliveryAddress.phone || '', 'pending', now, now
            ]);
            const orderData = orderResult.rows[0];
            // ✅ SQL: Create order items
            for (const item of items) {
                const itemId = `item_${Date.now()}_${Math.random().toString(36).substring(7)}`;
                await pool.query(`INSERT INTO order_items (
            id, order_id, product_id, name, quantity, unit_price, total_price
          ) VALUES ($1, $2, $3, $4, $5, $6, $7)`, [
                    itemId, orderData.id, item.itemId, item.name || 'Meal Item',
                    item.quantity || 1, item.price || 0, (item.price || 0) * (item.quantity || 1)
                ]);
            }
            // ✅ SQL: Create delivery record if needed
            if (deliveryAddress.location) {
                const deliveryId = `delivery_${Date.now()}_${Math.random().toString(36).substring(7)}`;
                await pool.query(`INSERT INTO deliveries (
            id, order_id, order_type, customer_id, customer_name, customer_phone,
            pickup_location, drop_location, status, scheduled_date, scheduled_time, created_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`, [
                    deliveryId, orderNumber, 'meal_plan', customerId,
                    deliveryAddress.name || '', deliveryAddress.phone || '',
                    JSON.stringify({
                        vendor_id: nutritionistId,
                        address: '',
                        lat: null,
                        lng: null
                    }),
                    JSON.stringify({
                        address: deliveryAddress.street,
                        city: deliveryAddress.city,
                        zip: deliveryAddress.zip,
                        lat: deliveryAddress.location.lat,
                        lng: deliveryAddress.location.lng
                    }),
                    'pending',
                    new Date().toISOString().split('T')[0],
                    new Date().toTimeString().split(' ')[0].substring(0, 5),
                    now
                ]);
            }
            // Store subscription details in order metadata if subscription
            if (type === 'subscription' && subscriptionDetails) {
                const pool = await (0, db_1.getDbClient)();
                await pool.query(`UPDATE orders SET metadata = $1 WHERE id = $2`, [
                    JSON.stringify({
                        type: 'subscription',
                        subscriptionDetails
                    }),
                    orderData.id
                ]);
            }
            console.log(`🔔 New Meal Order ${orderNumber} for Nutritionist ${nutritionistId}`);
            return (0, response_utils_1.sendSuccess)(c, {
                order: {
                    orderId: orderNumber,
                    id: orderData.id,
                    status: 'placed',
                    totalAmount
                }
            }, 'Order placed successfully');
        }
        catch (error) {
            console.error('Error placing order:', error);
            return (0, response_utils_1.sendError)(c, error, 500);
        }
    });
    // ==========================================
    // DELIVERY & TRACKING
    // ==========================================
    /**
     * POST /nutritionist/orders/:orderId/assign-delivery
     * Assign a delivery partner (Simulated Hyperlocal Integration)
     */
    app.post(`${BASE_PATH}/nutritionist/orders/:orderId/assign-delivery`, async (c) => {
        try {
            const { orderId } = c.req.param();
            // ✅ SQL: Get order
            const pool = await (0, db_1.getDbClient)();
            const orderResult = await pool.query('SELECT * FROM orders WHERE order_number = $1', [orderId]);
            const order = orderResult.rows[0] || null;
            if (!order) {
                return (0, response_utils_1.sendError)(c, 'Order not found', 404);
            }
            // ✅ SQL: Get delivery record
            const deliveryResult = await pool.query('SELECT * FROM deliveries WHERE order_id = $1', [orderId]);
            const delivery = deliveryResult.rows[0] || null;
            // Simulate finding a nearby runner
            const mockRunner = {
                partnerId: `RUNNER-${Math.floor(Math.random() * 1000)}`,
                name: 'Speedy Delivery',
                phone: '+919876543210',
                currentLocation: delivery?.drop_location?.lat ? {
                    lat: delivery.drop_location.lat - 0.01,
                    lng: delivery.drop_location.lng - 0.01
                } : null
            };
            // ✅ SQL: Update delivery with partner
            if (delivery) {
                await pool.query(`UPDATE deliveries SET 
            partner_id = $1, partner_name = $2, partner_phone = $3,
            status = $4, assigned_at = $5
            WHERE order_id = $6`, [mockRunner.partnerId, mockRunner.name, mockRunner.phone, 'assigned', new Date().toISOString(), orderId]);
            }
            // ✅ SQL: Update order status
            await pool.query('UPDATE orders SET order_status = $1, updated_at = $2 WHERE id = $3', ['processing', new Date().toISOString(), order.id]);
            return (0, response_utils_1.sendSuccess)(c, { order, partner: mockRunner }, 'Delivery partner assigned');
        }
        catch (error) {
            return (0, response_utils_1.sendError)(c, error, 500);
        }
    });
    /**
     * GET /nutritionist/orders/:orderId/track
     * Track order status and location
     */
    app.get(`${BASE_PATH}/nutritionist/orders/:orderId/track`, async (c) => {
        try {
            const { orderId } = c.req.param();
            // ✅ SQL: Get order
            const pool = await (0, db_1.getDbClient)();
            const orderResult = await pool.query('SELECT * FROM orders WHERE order_number = $1', [orderId]);
            const order = orderResult.rows[0] || null;
            if (!order) {
                return (0, response_utils_1.sendError)(c, 'Order not found', 404);
            }
            // ✅ SQL: Get delivery record
            const deliveryResult = await pool.query('SELECT * FROM deliveries WHERE order_id = $1', [orderId]);
            const delivery = deliveryResult.rows[0] || null;
            let deliveryPartner = null;
            if (delivery?.partner_id) {
                deliveryPartner = {
                    partnerId: delivery.partner_id,
                    name: delivery.partner_name,
                    phone: delivery.partner_phone,
                    currentLocation: delivery.current_lat && delivery.current_lng ? {
                        lat: delivery.current_lat,
                        lng: delivery.current_lng
                    } : null
                };
            }
            return (0, response_utils_1.sendSuccess)(c, {
                status: order.order_status,
                deliveryPartner,
                estimatedArrival: '15 mins' // Mock
            });
        }
        catch (error) {
            return (0, response_utils_1.sendError)(c, error, 500);
        }
    });
    /**
     * PUT /nutritionist/orders/:orderId/status
     * Update order status
     */
    app.put(`${BASE_PATH}/nutritionist/orders/:orderId/status`, async (c) => {
        try {
            const { orderId } = c.req.param();
            const { status } = await c.req.json();
            // ✅ SQL: Get order
            const pool2 = await (0, db_1.getDbClient)();
            const orderResult = await pool2.query('SELECT * FROM orders WHERE order_number = $1', [orderId]);
            const order = orderResult.rows[0] || null;
            if (!order) {
                return (0, response_utils_1.sendError)(c, 'Order not found', 404);
            }
            // ✅ SQL: Update order status
            const now = new Date().toISOString();
            const updateFields = ['order_status = $1', 'updated_at = $2'];
            const updateParams = [status, now];
            let paramIndex = 3;
            if (status === 'delivered') {
                updateFields.push(`delivered_at = $${paramIndex}`);
                updateParams.push(now);
                paramIndex++;
            }
            updateParams.push(order.id);
            const updatedResult = await pool2.query(`UPDATE orders SET ${updateFields.join(', ')} WHERE id = $${paramIndex} RETURNING *`, updateParams);
            const updated = updatedResult.rows[0];
            // ✅ SQL: Update delivery status if exists
            if (status === 'out_for_delivery' || status === 'delivered') {
                await pool2.query(`UPDATE deliveries SET 
            status = $1, delivered_at = $2
            WHERE order_id = $3`, [status === 'delivered' ? 'delivered' : 'in_transit', status === 'delivered' ? now : null, orderId]);
            }
            return (0, response_utils_1.sendSuccess)(c, { order: updated }, 'Status updated');
        }
        catch (error) {
            return (0, response_utils_1.sendError)(c, error, 500);
        }
    });
    console.log('✅ Nutritionist Food Delivery Endpoints registered (SQL-only)');
}
//# sourceMappingURL=nutritionist-food-delivery-sql.js.map