import { getBuiltinTaxonomyRows } from '../builtin-keywords';
import { extractSearchModifiers, resolveIntentFromRules } from '../intent-rules';
import { normalizeSearchQuery, tokenizeQuery } from '../normalize';
import { resolveSearchCategoriesFromRows } from '../resolver';
import { isEcommerceOnlyQuery } from '../service-scope';
import type { SearchTaxonomyKeywordRow } from '../types';

function row(
  partial: Partial<SearchTaxonomyKeywordRow> & Pick<SearchTaxonomyKeywordRow, 'keyword_normalized' | 'hub_slug'>
): SearchTaxonomyKeywordRow {
  return {
    id: partial.id ?? '1',
    category_slug: partial.category_slug ?? 'veterinary_and_healthcare',
    category_display_name: partial.category_display_name ?? 'Veterinary & Healthcare',
    subcategory: partial.subcategory ?? null,
    keyword: partial.keyword ?? partial.keyword_normalized,
    keyword_normalized: normalizeSearchQuery(partial.keyword_normalized),
    hub_slug: partial.hub_slug,
    weight: partial.weight ?? 100,
    is_active: partial.is_active ?? true,
  };
}

const FIXTURE: SearchTaxonomyKeywordRow[] = [
  ...getBuiltinTaxonomyRows(),
  row({ keyword_normalized: 'dog doctor', hub_slug: 'vet' }),
  row({ keyword_normalized: 'pet hostel', hub_slug: 'boarding', category_slug: 'boarding_and_daycare', category_display_name: 'Boarding & Daycare' }),
  row({ keyword_normalized: 'dog grooming', hub_slug: 'grooming', category_slug: 'grooming', category_display_name: 'Grooming' }),
  row({ keyword_normalized: 'hair cut', hub_slug: 'grooming', category_slug: 'grooming', category_display_name: 'Grooming' }),
  row({ keyword_normalized: 'tick treatment', hub_slug: 'grooming', category_slug: 'grooming', category_display_name: 'Grooming' }),
  row({ keyword_normalized: 'weight management', hub_slug: 'nutritionist', category_slug: 'nutrition_and_wellness', category_display_name: 'Nutrition & Wellness' }),
  row({ keyword_normalized: 'pet nutritionist', hub_slug: 'nutritionist', category_slug: 'nutrition_and_wellness', category_display_name: 'Nutrition & Wellness' }),
  row({ keyword_normalized: 'dog trainer', hub_slug: 'training', category_slug: 'training_and_behaviour', category_display_name: 'Training & Behaviour' }),
  row({ keyword_normalized: 'dog boarding', hub_slug: 'boarding', category_slug: 'boarding_and_daycare', category_display_name: 'Boarding & Daycare' }),
  row({ keyword_normalized: 'dog walker', hub_slug: 'walker', category_slug: 'walking_and_sitting', category_display_name: 'Walking & Sitting' }),
  row({ keyword_normalized: 'dog walk', hub_slug: 'walker', category_slug: 'walking_and_sitting', category_display_name: 'Walking & Sitting', subcategory: 'Dog Walking' }),
  row({ keyword_normalized: 'walk my dog', hub_slug: 'walker', category_slug: 'walking_and_sitting', category_display_name: 'Walking & Sitting', subcategory: 'Dog Walking' }),
  row({ keyword_normalized: 'diet consultation', hub_slug: 'nutritionist', category_slug: 'nutrition_and_wellness', category_display_name: 'Nutrition & Wellness', subcategory: 'Nutrition Services' }),
  row({ keyword_normalized: 'pet sitter', hub_slug: 'pet-sitter', category_slug: 'walking_and_sitting', category_display_name: 'Walking & Sitting' }),
  row({ keyword_normalized: 'vaccination', hub_slug: 'vet', subcategory: 'Preventive Care' }),
  row({ keyword_normalized: 'aggressive dog training', hub_slug: 'training', category_slug: 'training_and_behaviour', category_display_name: 'Training & Behaviour', subcategory: 'Behaviour Correction' }),
];

function topHub(query: string): string | null {
  return resolveSearchCategoriesFromRows(query, FIXTURE).categories[0]?.hubSlug ?? null;
}

function expectHub(query: string, hub: string) {
  expect(topHub(query)).toBe(hub);
}

function expectNoHub(query: string) {
  expect(topHub(query)).toBeNull();
}

function expectBlockedEcommerce(query: string) {
  const result = resolveSearchCategoriesFromRows(query, FIXTURE);
  expect(result.blockedEcommerce).toBe(true);
  expect(result.categories).toEqual([]);
}

describe('Phase 2 natural-language intent matching', () => {
  describe('required service query matrix', () => {
    it.each([
      ['best trainer for dog', 'training'],
      ['I need walk for my dog', 'walker'],
      ['my dog is overweight', 'nutritionist'],
      ['I need diet consultation for my dog', 'nutritionist'],
      ['I need a diet consultant for my dog', 'nutritionist'],
      ['best doctor for my dog', 'vet'],
      ['beautiful haircut for my dog', 'grooming'],
      ['safe boarding center for my dog', 'boarding'],
      ['experienced trainer for aggression problems in my dog', 'training'],
      ['BEST TRAINER FOR MY DOG!!!', 'training'],
    ])('%s → %s', (query, hub) => {
      expectHub(query, hub);
    });
  });

  describe('natural-language service queries', () => {
    it.each([
      ['best doctor for my dog', 'vet'],
      ['best doctor for my dog or cat', 'vet'],
      ['I need a doctor for my cat', 'vet'],
      ['my puppy needs vaccination', 'vet'],
      ['my dog needs an emergency doctor', 'vet'],
      ['best hair cut salon for my dog', 'grooming'],
      ['beautiful haircut for my dog', 'grooming'],
      ['I need grooming at home', 'grooming'],
      ['safe boarding center for my dog', 'boarding'],
      ['I need a safe place to keep my dog while I travel', 'boarding'],
      ['experienced trainer for aggression issues in my dog', 'training'],
      ['my dog keeps barking', 'training'],
      ['my dog is overweight', 'nutritionist'],
      ['best diet for my dog', 'nutritionist'],
      ['find a dog walker', 'walker'],
      ['someone to look after my cat', 'pet-sitter'],
      ['vet near me', 'vet'],
    ])('%s → %s', (query, hub) => {
      expectHub(query, hub);
    });
  });

  describe('typo and variation handling', () => {
    it.each([
      ['best doctur for my dog', 'vet'],
      ['docter for my cat', 'vet'],
      ['dog haircuts', 'grooming'],
      ['puppy grooming', 'grooming'],
      ['dogs boarding', 'boarding'],
      ['puppies training', 'training'],
    ])('%s → %s', (query, hub) => {
      expectHub(query, hub);
    });
  });

  describe('backward compatibility', () => {
    it.each([
      ['dog doctor', 'vet'],
      ['vet near me', 'vet'],
      ['dog grooming', 'grooming'],
      ['pet nutritionist', 'nutritionist'],
    ])('%s → %s', (query, hub) => {
      expectHub(query, hub);
    });
  });

  describe('ecommerce negative tests', () => {
    it.each([
      'dog food',
      'cat food',
      'puppy food',
      'dog collar',
      'leash',
      'toys',
      'pet toys',
      'cat litter',
      'pet clothes',
      'pet bed',
      'crate',
      'harness',
      'gps tracker',
    ])('%s → no service hub', (query) => {
      expectNoHub(query);
      expect(isEcommerceOnlyQuery(normalizeSearchQuery(query), tokenizeQuery(normalizeSearchQuery(query)))).toBe(true);
    });

    it.each(['dog food', 'dog collar', 'pet toys'])('%s → blockedEcommerce flag', (query) => {
      expectBlockedEcommerce(query);
    });
  });

  describe('ambiguous context', () => {
    it('dog food → no service', () => {
      expectNoHub('dog food');
    });

    it('best diet for my dog → nutritionist', () => {
      expectHub('best diet for my dog', 'nutritionist');
    });

    it('pet nutritionist → nutritionist', () => {
      expectHub('pet nutritionist', 'nutritionist');
    });

    it('tick shampoo → no service', () => {
      expectNoHub('tick shampoo');
    });

    it('tick treatment → grooming', () => {
      expectHub('tick treatment', 'grooming');
    });

    it('supplements → no service hub', () => {
      expectNoHub('supplements');
    });
  });

  describe('modifiers', () => {
    it('vet near me → nearMe modifier', () => {
      const result = resolveSearchCategoriesFromRows('vet near me', FIXTURE);
      expect(result.modifiers?.nearMe).toBe(true);
    });

    it('24 hour vet → openNow modifier', () => {
      const result = resolveSearchCategoriesFromRows('24 hour vet', FIXTURE);
      expect(result.modifiers?.openNow).toBe(true);
      expect(result.categories[0]?.hubSlug).toBe('vet');
    });

    it('I need grooming at home → atHome modifier', () => {
      const result = resolveSearchCategoriesFromRows('I need grooming at home', FIXTURE);
      expect(result.modifiers?.atHome).toBe(true);
      expect(result.categories[0]?.hubSlug).toBe('grooming');
    });
  });

  describe('multi-keyword intent', () => {
    it('trainer + aggression → behaviour correction intent', () => {
      const result = resolveSearchCategoriesFromRows(
        'My aggressive dog needs an experienced trainer',
        FIXTURE
      );
      expect(result.categories[0]?.hubSlug).toBe('training');
      expect(result.categories[0]?.intentCode).toBe('BEHAVIOUR_CORRECTION');
    });

    it('vet + vaccination → preventive care intent', () => {
      const result = resolveSearchCategoriesFromRows('My dog needs a vet for vaccination', FIXTURE);
      expect(result.categories[0]?.hubSlug).toBe('vet');
      expect(
        result.categories[0]?.intentCode === 'PREVENTIVE_OR_GENERAL_VET' ||
          result.categories[0]?.subcategory === 'Preventive Care'
      ).toBe(true);
    });
  });

  describe('walk without pet context', () => {
    it('does not map bare walk to walker', () => {
      expectNoHub('I need a walk');
    });
  });

  describe('token-set matching', () => {
    it('matches dog doctor tokens in scrambled sentence', () => {
      const { categories } = resolveSearchCategoriesFromRows('best doctor for my dog', FIXTURE);
      expect(categories[0]?.hubSlug).toBe('vet');
      expect(categories[0]?.matchKind).toMatch(/token_set|intent_rule|phrase/);
    });
  });

  describe('intent rules unit', () => {
    it('returns null for empty query', () => {
      expect(resolveIntentFromRules('', [])).toBeNull();
    });

    it('extracts modifiers from query', () => {
      const mods = extractSearchModifiers('same day grooming near me');
      expect(mods.sameDay).toBe(true);
      expect(mods.nearMe).toBe(true);
    });
  });
});
