import { omitMissingPetsColumns, petsTableHasColumn } from '../pets-table-schema';

jest.mock('../../database/rds-connection', () => ({
  query: jest.fn(),
}));

import { query } from '../../database/rds-connection';

const mockQuery = query as jest.MockedFunction<typeof query>;

function mockColumnExists(column: string, exists: boolean) {
  mockQuery.mockImplementation(async (_sql: string, params?: unknown[]) => {
    const col = (params as string[])?.[0];
    return {
      rows: [{ exists: col === column ? exists : false }],
    } as unknown as Awaited<ReturnType<typeof query>>;
  });
}

describe('petsTableHasColumn', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns false when vaccination_records column is absent', async () => {
    mockColumnExists('vaccination_records', false);
    expect(await petsTableHasColumn('vaccination_records')).toBe(false);
  });
});

describe('omitMissingPetsColumns', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('strips vaccination_records and microchip_id when columns missing on prod schema', async () => {
    mockQuery.mockImplementation(async (_sql: string, params?: unknown[]) => {
      const col = (params as string[])?.[0];
      const exists = col === 'medical_history';
      return {
        rows: [{ exists }],
      } as unknown as Awaited<ReturnType<typeof query>>;
    });

    const out = await omitMissingPetsColumns({
      name: 'Mac',
      medical_history: { vaccinationDates: { rabies: '2025-06-03' } },
      vaccination_records: { rabies: '2025-06-03' },
      microchip_id: 'CHIP1',
    });

    expect(out.name).toBe('Mac');
    expect(out.medical_history).toBeDefined();
    expect(out.vaccination_records).toBeUndefined();
    expect(out.microchip_id).toBeUndefined();
  });
});
