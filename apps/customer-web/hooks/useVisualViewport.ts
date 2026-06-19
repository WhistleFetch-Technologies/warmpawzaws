'use client';

import { useEffect } from 'react';

/**
 * Listens to window.visualViewport resize/scroll events and writes two CSS
 * custom properties onto document.documentElement:
 *
 *   --vvh            current visual viewport height in px  (e.g. "520px")
 *   --keyboard-height  estimated on-screen keyboard height in px
 *
 * Safe to call on SSR – all window/document access is guarded.
 */
export function useVisualViewport(): void {
  useEffect(() => {
    if (typeof window === 'undefined' || !window.visualViewport) return;

    const vv = window.visualViewport;

    function update() {
      const height = vv.height;
      const keyboardHeight = Math.max(
        0,
        window.innerHeight - height - vv.offsetTop,
      );
      document.documentElement.style.setProperty('--vvh', `${height}px`);
      document.documentElement.style.setProperty(
        '--keyboard-height',
        `${keyboardHeight}px`,
      );
    }

    update();
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);

    return () => {
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
    };
  }, []);
}
