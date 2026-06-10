/**
 * Stack-aware back resolution for profile / account screens on the home shell (`/`).
 */

export const WALLET_HUB_CHILDREN = new Set<string>([
  'rewards-loyalty',
  'referral-system',
  'support_help',
]);

export function resolveWalletHubChildBack(deps: {
  navigationHistory: readonly string[];
  pushedFromWallet: boolean;
  accountHubFromMenu: boolean;
  pop: () => void;
  backToAccountMenu: () => void;
}): void {
  const parent =
    deps.navigationHistory.length >= 2
      ? deps.navigationHistory[deps.navigationHistory.length - 2]
      : undefined;
  if (parent === 'wallet' || deps.pushedFromWallet) {
    deps.pop();
    return;
  }
  if (deps.accountHubFromMenu) {
    deps.backToAccountMenu();
    return;
  }
  deps.pop();
}

export function resolveAccountHubRootBack(deps: {
  accountHubFromMenu: boolean;
  pop: () => void;
  backToAccountMenu: () => void;
  clearMenuRef: () => void;
}): void {
  if (deps.accountHubFromMenu) {
    deps.clearMenuRef();
    deps.backToAccountMenu();
    return;
  }
  deps.pop();
}
