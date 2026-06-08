import { useCallback, useState } from 'react';
import type { ShellEntry, ShellNavigateOptions } from './types';

export function pushShellEntry<T extends string>(
  history: ShellEntry<T>[],
  screen: T,
  options?: ShellNavigateOptions,
): ShellEntry<T>[] {
  const mode = options?.mode ?? 'popToIfExists';

  if (options?.key) {
    const keyIdx = history.findIndex((e) => e.key === options.key);
    if (keyIdx >= 0) {
      return history.slice(0, keyIdx + 1);
    }
  }

  const currentEntry = history[history.length - 1];
  const current = currentEntry?.screen;
  if (current === screen) {
    const sameKey =
      !options?.key ||
      (currentEntry?.key != null && currentEntry.key === options.key);
    if (sameKey) {
      return history;
    }
    // Same screen type, different entity key — append (e.g. Clinic A → Clinic B).
  }

  if (mode === 'reset') {
    return [{ screen, key: options?.key }];
  }

  if (mode === 'popToIfExists') {
    const idx = history.findIndex((e) => e.screen === screen);
    if (idx >= 0 && idx < history.length - 1) {
      return history.slice(0, idx + 1);
    }
  }

  return [...history, { screen, key: options?.key }];
}

export function popShellEntry<T extends string>(history: ShellEntry<T>[]): ShellEntry<T>[] {
  if (history.length <= 1) {
    return history;
  }
  return history.slice(0, -1);
}

export function resetShellStack<T extends string>(screen: T, key?: string): ShellEntry<T>[] {
  return [{ screen, key }];
}

export function shellCurrentScreen<T extends string>(history: ShellEntry<T>[]): T {
  return history[history.length - 1]?.screen ?? ('home' as T);
}

export function shellCanPop<T extends string>(history: ShellEntry<T>[]): boolean {
  return history.length > 1;
}

export function shellScreenHistory<T extends string>(history: ShellEntry<T>[]): T[] {
  return history.map((e) => e.screen);
}

export function useShellNavigationStack<T extends string>(initialScreen: T) {
  const [history, setHistory] = useState<ShellEntry<T>[]>(() => [{ screen: initialScreen }]);

  const currentScreen = shellCurrentScreen(history);
  const canPop = shellCanPop(history);
  const navigationHistory = shellScreenHistory(history);

  const setCurrentScreen = useCallback((screen: T, options?: ShellNavigateOptions) => {
    setHistory((prev) => pushShellEntry(prev, screen, options));
  }, []);

  const pushScreen = setCurrentScreen;

  const popScreen = useCallback(() => {
    setHistory((prev) => popShellEntry(prev));
  }, []);

  const resetStack = useCallback((screen: T = initialScreen) => {
    setHistory(resetShellStack(screen));
  }, [initialScreen]);

  const replaceTop = useCallback((screen: T, key?: string) => {
    setHistory((prev) => {
      if (prev.length === 0) {
        return [{ screen, key }];
      }
      const next = [...prev];
      next[next.length - 1] = { screen, key };
      return next;
    });
  }, []);

  const popOrReset = useCallback((fallback: T, onAfter?: (newCurrent: T) => void) => {
    setHistory((prev) => {
      const next = prev.length > 1 ? popShellEntry(prev) : resetShellStack(fallback);
      onAfter?.(shellCurrentScreen(next));
      return next;
    });
  }, []);

  return {
    history,
    currentScreen,
    navigationHistory,
    canPop,
    setCurrentScreen,
    pushScreen,
    popScreen,
    resetStack,
    replaceTop,
    popOrReset,
    setHistory,
  };
}
