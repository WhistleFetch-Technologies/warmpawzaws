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
  // Read environment variables from server-side process.env
  const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || '';
  const environment = process.env.NEXT_PUBLIC_ENVIRONMENT || 'development';
  const uatMode = process.env.NEXT_PUBLIC_UAT_MODE === 'true' || (process.env.NEXT_PUBLIC_UAT_MODE !== 'false' && environment === 'development');
  
  // Determine production mode
  const isProd = environment === 'production';
  
  // Set API URL based on environment if not explicitly set
  const finalApiBaseUrl = apiBaseUrl || (isProd 
    ? 'https://mss9sa4y01.execute-api.ap-south-1.amazonaws.com'
    : 'https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com');
  
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
        {/* Runtime config: Inline script injects environment variables from server */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              // ✅ ENVIRONMENT-AWARE: Inject environment variables from server-side
              // This runs BEFORE runtime-config.js loads, so it sets the environment
              (function() {
                // Inject server-side environment variables
                const envFromServer = {
                  NEXT_PUBLIC_ENVIRONMENT: ${JSON.stringify(environment)},
                  NEXT_PUBLIC_API_BASE_URL: ${JSON.stringify(finalApiBaseUrl)},
                  NEXT_PUBLIC_UAT_MODE: ${JSON.stringify(uatMode ? 'true' : 'false')}
                };
                
                // Set on window for runtime-config.js to read
                if (typeof window !== 'undefined') {
                  window.__NEXT_PUBLIC_ENVIRONMENT__ = envFromServer.NEXT_PUBLIC_ENVIRONMENT;
                  window.__NEXT_PUBLIC_API_BASE_URL__ = envFromServer.NEXT_PUBLIC_API_BASE_URL;
                  window.__NEXT_PUBLIC_UAT_MODE__ = envFromServer.NEXT_PUBLIC_UAT_MODE === 'true';
                  
                  // Set initial config (will be overridden by runtime-config.js if it loads)
                  window.__WARMPAWZ_RUNTIME_CONFIG__ = { 
                    apiBaseUrl: envFromServer.NEXT_PUBLIC_API_BASE_URL,
                    uatMode: envFromServer.NEXT_PUBLIC_UAT_MODE === 'true',
                    environment: envFromServer.NEXT_PUBLIC_ENVIRONMENT
                  };
                  
                  console.log('🔧 [Server Config] Environment variables injected:', envFromServer);
                }
              })();
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
                var envFromVar = window.__NEXT_PUBLIC_ENVIRONMENT__;
                var isProd = envFromVar === 'production' || config.environment === 'production';
                
                // Only auto-login in dev (UAT mode) and never in production
                // Check both UAT mode flag and environment to be safe
                if (isUatMode && !isProd && typeof localStorage !== 'undefined') {
                  var token = localStorage.getItem('adminAuthToken');
                  if (!token) {
                    localStorage.setItem('adminAuthToken', 'uat-token-admin-' + Date.now());
                    localStorage.setItem('adminEmail', 'admin@warmpawz.com');
                    console.log('🔧 [UAT Mode] Auto-logged in for dev environment');
                  }
                } else if (isProd) {
                  // In production, clear any UAT tokens
                  var token = localStorage.getItem('adminAuthToken');
                  if (token && token.startsWith('uat-token-')) {
                    localStorage.removeItem('adminAuthToken');
                    localStorage.removeItem('adminEmail');
                    console.log('🔧 [Production] Cleared UAT token');
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

