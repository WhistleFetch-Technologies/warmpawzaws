export type BoardApplication = {
  id: string;
  booking_id?: string | null;
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

export const KANBAN_COLUMNS = [
  { id: 'new', title: 'New Application', tone: 'text-orange-600' },
  { id: 'in_progress', title: 'In Progress', tone: 'text-sky-600' },
  { id: 'awaiting_payment', title: 'Awaiting Payment', tone: 'text-amber-600' },
  { id: 'policy_issued', title: 'Policy Issued', tone: 'text-emerald-600' },
] as const;

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
