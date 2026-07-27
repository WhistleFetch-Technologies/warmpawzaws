/**
 * Warmpawz Pay module capability probe (kill-switch only).
 * Runtime module selection comes from CommerceConfigProvider / activeModelId.
 */
export function isWarmpawzPayModuleCapable(): boolean {
  if (typeof window !== 'undefined') {
    const runtime = (
      window as unknown as { __WARMPAWZ_RUNTIME__?: { warmpawzPayEnabled?: boolean } }
    ).__WARMPAWZ_RUNTIME__;
    if (runtime?.warmpawzPayEnabled === false) return false;
  }
  return process.env.NEXT_PUBLIC_WARMPAWZ_PAY_ENABLED !== 'false';
}

/** @deprecated Use isWarmpawzPayModuleCapable — runtime selection is via Commerce Switch. */
export function isWarmpawzPayFeatureEnabled(): boolean {
  return isWarmpawzPayModuleCapable();
}
