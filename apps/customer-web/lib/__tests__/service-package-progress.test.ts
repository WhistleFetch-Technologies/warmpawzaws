import {
  isPackageCountedActive,
  packageCardStatus,
  packageProgressPercent,
} from '@/components/customer/packages/service-package-progress';

describe('service package progress', () => {
  it('computes completed / total and clamps empty or full packages', () => {
    expect(packageProgressPercent({ totalSessions: 60, completedSessions: 0 })).toBe(0);
    expect(packageProgressPercent({ totalSessions: 60, completedSessions: 15 })).toBe(25);
    expect(packageProgressPercent({ totalSessions: 0, completedSessions: 3 })).toBe(0);
    expect(packageProgressPercent({ totalSessions: 5, completedSessions: 9 })).toBe(100);
  });

  it('does not treat a scheduled purchase with zero completions as completed', () => {
    expect(
      packageCardStatus({ totalSessions: 60, completedSessions: 0, remainingSessions: 60, status: 'active' })
    ).toBe('Active');
    expect(
      packageCardStatus({ totalSessions: 60, completedSessions: 2, remainingSessions: 58, status: 'active' })
    ).toBe('In Progress');
  });

  it('keeps expired and exhausted packages out of the active count', () => {
    const expired = { totalSessions: 60, completedSessions: 0, remainingSessions: 60, status: 'expired' };
    const done = { totalSessions: 5, completedSessions: 5, remainingSessions: 0, status: 'exhausted' };
    expect(packageCardStatus(expired)).toBe('Expired');
    expect(packageCardStatus(done)).toBe('Completed');
    expect(isPackageCountedActive(expired)).toBe(false);
    expect(isPackageCountedActive(done)).toBe(false);
    expect(
      isPackageCountedActive({ totalSessions: 5, completedSessions: 0, remainingSessions: 5, status: 'active' })
    ).toBe(true);
  });
});
