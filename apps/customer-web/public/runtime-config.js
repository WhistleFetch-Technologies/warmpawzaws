// Runtime Configuration for Warmpawz Customer Portal
// apiBaseUrl: MUST be set at build/deploy via NEXT_PUBLIC_API_BASE_URL or inject. No hardcoded URLs.
// Official Customer app URL: set CUSTOMER_URL / see config/urls.json cloudfront.customer

(function () {
  const defaultUatMode = true;
  const apiBaseUrl = (typeof __API_BASE_URL__ !== 'undefined' ? __API_BASE_URL__ : '') || (typeof process !== 'undefined' && process.env && process.env.NEXT_PUBLIC_API_BASE_URL) || '';

  window.__WARMPAWZ_RUNTIME_CONFIG__ = {
    apiBaseUrl: apiBaseUrl,
    uatMode: defaultUatMode
  };

  console.log('🔧 Runtime config loaded:', window.__WARMPAWZ_RUNTIME_CONFIG__);
})();

