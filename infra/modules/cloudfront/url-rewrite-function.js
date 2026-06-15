// CloudFront Function: URL Rewrite for Next.js Static Export
// Rewrites /ecommerce to /ecommerce.html, /catalog to /catalog.html, etc.
// This allows Next.js static export files to be served correctly

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
  
  // ✅ CRITICAL FIX: Handle dynamic Next.js routes BEFORE generic .html rewrite
  // These routes have [param] segments that don't have pre-generated HTML files.
  // They all use a single placeholder.html that the client-side JS hydrates.
  var dynamicRoutes = [
    { pattern: /^\/tracking\/[^/]+$/, rewrite: '/tracking/placeholder.html' },
    { pattern: /^\/video\/[^/]+.*$/, rewrite: '/video/placeholder.html' },
    { pattern: /^\/booking\/[^/]+$/, rewrite: '/booking/placeholder.html' },
    { pattern: /^\/orders\/[^/]+\/tracking$/, rewrite: '/orders/placeholder/tracking.html' },
    // Next static export only emits pet-boarding/vendor/placeholder.html; real IDs hydrate client-side.
    { pattern: /^\/pet-boarding\/vendor\/[^/]+$/, rewrite: '/pet-boarding/vendor/placeholder.html' },
    // Vendor profile share deep links — /vendor/[uuid] → placeholder shell (client reads real id from URL).
    { pattern: /^\/vendor\/[^/]+$/, rewrite: '/vendor/placeholder.html' },
    // Banner persona vendor links — /vet/Clinic Name?vendorId=…
    { pattern: /^\/vet\/[^/]+$/, rewrite: '/vet/placeholder.html' },
    { pattern: /^\/grooming\/[^/]+$/, rewrite: '/grooming/placeholder.html' },
    { pattern: /^\/training\/[^/]+$/, rewrite: '/training/placeholder.html' },
    { pattern: /^\/boarding\/[^/]+$/, rewrite: '/boarding/placeholder.html' },
    { pattern: /^\/walker\/[^/]+$/, rewrite: '/walker/placeholder.html' },
    { pattern: /^\/nutritionist\/[^/]+$/, rewrite: '/nutritionist/placeholder.html' },
    // Shop product detail — static export only builds /shop/placeholder; real ids hydrate client-side.
    { pattern: /^\/shop\/[^/]+$/, rewrite: '/shop/placeholder.html' },
    // Referral invite links — /invite/WARM… → placeholder shell (client reads code from URL).
    { pattern: /^\/invite\/[^/]+$/, rewrite: '/invite/placeholder.html' },
  ];

  for (var i = 0; i < dynamicRoutes.length; i++) {
    if (uri.match(dynamicRoutes[i].pattern)) {
      request.uri = dynamicRoutes[i].rewrite;
      return request;
    }
  }

  // Rewrite /ecommerce to /ecommerce.html, /catalog to /catalog.html, etc.
  // This handles Next.js static export routing for known static pages
  request.uri = uri + '.html';
  
  return request;
}

