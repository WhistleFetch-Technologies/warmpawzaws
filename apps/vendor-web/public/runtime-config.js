// Runtime Configuration for Warmpawz Vendor Portal
// apiBaseUrl: Set at deploy-time via deployment script, falls back to API Gateway URL
// Official Vendor app URL: set VENDOR_URL / see config/urls.json cloudfront.vendor

(function () {
  const defaultUatMode = true;
  // ✅ FIX: Default to API Gateway URL if not set during deployment
  const defaultApiBaseUrl = 'https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com';
  const apiBaseUrl = (typeof __API_BASE_URL__ !== 'undefined' ? __API_BASE_URL__ : '') || 
                     (typeof process !== 'undefined' && process.env && process.env.NEXT_PUBLIC_API_BASE_URL) || 
                     defaultApiBaseUrl;

  window.__WARMPAWZ_RUNTIME_CONFIG__ = {
    apiBaseUrl: apiBaseUrl,
    uatMode: defaultUatMode
  };

  console.log('🔧 Runtime config loaded:', window.__WARMPAWZ_RUNTIME_CONFIG__);
})();

