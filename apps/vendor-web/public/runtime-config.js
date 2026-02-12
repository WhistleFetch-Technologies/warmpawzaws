// Runtime Configuration for Warmpawz Vendor Portal
// apiBaseUrl: Set at deploy-time via deployment script, falls back to environment-aware API Gateway URL
// Official Vendor app URL: set VENDOR_URL / see config/urls.json cloudfront.vendor

(function () {
  const defaultUatMode = false;
  
  // Determine environment
  function isProduction() {
    // Check hostname (production CloudFront domains)
    if (typeof window !== 'undefined' && window.location) {
      const hostname = window.location.hostname;
      if (hostname.includes('cloudfront.net') || 
          hostname.includes('warmpawz.com') ||
          hostname.includes('vendor.warmpawz.com')) {
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
  
  // Priority: explicit env var (allows local override) → build-time __API_BASE_URL__ → environment-based fallback
  const apiBaseUrl = (typeof process !== 'undefined' && process.env && process.env.NEXT_PUBLIC_API_BASE_URL) ||
                     (typeof __API_BASE_URL__ !== 'undefined' ? __API_BASE_URL__ : '') || 
                     getApiGatewayUrl();

  const environment = isProduction() ? 'production' : 'development';

  window.__WARMPAWZ_RUNTIME_CONFIG__ = {
    apiBaseUrl: apiBaseUrl,
    uatMode: defaultUatMode,
    environment: environment
  };

  console.log('🔧 Runtime config loaded:', window.__WARMPAWZ_RUNTIME_CONFIG__);
})();

