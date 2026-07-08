/**
 * Runtime Configuration for Warmpawz customer-web
 *
 * This file is loaded at runtime and provides API configuration.
 *
 * IMPORTANT: When running locally (localhost), this file should NOT set apiBaseUrl
 * to allow NEXT_PUBLIC_API_BASE_URL environment variable to take precedence.
 *
 * For deployed environments (CloudFront), this file is replaced at deploy-time
 * with the correct API Gateway endpoint for that environment.
 */
(function() {
  'use strict';

  function mergeRuntimeConfig(patch) {
    window.__WARMPAWZ_RUNTIME_CONFIG__ = Object.assign(
      window.__WARMPAWZ_RUNTIME_CONFIG__ || {},
      patch
    );
  }

  // Detect if running on localhost (local development)
  const isLocalhost = typeof window !== 'undefined' &&
    (window.location.hostname === 'localhost' ||
     window.location.hostname === '127.0.0.1' ||
     window.location.hostname.includes('localhost'));

  // LOCAL DEVELOPMENT: Don't set apiBaseUrl - let environment variable take precedence
  if (isLocalhost) {
    mergeRuntimeConfig({
      uatMode: true,
      environment: 'development',
      customerEcommerceEnabled: true
    });
    console.log('🔧 Runtime config loaded (localhost - using env var for API URL):', window.__WARMPAWZ_RUNTIME_CONFIG__);
    return;
  }

  // DEPLOYED ENVIRONMENT: Choose endpoint based on hostname
  function normalizeLegacyDevApiUrl(u) {
    if (!u || typeof u !== 'string') return u;
    var t = u.trim().replace(/\/+$/, '');
    return t.indexOf('iixwc3fzfl') >= 0 ? 'https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com' : t;
  }

  const host = (typeof window !== 'undefined' && window.location && window.location.hostname) ? window.location.hostname : '';
  const configByHost = {
    'dev.customer.warmpawz.com': {
      apiBaseUrl: 'https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com',
      uatMode: true,
      environment: 'development',
      customerEcommerceEnabled: true
    },
  };

  const mapped = configByHost[host];
  if (mapped) {
    mergeRuntimeConfig({
      apiBaseUrl: normalizeLegacyDevApiUrl(mapped.apiBaseUrl),
      uatMode: mapped.uatMode,
      environment: mapped.environment,
      customerEcommerceEnabled: mapped.customerEcommerceEnabled !== false
    });
  } else {
    // Production customer web — shop off unless deploy explicitly sets customerEcommerceEnabled: true
    mergeRuntimeConfig({
      apiBaseUrl: normalizeLegacyDevApiUrl('https://mss9sa4y01.execute-api.ap-south-1.amazonaws.com'),
      uatMode: false,
      environment: 'production',
      customerEcommerceEnabled: false
    });
  }
  console.log('🔧 Runtime config loaded (deployed):', window.__WARMPAWZ_RUNTIME_CONFIG__);
})();
