/**
 * ============================================================================
 * MOCK DATA FOR CUSTOMER WEB - LOCAL TESTING
 * ============================================================================
 */

export const mockCustomerOrders = [
  {
    id: 'order-1',
    order_number: 'ORD-2026-001',
    vendor_id: 'vendor-1',
    vendor_name: 'Pet Store Mumbai',
    total_amount: 1198,
    discount_amount: 0,
    final_amount: 1198,
    status: 'pending',
    payment_status: 'paid',
    payment_method: 'razorpay',
    delivery_address: {
      street: '123 Main St',
      city: 'Mumbai',
      state: 'Maharashtra',
      pincode: '400001',
    },
    delivery_status: 'pending',
    tracking_number: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
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
    vendor_id: 'vendor-2',
    vendor_name: 'Pet Care Delhi',
    total_amount: 299,
    discount_amount: 0,
    final_amount: 299,
    status: 'shipped',
    payment_status: 'paid',
    payment_method: 'razorpay',
    delivery_address: {
      street: '456 Park Ave',
      city: 'Delhi',
      state: 'Delhi',
      pincode: '110001',
    },
    delivery_status: 'in_transit',
    tracking_number: 'TRACK123456',
    created_at: new Date(Date.now() - 172800000).toISOString(),
    updated_at: new Date(Date.now() - 86400000).toISOString(),
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
  {
    id: 'order-3',
    order_number: 'ORD-2026-003',
    vendor_id: 'vendor-1',
    vendor_name: 'Pet Store Mumbai',
    total_amount: 899,
    discount_amount: 100,
    final_amount: 799,
    status: 'delivered',
    payment_status: 'paid',
    payment_method: 'razorpay',
    delivery_address: {
      street: '123 Main St',
      city: 'Mumbai',
      state: 'Maharashtra',
      pincode: '400001',
    },
    delivery_status: 'delivered',
    tracking_number: 'TRACK789012',
    created_at: new Date(Date.now() - 259200000).toISOString(),
    updated_at: new Date(Date.now() - 172800000).toISOString(),
    items: [
      {
        id: 'item-3',
        product_id: 'prod-3',
        product_name: 'Dog Toy',
        quantity: 1,
        price: 899,
        total: 899,
        product_image: null,
      },
    ],
  },
];

export const mockOrderStats = {
  total: 3,
  pending: 1,
  confirmed: 0,
  processing: 0,
  shipped: 1,
  delivered: 1,
  cancelled: 0,
  total_spent: 2296,
};

export const mockTrackingInfo = {
  order: {
    id: 'order-2',
    orderNumber: 'ORD-2026-002',
    status: 'shipped',
    trackingNumber: 'TRACK123456',
    shippedAt: new Date(Date.now() - 86400000).toISOString(),
    deliveredAt: null,
  },
  shipments: [
    {
      id: 'ship-1',
      awb_code: 'TRACK123456',
      status: 'in_transit',
      current_status: 'In Transit',
      estimated_delivery_date: new Date(Date.now() + 86400000).toISOString(),
      tracking_url: 'https://shiprocket.co/track/TRACK123456',
      status_history: [
        {
          status: 'Order Placed',
          timestamp: new Date(Date.now() - 172800000).toISOString(),
          location: 'Mumbai',
        },
        {
          status: 'Confirmed',
          timestamp: new Date(Date.now() - 172700000).toISOString(),
          location: 'Mumbai',
        },
        {
          status: 'Shipped',
          timestamp: new Date(Date.now() - 86400000).toISOString(),
          location: 'Mumbai Warehouse',
        },
        {
          status: 'In Transit',
          timestamp: new Date(Date.now() - 43200000).toISOString(),
          location: 'Delhi Hub',
        },
      ],
    },
  ],
};

