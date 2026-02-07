import type { Metadata } from 'next';
import { Baloo_2 } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';

// Optimized font loading with next/font - self-hosted for better performance
const baloo2 = Baloo_2({ 
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  display: 'swap',
  preload: true,
  variable: '--font-baloo2',
});

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
    <html lang="en" className={baloo2.variable}>
      <head>
        {/* Preconnect to Google Fonts for Material Symbols (non-blocking) */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* Material Symbols loaded with font-display: swap for non-blocking */}
        <link 
          rel="stylesheet" 
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Rounded:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=swap"
          // @ts-ignore - media trick for non-blocking CSS
          media="print"
          // @ts-ignore
          onLoad="this.media='all'"
        />
      </head>
      <body className={baloo2.className}>
        {/* Runtime config: no hardcoded URLs. Injected at deploy from config/urls.json; local dev: NEXT_PUBLIC_API_BASE_URL */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if (!window.__WARMPAWZ_RUNTIME_CONFIG__) {
                window.__WARMPAWZ_RUNTIME_CONFIG__ = { apiBaseUrl: '', uatMode: true };
              }
            `,
          }}
        />
        {/* Load sync so API client has correct base URL before first request (avoids localhost fallback) */}
        <script src="/runtime-config.js" />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

