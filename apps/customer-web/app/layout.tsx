import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';

const inter = Inter({ subsets: ['latin'] });

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
      <body className={inter.className}>
        {/* Runtime config: Inline fallback + external script for deploy-time override */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              // Inline fallback config (ensures API URL is always available)
              if (!window.__WARMPAWZ_RUNTIME_CONFIG__) {
                window.__WARMPAWZ_RUNTIME_CONFIG__ = {
                  apiBaseUrl: 'https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com',
                  uatMode: true
                };
                console.log('🔧 Runtime config loaded (inline fallback):', window.__WARMPAWZ_RUNTIME_CONFIG__);
              }
              // Load external runtime-config.js to override if needed (deploy-time)
              (function() {
                var script = document.createElement('script');
                script.src = '/runtime-config.js';
                script.async = false;
                script.defer = false;
                script.onload = function() {
                  console.log('🔧 External runtime-config.js loaded:', window.__WARMPAWZ_RUNTIME_CONFIG__);
                };
                script.onerror = function() {
                  console.warn('⚠️ Failed to load runtime-config.js, using fallback');
                };
                document.head.appendChild(script);
              })();
            `,
          }}
        />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

