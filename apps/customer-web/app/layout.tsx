import type { Metadata, Viewport } from 'next';
import './globals.css';
import { Providers } from './providers';

export const metadata: Metadata = {
  title: 'Warmpawz - Pet Care Services',
  description: 'Find and book pet care services near you',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Warmpawz',
  },
};

/** Lets env(safe-area-inset-*) apply under notch / home indicator in PWA / standalone WebViews. */
export const viewport: Viewport = {
  viewportFit: 'cover',
  themeColor: '#FF8C42',
};

/** Must stay in sync with `lib/api-client.ts` `getApiGatewayUrl()` — analytics + REST use the same gateways. */
const WARMPAWZ_API_GATEWAY_PROD = 'https://mss9sa4y01.execute-api.ap-south-1.amazonaws.com';
const WARMPAWZ_API_GATEWAY_DEV = 'https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Inject production config if NEXT_PUBLIC_ENVIRONMENT is production
  const isProd = process.env.NEXT_PUBLIC_ENVIRONMENT === 'production';
  /** When env is unset: prod builds → prod gateway; non-prod → dev gateway (never default prod to dev). */
  const prodApiUrl =
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    (isProd ? WARMPAWZ_API_GATEWAY_PROD : WARMPAWZ_API_GATEWAY_DEV);
  const customerMealPlansEnabledRaw = (
    process.env.NEXT_PUBLIC_CUSTOMER_MEAL_PLANS_ENABLED ?? 'true'
  ).toLowerCase();
  const customerMealPlansEnabled =
    customerMealPlansEnabledRaw === 'true' || customerMealPlansEnabledRaw === '1';
  const customerEcommerceEnabledRaw = (
    process.env.NEXT_PUBLIC_CUSTOMER_ECOMMERCE_ENABLED ?? 'true'
  ).toLowerCase();
  const customerEcommerceEnabled =
    customerEcommerceEnabledRaw === 'true' || customerEcommerceEnabledRaw === '1';

  return (
    <html lang="en">
      <head>
        {/* Baloo 2 font via stylesheet to avoid build-time fetches */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Baloo+2:wght@400;500;600;700;800&display=swap"
          media="print"
          id="baloo-font-link"
        />
        {/* Preconnect to Google Fonts for Material Symbols (non-blocking) */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* Material Symbols loaded with font-display: swap for non-blocking */}
        <link 
          rel="stylesheet" 
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Rounded:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=swap"
          media="print"
          id="material-symbols-link"
        />
        {/* Script to change media from print to all after fonts load (non-blocking CSS trick) */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                function setMediaToAll() {
                  const balooLink = document.getElementById('baloo-font-link');
                  const materialLink = document.getElementById('material-symbols-link');
                  if (balooLink) balooLink.media = 'all';
                  if (materialLink) materialLink.media = 'all';
                }
                if (document.readyState === 'loading') {
                  document.addEventListener('DOMContentLoaded', setMediaToAll);
                } else {
                  setMediaToAll();
                }
              })();
            `,
          }}
        />
      </head>
      <body>
        {/* 
          Inject NEXT_PUBLIC_API_BASE_URL for ALL environments (local dev + production).
          
          For local development (npm run local:customer):
          - Sets window.__NEXT_PUBLIC_API_BASE_URL__ = "http://localhost:3000"
          - runtime-config.js detects localhost and doesn't override this
          
          For production (npm run prod:customer):
          - Sets window.__NEXT_PUBLIC_API_BASE_URL__ = production API Gateway
          - Also sets production runtime config below
        */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
                window.__NEXT_PUBLIC_API_BASE_URL__ = ${JSON.stringify(prodApiUrl)};
              `,
          }}
        />
        {/* 
          Inject production runtime config ONLY when NEXT_PUBLIC_ENVIRONMENT=production.
          This ensures prod:customer, prod:vendor, prod:admin use production API Gateway.
        */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
                window.__WARMPAWZ_RUNTIME_CONFIG__ = {
                  apiBaseUrl: ${JSON.stringify(prodApiUrl)},
                  environment: ${JSON.stringify(isProd ? 'production' : 'development')},
                  uatMode: ${JSON.stringify(!isProd)},
                  customerMealPlansEnabled: ${JSON.stringify(customerMealPlansEnabled)},
                  customerEcommerceEnabled: ${JSON.stringify(customerEcommerceEnabled)}
                };
              `,
          }}
        />
        {/* 
          Runtime config injected at deploy-time (static hosting safe).
          For localhost, this file detects localhost and doesn't set apiBaseUrl,
          allowing the environment variable above to take precedence.
        */}
        <script src="/runtime-config.js" />
        {/* Redirect legacy /vendor/{uuid} paths before React (static export only ships placeholder HTML). */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var path = location.pathname.replace(/\\/+$/, '') || '/';
                  var qs = new URLSearchParams(location.search);
                  if (qs.get('vendorId') || qs.get('vendor_id')) return;
                  var vendorMatch = path.match(/^\\/vendor\\/([^/]+)$/);
                  if (vendorMatch && vendorMatch[1] !== 'placeholder' && vendorMatch[1] !== '_') {
                    qs.set('vendorId', decodeURIComponent(vendorMatch[1]));
                    location.replace('/vendor/placeholder?' + qs.toString());
                    return;
                  }
                  var boardingMatch = path.match(/^\\/pet-boarding\\/vendor\\/([^/]+)$/);
                  if (boardingMatch && boardingMatch[1] !== 'placeholder' && boardingMatch[1] !== '_') {
                    qs.set('vendorId', decodeURIComponent(boardingMatch[1]));
                    location.replace('/pet-boarding/vendor/placeholder?' + qs.toString());
                    return;
                  }
                  var trackMatch = path.match(/^\\/track\\/([^/]+)$/);
                  if (trackMatch && trackMatch[1] !== 'placeholder' && trackMatch[1] !== '_') {
                    if (!qs.get('orderId')) qs.set('orderId', decodeURIComponent(trackMatch[1]));
                    location.replace('/track/placeholder?' + qs.toString());
                    return;
                  }
                  if (qs.get('productId') || qs.get('product_id')) return;
                  var shopMatch = path.match(/^\\/shop\\/([^/]+)$/);
                  if (shopMatch && shopMatch[1] !== 'placeholder' && shopMatch[1] !== '_') {
                    qs.set('productId', decodeURIComponent(shopMatch[1]));
                    location.replace('/shop/placeholder?' + qs.toString());
                  }
                } catch (e) { /* ignore */ }
              })();
            `,
          }}
        />
        {/* Error handler for chunk / JS load failures (works before React mounts) */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                'use strict';
                var COUNT_KEY = 'chunkErrorReloadCount';
                var LEGACY_KEY = 'chunkErrorReloaded';
                var MAX_RETRIES = 3;
                var FALLBACK_ID = 'warmpawz-chunk-fallback-ui';

                try {
                  if (sessionStorage.getItem(LEGACY_KEY) === 'true' && !sessionStorage.getItem(COUNT_KEY)) {
                    sessionStorage.setItem(COUNT_KEY, '1');
                  }
                  sessionStorage.removeItem(LEGACY_KEY);
                } catch (e) {}

                function getReloadCount() {
                  try {
                    var n = parseInt(sessionStorage.getItem(COUNT_KEY) || '0', 10);
                    return isNaN(n) ? 0 : n;
                  } catch (e) {
                    return 0;
                  }
                }

                function bumpReloadCount() {
                  try {
                    sessionStorage.setItem(COUNT_KEY, String(getReloadCount() + 1));
                  } catch (e) {}
                }

                function isRecoverableMessage(msg) {
                  if (!msg) return false;
                  var m = String(msg);
                  return m.indexOf('ChunkLoadError') >= 0
                    || m.indexOf('Loading chunk') >= 0
                    || m.indexOf('Failed to fetch dynamically imported module') >= 0
                    || m.indexOf('SyntaxError') >= 0
                    || m.indexOf('Unexpected token') >= 0
                    || m.indexOf('Invalid or unexpected token') >= 0
                    || m.indexOf('Unexpected identifier') >= 0;
                }

                function cacheBustReload() {
                  try {
                    var u = new URL(window.location.href);
                    u.searchParams.delete('__cw_reload');
                    u.searchParams.set('__cw_reload', String(Date.now()));
                    window.location.replace(u.toString());
                  } catch (e) {
                    window.location.reload();
                  }
                }

                function showFallbackUi() {
                  if (document.getElementById(FALLBACK_ID)) return;
                  try {
                    document.body.innerHTML = '';
                  } catch (e) {}
                  var root = document.createElement('div');
                  root.id = FALLBACK_ID;
                  root.setAttribute(
                    'style',
                    'min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:24px;text-align:center;font-family:system-ui,sans-serif;background:#fff;'
                  );
                  root.innerHTML =
                    '<p style="font-size:18px;font-weight:600;color:#111;margin:0 0 8px;">Unable to load Warmpawz</p>' +
                    '<p style="font-size:14px;color:#666;margin:0 0 24px;max-width:320px;">The app could not load the latest version. Try again or open the login page.</p>' +
                    '<div style="display:flex;flex-direction:column;gap:12px;width:100%;max-width:280px;">' +
                    '<button type="button" id="warmpawz-chunk-reload" style="padding:12px 16px;border-radius:12px;border:none;background:#FF8C42;color:#fff;font-size:16px;font-weight:600;cursor:pointer;">Reload page</button>' +
                    '<button type="button" id="warmpawz-chunk-auth" style="padding:12px 16px;border-radius:12px;border:1px solid #FF8C42;background:#fff;color:#FF8C42;font-size:16px;font-weight:600;cursor:pointer;">Open login</button>' +
                    '</div>';
                  document.body.appendChild(root);
                  var reloadBtn = document.getElementById('warmpawz-chunk-reload');
                  var authBtn = document.getElementById('warmpawz-chunk-auth');
                  if (reloadBtn) {
                    reloadBtn.onclick = function() {
                      try { sessionStorage.removeItem(COUNT_KEY); } catch (e) {}
                      cacheBustReload();
                    };
                  }
                  if (authBtn) {
                    authBtn.onclick = function() {
                      window.location.assign('/auth');
                    };
                  }
                }

                function attemptRecovery(sourceMsg) {
                  if (!isRecoverableMessage(sourceMsg)) return;
                  var count = getReloadCount();
                  if (count >= MAX_RETRIES) {
                    showFallbackUi();
                    return;
                  }
                  bumpReloadCount();
                  cacheBustReload();
                }

                window.addEventListener(
                  'error',
                  function(ev) {
                    if (ev.target && ev.target !== window) {
                      var tag = ev.target.tagName;
                      if (tag === 'SCRIPT' || tag === 'LINK') {
                        attemptRecovery(ev.message || 'Failed to load script');
                      }
                      return;
                    }
                    attemptRecovery(ev.message || '');
                  },
                  true
                );

                window.addEventListener('unhandledrejection', function(ev) {
                  var reason = ev.reason;
                  var msg =
                    reason && reason.message ? reason.message : String(reason || '');
                  attemptRecovery(msg);
                });
              })();
            `,
          }}
        />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
