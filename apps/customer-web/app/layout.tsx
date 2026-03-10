import type { Metadata } from 'next';
import './globals.css';
import { Providers } from './providers';

export const metadata: Metadata = {
  title: 'Warmpawz - Pet Care Services',
  description: 'Find and book pet care services near you',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Inject production config if NEXT_PUBLIC_ENVIRONMENT is production
  const isProd = process.env.NEXT_PUBLIC_ENVIRONMENT === 'production';
  const prodApiUrl = process.env.NEXT_PUBLIC_API_BASE_URL;

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
        {prodApiUrl && (
          <script
            dangerouslySetInnerHTML={{
              __html: `
                window.__NEXT_PUBLIC_API_BASE_URL__ = "${prodApiUrl}";
              `,
            }}
          />
        )}
        {/* 
          Inject production runtime config ONLY when NEXT_PUBLIC_ENVIRONMENT=production.
          This ensures prod:customer, prod:vendor, prod:admin use production API Gateway.
        */}
        {isProd && prodApiUrl && (
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
        {/* 
          Runtime config injected at deploy-time (static hosting safe).
          For localhost, this file detects localhost and doesn't set apiBaseUrl,
          allowing the environment variable above to take precedence.
        */}
        <script src="/runtime-config.js" />
        {/* Error handler for chunk load errors */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                var hasReloaded = sessionStorage.getItem('chunkErrorReloaded');
                function handleChunkError(e) {
                  var msg = e.message || '';
                  if ((msg.includes('ChunkLoadError') || msg.includes('Loading chunk') || msg.includes('Failed to fetch dynamically imported module')) && !hasReloaded) {
                    sessionStorage.setItem('chunkErrorReloaded', 'true');
                    window.location.reload();
                  }
                }
                window.addEventListener('error', handleChunkError);
                window.addEventListener('unhandledrejection', function(e) {
                  var msg = e.reason?.message || String(e.reason || '');
                  if ((msg.includes('ChunkLoadError') || msg.includes('Loading chunk')) && !hasReloaded) {
                    sessionStorage.setItem('chunkErrorReloaded', 'true');
                    window.location.reload();
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
