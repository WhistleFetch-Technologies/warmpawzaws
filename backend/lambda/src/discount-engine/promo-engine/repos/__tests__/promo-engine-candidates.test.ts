import { dbFindActiveCandidates } from '../promo-engine.repo';

jest.mock('../../../../database/rds-connection', () => ({
  query: jest.fn().mockResolvedValue({ rows: [] }),
  select: jest.fn(),
  insert: jest.fn(),
  update: jest.fn(),
}));

import { query } from '../../../../database/rds-connection';

const mockedQuery = query as jest.MockedFunction<typeof query>;

describe('dbFindActiveCandidates', () => {
  it('matches VET checkout token to veterinary aliases', async () => {
    await dbFindActiveCandidates({ now: new Date('2026-09-18T12:00:00Z'), serviceCategory: 'VET' });
    const params = mockedQuery.mock.calls[0]?.[1] as unknown[];
    expect(params[1]).toEqual(expect.arrayContaining(['veterinary', 'vet', 'VET']));
    expect(params[2]).toBeNull();
    expect(params[3]).toBeNull();
  });
});
