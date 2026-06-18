import { NAV_CONFIG } from './nav-config';
import { recordNavEvent } from './nav-telemetry';
import {
  CUSTOMER_ROUTES,
  type CustomerTabId,
} from './route-registry';
import {
  getShellForwardPolicy,
  type ShellForwardPolicy,
} from './shell-route-policies';
import type { ShellEntry, ShellNavigateOptions } from './types';
import { pushShellEntry, shellCurrentScreen } from './shell-stack';

export type ShellNavigationDeps<T extends string> = {
  currentScreen: T;
  history: ShellEntry<T>[];
  setCurrentScreen: (screen: T, options?: ShellNavigateOptions) => void;
  setHistory: (updater: (prev: ShellEntry<T>[]) => ShellEntry<T>[]) => void;
  resetStack: (screen?: T) => void;
  popOrReset: (fallback: T, onAfter?: (newCurrent: T) => void) => void;
  replaceTop: (screen: T, key?: string) => void;
  /** Called before stack pop in back(). */
  onBeforeBack?: () => void;
  /** Called when resetTo('home') or tab home reset. */
  onResetHome?: () => void;
  /** Collapse stack when depth or oscillation limits hit. */
  onDepthCollapse?: (targetScreen: T) => void;
};

export type ShellForwardOptions = {
  key?: string;
  /** Escape hatch — prefer registry policy. */
  policyOverride?: ShellForwardPolicy;
};

type TransitionRecord = {
  from: string;
  to: string;
  key?: string;
};

const recentTransitions: TransitionRecord[] = [];

function trackTransition(from: string, to: string, key?: string): void {
  recentTransitions.push({ from, to, key });
  const max = NAV_CONFIG.oscillationWindow * 2;
  if (recentTransitions.length > max) {
    recentTransitions.splice(0, recentTransitions.length - max);
  }
}

function detectOscillation(): boolean {
  const w = NAV_CONFIG.oscillationWindow;
  if (recentTransitions.length < w) return false;
  const tail = recentTransitions.slice(-w);
  const pairs = tail.map((t) => `${t.to}|${t.key ?? ''}`);
  if (w === 4) {
    return pairs[0] === pairs[2] && pairs[1] === pairs[3] && pairs[0] !== pairs[1];
  }
  const half = Math.floor(w / 2);
  const a = pairs.slice(0, half).join(',');
  const b = pairs.slice(half).join(',');
  return a === b && pairs[0] !== pairs[1];
}

function applyForwardPolicy<T extends string>(
  deps: ShellNavigationDeps<T>,
  screen: T,
  policy: ShellForwardPolicy,
  key?: string,
): void {
  switch (policy) {
    case 'reset':
      deps.resetStack(screen);
      break;
    case 'replace':
      deps.replaceTop(screen, key);
      break;
    case 'focus-root':
      deps.setCurrentScreen(screen, { mode: 'popToIfExists', key });
      break;
    case 'push':
    default:
      deps.setCurrentScreen(screen, { mode: 'push', key });
      break;
  }
}

/**
 * Factory for shell navigation intents — registry-driven forward policies.
 */
export function createShellNavigationService<T extends string>(
  deps: ShellNavigationDeps<T>,
) {
  const getDepth = () => deps.history.length;

  const maybeCollapse = (targetScreen: T, reason: 'depth' | 'oscillation'): boolean => {
    if (getDepth() <= NAV_CONFIG.maxDepth && reason === 'depth') {
      return false;
    }
    if (reason === 'oscillation' && !detectOscillation()) {
      return false;
    }

    recordNavEvent({
      action: reason === 'depth' ? 'NAV_DEPTH_COLLAPSE' : 'NAV_OSCILLATION_COLLAPSE',
      fromScreen: deps.currentScreen,
      toScreen: targetScreen,
      stackDepth: getDepth(),
    });

    deps.onDepthCollapse?.(targetScreen);
    deps.resetStack(targetScreen);
    if (targetScreen === ('home' as T)) {
      deps.onResetHome?.();
    }
    return true;
  };

  const forward = (screen: T, opts?: ShellForwardOptions): void => {
    const policyDef = opts?.policyOverride
      ? { forward: opts.policyOverride }
      : getShellForwardPolicy(screen);
    const policy = policyDef.forward;

    if (
      policyDef.requiresKey &&
      !opts?.key &&
      NAV_CONFIG.devWarnings &&
      typeof console !== 'undefined'
    ) {
      console.warn(
        `[nav] forward to "${screen}" expects a routeKey — pass opts.key for stable entity navigation`,
      );
    }

    if (getDepth() >= NAV_CONFIG.maxDepth) {
      const hub = screen;
      if (maybeCollapse(hub, 'depth')) {
        return;
      }
    }

    const from = deps.currentScreen;
    applyForwardPolicy(deps, screen, policy, opts?.key);
    trackTransition(from, screen, opts?.key);

    if (detectOscillation()) {
      maybeCollapse(screen, 'oscillation');
      return;
    }

    recordNavEvent({
      action: 'NAV_FORWARD',
      fromScreen: from,
      toScreen: screen,
      stackDepth: getDepth(),
      key: opts?.key,
      policy,
    });
  };

  const back = (): void => {
    deps.onBeforeBack?.();
    const from = deps.currentScreen;
    const depthBefore = getDepth();

    deps.popOrReset('home' as T, (newCurrent) => {
      if (newCurrent === ('home' as T)) {
        deps.onResetHome?.();
      }
    });

    recordNavEvent({
      action: 'NAV_BACK',
      fromScreen: from,
      toScreen: deps.currentScreen,
      stackDepth: depthBefore,
    });
  };

  const resetTo = (screen: T): void => {
    const from = deps.currentScreen;
    deps.resetStack(screen);
    if (screen === ('home' as T)) {
      deps.onResetHome?.();
    }
    recordNavEvent({
      action: 'NAV_RESET',
      fromScreen: from,
      toScreen: screen,
      stackDepth: getDepth(),
    });
  };

  const replaceTop = (screen: T, key?: string): void => {
    const from = deps.currentScreen;
    deps.replaceTop(screen, key);
    trackTransition(from, screen, key);
    recordNavEvent({
      action: 'NAV_REPLACE',
      fromScreen: from,
      toScreen: screen,
      stackDepth: getDepth(),
      key,
    });
  };

  const focusTabRoot = (tabId: CustomerTabId): void => {
    if (tabId === 'profile') {
      return;
    }

    const route = CUSTOMER_ROUTES[tabId];
    if (!route?.shell) {
      return;
    }

    const shellScreen = route.shell as T;
    const from = deps.currentScreen;

    if (route.policy === 'reset') {
      resetTo(shellScreen);
      return;
    }

    if (route.policy === 'focus') {
      applyForwardPolicy(deps, shellScreen, 'focus-root');
      recordNavEvent({
        action: 'NAV_FOCUS_ROOT',
        fromScreen: from,
        toScreen: shellScreen,
        stackDepth: getDepth(),
        policy: 'focus-root',
      });
      return;
    }

    forward(shellScreen);
  };

  /** Policy-aware forward — drop-in for legacy navigateToScreen(screen, key?). */
  const navigateToScreen = (screen: T, key?: string): void => {
    forward(screen, { key });
  };

  return {
    forward,
    back,
    resetTo,
    replaceTop,
    focusTabRoot,
    navigateToScreen,
  };
}

/** Pure helper: compute next history for a forward (tests). */
export function forwardShellHistory<T extends string>(
  history: ShellEntry<T>[],
  screen: T,
  opts?: ShellForwardOptions,
): ShellEntry<T>[] {
  const policy = opts?.policyOverride ?? getShellForwardPolicy(screen).forward;
  let mode: ShellNavigateOptions['mode'];
  switch (policy) {
    case 'reset':
      return pushShellEntry(history, screen, { mode: 'reset', key: opts?.key });
    case 'focus-root':
      mode = 'popToIfExists';
      break;
    case 'push':
    default:
      mode = 'push';
      break;
  }
  return pushShellEntry(history, screen, { mode, key: opts?.key });
}

export function shellHistoryDepth<T extends string>(history: ShellEntry<T>[]): number {
  return history.length;
}

export function shellHistoryCurrent<T extends string>(history: ShellEntry<T>[]): T {
  return shellCurrentScreen(history);
}
