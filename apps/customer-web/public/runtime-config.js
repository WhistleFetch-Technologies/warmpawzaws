/**
 * Runtime Configuration for Warmpawz customer-web
 *
 * Loaded after layout.tsx inline config. Must NOT clobber a valid dev/prod config
 * from the build with stale gateway URLs (e.g. retired iixwc3fzfl).
 */
(function () {
  'use strict';

  var DEV_API = 'https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com';
  var PROD_API = 'https://mss9sa4y01.execute-api.ap-south-1.amazonaws.com';

  var FIREBASE = {
    firebaseApiKey: 'AIzaSyBeLXF4iovrl6J4NaWmwlgkj9hiAHRW4Zs',
    firebaseAuthDomain: 'warmpawz-b9baf.firebaseapp.com',
    firebaseProjectId: 'warmpawz-b9baf',
    firebaseStorageBucket: 'warmpawz-b9baf.firebasestorage.app',
    firebaseMessagingSenderId: '771876271254',
    firebaseAppId: '1:771876271254:web:3191a5c001b269f2f1beb7',
    firebaseMeasurementId: 'G-PYF54Y34BP',
  };

  function normalizeApiUrl(url) {
    if (!url || typeof url !== 'string') return '';
    var t = url.trim().replace(/\/+$/, '');
    if (t.indexOf('iixwc3fzfl') >= 0) return DEV_API;
    return t;
  }

  function mergeConfig(base) {
    var existing = window.__WARMPAWZ_RUNTIME_CONFIG__ || {};
    var merged = {};
    var key;
    for (key in existing) {
      if (Object.prototype.hasOwnProperty.call(existing, key)) merged[key] = existing[key];
    }
    for (key in base) {
      if (Object.prototype.hasOwnProperty.call(base, key)) merged[key] = base[key];
    }
    for (key in FIREBASE) {
      if (!merged[key]) merged[key] = FIREBASE[key];
    }
    merged.apiBaseUrl = normalizeApiUrl(merged.apiBaseUrl || base.apiBaseUrl || DEV_API);
    window.__WARMPAWZ_RUNTIME_CONFIG__ = merged;
  }

  var isLocalhost =
    typeof window !== 'undefined' &&
    (window.location.hostname === 'localhost' ||
      window.location.hostname === '127.0.0.1' ||
      window.location.hostname.indexOf('localhost') !== -1);

  if (isLocalhost) {
    mergeConfig({
      uatMode: true,
      environment: 'development',
      customerEcommerceEnabled: false,
    });
    console.log('🔧 Runtime config (localhost merge):', window.__WARMPAWZ_RUNTIME_CONFIG__);
    return;
  }

  var host =
    typeof window !== 'undefined' && window.location && window.location.hostname
      ? window.location.hostname
      : '';

  var existing = window.__WARMPAWZ_RUNTIME_CONFIG__ || {};
  var existingApi = normalizeApiUrl(existing.apiBaseUrl || '');

  // layout.tsx already injected a valid build-time config — only add missing firebase keys.
  if (
    existing.environment === 'development' &&
    existingApi.indexOf('z0b3obweb6') >= 0
  ) {
    mergeConfig({
      apiBaseUrl: existingApi,
      uatMode: existing.uatMode !== false,
      environment: 'development',
    });
    console.log('🔧 Runtime config (preserved layout dev):', window.__WARMPAWZ_RUNTIME_CONFIG__);
    return;
  }

  if (existing.environment === 'production' && normalizeApiUrl(existing.apiBaseUrl).indexOf('mss9sa4y01') >= 0) {
    mergeConfig({
      apiBaseUrl: PROD_API,
      uatMode: false,
      environment: 'production',
      customerEcommerceEnabled: existing.customerEcommerceEnabled === true,
    });
    console.log('🔧 Runtime config (preserved layout prod):', window.__WARMPAWZ_RUNTIME_CONFIG__);
    return;
  }

  var devHosts = {
    'dev.customer.warmpawz.com': true,
    'd2aoyjj8ine0wk.cloudfront.net': true,
  };

  if (devHosts[host]) {
    mergeConfig({
      apiBaseUrl: DEV_API,
      uatMode: true,
      environment: 'development',
      customerEcommerceEnabled: false,
    });
    console.log('🔧 Runtime config (dev host):', window.__WARMPAWZ_RUNTIME_CONFIG__);
    return;
  }

  mergeConfig({
    apiBaseUrl: PROD_API,
    uatMode: false,
    environment: 'production',
    customerEcommerceEnabled: false,
  });
  console.log('🔧 Runtime config (prod fallback):', window.__WARMPAWZ_RUNTIME_CONFIG__);
})();
