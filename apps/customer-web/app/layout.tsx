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
        {/* Runtime config: Inline fallback + async external script for deploy-time override */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              // Inline fallback config (ensures API URL is always available immediately)
              // Deployed API: Main API Gateway (z0b3obweb6). Override via runtime-config.js or env.
              if (!window.__WARMPAWZ_RUNTIME_CONFIG__) {
                window.__WARMPAWZ_RUNTIME_CONFIG__ = {
                  apiBaseUrl: 'https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com',
                  uatMode: true
                };
              }
            `,
          }}
        />
        {/* External config loaded async - won't block rendering */}
        <script src="/runtime-config.js" async />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

