/**
 * Comprehensive Notification Test Script
 * Tests email, SMS (OTP), and in-app notifications
 * 
 * Usage: node test-notifications-comprehensive.js
 */

const PROJECT_ID = process.env.PROJECT_ID || 'your-project-id';
const API_BASE = `https://${PROJECT_ID}.supabase.co/functions/v1/make-server-3dd53475`;

// Test configuration
const TEST_CONFIG = {
  email: 'ketan.hirani@gmail.com',
  phones: ['9611377119', '8296414048'],
  emailSource: 'noreply@warmpawz.com',
  smsSenderId: 'WARMP-VX' // Can be WARMP-VX, WARMP-SX, WARMP-NX
};

// Colors for console
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m',
  cyan: '\x1b[36m'
};

let testsPassed = 0;
let testsFailed = 0;

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logTest(name, passed, details = '') {
  if (passed) {
    log(`✅ ${name}`, 'green');
    testsPassed++;
  } else {
    log(`❌ ${name}`, 'red');
    if (details) log(`   ${details}`, 'yellow');
    testsFailed++;
  }
}

async function testEndpoint(name, method, endpoint, body = null) {
  try {
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json'
      }
    };
    
    if (body) {
      options.body = JSON.stringify(body);
    }
    
    const response = await fetch(`${API_BASE}${endpoint}`, options);
    const data = await response.json();
    
    return {
      success: response.ok,
      status: response.status,
      data
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

async function testOTP(phone) {
  log(`\n📱 Testing OTP to ${phone}...`, 'cyan');
  
  const result = await testEndpoint(
    'Send OTP',
    'POST',
    '/auth/send-otp',
    { phone: `+91${phone}` }
  );
  
  if (result.success) {
    logTest(`OTP sent to ${phone}`, true, result.data.debug_otp ? `OTP: ${result.data.debug_otp}` : '');
    return result.data.debug_otp || 'sent';
  } else {
    logTest(`OTP to ${phone}`, false, result.error || `HTTP ${result.status}`);
    return null;
  }
}

async function testEmailNotification() {
  log(`\n📧 Testing Email Notification...`, 'cyan');
  
  const result = await testEndpoint(
    'Email Notification',
    'POST',
    '/notifications/send',
    {
      recipientId: 'test_user_email',
      recipientType: 'customer',
      recipientEmail: TEST_CONFIG.email,
      type: 'system_announcement',
      category: 'system',
      title: '🧪 Test Email Notification - Warmpawz',
      message: 'This is a test email notification from Warmpawz notification system. If you receive this, email notifications are working correctly!',
      channels: {
        email: true,
        sms: false,
        inApp: true,
        push: false
      },
      priority: 'high',
      data: {
        actionUrl: 'https://warmpawz.com',
        testType: 'email_verification'
      }
    }
  );
  
  logTest('Email notification sent', result.success, result.error || `Notification ID: ${result.data?.notification?.id}`);
  return result.success;
}

async function testSMSNotification(phone, senderId = 'WARMP-VX') {
  log(`\n📱 Testing SMS Notification to ${phone}...`, 'cyan');
  
  const result = await testEndpoint(
    'SMS Notification',
    'POST',
    '/notifications/send',
    {
      recipientId: `test_user_${phone}`,
      recipientType: 'customer',
      recipientPhone: `+91${phone}`,
      type: 'booking_confirmed',
      category: 'bookings',
      title: 'Booking Confirmed',
      message: `🧪 Test SMS from Warmpawz. This is a test notification. Sender ID: ${senderId}`,
      channels: {
        email: false,
        sms: true,
        inApp: true,
        push: false
      },
      priority: 'high',
      data: {
        bookingId: 'TEST-BOOKING-123',
        testType: 'sms_verification'
      }
    }
  );
  
  logTest(`SMS notification to ${phone}`, result.success, result.error || `Notification ID: ${result.data?.notification?.id}`);
  return result.success;
}

async function testInAppNotification(recipientId, recipientType = 'customer') {
  log(`\n🔔 Testing In-App Notification...`, 'cyan');
  
  const result = await testEndpoint(
    'In-App Notification',
    'POST',
    '/notifications/send',
    {
      recipientId: recipientId,
      recipientType: recipientType,
      recipientEmail: recipientType === 'customer' ? TEST_CONFIG.email : undefined,
      recipientPhone: recipientType === 'customer' ? `+91${TEST_CONFIG.phones[0]}` : undefined,
      type: 'system_announcement',
      category: 'system',
      title: '🧪 Test In-App Notification',
      message: 'This is a test in-app notification. Check your notification center!',
      channels: {
        email: false,
        sms: false,
        inApp: true,
        push: false
      },
      priority: 'medium',
      data: {
        testType: 'inapp_verification',
        timestamp: new Date().toISOString()
      }
    }
  );
  
  logTest('In-app notification created', result.success, result.error || `Notification ID: ${result.data?.notification?.id}`);
  
  // Try to retrieve it
  if (result.success && result.data?.notification?.id) {
    const phone = recipientType === 'customer' ? TEST_CONFIG.phones[0] : undefined;
    const getEndpoint = recipientType === 'customer' 
      ? `/customer/notifications/${phone}?limit=5`
      : `/vendor/notifications/${recipientId}?limit=5`;
    
    const getResult = await testEndpoint('Get Notifications', 'GET', getEndpoint);
    logTest('In-app notification retrievable', getResult.success, getResult.error || `${getResult.data?.notifications?.length || 0} notifications found`);
  }
  
  return result.success;
}

async function testVendorNotification() {
  log(`\n🏪 Testing Vendor Notification...`, 'cyan');
  
  const result = await testEndpoint(
    'Vendor Notification',
    'POST',
    '/notifications/send',
    {
      recipientId: 'test_vendor_123',
      recipientType: 'vendor',
      recipientEmail: TEST_CONFIG.email,
      recipientPhone: `+91${TEST_CONFIG.phones[0]}`,
      type: 'vendor_application_approved',
      category: 'vendor_onboarding',
      title: '✅ Application Approved - Welcome to Warmpawz!',
      message: '🧪 Test: Congratulations! Your vendor application has been approved. This is a test notification.',
      channels: {
        email: true,
        sms: true,
        inApp: true,
        push: false
      },
      priority: 'high',
      data: {
        vendorName: 'Test Vendor',
        roleName: 'Test Role',
        testType: 'vendor_notification_verification'
      }
    }
  );
  
  logTest('Vendor notification (email + SMS + in-app)', result.success, result.error || `Notification ID: ${result.data?.notification?.id}`);
  return result.success;
}

async function checkAWSConfiguration() {
  log(`\n⚙️ Checking AWS Configuration...`, 'cyan');
  
  // Check if we can get AWS settings (this might require admin auth)
  log('   Note: AWS configuration check requires admin authentication', 'yellow');
  log('   Please verify in Admin Panel > Integrations > AWS:', 'yellow');
  log('   - AWS Credentials (Access Key ID, Secret Access Key)', 'yellow');
  log('   - SNS Enabled: true', 'yellow');
  log('   - SNS Region: ap-south-1 (or your region)', 'yellow');
  log('   - SES Enabled: true', 'yellow');
  log('   - SES Region: ap-south-1 (or your region)', 'yellow');
  log('   - Email Source Address: noreply@warmpawz.com', 'yellow');
  log('   - SMS Sender ID: WARMP-VX (configured in AWS SNS)', 'yellow');
}

async function runAllTests() {
  log('\n🧪 ========================================', 'blue');
  log('   COMPREHENSIVE NOTIFICATION TEST SUITE', 'blue');
  log('   ========================================', 'blue');
  log(`\n📧 Test Email: ${TEST_CONFIG.email}`, 'cyan');
  log(`📱 Test Phones: ${TEST_CONFIG.phones.join(', ')}`, 'cyan');
  log(`📧 Email Source: ${TEST_CONFIG.emailSource}`, 'cyan');
  log(`📱 SMS Sender ID: ${TEST_CONFIG.smsSenderId}`, 'cyan');
  
  // Check configuration
  await checkAWSConfiguration();
  
  // Test OTP
  log(`\n${'='.repeat(50)}`, 'blue');
  log('📱 OTP TESTS', 'blue');
  log('='.repeat(50), 'blue');
  
  for (const phone of TEST_CONFIG.phones) {
    await testOTP(phone);
    await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second between requests
  }
  
  // Test Email
  log(`\n${'='.repeat(50)}`, 'blue');
  log('📧 EMAIL NOTIFICATION TESTS', 'blue');
  log('='.repeat(50), 'blue');
  
  await testEmailNotification();
  
  // Test SMS
  log(`\n${'='.repeat(50)}`, 'blue');
  log('📱 SMS NOTIFICATION TESTS', 'blue');
  log('='.repeat(50), 'blue');
  
  for (const phone of TEST_CONFIG.phones) {
    await testSMSNotification(phone, TEST_CONFIG.smsSenderId);
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  // Test In-App
  log(`\n${'='.repeat(50)}`, 'blue');
  log('🔔 IN-APP NOTIFICATION TESTS', 'blue');
  log('='.repeat(50), 'blue');
  
  await testInAppNotification('test_customer_123', 'customer');
  await testInAppNotification('test_vendor_123', 'vendor');
  
  // Test Vendor Notification (all channels)
  log(`\n${'='.repeat(50)}`, 'blue');
  log('🏪 VENDOR NOTIFICATION TESTS (All Channels)', 'blue');
  log('='.repeat(50), 'blue');
  
  await testVendorNotification();
  
  // Summary
  log(`\n${'='.repeat(50)}`, 'blue');
  log('📊 TEST SUMMARY', 'blue');
  log('='.repeat(50), 'blue');
  log(`\n✅ Passed: ${testsPassed}`, 'green');
  log(`❌ Failed: ${testsFailed}`, testsFailed > 0 ? 'red' : 'green');
  log(`📊 Total: ${testsPassed + testsFailed}`, 'cyan');
  
  if (testsFailed === 0) {
    log('\n🎉 All tests passed!', 'green');
  } else {
    log('\n⚠️ Some tests failed. Check configuration and AWS settings.', 'yellow');
  }
  
  log('\n📋 Next Steps:', 'cyan');
  log('1. Check your email inbox for test email', 'yellow');
  log('2. Check SMS on both phone numbers', 'yellow');
  log('3. Verify in-app notifications in customer/vendor apps', 'yellow');
  log('4. Verify AWS SNS/SES configuration in Admin Panel', 'yellow');
  log('5. Check AWS SNS console for SMS delivery status', 'yellow');
  log('6. Check AWS SES console for email delivery status', 'yellow');
}

// Run tests
if (typeof window === 'undefined') {
  // Node.js environment
  const fetch = require('node-fetch');
  global.fetch = fetch;
  runAllTests().catch(console.error);
} else {
  // Browser environment
  runAllTests().catch(console.error);
}

