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
        {/* Runtime config: Placeholder - MUST be replaced at deploy time by deploy script.
            The deploy script (deploy-to-s3.js or manual AWS CLI deploy) replaces the content
            of this script tag with the correct apiBaseUrl, uatMode, and environment values.
            DO NOT hardcode dev/prod values here - they get baked into the static HTML at build time. */}
        <script
          id="runtime-config-inline"
          dangerouslySetInnerHTML={{
            __html: `window.__WARMPAWZ_RUNTIME_CONFIG__ = { apiBaseUrl: '', uatMode: false, environment: '' };`,
          }}
        />
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
