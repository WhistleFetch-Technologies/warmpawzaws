import type { VisitLoop } from './types';

/**
 * Completed count is stored. The payment in progress is not completed,
 * so the upcoming visit number is completedCount + 1. First visit ⇒ n = 1 ⇒ count 0.
 */
export function matchesVisitLoop(completedCount: number, loop: VisitLoop): boolean {
  const count = Math.max(0, Math.floor(Number(completedCount) || 0));
  const upcoming = count + 1;

  switch (loop.kind) {
    case 'every':
      return true;
    case 'visit_number': {
      const n = Math.max(1, Math.floor(Number(loop.n) || 1));
      return upcoming === n;
    }
    case 'from_onward': {
      const n = Math.max(1, Math.floor(Number(loop.n) || 1));
      return upcoming >= n;
    }
    case 'between': {
      const n = Math.max(1, Math.floor(Number(loop.n) || 1));
      const m = Math.max(n, Math.floor(Number(loop.m) || n));
      return upcoming >= n && upcoming <= m;
    }
    case 'every_nth': {
      const n = Math.max(1, Math.floor(Number(loop.n) || 1));
      return upcoming % n === 0;
    }
    default:
      return false;
  }
}
