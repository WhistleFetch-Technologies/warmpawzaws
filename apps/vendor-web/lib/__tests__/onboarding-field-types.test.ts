import { FORM_FIELD_TYPES } from '@warmpawz/shared-types';
import { normalizeOnboardingFieldType, validateOnboardingFieldValue } from '../onboarding-field-types';

describe('onboarding field types', () => {
  it('renders every shared field type and treats dropdown as a select', () => {
    for (const type of FORM_FIELD_TYPES) {
      expect(normalizeOnboardingFieldType(type)).not.toBe('');
    }
    expect(normalizeOnboardingFieldType('dropdown')).toBe('select');
    expect(normalizeOnboardingFieldType('radio')).toBe('radio');
    expect(normalizeOnboardingFieldType('phone')).toBe('tel');
  });

  it('validates required values and number min and max', () => {
    expect(validateOnboardingFieldValue({ name: 'pan', label: 'PAN', required: true }, '  ')).toBe('PAN is required');
    expect(validateOnboardingFieldValue({ name: 'advisors', type: 'number', min: 1, max: 10 }, 0)).toBe(
      'Minimum value is 1',
    );
    expect(validateOnboardingFieldValue({ name: 'advisors', type: 'number', min: 1, max: 10 }, 11)).toBe(
      'Maximum value is 10',
    );
    expect(validateOnboardingFieldValue({ name: 'advisors', type: 'number', min: 1, max: 10 }, 4)).toBeNull();
  });
});
