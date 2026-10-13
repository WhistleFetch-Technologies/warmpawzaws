import { formSchemaSchema } from '@warmpawz/shared-types';
import { chatCardSchema } from '@warmpawz/shared-types';
import {
  INSURANCE_APPLICATION_STATUSES,
  INSURANCE_STATUS_TRANSITIONS,
  isTerminalInsuranceStatus,
  normalizeInsuranceStatus,
} from '@warmpawz/shared-types';
import { INSURANCE_SLUGS } from '@warmpawz/shared-types';

describe('insurance status transitions', () => {
  it('covers every status and gives every non-terminal status an exit', () => {
    expect(Object.keys(INSURANCE_STATUS_TRANSITIONS).sort()).toEqual([...INSURANCE_APPLICATION_STATUSES].sort());
    for (const status of INSURANCE_APPLICATION_STATUSES) {
      const next = INSURANCE_STATUS_TRANSITIONS[status];
      for (const target of next) {
        expect(INSURANCE_APPLICATION_STATUSES).toContain(target);
      }
      expect(next.length > 0).toBe(!isTerminalInsuranceStatus(status));
    }
  });

  it('reaches every status from consultation_booked', () => {
    const seen = new Set<string>(['consultation_booked']);
    const queue = ['consultation_booked'];
    while (queue.length) {
      const current = queue.pop() as keyof typeof INSURANCE_STATUS_TRANSITIONS;
      for (const next of INSURANCE_STATUS_TRANSITIONS[current]) {
        if (!seen.has(next)) {
          seen.add(next);
          queue.push(next);
        }
      }
    }
    expect([...seen].sort()).toEqual([...INSURANCE_APPLICATION_STATUSES].sort());
  });

  it('maps the previous status keys onto the new list', () => {
    expect(normalizeInsuranceStatus('form_required')).toBe('form_sent');
    expect(normalizeInsuranceStatus('policy_issued')).toBe('policy_confirmed');
    expect(normalizeInsuranceStatus('quote_shared')).toBe('quote_shared');
  });
});

describe('insurance slug registry', () => {
  it('uses each slug once', () => {
    const slugs = INSURANCE_SLUGS.map((row) => row.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });
});

describe('insurance form schema and chat cards', () => {
  it('round-trips a form schema', () => {
    const schema = {
      sections: [
        {
          key: 'pet',
          title: 'Pet',
          fields: [{ key: 'name', label: 'Name', type: 'text', required: true, slug: 'pet.name' }],
        },
      ],
    };
    expect(formSchemaSchema.parse(schema)).toEqual(schema);
  });

  it('accepts a plan quote card and rejects an unknown card', () => {
    const card = {
      card: 'plan_quote',
      applicationId: '11111111-1111-4111-8111-111111111111',
      version: 1,
      companyId: '22222222-2222-4222-8222-222222222222',
      planId: '33333333-3333-4333-8333-333333333333',
      coverType: 'accident',
      sumInsured: '100000',
      copay: '10%',
      optionalCovers: [],
      indicativePremium: 499,
      premiumUnit: 'month',
    };
    expect(chatCardSchema.parse(card)).toMatchObject({ card: 'plan_quote', version: 1 });
    expect(() => chatCardSchema.parse({ ...card, card: 'unknown' })).toThrow();
  });
});
