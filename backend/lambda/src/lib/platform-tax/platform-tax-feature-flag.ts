/** Platform tax documents feature flag — set PLATFORM_TAX_DOCUMENTS_ENABLED=true on Lambda. */

export function isPlatformTaxDocumentsEnabled(): boolean {
  return process.env.PLATFORM_TAX_DOCUMENTS_ENABLED === 'true';
}

export function getPlatformTaxDocumentsStatus(): { enabled: boolean; source: 'env' | 'none' } {
  if (process.env.PLATFORM_TAX_DOCUMENTS_ENABLED === 'true') {
    return { enabled: true, source: 'env' };
  }
  return { enabled: false, source: 'none' };
}
