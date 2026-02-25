// Runtime Configuration for Warmpawz Admin Portal
// apiBaseUrl: MUST be set at build/deploy via NEXT_PUBLIC_API_BASE_URL or inject. No hardcoded URLs.
// Official Admin app URL: set ADMIN_URL / see config/urls.json cloudfront.admin

(function () {
  // CRITICAL: Production mode detection - if production mode is set, NEVER use UAT mode or dev API gateway
  const isProductionMode = window.__WARMPAWZ_PROD_MODE__ === true;
  
  // If config is already set (e.g., by layout.tsx for production mode), preserve it
  if (window.__WARMPAWZ_RUNTIME_CONFIG__ && window.__WARMPAWZ_RUNTIME_CONFIG__.apiBaseUrl) {
    // If production mode flag is set, FORCE uatMode to false and prod API gateway
    if (isProductionMode) {
      window.__WARMPAWZ_RUNTIME_CONFIG__.uatMode = false;
      window.__WARMPAWZ_RUNTIME_CONFIG__.environment = 'production';
      // CRITICAL: Production MUST use prod API gateway, NEVER dev
      window.__WARMPAWZ_RUNTIME_CONFIG__.apiBaseUrl = 'https://mss9sa4y01.execute-api.ap-south-1.amazonaws.com';
      console.log('🔧 Runtime config loaded (PROD - locked):', window.__WARMPAWZ_RUNTIME_CONFIG__);
    } else {
      console.log('🔧 Runtime config loaded (pre-configured):', window.__WARMPAWZ_RUNTIME_CONFIG__);
    }
    return;
  }
  
  // If production mode flag is set, don't override with UAT mode
  if (isProductionMode) {
    window.__WARMPAWZ_RUNTIME_CONFIG__ = window.__WARMPAWZ_RUNTIME_CONFIG__ || {};
    window.__WARMPAWZ_RUNTIME_CONFIG__.uatMode = false;
    window.__WARMPAWZ_RUNTIME_CONFIG__.environment = 'production';
    // CRITICAL: Production MUST use prod API gateway, NEVER dev
    window.__WARMPAWZ_RUNTIME_CONFIG__.apiBaseUrl = 'https://mss9sa4y01.execute-api.ap-south-1.amazonaws.com';
    console.log('🔧 Runtime config set (PRODUCTION - locked to prod API):', window.__WARMPAWZ_RUNTIME_CONFIG__);
    return;
  }
  
  // Determine environment (only for non-production mode)
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
  // CRITICAL: Production MUST use prod API gateway, NEVER dev
  function getApiGatewayUrl() {
    const isProd = isProduction();
    if (isProd) {
      // Production: ALWAYS use prod API gateway
      return 'https://mss9sa4y01.execute-api.ap-south-1.amazonaws.com';
    }
    // Development: use dev API gateway
    return 'https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com';
  }
  
  // Injected at build/deploy as __API_BASE_URL__ or set NEXT_PUBLIC_API_BASE_URL in env
  const apiBaseUrl = (typeof __API_BASE_URL__ !== 'undefined' ? __API_BASE_URL__ : '') || 
                     getApiGatewayUrl();

  const environment = isProduction() ? 'production' : 'development';
  // CRITICAL: Only enable UAT mode if NOT in production
  const defaultUatMode = environment !== 'production';

  window.__WARMPAWZ_RUNTIME_CONFIG__ = {
    apiBaseUrl: apiBaseUrl,
    uatMode: defaultUatMode,
    environment: environment
  };

  console.log('🔧 Runtime config loaded:', window.__WARMPAWZ_RUNTIME_CONFIG__);
})();

