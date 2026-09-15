import {
  decodeWpayTxnCursor,
  encodeWpayTxnCursor,
  toWpayTxnCursorTimestamp,
} from '../wpay-txn-cursor';

const PAYMENT_ID = '85e72e8c-bea7-47ce-aff8-6baa05da24d1';

describe('wpay-txn-cursor', () => {
  it('encodes a Date as ISO so Postgres timestamptz can parse the cursor', () => {
    const paidAt = new Date('2026-09-09T07:21:29.198Z');
    const cursor = encodeWpayTxnCursor(paidAt, PAYMENT_ID);
    expect(cursor).toBe('2026-09-09T07:21:29.198Z|85e72e8c-bea7-47ce-aff8-6baa05da24d1');
    expect(cursor).not.toMatch(/GMT|Coordinated Universal Time/);
  });

  it('decodes the Date#toString() cursor that currently 500s Load more', () => {
    const broken =
      'Wed Sep 09 2026 07:21:29 GMT+0000 (Coordinated Universal Time)|' + PAYMENT_ID;
    const decoded = decodeWpayTxnCursor(broken);
    expect(decoded?.paymentId).toBe(PAYMENT_ID);
    expect(decoded?.paidAt).toBe(new Date('Wed Sep 09 2026 07:21:29 GMT+0000 (Coordinated Universal Time)').toISOString());
  });

  it('round-trips ISO cursors', () => {
    const cursor = encodeWpayTxnCursor('2026-09-10T11:43:18.713Z', PAYMENT_ID);
    expect(decodeWpayTxnCursor(cursor ?? '')).toEqual({
      paidAt: '2026-09-10T11:43:18.713Z',
      paymentId: PAYMENT_ID,
    });
  });

  it('rejects empty or unparseable values', () => {
    expect(toWpayTxnCursorTimestamp('not-a-date')).toBeNull();
    expect(encodeWpayTxnCursor(new Date('2026-09-09T07:21:29.198Z'), '')).toBeNull();
    expect(decodeWpayTxnCursor('no-pipe-here')).toBeNull();
  });
});
