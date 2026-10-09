import { readBenefitCapNotice, readPromoEngineFromQuote } from '../PromoEarnPreview';

const notice = {
  code: 'BENEFIT_CAP_REACHED',
  cap: 3,
  used: 3,
  blocked: { discount: true, cashback: true, wallet: true },
  platformFeeWaived: true,
  resumeAt: '2026-10-09T18:30:00.000Z',
  message: "You've used 3 offer payments in this period. Offers resume on 10 Oct at 12:00 AM.",
};

describe('readBenefitCapNotice', () => {
  it('reads the backend notice', () => {
    expect(readBenefitCapNotice(notice)).toEqual(notice);
  });

  it('ignores missing or message-less payloads', () => {
    expect(readBenefitCapNotice(null)).toBeNull();
    expect(readBenefitCapNotice({ cap: 3 })).toBeNull();
    expect(readBenefitCapNotice([notice])).toBeNull();
  });
});

describe('readPromoEngineFromQuote with a cap notice', () => {
  it('keeps the notice when the cap removed every benefit', () => {
    const pe = readPromoEngineFromQuote({
      promoEngine: { eligible: false, pendingCashback: 0, engineDiscount: 0, benefitCap: notice },
    });
    expect(pe?.eligible).toBe(false);
    expect(pe?.benefitCap?.message).toBe(notice.message);
    expect(pe?.benefitCap?.blocked.wallet).toBe(true);
  });

  it('has no notice when the customer is under the cap', () => {
    const pe = readPromoEngineFromQuote({ promoEngine: { eligible: true, engineDiscount: 100 } });
    expect(pe?.benefitCap).toBeNull();
  });
});
