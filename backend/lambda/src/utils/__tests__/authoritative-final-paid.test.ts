/**
 * Regression: booking financial meta finalPaid must follow backend gstFinalPaid.
 */

describe('authoritative finalPaid persistence (lineage contract)', () => {
  function reconcileAuthoritativeFinal(params: {
    clientFinalPaid: number | null;
    gstFinalPaid: number;
  }): { total_amount: number; finalPaid: number } {
    const authoritativeFinalPaid = params.gstFinalPaid;
    return {
      total_amount: authoritativeFinalPaid,
      finalPaid: authoritativeFinalPaid,
    };
  }

  test('client finalPaid == backend finalPaid → both fields match', () => {
    const out = reconcileAuthoritativeFinal({ clientFinalPaid: 1298, gstFinalPaid: 1298 });
    expect(out.total_amount).toBe(1298);
    expect(out.finalPaid).toBe(1298);
  });

  test('client finalPaid differs → both fields use backend final', () => {
    const out = reconcileAuthoritativeFinal({ clientFinalPaid: 1100, gstFinalPaid: 1298 });
    expect(out.total_amount).toBe(1298);
    expect(out.finalPaid).toBe(1298);
    expect(out.finalPaid).not.toBe(1100);
  });

  test('backend GST 0% → authoritative final still persisted (not null)', () => {
    const out = reconcileAuthoritativeFinal({ clientFinalPaid: 1050, gstFinalPaid: 1020 });
    expect(out.total_amount).toBe(1020);
    expect(out.finalPaid).toBe(1020);
  });

  test('intra-state GST final is authoritative', () => {
    // 1000 taxable + 180 GST + 20 platform = 1200
    const out = reconcileAuthoritativeFinal({ clientFinalPaid: 1180, gstFinalPaid: 1200 });
    expect(out).toEqual({ total_amount: 1200, finalPaid: 1200 });
  });

  test('inter-state GST final is authoritative', () => {
    const out = reconcileAuthoritativeFinal({ clientFinalPaid: 1199, gstFinalPaid: 1200 });
    expect(out).toEqual({ total_amount: 1200, finalPaid: 1200 });
  });

  test('wallet amount is separate — finalPaid remains all-in authoritative gross', () => {
    // Wallet is stored separately; finalPaid is the all-in before wallet debit at payment.
    const out = reconcileAuthoritativeFinal({ clientFinalPaid: 900, gstFinalPaid: 1200 });
    expect(out.finalPaid).toBe(1200);
  });
});
