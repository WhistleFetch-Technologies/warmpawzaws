/**
 * Home-only Support / Need Help visibility.
 * Do not use this to hide SupportHelpCenter, /help, or other authenticated entry points.
 */

export function shouldRenderCustomerHomeNeedHelp(isGuest: boolean): boolean {
  return !isGuest;
}

/** Trust bar Support tap is Home-only; omit onNavigate for guests instead of changing TrustFeatureBar. */
export function shouldEnableCustomerHomeTrustSupport(isGuest: boolean): boolean {
  return !isGuest;
}
