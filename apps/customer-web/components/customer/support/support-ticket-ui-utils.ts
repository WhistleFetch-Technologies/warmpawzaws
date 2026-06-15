export type TicketFilterValue =
  | 'all'
  | 'open'
  | 'resolved'
  | 'closed'
  | 'booking'
  | 'general';

export type TicketCategoryKind = 'booking' | 'meal_order' | 'general' | 'billing';

export function formatTicketStatusLabel(status: string): string {
  const s = (status || 'open').trim();
  return s
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

export function statusBadgeClasses(status: string): string {
  switch (status) {
    case 'awaiting_assignment':
    case 'ai_acknowledged':
      return 'bg-orange-100 text-orange-800';
    case 'open':
    case 'in_progress':
    case 'assigned':
    case 'waiting_for_customer':
      return 'bg-yellow-100 text-yellow-800';
    case 'resolved':
      return 'bg-green-100 text-green-800';
    case 'closed':
      return 'bg-gray-100 text-gray-600';
    case 'escalated':
      return 'bg-red-100 text-red-800';
    default:
      return 'bg-gray-100 text-gray-600';
  }
}

export function resolveTicketCategory(ticket: {
  booking_id?: string;
  category?: string;
  metadata?: Record<string, unknown>;
}): TicketCategoryKind {
  const meta = ticket.metadata;
  const isMealOrder = meta?.ticket_type === 'meal_order';
  if (isMealOrder) return 'meal_order';
  const isBooking =
    Boolean(ticket.booking_id) ||
    meta?.ticket_type === 'booking' ||
    meta?.ticket_type === 'Booking';
  if (isBooking) return 'booking';
  const cat = (ticket.category || '').toLowerCase();
  if (cat === 'billing') return 'billing';
  return 'general';
}

export function categoryBadgeClasses(kind: TicketCategoryKind): string {
  switch (kind) {
    case 'booking':
      return 'bg-blue-100 text-blue-700';
    case 'meal_order':
      return 'bg-emerald-100 text-emerald-700';
    case 'billing':
      return 'bg-purple-100 text-purple-700';
    default:
      return 'bg-gray-100 text-gray-600';
  }
}

export function categoryLabel(kind: TicketCategoryKind): string {
  switch (kind) {
    case 'booking':
      return 'Booking';
    case 'meal_order':
      return 'Meal order';
    case 'billing':
      return 'Billing';
    default:
      return 'General';
  }
}

export function formatTicketDisplayId(ticket: {
  ticket_number?: string;
  id: string;
}): string {
  if (ticket.ticket_number?.trim()) return ticket.ticket_number.trim();
  return ticket.id.slice(0, 8);
}

export function isOpenTicketStatus(status: string): boolean {
  return [
    'open',
    'in_progress',
    'awaiting_assignment',
    'ai_acknowledged',
    'assigned',
    'waiting_for_customer',
    'escalated',
  ].includes(status);
}

export function matchesTicketFilter(
  ticket: {
    status: string;
    booking_id?: string;
    category?: string;
    metadata?: Record<string, unknown>;
  },
  filter: TicketFilterValue
): boolean {
  if (filter === 'all') return true;
  if (filter === 'open') return isOpenTicketStatus(ticket.status);
  if (filter === 'resolved') return ticket.status === 'resolved';
  if (filter === 'closed') return ticket.status === 'closed';
  if (filter === 'booking') return resolveTicketCategory(ticket) === 'booking';
  if (filter === 'general') return resolveTicketCategory(ticket) === 'general';
  return true;
}

export function formatTicketDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(undefined, {
    month: 'numeric',
    day: 'numeric',
    year: 'numeric',
  });
}

export function formatMessageTimestamp(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString(undefined, {
    month: 'numeric',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}
