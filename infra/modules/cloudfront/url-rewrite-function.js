// CloudFront Function: URL Rewrite for Next.js Static Export
// Rewrites /ecommerce to /ecommerce.html, /catalog to /catalog.html, etc.
// Also handles dynamic routes by mapping to pre-built placeholder pages.

function handler(event) {
  var request = event.request;
  var uri = request.uri;
  
  // Skip if URI already has an extension (e.g., .html, .js, .css, .png)
  if (uri.match(/\.[a-zA-Z0-9]+$/)) {
    return request;
  }
  
  // Skip root path
  if (uri === '/') {
    return request;
  }
  
  // Skip if URI ends with a slash (directory)
  if (uri.endsWith('/')) {
    return request;
  }
  
  // Skip API paths and special paths
  if (uri.startsWith('/api/') || 
      uri.startsWith('/_next/') || 
      uri.startsWith('/static/') ||
      uri.startsWith('/runtime-config.js') ||
      uri.startsWith('/favicon.ico') ||
      uri.match(/\.(js|css|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot|json)$/i)) {
    return request;
  }
  
  // ✅ CRITICAL FIX: Handle dynamic routes for Next.js static export
  // These routes use [param] segments that are pre-built as /placeholder.html
  // Pattern: /tracking/<bookingId> → /tracking/placeholder.html
  // The client-side component extracts the actual ID from window.location.pathname
  var dynamicRoutes = [
    { pattern: /^\/tracking\/[^/]+$/, rewrite: '/tracking/placeholder.html' },
    { pattern: /^\/video\/[^/]+.*$/, rewrite: '/video/placeholder.html' },
    { pattern: /^\/booking\/[^/]+$/, rewrite: '/booking/placeholder.html' },
    { pattern: /^\/orders\/[^/]+\/tracking$/, rewrite: '/orders/placeholder/tracking.html' },
  ];
  
  for (var i = 0; i < dynamicRoutes.length; i++) {
    if (uri.match(dynamicRoutes[i].pattern)) {
      request.uri = dynamicRoutes[i].rewrite;
      return request;
    }
  }
  
  // Rewrite /ecommerce to /ecommerce.html, /catalog to /catalog.html, etc.
  // This handles Next.js static export routing for static pages
  request.uri = uri + '.html';
  
  return request;
}

