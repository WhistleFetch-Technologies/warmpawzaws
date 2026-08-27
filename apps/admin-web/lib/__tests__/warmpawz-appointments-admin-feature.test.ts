/**
 * @jest-environment jsdom
 */

import { isWarmpawzAppointmentsAdminEnabled } from '../warmpawz-appointments-admin-feature';

describe('isWarmpawzAppointmentsAdminEnabled', () => {
  const originalRuntime = (window as unknown as { __WARMPAWZ_RUNTIME_CONFIG__?: unknown })
    .__WARMPAWZ_RUNTIME_CONFIG__;

  afterEach(() => {
    const w = window as unknown as { __WARMPAWZ_RUNTIME_CONFIG__?: unknown };
    if (originalRuntime === undefined) delete w.__WARMPAWZ_RUNTIME_CONFIG__;
    else w.__WARMPAWZ_RUNTIME_CONFIG__ = originalRuntime;
  });

  it('defaults on when runtime-config omits the flag', () => {
    (window as unknown as { __WARMPAWZ_RUNTIME_CONFIG__: Record<string, unknown> }).__WARMPAWZ_RUNTIME_CONFIG__ =
      { apiBaseUrl: 'https://example.com' };
    expect(isWarmpawzAppointmentsAdminEnabled()).toBe(true);
  });

  it('honors explicit runtime false', () => {
    (window as unknown as { __WARMPAWZ_RUNTIME_CONFIG__: Record<string, unknown> }).__WARMPAWZ_RUNTIME_CONFIG__ =
      { warmpawzAppointmentsAdminEnabled: false };
    expect(isWarmpawzAppointmentsAdminEnabled()).toBe(false);
  });

  it('honors explicit runtime true', () => {
    (window as unknown as { __WARMPAWZ_RUNTIME_CONFIG__: Record<string, unknown> }).__WARMPAWZ_RUNTIME_CONFIG__ =
      { warmpawzAppointmentsAdminEnabled: 'true' };
    expect(isWarmpawzAppointmentsAdminEnabled()).toBe(true);
  });
});
