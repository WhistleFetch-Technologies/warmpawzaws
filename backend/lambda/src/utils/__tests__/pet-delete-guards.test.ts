import {
  buildPetMealDeleteBlockMessage,
  type PetMealDeleteBlockers,
} from '../pet-delete-guards';

describe('buildPetMealDeleteBlockMessage', () => {
  it('returns null when no meal blockers', () => {
    expect(
      buildPetMealDeleteBlockMessage('Lina', {
        pendingMealOrdersCount: 0,
        activeMealSubscriptionsCount: 0,
      })
    ).toBeNull();
  });

  it('describes pending meal orders', () => {
    const msg = buildPetMealDeleteBlockMessage('Lina', {
      pendingMealOrdersCount: 2,
      activeMealSubscriptionsCount: 0,
    });
    expect(msg).toContain('Lina');
    expect(msg).toContain('2 meal order(s)');
    expect(msg).toContain('waiting to be delivered');
  });

  it('describes active meal subscriptions', () => {
    const msg = buildPetMealDeleteBlockMessage('Lina', {
      pendingMealOrdersCount: 0,
      activeMealSubscriptionsCount: 1,
    });
    expect(msg).toContain('meal plan subscription');
    expect(msg).toContain('upcoming deliveries');
  });
});
