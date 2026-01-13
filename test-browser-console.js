/**
 * Browser Console Test Script
 * Run this in browser console after login to verify session management
 */

(function() {
  console.log('🧪 Hard Refresh Fix - Browser Console Test');
  console.log('==========================================\n');

  // Check sessionStorage flags
  const customerFlag = sessionStorage.getItem('_warmpawz_has_session');
  const vendorFlag = sessionStorage.getItem('_warmpawz_vendor_has_session');
  const adminFlag = sessionStorage.getItem('_warmpawz_admin_has_session');
  
  const hasSessionFlag = !!(customerFlag || vendorFlag || adminFlag);
  const sessionType = customerFlag ? 'Customer' : vendorFlag ? 'Vendor' : adminFlag ? 'Admin' : 'None';

  // Check localStorage tokens
  const authToken = localStorage.getItem('authToken');
  const cognitoToken = localStorage.getItem('cognitoAccessToken');
  const adminToken = localStorage.getItem('adminAuthToken');
  
  const hasToken = !!(authToken || cognitoToken || adminToken);
  const tokenType = authToken ? 'authToken' : cognitoToken ? 'cognitoAccessToken' : adminToken ? 'adminAuthToken' : 'None';

  // Test Results
  console.log('📊 Session Status:');
  console.log('  Session Type:', sessionType);
  console.log('  Session Flag:', hasSessionFlag ? '✅ Present' : '❌ Missing');
  console.log('  Token Type:', tokenType);
  console.log('  Token Present:', hasToken ? '✅ Present' : '❌ Missing');
  console.log('');

  // Hard Refresh Detection Test
  console.log('🔄 Hard Refresh Detection:');
  const wouldDetectHardRefresh = hasToken && !hasSessionFlag;
  console.log('  Would detect hard refresh:', wouldDetectHardRefresh ? '✅ YES' : '❌ NO');
  
  if (wouldDetectHardRefresh) {
    console.log('  ⚠️  This indicates a hard refresh occurred!');
    console.log('  Expected: Session should be cleared');
  } else if (hasToken && hasSessionFlag) {
    console.log('  ✅ Normal state: Logged in with session flag');
  } else if (!hasToken && !hasSessionFlag) {
    console.log('  ✅ Normal state: Not logged in');
  }
  console.log('');

  // Detailed Storage Check
  console.log('📦 Storage Details:');
  console.log('  sessionStorage keys:', Object.keys(sessionStorage).filter(k => k.includes('warmpawz')));
  console.log('  localStorage keys:', Object.keys(localStorage).filter(k => 
    k.includes('auth') || k.includes('token') || k.includes('customer') || k.includes('vendor') || k.includes('admin')
  ));
  console.log('');

  // Test Functions
  window.testHardRefresh = function() {
    console.log('🧪 Testing Hard Refresh Detection...');
    const hasToken = !!(localStorage.getItem('authToken') || 
      localStorage.getItem('cognitoAccessToken') || 
      localStorage.getItem('adminAuthToken'));
    const hasFlag = !!(sessionStorage.getItem('_warmpawz_has_session') || 
      sessionStorage.getItem('_warmpawz_vendor_has_session') || 
      sessionStorage.getItem('_warmpawz_admin_has_session'));
    
    console.log('  Has Token:', hasToken);
    console.log('  Has Flag:', hasFlag);
    console.log('  Would Detect Hard Refresh:', hasToken && !hasFlag);
    
    if (hasToken && !hasFlag) {
      console.log('  ⚠️  HARD REFRESH DETECTED - Session should be cleared!');
      return true;
    } else {
      console.log('  ✅ Normal state');
      return false;
    }
  };

  window.clearSessionTest = function() {
    console.log('🧹 Clearing session for testing...');
    sessionStorage.clear();
    localStorage.clear();
    console.log('  ✅ Session cleared');
    console.log('  Refresh page to test login flow');
  };

  window.checkSessionAfterLogin = function() {
    console.log('✅ Checking session after login...');
    const flag = sessionStorage.getItem('_warmpawz_has_session') || 
                 sessionStorage.getItem('_warmpawz_vendor_has_session') || 
                 sessionStorage.getItem('_warmpawz_admin_has_session');
    const token = localStorage.getItem('authToken') || 
                  localStorage.getItem('cognitoAccessToken') || 
                  localStorage.getItem('adminAuthToken');
    
    if (flag && token) {
      console.log('  ✅ Session properly set');
      console.log('  Flag:', flag);
      console.log('  Token:', token.substring(0, 50) + '...');
      return true;
    } else {
      console.log('  ❌ Session not properly set');
      console.log('  Flag:', flag || 'MISSING');
      console.log('  Token:', token || 'MISSING');
      return false;
    }
  };

  console.log('🛠️  Helper Functions Available:');
  console.log('  testHardRefresh() - Test hard refresh detection');
  console.log('  clearSessionTest() - Clear session for testing');
  console.log('  checkSessionAfterLogin() - Verify session after login');
  console.log('');

  // Initial Test
  if (hasToken && hasSessionFlag) {
    console.log('✅ Current State: Logged in with session flag');
    console.log('   → Press F5 to test hard refresh');
  } else if (hasToken && !hasSessionFlag) {
    console.log('⚠️  Current State: Has token but no flag');
    console.log('   → This indicates a hard refresh occurred');
    console.log('   → Session should be cleared');
  } else {
    console.log('ℹ️  Current State: Not logged in');
    console.log('   → Login to test session management');
  }

  console.log('\n==========================================');
})();
