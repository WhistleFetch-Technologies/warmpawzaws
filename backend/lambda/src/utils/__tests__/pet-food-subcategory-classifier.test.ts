import {
  classifyPetFoodSubcategory,
  isPetFoodSubcategoryName,
  petFoodSubcategoryParentProductMatchSql,
} from '../pet-food-subcategory-classifier';

describe('pet-food-subcategory-classifier', () => {
  it('recognizes Pet Food subcategory names', () => {
    expect(isPetFoodSubcategoryName('Dry Pet Food')).toBe(true);
    expect(isPetFoodSubcategoryName('Therapeutic Food')).toBe(true);
    expect(isPetFoodSubcategoryName('Pet Toys')).toBe(false);
  });

  it('classifies treats before dry/wet food types', () => {
    expect(classifyPetFoodSubcategory('Glenand Dog Munchies 450g Beef Box')).toBe('Pet Treats');
    expect(classifyPetFoodSubcategory('Glenand Small Bone 5 inch')).toBe('Pet Treats');
  });

  it('classifies wet gravy products', () => {
    expect(
      classifyPetFoodSubcategory(
        'Drools Real Chicken and Liver Chunks in Gravy Wet Puppy Food, 30 Pouches'
      )
    ).toBe('Wet Pet Food');
  });

  it('classifies dry kibble products', () => {
    expect(classifyPetFoodSubcategory('Drools Chicken and Egg Adult Dry Dog Food')).toBe(
      'Dry Pet Food'
    );
    expect(classifyPetFoodSubcategory('Canine Creek Puppy Dry Dog Food, Ultra Premium')).toBe(
      'Dry Pet Food'
    );
  });

  it('classifies therapeutic and prescription diets after dry/wet/treat', () => {
    expect(
      classifyPetFoodSubcategory("Hill's Prescription Diet i/d Digestive Care Dog Food")
    ).toBe('Therapeutic Food');
    expect(classifyPetFoodSubcategory('Royal Canin Veterinary Diet Hepatic Dog Food')).toBe(
      'Therapeutic Food'
    );
    expect(classifyPetFoodSubcategory('Hypoallergenic Hydrolyzed Protein Cat Food')).toBe(
      'Therapeutic Food'
    );
  });

  it('keeps gravy urinary products as wet when wet/gravy matches first', () => {
    expect(
      classifyPetFoodSubcategory('Royal Canin Urinary Care Gravy Cat Adult wet Food')
    ).toBe('Wet Pet Food');
  });

  it('classifies puppy-only products when not dry/wet/treat', () => {
    expect(classifyPetFoodSubcategory('Pedigree Meat & Milk Puppy Dog Food')).toBe('Puppy Food');
  });

  it('classifies adult/senior products when no higher rule matches', () => {
    expect(classifyPetFoodSubcategory('Pedigree PRO Senior (7+ Years) Dog Food')).toBe('Adult Food');
  });

  it('returns null when no rule matches', () => {
    expect(classifyPetFoodSubcategory('Mystery Pet Item')).toBeNull();
  });

  it('builds SQL match for Dry Pet Food excluding treats and wet', () => {
    const sql = petFoodSubcategoryParentProductMatchSql('Dry Pet Food');
    expect(sql).toContain("!~ '(treat|treats");
    expect(sql).toContain("!~ '(wet|gravy");
    expect(sql).toContain("~ '(dry|kibble");
  });
});
