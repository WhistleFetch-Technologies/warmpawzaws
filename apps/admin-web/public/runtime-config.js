// Runtime Configuration for Warmpawz Admin Portal
// apiBaseUrl: MUST be set at build/deploy via NEXT_PUBLIC_API_BASE_URL or inject. No hardcoded URLs.
// Official Admin app URL: set ADMIN_URL / see config/urls.json cloudfront.admin

(function () {
  const defaultUatMode = true;
  
  // Determine environment
  // Priority: window.__NEXT_PUBLIC_ENVIRONMENT__ (injected) > window.__NEXT_DATA__.env > hostname detection
  function isProduction() {
    // 1. Check if environment was explicitly set via inline script (highest priority)
    if (typeof window !== 'undefined' && window.__NEXT_PUBLIC_ENVIRONMENT__) {
      return window.__NEXT_PUBLIC_ENVIRONMENT__ === 'production';
    }
    
    // 2. Check Next.js injected environment variables
    if (typeof window !== 'undefined' && window.__NEXT_DATA__?.env?.NEXT_PUBLIC_ENVIRONMENT) {
      return window.__NEXT_DATA__.env.NEXT_PUBLIC_ENVIRONMENT === 'production';
    }
    
    // 3. Check hostname (production CloudFront domains)
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
  // Priority: window.__NEXT_PUBLIC_API_BASE_URL__ (injected) > __API_BASE_URL__ > window.__NEXT_DATA__.env > environment-based fallback
  let apiBaseUrl = '';
  if (typeof window !== 'undefined' && window.__NEXT_PUBLIC_API_BASE_URL__) {
    // Highest priority: explicitly set via inline script
    apiBaseUrl = window.__NEXT_PUBLIC_API_BASE_URL__;
  } else if (typeof __API_BASE_URL__ !== 'undefined' && __API_BASE_URL__) {
    apiBaseUrl = __API_BASE_URL__;
  } else if (typeof window !== 'undefined' && window.__NEXT_DATA__?.env?.NEXT_PUBLIC_API_BASE_URL) {
    // Next.js injected env var
    apiBaseUrl = window.__NEXT_DATA__.env.NEXT_PUBLIC_API_BASE_URL;
  } else {
    apiBaseUrl = getApiGatewayUrl();
  }

  // Determine environment: check injected env var first, then hostname
  const envFromVar = typeof window !== 'undefined' && window.__NEXT_PUBLIC_ENVIRONMENT__;
  const environment = envFromVar || (isProduction() ? 'production' : 'development');
  
  // Determine UAT mode: check injected env var first, then environment
  const uatModeFromVar = typeof window !== 'undefined' && window.__NEXT_PUBLIC_UAT_MODE__;
  let uatMode;
  if (uatModeFromVar !== undefined) {
    // Explicitly set via environment variable
    uatMode = uatModeFromVar === true || uatModeFromVar === 'true';
  } else {
    // Fallback: disable UAT mode in production for security
    uatMode = isProduction() ? false : defaultUatMode;
  }

  // Only override if config doesn't exist or if explicitly set via environment variables
  // This preserves values set by the inline script in layout.tsx
  if (!window.__WARMPAWZ_RUNTIME_CONFIG__ || window.__NEXT_PUBLIC_ENVIRONMENT__) {
    window.__WARMPAWZ_RUNTIME_CONFIG__ = {
      apiBaseUrl: apiBaseUrl,
      uatMode: uatMode,
      environment: environment
    };
  } else {
    // If config already exists from inline script, just update missing fields
    const existing = window.__WARMPAWZ_RUNTIME_CONFIG__;
    if (!existing.apiBaseUrl) existing.apiBaseUrl = apiBaseUrl;
    if (existing.uatMode === undefined) existing.uatMode = uatMode;
    if (!existing.environment) existing.environment = environment;
  }

  console.log('🔧 Runtime config loaded:', window.__WARMPAWZ_RUNTIME_CONFIG__);
})();

