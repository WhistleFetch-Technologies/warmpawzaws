// Runtime Configuration for Warmpawz Vendor Portal
// apiBaseUrl: Injected at deploy from config/urls.json or CDK outputs (see scripts/deploy-vendor-web.sh). No hardcoded URLs in repo.
// For local dev set NEXT_PUBLIC_API_BASE_URL in .env.local. App URLs: config/urls.json .cloudfront (admin / vendor / customer)

(function () {
  const envApiBaseUrl = typeof process !== 'undefined' ? process.env?.NEXT_PUBLIC_API_BASE_URL : '';
  const defaultApiBaseUrl = 'https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com';
  const defaultUatMode = true;

  window.__WARMPAWZ_RUNTIME_CONFIG__ = {
    apiBaseUrl: envApiBaseUrl || defaultApiBaseUrl,
    uatMode: defaultUatMode
  };

  console.log('🔧 Runtime config loaded:', window.__WARMPAWZ_RUNTIME_CONFIG__);
})();

