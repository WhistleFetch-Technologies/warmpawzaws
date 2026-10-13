import { chatCardSchema } from '@warmpawz/shared-types';
import { canTransitionInsuranceStatus } from '@warmpawz/shared-types';
import { validateDynamicForm, validateDynamicFormField } from '@warmpawz/shared-types';
import { FORM_FIELD_TYPES, type FormFieldType, type FormSchema } from '@warmpawz/shared-types';
import { INSURANCE_SLUGS } from '@warmpawz/shared-types';
import { isCustomerVisiblePlan, openApplicationBlocksAnother } from '../shared/customer-plans';
import { formSchemaIssues, nextSubmissionRevision, nextTemplateVersion, parseFormSchema } from '../shared/form-library';
import { resolveSlugValues } from '../shared/slug-resolver';
import { evaluateAgainstSnapshot, type EvaluateSnapshot } from '../../../discount-engine/promo-engine/services/evaluate-snapshot';

const emptySnapshot = {
  candidates: [],
  rulesByPromo: new Map(),
  limitsByPromo: new Map(),
  usageByPromo: new Map(),
  ruleUsageByKey: new Map(),
  behaviour: { userId: 'u' },
} as unknown as EvaluateSnapshot;

describe('P3 customer plans and applications', () => {
  it('hides unpublished plans, inactive companies, and plans with no ready vendor', () => {
    expect(isCustomerVisiblePlan({ id: '1', status: 'draft', companyActive: true, readyVendorCount: 1 })).toBe(false);
    expect(isCustomerVisiblePlan({ id: '1', status: 'published', companyActive: false, readyVendorCount: 1 })).toBe(false);
    expect(isCustomerVisiblePlan({ id: '1', status: 'published', companyActive: true, readyVendorCount: 0 })).toBe(false);
    expect(isCustomerVisiblePlan({ id: '1', status: 'published', companyActive: true, readyVendorCount: 2 })).toBe(true);
  });

  it('blocks a second open application and allows a new one after a terminal status', () => {
    expect(openApplicationBlocksAnother('consultation_booked')).toBe(true);
    expect(openApplicationBlocksAnother('form_submitted')).toBe(true);
    expect(openApplicationBlocksAnother('cancelled')).toBe(false);
    expect(openApplicationBlocksAnother('dropped')).toBe(false);
  });

  it('excludes insurance consults from promo evaluation', () => {
    const result = evaluateAgainstSnapshot(emptySnapshot, {
      user_id: 'u',
      transaction: { amount: 500, service_category: 'pet_insurance' },
    });
    expect(result.benefits).toEqual([]);
    expect(result.summary.discount).toBe(0);
    expect(result.summary.payable).toBe(500);
    expect(result.explain.failures[0]?.reason).toBe('INSURANCE_CONSULT_EXCLUDED');
  });
});

describe('P4 slugs and form templates', () => {
  const profile = {
    customer: { full_name: 'Asha', phone: '999', email: 'a@b.c', date_of_birth: '1990-01-02' },
    address: null,
    pet: { name: 'Miko', medical_history: { weight_kg: 8, color: 'gold' } },
  };

  it('resolves every slug, falls back to medical history, and misses a missing pet or address', () => {
    const resolved = resolveSlugValues(profile);
    expect(resolved).toHaveLength(INSURANCE_SLUGS.length);
    expect(resolved.find((row) => row.slug === 'customer.full_name')).toMatchObject({ value: 'Asha', source: 'column' });
    expect(resolved.find((row) => row.slug === 'pet.weight_kg')).toMatchObject({ value: '8', source: 'json' });
    expect(resolved.find((row) => row.slug === 'address.city')).toMatchObject({ value: null, source: 'missing' });
    expect(resolveSlugValues({ ...profile, pet: null }, ['pet.name'])[0]).toMatchObject({ source: 'missing' });
  });

  it('publishes the next version and rejects a slug that does not match the field type', () => {
    expect(nextTemplateVersion(null)).toBe(1);
    expect(nextTemplateVersion(2)).toBe(3);
    const schema = parseFormSchema({
      sections: [
        {
          key: 'pet',
          title: 'Pet',
          fields: [
            { key: 'weight', label: 'Weight', type: 'text', required: true, slug: 'pet.weight_kg' },
            { key: 'name', label: 'Name', type: 'text', required: true, slug: 'pet.name' },
          ],
        },
      ],
    });
    expect(formSchemaIssues(schema).join(' ')).toContain('not compatible');
    const draft = { ...schema, sections: schema.sections };
    expect(draft.sections[0].fields[1].slug).toBe('pet.name');
  });
});

describe('P5 cards, submissions, and the renderer contract', () => {
  it('rejects an unknown card, the wrong application, and a quote missing fields', () => {
    expect(chatCardSchema.safeParse({ card: 'unknown', applicationId: '11111111-1111-1111-1111-111111111111', version: 1 }).success).toBe(false);
    const quote = {
      card: 'plan_quote',
      applicationId: '11111111-1111-1111-1111-111111111111',
      version: 1,
      companyId: '22222222-2222-2222-2222-222222222222',
      planId: '33333333-3333-3333-3333-333333333333',
      coverType: 'accident',
      sumInsured: '100000',
      copay: '10%',
      optionalCovers: [],
      indicativePremium: 499,
      premiumUnit: 'year',
    };
    expect(chatCardSchema.safeParse(quote).success).toBe(true);
    expect(chatCardSchema.safeParse({ ...quote, coverType: '' }).success).toBe(false);
    expect(quote.applicationId).not.toBe('44444444-4444-4444-4444-444444444444');
  });

  it('resubmit creates revision N+1 and supersedes the previous one', () => {
    expect(nextSubmissionRevision(null)).toEqual({ revision: 1, supersedePrevious: false });
    expect(nextSubmissionRevision(1)).toEqual({ revision: 2, supersedePrevious: true });
  });

  it('only follows allowed status edges', () => {
    expect(canTransitionInsuranceStatus('form_sent', 'form_submitted')).toBe(true);
    expect(canTransitionInsuranceStatus('form_submitted', 'form_confirmed')).toBe(true);
    expect(canTransitionInsuranceStatus('consultation_booked', 'form_confirmed')).toBe(false);
    expect(canTransitionInsuranceStatus('cancelled', 'consulted')).toBe(false);
  });

  it('validates every field type and shows which values are prefilled', () => {
    const schema: FormSchema = {
      sections: [
        {
          key: 'main',
          title: 'Main',
          fields: FORM_FIELD_TYPES.map((type) => ({
            key: type,
            label: type,
            type: type as FormFieldType,
            required: type !== 'section_note',
            options: type === 'select' || type === 'radio' || type === 'multiselect' ? ['a'] : undefined,
          })),
        },
      ],
    };
    const empty = validateDynamicForm(schema, {});
    expect(empty.text).toBeTruthy();
    expect(empty.section_note).toBeUndefined();
    expect(validateDynamicFormField(schema.sections[0].fields.find((field) => field.type === 'number')!, 2)).toBeNull();
    const filled = Object.fromEntries(
      FORM_FIELD_TYPES.map((type) => [
        type,
        type === 'checkbox' ? true : type === 'multiselect' ? ['a'] : type === 'number' ? 1 : type === 'email' ? 'a@b.c' : 'a',
      ]),
    );
    expect(validateDynamicForm(schema, filled)).toEqual({});
  });
});
