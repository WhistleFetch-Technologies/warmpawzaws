/** Run work after first paint without blocking the home shell. */
export function scheduleIdleWork(fn: () => void, timeoutMs = 2500): () => void {
  if (typeof window === 'undefined') {
    return () => {};
  }
  let cancelled = false;
  const run = () => {
    if (!cancelled) fn();
  };
  const handle =
    'requestIdleCallback' in window
      ? window.requestIdleCallback(run, { timeout: timeoutMs })
      : window.setTimeout(run, 0);
  return () => {
    cancelled = true;
    if ('cancelIdleCallback' in window && typeof handle === 'number') {
      window.cancelIdleCallback(handle);
    } else {
      clearTimeout(handle as ReturnType<typeof setTimeout>);
    }
  };
}
