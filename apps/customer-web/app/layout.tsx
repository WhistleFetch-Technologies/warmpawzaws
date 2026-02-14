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
          // @ts-ignore - media trick for non-blocking CSS
          media="print"
          // @ts-ignore
          onLoad="this.media='all'"
        />
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
      <body>
        {/* Inject NEXT_PUBLIC_API_BASE_URL from environment before runtime-config.js loads */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              // Inject API Base URL from Next.js environment variable
              window.__NEXT_PUBLIC_API_BASE_URL__ = ${JSON.stringify(process.env.NEXT_PUBLIC_API_BASE_URL || '')};
              if (!window.__WARMPAWZ_RUNTIME_CONFIG__) {
                window.__WARMPAWZ_RUNTIME_CONFIG__ = { apiBaseUrl: '', uatMode: false };
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
