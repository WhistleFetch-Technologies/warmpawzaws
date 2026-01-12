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
  
  // Rewrite /ecommerce to /ecommerce.html, /catalog to /catalog.html, etc.
  // This handles Next.js static export routing
  request.uri = uri + '.html';
  
  return request;
}

