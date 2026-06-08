import type { MutableRefObject } from 'react';

/**
 * Wizard-first back: invoke in-screen step back when registered, else shell fallback.
 * Use for hardware back and layout headers — NOT as a router's `onBack` prop.
 * Routers call `onBack` at the wizard root to exit; wrapping that with this helper
 * causes infinite recursion (internal back → onBack → internal back → …).
 */
export function wizardBackOrShell(
  internalBackRef: MutableRefObject<(() => void) | null>,
  shellFallback: () => void,
): void {
  const internal = internalBackRef.current;
  if (internal) {
    internal();
    return;
  }
  shellFallback();
}
