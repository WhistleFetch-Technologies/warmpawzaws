import {
  clearLeaveGuards,
  registerLeaveGuard,
  requestLeave,
} from '../leave-guard';

describe('leave-guard', () => {
  beforeEach(() => {
    clearLeaveGuards();
  });

  it('allows leave when all guards pass', async () => {
    registerLeaveGuard({
      id: 'always-ok',
      canLeave: () => true,
      confirmLeave: () => false,
    });
    await expect(requestLeave()).resolves.toBe(true);
  });

  it('blocks leave when confirm returns false', async () => {
    registerLeaveGuard({
      id: 'payment',
      canLeave: () => false,
      confirmLeave: () => false,
    });
    await expect(requestLeave()).resolves.toBe(false);
  });

  it('allows leave when confirm returns true', async () => {
    registerLeaveGuard({
      id: 'payment',
      canLeave: () => false,
      confirmLeave: () => true,
    });
    await expect(requestLeave()).resolves.toBe(true);
  });

  it('unregisters on cleanup', async () => {
    const cleanup = registerLeaveGuard({
      id: 'temp',
      canLeave: () => false,
      confirmLeave: () => false,
    });
    cleanup();
    await expect(requestLeave()).resolves.toBe(true);
  });
});
