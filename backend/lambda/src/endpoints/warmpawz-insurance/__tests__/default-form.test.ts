import {
  DEFAULT_PAWS_N_CLAWS_FORM,
  formSchemaSchema,
  formShowIfMatches,
  validateDynamicForm,
} from '@warmpawz/shared-types';
import { formSchemaIssues, parseFormSchema } from '../shared/form-library';

describe('default Paws n Claws form', () => {
  it('parses and passes library slug checks', () => {
    const schema = parseFormSchema(DEFAULT_PAWS_N_CLAWS_FORM);
    expect(formSchemaSchema.safeParse(schema).success).toBe(true);
    expect(formSchemaIssues(schema)).toEqual([]);
    expect(schema.sections.some((section) => section.workflow === 'quote')).toBe(true);
    expect(schema.sections.some((section) => section.workflow === 'proposal')).toBe(true);
  });

  it('evaluates pet-count and conditional showIf', () => {
    expect(formShowIfMatches({ field: 'petCount', equals: '>=2' }, { petCount: '3' })).toBe(true);
    expect(formShowIfMatches({ field: 'petCount', equals: '>=2' }, { petCount: '1' })).toBe(false);
    expect(formShowIfMatches({ field: 'opdCover', equals: 'Yes' }, { opdCover: 'Yes' })).toBe(true);
    expect(formShowIfMatches({ field: 'nomineeAddressSame', equals: false }, { nomineeAddressSame: true })).toBe(false);
  });

  it('skips hidden required fields during validation', () => {
    const errors = validateDynamicForm(DEFAULT_PAWS_N_CLAWS_FORM, {
      petCount: '1',
      petHealthy: 'Yes',
      opdCover: 'No',
      existingPolicyAbove2000: 'No',
      nomineeAddressSame: true,
    });
    expect(errors.unhealthyReason).toBeUndefined();
    expect(errors.opdCoverAmount).toBeUndefined();
    expect(errors.existingPolicyNumber).toBeUndefined();
  });
});
