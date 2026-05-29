/**
 * Customer home page UI migration feature flag.
 *
 * Toggle on/off:
 *   • Locally  — set NEXT_PUBLIC_NEW_HOME_UI=true|false in .env.local
 *   • Deployed — set the same env var in the build environment, OR override at runtime via
 *                window.__WARMPAWZ_RUNTIME_CONFIG__.newHomeUiEnabled (runtime-config.js)
 *
 * Precedence (highest → lowest):
 *   1. window.__WARMPAWZ_RUNTIME_CONFIG__.newHomeUiEnabled  (runtime override)
 *   2. NEXT_PUBLIC_NEW_HOME_UI                              (build-time env)
 *   3. false                                                 (default: old UI)
 */

function parseExplicitEnv(raw: string | undefined): boolean | null {
  if (raw === undefined || raw === '') return null;
  const v = raw.toLowerCase().trim();
  if (v === 'true' || v === '1') return true;
  if (v === 'false' || v === '0') return false;
  return null;
}

export function isNewHomeUiEnabled(): boolean {
  if (typeof window !== 'undefined') {
    const rc = (window as unknown as { __WARMPAWZ_RUNTIME_CONFIG__?: { newHomeUiEnabled?: boolean } })
      .__WARMPAWZ_RUNTIME_CONFIG__?.newHomeUiEnabled;
    if (typeof rc === 'boolean') return rc;
  }
  const explicit = parseExplicitEnv(
    typeof process !== 'undefined' ? process.env.NEXT_PUBLIC_NEW_HOME_UI : undefined
  );
  if (explicit !== null) return explicit;
  return false;
}
