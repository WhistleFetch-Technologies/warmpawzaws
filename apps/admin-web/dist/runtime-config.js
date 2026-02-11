// Runtime Configuration for Warmpawz Admin Portal
// apiBaseUrl: MUST be set at build/deploy via NEXT_PUBLIC_API_BASE_URL or inject. No hardcoded URLs.
// Official Admin app URL: set ADMIN_URL / see config/urls.json cloudfront.admin

(function () {
  const defaultUatMode = true;
  
  // Determine environment
  function isProduction() {
    // Check hostname (production CloudFront domains)
    if (typeof window !== 'undefined' && window.location) {
      const hostname = window.location.hostname;
      if (hostname.includes('cloudfront.net') || 
          hostname.includes('warmpawz.com') ||
          hostname.includes('admin.warmpawz.com')) {
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
  
  // Injected at build/deploy as __API_BASE_URL__ or set NEXT_PUBLIC_API_BASE_URL in env
  const apiBaseUrl = (typeof __API_BASE_URL__ !== 'undefined' ? __API_BASE_URL__ : '') || 
                     (typeof process !== 'undefined' && process.env && process.env.NEXT_PUBLIC_API_BASE_URL) || 
                     getApiGatewayUrl();

  const environment = isProduction() ? 'production' : 'development';

  window.__WARMPAWZ_RUNTIME_CONFIG__ = {
    apiBaseUrl: apiBaseUrl,
    uatMode: defaultUatMode,
    environment: environment
  };

  console.log('🔧 Runtime config loaded:', window.__WARMPAWZ_RUNTIME_CONFIG__);
})();

