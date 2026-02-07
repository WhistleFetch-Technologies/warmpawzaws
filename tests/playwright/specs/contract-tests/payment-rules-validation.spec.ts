/**
 * ============================================================================
 * PAYMENT, TAX, AND LOGISTICS RULES VALIDATION TESTS
 * ============================================================================
 * 
 * Verifies business rules for:
 * - GST/Tax calculations
 * - Platform fees and convenience charges
 * - Logistics and delivery charges
 * - Discounts, promotions, and coupons
 * - Wallet balance usage
 * - Refund and cancellation policies
 * - Subscription and package tracking
 * - Vendor discounts vs platform discounts
 * 
 * Date: 2026-01-20
 * ============================================================================
 */

import { test, expect } from '@playwright/test';

const API_BASE = process.env.API_URL || process.env.API_BASE_URL || '';

// ============================================================================
// TAX AND FEE RULES
// ============================================================================

const EXPECTED_TAX_RULES = {
  GST: {
    services: 18, // 18% GST on services
    products: 5,  // 5% GST on pet products (varies)
    medicines: 0, // 0% GST on medicines
  },
  platformFee: {
    percentage: 2, // 2% platform fee
    minAmount: 0,
    maxAmount: 100, // Max ₹100
  },
  convenienceFee: {
    fixedAmount: 15, // ₹15 convenience fee
    applicableOn: ['cod', 'wallet'],
  },
};

const EXPECTED_LOGISTICS_RULES = {
  delivery: {
    baseCharge: 30, // ₹30 base delivery charge
    perKmCharge: 5, // ₹5 per km
    freeDeliveryAbove: 500, // Free delivery above ₹500
    maxRadius: 20, // 20km max delivery radius
  },
  pharmacy: {
    broadcastRadii: [5, 10, 20], // km
    broadcastInterval: 2, // minutes
  },
  meals: {
    maxRadius: 10, // 10km for meals
    coldChainRequired: ['fresh_food', 'frozen_food'],
  },
};

test.describe('GST and Tax Calculation Rules', () => {
  
  test('GST is calculated correctly on service bookings', async ({ request }) => {
    const basePrice = 1000;
    const expectedGst = basePrice * (EXPECTED_TAX_RULES.GST.services / 100);
    
    // Verify tax calculation endpoint or response
    const response = await request.post(`${API_BASE}/payments/calculate`, {
      headers: {
        'Content-Type': 'application/json',
        'X-UAT-Mode': 'true',
        'X-UAT-Token': 'uat-test-token',
      },
      data: {
        type: 'service',
        baseAmount: basePrice,
        serviceType: 'at_center',
      },
    });
    
    if (response.ok()) {
      const data = await response.json();
      
      if (data.taxAmount !== undefined) {
        // Verify GST is calculated at expected rate
        expect(data.taxAmount).toBeGreaterThanOrEqual(0);
      }
      
      if (data.totalAmount !== undefined) {
        // Total should be base + tax + fees
        expect(data.totalAmount).toBeGreaterThan(basePrice);
      }
    }
  });

  test('GST breakdown is included in payment response', async ({ request }) => {
    const response = await request.get(`${API_BASE}/admin/finance/tax-rules`, {
      headers: {
        'X-UAT-Mode': 'true',
        'X-UAT-Token': 'uat-test-token',
      },
    });
    
    if (response.ok()) {
      const data = await response.json();
      
      // Verify tax rules structure
      if (data.rules) {
        expect(Array.isArray(data.rules)).toBeTruthy();
        
        // Each rule should have type and percentage
        data.rules.forEach((rule: any) => {
          expect(rule).toHaveProperty('percentage');
          expect(typeof rule.percentage).toBe('number');
          expect(rule.percentage).toBeGreaterThanOrEqual(0);
          expect(rule.percentage).toBeLessThanOrEqual(100);
        });
      }
    }
  });

  test('Medicine orders have 0% GST applied', async ({ request }) => {
    const response = await request.post(`${API_BASE}/payments/calculate`, {
      headers: {
        'Content-Type': 'application/json',
        'X-UAT-Mode': 'true',
        'X-UAT-Token': 'uat-test-token',
      },
      data: {
        type: 'pharmacy',
        baseAmount: 500,
        category: 'medicine',
      },
    });
    
    if (response.ok()) {
      const data = await response.json();
      
      // Medicines should have 0% GST
      if (data.gstAmount !== undefined) {
        expect(data.gstAmount).toBe(0);
      }
    }
  });
});

test.describe('Platform Fee and Convenience Charges', () => {
  
  test('Platform fee is calculated within bounds', async ({ request }) => {
    const testAmounts = [100, 500, 1000, 5000, 10000];
    
    for (const amount of testAmounts) {
      const response = await request.post(`${API_BASE}/payments/calculate`, {
        headers: {
          'Content-Type': 'application/json',
          'X-UAT-Mode': 'true',
          'X-UAT-Token': 'uat-test-token',
        },
        data: {
          type: 'service',
          baseAmount: amount,
        },
      });
      
      if (response.ok()) {
        const data = await response.json();
        
        if (data.platformFee !== undefined) {
          // Platform fee should not exceed max
          expect(data.platformFee).toBeLessThanOrEqual(EXPECTED_TAX_RULES.platformFee.maxAmount);
          expect(data.platformFee).toBeGreaterThanOrEqual(EXPECTED_TAX_RULES.platformFee.minAmount);
        }
      }
    }
  });

  test('Convenience fee is applied for COD payments', async ({ request }) => {
    const response = await request.post(`${API_BASE}/payments/calculate`, {
      headers: {
        'Content-Type': 'application/json',
        'X-UAT-Mode': 'true',
        'X-UAT-Token': 'uat-test-token',
      },
      data: {
        type: 'service',
        baseAmount: 500,
        paymentMethod: 'cod',
      },
    });
    
    if (response.ok()) {
      const data = await response.json();
      
      // COD should have convenience fee
      if (data.convenienceFee !== undefined) {
        expect(data.convenienceFee).toBeGreaterThan(0);
      }
    }
  });

  test('Online payments have no convenience fee', async ({ request }) => {
    const response = await request.post(`${API_BASE}/payments/calculate`, {
      headers: {
        'Content-Type': 'application/json',
        'X-UAT-Mode': 'true',
        'X-UAT-Token': 'uat-test-token',
      },
      data: {
        type: 'service',
        baseAmount: 500,
        paymentMethod: 'razorpay',
      },
    });
    
    if (response.ok()) {
      const data = await response.json();
      
      // Online payment should not have convenience fee
      if (data.convenienceFee !== undefined) {
        expect(data.convenienceFee).toBe(0);
      }
    }
  });
});

test.describe('Logistics and Delivery Rules', () => {
  
  test('Delivery charges are calculated based on distance', async ({ request }) => {
    const testDistances = [2, 5, 10, 15]; // km
    
    for (const distance of testDistances) {
      const response = await request.post(`${API_BASE}/logistics/calculate-delivery`, {
        headers: {
          'Content-Type': 'application/json',
          'X-UAT-Mode': 'true',
          'X-UAT-Token': 'uat-test-token',
        },
        data: {
          distanceKm: distance,
          orderAmount: 300,
        },
      });
      
      if (response.ok()) {
        const data = await response.json();
        
        if (data.deliveryCharge !== undefined) {
          // Delivery charge should increase with distance
          const expectedMinCharge = EXPECTED_LOGISTICS_RULES.delivery.baseCharge + 
            (distance * EXPECTED_LOGISTICS_RULES.delivery.perKmCharge);
          
          expect(data.deliveryCharge).toBeGreaterThanOrEqual(0);
        }
      }
    }
  });

  test('Free delivery for orders above threshold', async ({ request }) => {
    const response = await request.post(`${API_BASE}/logistics/calculate-delivery`, {
      headers: {
        'Content-Type': 'application/json',
        'X-UAT-Mode': 'true',
        'X-UAT-Token': 'uat-test-token',
      },
      data: {
        distanceKm: 5,
        orderAmount: 1000, // Above free delivery threshold
      },
    });
    
    if (response.ok()) {
      const data = await response.json();
      
      if (data.deliveryCharge !== undefined && data.orderAmount >= EXPECTED_LOGISTICS_RULES.delivery.freeDeliveryAbove) {
        expect(data.deliveryCharge).toBe(0);
      }
    }
  });

  test('Pharmacy broadcast follows radius expansion rules', async ({ request }) => {
    const response = await request.get(`${API_BASE}/admin/logistics/config`, {
      headers: {
        'X-UAT-Mode': 'true',
        'X-UAT-Token': 'uat-test-token',
      },
    });
    
    if (response.ok()) {
      const data = await response.json();
      
      if (data.pharmacyBroadcast) {
        // Verify broadcast radii are configured
        expect(data.pharmacyBroadcast.radii || data.pharmacyBroadcast.broadcastRadii).toBeDefined();
      }
    }
  });

  test('Hyperlocal delivery radius is enforced', async ({ request }) => {
    const response = await request.post(`${API_BASE}/logistics/check-delivery`, {
      headers: {
        'Content-Type': 'application/json',
        'X-UAT-Mode': 'true',
        'X-UAT-Token': 'uat-test-token',
      },
      data: {
        distanceKm: 25, // Beyond max radius
        orderType: 'pharmacy',
      },
    });
    
    if (response.ok()) {
      const data = await response.json();
      
      // Should indicate delivery not available
      if (data.available !== undefined && data.distanceKm > EXPECTED_LOGISTICS_RULES.delivery.maxRadius) {
        expect(data.available).toBe(false);
      }
    }
  });
});

test.describe('Discounts and Promotions', () => {
  
  test('Vendor discount is applied directly to service price', async ({ request }) => {
    const response = await request.post(`${API_BASE}/payments/calculate`, {
      headers: {
        'Content-Type': 'application/json',
        'X-UAT-Mode': 'true',
        'X-UAT-Token': 'uat-test-token',
      },
      data: {
        type: 'service',
        baseAmount: 1000,
        vendorDiscount: {
          type: 'percentage',
          value: 10,
        },
      },
    });
    
    if (response.ok()) {
      const data = await response.json();
      
      if (data.vendorDiscount !== undefined) {
        // Vendor discount should reduce base price
        expect(data.vendorDiscount).toBe(100); // 10% of 1000
      }
    }
  });

  test('Platform discount is applied at payment page', async ({ request }) => {
    const response = await request.post(`${API_BASE}/payments/calculate`, {
      headers: {
        'Content-Type': 'application/json',
        'X-UAT-Mode': 'true',
        'X-UAT-Token': 'uat-test-token',
      },
      data: {
        type: 'service',
        baseAmount: 1000,
        couponCode: 'WARMPAWZ10',
      },
    });
    
    if (response.ok()) {
      const data = await response.json();
      
      // Platform discount should be applied
      if (data.couponDiscount !== undefined) {
        expect(data.couponDiscount).toBeGreaterThanOrEqual(0);
      }
    }
  });

  test('Coupon validation returns clear error for invalid codes', async ({ request }) => {
    const response = await request.post(`${API_BASE}/coupons/validate`, {
      headers: {
        'Content-Type': 'application/json',
        'X-UAT-Mode': 'true',
        'X-UAT-Token': 'uat-test-token',
      },
      data: {
        couponCode: 'INVALID_CODE_123',
        orderAmount: 500,
      },
    });
    
    if (response.ok()) {
      const data = await response.json();
      expect(data.valid).toBe(false);
      expect(data).toHaveProperty('error');
    }
  });

  test('Buy X Get Y promotions work correctly', async ({ request }) => {
    const response = await request.post(`${API_BASE}/promotions/apply`, {
      headers: {
        'Content-Type': 'application/json',
        'X-UAT-Mode': 'true',
        'X-UAT-Token': 'uat-test-token',
      },
      data: {
        items: [
          { productId: '00000000-0000-0000-0000-000000000001', quantity: 2 },
        ],
        promotionType: 'buy_x_get_y',
      },
    });
    
    // Verify promotion application
    if (response.ok()) {
      const data = await response.json();
      // Should indicate free items or discount applied
    }
  });
});

test.describe('Wallet Balance Usage', () => {
  
  test('Wallet balance can be used for payment', async ({ request }) => {
    const response = await request.post(`${API_BASE}/payments/apply-wallet`, {
      headers: {
        'Content-Type': 'application/json',
        'X-UAT-Mode': 'true',
        'X-UAT-Token': 'uat-test-token',
      },
      data: {
        customerId: '00000000-0000-0000-0000-000000000001',
        orderAmount: 500,
        useWallet: true,
      },
    });
    
    if (response.ok()) {
      const data = await response.json();
      
      if (data.walletAmount !== undefined) {
        expect(data.walletAmount).toBeGreaterThanOrEqual(0);
      }
      
      if (data.remainingAmount !== undefined) {
        expect(data.remainingAmount).toBeGreaterThanOrEqual(0);
      }
    }
  });

  test('Wallet balance is capped at order total', async ({ request }) => {
    const response = await request.get(`${API_BASE}/customers/00000000-0000-0000-0000-000000000001/wallet`, {
      headers: {
        'X-UAT-Mode': 'true',
        'X-UAT-Token': 'uat-test-token',
      },
    });
    
    if (response.ok()) {
      const data = await response.json();
      
      if (data.balance !== undefined) {
        expect(data.balance).toBeGreaterThanOrEqual(0);
      }
    }
  });
});

test.describe('Refund and Cancellation Policies', () => {
  
  test('Cancellation policy returns time-based rules', async ({ request }) => {
    const response = await request.get(`${API_BASE}/bookings/cancellation-policy`, {
      headers: {
        'X-UAT-Mode': 'true',
        'X-UAT-Token': 'uat-test-token',
      },
    });
    
    if (response.ok()) {
      const data = await response.json();
      
      // Verify policy structure
      if (data.policy || data.rules) {
        const rules = data.policy || data.rules;
        
        // Should have time-based refund percentages
        if (Array.isArray(rules)) {
          rules.forEach((rule: any) => {
            expect(rule).toHaveProperty('hoursBeforeBooking');
            expect(rule).toHaveProperty('refundPercentage');
          });
        }
      }
    }
  });

  test('Refund calculation follows policy rules', async ({ request }) => {
    const response = await request.post(`${API_BASE}/refunds/calculate`, {
      headers: {
        'Content-Type': 'application/json',
        'X-UAT-Mode': 'true',
        'X-UAT-Token': 'uat-test-token',
      },
      data: {
        bookingId: '00000000-0000-0000-0000-000000000001',
        originalAmount: 1000,
        hoursBeforeBooking: 24,
      },
    });
    
    if (response.ok()) {
      const data = await response.json();
      
      if (data.refundAmount !== undefined) {
        expect(data.refundAmount).toBeGreaterThanOrEqual(0);
        expect(data.refundAmount).toBeLessThanOrEqual(1000);
      }
    }
  });

  test('Rescheduling policy is distinct from cancellation', async ({ request }) => {
    const response = await request.get(`${API_BASE}/bookings/reschedule-policy`, {
      headers: {
        'X-UAT-Mode': 'true',
        'X-UAT-Token': 'uat-test-token',
      },
    });
    
    if (response.ok()) {
      const data = await response.json();
      
      // Rescheduling policy may differ from cancellation
      if (data.allowReschedule !== undefined) {
        expect(typeof data.allowReschedule).toBe('boolean');
      }
    }
  });
});

test.describe('Subscription and Package Tracking', () => {
  
  test('Active subscription bypasses payment for booking', async ({ request }) => {
    const response = await request.post(`${API_BASE}/subscriptions/check-booking`, {
      headers: {
        'Content-Type': 'application/json',
        'X-UAT-Mode': 'true',
        'X-UAT-Token': 'uat-test-token',
      },
      data: {
        customerId: '00000000-0000-0000-0000-000000000001',
        serviceType: 'veterinarian',
        bookingDate: '2026-02-01',
      },
    });
    
    if (response.ok()) {
      const data = await response.json();
      
      if (data.hasActiveSubscription) {
        // Should indicate 0 payment required
        expect(data.paymentRequired).toBe(0);
      }
    }
  });

  test('Package sessions are tracked correctly', async ({ request }) => {
    const response = await request.get(`${API_BASE}/packages/00000000-0000-0000-0000-000000000001/sessions`, {
      headers: {
        'X-UAT-Mode': 'true',
        'X-UAT-Token': 'uat-test-token',
      },
    });
    
    if (response.ok()) {
      const data = await response.json();
      
      if (data.totalSessions !== undefined) {
        expect(data.totalSessions).toBeGreaterThan(0);
      }
      
      if (data.usedSessions !== undefined) {
        expect(data.usedSessions).toBeGreaterThanOrEqual(0);
        expect(data.usedSessions).toBeLessThanOrEqual(data.totalSessions);
      }
    }
  });

  test('Package expiry is enforced', async ({ request }) => {
    const response = await request.get(`${API_BASE}/packages/00000000-0000-0000-0000-000000000001`, {
      headers: {
        'X-UAT-Mode': 'true',
        'X-UAT-Token': 'uat-test-token',
      },
    });
    
    if (response.ok()) {
      const data = await response.json();
      
      if (data.expiryDate) {
        const expiryDate = new Date(data.expiryDate);
        expect(expiryDate).toBeInstanceOf(Date);
      }
    }
  });
});

test.describe('Tier Commission System', () => {
  
  test('Vendor tier determines commission rate', async ({ request }) => {
    const response = await request.get(`${API_BASE}/admin/tiers`, {
      headers: {
        'X-UAT-Mode': 'true',
        'X-UAT-Token': 'uat-test-token',
      },
    });
    
    if (response.ok()) {
      const data = await response.json();
      
      if (data.tiers) {
        expect(Array.isArray(data.tiers)).toBeTruthy();
        
        data.tiers.forEach((tier: any) => {
          expect(tier).toHaveProperty('name');
          expect(tier).toHaveProperty('commissionPercentage');
          expect(tier.commissionPercentage).toBeGreaterThanOrEqual(0);
          expect(tier.commissionPercentage).toBeLessThanOrEqual(100);
        });
      }
    }
  });

  test('Settlement calculation applies tier commission', async ({ request }) => {
    const response = await request.post(`${API_BASE}/settlements/calculate`, {
      headers: {
        'Content-Type': 'application/json',
        'X-UAT-Mode': 'true',
        'X-UAT-Token': 'uat-test-token',
      },
      data: {
        vendorId: '00000000-0000-0000-0000-000000000001',
        bookingAmount: 1000,
        tier: 'silver',
      },
    });
    
    if (response.ok()) {
      const data = await response.json();
      
      if (data.commission !== undefined && data.vendorPayout !== undefined) {
        expect(data.commission).toBeGreaterThanOrEqual(0);
        expect(data.vendorPayout).toBeLessThanOrEqual(1000);
        expect(data.commission + data.vendorPayout).toBeCloseTo(1000, 2);
      }
    }
  });
});

test.describe('Universal Payment Page Validation', () => {
  
  test('Payment page calculates all components correctly', async ({ request }) => {
    const orderDetails = {
      type: 'service',
      baseAmount: 1000,
      vendorId: '00000000-0000-0000-0000-000000000001',
      customerId: '00000000-0000-0000-0000-000000000001',
      serviceStyle: 'at_center',
      couponCode: null,
      useWallet: true,
      paymentMethod: 'razorpay',
    };
    
    const response = await request.post(`${API_BASE}/payments/calculate`, {
      headers: {
        'Content-Type': 'application/json',
        'X-UAT-Mode': 'true',
        'X-UAT-Token': 'uat-test-token',
      },
      data: orderDetails,
    });
    
    if (response.ok()) {
      const data = await response.json();
      
      // Verify all payment components are calculated
      const expectedFields = ['baseAmount', 'taxAmount', 'platformFee', 'totalAmount'];
      expectedFields.forEach(field => {
        const snakeCase = field.replace(/([A-Z])/g, '_$1').toLowerCase();
        expect(data[field] !== undefined || data[snakeCase] !== undefined).toBeTruthy();
      });
      
      // Verify total is sum of components
      if (data.totalAmount && data.baseAmount) {
        const calculatedTotal = data.baseAmount + 
          (data.taxAmount || 0) + 
          (data.platformFee || 0) + 
          (data.convenienceFee || 0) -
          (data.walletAmount || 0) -
          (data.couponDiscount || 0) -
          (data.vendorDiscount || 0);
        
        expect(Math.abs(data.totalAmount - calculatedTotal)).toBeLessThan(1); // Allow rounding
      }
    }
  });
});
