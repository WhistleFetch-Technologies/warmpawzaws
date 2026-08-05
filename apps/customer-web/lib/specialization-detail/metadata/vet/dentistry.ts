import { defineSpecialization } from '../../define';

export const dentistryMetadata = defineSpecialization({
  id: 'dentistry',
  category: 'vet',
  title: 'Dental Care',
  description:
    'Professional dental exams, cleaning, extractions when needed, and home-care guidance to prevent gum disease, bad breath, and tooth pain.',
  highlightChips: ['Oral Health', 'Professional Cleaning', 'Pain Prevention'],
  whatsIncluded: [
    { label: 'Dental Examination', icon: 'stethoscope' },
    { label: 'Scaling & Polishing', icon: 'sparkles' },
    { label: 'X-rays (if needed)', icon: 'check' },
    { label: 'Extractions', icon: 'shield' },
    { label: 'Anaesthesia Monitoring', icon: 'heart' },
    { label: 'Home Care Plan', icon: 'home' },
  ],
  benefits: [
    { title: 'Fresher Breath', description: 'Remove plaque and tartar that cause odour.', icon: 'sparkles' },
    { title: 'Pain Relief', description: 'Treat infected or broken teeth before they worsen.', icon: 'heart' },
    { title: 'Systemic Health', description: 'Oral bacteria can affect heart and kidneys.', icon: 'shield' },
    { title: 'Longer Tooth Life', description: 'Regular care preserves chewing function.', icon: 'check' },
  ],
  whoIsThisFor: ['Bad breath and tartar buildup', 'Difficulty eating or drooling', 'Annual dental maintenance'],
  timeline: [
    { period: 'Exam', title: 'Oral assessment and anaesthesia planning' },
    { period: 'Procedure', title: 'Clean, polish, and treat under anaesthesia' },
    { period: 'Recovery', title: 'Wake-up monitoring and discharge' },
    { period: 'Home', title: 'Soft food and brushing guidance' },
  ],
  tips: ['Withhold food as instructed before anaesthesia', 'Start tooth brushing gradually at home', 'Offer dental chews vet recommends', 'Schedule annual dental checks for seniors'],
});
