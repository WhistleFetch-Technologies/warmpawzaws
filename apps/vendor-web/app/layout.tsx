import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';

const inter = Inter({ subsets: ['latin'] });

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
};

export const metadata: Metadata = {
  title: 'Warmpawz Vendor Dashboard',
  description: 'Manage your pet care business',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Warmpawz Vendor',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const isProd = process.env.NEXT_PUBLIC_ENVIRONMENT === 'production';
  const isUatBuild = process.env.NEXT_PUBLIC_UAT_MODE === 'true';
  const rawApiUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
  // Retired dev gateway in CI secrets → always use current dev API for injects
  const prodApiUrl =
    rawApiUrl && rawApiUrl.includes('iixwc3fzfl')
      ? 'https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com'
      : rawApiUrl;
  const injectProdRuntime = isProd && !!prodApiUrl && !isUatBuild;

  return (
    <html lang="en">
      <body className={inter.className}>
        {/* Inject NEXT_PUBLIC_API_BASE_URL for builds that embed API URL (normalized for dev). */}
        {prodApiUrl && (
          <script
            dangerouslySetInnerHTML={{
              __html: `
                window.__NEXT_PUBLIC_API_BASE_URL__ = "${prodApiUrl}";
              `,
            }}
          />
        )}
        {/* Production runtime only for real prod builds — never when UAT_MODE is baked in (e.g. dev CI). */}
        {injectProdRuntime && (
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

