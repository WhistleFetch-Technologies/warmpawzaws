import { supportTicketListRowIndicatesUnread } from '../customer-message-unread';

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

  it('returns true when never viewed and has tip timestamp', () => {
    expect(
      supportTicketListRowIndicatesUnread({
        id: 't2',
        status: 'open',
        updated_at: '2026-07-14T12:00:00.000Z',
      })
    ).toBe(true);
  });

  it('returns false when customer_viewed_at is after tip', () => {
    expect(
      supportTicketListRowIndicatesUnread({
        id: 't3',
        status: 'open',
        updated_at: '2026-07-14T12:00:00.000Z',
        customer_viewed_at: '2026-07-14T13:00:00.000Z',
      })
    ).toBe(false);
  });
});
