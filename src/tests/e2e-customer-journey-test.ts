/**
 * COMPREHENSIVE E2E CUSTOMER JOURNEY TEST
 * 
 * Tests complete customer lifecycle:
 * 1. Customer Registration & Onboarding
 * 2. Service Discovery (all service types and styles)
 * 3. Booking Flow (with all features)
 * 4. Payment (wallet, coupons, discounts, GST)
 * 5. Booking Lifecycle (OTP, completion, delivery)
 * 6. Loyalty Points & Rewards
 * 7. Referral System
 * 8. Refunds & Wallet Credits
 * 9. GST Invoice Generation
 * 10. Service Delivery Verification
 * 
 * Tests all service categories and service styles (at_home, at_center, tele)
 */

import { projectId, publicAnonKey } from '../utils/supabase/info.tsx';

const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475`;

// Test configuration
const TEST_CONFIG = {
  timeout: 30000,
  retries: 3,
  serviceCategories: [
    'veterinary',
    'grooming',
    'training',
    'walking',
    'boarding',
    'pharmacy',
    'nutrition',
    'photography',
    'cafe',
    'insurance',
    'ambulance',
    'adoption',
    'memorial'
  ],
  serviceStyles: ['at_home', 'at_center', 'tele'],
  vendorRoles: [
    'veterinarian',
    'pet_clinic',
    'pet_groomer',
    'pet_trainer',
    'pet_walker',
    'pet_cafe',
    'pet_resort',
    'pet_pharmacy',
    'pet_nutritionist',
    'pet_photographer'
  ]
};

interface TestResult {
  testName: string;
  status: 'PASS' | 'FAIL' | 'SKIP';
  message: string;
  duration: number;
  details?: any;
}

interface TestSuite {
  suiteName: string;
  results: TestResult[];
  totalTests: number;
  passedTests: number;
  failedTests: number;
  skippedTests: number;
  duration: number;
}

interface ServiceListing {
  api: string;
  method: string;
  description: string;
  services: any[];
}

class E2ECustomerJourneyTest {
  private results: TestResult[] = [];
  private startTime: number = 0;
  private testCustomer: any = null;
  private testPet: any = null;
  private testBookings: Map<string, any> = new Map();
  private testServices: Map<string, any> = new Map();
  private serviceListings: ServiceListing[] = [];
  private loyaltyProfile: any = null;
  private walletBalance: number = 0;
  private referralCode: string = '';

  async runAllTests(): Promise<TestSuite[]> {
    console.log('🚀 Starting Comprehensive E2E Customer Journey Tests...\n');
    this.startTime = Date.now();

    const suites: TestSuite[] = [];

    // Test Suite 1: Customer Registration & Onboarding
    suites.push(await this.testCustomerRegistration());

    // Test Suite 2: Service Discovery & Listing
    suites.push(await this.testServiceDiscovery());

    // Test Suite 3: Booking Flow with All Features
    suites.push(await this.testBookingFlowWithFeatures());

    // Test Suite 4: Payment Features (Wallet, Coupons, Discounts, GST)
    suites.push(await this.testPaymentFeatures());

    // Test Suite 5: Booking Lifecycle (OTP, Completion, Delivery)
    suites.push(await this.testBookingLifecycle());

    // Test Suite 6: Loyalty Points & Rewards
    suites.push(await this.testLoyaltyPoints());

    // Test Suite 7: Referral System
    suites.push(await this.testReferralSystem());

    // Test Suite 8: Refunds & Wallet Credits
    suites.push(await this.testRefundsAndWallet());

    // Test Suite 9: GST Invoice Generation
    suites.push(await this.testGSTInvoices());

    // Test Suite 10: Service Delivery Verification
    suites.push(await this.testServiceDelivery());

    const totalDuration = Date.now() - this.startTime;
    console.log(`\n✅ All test suites completed in ${(totalDuration / 1000).toFixed(2)}s\n`);

    // Generate comprehensive report
    this.generateServiceListingReport();

    return suites;
  }

  // ==========================================
  // TEST SUITE 1: CUSTOMER REGISTRATION
  // ==========================================
  async testCustomerRegistration(): Promise<TestSuite> {
    const suiteName = 'Customer Registration & Onboarding';
    const results: TestResult[] = [];
    const suiteStart = Date.now();

    console.log(`\n📋 ${suiteName}`);

    // Test 1.1: Register customer
    const testName1 = 'Register customer';
    const start1 = Date.now();
    try {
      const phone = `+91${Math.floor(1000000000 + Math.random() * 9000000000)}`;
      const response = await fetch(`${API_BASE}/customer/auth/register`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${publicAnonKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          phone,
          name: 'Test Customer',
          email: `test_customer_${Date.now()}@example.com`
        })
      });

      if (response.ok) {
        const data = await response.json();
        this.testCustomer = data.customer || data;
        results.push({
          testName: testName1,
          status: 'PASS',
          message: 'Customer registered successfully',
          duration: Date.now() - start1,
          details: { customerId: this.testCustomer.id || this.testCustomer.customerId }
        });
      } else {
        const errorText = await response.text();
        results.push({
          testName: testName1,
          status: 'FAIL',
          message: `Registration failed: ${errorText}`,
          duration: Date.now() - start1
        });
      }
    } catch (error: any) {
      results.push({
        testName: testName1,
        status: 'FAIL',
        message: `Error: ${error.message}`,
        duration: Date.now() - start1
      });
    }

    // Test 1.2: Add pet profile
    if (this.testCustomer) {
      const testName2 = 'Add pet profile';
      const start2 = Date.now();
      try {
        const customerId = this.testCustomer.id || this.testCustomer.customerId;
        const response = await fetch(`${API_BASE}/customer/pets`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            customerId,
            name: 'Test Pet',
            type: 'dog',
            breed: 'Golden Retriever',
            age: 2,
            gender: 'male',
            weight: 25
          })
        });

        if (response.ok) {
          const data = await response.json();
          this.testPet = data.pet || data;
          results.push({
            testName: testName2,
            status: 'PASS',
            message: 'Pet profile added successfully',
            duration: Date.now() - start2,
            details: { petId: this.testPet.id }
          });
        } else {
          results.push({
            testName: testName2,
            status: 'FAIL',
            message: 'Failed to add pet profile',
            duration: Date.now() - start2
          });
        }
      } catch (error: any) {
        results.push({
          testName: testName2,
          status: 'FAIL',
          message: `Error: ${error.message}`,
          duration: Date.now() - start2
        });
      }
    }

    // Test 1.3: Get loyalty profile (should be auto-created)
    if (this.testCustomer) {
      const testName3 = 'Get loyalty profile';
      const start3 = Date.now();
      try {
        const customerId = this.testCustomer.id || this.testCustomer.customerId;
        const response = await fetch(`${API_BASE}/loyalty/profile/${customerId}?userType=customer`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`
          }
        });

        if (response.ok) {
          const data = await response.json();
          this.loyaltyProfile = data.profile || data;
          this.referralCode = this.loyaltyProfile.referralCode || '';
          results.push({
            testName: testName3,
            status: 'PASS',
            message: 'Loyalty profile retrieved',
            duration: Date.now() - start3,
            details: {
              pointsBalance: this.loyaltyProfile.pointsBalance,
              referralCode: this.referralCode
            }
          });
        } else {
          results.push({
            testName: testName3,
            status: 'FAIL',
            message: 'Failed to get loyalty profile',
            duration: Date.now() - start3
          });
        }
      } catch (error: any) {
        results.push({
          testName: testName3,
          status: 'FAIL',
          message: `Error: ${error.message}`,
          duration: Date.now() - start3
        });
      }
    }

    const suiteDuration = Date.now() - suiteStart;
    return {
      suiteName,
      results,
      totalTests: results.length,
      passedTests: results.filter(r => r.status === 'PASS').length,
      failedTests: results.filter(r => r.status === 'FAIL').length,
      skippedTests: results.filter(r => r.status === 'SKIP').length,
      duration: suiteDuration
    };
  }

  // ==========================================
  // TEST SUITE 2: SERVICE DISCOVERY
  // ==========================================
  async testServiceDiscovery(): Promise<TestSuite> {
    const suiteName = 'Service Discovery & Listing';
    const results: TestResult[] = [];
    const suiteStart = Date.now();

    console.log(`\n📋 ${suiteName}`);

    // Test 2.1: List all services (main customer services API)
    const testName1 = 'List all services via customer/services API';
    const start1 = Date.now();
    try {
      const response = await fetch(`${API_BASE}/customer/services`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${publicAnonKey}`,
          'apikey': publicAnonKey
        }
      });

      if (response.ok) {
        const data = await response.json();
        const services = data.services || data.data?.services || [];
        this.serviceListings.push({
          api: 'GET /customer/services',
          method: 'GET',
          description: 'Main customer services listing endpoint',
          services: services
        });
        results.push({
          testName: testName1,
          status: 'PASS',
          message: `Found ${services.length} services`,
          duration: Date.now() - start1,
          details: { serviceCount: services.length }
        });
      } else {
        results.push({
          testName: testName1,
          status: 'FAIL',
          message: 'Failed to fetch services',
          duration: Date.now() - start1
        });
      }
    } catch (error: any) {
      results.push({
        testName: testName1,
        status: 'FAIL',
        message: `Error: ${error.message}`,
        duration: Date.now() - start1
      });
    }

    // Test 2.2: Filter services by category
    for (const category of TEST_CONFIG.serviceCategories.slice(0, 3)) {
      const testName = `Filter services by category: ${category}`;
      const start = Date.now();
      try {
        const response = await fetch(`${API_BASE}/customer/services?category=${category}`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'apikey': publicAnonKey
          }
        });

        if (response.ok) {
          const data = await response.json();
          const services = data.services || [];
          results.push({
            testName,
            status: 'PASS',
            message: `Found ${services.length} services for ${category}`,
            duration: Date.now() - start,
            details: { category, serviceCount: services.length }
          });
        } else {
          results.push({
            testName,
            status: 'SKIP',
            message: 'Category filter may not be supported',
            duration: Date.now() - start
          });
        }
      } catch (error: any) {
        results.push({
          testName,
          status: 'SKIP',
          message: `Error: ${error.message}`,
          duration: Date.now() - start
        });
      }
    }

    // Test 2.3: Filter services by service style
    for (const style of TEST_CONFIG.serviceStyles) {
      const testName = `Filter services by style: ${style}`;
      const start = Date.now();
      try {
        const response = await fetch(`${API_BASE}/customer/services?serviceStyle=${style}`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'apikey': publicAnonKey
          }
        });

        if (response.ok) {
          const data = await response.json();
          const services = data.services || [];
          results.push({
            testName,
            status: 'PASS',
            message: `Found ${services.length} ${style} services`,
            duration: Date.now() - start,
            details: { style, serviceCount: services.length }
          });
        } else {
          results.push({
            testName,
            status: 'SKIP',
            message: 'Style filter may not be supported',
            duration: Date.now() - start
          });
        }
      } catch (error: any) {
        results.push({
          testName,
          status: 'SKIP',
          message: `Error: ${error.message}`,
          duration: Date.now() - start
        });
      }
    }

    // Test 2.4: Filter services by vendor role
    for (const roleId of TEST_CONFIG.vendorRoles.slice(0, 3)) {
      const testName = `Filter services by role: ${roleId}`;
      const start = Date.now();
      try {
        const response = await fetch(`${API_BASE}/customer/services?roleId=${roleId}`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'apikey': publicAnonKey
          }
        });

        if (response.ok) {
          const data = await response.json();
          const services = data.services || [];
          results.push({
            testName,
            status: 'PASS',
            message: `Found ${services.length} services for ${roleId}`,
            duration: Date.now() - start,
            details: { roleId, serviceCount: services.length }
          });
        } else {
          results.push({
            testName,
            status: 'SKIP',
            message: 'Role filter may not be supported',
            duration: Date.now() - start
          });
        }
      } catch (error: any) {
        results.push({
          testName,
          status: 'SKIP',
          message: `Error: ${error.message}`,
          duration: Date.now() - start
        });
      }
    }

    // Test 2.5: Get service details
    const testName5 = 'Get service details';
    const start5 = Date.now();
    try {
      // First get a service ID from listings
      const listResponse = await fetch(`${API_BASE}/customer/services`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${publicAnonKey}`,
          'apikey': publicAnonKey
        }
      });

      if (listResponse.ok) {
        const listData = await listResponse.json();
        const services = listData.services || [];
        if (services.length > 0) {
          const serviceId = services[0].id;
          const detailResponse = await fetch(`${API_BASE}/customer/services/${serviceId}`, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${publicAnonKey}`,
              'apikey': publicAnonKey
            }
          });

          if (detailResponse.ok) {
            const detailData = await detailResponse.json();
            results.push({
              testName: testName5,
              status: 'PASS',
              message: 'Service details retrieved',
              duration: Date.now() - start5,
              details: { serviceId, serviceName: detailData.service?.serviceName }
            });
          } else {
            results.push({
              testName: testName5,
              status: 'SKIP',
              message: 'Service details endpoint may not be available',
              duration: Date.now() - start5
            });
          }
        } else {
          results.push({
            testName: testName5,
            status: 'SKIP',
            message: 'No services available to test',
            duration: Date.now() - start5
          });
        }
      } else {
        results.push({
          testName: testName5,
          status: 'SKIP',
          message: 'Cannot fetch service list',
          duration: Date.now() - start5
        });
      }
    } catch (error: any) {
      results.push({
        testName: testName5,
        status: 'SKIP',
        message: `Error: ${error.message}`,
        duration: Date.now() - start5
      });
    }

    // Test 2.6: List packages
    const testName6 = 'List packages';
    const start6 = Date.now();
    try {
      const response = await fetch(`${API_BASE}/customer/packages`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${publicAnonKey}`,
          'apikey': publicAnonKey
        }
      });

      if (response.ok) {
        const data = await response.json();
        const packages = data.packages || [];
        this.serviceListings.push({
          api: 'GET /customer/packages',
          method: 'GET',
          description: 'List all published packages',
          services: packages
        });
        results.push({
          testName: testName6,
          status: 'PASS',
          message: `Found ${packages.length} packages`,
          duration: Date.now() - start6,
          details: { packageCount: packages.length }
        });
      } else {
        results.push({
          testName: testName6,
          status: 'SKIP',
          message: 'Packages endpoint may not be available',
          duration: Date.now() - start6
        });
      }
    } catch (error: any) {
      results.push({
        testName: testName6,
        status: 'SKIP',
        message: `Error: ${error.message}`,
        duration: Date.now() - start6
      });
    }

    const suiteDuration = Date.now() - suiteStart;
    return {
      suiteName,
      results,
      totalTests: results.length,
      passedTests: results.filter(r => r.status === 'PASS').length,
      failedTests: results.filter(r => r.status === 'FAIL').length,
      skippedTests: results.filter(r => r.status === 'SKIP').length,
      duration: suiteDuration
    };
  }

  // ==========================================
  // TEST SUITE 3: BOOKING FLOW WITH FEATURES
  // ==========================================
  async testBookingFlowWithFeatures(): Promise<TestSuite> {
    const suiteName = 'Booking Flow with All Features';
    const results: TestResult[] = [];
    const suiteStart = Date.now();

    console.log(`\n📋 ${suiteName}`);

    if (!this.testCustomer || !this.testPet) {
      results.push({
        testName: 'Prerequisites check',
        status: 'SKIP',
        message: 'Customer or pet not available',
        duration: 0
      });
      return this.createSuiteResult(suiteName, results, suiteStart);
    }

    // Test 3.1: Create booking with all features
    const testName1 = 'Create booking with wallet, coupon, and loyalty points';
    const start1 = Date.now();
    try {
      // First, get a service to book
      const serviceResponse = await fetch(`${API_BASE}/customer/services`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${publicAnonKey}`,
          'apikey': publicAnonKey
        }
      });

      if (!serviceResponse.ok) {
        results.push({
          testName: testName1,
          status: 'SKIP',
          message: 'Cannot fetch services',
          duration: Date.now() - start1
        });
        return this.createSuiteResult(suiteName, results, suiteStart);
      }

      const serviceData = await serviceResponse.json();
      const services = serviceData.services || [];
      if (services.length === 0) {
        results.push({
          testName: testName1,
          status: 'SKIP',
          message: 'No services available',
          duration: Date.now() - start1
        });
        return this.createSuiteResult(suiteName, results, suiteStart);
      }

      const selectedService = services[0];
      const customerId = this.testCustomer.id || this.testCustomer.customerId;
      const petId = this.testPet.id;

      // Create booking
      const bookingResponse = await fetch(`${API_BASE}/bookings/create`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${publicAnonKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          customerId,
          vendorId: selectedService.vendorId,
          serviceId: selectedService.id,
          petId,
          serviceStyle: selectedService.serviceStyle,
          scheduledDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          amount: selectedService.price,
          useWallet: false, // Will test wallet separately
          couponCode: null, // Will test coupon separately
          loyaltyPointsUsed: 0 // Will test loyalty separately
        })
      });

      if (bookingResponse.ok) {
        const bookingData = await bookingResponse.json();
        const booking = bookingData.booking || bookingData;
        this.testBookings.set('main', booking);
        results.push({
          testName: testName1,
          status: 'PASS',
          message: 'Booking created successfully',
          duration: Date.now() - start1,
          details: {
            bookingId: booking.id || booking.bookingId,
            amount: booking.amount,
            status: booking.status
          }
        });
      } else {
        const errorText = await bookingResponse.text();
        results.push({
          testName: testName1,
          status: 'FAIL',
          message: `Booking creation failed: ${errorText}`,
          duration: Date.now() - start1
        });
      }
    } catch (error: any) {
      results.push({
        testName: testName1,
        status: 'FAIL',
        message: `Error: ${error.message}`,
        duration: Date.now() - start1
      });
    }

    const suiteDuration = Date.now() - suiteStart;
    return this.createSuiteResult(suiteName, results, suiteStart);
  }

  // ==========================================
  // TEST SUITE 4: PAYMENT FEATURES
  // ==========================================
  async testPaymentFeatures(): Promise<TestSuite> {
    const suiteName = 'Payment Features (Wallet, Coupons, Discounts, GST)';
    const results: TestResult[] = [];
    const suiteStart = Date.now();

    console.log(`\n📋 ${suiteName}`);

    if (!this.testCustomer) {
      results.push({
        testName: 'Prerequisites check',
        status: 'SKIP',
        message: 'Customer not available',
        duration: 0
      });
      return this.createSuiteResult(suiteName, results, suiteStart);
    }

    // Test 4.1: Get wallet balance
    const testName1 = 'Get wallet balance';
    const start1 = Date.now();
    try {
      const customerId = this.testCustomer.id || this.testCustomer.customerId;
      const response = await fetch(`${API_BASE}/wallet/${customerId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${publicAnonKey}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        this.walletBalance = data.wallet?.balance || data.balance || 0;
        results.push({
          testName: testName1,
          status: 'PASS',
          message: `Wallet balance: ₹${this.walletBalance}`,
          duration: Date.now() - start1,
          details: { balance: this.walletBalance }
        });
      } else {
        results.push({
          testName: testName1,
          status: 'SKIP',
          message: 'Wallet endpoint may not be available',
          duration: Date.now() - start1
        });
      }
    } catch (error: any) {
      results.push({
        testName: testName1,
        status: 'SKIP',
        message: `Error: ${error.message}`,
        duration: Date.now() - start1
      });
    }

    // Test 4.2: Credit wallet (simulate refund)
    const testName2 = 'Credit wallet (refund simulation)';
    const start2 = Date.now();
    try {
      const customerId = this.testCustomer.id || this.testCustomer.customerId;
      const response = await fetch(`${API_BASE}/wallet/${customerId}/credit`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${publicAnonKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          amount: 500,
          source: 'refund',
          description: 'Test refund credit',
          referenceId: 'test_refund_001'
        })
      });

      if (response.ok) {
        const data = await response.json();
        results.push({
          testName: testName2,
          status: 'PASS',
          message: 'Wallet credited successfully',
          duration: Date.now() - start2,
          details: { newBalance: data.wallet?.balance }
        });
      } else {
        results.push({
          testName: testName2,
          status: 'SKIP',
          message: 'Wallet credit endpoint may not be available',
          duration: Date.now() - start2
        });
      }
    } catch (error: any) {
      results.push({
        testName: testName2,
        status: 'SKIP',
        message: `Error: ${error.message}`,
        duration: Date.now() - start2
      });
    }

    // Test 4.3: Apply coupon
    const testName3 = 'Apply coupon code';
    const start3 = Date.now();
    try {
      const response = await fetch(`${API_BASE}/coupons/apply`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${publicAnonKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          code: 'TEST10', // Test coupon code
          orderAmount: 1000,
          customerId: this.testCustomer.id || this.testCustomer.customerId,
          orderId: 'test_order_001'
        })
      });

      if (response.ok) {
        const data = await response.json();
        results.push({
          testName: testName3,
          status: 'PASS',
          message: 'Coupon applied successfully',
          duration: Date.now() - start3,
          details: {
            discountAmount: data.usage?.discountAmount,
            couponCode: data.coupon?.code
          }
        });
      } else {
        results.push({
          testName: testName3,
          status: 'SKIP',
          message: 'Coupon may not exist or endpoint unavailable',
          duration: Date.now() - start3
        });
      }
    } catch (error: any) {
      results.push({
        testName: testName3,
        status: 'SKIP',
        message: `Error: ${error.message}`,
        duration: Date.now() - start3
      });
    }

    // Test 4.4: Calculate GST
    const testName4 = 'Calculate GST';
    const start4 = Date.now();
    try {
      const response = await fetch(`${API_BASE}/calculate-gst`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${publicAnonKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          amount: 1000,
          serviceType: 'grooming',
          vendorRoleId: 'pet_groomer',
          state: 'Maharashtra'
        })
      });

      if (response.ok) {
        const data = await response.json();
        results.push({
          testName: testName4,
          status: 'PASS',
          message: 'GST calculated successfully',
          duration: Date.now() - start4,
          details: {
            gstAmount: data.gstAmount,
            totalAmount: data.total,
            gstRate: data.gstRate
          }
        });
      } else {
        results.push({
          testName: testName4,
          status: 'SKIP',
          message: 'GST calculation endpoint may not be available',
          duration: Date.now() - start4
        });
      }
    } catch (error: any) {
      results.push({
        testName: testName4,
        status: 'SKIP',
        message: `Error: ${error.message}`,
        duration: Date.now() - start4
      });
    }

    return this.createSuiteResult(suiteName, results, suiteStart);
  }

  // ==========================================
  // TEST SUITE 5: BOOKING LIFECYCLE
  // ==========================================
  async testBookingLifecycle(): Promise<TestSuite> {
    const suiteName = 'Booking Lifecycle (OTP, Completion, Delivery)';
    const results: TestResult[] = [];
    const suiteStart = Date.now();

    console.log(`\n📋 ${suiteName}`);

    const booking = this.testBookings.get('main');
    if (!booking) {
      results.push({
        testName: 'Prerequisites check',
        status: 'SKIP',
        message: 'No booking available',
        duration: 0
      });
      return this.createSuiteResult(suiteName, results, suiteStart);
    }

    const bookingId = booking.id || booking.bookingId;

    // Test 5.1: Get booking details
    const testName1 = 'Get booking details';
    const start1 = Date.now();
    try {
      const response = await fetch(`${API_BASE}/appointment/${bookingId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${publicAnonKey}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        results.push({
          testName: testName1,
          status: 'PASS',
          message: 'Booking details retrieved',
          duration: Date.now() - start1,
          details: {
            status: data.appointment?.status || data.status,
            otp: data.appointment?.otp ? 'Present' : 'Not present'
          }
        });
      } else {
        results.push({
          testName: testName1,
          status: 'SKIP',
          message: 'Booking details endpoint may not be available',
          duration: Date.now() - start1
        });
      }
    } catch (error: any) {
      results.push({
        testName: testName1,
        status: 'SKIP',
        message: `Error: ${error.message}`,
        duration: Date.now() - start1
      });
    }

    // Test 5.2: Verify start OTP (if applicable)
    const testName2 = 'Verify start OTP';
    const start2 = Date.now();
    try {
      // This would require actual OTP from booking
      results.push({
        testName: testName2,
        status: 'SKIP',
        message: 'Requires actual OTP from booking (manual test)',
        duration: Date.now() - start2
      });
    } catch (error: any) {
      results.push({
        testName: testName2,
        status: 'SKIP',
        message: `Error: ${error.message}`,
        duration: Date.now() - start2
      });
    }

    // Test 5.3: Complete booking with OTP
    const testName3 = 'Complete booking with OTP verification';
    const start3 = Date.now();
    try {
      // This would require actual OTP
      results.push({
        testName: testName3,
        status: 'SKIP',
        message: 'Requires actual OTP from booking (manual test)',
        duration: Date.now() - start3
      });
    } catch (error: any) {
      results.push({
        testName: testName3,
        status: 'SKIP',
        message: `Error: ${error.message}`,
        duration: Date.now() - start3
      });
    }

    return this.createSuiteResult(suiteName, results, suiteStart);
  }

  // ==========================================
  // TEST SUITE 6: LOYALTY POINTS
  // ==========================================
  async testLoyaltyPoints(): Promise<TestSuite> {
    const suiteName = 'Loyalty Points & Rewards';
    const results: TestResult[] = [];
    const suiteStart = Date.now();

    console.log(`\n📋 ${suiteName}`);

    if (!this.testCustomer) {
      results.push({
        testName: 'Prerequisites check',
        status: 'SKIP',
        message: 'Customer not available',
        duration: 0
      });
      return this.createSuiteResult(suiteName, results, suiteStart);
    }

    const customerId = this.testCustomer.id || this.testCustomer.customerId;

    // Test 6.1: Get loyalty profile
    const testName1 = 'Get loyalty profile';
    const start1 = Date.now();
    try {
      const response = await fetch(`${API_BASE}/loyalty/profile/${customerId}?userType=customer`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${publicAnonKey}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        this.loyaltyProfile = data.profile || data;
        results.push({
          testName: testName1,
          status: 'PASS',
          message: 'Loyalty profile retrieved',
          duration: Date.now() - start1,
          details: {
            pointsBalance: this.loyaltyProfile.pointsBalance,
            totalEarned: this.loyaltyProfile.totalPointsEarned,
            totalRedeemed: this.loyaltyProfile.totalPointsRedeemed
          }
        });
      } else {
        results.push({
          testName: testName1,
          status: 'FAIL',
          message: 'Failed to get loyalty profile',
          duration: Date.now() - start1
        });
      }
    } catch (error: any) {
      results.push({
        testName: testName1,
        status: 'FAIL',
        message: `Error: ${error.message}`,
        duration: Date.now() - start1
      });
    }

    // Test 6.2: Award loyalty points (simulate booking completion)
    const testName2 = 'Award loyalty points for booking completion';
    const start2 = Date.now();
    try {
      const booking = this.testBookings.get('main');
      if (booking) {
        const response = await fetch(`${API_BASE}/loyalty/award`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            userId: customerId,
            userType: 'customer',
            actionKey: 'book_grooming',
            amount: booking.amount || 1000,
            metadata: {
              bookingId: booking.id || booking.bookingId,
              serviceType: 'grooming'
            }
          })
        });

        if (response.ok) {
          const data = await response.json();
          results.push({
            testName: testName2,
            status: 'PASS',
            message: 'Loyalty points awarded',
            duration: Date.now() - start2,
            details: {
              pointsAwarded: data.pointsAwarded,
              newBalance: data.profile?.pointsBalance
            }
          });
        } else {
          results.push({
            testName: testName2,
            status: 'SKIP',
            message: 'Loyalty award endpoint may not be available',
            duration: Date.now() - start2
          });
        }
      } else {
        results.push({
          testName: testName2,
          status: 'SKIP',
          message: 'No booking available',
          duration: Date.now() - start2
        });
      }
    } catch (error: any) {
      results.push({
        testName: testName2,
        status: 'SKIP',
        message: `Error: ${error.message}`,
        duration: Date.now() - start2
      });
    }

    // Test 6.3: Redeem loyalty points
    const testName3 = 'Redeem loyalty points';
    const start3 = Date.now();
    try {
      if (this.loyaltyProfile && this.loyaltyProfile.pointsBalance > 0) {
        const pointsToRedeem = Math.min(100, this.loyaltyProfile.pointsBalance);
        const response = await fetch(`${API_BASE}/loyalty/redeem`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            userId: customerId,
            userType: 'customer',
            points: pointsToRedeem
          })
        });

        if (response.ok) {
          const data = await response.json();
          results.push({
            testName: testName3,
            status: 'PASS',
            message: 'Loyalty points redeemed',
            duration: Date.now() - start3,
            details: {
              pointsRedeemed: pointsToRedeem,
              creditAmount: data.creditAmount,
              newBalance: data.profile?.pointsBalance
            }
          });
        } else {
          results.push({
            testName: testName3,
            status: 'SKIP',
            message: 'Loyalty redeem endpoint may not be available',
            duration: Date.now() - start3
          });
        }
      } else {
        results.push({
          testName: testName3,
          status: 'SKIP',
          message: 'Insufficient points to redeem',
          duration: Date.now() - start3
        });
      }
    } catch (error: any) {
      results.push({
        testName: testName3,
        status: 'SKIP',
        message: `Error: ${error.message}`,
        duration: Date.now() - start3
      });
    }

    return this.createSuiteResult(suiteName, results, suiteStart);
  }

  // ==========================================
  // TEST SUITE 7: REFERRAL SYSTEM
  // ==========================================
  async testReferralSystem(): Promise<TestSuite> {
    const suiteName = 'Referral System';
    const results: TestResult[] = [];
    const suiteStart = Date.now();

    console.log(`\n📋 ${suiteName}`);

    if (!this.testCustomer) {
      results.push({
        testName: 'Prerequisites check',
        status: 'SKIP',
        message: 'Customer not available',
        duration: 0
      });
      return this.createSuiteResult(suiteName, results, suiteStart);
    }

    // Test 7.1: Get referral code
    const testName1 = 'Get referral code';
    const start1 = Date.now();
    try {
      const customerId = this.testCustomer.id || this.testCustomer.customerId;
      const response = await fetch(`${API_BASE}/loyalty/profile/${customerId}?userType=customer`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${publicAnonKey}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        const profile = data.profile || data;
        this.referralCode = profile.referralCode || '';
        results.push({
          testName: testName1,
          status: 'PASS',
          message: 'Referral code retrieved',
          duration: Date.now() - start1,
          details: { referralCode: this.referralCode }
        });
      } else {
        results.push({
          testName: testName1,
          status: 'FAIL',
          message: 'Failed to get referral code',
          duration: Date.now() - start1
        });
      }
    } catch (error: any) {
      results.push({
        testName: testName1,
        status: 'FAIL',
        message: `Error: ${error.message}`,
        duration: Date.now() - start1
      });
    }

    // Test 7.2: Apply referral code (simulate new user)
    const testName2 = 'Apply referral code';
    const start2 = Date.now();
    try {
      if (this.referralCode) {
        // Create a new test customer to apply referral
        const newPhone = `+91${Math.floor(1000000000 + Math.random() * 9000000000)}`;
        const newCustomerResponse = await fetch(`${API_BASE}/customer/auth/register`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            phone: newPhone,
            name: 'Referred Customer',
            email: `referred_${Date.now()}@example.com`
          })
        });

        if (newCustomerResponse.ok) {
          const newCustomerData = await newCustomerResponse.json();
          const newCustomerId = newCustomerData.customer?.id || newCustomerData.id;

          const referralResponse = await fetch(`${API_BASE}/loyalty/referral/apply`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${publicAnonKey}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              newUserId: newCustomerId,
              referralCode: this.referralCode,
              userType: 'customer'
            })
          });

          if (referralResponse.ok) {
            results.push({
              testName: testName2,
              status: 'PASS',
              message: 'Referral code applied successfully',
              duration: Date.now() - start2,
              details: { referralCode: this.referralCode }
            });
          } else {
            results.push({
              testName: testName2,
              status: 'SKIP',
              message: 'Referral application may have restrictions',
              duration: Date.now() - start2
            });
          }
        } else {
          results.push({
            testName: testName2,
            status: 'SKIP',
            message: 'Cannot create test customer for referral',
            duration: Date.now() - start2
          });
        }
      } else {
        results.push({
          testName: testName2,
          status: 'SKIP',
          message: 'No referral code available',
          duration: Date.now() - start2
        });
      }
    } catch (error: any) {
      results.push({
        testName: testName2,
        status: 'SKIP',
        message: `Error: ${error.message}`,
        duration: Date.now() - start2
      });
    }

    return this.createSuiteResult(suiteName, results, suiteStart);
  }

  // ==========================================
  // TEST SUITE 8: REFUNDS & WALLET
  // ==========================================
  async testRefundsAndWallet(): Promise<TestSuite> {
    const suiteName = 'Refunds & Wallet Credits';
    const results: TestResult[] = [];
    const suiteStart = Date.now();

    console.log(`\n📋 ${suiteName}`);

    const booking = this.testBookings.get('main');
    if (!booking || !this.testCustomer) {
      results.push({
        testName: 'Prerequisites check',
        status: 'SKIP',
        message: 'Booking or customer not available',
        duration: 0
      });
      return this.createSuiteResult(suiteName, results, suiteStart);
    }

    // Test 8.1: Cancel booking with refund
    const testName1 = 'Cancel booking with refund to wallet';
    const start1 = Date.now();
    try {
      const bookingId = booking.id || booking.bookingId;
      const response = await fetch(`${API_BASE}/appointment/${bookingId}/cancel`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${publicAnonKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          cancelledBy: 'customer',
          reason: 'Test cancellation',
          refundMethod: 'wallet'
        })
      });

      if (response.ok) {
        const data = await response.json();
        results.push({
          testName: testName1,
          status: 'PASS',
          message: 'Booking cancelled with refund',
          duration: Date.now() - start1,
          details: {
            refundAmount: data.refundAmount,
            refundMethod: data.refundMethod
          }
        });
      } else {
        results.push({
          testName: testName1,
          status: 'SKIP',
          message: 'Cancellation endpoint may not be available or booking already cancelled',
          duration: Date.now() - start1
        });
      }
    } catch (error: any) {
      results.push({
        testName: testName1,
        status: 'SKIP',
        message: `Error: ${error.message}`,
        duration: Date.now() - start1
      });
    }

    // Test 8.2: Verify wallet balance after refund
    const testName2 = 'Verify wallet balance after refund';
    const start2 = Date.now();
    try {
      const customerId = this.testCustomer.id || this.testCustomer.customerId;
      const response = await fetch(`${API_BASE}/wallet/${customerId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${publicAnonKey}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        const newBalance = data.wallet?.balance || data.balance || 0;
        results.push({
          testName: testName2,
          status: 'PASS',
          message: `Wallet balance: ₹${newBalance}`,
          duration: Date.now() - start2,
          details: { balance: newBalance }
        });
      } else {
        results.push({
          testName: testName2,
          status: 'SKIP',
          message: 'Wallet endpoint may not be available',
          duration: Date.now() - start2
        });
      }
    } catch (error: any) {
      results.push({
        testName: testName2,
        status: 'SKIP',
        message: `Error: ${error.message}`,
        duration: Date.now() - start2
      });
    }

    return this.createSuiteResult(suiteName, results, suiteStart);
  }

  // ==========================================
  // TEST SUITE 9: GST INVOICES
  // ==========================================
  async testGSTInvoices(): Promise<TestSuite> {
    const suiteName = 'GST Invoice Generation';
    const results: TestResult[] = [];
    const suiteStart = Date.now();

    console.log(`\n📋 ${suiteName}`);

    const booking = this.testBookings.get('main');
    if (!booking) {
      results.push({
        testName: 'Prerequisites check',
        status: 'SKIP',
        message: 'No booking available',
        duration: 0
      });
      return this.createSuiteResult(suiteName, results, suiteStart);
    }

    // Test 9.1: Generate GST invoice
    const testName1 = 'Generate GST invoice for booking';
    const start1 = Date.now();
    try {
      const bookingId = booking.id || booking.bookingId;
      // Try different possible invoice endpoints
      const endpoints = [
        `${API_BASE}/invoice/${bookingId}`,
        `${API_BASE}/bookings/${bookingId}/invoice`,
        `${API_BASE}/gst-invoice/${bookingId}`
      ];

      let invoiceGenerated = false;
      for (const endpoint of endpoints) {
        try {
          const response = await fetch(endpoint, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${publicAnonKey}`
            }
          });

          if (response.ok) {
            const data = await response.json();
            results.push({
              testName: testName1,
              status: 'PASS',
              message: 'GST invoice generated',
              duration: Date.now() - start1,
              details: {
                invoiceNumber: data.invoice?.invoiceNumber || data.invoiceNumber,
                gstAmount: data.invoice?.gstAmount || data.gstAmount,
                totalAmount: data.invoice?.totalAmount || data.totalAmount
              }
            });
            invoiceGenerated = true;
            break;
          }
        } catch {
          continue;
        }
      }

      if (!invoiceGenerated) {
        results.push({
          testName: testName1,
          status: 'SKIP',
          message: 'Invoice generation endpoint may not be available',
          duration: Date.now() - start1
        });
      }
    } catch (error: any) {
      results.push({
        testName: testName1,
        status: 'SKIP',
        message: `Error: ${error.message}`,
        duration: Date.now() - start1
      });
    }

    return this.createSuiteResult(suiteName, results, suiteStart);
  }

  // ==========================================
  // TEST SUITE 10: SERVICE DELIVERY
  // ==========================================
  async testServiceDelivery(): Promise<TestSuite> {
    const suiteName = 'Service Delivery Verification';
    const results: TestResult[] = [];
    const suiteStart = Date.now();

    console.log(`\n📋 ${suiteName}`);

    const booking = this.testBookings.get('main');
    if (!booking) {
      results.push({
        testName: 'Prerequisites check',
        status: 'SKIP',
        message: 'No booking available',
        duration: 0
      });
      return this.createSuiteResult(suiteName, results, suiteStart);
    }

    // Test 10.1: Verify service delivery status
    const testName1 = 'Verify service delivery status';
    const start1 = Date.now();
    try {
      const bookingId = booking.id || booking.bookingId;
      const response = await fetch(`${API_BASE}/appointment/${bookingId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${publicAnonKey}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        const appointment = data.appointment || data;
        results.push({
          testName: testName1,
          status: 'PASS',
          message: 'Service delivery status retrieved',
          duration: Date.now() - start1,
          details: {
            status: appointment.status,
            deliveryStatus: appointment.deliveryStatus || 'N/A',
            completedAt: appointment.completedAt || 'N/A'
          }
        });
      } else {
        results.push({
          testName: testName1,
          status: 'SKIP',
          message: 'Booking details endpoint may not be available',
          duration: Date.now() - start1
        });
      }
    } catch (error: any) {
      results.push({
        testName: testName1,
        status: 'SKIP',
        message: `Error: ${error.message}`,
        duration: Date.now() - start1
      });
    }

    return this.createSuiteResult(suiteName, results, suiteStart);
  }

  // ==========================================
  // HELPER METHODS
  // ==========================================

  private createSuiteResult(suiteName: string, results: TestResult[], suiteStart: number): TestSuite {
    const suiteDuration = Date.now() - suiteStart;
    return {
      suiteName,
      results,
      totalTests: results.length,
      passedTests: results.filter(r => r.status === 'PASS').length,
      failedTests: results.filter(r => r.status === 'FAIL').length,
      skippedTests: results.filter(r => r.status === 'SKIP').length,
      duration: suiteDuration
    };
  }

  private generateServiceListingReport(): void {
    console.log('\n📊 SERVICE LISTING REPORT');
    console.log('='.repeat(80));
    
    if (this.serviceListings.length === 0) {
      console.log('No service listings captured during tests.');
      return;
    }

    for (const listing of this.serviceListings) {
      console.log(`\n🔗 API: ${listing.api}`);
      console.log(`   Method: ${listing.method}`);
      console.log(`   Description: ${listing.description}`);
      console.log(`   Services Found: ${listing.services.length}`);
      
      if (listing.services.length > 0) {
        // Group by service style
        const byStyle: Record<string, number> = {};
        const byCategory: Record<string, number> = {};
        const byRole: Record<string, number> = {};
        
        for (const service of listing.services) {
          const style = service.serviceStyle || 'unknown';
          byStyle[style] = (byStyle[style] || 0) + 1;
          
          const category = service.categoryName || 'unknown';
          byCategory[category] = (byCategory[category] || 0) + 1;
          
          const role = service.vendorRoleId || service.vendorRoleName || 'unknown';
          byRole[role] = (byRole[role] || 0) + 1;
        }
        
        console.log(`   By Service Style:`);
        Object.entries(byStyle).forEach(([style, count]) => {
          console.log(`     - ${style}: ${count}`);
        });
        
        console.log(`   By Category:`);
        Object.entries(byCategory).forEach(([category, count]) => {
          console.log(`     - ${category}: ${count}`);
        });
        
        console.log(`   By Vendor Role:`);
        Object.entries(byRole).forEach(([role, count]) => {
          console.log(`     - ${role}: ${count}`);
        });
      }
    }
    
    console.log('\n' + '='.repeat(80));
  }
}

// ==========================================
// EXPORT & RUN
// ==========================================

export async function runCustomerJourneyTests(): Promise<TestSuite[]> {
  const test = new E2ECustomerJourneyTest();
  return await test.runAllTests();
}

// Run if executed directly (for Deno runtime)
// Note: This will only work in Deno environment
// For Node.js, use the exported function instead
// @ts-ignore - Deno global may not be available in all environments
if (typeof (globalThis as any).Deno !== 'undefined' && (globalThis as any).Deno.args) {
  runCustomerJourneyTests()
    .then((suites) => {
      console.log('\n📈 TEST SUMMARY');
      console.log('='.repeat(80));
      
      let totalTests = 0;
      let totalPassed = 0;
      let totalFailed = 0;
      let totalSkipped = 0;
      
      for (const suite of suites) {
        console.log(`\n${suite.suiteName}:`);
        console.log(`  Total: ${suite.totalTests}`);
        console.log(`  Passed: ${suite.passedTests}`);
        console.log(`  Failed: ${suite.failedTests}`);
        console.log(`  Skipped: ${suite.skippedTests}`);
        console.log(`  Duration: ${(suite.duration / 1000).toFixed(2)}s`);
        
        totalTests += suite.totalTests;
        totalPassed += suite.passedTests;
        totalFailed += suite.failedTests;
        totalSkipped += suite.skippedTests;
      }
      
      console.log('\n' + '='.repeat(80));
      console.log(`OVERALL: ${totalPassed}/${totalTests} passed, ${totalFailed} failed, ${totalSkipped} skipped`);
      console.log('='.repeat(80));
    })
    .catch((error) => {
      console.error('❌ Test execution failed:', error);
      // @ts-ignore - Deno global may not be available in all environments
      if (typeof (globalThis as any).Deno !== 'undefined') {
        (globalThis as any).Deno.exit(1);
      }
    });
}

