// Runtime Configuration for Warmpawz Customer Portal
// apiBaseUrl: MUST be set at build/deploy via NEXT_PUBLIC_API_BASE_URL or inject. No hardcoded URLs.
// Official Customer app URL: set CUSTOMER_URL / see config/urls.json cloudfront.customer

(function () {
  const defaultUatMode = true;
  
  // If config is already set (e.g., by layout.tsx for production mode), use it
  if (window.__WARMPAWZ_RUNTIME_CONFIG__ && window.__WARMPAWZ_RUNTIME_CONFIG__.apiBaseUrl) {
    console.log('🔧 Runtime config loaded (pre-configured):', window.__WARMPAWZ_RUNTIME_CONFIG__);
    return;
  }
  
  // Determine environment
  function isProduction() {
    // Check hostname (production CloudFront domains)
    if (typeof window !== 'undefined' && window.location) {
      const hostname = window.location.hostname;
      if (hostname.includes('cloudfront.net') || 
          hostname.includes('warmpawz.com') ||
          hostname.includes('customer.warmpawz.com')) {
        return true;
      }
      if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname.includes('localhost')) {
        return false;
      }
    }
    // Default to production for safety
    return true;
  }
  
  // Get API Gateway URL based on environment
  function getApiGatewayUrl() {
    return isProduction()
      ? 'https://mss9sa4y01.execute-api.ap-south-1.amazonaws.com'
      : 'https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com';
  }
  
  // Next.js injects NEXT_PUBLIC_* vars - check multiple sources
  let apiBaseUrl = '';
  
  // 1. Check for build-time injected variable (via webpack DefinePlugin)
  if (typeof __API_BASE_URL__ !== 'undefined' && __API_BASE_URL__) {
    apiBaseUrl = __API_BASE_URL__;
  }
  // 2. Check window.__NEXT_DATA__.env (Next.js injected env vars)
  else if (typeof window !== 'undefined' && window.__NEXT_DATA__?.env?.NEXT_PUBLIC_API_BASE_URL) {
    apiBaseUrl = window.__NEXT_DATA__.env.NEXT_PUBLIC_API_BASE_URL;
  }
  // 3. Check if it's set as a global (Next.js sometimes exposes it this way)
  else if (typeof window !== 'undefined' && window.process?.env?.NEXT_PUBLIC_API_BASE_URL) {
    apiBaseUrl = window.process.env.NEXT_PUBLIC_API_BASE_URL;
  }
  // 4. Fallback: Use environment-aware API Gateway selection
  else {
    apiBaseUrl = getApiGatewayUrl();
  }

  const environment = isProduction() ? 'production' : 'development';
  const uatMode = window.__WARMPAWZ_PROD_MODE__ ? false : defaultUatMode; // Respect prod mode flag

  window.__WARMPAWZ_RUNTIME_CONFIG__ = {
    apiBaseUrl: apiBaseUrl,
    uatMode: uatMode,
    environment: environment
  };

  console.log('🔧 Runtime config loaded:', window.__WARMPAWZ_RUNTIME_CONFIG__);
})();

