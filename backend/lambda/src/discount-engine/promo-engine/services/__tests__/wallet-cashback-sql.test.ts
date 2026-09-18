import {
  buildCustomerWalletCreateSql,
  buildPromoLedgerInsert,
  promoCreditUsesLiveWalletIdOnly,
} from '../wallet-cashback-sql';

describe('wallet-cashback-sql', () => {
  it('creates a wallet without currency on live 001 columns', () => {
    const { sql, values } = buildCustomerWalletCreateSql(
      new Set(['id', 'customer_id', 'balance', 'created_at', 'updated_at', 'total_earned'])
    );
    expect(sql).toMatch(/INSERT INTO customer_wallets \(customer_id, balance\)/);
    expect(sql).not.toMatch(/currency/);
    expect(values).toEqual([null, 0]);
  });

  it('omits customer_id from live ledger inserts', () => {
    const live = new Set([
      'id',
      'wallet_id',
      'transaction_type',
      'amount',
      'balance_after',
      'reference_type',
      'reference_id',
      'description',
      'promotion_id',
      'source',
      'remaining_amount',
      'earned_at',
      'expires_at',
      'cashback_status',
      'redeem_scope',
    ]);
    expect(promoCreditUsesLiveWalletIdOnly(live)).toBe(true);
    const { columns } = buildPromoLedgerInsert({ wtCols: live, includeCustomerId: true });
    expect(columns).toContain('wallet_id');
    expect(columns).not.toContain('customer_id');
    expect(columns).toContain('promotion_id');
    expect(columns).toContain('cashback_status');
  });

  it('keeps customer_id when that column exists', () => {
    const dual = new Set(['wallet_id', 'customer_id', 'transaction_type', 'amount', 'balance_after']);
    const { columns } = buildPromoLedgerInsert({ wtCols: dual, includeCustomerId: true });
    expect(columns).toEqual([
      'wallet_id',
      'customer_id',
      'transaction_type',
      'amount',
      'balance_after',
    ]);
  });
});
