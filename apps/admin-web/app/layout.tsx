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
              // ✅ FIX: Inline fallback config - default to production mode (uatMode: false)
              // This ensures production never defaults to UAT mode even if runtime-config.js fails to load
              if (!window.__WARMPAWZ_RUNTIME_CONFIG__) {
                const isProd = window.location.hostname.includes('cloudfront.net') || 
                              window.location.hostname.includes('warmpawz.com');
                window.__WARMPAWZ_RUNTIME_CONFIG__ = { 
                  apiBaseUrl: isProd ? 'https://mss9sa4y01.execute-api.ap-south-1.amazonaws.com' : '', 
                  uatMode: false  // ✅ CRITICAL: Never default to UAT mode
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
              // ✅ REMOVED: UAT Mode auto-login - Production should never generate UAT tokens
              // Users must log in through the proper login flow to get real JWT tokens
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

