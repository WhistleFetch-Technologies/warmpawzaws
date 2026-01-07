// Runtime Configuration for Warmpawz Admin Portal
// This file is loaded at runtime and provides API configuration
// For local development, this can be overridden by NEXT_PUBLIC_API_BASE_URL env var

(function() {
  // Default to dev API Gateway for development
  // In production, this will be replaced during deployment
  // Note: process.env is not available in browser context, so we use a default
  const defaultApiBaseUrl = 'https://dev.api.warmpawz.com';
  const defaultUatMode = true; // Enable UAT mode for local development

  window.__WARMPAWZ_RUNTIME_CONFIG__ = {
    apiBaseUrl: defaultApiBaseUrl,
    uatMode: defaultUatMode
  };

  console.log('🔧 Runtime config loaded:', window.__WARMPAWZ_RUNTIME_CONFIG__);
})();

