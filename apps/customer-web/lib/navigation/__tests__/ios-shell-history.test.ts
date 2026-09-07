import {
  clearBackHandlers,
  registerBackHandler,
} from '../back-handler-registry';
import {
  initIosShellHistoryBridge,
  markIosUrlReturnToShellPending,
  resetIosShellHistoryForTests,
  syncIosShellScreenReplace,
  syncIosShellStackDepth,
} from '../ios-shell-history';

describe('ios-shell-history', () => {
  beforeEach(() => {
    resetIosShellHistoryForTests();
    clearBackHandlers();
    window.history.replaceState({}, '', '/');
    (window as Window & { Capacitor?: { isNativePlatform: () => boolean; getPlatform: () => string } })
      .Capacitor = {
      isNativePlatform: () => true,
      getPlatform: () => 'ios',
    };
  });

  afterEach(() => {
    jest.restoreAllMocks();
    delete (window as Window & { Capacitor?: { isNativePlatform: () => boolean; getPlatform: () => string } })
      .Capacitor;
  });

  it('initIosShellHistoryBridge popstate on / skips shell back after URL child return', () => {
    markIosUrlReturnToShellPending();

    let consumed = false;
    registerBackHandler(() => {
      consumed = true;
      return true;
    }, 100);

    const cleanup = initIosShellHistoryBridge();
    window.dispatchEvent(new PopStateEvent('popstate'));
    expect(consumed).toBe(false);

    window.dispatchEvent(new PopStateEvent('popstate'));
    expect(consumed).toBe(true);

    cleanup();
  });

  it('initIosShellHistoryBridge popstate on / runs back handlers', () => {
    let consumed = false;
    registerBackHandler(() => {
      consumed = true;
      return true;
    }, 100);

    const cleanup = initIosShellHistoryBridge();

    window.dispatchEvent(new PopStateEvent('popstate'));
    expect(consumed).toBe(true);

    cleanup();
  });

  it('syncIosShellStackDepth pushes history when stack grows on /', () => {
    const pushSpy = jest.spyOn(window.history, 'pushState');

    syncIosShellStackDepth(1, 3, 'vet');

    expect(pushSpy).toHaveBeenCalledTimes(2);
  });

  it('syncIosShellStackDepth no-ops on Android', () => {
    (window as Window & { Capacitor?: { isNativePlatform: () => boolean; getPlatform: () => string } })
      .Capacitor = {
      isNativePlatform: () => true,
      getPlatform: () => 'android',
    };
    const pushSpy = jest.spyOn(window.history, 'pushState');

    syncIosShellStackDepth(1, 2, 'vet');

    expect(pushSpy).not.toHaveBeenCalled();
  });

  it('syncIosShellStackDepth(2, 1) syncs browser history with one history.back', () => {
    const replaceSpy = jest.spyOn(window.history, 'replaceState');
    const backSpy = jest.spyOn(window.history, 'back');

    syncIosShellStackDepth(2, 1, 'home');

    expect(backSpy).toHaveBeenCalledTimes(1);
    expect(replaceSpy).not.toHaveBeenCalled();
  });

  it('syncIosShellScreenReplace updates history state without push or back', () => {
    const replaceSpy = jest.spyOn(window.history, 'replaceState');
    const pushSpy = jest.spyOn(window.history, 'pushState');
    const backSpy = jest.spyOn(window.history, 'back');

    syncIosShellScreenReplace('payment');

    expect(replaceSpy).toHaveBeenCalledWith({ warmpawzShell: 'payment' }, '', '/');
    expect(pushSpy).not.toHaveBeenCalled();
    expect(backSpy).not.toHaveBeenCalled();
  });

  it('programmatic depth sync does not run back handlers when history.back fires popstate', () => {
    let handlerRuns = 0;
    registerBackHandler(() => {
      handlerRuns += 1;
      return true;
    }, 100);

    const cleanup = initIosShellHistoryBridge();

    jest.spyOn(window.history, 'back').mockImplementation(() => {
      window.dispatchEvent(new PopStateEvent('popstate'));
    });

    syncIosShellStackDepth(3, 2, 'vet');

    expect(handlerRuns).toBe(0);

    cleanup();
  });

  it('multi-step programmatic sync suppresses ALL popstates (not just first)', () => {
    let handlerRuns = 0;
    registerBackHandler(() => {
      handlerRuns += 1;
      return true;
    }, 100);

    const cleanup = initIosShellHistoryBridge();

    jest.spyOn(window.history, 'back').mockImplementation(() => {
      window.dispatchEvent(new PopStateEvent('popstate'));
    });

    syncIosShellStackDepth(4, 2, 'vet');

    expect(handlerRuns).toBe(0);

    cleanup();
  });

  it('user popstate still runs back handlers when not programmatic sync', () => {
    let handlerRuns = 0;
    registerBackHandler(() => {
      handlerRuns += 1;
      return true;
    }, 100);

    const cleanup = initIosShellHistoryBridge();

    window.dispatchEvent(new PopStateEvent('popstate'));

    expect(handlerRuns).toBe(1);

    cleanup();
  });
});
