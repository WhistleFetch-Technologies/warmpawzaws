import { dbUpsertLimits } from '../promo-engine.repo';

const mockSelect = jest.fn();
const mockUpdate = jest.fn();
const mockInsert = jest.fn();

jest.mock('../../../../database/rds-connection', () => ({
  query: jest.fn(),
  select: (...a: unknown[]) => mockSelect(...a),
  update: (...a: unknown[]) => mockUpdate(...a),
  insert: (...a: unknown[]) => mockInsert(...a),
}));

describe('dbUpsertLimits', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSelect.mockResolvedValue([
      {
        promotion_id: 'p1',
        per_user: 1,
        per_transaction: null,
        daily_limit: 5,
        campaign_limit: 100,
        budget_limit: 1000,
      },
    ]);
    mockUpdate.mockResolvedValue([{}]);
  });

  it('clears a limit when the admin blanks it (explicit null)', async () => {
    await dbUpsertLimits('p1', { per_user: null, daily_limit: null, budget_limit: 500 });
    const patch = mockUpdate.mock.calls[0][2] as Record<string, unknown>;
    expect(patch.per_user).toBeNull();
    expect(patch.daily_limit).toBeNull();
    expect(patch.budget_limit).toBe(500);
    expect(patch.campaign_limit).toBe(100);
  });
});
