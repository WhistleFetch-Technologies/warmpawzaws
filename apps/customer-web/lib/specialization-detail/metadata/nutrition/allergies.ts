import { defineSpecialization } from '../../define';

export const allergiesMetadata = defineSpecialization({
  id: 'allergies',
  aliases: ['allergy_diet', 'food_allergies'],
  category: 'nutrition',
  title: 'Allergy Diet',
  description:
    'Elimination diets and hypoallergenic feeding plans to identify food triggers and relieve itching, ear infections, and digestive upset.',
  highlightChips: ['Elimination Diets', 'Trigger Identification', 'Itch Relief'],
  whatsIncluded: [
    { label: 'Allergy History Review', icon: 'brain' },
    { label: 'Elimination Diet Plan', icon: 'calendar' },
    { label: 'Novel Protein Guidance', icon: 'leaf' },
    { label: 'Ingredient Exclusion List', icon: 'check' },
    { label: 'Reintroduction Protocol', icon: 'graduation' },
    { label: 'Symptom Tracking', icon: 'heart' },
  ],
  benefits: [
    { title: 'Itch Reduction', description: 'Removing triggers often clears skin within weeks.', icon: 'heart' },
    { title: 'Clearer Answers', description: 'Structured trials pinpoint specific allergens.', icon: 'brain' },
    { title: 'Better Digestion', description: 'Fewer upset stomachs and loose stools.', icon: 'leaf' },
    { title: 'Long-term Plan', description: 'Sustainable diet once triggers are known.', icon: 'calendar' },
  ],
  whoIsThisFor: ['Chronic itchy skin despite vet treatment', 'Recurring ear infections', 'Suspected food intolerance'],
  timeline: [
    { period: 'Week 1', title: 'History and baseline symptom log' },
    { period: 'Weeks 2–8', title: 'Strict elimination diet trial' },
    { period: 'Week 9', title: 'Controlled reintroduction of foods' },
    { period: 'After', title: 'Permanent allergen-free meal plan' },
  ],
  tips: ['No treats or table scraps during elimination', 'Inform all family members of strict rules', 'Work with your vet before starting', 'Allow 8+ weeks before judging results'],
});
