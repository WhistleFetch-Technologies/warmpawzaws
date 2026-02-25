import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';

const inter = Inter({ 
  subsets: ['latin'],
  display: 'swap',
  preload: false, // Avoid "preloaded but not used" warning on client-rendered/loading pages
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
  // Inject production config if NEXT_PUBLIC_ENVIRONMENT is production
  const isProd = process.env.NEXT_PUBLIC_ENVIRONMENT === 'production';
  const prodApiUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
  
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={inter.className}
        suppressHydrationWarning
        style={{
          // Fallback if Tailwind CSS chunk fails to load (e.g. wrong asset path in prod)
          backgroundColor: 'var(--background, #f9fafb)',
          color: 'var(--foreground, #030213)',
          fontFamily: 'var(--font-sans, Inter, system-ui, sans-serif)',
        }}
      >
        {/* Production config must be set first, before any other scripts */}
        {isProd && prodApiUrl && (
          <script
            dangerouslySetInnerHTML={{
              __html: `
                (function() {
                  // Set production config immediately and lock it
                  window.__WARMPAWZ_RUNTIME_CONFIG__ = {
                    apiBaseUrl: "${prodApiUrl}",
                    environment: "production",
                    uatMode: false
                  };
                  // Prevent runtime-config.js from overriding
                  window.__WARMPAWZ_PROD_MODE__ = true;
                  console.log('🔧 Production config set:', window.__WARMPAWZ_RUNTIME_CONFIG__);
                })();
              `,
            }}
          />
        )}
        {/* Runtime config: Inline fallback + external script for deploy-time override */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              // ✅ FIX: Detect production from hostname BEFORE anything else
              // This prevents any UAT mode from leaking in production
              (function() {
                var hostname = window.location.hostname || '';
                var isProductionHostname = hostname.includes('cloudfront.net') || 
                                          hostname.includes('warmpawz.com') ||
                                          hostname.includes('admin.warmpawz.com');
                var isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1';
                
                // If we're on a production hostname, FORCE production mode
                if (isProductionHostname && !isLocalhost) {
                  window.__WARMPAWZ_PROD_MODE__ = true;
                }
              })();
              
              // Inline fallback config (ensures API URL is always available)
              // Only set if not already configured (production mode sets it above)
              if (!window.__WARMPAWZ_RUNTIME_CONFIG__) {
                // ✅ FIX: If production hostname detected, set prod config immediately
                if (window.__WARMPAWZ_PROD_MODE__) {
                  window.__WARMPAWZ_RUNTIME_CONFIG__ = {
                    apiBaseUrl: 'https://mss9sa4y01.execute-api.ap-south-1.amazonaws.com',
                    uatMode: false,
                    environment: 'production'
                  };
                } else {
                  window.__WARMPAWZ_RUNTIME_CONFIG__ = { apiBaseUrl: '', uatMode: true };
                }
              }
              (function() {
                try {
                  var script = document.createElement('script');
                  script.src = '/runtime-config.js?v=' + Date.now();
                  script.async = false;
                  script.defer = false;
                  script.onload = function() { 
                    console.log('Runtime config loaded');
                    // Ensure production mode is preserved after runtime-config loads
                    if (window.__WARMPAWZ_PROD_MODE__ && window.__WARMPAWZ_RUNTIME_CONFIG__) {
                      window.__WARMPAWZ_RUNTIME_CONFIG__.uatMode = false;
                      window.__WARMPAWZ_RUNTIME_CONFIG__.environment = 'production';
                      window.__WARMPAWZ_RUNTIME_CONFIG__.apiBaseUrl = 'https://mss9sa4y01.execute-api.ap-south-1.amazonaws.com';
                    }
                  };
                  script.onerror = function() {
                    console.warn('runtime-config.js failed to load');
                  };
                  document.head.insertBefore(script, document.head.firstChild);
                } catch (e) { console.error('Error loading runtime-config.js', e); }
              })();
              // UAT Mode: Auto-login for direct page access (e.g., /ecommerce, /vendors, etc.)
              // CRITICAL: Only run if NOT in production mode AND UAT mode is explicitly enabled
              (function() {
                // ✅ FIX: Check BOTH __WARMPAWZ_PROD_MODE__ AND hostname
                var hostname = window.location.hostname || '';
                var isProductionHostname = hostname.includes('cloudfront.net') || 
                                          hostname.includes('warmpawz.com');
                var isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1';
                
                // CRITICAL: NEVER auto-login in production mode (check multiple signals)
                if (window.__WARMPAWZ_PROD_MODE__ === true || (isProductionHostname && !isLocalhost)) {
                  console.log('[Production Mode] Auto-login disabled - user must login');
                  return;
                }
                
                var config = window.__WARMPAWZ_RUNTIME_CONFIG__ || {};
                
                // CRITICAL: Additional production indicators
                var isProduction = config.environment === 'production' || 
                                   config.uatMode === false ||
                                   (config.apiBaseUrl && config.apiBaseUrl.includes('mss9sa4y01'));
                
                if (isProduction) {
                  console.log('[Production Mode Detected] Auto-login disabled');
                  return;
                }
                
                // Only auto-login if UAT mode is explicitly enabled and on localhost
                var isUatMode = config.uatMode === true && isLocalhost;
                
                if (isUatMode && typeof localStorage !== 'undefined') {
                  var token = localStorage.getItem('adminAuthToken');
                  if (!token) {
                    localStorage.setItem('adminAuthToken', 'uat-token-admin-' + Date.now());
                    localStorage.setItem('adminEmail', 'admin@warmpawz.com');
                    console.log('[UAT Mode] Auto-logged in for direct page access');
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

