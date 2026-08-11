'use client';

import type { VetSection, VetVisualVariant } from '@/lib/specialization-detail';
import { VetInfoCard } from './VetInfoCard';
import { VetChecklistCard } from './VetChecklistCard';
import { VetConcernGrid } from './VetConcernGrid';
import { VetProcessCard } from './VetProcessCard';
import { VetPreparationCard } from './VetPreparationCard';
import { VetAfterCareCard } from './VetAfterCareCard';
import { VetImportantNotice } from './VetImportantNotice';
import { VetEmergencyNotice } from './VetEmergencyNotice';
import { VetFAQCard } from './VetFAQCard';
import { VetCategoriesCard } from './VetCategoriesCard';

type VetSectionRendererProps = {
  section: VetSection;
  variant?: VetVisualVariant;
  index: number;
};

export function VetSectionRenderer({ section, variant = 'default', index }: VetSectionRendererProps) {
  const delay = 0.06 + index * 0.04;
  const props = { section, variant, delay };

  switch (section.type) {
    case 'overview':
    case 'when_to_consider':
    case 'follow_up':
    case 'not_included':
      return <VetInfoCard {...props} />;
    case 'benefits':
      return section.steps?.length ? <VetProcessCard {...props} /> : <VetInfoCard {...props} />;
    case 'common_concerns':
      return <VetConcernGrid {...props} />;
    case 'categories':
      return <VetCategoriesCard {...props} />;
    case 'included':
      return <VetChecklistCard {...props} />;
    case 'process':
    case 'what_to_expect':
      return <VetProcessCard {...props} />;
    case 'preparation':
      return <VetPreparationCard {...props} />;
    case 'after_care':
      return <VetAfterCareCard {...props} />;
    case 'precautions':
    case 'important':
      return <VetImportantNotice {...props} />;
    case 'emergency':
      return <VetEmergencyNotice section={section} delay={delay} />;
    case 'faq':
      return <VetFAQCard {...props} />;
    default:
      return <VetInfoCard {...props} />;
  }
}
