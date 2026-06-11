import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';

const inter = Inter({ subsets: ['latin'] });

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
};

export const metadata: Metadata = {
  title: 'Warmpawz Vendor Dashboard',
  description: 'Manage your pet care business',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Warmpawz Vendor',
  },
};

/** Same gateways as `lib/api-client.ts` — prod and dev analytics + REST must match. */
const WARMPAWZ_API_GATEWAY_PROD = 'https://mss9sa4y01.execute-api.ap-south-1.amazonaws.com';
const WARMPAWZ_API_GATEWAY_DEV = 'https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const isProd = process.env.NEXT_PUBLIC_ENVIRONMENT === 'production';
  const isUatBuild = process.env.NEXT_PUBLIC_UAT_MODE === 'true';
  const rawApiUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
  // Retired dev gateway in CI secrets → always use current dev API for injects
  let prodApiUrl =
    rawApiUrl && rawApiUrl.includes('iixwc3fzfl') ? WARMPAWZ_API_GATEWAY_DEV : rawApiUrl;
  if (!prodApiUrl) {
    prodApiUrl = isProd ? WARMPAWZ_API_GATEWAY_PROD : WARMPAWZ_API_GATEWAY_DEV;
  }
  const injectProdRuntime = isProd && !!prodApiUrl && !isUatBuild;

  return (
    <html lang="en" className="h-full">
      <body className={`${inter.className} h-full overflow-hidden antialiased`}>
        {/* Inject NEXT_PUBLIC_API_BASE_URL for builds that embed API URL (normalized for dev). */}
        {prodApiUrl && (
          <script
            dangerouslySetInnerHTML={{
              __html: `
                window.__NEXT_PUBLIC_API_BASE_URL__ = "${prodApiUrl}";
              `,
            }}
          />
        )}
        {/* Production runtime only for real prod builds — never when UAT_MODE is baked in (e.g. dev CI). */}
        {injectProdRuntime && (
          <script
            dangerouslySetInnerHTML={{
              __html: `
                window.__WARMPAWZ_RUNTIME_CONFIG__ = {
                  apiBaseUrl: "${prodApiUrl}",
                  environment: "production",
                  uatMode: false
                };
              `,
            }}
          />
        )}
        {/* Runtime config injected at deploy-time (static hosting safe). */}
        <script src="/runtime-config.js" />
        {/* Recover from stale JS chunks after deploy (Android WebView / long-lived sessions). */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                var KEY = 'vendor_chunk_reload';
                var MAX = 3;
                function isChunkMsg(msg) {
                  var m = String(msg || '').toLowerCase();
                  return m.indexOf('chunkloaderror') !== -1
                    || m.indexOf('loading chunk') !== -1
                    || m.indexOf('loading css chunk') !== -1
                    || m.indexOf('dynamically imported module') !== -1
                    || m.indexOf('before initialization') !== -1
                    || m.indexOf('unexpected token') !== -1;
                }
                function reloadWithBust() {
                  try {
                    var count = parseInt(sessionStorage.getItem(KEY) || '0', 10) || 0;
                    if (count >= MAX) return;
                    sessionStorage.setItem(KEY, String(count + 1));
                    var url = new URL(window.location.href);
                    url.searchParams.set('_cv', String(Date.now()));
                    window.location.replace(url.pathname + url.search + url.hash);
                  } catch (e) {
                    window.location.reload();
                  }
                }
                window.addEventListener('load', function() {
                  setTimeout(function() {
                    try { sessionStorage.removeItem(KEY); } catch (e) {}
                  }, 4000);
                });
                window.addEventListener('error', function(e) {
                  if (isChunkMsg(e.message || '')) reloadWithBust();
                });
                window.addEventListener('unhandledrejection', function(e) {
                  var msg = (e.reason && e.reason.message) || String(e.reason || '');
                  if (isChunkMsg(msg)) {
                    e.preventDefault();
                    reloadWithBust();
                  }
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

