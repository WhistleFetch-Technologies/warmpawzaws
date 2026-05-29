/**
 * Patches api-client get() to log unique GET URLs to window.__homeGetLog.
 * Load in browser console after home reload, then: copy(JSON.stringify(window.__homeGetLog))
 */
export const INSTRUMENT_SNIPPET = `
(function(){
  if (window.__homeGetPatched) return;
  window.__homeGetPatched = true;
  window.__homeGetLog = [];
  const origFetch = window.fetch;
  window.fetch = function(input, init) {
    const url = typeof input === 'string' ? input : input.url;
    const method = (init && init.method) || 'GET';
    if (method.toUpperCase() === 'GET' && /customer\\/profile|customer\\/pets|execute-api/.test(url)) {
      window.__homeGetLog.push({ url, t: Date.now() });
    }
    return origFetch.apply(this, arguments);
  };
  console.log('[instrument] GET logger active');
})();
`;
