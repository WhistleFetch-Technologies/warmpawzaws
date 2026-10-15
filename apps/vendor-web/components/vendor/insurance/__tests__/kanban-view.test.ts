import { filterApplications, kanbanStats, type BoardApplication } from '../kanban-view';

const rows: BoardApplication[] = [
  { id: '1', status: 'form_sent', column: 'in_progress', customer_name: 'Priya Sharma', company_name: 'HDFC ERGO', updated_at: '2026-10-02T00:00:00.000Z' },
  { id: '2', status: 'payment_link_sent', column: 'awaiting_payment', customer_name: 'Neha Kulkarni', company_name: 'HDFC ERGO', updated_at: '2026-10-10T00:00:00.000Z' },
  { id: '3', status: 'policy_confirmed', column: 'policy_issued', customer_name: 'Arjun Nair', company_name: 'Bajaj General', updated_at: '2026-10-11T00:00:00.000Z' },
  { id: '4', status: 'cancelled', column: 'closed', customer_name: 'Dropped', company_name: 'HDFC ERGO', updated_at: '2026-09-01T00:00:00.000Z' },
];

describe('vendor insurance kanban view', () => {
  it('filters by company, status, and search text', () => {
    expect(filterApplications(rows, 'priya', '', '').map((row) => row.id)).toEqual(['1']);
    expect(filterApplications(rows, '', 'Bajaj General', '').map((row) => row.id)).toEqual(['3']);
    expect(filterApplications(rows, '', '', 'payment_link_sent').map((row) => row.id)).toEqual(['2']);
  });

  it('counts active work, customer waits, payments, and this month issues', () => {
    const stats = kanbanStats(rows, new Date('2026-10-15T00:00:00.000Z'));
    expect(stats).toEqual({ active: 3, awaitingCustomer: 1, paymentPending: 1, completedThisPeriod: 1 });
  });
});
