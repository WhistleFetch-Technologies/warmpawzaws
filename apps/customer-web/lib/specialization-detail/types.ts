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

export type SpecializationDetailContent = {
  id: string;
  title: string;
  description: string;
  heroImage: string;
  highlightChips: string[];
  whatsIncluded: SpecializationFeatureItem[];
  benefits: SpecializationBenefitItem[];
  whoIsThisFor: string[];
  timeline: SpecializationTimelineItem[];
  tips: string[];
};

/** Written per specialization; heroImage resolved at registration if omitted. */
export type SpecializationDetailDefinition = Omit<SpecializationDetailContent, 'heroImage'> & {
  heroImage?: string;
  aliases?: string[];
  /** Used only when falling back for unknown admin-created specializations. */
  category?: SpecializationCategory;
};

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
