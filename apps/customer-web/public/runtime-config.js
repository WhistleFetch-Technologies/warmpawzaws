// Runtime Configuration for Warmpawz Customer Portal
// apiBaseUrl: MUST be set at build/deploy via NEXT_PUBLIC_API_BASE_URL or inject. No hardcoded URLs.
// Official Customer app URL: set CUSTOMER_URL / see config/urls.json cloudfront.customer

(function () {
  // UAT mode is ONLY for development (NODE_ENV === 'development')
  // Production should NEVER use UAT mode
  const defaultUatMode = false;
  
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
  // Priority: Injected from layout > window.__NEXT_DATA__ > __API_BASE_URL__ > environment-based fallback
  let apiBaseUrl = '';
  let source = '';
  
  // 1. Check for variable injected from layout.tsx (HIGHEST PRIORITY - set before this script runs)
  if (typeof window !== 'undefined' && window.__NEXT_PUBLIC_API_BASE_URL__) {
    apiBaseUrl = window.__NEXT_PUBLIC_API_BASE_URL__;
    source = 'injected from layout.tsx (NEXT_PUBLIC_API_BASE_URL)';
  }
  // 2. Check window.__NEXT_DATA__.env (Next.js injected env vars)
  else if (typeof window !== 'undefined' && window.__NEXT_DATA__?.env?.NEXT_PUBLIC_API_BASE_URL) {
    apiBaseUrl = window.__NEXT_DATA__.env.NEXT_PUBLIC_API_BASE_URL;
    source = 'window.__NEXT_DATA__.env';
  }
  // 3. Check for build-time injected variable (via webpack DefinePlugin)
  else if (typeof __API_BASE_URL__ !== 'undefined' && __API_BASE_URL__) {
    apiBaseUrl = __API_BASE_URL__;
    source = '__API_BASE_URL__';
  }
  // 4. Check if it's set as a global (Next.js sometimes exposes it this way)
  else if (typeof window !== 'undefined' && window.process?.env?.NEXT_PUBLIC_API_BASE_URL) {
    apiBaseUrl = window.process.env.NEXT_PUBLIC_API_BASE_URL;
    source = 'window.process.env';
  }
  // 5. Fallback: Use environment-aware API Gateway selection
  else {
    apiBaseUrl = getApiGatewayUrl();
    source = 'environment-based fallback (hostname detection)';
  }
  
  console.log(`🔧 Runtime Config - API Base URL: ${apiBaseUrl}`);
  console.log(`🔧 Runtime Config - Source: ${source}`);
  console.log(`🔧 Runtime Config - window.__NEXT_PUBLIC_API_BASE_URL__:`, typeof window !== 'undefined' ? window.__NEXT_PUBLIC_API_BASE_URL__ : 'N/A');
  console.log(`🔧 Runtime Config - window.__NEXT_DATA__?.env:`, typeof window !== 'undefined' ? window.__NEXT_DATA__?.env : 'N/A');

  const environment = isProduction() ? 'production' : 'development';

  // Only set uatMode to true in development (localhost)
  const isDev = typeof window !== 'undefined' && 
    (window.location.hostname === 'localhost' || 
     window.location.hostname === '127.0.0.1' || 
     window.location.hostname.includes('localhost'));
  
  window.__WARMPAWZ_RUNTIME_CONFIG__ = {
    apiBaseUrl: apiBaseUrl,
    uatMode: isDev ? true : false, // Only true in development
    environment: environment
  };

  console.log('🔧 Runtime config loaded:', window.__WARMPAWZ_RUNTIME_CONFIG__);
})();

