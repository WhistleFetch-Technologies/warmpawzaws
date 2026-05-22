/**
 * Vendor UI toggle for instant tele consultation availability.
 * Profile API fields stay wired; set to true to show instant tele settings again.
 */
export const INSTANT_TELE_UI_ENABLED = false;

export function isInstantTeleUiEnabled(): boolean {
  return INSTANT_TELE_UI_ENABLED;
}
