/** Warmpawz Pay customer UI gate — matches backend WARMPAWZ_PAY_ENABLED intent. */
export function isWarmpawzPayEnabled(): boolean {
  if (typeof window !== 'undefined') {
    const runtime = (window as unknown as { __WARMPAWZ_RUNTIME__?: { warmpawzPayEnabled?: boolean } })
      .__WARMPAWZ_RUNTIME__;
    if (runtime?.warmpawzPayEnabled === false) return false;
  }
  return process.env.NEXT_PUBLIC_WARMPAWZ_PAY_ENABLED !== 'false';
}
