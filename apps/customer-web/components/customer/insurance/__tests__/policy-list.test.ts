import { isActiveIssuedPolicy, policyStatusLabel } from '../policy-list';

describe('issued policy list', () => {
  it('treats uploaded and confirmed policies as active', () => {
    expect(isActiveIssuedPolicy('policy_confirmed')).toBe(true);
    expect(isActiveIssuedPolicy('policy_uploaded')).toBe(true);
    expect(isActiveIssuedPolicy('free_look_cancelled')).toBe(false);
    expect(policyStatusLabel('policy_confirmed')).toBe('Active');
    expect(policyStatusLabel('policy_uploaded')).toBe('Issued');
  });
});