export type SpecializationFeatureItem = {
  label: string;
  icon: string;
};

export type SpecializationBenefitItem = {
  title: string;
  description: string;
  icon: string;
};

export type SpecializationTimelineItem = {
  period: string;
  title: string;
};

export type ServiceModeDetail = {
  title: string;
  description: string;
  /** Optional bullet list shown inside the service-mode card. */
  details?: string[];
};

export type StandardSpecializationDetailContent = {
  layout?: 'standard';
  id: string;
  title: string;
  description: string;
  heroImage: string;
  /** CSS object-position for hero crop tuning (e.g. "center top"). */
  heroImagePosition?: string;
  highlightChips: string[];
  /** Optional overview section (e.g. "What is Daily Walking?"). */
  overviewTitle?: string;
  overviewBody?: string;
  /** Defaults to "What You'll Learn" when set; otherwise uses timeline section. */
  whatYouLearn?: string[];
  whatYouLearnTitle?: string;
  whatsIncluded: SpecializationFeatureItem[];
  whatsIncludedTitle?: string;
  trainerDelivers?: string[];
  trainerDeliversTitle?: string;
  behavioursAddressed?: string[];
  behavioursAddressedTitle?: string;
  benefits: SpecializationBenefitItem[];
  whoIsThisFor: string[];
  audienceTitle?: string;
  timeline: SpecializationTimelineItem[];
  /** Defaults to "Things You'll Learn" when omitted. */
  timelineTitle?: string;
  tips: string[];
  notIncluded?: string[];
  notIncludedTitle?: string;
  notIncludedFooter?: string;
  importantNotes?: string[];
  importantNotesTitle?: string;
  serviceModeInformation?: VetServiceModeInformation;
};

export type VetSectionType =
  | 'overview'
  | 'when_to_consider'
  | 'common_concerns'
  | 'categories'
  | 'included'
  | 'process'
  | 'what_to_expect'
  | 'preparation'
  | 'after_care'
  | 'benefits'
  | 'precautions'
  | 'important'
  | 'emergency'
  | 'follow_up'
  | 'faq'
  | 'not_included';

export type VetSectionStep = {
  title: string;
  description?: string;
};

export type VetSectionCategory = {
  title: string;
  items: string[];
};

export type VetSectionFaq = {
  question: string;
  answer: string;
};

export type VetSection = {
  type: VetSectionType;
  title: string;
  body?: string;
  items?: string[];
  steps?: VetSectionStep[];
  categories?: VetSectionCategory[];
  faqs?: VetSectionFaq[];
  tone?: 'default' | 'warning' | 'info' | 'calm';
};

export type VetServiceModeInformation = {
  at_home?: ServiceModeDetail;
  at_center?: ServiceModeDetail;
  tele?: ServiceModeDetail;
};

export type VetVisualVariant = 'default' | 'palliative' | 'emergency';

export type VetSpecializationDetailContent = {
  layout: 'vet';
  id: string;
  title: string;
  description: string;
  heroImage: string;
  /** CSS object-position for hero crop tuning (e.g. "center top"). */
  heroImagePosition?: string;
  highlightChips: string[];
  sections: VetSection[];
  serviceModeInformation?: VetServiceModeInformation;
  visualVariant?: VetVisualVariant;
};

export type SpecializationDetailContent =
  | StandardSpecializationDetailContent
  | VetSpecializationDetailContent;

/** Written per specialization; heroImage resolved at registration if omitted. */
export type SpecializationDetailDefinition = Omit<
  StandardSpecializationDetailContent,
  'heroImage' | 'layout'
> & {
  heroImage?: string;
  aliases?: string[];
  /** Used only when falling back for unknown admin-created specializations. */
  category?: SpecializationCategory;
};

export type VetSpecializationDetailDefinition = Omit<
  VetSpecializationDetailContent,
  'heroImage' | 'layout'
> & {
  heroImage?: string;
  aliases?: string[];
};

export function isVetSpecializationDetail(
  content: SpecializationDetailContent,
): content is VetSpecializationDetailContent {
  return 'layout' in content && content.layout === 'vet';
}

export type SpecializationCategory =
  | 'training'
  | 'behavior'
  | 'walking'
  | 'grooming'
  | 'vet'
  | 'boarding'
  | 'nutrition'
  | 'general';

export type SpecializationResolveContext = {
  /** Display name from admin/API when id is not in the registry. */
  displayName?: string;
  category?: SpecializationCategory;
  apiDescription?: string;
};
