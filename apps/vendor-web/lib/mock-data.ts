/**
 * ============================================================================
 * MOCK DATA FOR LOCAL TESTING
 * ============================================================================
 * Used when database is not reachable (AWS RDS in dev environment)
 * ============================================================================
 */

// ============================================================================
// MOCK PRODUCTS
// ============================================================================

export const mockProducts = [
  {
    id: 'prod-1',
    name: 'Premium Dog Food',
    description: 'High quality dog food with all essential nutrients',
    category: 'Food',
    category_id: 'cat-1',
    price: 599,
    stock: 100,
    stock_quantity: 100,
    hsn_code: '2309',
    gst_rate: 18,
    sku: 'DOG-FOOD-001',
    is_active: true,
    images: [],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'prod-2',
    name: 'Cat Litter',
    description: 'Premium clumping cat litter',
    category: 'Accessories',
    category_id: 'cat-2',
    price: 299,
    stock: 50,
    stock_quantity: 50,
    hsn_code: '2309',
    gst_rate: 18,
    sku: 'CAT-LITTER-001',
    is_active: true,
    images: [],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

// ============================================================================
// MOCK CATEGORIES
// ============================================================================

export const mockCategories = [
  { id: 'cat-1', name: 'Food', description: 'Pet food products' },
  { id: 'cat-2', name: 'Accessories', description: 'Pet accessories' },
  { id: 'cat-3', name: 'Toys', description: 'Pet toys' },
  { id: 'cat-4', name: 'Health', description: 'Health products' },
];

// ============================================================================
// MOCK ORDERS
// ============================================================================

export const mockOrders = [
  {
    id: 'order-1',
    order_number: 'ORD-2026-001',
    customer_id: 'cust-1',
    customer_name: 'John Doe',
    customer_phone: '+91 9876543210',
    customer_email: 'john@example.com',
    order_status: 'pending',
    total_amount: 1198,
    subtotal: 1000,
    tax_amount: 180,
    shipping_amount: 18,
    payment_method: 'razorpay',
    payment_status: 'paid',
    shipping_address: {
      street: '123 Main St',
      city: 'Mumbai',
      state: 'Maharashtra',
      pincode: '400001',
    },
    tracking_number: null,
    created_at: new Date().toISOString(),
    items: [
      {
        id: 'item-1',
        product_id: 'prod-1',
        product_name: 'Premium Dog Food',
        quantity: 2,
        price: 599,
        total: 1198,
        product_image: null,
      },
    ],
  },
  {
    id: 'order-2',
    order_number: 'ORD-2026-002',
    customer_id: 'cust-2',
    customer_name: 'Jane Smith',
    customer_phone: '+91 9876543211',
    customer_email: 'jane@example.com',
    order_status: 'shipped',
    total_amount: 299,
    subtotal: 250,
    tax_amount: 45,
    shipping_amount: 4,
    payment_method: 'razorpay',
    payment_status: 'paid',
    shipping_address: {
      street: '456 Park Ave',
      city: 'Delhi',
      state: 'Delhi',
      pincode: '110001',
    },
    tracking_number: 'TRACK123456',
    shipped_at: new Date(Date.now() - 86400000).toISOString(),
    created_at: new Date(Date.now() - 172800000).toISOString(),
    items: [
      {
        id: 'item-2',
        product_id: 'prod-2',
        product_name: 'Cat Litter',
        quantity: 1,
        price: 299,
        total: 299,
        product_image: null,
      },
    ],
  },
];

// ============================================================================
// MOCK ORDER STATS
// ============================================================================

export const mockOrderStats = {
  total: 10,
  pending: 3,
  confirmed: 2,
  processing: 2,
  shipped: 2,
  delivered: 1,
  cancelled: 0,
  total_revenue: 15000,
};

// ============================================================================
// MOCK SALES ANALYTICS
// ============================================================================

export const mockSalesAnalytics = {
  salesStats: {
    total_orders: 10,
    completed_orders: 7,
    total_revenue: 15000,
    avg_order_value: 2142.86,
    unique_customers: 5,
    cancelled_orders: 0,
  },
  revenueByDay: [
    { date: '2026-01-01', revenue: 2000, orders_count: 2 },
    { date: '2026-01-02', revenue: 3000, orders_count: 3 },
    { date: '2026-01-03', revenue: 2500, orders_count: 2 },
    { date: '2026-01-04', revenue: 4000, orders_count: 3 },
    { date: '2026-01-05', revenue: 3500, orders_count: 2 },
  ],
  orderTrends: [
    { date: '2026-01-01', pending: 1, confirmed: 1, processing: 0, shipped: 0, delivered: 0, cancelled: 0 },
    { date: '2026-01-02', pending: 0, confirmed: 1, processing: 1, shipped: 1, delivered: 0, cancelled: 0 },
    { date: '2026-01-03', pending: 1, confirmed: 0, processing: 1, shipped: 0, delivered: 1, cancelled: 0 },
  ],
};

// ============================================================================
// MOCK PRODUCT PERFORMANCE
// ============================================================================

export const mockProductPerformance = {
  topProducts: [
    {
      id: 'prod-1',
      name: 'Premium Dog Food',
      price: 599,
      images: [],
      units_sold: 50,
      total_quantity: 50,
      revenue: 29950,
    },
    {
      id: 'prod-2',
      name: 'Cat Litter',
      price: 299,
      images: [],
      units_sold: 30,
      total_quantity: 30,
      revenue: 8970,
    },
  ],
  productByCategory: [
    { category: 'Food', product_count: 5, units_sold: 100, revenue: 50000 },
    { category: 'Accessories', product_count: 3, units_sold: 50, revenue: 15000 },
  ],
};

// ============================================================================
// MOCK API CLIENT WITH FALLBACK
// ============================================================================

export function createMockApiClient() {
  const isLocalMode = process.env.NODE_ENV === 'development' && 
                      !process.env.NEXT_PUBLIC_API_BASE_URL;

  return {
    get: async (endpoint: string) => {
      if (isLocalMode) {
        // Simulate network delay
        await new Promise(resolve => setTimeout(resolve, 300));

        // Route to appropriate mock data
        if (endpoint.includes('/products') && !endpoint.includes('/products/')) {
          return { products: mockProducts, total: mockProducts.length };
        }
        if (endpoint.includes('/categories')) {
          return { categories: mockCategories };
        }
        if (endpoint.includes('/orders/stats')) {
          return { stats: mockOrderStats };
        }
        if (endpoint.includes('/orders') && !endpoint.includes('/orders/')) {
          return { orders: mockOrders, total: mockOrders.length };
        }
        if (endpoint.includes('/analytics/sales')) {
          return mockSalesAnalytics;
        }
        if (endpoint.includes('/analytics/products')) {
          return mockProductPerformance;
        }
      }
      throw new Error('API not available in local mode');
    },
    post: async (endpoint: string, data: any) => {
      if (isLocalMode) {
        await new Promise(resolve => setTimeout(resolve, 300));
        return { success: true, message: 'Mock operation successful' };
      }
      throw new Error('API not available in local mode');
    },
    put: async (endpoint: string, data: any) => {
      if (isLocalMode) {
        await new Promise(resolve => setTimeout(resolve, 300));
        return { success: true, message: 'Mock operation successful' };
      }
      throw new Error('API not available in local mode');
    },
    delete: async (endpoint: string) => {
      if (isLocalMode) {
        await new Promise(resolve => setTimeout(resolve, 300));
        return { success: true, message: 'Mock operation successful' };
      }
      throw new Error('API not available in local mode');
    },
  };
}

