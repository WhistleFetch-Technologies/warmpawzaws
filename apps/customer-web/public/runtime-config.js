// Runtime Configuration for Warmpawz Customer Portal
// This file is loaded at runtime and provides API configuration
// For local development, set NEXT_PUBLIC_API_BASE_URL (e.g. http://localhost:3000)
// Official CloudFront: Admin dfof7mguaa0a5 | Vendor d1s6ykkj381k58 | Customer d2aoyjj8ine0wk

(function () {
  // Deployed API (WarmpawzStack-dev). Replace with your stack's ApiGatewayUrl if different.
  const defaultApiBaseUrl = 'https://rrg9107m3d.execute-api.ap-south-1.amazonaws.com';
  const defaultUatMode = true;

  window.__WARMPAWZ_RUNTIME_CONFIG__ = {
    apiBaseUrl: defaultApiBaseUrl,
    uatMode: defaultUatMode
  };

  console.log('🔧 Runtime config loaded:', window.__WARMPAWZ_RUNTIME_CONFIG__);
})();

