/**
 * Customer UI toggle for instant tele consultation.
 * Backend routes and components stay wired; set to true to show instant tele again.
 */
export const INSTANT_TELE_UI_ENABLED = false;

export function isInstantTeleUiEnabled(): boolean {
  return INSTANT_TELE_UI_ENABLED;
}
