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
  
  // Detect if running on localhost (local development)
  const isLocalhost = typeof window !== 'undefined' && 
    (window.location.hostname === 'localhost' || 
     window.location.hostname === '127.0.0.1' ||
     window.location.hostname.includes('localhost'));
  
  // Check if production config was already set by layout.tsx (when NEXT_PUBLIC_ENVIRONMENT=production)
  // This happens when running prod:customer, prod:vendor, prod:admin locally
  const existingConfig = window.__WARMPAWZ_RUNTIME_CONFIG__;
  if (existingConfig && existingConfig.environment === 'production') {
    console.log('🔧 Runtime config: Production config already set by layout.tsx, keeping it:', existingConfig);
    return;
  }
  
  // LOCAL DEVELOPMENT: Don't set apiBaseUrl - let environment variable take precedence
  // The getApiBaseUrl() function in api-client.ts will use NEXT_PUBLIC_API_BASE_URL
  if (isLocalhost) {
    window.__WARMPAWZ_RUNTIME_CONFIG__ = {
      // Intentionally NOT setting apiBaseUrl - use NEXT_PUBLIC_API_BASE_URL from .env.local
      uatMode: true,
      environment: 'development',
      customerEcommerceEnabled: false,
      firebaseApiKey:            "AIzaSyBeLXF4iovrl6J4NaWmwlgkj9hiAHRW4Zs",
      firebaseAuthDomain:        "warmpawz-b9baf.firebaseapp.com",
      firebaseProjectId:         "warmpawz-b9baf",
      firebaseStorageBucket:     "warmpawz-b9baf.firebasestorage.app",
      firebaseMessagingSenderId: "771876271254",
      firebaseAppId:             "1:771876271254:web:3191a5c001b269f2f1beb7",
      firebaseMeasurementId:     "G-PYF54Y34BP"
    };
    console.log('🔧 Runtime config loaded (localhost - using env var for API URL):', window.__WARMPAWZ_RUNTIME_CONFIG__);
    return;
  }
  
  // DEPLOYED ENVIRONMENT: Choose endpoint based on hostname
  // Default remains production, but specific dev/stage hostnames are mapped here.
  function normalizeLegacyDevApiUrl(u) {
    if (!u || typeof u !== 'string') return u;
    var t = u.trim().replace(/\/+$/, '');
    return t.indexOf('iixwc3fzfl') >= 0 ? 'https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com' : t;
  }

  const host = (typeof window !== 'undefined' && window.location && window.location.hostname) ? window.location.hostname : '';
  const configByHost = {
    // Dev customer web
    'dev.customer.warmpawz.com': {
      apiBaseUrl: 'https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com',
      uatMode: true,
      environment: 'development',
      customerEcommerceEnabled: false
    },
    // You can extend mappings here if needed, e.g. stage.customer.warmpawz.com
  };
  
  const mapped = configByHost[host];
  if (mapped) {
    window.__WARMPAWZ_RUNTIME_CONFIG__ = {
      apiBaseUrl: normalizeLegacyDevApiUrl(mapped.apiBaseUrl),
      uatMode: mapped.uatMode,
      environment: mapped.environment,
      customerEcommerceEnabled: mapped.customerEcommerceEnabled !== false,
      firebaseApiKey:            "AIzaSyBeLXF4iovrl6J4NaWmwlgkj9hiAHRW4Zs",
      firebaseAuthDomain:        "warmpawz-b9baf.firebaseapp.com",
      firebaseProjectId:         "warmpawz-b9baf",
      firebaseStorageBucket:     "warmpawz-b9baf.firebasestorage.app",
      firebaseMessagingSenderId: "771876271254",
      firebaseAppId:             "1:771876271254:web:3191a5c001b269f2f1beb7",
      firebaseMeasurementId:     "G-PYF54Y34BP"
    };
  } else {
    // Fallback to production
    window.__WARMPAWZ_RUNTIME_CONFIG__ = {
      apiBaseUrl: normalizeLegacyDevApiUrl('https://mss9sa4y01.execute-api.ap-south-1.amazonaws.com'),
      uatMode: false,
      environment: 'production',
      customerEcommerceEnabled: false,
      firebaseApiKey:            "AIzaSyBeLXF4iovrl6J4NaWmwlgkj9hiAHRW4Zs",
      firebaseAuthDomain:        "warmpawz-b9baf.firebaseapp.com",
      firebaseProjectId:         "warmpawz-b9baf",
      firebaseStorageBucket:     "warmpawz-b9baf.firebasestorage.app",
      firebaseMessagingSenderId: "771876271254",
      firebaseAppId:             "1:771876271254:web:3191a5c001b269f2f1beb7",
      firebaseMeasurementId:     "G-PYF54Y34BP"
    };
  }
  console.log('🔧 Runtime config loaded (deployed):', window.__WARMPAWZ_RUNTIME_CONFIG__);
})();