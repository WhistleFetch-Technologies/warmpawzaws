import {
  createShellNavigationService,
  forwardShellHistory,
} from '../shell-navigation-service';
import { getShellForwardPolicy } from '../shell-route-policies';
import type { ShellEntry } from '../types';

type Screen =
  | 'home'
  | 'vet'
  | 'vet-clinic-list'
  | 'vet-clinic-profile'
  | 'my-bookings'
  | 'purchase-package'
  | 'vet-tele-consultation'
  | 'payment'
  | 'customer-profile';

function makeDeps(initial: ShellEntry<Screen>[] = [{ screen: 'home' }]) {
  let history = [...initial];
  let currentScreen = history[history.length - 1].screen;

  const syncCurrent = () => {
    currentScreen = history[history.length - 1]?.screen ?? 'home';
  };

  const setHistory = (updater: (prev: ShellEntry<Screen>[]) => ShellEntry<Screen>[]) => {
    history = updater(history);
    syncCurrent();
  };

  const setCurrentScreen = (screen: Screen, options?: { mode?: string; key?: string }) => {
    const { pushShellEntry } = require('../shell-stack');
    history = pushShellEntry(history, screen, options as any);
    syncCurrent();
  };

  const resetStack = (screen: Screen = 'home') => {
    history = [{ screen }];
    syncCurrent();
  };

  const popOrReset = (fallback: Screen, onAfter?: (s: Screen) => void) => {
    const { popShellEntry, resetShellStack } = require('../shell-stack');
    history = history.length > 1 ? popShellEntry(history) : resetShellStack(fallback);
    syncCurrent();
    onAfter?.(currentScreen);
  };

  const replaceTop = (screen: Screen, key?: string) => {
    if (history.length === 0) {
      history = [{ screen, key }];
    } else {
      history = [...history.slice(0, -1), { screen, key }];
    }
    syncCurrent();
  };

  const deps = {
    get currentScreen() {
      return currentScreen;
    },
    get history() {
      return history;
    },
    setCurrentScreen,
    setHistory,
    resetStack,
    popOrReset,
    replaceTop,
  };

  return { deps, getHistory: () => history, getCurrent: () => currentScreen };
}

describe('shell-route-policies', () => {
  it('vet hub uses focus-root', () => {
    expect(getShellForwardPolicy('vet').forward).toBe('focus-root');
  });

  it('clinic profile uses push with key requirement', () => {
    const p = getShellForwardPolicy('vet-clinic-profile');
    expect(p.forward).toBe('push');
    expect(p.requiresKey).toBe(true);
  });

  it('purchase-package uses replace', () => {
    expect(getShellForwardPolicy('purchase-package').forward).toBe('replace');
  });
});

describe('forwardShellHistory', () => {
  it('focus-root truncates duplicate vet hub', () => {
    const start: ShellEntry<Screen>[] = [
      { screen: 'home' },
      { screen: 'vet' },
      { screen: 'vet-clinic-list' },
    ];
    const next = forwardShellHistory(start, 'vet');
    expect(next).toHaveLength(2);
    expect(next[next.length - 1].screen).toBe('vet');
  });

  it('push appends entity clinic profile', () => {
    const start: ShellEntry<Screen>[] = [
      { screen: 'home' },
      { screen: 'vet' },
      { screen: 'vet-clinic-profile', key: 'clinic:a' },
    ];
    const next = forwardShellHistory(start, 'vet-clinic-profile', {
      key: 'clinic:b',
      policyOverride: 'push',
    });
    expect(next).toHaveLength(4);
  });
});

describe('createShellNavigationService', () => {
  it('forward to vet hub focuses existing entry', () => {
    const { deps, getHistory } = makeDeps([
      { screen: 'home' },
      { screen: 'vet' },
      { screen: 'vet-clinic-list' },
    ]);
    const nav = createShellNavigationService(deps);
    nav.forward('vet');
    expect(getHistory()).toHaveLength(2);
    expect(getHistory()[1].screen).toBe('vet');
  });

  it('replaceTop swaps purchase-package without growing stack', () => {
    const { deps, getHistory } = makeDeps([
      { screen: 'home' },
      { screen: 'vet' },
    ]);
    const nav = createShellNavigationService(deps);
    nav.replaceTop('purchase-package', 'package:abc');
    expect(getHistory()).toHaveLength(2);
    expect(getHistory()[1].screen).toBe('purchase-package');
  });

  it('back pops one level', () => {
    const { deps, getHistory } = makeDeps([
      { screen: 'home' },
      { screen: 'vet' },
    ]);
    const nav = createShellNavigationService(deps);
    nav.back();
    expect(getHistory()).toHaveLength(1);
  });

  it('focusTabRoot bookings uses focus-root not push duplicate', () => {
    const { deps, getHistory } = makeDeps([
      { screen: 'home' },
      { screen: 'my-bookings' },
      { screen: 'vet' },
    ]);
    const nav = createShellNavigationService(deps);
    nav.focusTabRoot('bookings');
    const h = getHistory();
    expect(h[h.length - 1].screen).toBe('my-bookings');
    expect(h.filter((e) => e.screen === 'my-bookings')).toHaveLength(1);
  });

  it('resetTo home clears stack', () => {
    const { deps, getHistory } = makeDeps([
      { screen: 'home' },
      { screen: 'vet' },
    ]);
    const nav = createShellNavigationService(deps);
    nav.resetTo('home');
    expect(getHistory()).toEqual([{ screen: 'home' }]);
  });

  it('depth collapse resets when stack exceeds maxDepth', () => {
    const deep: ShellEntry<Screen>[] = [{ screen: 'home' }];
    for (let i = 0; i < 20; i += 1) {
      deep.push({ screen: 'vet-clinic-profile', key: `clinic:${i}` });
    }
    const { deps, getHistory } = makeDeps(deep);
    expect(getHistory()).toHaveLength(21);

    const nav = createShellNavigationService(deps);
    nav.forward('vet-clinic-profile', { key: 'clinic:overflow', policyOverride: 'push' });

    expect(getHistory()).toHaveLength(1);
    expect(getHistory()[0].screen).toBe('vet-clinic-profile');
    expect(getHistory()[0].key).toBeUndefined();
  });

  it('oscillation A-B-A-B collapses stack to last screen', () => {
    const { deps, getHistory } = makeDeps([{ screen: 'home' }]);
    const nav = createShellNavigationService(deps);

    nav.forward('vet-clinic-profile', { key: 'clinic:a', policyOverride: 'push' });
    nav.forward('vet-clinic-profile', { key: 'clinic:b', policyOverride: 'push' });
    nav.forward('vet-clinic-profile', { key: 'clinic:a', policyOverride: 'push' });
    nav.forward('vet-clinic-profile', { key: 'clinic:b', policyOverride: 'push' });

    expect(getHistory()).toHaveLength(1);
    expect(getHistory()[0].screen).toBe('vet-clinic-profile');
  });

  it('tab re-tap bookings from deep stack focuses single my-bookings entry', () => {
    const { deps, getHistory } = makeDeps([
      { screen: 'home' },
      { screen: 'my-bookings' },
      { screen: 'vet' },
      { screen: 'vet-clinic-profile', key: 'clinic:x' },
    ]);
    const nav = createShellNavigationService(deps);
    nav.focusTabRoot('bookings');
    nav.focusTabRoot('bookings');

    const h = getHistory();
    expect(h[h.length - 1].screen).toBe('my-bookings');
    expect(h.filter((e) => e.screen === 'my-bookings')).toHaveLength(1);
    expect(h.length).toBeLessThan(4);
  });

  it('payment replace then tele restore keeps home + wizard depth', () => {
    const { deps, getHistory } = makeDeps([
      { screen: 'home' },
      { screen: 'vet-tele-consultation' },
    ]);
    const nav = createShellNavigationService(deps);
    nav.replaceTop('payment');
    expect(getHistory()).toEqual([
      { screen: 'home' },
      { screen: 'payment' },
    ]);
    nav.replaceTop('vet-tele-consultation');
    expect(getHistory()).toEqual([
      { screen: 'home' },
      { screen: 'vet-tele-consultation' },
    ]);
  });

  it('account menu back pops once instead of resetStack home', () => {
    const deepStack: ShellEntry<Screen>[] = [
      { screen: 'home' },
      { screen: 'vet' },
      { screen: 'customer-profile' },
      { screen: 'my-bookings' },
    ];
    const { deps: popDeps, getHistory: getPopHistory } = makeDeps(deepStack);
    const popNav = createShellNavigationService(popDeps);
    popNav.back();
    expect(getPopHistory()).toHaveLength(3);
    expect(getPopHistory()[2].screen).toBe('customer-profile');

    const { deps: resetDeps, getHistory: getResetHistory } = makeDeps(deepStack);
    const resetNav = createShellNavigationService(resetDeps);
    resetNav.resetTo('home');
    expect(getResetHistory()).toEqual([{ screen: 'home' }]);
  });
});
