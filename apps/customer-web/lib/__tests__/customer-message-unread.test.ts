import {
  markSupportThreadSeenInBrowser,
  supportTicketListRowIndicatesUnread,
} from '../customer-message-unread';

describe('supportTicketListRowIndicatesUnread', () => {
  const originalLocalStorage = global.localStorage;

  beforeEach(() => {
    const store = new Map<string, string>();
    Object.defineProperty(global, 'localStorage', {
      configurable: true,
      value: {
        getItem: (k: string) => store.get(k) ?? null,
        setItem: (k: string, v: string) => store.set(k, v),
        removeItem: (k: string) => store.delete(k),
      },
    });
  });

  afterAll(() => {
    Object.defineProperty(global, 'localStorage', {
      configurable: true,
      value: originalLocalStorage,
    });
  });

  it('returns false for closed tickets', () => {
    expect(
      supportTicketListRowIndicatesUnread({
        id: 't1',
        status: 'closed',
        updated_at: new Date().toISOString(),
      })
    ).toBe(false);
  });

  it('returns true when never viewed and has last_message_at', () => {
    expect(
      supportTicketListRowIndicatesUnread({
        id: 't2',
        status: 'open',
        last_message_at: '2026-07-14T12:00:00.000Z',
      })
    ).toBe(true);
  });

  it('returns false when customer_viewed_at is after tip', () => {
    expect(
      supportTicketListRowIndicatesUnread({
        id: 't3',
        status: 'open',
        last_message_at: '2026-07-14T12:00:00.000Z',
        customer_viewed_at: '2026-07-14T13:00:00.000Z',
      })
    ).toBe(false);
  });

  it('does not inflate badge from updated_at alone when last_message_at is missing', () => {
    expect(
      supportTicketListRowIndicatesUnread({
        id: 't4',
        status: 'open',
        updated_at: '2026-07-14T12:00:00.000Z',
      })
    ).toBe(false);
  });

  it('returns true when updated_at is newer than message but customer has not viewed', () => {
    expect(
      supportTicketListRowIndicatesUnread({
        id: 't5',
        status: 'open',
        last_message_at: '2026-07-14T10:00:00.000Z',
        updated_at: '2026-07-14T12:00:00.000Z',
      })
    ).toBe(true);
  });

  it('returns false after markSupportThreadSeenInBrowser even when updated_at is newer than last message', () => {
    const ticketId = 't6';
    markSupportThreadSeenInBrowser(ticketId, {
      ticket: { message: 'help', created_at: '2026-07-14T10:00:00.000Z' },
      responses: [
        {
          responder_type: 'agent',
          created_at: '2026-07-14T10:00:00.000Z',
        },
      ],
    });
    expect(
      supportTicketListRowIndicatesUnread({
        id: ticketId,
        status: 'open',
        last_message_at: '2026-07-14T10:00:00.000Z',
        updated_at: '2026-07-14T12:00:00.000Z',
      })
    ).toBe(false);
  });
});
