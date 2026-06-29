/**
 * Shared Warmpawz branding for all server-generated tax invoices (orders, bookings, platform tax).
 * Import this module for any new invoice HTML — do not duplicate header/logo markup elsewhere.
 */
import fs from 'fs';
import path from 'path';

export const WARMPAWZ_INVOICE_BRAND = {
  name: 'Warmpawz',
  tagline: 'Pet Care Marketplace',
  accentColor: '#f97316',
} as const;

/** CSS for the logo + brand block used in invoice headers. */
export const INVOICE_BRAND_HEADER_CSS = `
    .brand { display: flex; align-items: center; gap: 14px; }
    .brand-logo { width: 56px; height: 56px; object-fit: contain; flex-shrink: 0; }
    .brand-text h1 { color: ${WARMPAWZ_INVOICE_BRAND.accentColor}; font-size: 24px; margin-bottom: 4px; letter-spacing: 0.02em; }
    .brand-text p { color: #666; font-size: 12px; margin: 0; }
`;

let cachedLogoDataUri: string | null | undefined;

function resolveLogoAssetPath(): string | null {
  const candidates = [
    path.join(__dirname, 'assets', 'warmpawz-logo.webp'),
    path.join(__dirname, '..', 'assets', 'warmpawz-logo.webp'),
    path.join(process.cwd(), 'assets', 'warmpawz-logo.webp'),
  ];
  for (const filePath of candidates) {
    if (fs.existsSync(filePath)) return filePath;
  }
  return null;
}

/** Embedded logo for self-contained HTML/PDF (works offline; preferred for downloads). */
export function getEmbeddedInvoiceLogoDataUri(): string | null {
  if (cachedLogoDataUri !== undefined) return cachedLogoDataUri;
  try {
    const assetPath = resolveLogoAssetPath();
    if (!assetPath) {
      cachedLogoDataUri = null;
      return null;
    }
    const buf = fs.readFileSync(assetPath);
    cachedLogoDataUri = `data:image/webp;base64,${buf.toString('base64')}`;
    return cachedLogoDataUri;
  } catch {
    cachedLogoDataUri = null;
    return null;
  }
}

/** Remote logo URL fallback when embedded asset is unavailable. */
export function getInvoiceLogoUrl(): string {
  if (process.env.INVOICE_LOGO_URL) return process.env.INVOICE_LOGO_URL;
  const customerWeb = process.env.CUSTOMER_WEB_URL?.replace(/\/$/, '');
  if (customerWeb) return `${customerWeb}/logo.webp`;
  return 'https://dg69gqp2frh39.cloudfront.net/logo.webp';
}

/** Best logo src for invoice HTML: embedded data URI, then configured/public URL. */
export function getInvoiceLogoSrc(): string {
  return getEmbeddedInvoiceLogoDataUri() ?? getInvoiceLogoUrl();
}

/** Left header block: logo + Warmpawz name (use inside .header or equivalent). */
export function renderInvoiceBrandHeader(): string {
  const logoSrc = getInvoiceLogoSrc();
  return `
      <div class="brand">
        <img src="${logoSrc}" alt="${WARMPAWZ_INVOICE_BRAND.name} logo" class="brand-logo" />
        <div class="brand-text">
          <h1>${WARMPAWZ_INVOICE_BRAND.name}</h1>
          <p>${WARMPAWZ_INVOICE_BRAND.tagline}</p>
        </div>
      </div>`;
}
