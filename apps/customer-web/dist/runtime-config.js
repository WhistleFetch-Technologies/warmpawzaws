// Runtime Configuration for Warmpawz Customer Portal
// apiBaseUrl: injected at deploy; fallback for CloudFront (avoids ERR_CONNECTION_REFUSED)

(function () {
  const defaultApiBaseUrl = '';
  const fallbackApiUrl = 'https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com';
  const defaultUatMode = true;

  window.__WARMPAWZ_RUNTIME_CONFIG__ = {
    apiBaseUrl: defaultApiBaseUrl || fallbackApiUrl,
    uatMode: defaultUatMode
  };

  console.log('🔧 Runtime config loaded:', window.__WARMPAWZ_RUNTIME_CONFIG__);
})();

