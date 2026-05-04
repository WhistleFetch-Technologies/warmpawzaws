import { buildSupportTicketsListQuery } from '../build-support-tickets-list-query';

function parenBalance(sql: string): number {
  let n = 0;
  for (const ch of sql) {
    if (ch === '(') n += 1;
    else if (ch === ')') n -= 1;
    if (n < 0) return -1;
  }
  return n;
}

describe('buildSupportTicketsListQuery', () => {
  it('balances parentheses for 10-digit customerPhone (last10 branch)', () => {
    const { sql, params } = buildSupportTicketsListQuery({
      customerPhone: '8780459376',
      limit: 50,
      offset: 0,
    });
    expect(parenBalance(sql)).toBe(0);
    expect(sql).toMatch(/ORDER BY created_at DESC LIMIT \$\d+ OFFSET \$\d+/);
    expect(params).toEqual([expect.any(String), expect.any(String), expect.any(String), 50, 0]);
  });

  it('matches customerId + phone with correct placeholder count', () => {
    const { sql, params } = buildSupportTicketsListQuery({
      customerId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
      customerPhone: '+918780459376',
      limit: 10,
      offset: 5,
    });
    expect(parenBalance(sql)).toBe(0);
    expect(params.length).toBe(6);
  });

  it('supports agent-only list (no customer filters)', () => {
    const { sql, params } = buildSupportTicketsListQuery({
      agentId: '550e8400-e29b-41d4-a716-446655440000',
      limit: 20,
      offset: 0,
    });
    expect(sql).toContain('assigned_to = $1');
    expect(params).toEqual(['550e8400-e29b-41d4-a716-446655440000', 20, 0]);
  });
});
