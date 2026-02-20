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
  // Inject production config if NEXT_PUBLIC_ENVIRONMENT is production
  const isProd = process.env.NEXT_PUBLIC_ENVIRONMENT === 'production';
  const prodApiUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
  
  return (
    <html lang="en">
      <body className={inter.className}>
        {/* Inject production config if running in prod mode */}
        {isProd && prodApiUrl && (
          <script
            dangerouslySetInnerHTML={{
              __html: `
                window.__WARMPAWZ_RUNTIME_CONFIG__ = {
                  apiBaseUrl: "${prodApiUrl}",
                  environment: "production",
                  uatMode: false
                };
              `,
            }}
          />
        )}
        {/* Runtime config injected at deploy-time (static hosting safe). */}
        <script src="/runtime-config.js" />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

