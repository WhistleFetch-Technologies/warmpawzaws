import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Warmpawz Vendor Dashboard',
  description: 'Manage your pet care business',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
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

