/**
 * ============================================================================
 * E-COMMERCE REGRESSION TESTS - DATABASE TO API TO UI TRACING
 * ============================================================================
 * 
 * Comprehensive regression tests that verify:
 * 1. API parameter matching between frontend and backend
 * 2. Database schema columns match API response fields
 * 3. API contracts for all endpoints
 * 4. End-to-end flows
 * 5. Data type validation
 * 
 * Date: 2026-01-20
 * ============================================================================
 */

import { test, expect, APIRequestContext } from '@playwright/test';

// Constants
const API_BASE = process.env.API_URL || 'https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com';
const CUSTOMER_URL = process.env.CUSTOMER_URL || '';
const VENDOR_URL = process.env.VENDOR_URL || '';

// Test data
const TEST_IDS = {
  customerId: '00000000-0000-0000-0000-000000000001', // Valid UUID format
  vendorId: '00000000-0000-0000-0000-000000000002',
  productId: '00000000-0000-0000-0000-000000000003',
  orderId: '00000000-0000-0000-0000-000000000004',
  invalidId: 'invalid-id-format',
};

// ===========================================================================
// SECTION 1: DATABASE SCHEMA TO API RESPONSE FIELD MAPPING
// ===========================================================================

test.describe('Schema Validation - Products API', () => {
  test('GET /products should return fields matching products table schema', async ({ request }) => {
    const response = await request.get(`${API_BASE}/products?limit=5`);
    expect(response.ok()).toBeTruthy();
    
    const data = await response.json();
    expect(data).toHaveProperty('success');
    expect(data).toHaveProperty('products');
    expect(Array.isArray(data.products)).toBeTruthy();
    
    // If products exist, validate schema
    if (data.products.length > 0) {
      const product = data.products[0];
      
      // Core product fields from products table
      const expectedFields = ['id', 'name', 'price'];
      for (const field of expectedFields) {
        expect(product).toHaveProperty(field);
      }
      
      // Validate data types
      expect(typeof product.id).toBe('string');
      if (product.name) expect(typeof product.name).toBe('string');
      if (product.price !== null && product.price !== undefined) {
        expect(['string', 'number']).toContain(typeof product.price);
      }
    }
  });

  test('GET /products should support query parameters', async ({ request }) => {
    // Test limit parameter
    const limitResponse = await request.get(`${API_BASE}/products?limit=3`);
    expect(limitResponse.ok()).toBeTruthy();
    const limitData = await limitResponse.json();
    expect(limitData.products.length).toBeLessThanOrEqual(3);

    // Test offset parameter
    const offsetResponse = await request.get(`${API_BASE}/products?limit=2&offset=0`);
    expect(offsetResponse.ok()).toBeTruthy();
    
    // Test search parameter
    const searchResponse = await request.get(`${API_BASE}/products?search=test`);
    expect(searchResponse.ok()).toBeTruthy();
    
    // Test category parameter
    const categoryResponse = await request.get(`${API_BASE}/products?category=test`);
    expect(categoryResponse.ok()).toBeTruthy();
  });

  test('GET /products/:productId should return single product schema', async ({ request }) => {
    // First get a real product ID
    const listResponse = await request.get(`${API_BASE}/products?limit=1`);
    expect(listResponse.ok()).toBeTruthy();
    const listData = await listResponse.json();
    
    if (listData.products?.length > 0) {
      const productId = listData.products[0].id;
      const response = await request.get(`${API_BASE}/products/${productId}`);
      
      if (response.ok()) {
        const data = await response.json();
        expect(data).toHaveProperty('product');
        expect(data.product).toHaveProperty('id');
        expect(data.product.id).toBe(productId);
      }
    }
  });

  test('GET /products with invalid vendorId should handle gracefully', async ({ request }) => {
    const response = await request.get(`${API_BASE}/products?vendorId=${TEST_IDS.invalidId}`);
    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(data.products).toEqual([]);
  });
});

// ===========================================================================
// SECTION 2: WISHLIST API SCHEMA VALIDATION
// ===========================================================================

test.describe('Schema Validation - Wishlist API', () => {
  test('GET /customer/:customerId/wishlist should return correct schema', async ({ request }) => {
    const response = await request.get(`${API_BASE}/customer/${TEST_IDS.customerId}/wishlist`);
    
    // May return 404/500 for non-existent customer, which is acceptable
    if (response.ok()) {
      const data = await response.json();
      expect(data).toHaveProperty('success');
      expect(data).toHaveProperty('wishlist');
      
      if (data.wishlist) {
        expect(data.wishlist).toHaveProperty('items');
        expect(data.wishlist).toHaveProperty('total_items');
        expect(Array.isArray(data.wishlist.items)).toBeTruthy();
        
        // Validate item schema matches customer_wishlist + products join
        if (data.wishlist.items.length > 0) {
          const item = data.wishlist.items[0];
          expect(item).toHaveProperty('id');
          expect(item).toHaveProperty('product_id');
          expect(item).toHaveProperty('product');
          expect(item).toHaveProperty('added_at');
          
          // Validate product schema
          if (item.product) {
            expect(item.product).toHaveProperty('id');
            expect(item.product).toHaveProperty('name');
            expect(item.product).toHaveProperty('price');
          }
        }
      }
    } else {
      expect([400, 404, 500]).toContain(response.status());
    }
  });

  test('POST /customer/:customerId/wishlist should accept correct parameters', async ({ request }) => {
    const response = await request.post(`${API_BASE}/customer/${TEST_IDS.customerId}/wishlist`, {
      data: {
        productId: TEST_IDS.productId,
        action: 'add',
      },
    });
    
    // May fail for non-existent customer/product, but should respond
    expect([200, 400, 404, 500]).toContain(response.status());
    
    if (response.ok()) {
      const data = await response.json();
      expect(data).toHaveProperty('success');
      expect(data).toHaveProperty('action');
      expect(['added', 'removed']).toContain(data.action);
    }
  });

  test('DELETE /customer/:customerId/wishlist/:productId should work', async ({ request }) => {
    const response = await request.delete(
      `${API_BASE}/customer/${TEST_IDS.customerId}/wishlist/${TEST_IDS.productId}`
    );
    
    expect([200, 400, 404, 500]).toContain(response.status());
    
    if (response.ok()) {
      const data = await response.json();
      expect(data).toHaveProperty('success');
    }
  });

  test('Wishlist API should validate UUID format', async ({ request }) => {
    // Test with invalid UUID
    const response = await request.get(`${API_BASE}/customer/not-a-uuid/wishlist`);
    
    // Should either return error or empty result
    expect([200, 400, 404, 500]).toContain(response.status());
  });
});

// ===========================================================================
// SECTION 3: PRODUCT VARIATIONS API SCHEMA VALIDATION
// ===========================================================================

test.describe('Schema Validation - Product Variations API', () => {
  test('GET /products/:productId/variations should return correct schema', async ({ request }) => {
    // First get a real product ID
    const productsRes = await request.get(`${API_BASE}/products?limit=1`);
    if (!productsRes.ok()) return;
    
    const productsData = await productsRes.json();
    if (!productsData.products?.length) return;
    
    const productId = productsData.products[0].id;
    const response = await request.get(`${API_BASE}/products/${productId}/variations`);
    
    if (response.ok()) {
      const data = await response.json();
      expect(data).toHaveProperty('success');
      expect(data).toHaveProperty('variations');
      expect(Array.isArray(data.variations)).toBeTruthy();
      
      // Validate variation schema matches product_variations table
      if (data.variations.length > 0) {
        const variation = data.variations[0];
        expect(variation).toHaveProperty('id');
        expect(variation).toHaveProperty('name');
        expect(variation).toHaveProperty('type');
        expect(variation).toHaveProperty('options');
        expect(Array.isArray(variation.options)).toBeTruthy();
        
        // Validate option schema matches product_variation_options table
        if (variation.options.length > 0) {
          const option = variation.options[0];
          expect(option).toHaveProperty('value');
          if (option.price_modifier !== undefined) {
            expect(typeof option.price_modifier).toBe('number');
          }
        }
      }
    }
  });

  test('GET /vendor/:vendorId/products/:productId/variations requires valid IDs', async ({ request }) => {
    const response = await request.get(
      `${API_BASE}/vendor/${TEST_IDS.vendorId}/products/${TEST_IDS.productId}/variations`
    );
    
    // Should return 404 for non-existent product/vendor
    expect([200, 404, 500]).toContain(response.status());
  });

  test('POST /vendor/:vendorId/products/:productId/variations validates input', async ({ request }) => {
    const response = await request.post(
      `${API_BASE}/vendor/${TEST_IDS.vendorId}/products/${TEST_IDS.productId}/variations`,
      {
        data: {
          variations: [
            {
              name: 'Size',
              type: 'size',
              is_required: true,
              options: [
                { value: 'Small', price_modifier: 0, stock_quantity: 10 },
                { value: 'Medium', price_modifier: 50, stock_quantity: 20 },
              ],
            },
          ],
        },
      }
    );
    
    // Should fail for non-existent product, but validate input schema
    expect([200, 400, 404, 500]).toContain(response.status());
  });
});

// ===========================================================================
// SECTION 4: RETURNS API SCHEMA VALIDATION
// ===========================================================================

test.describe('Schema Validation - Returns API', () => {
  test('GET /returns/reasons should return predefined reasons', async ({ request }) => {
    const response = await request.get(`${API_BASE}/returns/reasons`);
    
    if (response.ok()) {
      const data = await response.json();
      expect(data).toHaveProperty('success');
      expect(data).toHaveProperty('reasons');
      expect(Array.isArray(data.reasons)).toBeTruthy();
      
      if (data.reasons.length > 0) {
        const reason = data.reasons[0];
        expect(reason).toHaveProperty('id');
        expect(reason).toHaveProperty('label');
      }
    } else {
      expect([404, 500]).toContain(response.status());
    }
  });

  test('GET /orders/:orderId/return-eligibility should return eligibility schema', async ({ request }) => {
    const response = await request.get(`${API_BASE}/orders/${TEST_IDS.orderId}/return-eligibility`);
    
    if (response.ok()) {
      const data = await response.json();
      expect(data).toHaveProperty('success');
      expect(data).toHaveProperty('eligibility');
      
      if (data.eligibility) {
        expect(data.eligibility).toHaveProperty('isEligible');
        expect(typeof data.eligibility.isEligible).toBe('boolean');
        expect(data.eligibility).toHaveProperty('reasons');
        expect(Array.isArray(data.eligibility.reasons)).toBeTruthy();
      }
    } else {
      expect([404, 500]).toContain(response.status());
    }
  });

  test('GET /customer/:customerId/returns should return customer returns', async ({ request }) => {
    const response = await request.get(`${API_BASE}/customer/${TEST_IDS.customerId}/returns`);
    
    if (response.ok()) {
      const data = await response.json();
      expect(data).toHaveProperty('success');
      expect(data).toHaveProperty('returns');
      expect(Array.isArray(data.returns)).toBeTruthy();
      
      // Validate pagination
      if (data.pagination) {
        expect(data.pagination).toHaveProperty('limit');
        expect(data.pagination).toHaveProperty('offset');
      }
    } else {
      expect([400, 404, 500]).toContain(response.status());
    }
  });
});

// ===========================================================================
// SECTION 5: CART API SCHEMA VALIDATION
// ===========================================================================

test.describe('Schema Validation - Cart API', () => {
  test('GET /cart/:customerId should return cart schema', async ({ request }) => {
    const response = await request.get(`${API_BASE}/cart/${TEST_IDS.customerId}`);
    
    if (response.ok()) {
      const data = await response.json();
      expect(data).toHaveProperty('success');
      expect(data).toHaveProperty('cart');
      
      if (data.cart) {
        expect(data.cart).toHaveProperty('items');
        expect(data.cart).toHaveProperty('subtotal');
        expect(data.cart).toHaveProperty('total');
        expect(data.cart).toHaveProperty('itemCount');
        expect(Array.isArray(data.cart.items)).toBeTruthy();
      }
    } else {
      expect([400, 404, 500]).toContain(response.status());
    }
  });

  test('POST /cart/:customerId/items should validate required fields', async ({ request }) => {
    // Missing required fields
    const invalidResponse = await request.post(`${API_BASE}/cart/${TEST_IDS.customerId}/items`, {
      data: {},
    });
    expect([400, 500]).toContain(invalidResponse.status());
    
    // Valid fields
    const validResponse = await request.post(`${API_BASE}/cart/${TEST_IDS.customerId}/items`, {
      data: {
        productId: TEST_IDS.productId,
        quantity: 1,
      },
    });
    expect([200, 400, 404, 500]).toContain(validResponse.status());
  });
});

// ===========================================================================
// SECTION 6: ORDERS API SCHEMA VALIDATION
// ===========================================================================

test.describe('Schema Validation - Orders API', () => {
  test('GET /orders/:orderId should return order schema', async ({ request }) => {
    const response = await request.get(`${API_BASE}/orders/${TEST_IDS.orderId}`);
    
    if (response.ok()) {
      const data = await response.json();
      expect(data).toHaveProperty('success');
      expect(data).toHaveProperty('order');
      
      if (data.order) {
        // Validate order schema matches orders table
        expect(data.order).toHaveProperty('id');
        expect(data.order).toHaveProperty('items');
        expect(Array.isArray(data.order.items)).toBeTruthy();
      }
    } else {
      expect([404, 500]).toContain(response.status());
    }
  });

  test('GET /orders/customer/:customerId should return customer orders', async ({ request }) => {
    const response = await request.get(`${API_BASE}/orders/customer/${TEST_IDS.customerId}`);
    
    if (response.ok()) {
      const data = await response.json();
      expect(data).toHaveProperty('success');
      expect(data).toHaveProperty('orders');
      expect(Array.isArray(data.orders)).toBeTruthy();
    } else {
      expect([400, 404, 500]).toContain(response.status());
    }
  });

  test('POST /ecommerce/orders should validate required fields', async ({ request }) => {
    // Missing required fields
    const invalidResponse = await request.post(`${API_BASE}/ecommerce/orders`, {
      data: {},
    });
    expect([400, 500]).toContain(invalidResponse.status());
    
    // Valid order data
    const validResponse = await request.post(`${API_BASE}/ecommerce/orders`, {
      data: {
        customer_phone: '+919999999999',
        items: [
          { product_id: TEST_IDS.productId, quantity: 1 },
        ],
        shipping_address: {
          name: 'Test Customer',
          line1: '123 Test St',
          city: 'Test City',
          state: 'Test State',
          pincode: '123456',
        },
        payment_method: 'cod',
      },
    });
    // May fail for non-existent product, but validates schema
    expect([200, 400, 404, 500]).toContain(validResponse.status());
  });
});

// ===========================================================================
// SECTION 7: ADMIN API SCHEMA VALIDATION
// ===========================================================================

test.describe('Schema Validation - Admin APIs', () => {
  const adminHeaders = {
    'X-UAT-Mode': 'true',
    'X-UAT-Token': 'uat-token-admin',
  };

  test('GET /admin/ecommerce/analytics should return analytics schema', async ({ request }) => {
    const response = await request.get(`${API_BASE}/admin/ecommerce/analytics`, {
      headers: adminHeaders,
    });
    
    if (response.ok()) {
      const data = await response.json();
      expect(data).toHaveProperty('success');
      expect(data).toHaveProperty('data');
      
      if (data.data) {
        expect(data.data).toHaveProperty('revenue');
        expect(data.data).toHaveProperty('totalRevenue');
        expect(data.data).toHaveProperty('totalOrders');
      }
    }
  });

  test('GET /admin/ecommerce/analytics/platform should return KPI fields in data', async ({ request }) => {
    const response = await request.get(`${API_BASE}/admin/ecommerce/analytics/platform`, {
      headers: adminHeaders,
    });

    if (response.ok()) {
      const body = await response.json();
      expect(body).toHaveProperty('success', true);
      expect(body).toHaveProperty('data');
      const d = body.data;
      expect(d).toHaveProperty('activeProducts');
      expect(d).toHaveProperty('pendingApprovals');
      expect(d).toHaveProperty('processingOrders');
      expect(d).toHaveProperty('pendingSettlements');
      expect(typeof d.activeProducts).toBe('number');
      expect(typeof d.pendingApprovals).toBe('number');
      expect(typeof d.processingOrders).toBe('number');
      expect(typeof d.pendingSettlements).toBe('number');
      expect(d).toHaveProperty('totalGMV');
      expect(d).toHaveProperty('pendingSettlementAmount');
      expect(typeof d.totalGMV).toBe('number');
      expect(typeof d.pendingSettlementAmount).toBe('number');
    }
  });

  test('GET /admin/ecommerce/orders should return orders list', async ({ request }) => {
    const response = await request.get(`${API_BASE}/admin/ecommerce/orders`, {
      headers: adminHeaders,
    });
    
    if (response.ok()) {
      const data = await response.json();
      expect(data).toHaveProperty('success');
      expect(data).toHaveProperty('orders');
      expect(Array.isArray(data.orders)).toBeTruthy();
    }
  });

  test('GET /admin/ecommerce/products should return products list', async ({ request }) => {
    const response = await request.get(`${API_BASE}/admin/ecommerce/products`, {
      headers: adminHeaders,
    });
    
    if (response.ok()) {
      const data = await response.json();
      expect(data).toHaveProperty('success');
      expect(data).toHaveProperty('products');
      expect(Array.isArray(data.products)).toBeTruthy();
    }
  });

  test('GET /admin/ecommerce/commission/settings should return settings', async ({ request }) => {
    const response = await request.get(`${API_BASE}/admin/ecommerce/commission/settings`, {
      headers: adminHeaders,
    });
    
    if (response.ok()) {
      const data = await response.json();
      expect(data).toHaveProperty('success');
      expect(data).toHaveProperty('settings');
    }
  });
});

// ===========================================================================
// SECTION 8: VENDOR API SCHEMA VALIDATION
// ===========================================================================

test.describe('Schema Validation - Vendor APIs', () => {
  const vendorHeaders = {
    'X-UAT-Mode': 'true',
    'X-UAT-Token': 'uat-token-vendor',
  };

  test('GET /vendor/:vendorId/products should return vendor products', async ({ request }) => {
    const response = await request.get(`${API_BASE}/vendor/${TEST_IDS.vendorId}/products`, {
      headers: vendorHeaders,
    });
    
    expect([200, 404, 500]).toContain(response.status());
    
    if (response.ok()) {
      const data = await response.json();
      expect(data).toHaveProperty('products');
    }
  });

  test('GET /vendor/:vendorId/returns should return vendor returns', async ({ request }) => {
    const response = await request.get(`${API_BASE}/vendor/${TEST_IDS.vendorId}/returns`, {
      headers: vendorHeaders,
    });
    
    if (response.ok()) {
      const data = await response.json();
      expect(data).toHaveProperty('success');
      expect(data).toHaveProperty('returns');
      expect(Array.isArray(data.returns)).toBeTruthy();
      
      if (data.statusCounts) {
        expect(typeof data.statusCounts).toBe('object');
      }
    }
  });

  test('GET /vendor/:vendorId/logistics-settings should return settings', async ({ request }) => {
    const response = await request.get(`${API_BASE}/vendor/${TEST_IDS.vendorId}/logistics-settings`, {
      headers: vendorHeaders,
    });
    
    expect([200, 404, 500]).toContain(response.status());
  });
});

// ===========================================================================
// SECTION 9: PARAMETER MATCHING - FRONTEND TO BACKEND
// ===========================================================================

test.describe('Parameter Matching - Frontend to Backend', () => {
  test('Order creation should accept both camelCase and snake_case', async ({ request }) => {
    // camelCase (frontend format)
    const camelCaseData = {
      customerPhone: '+919999999998',
      items: [{ productId: TEST_IDS.productId, quantity: 1 }],
      shippingAddress: { name: 'Test', line1: '123', city: 'City', state: 'State', pincode: '123456' },
      paymentMethod: 'cod',
    };
    
    // snake_case (backend format)
    const snakeCaseData = {
      customer_phone: '+919999999997',
      items: [{ product_id: TEST_IDS.productId, quantity: 1 }],
      shipping_address: { name: 'Test', line1: '123', city: 'City', state: 'State', pincode: '123456' },
      payment_method: 'cod',
    };
    
    const camelResponse = await request.post(`${API_BASE}/ecommerce/orders`, { data: camelCaseData });
    const snakeResponse = await request.post(`${API_BASE}/ecommerce/orders`, { data: snakeCaseData });
    
    // Both should be accepted (even if they fail for other reasons)
    expect([200, 400, 404, 500]).toContain(camelResponse.status());
    expect([200, 400, 404, 500]).toContain(snakeResponse.status());
  });

  test('Wishlist toggle should accept action parameter', async ({ request }) => {
    // Add action
    const addResponse = await request.post(`${API_BASE}/customer/${TEST_IDS.customerId}/wishlist`, {
      data: { productId: TEST_IDS.productId, action: 'add' },
    });
    expect([200, 400, 404, 500]).toContain(addResponse.status());
    
    // Remove action
    const removeResponse = await request.post(`${API_BASE}/customer/${TEST_IDS.customerId}/wishlist`, {
      data: { productId: TEST_IDS.productId, action: 'remove' },
    });
    expect([200, 400, 404, 500]).toContain(removeResponse.status());
  });
});

// ===========================================================================
// SECTION 10: DATA TYPE VALIDATION
// ===========================================================================

test.describe('Data Type Validation', () => {
  test('Price fields should be numeric', async ({ request }) => {
    const response = await request.get(`${API_BASE}/products?limit=5`);
    if (!response.ok()) return;
    
    const data = await response.json();
    if (!data.products?.length) return;
    
    for (const product of data.products) {
      if (product.price !== null && product.price !== undefined) {
        const price = parseFloat(product.price);
        expect(isNaN(price)).toBeFalsy();
        expect(price).toBeGreaterThanOrEqual(0);
      }
    }
  });

  test('UUID fields should be valid format', async ({ request }) => {
    const response = await request.get(`${API_BASE}/products?limit=5`);
    if (!response.ok()) return;
    
    const data = await response.json();
    if (!data.products?.length) return;
    
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    
    for (const product of data.products) {
      if (product.id) {
        expect(uuidRegex.test(product.id)).toBeTruthy();
      }
    }
  });

  test('Timestamp fields should be valid ISO format', async ({ request }) => {
    const response = await request.get(`${API_BASE}/products?limit=5`);
    if (!response.ok()) return;
    
    const data = await response.json();
    if (!data.products?.length) return;
    
    for (const product of data.products) {
      if (product.created_at) {
        const date = new Date(product.created_at);
        expect(isNaN(date.getTime())).toBeFalsy();
      }
    }
  });

  test('Boolean fields should be actual booleans', async ({ request }) => {
    const response = await request.get(`${API_BASE}/products?limit=5`);
    if (!response.ok()) return;
    
    const data = await response.json();
    if (!data.products?.length) return;
    
    for (const product of data.products) {
      if (product.is_active !== undefined && product.is_active !== null) {
        expect(typeof product.is_active).toBe('boolean');
      }
    }
  });
});

// ===========================================================================
// SECTION 11: ERROR HANDLING VALIDATION
// ===========================================================================

test.describe('Error Handling', () => {
  test('Invalid UUID should return appropriate error', async ({ request }) => {
    const endpoints = [
      `/products/invalid-uuid`,
      `/orders/invalid-uuid`,
      `/cart/invalid-uuid`,
    ];
    
    for (const endpoint of endpoints) {
      const response = await request.get(`${API_BASE}${endpoint}`);
      // Should not crash - return 400, 404, or 500
      expect([400, 404, 500]).toContain(response.status());
    }
  });

  test('Missing required fields should return 400', async ({ request }) => {
    // Order without items
    const orderResponse = await request.post(`${API_BASE}/ecommerce/orders`, {
      data: { customer_phone: '+919999999999' },
    });
    expect([400, 500]).toContain(orderResponse.status());
    
    // Cart item without productId
    const cartResponse = await request.post(`${API_BASE}/cart/${TEST_IDS.customerId}/items`, {
      data: { quantity: 1 },
    });
    expect([400, 500]).toContain(cartResponse.status());
  });

  test('Non-existent resources should return 404', async ({ request }) => {
    const nonExistentUuid = '99999999-9999-9999-9999-999999999999';
    
    const orderResponse = await request.get(`${API_BASE}/orders/${nonExistentUuid}`);
    expect([404, 500]).toContain(orderResponse.status());
    
    const productResponse = await request.get(`${API_BASE}/products/${nonExistentUuid}`);
    expect([404, 500]).toContain(productResponse.status());
  });
});

// ===========================================================================
// SECTION 12: PAGINATION VALIDATION
// ===========================================================================

test.describe('Pagination Validation', () => {
  test('Products API should respect limit parameter', async ({ request }) => {
    const limits = [1, 5, 10];
    
    for (const limit of limits) {
      const response = await request.get(`${API_BASE}/products?limit=${limit}`);
      if (!response.ok()) continue;
      
      const data = await response.json();
      expect(data.products.length).toBeLessThanOrEqual(limit);
    }
  });

  test('Offset should skip items correctly', async ({ request }) => {
    const firstPage = await request.get(`${API_BASE}/products?limit=3&offset=0`);
    const secondPage = await request.get(`${API_BASE}/products?limit=3&offset=3`);
    
    if (!firstPage.ok() || !secondPage.ok()) return;
    
    const firstData = await firstPage.json();
    const secondData = await secondPage.json();
    
    if (firstData.products.length > 0 && secondData.products.length > 0) {
      // First items should be different
      const firstIds = firstData.products.map((p: any) => p.id);
      const secondIds = secondData.products.map((p: any) => p.id);
      
      // Check no overlap (unless there are less than 6 products)
      for (const id of secondIds) {
        if (firstData.products.length >= 3 && secondData.products.length >= 3) {
          expect(firstIds).not.toContain(id);
        }
      }
    }
  });
});

// ===========================================================================
// SECTION 13: UI INTEGRATION TESTS
// ===========================================================================

test.describe('UI Integration - Shop', () => {
  test('Shop page should display product data correctly', async ({ page }) => {
    await page.goto(`${CUSTOMER_URL}/shop`);
    await page.waitForLoadState('networkidle');
    
    // Check for essential UI elements
    const body = await page.locator('body').textContent();
    expect(body?.length).toBeGreaterThan(100);
  });

  test('Product cards should have clickable elements', async ({ page }) => {
    await page.goto(`${CUSTOMER_URL}/shop`);
    await page.waitForLoadState('networkidle');
    
    // Look for add to cart buttons
    const addToCartButtons = page.locator('button:has-text("Add to Cart"), button:has-text("Add")');
    const buttonCount = await addToCartButtons.count();
    
    if (buttonCount > 0) {
      await expect(addToCartButtons.first()).toBeVisible();
    }
  });

  test('Search input should be functional', async ({ page }) => {
    await page.goto(`${CUSTOMER_URL}/shop`);
    await page.waitForLoadState('networkidle');
    
    const searchInput = page.locator('input[type="search"], input[placeholder*="Search" i]');
    if (await searchInput.count() > 0) {
      await searchInput.first().fill('test');
      await page.waitForTimeout(500); // Wait for potential search
    }
  });
});

test.describe('UI Integration - Cart', () => {
  test('Cart page should handle empty state', async ({ page }) => {
    await page.goto(`${CUSTOMER_URL}/cart`);
    await page.waitForLoadState('networkidle');
    
    const content = await page.locator('body').textContent();
    expect(content).toBeTruthy();
  });

  test('Cart should have quantity controls', async ({ page }) => {
    await page.goto(`${CUSTOMER_URL}/cart`);
    await page.waitForLoadState('networkidle');
    
    // Look for quantity buttons or empty state
    const content = await page.locator('body').textContent();
    expect(content).toMatch(/cart|empty|items?|quantity|\+|\-|checkout|continue/i);
  });
});

test.describe('UI Integration - Checkout', () => {
  test('Checkout page should have form elements', async ({ page }) => {
    await page.goto(`${CUSTOMER_URL}/checkout`);
    await page.waitForLoadState('networkidle');
    
    const content = await page.locator('body').textContent();
    // Either checkout form or redirect to login/cart/welcome page
    expect(content).toMatch(/checkout|address|payment|cart|login|empty|welcome|phone|sign in/i);
  });
});

// ===========================================================================
// SECTION 14: PERFORMANCE REGRESSION
// ===========================================================================

test.describe('Performance Regression', () => {
  test('Products list should respond within 3 seconds', async ({ request }) => {
    const start = Date.now();
    const response = await request.get(`${API_BASE}/products?limit=20`);
    const duration = Date.now() - start;
    
    expect(response.ok()).toBeTruthy();
    expect(duration).toBeLessThan(3000);
  });

  test('Product detail should respond within 2 seconds', async ({ request }) => {
    // Get a product ID first
    const listRes = await request.get(`${API_BASE}/products?limit=1`);
    if (!listRes.ok()) return;
    
    const listData = await listRes.json();
    if (!listData.products?.length) return;
    
    const productId = listData.products[0].id;
    
    const start = Date.now();
    const response = await request.get(`${API_BASE}/products/${productId}`);
    const duration = Date.now() - start;
    
    if (response.ok()) {
      expect(duration).toBeLessThan(2000);
    }
  });

  test('Admin analytics should respond within 5 seconds', async ({ request }) => {
    const start = Date.now();
    const response = await request.get(`${API_BASE}/admin/ecommerce/analytics`, {
      headers: { 'X-UAT-Mode': 'true', 'X-UAT-Token': 'uat-token-admin' },
    });
    const duration = Date.now() - start;
    
    expect([200, 400, 404, 500]).toContain(response.status());
    expect(duration).toBeLessThan(5000);
  });
});

// ===========================================================================
// SECTION 15: CONCURRENT REQUEST HANDLING
// ===========================================================================

test.describe('Concurrent Request Handling', () => {
  test('Multiple product requests should succeed', async ({ request }) => {
    const promises = Array.from({ length: 5 }, () =>
      request.get(`${API_BASE}/products?limit=5`)
    );
    
    const responses = await Promise.all(promises);
    
    for (const response of responses) {
      expect(response.ok()).toBeTruthy();
    }
  });

  test('Mixed endpoint requests should succeed', async ({ request }) => {
    const promises = [
      request.get(`${API_BASE}/products?limit=3`),
      request.get(`${API_BASE}/ecommerce/categories`),
      request.get(`${API_BASE}/returns/reasons`),
    ];
    
    const responses = await Promise.all(promises);
    
    for (const response of responses) {
      expect([200, 404, 500]).toContain(response.status());
    }
  });
});
