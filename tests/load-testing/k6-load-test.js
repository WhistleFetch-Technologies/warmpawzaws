/**
 * ============================================================================
 * WARMPAWZ PLATFORM - K6 LOAD TESTING SCRIPT
 * ============================================================================
 * 
 * Installation:
 *   brew install k6  (macOS)
 *   sudo apt install k6  (Linux)
 *   choco install k6  (Windows)
 * 
 * Usage:
 *   k6 run k6-load-test.js
 *   k6 run --vus 100 --duration 5m k6-load-test.js
 *   k6 run --out json=results.json k6-load-test.js
 * 
 * Dashboard (real-time):
 *   k6 run --out influxdb=http://localhost:8086/k6 k6-load-test.js
 * ============================================================================
 */

import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

// ============================================================================
// CONFIGURATION
// ============================================================================

const API_BASE_URL = __ENV.API_BASE_URL || 'https://api.warmpawz.com';

// Custom metrics
const errorRate = new Rate('errors');
const searchDuration = new Trend('search_duration');
const bookingDuration = new Trend('booking_duration');
const apiCalls = new Counter('api_calls');

// ============================================================================
// TEST OPTIONS
// ============================================================================

export const options = {
  stages: [
    { duration: '2m', target: 10 },   // Warm-up: 10 users
    { duration: '3m', target: 50 },   // Ramp up: 50 users
    { duration: '5m', target: 50 },   // Sustained: 50 users
    { duration: '2m', target: 100 },  // Peak: 100 users
    { duration: '1m', target: 200 },  // Spike: 200 users
    { duration: '1m', target: 0 },    // Cool down
  ],
  
  thresholds: {
    // HTTP errors should be less than 1%
    'errors': ['rate<0.01'],
    
    // 95% of requests should be below 500ms
    'http_req_duration': ['p(95)<500'],
    
    // 99% of requests should be below 1000ms
    'http_req_duration': ['p(99)<1000'],
    
    // Average should be below 200ms
    'http_req_duration': ['avg<200'],
    
    // Search should be fast
    'search_duration': ['p(95)<300'],
    
    // Booking creation should be reasonable
    'booking_duration': ['p(95)<800'],
  },
};

// ============================================================================
// TEST DATA
// ============================================================================

const CATEGORIES = ['vet', 'grooming', 'training', 'walker', 'boarding'];
const CITIES = ['Mumbai', 'Delhi', 'Bangalore', 'Hyderabad', 'Chennai'];
const SEARCH_QUERIES = ['vet', 'grooming', 'training', 'vaccination', 'checkup'];

function randomElement(array) {
  return array[Math.floor(Math.random() * array.length)];
}

function randomNumber(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomDate() {
  const today = new Date();
  const daysAhead = randomNumber(1, 7);
  const date = new Date(today.getTime() + daysAhead * 24 * 60 * 60 * 1000);
  return date.toISOString().split('T')[0];
}

// ============================================================================
// TEST SCENARIOS
// ============================================================================

export default function () {
  const scenario = randomNumber(1, 5);
  
  switch (scenario) {
    case 1:
      customerDiscoveryFlow();
      break;
    case 2:
      vendorDashboardFlow();
      break;
    case 3:
      locationBasedDiscovery();
      break;
    case 4:
      paymentFlow();
      break;
    case 5:
      adminOperations();
      break;
  }
  
  sleep(randomNumber(1, 3));
}

/**
 * Customer Discovery Flow (40% of traffic)
 */
function customerDiscoveryFlow() {
  group('Customer Discovery Flow', function () {
    const category = randomElement(CATEGORIES);
    const query = randomElement(SEARCH_QUERIES);
    
    // 1. Search for services
    const searchStart = Date.now();
    const searchRes = http.get(
      `${API_BASE_URL}/search?q=${query}&category=${category}&limit=20`
    );
    searchDuration.add(Date.now() - searchStart);
    apiCalls.add(1);
    
    const searchSuccess = check(searchRes, {
      'search status is 200': (r) => r.status === 200,
      'search has results': (r) => JSON.parse(r.body).total > 0,
    });
    errorRate.add(!searchSuccess);
    
    if (!searchSuccess) return;
    
    const searchData = JSON.parse(searchRes.body);
    const vendorId = searchData.vendors[0]?.id;
    
    if (!vendorId) return;
    
    // 2. Get vendor profile
    const profileRes = http.get(`${API_BASE_URL}/vendor/${vendorId}/profile`);
    apiCalls.add(1);
    check(profileRes, {
      'profile status is 200': (r) => r.status === 200,
    });
    
    // 3. Get vendor services
    const servicesRes = http.get(`${API_BASE_URL}/vendor/${vendorId}/services`);
    apiCalls.add(1);
    check(servicesRes, {
      'services status is 200': (r) => r.status === 200,
    });
    
    const servicesData = JSON.parse(servicesRes.body);
    const serviceId = servicesData.services[0]?.id;
    
    if (!serviceId) return;
    
    // 4. Get available slots
    const slotsRes = http.get(
      `${API_BASE_URL}/bookings/available-slots?vendor_id=${vendorId}&service_id=${serviceId}&date=${randomDate()}`
    );
    apiCalls.add(1);
    check(slotsRes, {
      'slots status is 200': (r) => r.status === 200,
    });
    
    // 5. Create booking
    const bookingStart = Date.now();
    const bookingRes = http.post(
      `${API_BASE_URL}/bookings/create`,
      JSON.stringify({
        customerId: `cust-${randomNumber(1000, 9999)}`,
        vendorId: vendorId,
        serviceId: serviceId,
        bookingDate: randomDate(),
        bookingTime: '10:00',
        serviceType: 'at_vendor',
        amount: 500,
      }),
      { headers: { 'Content-Type': 'application/json' } }
    );
    bookingDuration.add(Date.now() - bookingStart);
    apiCalls.add(1);
    
    const bookingSuccess = check(bookingRes, {
      'booking status is 200': (r) => r.status === 200,
      'booking has ID': (r) => JSON.parse(r.body).bookingId !== undefined,
    });
    errorRate.add(!bookingSuccess);
  });
}

/**
 * Vendor Dashboard Flow (30% of traffic)
 */
function vendorDashboardFlow() {
  group('Vendor Dashboard Flow', function () {
    const vendorId = `vendor-${randomNumber(1, 100).toString().padStart(3, '0')}`;
    
    // 1. Get dashboard
    const dashboardRes = http.get(`${API_BASE_URL}/vendor/${vendorId}/dashboard`);
    apiCalls.add(1);
    check(dashboardRes, {
      'dashboard status is 200': (r) => r.status === 200,
    });
    
    // 2. Get today's bookings
    const bookingsRes = http.get(`${API_BASE_URL}/vendor/${vendorId}/bookings/today`);
    apiCalls.add(1);
    check(bookingsRes, {
      'bookings status is 200': (r) => r.status === 200,
    });
    
    // 3. Get services
    const servicesRes = http.get(`${API_BASE_URL}/vendor/${vendorId}/services`);
    apiCalls.add(1);
    check(servicesRes, {
      'services status is 200': (r) => r.status === 200,
    });
    
    // 4. Get staff
    const staffRes = http.get(`${API_BASE_URL}/vendor/${vendorId}/staff`);
    apiCalls.add(1);
    check(staffRes, {
      'staff status is 200': (r) => r.status === 200,
    });
    
    // 5. Get earnings
    const earningsRes = http.get(`${API_BASE_URL}/vendor/${vendorId}/earnings`);
    apiCalls.add(1);
    check(earningsRes, {
      'earnings status is 200': (r) => r.status === 200,
    });
  });
}

/**
 * Location-Based Discovery (20% of traffic)
 */
function locationBasedDiscovery() {
  group('Location-Based Discovery', function () {
    const category = randomElement(CATEGORIES);
    const city = randomElement(CITIES);
    
    // 1. Get service categories
    const categoriesRes = http.get(`${API_BASE_URL}/service-discovery/categories`);
    apiCalls.add(1);
    check(categoriesRes, {
      'categories status is 200': (r) => r.status === 200,
    });
    
    // 2. Get vendors near location
    const vendorsRes = http.get(
      `${API_BASE_URL}/service-discovery/vendors?category=${category}&lat=19.0760&lng=72.8777&city=${city}`
    );
    apiCalls.add(1);
    check(vendorsRes, {
      'vendors status is 200': (r) => r.status === 200,
    });
    
    // 3. Get problem grid
    const problemsRes = http.get(`${API_BASE_URL}/service-discovery/problems`);
    apiCalls.add(1);
    check(problemsRes, {
      'problems status is 200': (r) => r.status === 200,
    });
  });
}

/**
 * Payment Flow (5% of traffic)
 */
function paymentFlow() {
  group('Payment Flow', function () {
    // 1. Create payment order
    const orderRes = http.post(
      `${API_BASE_URL}/payments/create-order`,
      JSON.stringify({
        booking_id: `booking-${randomNumber(1000, 9999)}`,
        amount: 1000,
      }),
      { headers: { 'Content-Type': 'application/json' } }
    );
    apiCalls.add(1);
    check(orderRes, {
      'order status is 200': (r) => r.status === 200,
    });
    
    // 2. Verify payment (simulated)
    const verifyRes = http.post(
      `${API_BASE_URL}/payments/verify`,
      JSON.stringify({
        razorpay_order_id: `order_${randomNumber(10000, 99999)}`,
        razorpay_payment_id: `pay_${randomNumber(10000, 99999)}`,
        razorpay_signature: 'test_signature',
        booking_id: `booking-${randomNumber(1000, 9999)}`,
      }),
      { headers: { 'Content-Type': 'application/json' } }
    );
    apiCalls.add(1);
  });
}

/**
 * Admin Operations (5% of traffic)
 */
function adminOperations() {
  group('Admin Operations', function () {
    // 1. Get pending vendors
    const vendorsRes = http.get(`${API_BASE_URL}/admin/vendors?status=pending`);
    apiCalls.add(1);
    check(vendorsRes, {
      'admin vendors status is 200': (r) => r.status === 200,
    });
    
    // 2. Get platform stats
    const statsRes = http.get(`${API_BASE_URL}/admin/dashboard/stats`);
    apiCalls.add(1);
    
    // 3. Get roles
    const rolesRes = http.get(`${API_BASE_URL}/config/roles`);
    apiCalls.add(1);
    check(rolesRes, {
      'roles status is 200': (r) => r.status === 200,
    });
  });
}

// ============================================================================
// SETUP & TEARDOWN
// ============================================================================

export function setup() {
  console.log('🚀 Starting load test...');
  console.log(`📊 Target: ${API_BASE_URL}`);
  console.log(`⏱️  Test duration: ~14 minutes`);
  console.log(`👥 Max virtual users: 200`);
  return { startTime: Date.now() };
}

export function teardown(data) {
  const duration = (Date.now() - data.startTime) / 1000;
  console.log(`✅ Test completed in ${duration.toFixed(2)} seconds`);
}

// ============================================================================
// EXPECTED RESULTS
// ============================================================================
// - HTTP success rate: > 99%
// - P95 latency: < 500ms
// - P99 latency: < 1000ms
// - Throughput: > 100 requests/second
// - No server errors (5xx responses)
// ============================================================================

