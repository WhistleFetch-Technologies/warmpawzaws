/**
 * HDFC ERGO Paws N Claws — product catalogue + combination rules.
 * Sourced from the supplied product leaflet + approved Warmpawz UX.
 * Premiums are never computed here — vendor enters insurer quote later.
 */

export const PAWS_N_CLAWS_PROVIDER_CODE = 'HDFC_ERGO';
export const PAWS_N_CLAWS_PRODUCT_KEY = 'PAWS_N_CLAWS';
export const PAWS_N_CLAWS_PLAN_SEED_ID = 'b2222222-2222-4222-8222-222222222201';
export const PAWS_N_CLAWS_COMPANY_SEED_ID = 'b1111111-1111-4111-8111-111111111101';

export type PawsMainSection = 'comprehensive' | 'make_your_own' | 'third_party';

export type MakeYourOwnCover = 'injury' | 'illness' | 'surgery';

export type PawsAddon =
  | 'veterinary_consultation'
  | 'trip_cancellation'
  | 'funeral_expenses';

export type CoverageSelection = {
  mainSection: PawsMainSection;
  /** Required when mainSection === 'make_your_own' */
  myoCovers?: MakeYourOwnCover[];
  sumInsured: number;
  /** Comprehensive only — leaflet: 10/20/30. MYO: nil co-pay. */
  copayPercent: number | null;
  addons: PawsAddon[];
  tripCancellationSumInsured?: number | null;
};

export type CoverageValidationIssue = {
  code: string;
  message: string;
};

export const PAWS_COMPREHENSIVE_SUM_INSURED = [10_000, 25_000, 50_000, 100_000, 200_000] as const;
export const PAWS_MYO_SUM_INSURED = [10_000, 25_000, 50_000, 100_000, 200_000] as const;
export const PAWS_TPL_SUM_INSURED = [
  100_000, 200_000, 300_000, 500_000, 1_000_000, 2_000_000, 5_000_000, 10_000_000,
] as const;
export const PAWS_COPAY = [10, 20, 30] as const;
export const PAWS_TRIP_CANCEL_SUM = [10_000, 20_000, 30_000, 40_000, 50_000] as const;

export const PAWS_N_CLAWS_PRODUCT = {
  providerCode: PAWS_N_CLAWS_PROVIDER_CODE,
  providerName: 'HDFC ERGO General Insurance Company Limited',
  productKey: PAWS_N_CLAWS_PRODUCT_KEY,
  productName: 'Paws N Claws Pet Insurance',
  waitingPeriodDays: 30,
  waitingPeriodAppliesTo: ['comprehensive', 'make_your_own'] as PawsMainSection[],
  sections: {
    comprehensive: {
      key: 'comprehensive' as const,
      title: 'Comprehensive Cover',
      subtitle:
        'All-round protection for eligible injury, illness, surgery and treatment expenses.',
      covers: ['Injury', 'Illness', 'Surgery', 'Diagnostic & treatment', 'OPD where applicable'],
      sumInsured: [...PAWS_COMPREHENSIVE_SUM_INSURED],
      copay: [...PAWS_COPAY],
      nilCopay: false,
    },
    make_your_own: {
      key: 'make_your_own' as const,
      title: 'Make Your Own Plan',
      subtitle: 'Build your coverage by selecting the protection your pet needs.',
      covers: [
        { key: 'injury' as const, label: 'Injury Cover' },
        { key: 'illness' as const, label: 'Illness Cover' },
        { key: 'surgery' as const, label: 'Surgery Cover' },
      ],
      sumInsured: [...PAWS_MYO_SUM_INSURED],
      copay: [] as number[],
      nilCopay: true,
    },
    third_party: {
      key: 'third_party' as const,
      title: 'Third-Party Liability',
      subtitle:
        'Protection against eligible third-party bodily injury and property damage liability.',
      covers: ['Third-party bodily injury', 'Third-party property damage'],
      sumInsured: [...PAWS_TPL_SUM_INSURED],
      copay: [] as number[],
      nilCopay: true,
    },
  },
  addons: [
    {
      key: 'veterinary_consultation' as const,
      label: 'Veterinary Consultation',
      description:
        '2 video consultations and 4 audio consultations, delivered through Petofy as described in the product leaflet.',
      blockedWithThirdPartyOnly: true,
    },
    {
      key: 'trip_cancellation' as const,
      label: 'Trip Cancellation',
      description:
        'Protection against eligible non-refundable domestic travel and accommodation expenses if a covered medical emergency involving your pet forces you to cancel or cut short your trip. Sum insured ₹10,000–₹50,000, subject to policy terms.',
      sumInsuredOptions: [...PAWS_TRIP_CANCEL_SUM],
      blockedWithThirdPartyOnly: true,
    },
    {
      key: 'funeral_expenses' as const,
      label: 'Funeral Expenses',
      description:
        'Additional benefit towards eligible funeral expenses — typically 10% of the base sum insured, subject to policy terms.',
      blockedWithThirdPartyOnly: true,
    },
  ],
  exclusionsNote:
    'Waiting periods, exclusions, and combination rules follow the HDFC ERGO Paws N Claws leaflet. Premium is confirmed by the insurer — Warmpawz never fabricates a bindable quote.',
  demoDisclaimer:
    'Any sample amounts shown in demos are illustrative only and are not HDFC ERGO-approved quotations.',
} as const;

function includesNumber(list: readonly number[], value: number): boolean {
  return list.some((n) => n === value);
}

/** Enforce leaflet combination rules on the server and client. */
export function validatePawsCoverageSelection(
  selection: CoverageSelection,
): CoverageValidationIssue[] {
  const issues: CoverageValidationIssue[] = [];
  if (!selection || !selection.mainSection) {
    issues.push({ code: 'MAIN_REQUIRED', message: 'Select at least one main coverage section' });
    return issues;
  }

  const section = selection.mainSection;
  const addons = Array.isArray(selection.addons) ? selection.addons : [];

  if (section === 'comprehensive') {
    if (!includesNumber(PAWS_COMPREHENSIVE_SUM_INSURED, selection.sumInsured)) {
      issues.push({ code: 'SUM_INSURED_INVALID', message: 'Select a valid Comprehensive sum insured' });
    }
    if (selection.copayPercent == null || !PAWS_COPAY.includes(selection.copayPercent as (typeof PAWS_COPAY)[number])) {
      issues.push({ code: 'COPAY_REQUIRED', message: 'Select a co-pay of 10%, 20%, or 30%' });
    }
  }

  if (section === 'make_your_own') {
    const covers = selection.myoCovers || [];
    if (covers.length === 0) {
      issues.push({
        code: 'MYO_COVER_REQUIRED',
        message: 'Select Injury, Illness, and/or Surgery for Make Your Own Plan',
      });
    }
    for (const c of covers) {
      if (!['injury', 'illness', 'surgery'].includes(c)) {
        issues.push({ code: 'MYO_COVER_INVALID', message: `Invalid cover: ${c}` });
      }
    }
    if (!includesNumber(PAWS_MYO_SUM_INSURED, selection.sumInsured)) {
      issues.push({ code: 'SUM_INSURED_INVALID', message: 'Select a valid Make Your Own sum insured' });
    }
    if (selection.copayPercent != null && selection.copayPercent !== 0) {
      issues.push({ code: 'COPAY_NOT_ALLOWED', message: 'Make Your Own Plan has nil co-pay' });
    }
  }

  if (section === 'third_party') {
    if (!includesNumber(PAWS_TPL_SUM_INSURED, selection.sumInsured)) {
      issues.push({ code: 'SUM_INSURED_INVALID', message: 'Select a valid Third-Party Liability sum insured' });
    }
    if (addons.length > 0) {
      issues.push({
        code: 'ADDONS_BLOCKED_WITH_TPL',
        message: 'Optional covers cannot be combined with Third-Party Liability alone',
      });
    }
    if (selection.copayPercent != null && selection.copayPercent !== 0) {
      issues.push({ code: 'COPAY_NOT_ALLOWED', message: 'Third-Party Liability has nil co-pay' });
    }
  }

  if (section !== 'third_party') {
    for (const addon of addons) {
      if (!['veterinary_consultation', 'trip_cancellation', 'funeral_expenses'].includes(addon)) {
        issues.push({ code: 'ADDON_INVALID', message: `Invalid add-on: ${addon}` });
      }
    }
    if (addons.includes('trip_cancellation')) {
      const trip = selection.tripCancellationSumInsured;
      if (trip == null || !includesNumber(PAWS_TRIP_CANCEL_SUM, trip)) {
        issues.push({
          code: 'TRIP_SUM_REQUIRED',
          message: 'Select a Trip Cancellation sum insured between ₹10,000 and ₹50,000',
        });
      }
    }
  }

  return issues;
}

export function isPawsCoverageSelectionValid(selection: CoverageSelection): boolean {
  return validatePawsCoverageSelection(selection).length === 0;
}

export const HEALTH_DECLARATION_FIELDS = [
  {
    key: 'priorIllnessOrInjury',
    label: 'Has your pet had any previous illness or injury?',
    type: 'yes_no' as const,
    followUpHint: 'Briefly describe the illness or injury',
  },
  {
    key: 'priorVetDiagnosis',
    label: 'Has a veterinarian previously diagnosed any medical condition?',
    type: 'yes_no' as const,
    followUpHint: 'Share the diagnosed condition',
  },
  {
    key: 'ongoingMedicationOrTreatment',
    label: 'Is your pet currently taking medication or receiving ongoing treatment?',
    type: 'yes_no' as const,
    followUpHint: 'List medication or treatment details',
  },
  {
    key: 'otherMedicalDisclosure',
    label: 'Any other relevant medical disclosure?',
    type: 'text' as const,
    required: false,
  },
] as const;

export type HealthDeclarations = {
  priorIllnessOrInjury: 'Yes' | 'No';
  priorVetDiagnosis: 'Yes' | 'No';
  ongoingMedicationOrTreatment: 'Yes' | 'No';
  otherMedicalDisclosure?: string;
  /** Kept even if answer flips to No — never silently discard disclosures. */
  priorIllnessOrInjuryDetails?: string;
  priorVetDiagnosisDetails?: string;
  ongoingMedicationOrTreatmentDetails?: string;
};
