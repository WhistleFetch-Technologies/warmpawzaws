export type LeaveGuard = {
  id: string;
  /** When true, leaving is allowed without confirmation. */
  canLeave: () => boolean;
  confirmLeave: () => boolean | Promise<boolean>;
};

const guards: LeaveGuard[] = [];

export function registerLeaveGuard(guard: LeaveGuard): () => void {
  guards.push(guard);
  return () => {
    const idx = guards.indexOf(guard);
    if (idx >= 0) guards.splice(idx, 1);
  };
}

/** Returns false when user cancels a guard dialog. */
export async function requestLeave(): Promise<boolean> {
  for (const guard of guards) {
    if (guard.canLeave()) continue;
    try {
      const ok = await guard.confirmLeave();
      if (!ok) return false;
    } catch (err) {
      console.warn('[navigation] leave guard error:', guard.id, err);
      return false;
    }
  }
  return true;
}

export function clearLeaveGuards(): void {
  guards.length = 0;
}
