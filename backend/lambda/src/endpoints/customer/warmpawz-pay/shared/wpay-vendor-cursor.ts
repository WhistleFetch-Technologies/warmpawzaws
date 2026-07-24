export type WpayVendorCursor = {
  businessName: string;
  catalogueId: string;
};

export function encodeWpayVendorCursor(businessName: string, catalogueId: string): string {
  return Buffer.from(JSON.stringify({ businessName, catalogueId }), 'utf8').toString('base64url');
}

export function decodeWpayVendorCursor(cursor: string): WpayVendorCursor | null {
  try {
    const parsed = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')) as Partial<WpayVendorCursor>;
    if (typeof parsed.businessName === 'string' && typeof parsed.catalogueId === 'string' && parsed.catalogueId) {
      return { businessName: parsed.businessName, catalogueId: parsed.catalogueId };
    }
  } catch {
    return null;
  }
  return null;
}
