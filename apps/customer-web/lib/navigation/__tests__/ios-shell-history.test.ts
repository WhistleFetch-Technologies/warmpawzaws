import {
  clearBackHandlers,
  registerBackHandler,
} from '../back-handler-registry';
import {
  initIosShellHistoryBridge,
  syncIosShellStackDepth,
} from '../ios-shell-history';

describe('ios-shell-history', () => {
  beforeEach(() => {
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
});
