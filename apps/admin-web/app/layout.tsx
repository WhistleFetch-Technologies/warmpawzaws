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
        {/* Runtime config: Inline fallback + external script for deploy-time override */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              // ✅ ENVIRONMENT-AWARE: Inline fallback config
              // Dev: Allows UAT mode, Prod: Disables UAT mode
              if (!window.__WARMPAWZ_RUNTIME_CONFIG__) {
                const hostname = window.location.hostname;
                const isProd = hostname.includes('cloudfront.net') || 
                              hostname.includes('warmpawz.com') ||
                              hostname.includes('admin.warmpawz.com');
                const isDev = hostname === 'localhost' || 
                             hostname === '127.0.0.1' || 
                             hostname.includes('localhost') ||
                             hostname.includes('.dev.warmpawz.com');
                
                window.__WARMPAWZ_RUNTIME_CONFIG__ = { 
                  apiBaseUrl: isProd 
                    ? 'https://mss9sa4y01.execute-api.ap-south-1.amazonaws.com' 
                    : (isDev ? 'https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com' : ''), 
                  uatMode: isDev && !isProd  // UAT mode only in dev, never in prod
                };
              }
              (function() {
                try {
                  var script = document.createElement('script');
                  script.src = '/runtime-config.js?v=' + Date.now();
                  script.async = false;
                  script.defer = false;
                  script.onload = function() { console.log('🔧 runtime-config.js loaded'); };
                  script.onerror = function() {
                    console.warn('⚠️ runtime-config.js failed; set NEXT_PUBLIC_API_BASE_URL for local dev');
                  };
                  document.head.insertBefore(script, document.head.firstChild);
                } catch (e) { console.error('Error loading runtime-config.js', e); }
              })();
              // ✅ ENVIRONMENT-AWARE: UAT Mode auto-login only in dev environment
              (function() {
                var config = window.__WARMPAWZ_RUNTIME_CONFIG__ || {};
                var isUatMode = config.uatMode === true;
                var hostname = window.location.hostname;
                var isProd = hostname.includes('cloudfront.net') || 
                           hostname.includes('warmpawz.com') ||
                           hostname.includes('admin.warmpawz.com');
                
                // Only auto-login in dev (UAT mode) and never in production
                if (isUatMode && !isProd && typeof localStorage !== 'undefined') {
                  var token = localStorage.getItem('adminAuthToken');
                  if (!token) {
                    localStorage.setItem('adminAuthToken', 'uat-token-admin-' + Date.now());
                    localStorage.setItem('adminEmail', 'admin@warmpawz.com');
                    console.log('🔧 [UAT Mode] Auto-logged in for dev environment');
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

