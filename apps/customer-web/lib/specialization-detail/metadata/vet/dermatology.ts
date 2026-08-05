import { defineSpecialization } from '../../define';

export const dermatologyMetadata = defineSpecialization({
  id: 'dermatology',
  category: 'vet',
  title: 'Skin Care',
  description:
    'Diagnosis and treatment for itching, rashes, hot spots, allergies, and coat conditions—with skin scrapes, allergy workups, and targeted therapies.',
  highlightChips: ['Itch Relief', 'Allergy Testing', 'Coat Health'],
  whatsIncluded: [
    { label: 'Skin Examination', icon: 'stethoscope' },
    { label: 'Allergy Assessment', icon: 'brain' },
    { label: 'Skin Scraping', icon: 'check' },
    { label: 'Topical Treatment Plan', icon: 'leaf' },
    { label: 'Diet Correlation Review', icon: 'heart' },
    { label: 'Follow-up Monitoring', icon: 'calendar' },
  ],
  benefits: [
    { title: 'Itch Relief', description: 'Targeted treatment reduces scratching and discomfort.', icon: 'heart' },
    { title: 'Healthier Coat', description: 'Address root causes, not just symptoms.', icon: 'sparkles' },
    { title: 'Allergy Clarity', description: 'Identify food or environmental triggers.', icon: 'brain' },
    { title: 'Infection Prevention', description: 'Treat hot spots before they spread.', icon: 'shield' },
  ],
  whoIsThisFor: ['Chronic scratchers and lickers', 'Recurring hot spots or ear infections', 'Suspected food or environmental allergies'],
  timeline: [
    { period: 'Consult', title: 'Skin history and visual exam' },
    { period: 'Test', title: 'Scrapes, cultures, or allergy workup' },
    { period: 'Treat', title: 'Medication, topicals, or diet trial' },
    { period: 'Review', title: 'Progress check and plan adjustment' },
  ],
  tips: ['Do not bathe right before skin scrapes unless told to', 'Log when itching worsens (season, food)', 'Use vet-approved shampoos only', 'Prevent licking with an e-collar if prescribed'],
});
