import {
  canTransitionInsuranceStatus,
  INSURANCE_KANBAN_COLUMN,
  INSURANCE_STATUS_TRANSITIONS,
  normalizeInsuranceStatus,
  type InsuranceApplicationStatus,
  type InsuranceKanbanColumn,
} from '@warmpawz/shared-types';

export type BoardApplication = {
  id: string;
  booking_id?: string | null;
  booking_status?: string | null;
  status: string;
  column?: string;
  plan_name?: string;
  company_name?: string;
  customer_name?: string;
  pet_name?: string;
  pet_species?: string;
  pet_breed?: string;
  updated_at?: string;
  payment_link_expires_at?: string | null;
};

/** Status-only transitions that DnD / transition endpoint can perform without payloads. */
export const STATUS_ONLY_TRANSITIONS = new Set<InsuranceApplicationStatus>([
  'consulted',
  'form_confirmed',
  'dropped',
  'cancelled',
]);

export const KANBAN_COLUMNS = [
  { id: 'new', title: 'New Application', tone: 'text-orange-600' },
  { id: 'in_progress', title: 'In Progress', tone: 'text-sky-600' },
  { id: 'awaiting_payment', title: 'Awaiting Payment', tone: 'text-amber-600' },
  { id: 'policy_issued', title: 'Policy Issued', tone: 'text-emerald-600' },
  { id: 'closed', title: 'Archive', tone: 'text-gray-600' },
] as const;

export type KanbanColumnId = (typeof KANBAN_COLUMNS)[number]['id'];

export function applicationSearchText(row: BoardApplication): string {
  return [row.customer_name, row.pet_name, row.pet_breed, row.company_name, row.plan_name, row.status, row.id]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

export function filterApplications(
  rows: BoardApplication[],
  query: string,
  company: string,
  status: string,
): BoardApplication[] {
  const needle = query.trim().toLowerCase();
  return rows.filter((row) => {
    if (company && row.company_name !== company) return false;
    if (status && row.status !== status) return false;
    if (needle && !applicationSearchText(row).includes(needle)) return false;
    return true;
  });
}

export function kanbanStats(rows: BoardApplication[], now = new Date()) {
  const month = now.getMonth();
  const year = now.getFullYear();
  const inMonth = (value?: string) => {
    if (!value) return false;
    const date = new Date(value);
    return date.getMonth() === month && date.getFullYear() === year;
  };
  return {
    active: rows.filter((row) => row.column !== 'closed').length,
    awaitingCustomer: rows.filter((row) => row.status === 'form_sent' || row.status === 'changes_requested').length,
    paymentPending: rows.filter((row) => row.column === 'awaiting_payment').length,
    completedThisPeriod: rows.filter((row) => row.column === 'policy_issued' && inMonth(row.updated_at)).length,
  };
}

export function isBookingCompleted(bookingStatus?: string | null): boolean {
  return String(bookingStatus || '').toLowerCase() === 'completed';
}

/**
 * Resolve a swimlane drop to a single status-only transition, or null when
 * the move is invalid / needs a payload (quote, form, payment, policy).
 */
export function resolveDropTransition(
  fromStatusRaw: string,
  targetColumn: string,
): InsuranceApplicationStatus | null {
  const from = normalizeInsuranceStatus(fromStatusRaw);
  if (!from) return null;
  const target = targetColumn as InsuranceKanbanColumn;
  if (!KANBAN_COLUMNS.some((col) => col.id === target)) return null;

  const currentColumn = INSURANCE_KANBAN_COLUMN[from];
  if (currentColumn === target) return null;

  const allowed = INSURANCE_STATUS_TRANSITIONS[from].filter(
    (to) => STATUS_ONLY_TRANSITIONS.has(to) && INSURANCE_KANBAN_COLUMN[to] === target && canTransitionInsuranceStatus(from, to),
  );
  if (!allowed.length) return null;

  if (target === 'closed') {
    if (allowed.includes('dropped')) return 'dropped';
    if (allowed.includes('cancelled')) return 'cancelled';
    return allowed[0] ?? null;
  }

  return allowed[0] ?? null;
}
