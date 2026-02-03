// Runtime Configuration for Warmpawz customer-web
// Injected at deployment - API base is API Gateway (backend), not CloudFront
(function() {
  window.__WARMPAWZ_RUNTIME_CONFIG__ = {
    apiBaseUrl: "https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com",
    uatMode: true
  };
  console.log('🔧 Runtime config loaded:', window.__WARMPAWZ_RUNTIME_CONFIG__);
})();
