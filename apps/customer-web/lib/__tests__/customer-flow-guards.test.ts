import {
  readProfileCompleted,
  resolvePostAuthRedirectPath,
} from '../customer-flow-guards';

describe('resolvePostAuthRedirectPath', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('passes through checkout when profile is complete', () => {
    localStorage.setItem('profile_completed', 'true');
    expect(readProfileCompleted()).toBe(true);
    expect(resolvePostAuthRedirectPath('/checkout')).toBe('/checkout');
  });

  it('sends new users to profile before checkout', () => {
    expect(resolvePostAuthRedirectPath('/checkout')).toBe('/profile?next=%2Fcheckout');
  });

  it('sends new users to profile when intended path is home', () => {
    expect(resolvePostAuthRedirectPath('/')).toBe('/profile');
  });
});
