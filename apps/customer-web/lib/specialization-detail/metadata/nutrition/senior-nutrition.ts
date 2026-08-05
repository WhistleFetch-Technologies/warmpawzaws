import { defineSpecialization } from '../../define';

export const seniorNutritionMetadata = defineSpecialization({
  id: 'senior_nutrition',
  aliases: ['senior_diet'],
  category: 'nutrition',
  title: 'Senior Nutrition',
  description:
    'Age-appropriate diets for senior pets with adjusted protein, joint-support nutrients, and digestibility to maintain vitality and healthy weight.',
  highlightChips: ['Age-Appropriate', 'Joint Support', 'Easy Digestion'],
  whatsIncluded: [
    { label: 'Senior Health Review', icon: 'stethoscope' },
    { label: 'Adjusted Macro Plan', icon: 'calendar' },
    { label: 'Joint & Omega Guidance', icon: 'heart' },
    { label: 'Digestibility Focus', icon: 'leaf' },
    { label: 'Appetite Strategies', icon: 'dog' },
    { label: 'Supplement Advice', icon: 'check' },
  ],
  benefits: [
    { title: 'Maintained Vitality', description: 'Nutrition supports energy in aging pets.', icon: 'activity' },
    { title: 'Joint Comfort', description: 'Omega-3s and glucosamine support mobility.', icon: 'heart' },
    { title: 'Healthy Weight', description: 'Lower calories prevent obesity as activity drops.', icon: 'shield' },
    { title: 'Gentler Digestion', description: 'Easier-to-digest formulas reduce stomach upset.', icon: 'leaf' },
  ],
  whoIsThisFor: ['Dogs and cats over 7 years', 'Senior pets losing appetite', 'Aging pets with kidney or joint concerns'],
  timeline: [
    { period: 'Week 1', title: 'Senior health and diet assessment' },
    { period: 'Week 2', title: 'Senior formula and portion plan' },
    { period: 'Week 3', title: 'Appetite and digestibility tweaks' },
    { period: 'Ongoing', title: 'Quarterly reviews as needs change' },
  ],
  tips: ['Warm food slightly to enhance aroma for picky seniors', 'Split meals into smaller, frequent portions', 'Discuss kidney-friendly options with your vet', 'Monitor weight monthly'],
});
