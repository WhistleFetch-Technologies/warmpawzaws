/**
 * Customer app: vet Emergency specialization is catalogued but booking is gated (Soon / disabled).
 * Centralize matching here so tiles, landings, and navigation guards stay aligned.
 * When you re-enable Emergency booking, relax or remove checks in this module first.
 */

export type EmergencyLockProblemShape = {
  id?: string;
  problemId?: string;
  name?: string;
  displayName?: string;
};

function norm(s: unknown): string {
  return String(s ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

/**
 * True when this row should show Soon and must not open the problem booking flow.
 */
export function isEmergencyProblemTileLocked(problem: EmergencyLockProblemShape): boolean {
  const id = norm(problem.id);
  const altId = norm(problem.problemId);
  const primaryId = id || altId;
  const label = norm(problem.displayName) || norm(problem.name);

  if (primaryId === 'emergency' || altId === 'emergency') return true;
  if (primaryId.endsWith('_emergency') || primaryId.endsWith('-emergency')) return true;
  if (primaryId && /\bemergency\b/i.test(primaryId)) return true;

  if (label === 'emergency' || label === 'emergency care') return true;
  if (label.startsWith('emergency ') && label.length <= 56) return true;

  return false;
}

/** Convenience when only id (+ optional label from the same field) is available. */
export function isEmergencyGridItemLocked(id: string, label?: string): boolean {
  return isEmergencyProblemTileLocked({ id, problemId: id, name: label, displayName: label });
}
