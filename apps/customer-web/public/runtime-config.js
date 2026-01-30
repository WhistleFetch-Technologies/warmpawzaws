// Runtime Configuration for Warmpawz Customer Portal
// This file is loaded at runtime and provides API configuration
// For local development, this can be overridden by NEXT_PUBLIC_API_BASE_URL env var
// Official CloudFront: Admin dfof7mguaa0a5 | Vendor d1s6ykkj381k58 | Customer d2aoyjj8ine0wk

(function () {
  // Serverless API (z0b3obweb6) - supports UAT tokens for phone-based customer login
  // CDK API (rrg9107m3d) uses Cognito-only and returns 401 for UAT tokens
  const defaultApiBaseUrl = 'https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com';
  const defaultUatMode = true; // Enable UAT mode for local development

  window.__WARMPAWZ_RUNTIME_CONFIG__ = {
    apiBaseUrl: defaultApiBaseUrl,
    uatMode: defaultUatMode
  };

  console.log('🔧 Runtime config loaded:', window.__WARMPAWZ_RUNTIME_CONFIG__);
})();

