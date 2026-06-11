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
        {/* Recover from stale JS chunks after deploy (common on Android WebView / long-lived sessions). */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                var hasReloaded = sessionStorage.getItem('vendor_chunk_reload');
                function isChunkMsg(msg) {
                  return msg.indexOf('ChunkLoadError') !== -1
                    || msg.indexOf('Loading chunk') !== -1
                    || msg.indexOf('Loading CSS chunk') !== -1
                    || msg.indexOf('Failed to fetch dynamically imported module') !== -1
                    || msg.indexOf('before initialization') !== -1;
                }
                function reloadOnce() {
                  if (hasReloaded) return;
                  sessionStorage.setItem('vendor_chunk_reload', 'true');
                  window.location.reload();
                }
                window.addEventListener('error', function(e) {
                  var msg = e.message || '';
                  if (isChunkMsg(msg)) reloadOnce();
                });
                window.addEventListener('unhandledrejection', function(e) {
                  var msg = (e.reason && e.reason.message) || String(e.reason || '');
                  if (isChunkMsg(msg)) {
                    e.preventDefault();
                    reloadOnce();
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

