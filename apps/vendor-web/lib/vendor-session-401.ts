export type VendorRefreshWipeKind = 'renewed' | 'unchanged' | 'failed_network' | 'failed_refresh';

/**
 * Wipe the vendor session only when refresh conclusively failed.
 * A 401 after a successful refresh is authorization/business, not sign-out.
 */
export function shouldWipeVendorSessionAfter401(
  kind: VendorRefreshWipeKind | undefined,
  isRetry: boolean,
): boolean {
  if (isRetry) return false;
  return kind === 'failed_refresh';
}
