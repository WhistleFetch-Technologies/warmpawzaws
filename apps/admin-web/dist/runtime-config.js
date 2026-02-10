// Runtime Configuration for Warmpawz admin-web (PRODUCTION)
// Injected at deployment - API base is API Gateway (backend), not CloudFront
(function() {
  window.__WARMPAWZ_RUNTIME_CONFIG__ = {
    apiBaseUrl: "https://mss9sa4y01.execute-api.ap-south-1.amazonaws.com",
    uatMode: false,
    environment: "production"
  };
  console.log('🔧 Runtime config loaded (PROD):', window.__WARMPAWZ_RUNTIME_CONFIG__);
})();
