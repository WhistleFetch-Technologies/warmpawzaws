import { shouldSkipPromoEngineOnSlotCreate } from '../wappt-policy.constants';

describe('shouldSkipPromoEngineOnSlotCreate', () => {
  it('skips engine evaluate on WAPPT appointment-fee slots', () => {
    expect(
      shouldSkipPromoEngineOnSlotCreate({
        commerce_mode: 'warmpawz_appointments',
        service_type: 'clinic',
      })
    ).toBe(true);
  });

  it('still evaluates tele consults', () => {
    expect(
      shouldSkipPromoEngineOnSlotCreate({
        commerce_mode: 'warmpawz_appointments',
        service_type: 'tele',
      })
    ).toBe(false);
  });
});
