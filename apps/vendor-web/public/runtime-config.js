
(function () {
  const defaultUatMode = true;

  if (window.__WARMPAWZ_RUNTIME_CONFIG__ && window.__WARMPAWZ_RUNTIME_CONFIG__.apiBaseUrl) {
    if (typeof window !== 'undefined' && window.__NEXT_PUBLIC_API_BASE_URL__) {
      window.__WARMPAWZ_RUNTIME_CONFIG__.apiBaseUrl = window.__NEXT_PUBLIC_API_BASE_URL__;
      console.log('🔧 Runtime config loaded (local dev - using NEXT_PUBLIC_API_BASE_URL):', window.__WARMPAWZ_RUNTIME_CONFIG__);
      return;
    }
    console.log('🔧 Runtime config loaded (pre-configured):', window.__WARMPAWZ_RUNTIME_CONFIG__);
    return;
  }

  function isProduction() {
    if (typeof window !== 'undefined' && window.location) {
      const hostname = window.location.hostname;

      if (hostname === 'vendor.warmpawz.com' ||
        hostname === 'admin.warmpawz.com' ||
        hostname === 'customer.warmpawz.com' ||
        hostname === 'warmpawz.com' ||
        hostname === 'www.warmpawz.com' ||
        hostname.includes('cloudfront.net')) {
        return true;
      }

      if (hostname.startsWith('dev.') && hostname.includes('warmpawz.com')) {
        return false;
      }

      if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname.includes('localhost')) {
        return false;
      }
    }
    return true;
  }

  function getApiGatewayUrl() {
    return isProduction()
      ? 'https://mss9sa4y01.execute-api.ap-south-1.amazonaws.com'
      : 'https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com';
  }

  const apiBaseUrl = (typeof window !== 'undefined' && window.__NEXT_PUBLIC_API_BASE_URL__) ||
    (typeof __API_BASE_URL__ !== 'undefined' ? __API_BASE_URL__ : '') ||
    getApiGatewayUrl();

  const hostname = typeof window !== 'undefined' && window.location ? window.location.hostname : '';
  const isDevSubdomain = hostname.startsWith('dev.') && hostname.includes('warmpawz.com');
  const isProdHostname = hostname === 'vendor.warmpawz.com' ||
    hostname === 'admin.warmpawz.com' ||
    hostname === 'customer.warmpawz.com' ||
    hostname === 'warmpawz.com' ||
    hostname === 'www.warmpawz.com' ||
    hostname.includes('cloudfront.net');

  const environment = (isProdHostname && !isDevSubdomain) ? 'production' : 'development';


  const uatMode = (isProdHostname && !isDevSubdomain) ? false : defaultUatMode;

  window.__WARMPAWZ_RUNTIME_CONFIG__ = {
    apiBaseUrl: apiBaseUrl,
    uatMode: uatMode,
    environment: environment
  };

  console.log('🔧 Runtime config loaded:', window.__WARMPAWZ_RUNTIME_CONFIG__);
})();

