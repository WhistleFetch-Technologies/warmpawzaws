// Runtime Configuration for Warmpawz Admin Portal

(function () {
  const defaultUatMode = true;

  function normalizeLegacyDevApiUrl(u) {
    if (!u || typeof u !== 'string') return u;
    var t = u.trim().replace(/\/+$/, '');
    return t.indexOf('iixwc3fzfl') >= 0 ? 'https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com' : t;
  }

  // If config is already set (e.g., by layout.tsx for production mode), preserve it
  if (window.__WARMPAWZ_RUNTIME_CONFIG__ && window.__WARMPAWZ_RUNTIME_CONFIG__.apiBaseUrl) {
    // ✅ FIX: If NEXT_PUBLIC_API_BASE_URL is set (local dev), use it instead
    if (typeof window !== 'undefined' && window.__NEXT_PUBLIC_API_BASE_URL__) {
      window.__WARMPAWZ_RUNTIME_CONFIG__.apiBaseUrl = normalizeLegacyDevApiUrl(window.__NEXT_PUBLIC_API_BASE_URL__);
      console.log('🔧 Runtime config loaded (local dev - using NEXT_PUBLIC_API_BASE_URL):', window.__WARMPAWZ_RUNTIME_CONFIG__);
      return;
    }
    // If production mode flag is set, FORCE uatMode to false and prod API gateway
    if (window.__WARMPAWZ_PROD_MODE__) {
      window.__WARMPAWZ_RUNTIME_CONFIG__.uatMode = false;
      window.__WARMPAWZ_RUNTIME_CONFIG__.environment = 'production';
      window.__WARMPAWZ_RUNTIME_CONFIG__.apiBaseUrl = 'https://mss9sa4y01.execute-api.ap-south-1.amazonaws.com';
      console.log('🔧 Runtime config loaded (PROD - locked):', window.__WARMPAWZ_RUNTIME_CONFIG__);
    } else {
      console.log('🔧 Runtime config loaded (pre-configured):', window.__WARMPAWZ_RUNTIME_CONFIG__);
    }
    return;
  }

  // Determine environment based on hostname
  function isProduction() {
    if (typeof window !== 'undefined' && window.location) {
      const hostname = window.location.hostname;

      // Production domains (exact match, not dev subdomains)
      if (hostname === 'admin.warmpawz.com' ||
          hostname === 'vendor.warmpawz.com' ||
          hostname === 'customer.warmpawz.com' ||
          hostname === 'warmpawz.com' ||
          hostname === 'www.warmpawz.com') {
        return true;
      }

      // Dev admin CloudFront (alternate domain maps here) — not production API
      if (hostname === 'dfof7mguaa0a5.cloudfront.net') {
        return false;
      }

      if (hostname.includes('cloudfront.net')) {
        return true;
      }

      // Dev subdomains
      if (hostname.startsWith('dev.') && hostname.includes('warmpawz.com')) {
        return false;
      }

      // Localhost
      if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname.includes('localhost')) {
        return false;
      }
    }
    return true;
  }

  // Get API Gateway URL based on environment
  function getApiGatewayUrl() {
    return isProduction()
      ? 'https://mss9sa4y01.execute-api.ap-south-1.amazonaws.com'
      : 'https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com';
  }

  // ✅ Host mapping: force specific API by hostname when deployed
  const host = (typeof window !== 'undefined' && window.location && window.location.hostname) ? window.location.hostname : '';
  const mappedByHost = {
    'dev.admin.warmpawz.com': 'https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com',
  };
  // Priority: host mapping → window.__NEXT_PUBLIC_API_BASE_URL__ → __API_BASE_URL__ → getApiGatewayUrl()
  const apiBaseUrl = normalizeLegacyDevApiUrl(
    mappedByHost[host] ||
      (typeof window !== 'undefined' && window.__NEXT_PUBLIC_API_BASE_URL__) ||
      (typeof __API_BASE_URL__ !== 'undefined' ? __API_BASE_URL__ : '') ||
      getApiGatewayUrl()
  );

  const hostname = typeof window !== 'undefined' && window.location ? window.location.hostname : '';
  const isDevSubdomain = hostname.startsWith('dev.') && hostname.includes('warmpawz.com');
  const isDevAdminCf = hostname === 'dfof7mguaa0a5.cloudfront.net';
  const isProdHostname =
    hostname === 'admin.warmpawz.com' ||
    hostname === 'vendor.warmpawz.com' ||
    hostname === 'customer.warmpawz.com' ||
    hostname === 'warmpawz.com' ||
    hostname === 'www.warmpawz.com' ||
    (hostname.includes('cloudfront.net') && !isDevAdminCf);

  const environment = (isProdHostname && !isDevSubdomain) ? 'production' : 'development';

  // UAT mode: true for dev/local, false for production
  const uatMode = (isProdHostname && !isDevSubdomain) ? false : defaultUatMode;

  window.__WARMPAWZ_RUNTIME_CONFIG__ = {
    apiBaseUrl: apiBaseUrl,
    uatMode: uatMode,
    environment: environment
  };

  console.log('🔧 Runtime config loaded:', window.__WARMPAWZ_RUNTIME_CONFIG__);
})();
