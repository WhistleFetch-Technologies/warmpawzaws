import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';

const inter = Inter({ 
  subsets: ['latin'],
  display: 'swap',
  preload: true,
});

export const metadata: Metadata = {
  title: 'Warmpawz Admin Portal',
  description: 'Platform administration and governance',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className} suppressHydrationWarning>
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
              // Load synchronously to ensure it's available before components mount
              (function() {
                try {
                  var script = document.createElement('script');
                  script.src = '/runtime-config.js?v=' + Date.now(); // Cache bust
                  script.async = false;
                  script.defer = false;
                  script.onload = function() {
                    console.log('🔧 External runtime-config.js loaded:', window.__WARMPAWZ_RUNTIME_CONFIG__);
                  };
                  script.onerror = function() {
                    console.warn('⚠️ Failed to load runtime-config.js, using fallback');
                    // Ensure fallback is set if external load fails
                    if (!window.__WARMPAWZ_RUNTIME_CONFIG__) {
                      window.__WARMPAWZ_RUNTIME_CONFIG__ = {
                        apiBaseUrl: 'https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com',
                        uatMode: true
                      };
                    }
                  };
                  // Insert at the beginning to ensure it loads first
                  document.head.insertBefore(script, document.head.firstChild);
                } catch (e) {
                  console.error('Error loading runtime-config.js:', e);
                }
              })();
              // UAT Mode: Auto-login for direct page access (e.g., /ecommerce, /vendors, etc.)
              (function() {
                var config = window.__WARMPAWZ_RUNTIME_CONFIG__ || {};
                var isUatMode = config.uatMode === true;
                if (isUatMode && typeof localStorage !== 'undefined') {
                  var token = localStorage.getItem('adminAuthToken');
                  if (!token) {
                    localStorage.setItem('adminAuthToken', 'uat-token-admin-' + Date.now());
                    localStorage.setItem('adminEmail', 'admin@warmpawz.com');
                    console.log('🔧 [UAT Mode] Auto-logged in for direct page access');
                  }
                }
              })();
            `,
          }}
        />
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}

