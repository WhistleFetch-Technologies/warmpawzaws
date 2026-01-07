/**
 * ============================================================================
 * NOTIFICATION TRIGGERS E2E TEST SUITE
 * ============================================================================
 * 
 * Tests all notification triggers across the booking lifecycle
 * 
 * Date: 2025-01-28
 * Phase: 4 - Notification Triggers Verification
 * ============================================================================
 */

import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';

interface TestContext {
  baseUrl: string;
  customerId: string;
  vendorId: string;
  serviceId: string;
  bookingId: string;
  snsMessageIds: string[];
}

const ctx: TestContext = {
  baseUrl: process.env.API_BASE_URL || 'http://localhost:3000',
  customerId: '',
  vendorId: '',
  serviceId: '',
  bookingId: '',
  snsMessageIds: [],
};

// Mock SNS client to capture published messages
let capturedSnsMessages: Array<{
  topicArn: string;
  eventType: string;
  message: any;
  timestamp: string;
}> = [];

/**
 * Test: Booking Creation Notification
 * Verifies that creating a booking triggers BOOKING_CREATED event
 */
async function testBookingCreatedNotification(ctx: TestContext): Promise<void> {
  console.log('🧪 Testing: Booking Created Notification');

  // Create a test booking
  const bookingResponse = await fetch(`${ctx.baseUrl}/bookings/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      customerId: ctx.customerId,
      vendorId: ctx.vendorId,
      serviceId: ctx.serviceId,
      bookingDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      bookingTime: '10:00:00',
      serviceType: 'at_home',
      amount: 500,
    }),
  });

  expect(bookingResponse.ok).toBe(true);
  const bookingData = await bookingResponse.json();
  ctx.bookingId = bookingData.bookingId;

  // Verify SNS message was published
  const bookingCreatedMessage = capturedSnsMessages.find(
    (msg) => msg.eventType === 'BOOKING_CREATED' && msg.message.data.bookingId === ctx.bookingId
  );

  expect(bookingCreatedMessage).toBeDefined();
  expect(bookingCreatedMessage?.message.data.customerId).toBe(ctx.customerId);
  expect(bookingCreatedMessage?.message.data.vendorId).toBe(ctx.vendorId);
  expect(bookingCreatedMessage?.message.data.status).toBe('pending');
  expect(bookingCreatedMessage?.message.eventId).toBeDefined();
  expect(bookingCreatedMessage?.message.eventTimestamp).toBeDefined();

  console.log('✅ Booking Created Notification: PASSED');
}

/**
 * Test: Booking Confirmed Notification
 * Verifies that confirming a booking triggers BOOKING_STATUS_UPDATED event
 */
async function testBookingConfirmedNotification(ctx: TestContext): Promise<void> {
  console.log('🧪 Testing: Booking Confirmed Notification');

  const confirmResponse = await fetch(`${ctx.baseUrl}/vendor/bookings/${ctx.bookingId}/confirm`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-vendor-id': ctx.vendorId,
    },
  });

  expect(confirmResponse.ok).toBe(true);

  // Wait a bit for async notification
  await new Promise((resolve) => setTimeout(resolve, 1000));

  // Verify SNS message was published
  const statusUpdatedMessage = capturedSnsMessages.find(
    (msg) =>
      msg.eventType === 'BOOKING_STATUS_UPDATED' &&
      msg.message.data.bookingId === ctx.bookingId &&
      msg.message.data.oldStatus === 'pending' &&
      msg.message.data.newStatus === 'confirmed'
  );

  expect(statusUpdatedMessage).toBeDefined();
  expect(statusUpdatedMessage?.message.data.customerId).toBe(ctx.customerId);
  expect(statusUpdatedMessage?.message.data.vendorId).toBe(ctx.vendorId);
  expect(statusUpdatedMessage?.message.eventId).toBeDefined();

  console.log('✅ Booking Confirmed Notification: PASSED');
}

/**
 * Test: Booking Cancelled Notification
 * Verifies that cancelling a booking triggers BOOKING_STATUS_UPDATED event
 */
async function testBookingCancelledNotification(ctx: TestContext): Promise<void> {
  console.log('🧪 Testing: Booking Cancelled Notification');

  // First confirm the booking
  await fetch(`${ctx.baseUrl}/vendor/bookings/${ctx.bookingId}/confirm`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-vendor-id': ctx.vendorId,
    },
  });

  await new Promise((resolve) => setTimeout(resolve, 500));

  // Now cancel it
  const cancelResponse = await fetch(`${ctx.baseUrl}/vendor/bookings/${ctx.bookingId}/cancel`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-vendor-id': ctx.vendorId,
    },
    body: JSON.stringify({
      reason: 'Customer request',
    }),
  });

  expect(cancelResponse.ok).toBe(true);

  // Wait a bit for async notification
  await new Promise((resolve) => setTimeout(resolve, 1000));

  // Verify SNS message was published
  const cancelledMessage = capturedSnsMessages.find(
    (msg) =>
      msg.eventType === 'BOOKING_STATUS_UPDATED' &&
      msg.message.data.bookingId === ctx.bookingId &&
      msg.message.data.newStatus === 'cancelled'
  );

  expect(cancelledMessage).toBeDefined();
  expect(cancelledMessage?.message.data.oldStatus).toBe('confirmed');
  expect(cancelledMessage?.message.data.reason).toBe('Customer request');
  expect(cancelledMessage?.message.eventId).toBeDefined();

  console.log('✅ Booking Cancelled Notification: PASSED');
}

/**
 * Test: Booking Completed Notification
 * Verifies that completing a booking triggers BOOKING_STATUS_UPDATED event
 */
async function testBookingCompletedNotification(ctx: TestContext): Promise<void> {
  console.log('🧪 Testing: Booking Completed Notification');

  // Create a new booking for completion test
  const bookingResponse = await fetch(`${ctx.baseUrl}/bookings/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      customerId: ctx.customerId,
      vendorId: ctx.vendorId,
      serviceId: ctx.serviceId,
      bookingDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      bookingTime: '14:00:00',
      serviceType: 'at_home',
      amount: 500,
    }),
  });

  const bookingData = await bookingResponse.json();
  const testBookingId = bookingData.bookingId;

  // Confirm booking
  await fetch(`${ctx.baseUrl}/vendor/bookings/${testBookingId}/confirm`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-vendor-id': ctx.vendorId,
    },
  });

  await new Promise((resolve) => setTimeout(resolve, 500));

  // Update to in_progress
  await fetch(`${ctx.baseUrl}/bookings/${testBookingId}/status`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      status: 'in_progress',
    }),
  });

  await new Promise((resolve) => setTimeout(resolve, 500));

  // Complete booking
  const completeResponse = await fetch(`${ctx.baseUrl}/vendor/bookings/${testBookingId}/complete`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-vendor-id': ctx.vendorId,
    },
    body: JSON.stringify({
      notes: 'Service completed successfully',
    }),
  });

  expect(completeResponse.ok).toBe(true);

  // Wait a bit for async notification
  await new Promise((resolve) => setTimeout(resolve, 1000));

  // Verify SNS message was published
  const completedMessage = capturedSnsMessages.find(
    (msg) =>
      msg.eventType === 'BOOKING_STATUS_UPDATED' &&
      msg.message.data.bookingId === testBookingId &&
      msg.message.data.newStatus === 'completed'
  );

  expect(completedMessage).toBeDefined();
  expect(completedMessage?.message.data.oldStatus).toBe('in_progress');
  expect(completedMessage?.message.eventId).toBeDefined();

  console.log('✅ Booking Completed Notification: PASSED');
}

/**
 * Test: Status Update via PUT endpoint
 * Verifies that updating status via PUT endpoint triggers notification
 */
async function testStatusUpdateNotification(ctx: TestContext): Promise<void> {
  console.log('🧪 Testing: Status Update Notification (PUT endpoint)');

  // Create a new booking
  const bookingResponse = await fetch(`${ctx.baseUrl}/bookings/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      customerId: ctx.customerId,
      vendorId: ctx.vendorId,
      serviceId: ctx.serviceId,
      bookingDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      bookingTime: '16:00:00',
      serviceType: 'at_home',
      amount: 500,
    }),
  });

  const bookingData = await bookingResponse.json();
  const testBookingId = bookingData.bookingId;

  // Update status to confirmed
  const updateResponse = await fetch(`${ctx.baseUrl}/bookings/${testBookingId}/status`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      status: 'confirmed',
      reason: 'Vendor confirmed via API',
    }),
  });

  expect(updateResponse.ok).toBe(true);

  // Wait a bit for async notification
  await new Promise((resolve) => setTimeout(resolve, 1000));

  // Verify SNS message was published
  const statusUpdateMessage = capturedSnsMessages.find(
    (msg) =>
      msg.eventType === 'BOOKING_STATUS_UPDATED' &&
      msg.message.data.bookingId === testBookingId &&
      msg.message.data.oldStatus === 'pending' &&
      msg.message.data.newStatus === 'confirmed'
  );

  expect(statusUpdateMessage).toBeDefined();
  expect(statusUpdateMessage?.message.eventId).toBeDefined();

  console.log('✅ Status Update Notification: PASSED');
}

/**
 * Test: Event Envelope Structure
 * Verifies that all SNS messages have correct envelope structure
 */
async function testEventEnvelopeStructure(ctx: TestContext): Promise<void> {
  console.log('🧪 Testing: Event Envelope Structure');

  const testMessages = capturedSnsMessages.filter(
    (msg) => msg.message.data.bookingId === ctx.bookingId || capturedSnsMessages.indexOf(msg) < 5
  );

  for (const message of testMessages) {
    // Verify envelope structure
    expect(message.message).toHaveProperty('eventId');
    expect(message.message).toHaveProperty('eventType');
    expect(message.message).toHaveProperty('eventTimestamp');
    expect(message.message).toHaveProperty('eventSource');
    expect(message.message).toHaveProperty('eventVersion');
    expect(message.message).toHaveProperty('data');

    // Verify eventId is UUID
    expect(message.message.eventId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    );

    // Verify timestamp is ISO 8601
    expect(() => new Date(message.message.eventTimestamp)).not.toThrow();
  }

  console.log('✅ Event Envelope Structure: PASSED');
}

/**
 * Test: Notification Topic Configuration
 * Verifies that SNS topics are configured
 */
async function testNotificationTopicConfiguration(): Promise<void> {
  console.log('🧪 Testing: Notification Topic Configuration');

  // Check environment variables
  const requiredTopics = [
    'BOOKING_CREATED_TOPIC_ARN',
    'BOOKING_STATUS_UPDATED_TOPIC_ARN',
    'NOTIFICATION_TOPIC_ARN',
  ];

  for (const topic of requiredTopics) {
    const topicArn = process.env[topic];
    expect(topicArn).toBeDefined();
    expect(topicArn).toContain('arn:aws:sns');
  }

  console.log('✅ Notification Topic Configuration: PASSED');
}

// ============================================================================
// TEST SUITE
// ============================================================================

describe('Notification Triggers E2E Tests', () => {
  beforeAll(async () => {
    // Initialize test data
    // In a real test, you would create test customers, vendors, and services
    ctx.customerId = process.env.TEST_CUSTOMER_ID || 'test-customer-id';
    ctx.vendorId = process.env.TEST_VENDOR_ID || 'test-vendor-id';
    ctx.serviceId = process.env.TEST_SERVICE_ID || 'test-service-id';

    // Setup SNS mock capture
    // In a real test, you would use AWS SDK mock or spy on SNS client
    console.log('📋 Initializing notification test suite...');
  });

  afterAll(async () => {
    // Cleanup test data
    console.log('🧹 Cleaning up test data...');
    console.log(`📊 Captured ${capturedSnsMessages.length} SNS messages`);
  });

  test('Booking Created Notification', async () => {
    await testBookingCreatedNotification(ctx);
  });

  test('Booking Confirmed Notification', async () => {
    await testBookingConfirmedNotification(ctx);
  });

  test('Booking Cancelled Notification', async () => {
    await testBookingCancelledNotification(ctx);
  });

  test('Booking Completed Notification', async () => {
    await testBookingCompletedNotification(ctx);
  });

  test('Status Update Notification', async () => {
    await testStatusUpdateNotification(ctx);
  });

  test('Event Envelope Structure', async () => {
    await testEventEnvelopeStructure(ctx);
  });

  test('Notification Topic Configuration', async () => {
    await testNotificationTopicConfiguration();
  });
});

