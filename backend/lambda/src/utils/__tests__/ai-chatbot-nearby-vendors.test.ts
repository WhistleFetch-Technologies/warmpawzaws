import { roleFilterListForCategory } from '../ai-chatbot-booking-roles';

describe('ai-chatbot-nearby-vendors', () => {
  it('roleFilterListForCategory returns vet role names', () => {
    const roles = roleFilterListForCategory('vet');
    expect(roles.length).toBeGreaterThan(0);
    expect(roles.every((r) => r === r.toLowerCase())).toBe(true);
    expect(roles).toContain('veterinarian');
  });

  it('roleFilterListForCategory handles grooming', () => {
    const roles = roleFilterListForCategory('grooming');
    expect(roles.length).toBeGreaterThan(0);
  });
});
