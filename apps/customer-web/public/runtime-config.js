// Runtime Configuration for Warmpawz Customer Portal
// apiBaseUrl: MUST be set at build/deploy via NEXT_PUBLIC_API_BASE_URL or inject. No hardcoded URLs.
// Official Customer app URL: set CUSTOMER_URL / see config/urls.json cloudfront.customer

(function () {
  const defaultUatMode = true;
  
  // If config is already set (e.g., by layout.tsx for production mode), use it
  if (window.__WARMPAWZ_RUNTIME_CONFIG__ && window.__WARMPAWZ_RUNTIME_CONFIG__.apiBaseUrl) {
    // ✅ FIX: If NEXT_PUBLIC_API_BASE_URL is injected (local dev), use it instead
    if (typeof window !== 'undefined' && window.__NEXT_PUBLIC_API_BASE_URL__) {
      window.__WARMPAWZ_RUNTIME_CONFIG__.apiBaseUrl = window.__NEXT_PUBLIC_API_BASE_URL__;
      console.log('🔧 Runtime config loaded (local dev - using NEXT_PUBLIC_API_BASE_URL):', window.__WARMPAWZ_RUNTIME_CONFIG__);
      return;
    }
    console.log('🔧 Runtime config loaded (pre-configured):', window.__WARMPAWZ_RUNTIME_CONFIG__);
    return;
  }
  
  // Determine environment based on hostname
  function isProduction() {
    if (typeof window !== 'undefined' && window.location) {
      const hostname = window.location.hostname;
      
      // Production domains (exact match, not dev subdomains)
      if (hostname === 'customer.warmpawz.com' ||
          hostname === 'vendor.warmpawz.com' ||
          hostname === 'admin.warmpawz.com' ||
          hostname === 'warmpawz.com' ||
          hostname === 'www.warmpawz.com' ||
          hostname.includes('cloudfront.net')) {
        return true;
      }
      
      // Dev subdomains (dev.customer.warmpawz.com, dev.vendor.warmpawz.com, etc.)
      if (hostname.startsWith('dev.') && hostname.includes('warmpawz.com')) {
        return false; // Dev environment
      }
      
      // Localhost
      if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname.includes('localhost')) {
        return false; // Dev environment
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
  
  // ✅ FIX: Priority: window.__NEXT_PUBLIC_API_BASE_URL__ → __API_BASE_URL__ → getApiGatewayUrl()
  // If NEXT_PUBLIC_API_BASE_URL is set (from npm script), use it
  // Otherwise, use hostname-based detection for deployed environments
  const apiBaseUrl = (typeof window !== 'undefined' && window.__NEXT_PUBLIC_API_BASE_URL__) ||
                     (typeof __API_BASE_URL__ !== 'undefined' ? __API_BASE_URL__ : '') ||
                     getApiGatewayUrl();

  // Determine environment: check if it's production hostname or dev subdomain
  const hostname = typeof window !== 'undefined' && window.location ? window.location.hostname : '';
  const isDevSubdomain = hostname.startsWith('dev.') && hostname.includes('warmpawz.com');
  const isProdHostname = hostname === 'customer.warmpawz.com' || 
                         hostname === 'vendor.warmpawz.com' || 
                         hostname === 'admin.warmpawz.com' ||
                         hostname === 'warmpawz.com' ||
                         hostname === 'www.warmpawz.com' ||
                         hostname.includes('cloudfront.net');
  
  const environment = (isProdHostname && !isDevSubdomain) ? 'production' : 'development';
  
  // UAT mode: true for dev/local, false for production
  const uatMode = (isProdHostname && !isDevSubdomain) ? false : defaultUatMode;

  window.__WARMPAWZ_RUNTIME_CONFIG__ = {
    apiBaseUrl: apiBaseUrl,
    uatMode: uatMode,
    environment: environment
  };

  console.log('🔧 Runtime config loaded:', window.__WARMPAWZ_RUNTIME_CONFIG__);
})();

