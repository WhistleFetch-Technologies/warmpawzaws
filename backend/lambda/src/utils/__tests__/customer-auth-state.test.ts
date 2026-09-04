import { resolveCustomerAuthStateFromRecord } from '../customer-state';

describe('resolveCustomerAuthStateFromRecord', () => {
  it('returns existing when onboarding is COMPLETED', () => {
    expect(
      resolveCustomerAuthStateFromRecord({
        onboarding_status: 'COMPLETED',
        status: 'active',
        profile_completed: true,
        full_name: 'Priya',
        phone: '9876543210',
      })
    ).toBe('existing');
  });

  it('returns existing for a real name even when flags are still PHONE_VERIFIED / new', () => {
    expect(
      resolveCustomerAuthStateFromRecord({
        onboarding_status: 'PHONE_VERIFIED',
        status: 'new',
        profile_completed: false,
        full_name: 'Priya Sharma',
        phone: '9876543210',
      })
    ).toBe('existing');
  });

  it('returns new for placeholder signup names', () => {
    expect(
      resolveCustomerAuthStateFromRecord({
        onboarding_status: 'PHONE_VERIFIED',
        status: 'new',
        profile_completed: false,
        full_name: 'Customer 3210',
        phone: '9876543210',
      })
    ).toBe('new');
  });

  it('returns existing when profile_completed is true', () => {
    expect(
      resolveCustomerAuthStateFromRecord({
        onboarding_status: 'PET_PENDING',
        status: 'new',
        profile_completed: true,
        full_name: 'Customer 3210',
        phone: '9876543210',
      })
    ).toBe('existing');
  });
});
