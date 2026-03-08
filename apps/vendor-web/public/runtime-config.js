// Runtime Configuration for Warmpawz vendor-web (Production Deployment)
// Injected at deployment time with production API Gateway endpoint
(function() {
  window.__WARMPAWZ_RUNTIME_CONFIG__ = {
    apiBaseUrl: 'https://mss9sa4y01.execute-api.ap-south-1.amazonaws.com',
    uatMode: false,
    environment: 'production'
  };
  console.log('ðŸ”§ Runtime config loaded:', window.__WARMPAWZ_RUNTIME_CONFIG__);
})();