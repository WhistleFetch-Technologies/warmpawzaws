// Runtime Configuration for Warmpawz Admin Portal

(function () {
  const defaultUatMode = true;

  /** Vendor-web origin for “Open vendor portal” — must not rely on NEXT_PUBLIC (often localhost in builds). */
  function vendorWebUrlForHost(hostname) {
    if (!hostname || hostname === 'localhost' || hostname === '127.0.0.1' || hostname.indexOf('localhost') !== -1) {
      return undefined;
    }
    if (hostname === 'dev.admin.warmpawz.com' || hostname === 'dfof7mguaa0a5.cloudfront.net') {
      return 'https://dev.vendor.warmpawz.com';
    }
    if (
      hostname === 'admin.warmpawz.com' ||
      hostname === 'dbr09zyoq9akb.cloudfront.net' ||
      hostname === 'd1y5ywletev82x.cloudfront.net' ||
      hostname === 'dg69gqp2frh39.cloudfront.net'
    ) {
      return 'https://vendor.warmpawz.com';
    }
    return undefined;
  }

  function normalizeLegacyDevApiUrl(u) {
    if (!u || typeof u !== 'string') return u;
    var t = u.trim().replace(/\/+$/, '');
    return t.indexOf('iixwc3fzfl') >= 0 ? 'https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com' : t;
  }

  // If config is already set (e.g., by layout.tsx for production mode), preserve it
  if (window.__WARMPAWZ_RUNTIME_CONFIG__ && window.__WARMPAWZ_RUNTIME_CONFIG__.apiBaseUrl) {
    var preHost = window.location && window.location.hostname ? window.location.hostname : '';
    var preVw = vendorWebUrlForHost(preHost);
    if (preVw) {
      window.__WARMPAWZ_RUNTIME_CONFIG__.vendorWebUrl = preVw;
    }
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

  const vendorWebUrl = vendorWebUrlForHost(hostname);

  window.__WARMPAWZ_RUNTIME_CONFIG__ = {
    apiBaseUrl: apiBaseUrl,
    uatMode: uatMode,
    environment: environment,
    ...(vendorWebUrl ? { vendorWebUrl: vendorWebUrl } : {})
  };

  console.log('🔧 Runtime config loaded:', window.__WARMPAWZ_RUNTIME_CONFIG__);
})();

// Re-apply vendor URL after main block (in case another script replaced __WARMPAWZ_RUNTIME_CONFIG__ without vendorWebUrl)
(function () {
  try {
    var h = typeof window !== 'undefined' && window.location ? window.location.hostname : '';
    var vw;
    if (h === 'dev.admin.warmpawz.com' || h === 'dfof7mguaa0a5.cloudfront.net') {
      vw = 'https://dev.vendor.warmpawz.com';
    } else if (
      h === 'admin.warmpawz.com' ||
      h === 'dbr09zyoq9akb.cloudfront.net' ||
      h === 'd1y5ywletev82x.cloudfront.net' ||
      h === 'dg69gqp2frh39.cloudfront.net'
    ) {
      vw = 'https://vendor.warmpawz.com';
    }
    if (!vw || !window.__WARMPAWZ_RUNTIME_CONFIG__) return;
    window.__WARMPAWZ_RUNTIME_CONFIG__.vendorWebUrl = vw;
  } catch (e) {}
})();
