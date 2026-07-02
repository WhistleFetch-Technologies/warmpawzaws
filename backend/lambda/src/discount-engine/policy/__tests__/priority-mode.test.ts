import {
  getPriorityMode,
  isPriorityAuthoritative,
  isPriorityEnabled,
  isPriorityShadowEnabled,
} from '../priority-mode';

describe('priority-mode', () => {
  const envBackup = { ...process.env };

  afterEach(() => {
    process.env = { ...envBackup };
  });

  it('defaults to AUTHORITATIVE', () => {
    delete process.env.DISCOUNT_ENGINE_V2_PRIORITY_MODE;
    delete process.env.DISCOUNT_ENGINE_V2_PRIORITY_SHADOW;
    expect(getPriorityMode()).toBe('AUTHORITATIVE');
    expect(isPriorityAuthoritative()).toBe(true);
    expect(isPriorityEnabled()).toBe(true);
  });

  it('supports OFF, SHADOW, AUTHORITATIVE', () => {
    process.env.DISCOUNT_ENGINE_V2_PRIORITY_MODE = 'OFF';
    expect(getPriorityMode()).toBe('OFF');
    expect(isPriorityEnabled()).toBe(false);

    process.env.DISCOUNT_ENGINE_V2_PRIORITY_MODE = 'SHADOW';
    expect(getPriorityMode()).toBe('SHADOW');
    expect(isPriorityShadowEnabled()).toBe(true);
    expect(isPriorityAuthoritative()).toBe(false);
  });

  it('maps legacy DISCOUNT_ENGINE_V2_PRIORITY_SHADOW=false to OFF', () => {
    delete process.env.DISCOUNT_ENGINE_V2_PRIORITY_MODE;
    process.env.DISCOUNT_ENGINE_V2_PRIORITY_SHADOW = 'false';
    expect(getPriorityMode()).toBe('OFF');
  });
});
