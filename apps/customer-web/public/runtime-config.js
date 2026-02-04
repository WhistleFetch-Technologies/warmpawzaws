// Runtime Configuration for Warmpawz Customer Portal
// apiBaseUrl: MUST be set at build/deploy via NEXT_PUBLIC_API_BASE_URL or inject. No hardcoded URLs.
// Official Customer app URL: set CUSTOMER_URL / see config/urls.json cloudfront.customer

(function () {
  const defaultUatMode = true;
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
  // 4. Fallback: Use the default API Gateway URL from config/urls.json
  else {
    apiBaseUrl = 'https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com';
  }

  window.__WARMPAWZ_RUNTIME_CONFIG__ = {
    apiBaseUrl: apiBaseUrl,
    uatMode: defaultUatMode
  };

  console.log('🔧 Runtime config loaded:', window.__WARMPAWZ_RUNTIME_CONFIG__);
})();

