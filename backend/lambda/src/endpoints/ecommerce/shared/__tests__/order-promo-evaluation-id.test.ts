import { readOrderPromoEvaluationId } from '../order-promo-evaluation-id';

describe('readOrderPromoEvaluationId', () => {
  it('reads the top-level evaluation id', () => {
    expect(readOrderPromoEvaluationId({ evaluationId: 'ev-1' })).toBe('ev-1');
  });

  it('falls back to promoEngine.evaluationId', () => {
    expect(readOrderPromoEvaluationId({ promoEngine: { evaluationId: 'ev-2' } })).toBe('ev-2');
  });

  it('parses JSON string metadata', () => {
    expect(readOrderPromoEvaluationId(JSON.stringify({ evaluationId: 'ev-3' }))).toBe('ev-3');
  });

  it('returns null for missing, blank or malformed metadata', () => {
    expect(readOrderPromoEvaluationId(null)).toBeNull();
    expect(readOrderPromoEvaluationId({})).toBeNull();
    expect(readOrderPromoEvaluationId({ evaluationId: '  ' })).toBeNull();
    expect(readOrderPromoEvaluationId('{not json')).toBeNull();
  });
});
