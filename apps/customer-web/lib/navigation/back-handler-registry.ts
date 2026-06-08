export type BackHandler = () => boolean;

type RegisteredHandler = {
  handler: BackHandler;
  priority: number;
};

const handlers: RegisteredHandler[] = [];

/** Higher priority runs first. Return true when the back press is consumed. */
export function registerBackHandler(handler: BackHandler, priority = 0): () => void {
  const entry: RegisteredHandler = { handler, priority };
  handlers.push(entry);
  handlers.sort((a, b) => b.priority - a.priority);

  return () => {
    const idx = handlers.indexOf(entry);
    if (idx >= 0) handlers.splice(idx, 1);
  };
}

export function runBackHandlers(): boolean {
  for (const { handler } of handlers) {
    try {
      if (handler()) return true;
    } catch (err) {
      console.warn('[navigation] back handler error:', err);
    }
  }
  return false;
}

export function clearBackHandlers(): void {
  handlers.length = 0;
}

/** Registry priorities — higher runs first. */
export const BACK_HANDLER_PRIORITY = {
  /** Multi-step booking routers (datetime/pet steps) before shell stack pop. */
  shellWizardStep: 105,
  shellOverlay: 100,
  urlHistory: 50,
  minimizeApp: 10,
} as const;
