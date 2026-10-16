import type { FormFieldSchema, FormSchema, FormSectionSchema } from './form-schema';

const YES_NO = ['Yes', 'No'] as const;
const SUM_INSURED = ['10000', '20000', '30000', '40000', '50000', '60000', '70000', '80000'] as const;
const CO_PAY = ['10', '20', '30'] as const;

function field(partial: FormFieldSchema): FormFieldSchema {
  return partial;
}

function petFieldsForCount(index: number): FormFieldSchema[] {
  const n = String(index);
  const prefix = `pet${n}_`;
  const when = { field: 'petCount', equals: `>=${n}` } as const;
  return [
    field({
      key: `${prefix}label`,
      label: `Pet ${n}`,
      type: 'section_note',
      required: false,
      showIf: when,
    }),
    field({
      key: `${prefix}type`,
      label: 'Pet type',
      type: 'select',
      required: true,
      options: ['Dog', 'Cat'],
      optionsVerified: false,
      slug: index === 1 ? 'pet.species' : undefined,
      showIf: when,
    }),
    field({
      key: `${prefix}breed`,
      label: 'Pet breed',
      type: 'select',
      required: true,
      options: ['Others'],
      optionsVerified: false,
      helperText: 'Full breed master list not yet verified',
      slug: index === 1 ? 'pet.breed' : undefined,
      showIf: when,
    }),
    field({
      key: `${prefix}sex`,
      label: 'Sex',
      type: 'select',
      required: true,
      options: ['M', 'F'],
      optionsVerified: false,
      slug: index === 1 ? 'pet.gender' : undefined,
      showIf: when,
    }),
    field({
      key: `${prefix}age`,
      label: 'Age of pet',
      type: 'select',
      required: true,
      options: ['1 Years'],
      optionsVerified: false,
      helperText: 'Exact age dropdown values not yet verified',
      showIf: when,
    }),
    field({
      key: `${prefix}microchip`,
      label: 'Microchip number',
      type: 'text',
      required: false,
      slug: index === 1 ? 'pet.microchip_id' : undefined,
      showIf: when,
    }),
    field({
      key: `${prefix}commercial`,
      label: 'Commercial activities extension',
      type: 'radio',
      required: false,
      options: [...YES_NO],
      showIf: when,
    }),
    field({
      key: `${prefix}idMark`,
      label: 'Pet identification mark',
      type: 'text',
      required: true,
      helperText: 'Required on proposal screenshots',
      slug: index === 1 ? 'pet.identification_mark' : undefined,
      showIf: when,
    }),
  ];
}

const quotePlanDetails: FormSectionSchema = {
  key: 'quote_plan_details',
  title: '1.1 Plan Details',
  workflow: 'quote',
  fields: [
    field({
      key: 'policyType',
      label: 'Policy type',
      type: 'select',
      required: true,
      options: ['New Business'],
      optionsVerified: false,
      helperText: 'Complete business-type options not yet verified',
    }),
    field({
      key: 'policyEffectiveFrom',
      label: 'Policy effective from date',
      type: 'date',
      required: true,
      helperText: 'Portal uses date+time; time limits unverified — date only for now',
    }),
    field({
      key: 'policyEffectiveTo',
      label: 'Policy effective to date',
      type: 'date',
      required: true,
      helperText: 'Portal uses date+time; time limits unverified — date only for now',
    }),
    field({
      key: 'breederType',
      label: 'Breeder type',
      type: 'select',
      required: true,
      options: ['Individual Pet Owner', 'Commercial Breeder'],
    }),
    field({
      key: 'petSpecies',
      label: 'I would like to insure',
      type: 'multiselect',
      required: true,
      options: ['Dog', 'Cat'],
      optionsVerified: false,
      helperText: 'Whether both can be selected together is unverified',
    }),
    field({
      key: 'petCount',
      label: 'How many pets do you own?',
      type: 'select',
      required: true,
      options: ['1', '2', '3', '4', '5'],
      min: 1,
      max: 5,
    }),
    field({
      key: 'planType',
      label: 'Plan type',
      type: 'select',
      required: true,
      options: ['Comprehensive Plan – All Risk', 'Make Your Own Plan', 'Third Party Liability'],
    }),
    field({
      key: 'petLocation',
      label: 'Pet location',
      type: 'text',
      required: true,
      helperText: 'Allowed locations and validation unverified',
      slug: 'address.city',
    }),
  ],
};

const quotePetDetails: FormSectionSchema = {
  key: 'quote_pet_details',
  title: '1.2 Pet Details',
  workflow: 'quote',
  repeater: { countField: 'petCount', max: 5 },
  fields: [1, 2, 3, 4, 5].flatMap((i) => petFieldsForCount(i)),
};

const quoteCovers: FormSectionSchema = {
  key: 'quote_covers',
  title: '1.3 Covers',
  workflow: 'quote',
  fields: [
    field({
      key: 'sumInsured',
      label: 'Choose sum insured',
      type: 'select',
      required: true,
      options: [...SUM_INSURED],
      unit: 'INR',
      helperText: 'Observed ₹10,000–₹80,000 in ₹10,000 steps for this screen',
    }),
    field({
      key: 'coPay',
      label: 'Choose co-pay',
      type: 'select',
      required: true,
      options: [...CO_PAY],
      unit: 'percent',
      optionsVerified: false,
      helperText: '10 / 20 / 30 observed; upper limit unverified',
    }),
    field({
      key: 'opdCover',
      label: 'OPD cover',
      type: 'radio',
      required: false,
      options: [...YES_NO],
    }),
    field({
      key: 'opdCoverAmount',
      label: 'OPD cover amount',
      type: 'select',
      required: false,
      options: ['50000'],
      unit: 'INR',
      optionsVerified: false,
      showIf: { field: 'opdCover', equals: 'Yes' },
      helperText: '₹50,000 displayed; selectable range not confirmed',
    }),
  ],
};

const quoteAddOns: FormSectionSchema = {
  key: 'quote_addons',
  title: '1.4 Add-on Covers',
  workflow: 'quote',
  fields: [
    field({ key: 'tpl', label: 'Third party liability', type: 'radio', required: false, options: [...YES_NO] }),
    field({
      key: 'tplAmount',
      label: 'Third party liability amount',
      type: 'select',
      required: false,
      options: ['800000'],
      unit: 'INR',
      optionsVerified: false,
      showIf: { field: 'tpl', equals: 'Yes' },
      helperText: '₹8,00,000 displayed; editability unverified',
    }),
    field({ key: 'tripCancel', label: 'Trip cancellation', type: 'radio', required: false, options: [...YES_NO] }),
    field({
      key: 'tripCancelAmount',
      label: 'Trip cancellation amount',
      type: 'select',
      required: false,
      options: ['50000'],
      unit: 'INR',
      optionsVerified: false,
      showIf: { field: 'tripCancel', equals: 'Yes' },
    }),
    field({ key: 'funeral', label: 'Funeral expenses', type: 'radio', required: false, options: [...YES_NO] }),
    field({
      key: 'funeralAmount',
      label: 'Funeral expenses amount',
      type: 'select',
      required: false,
      options: ['8000'],
      unit: 'INR',
      optionsVerified: false,
      showIf: { field: 'funeral', equals: 'Yes' },
    }),
    field({
      key: 'vetConsult',
      label: 'Veterinary consultation (VAS)',
      type: 'radio',
      required: false,
      options: [...YES_NO],
    }),
    field({
      key: 'vetConsultBenefit',
      label: 'Veterinary consultation benefit',
      type: 'section_note',
      required: false,
      helperText: '4 telephonic calls and 2 video consultations (displayed benefit; not a monetary input)',
      showIf: { field: 'vetConsult', equals: 'Yes' },
    }),
  ],
};

const quoteEligibility: FormSectionSchema = {
  key: 'quote_eligibility',
  title: '1.5 Check Eligibility',
  workflow: 'quote',
  fields: [
    field({
      key: 'petHealthy',
      label: 'Pet health status',
      type: 'radio',
      required: true,
      options: [...YES_NO],
      helperText: 'Vaccination refs: Rabies, Distemper, Hepatitis, Adenovirus, Leptospirosis, Para Influenza, Corona, Parvo',
    }),
    field({
      key: 'unhealthyReason',
      label: 'Reason for not being healthy',
      type: 'textarea',
      required: true,
      showIf: { field: 'petHealthy', equals: 'No' },
      helperText: 'Eligibility outcome for unhealthy pets is unverified',
    }),
    field({ key: 'vaccinationStatus', label: 'Vaccination status', type: 'radio', required: true, options: [...YES_NO] }),
    field({
      key: 'vaccinationScheduleAvailable',
      label: 'Vaccination schedule available?',
      type: 'radio',
      required: true,
      options: [...YES_NO],
    }),
    field({
      key: 'healthReportAvailable',
      label: 'Vaccination and health report available?',
      type: 'radio',
      required: true,
      options: [...YES_NO],
    }),
  ],
};

const quotePersonal: FormSectionSchema = {
  key: 'quote_personal',
  title: '1.6 Personal',
  workflow: 'quote',
  fields: [
    field({ key: 'proposerName', label: 'Name', type: 'text', required: true, slug: 'customer.full_name' }),
    field({ key: 'proposerEmail', label: 'Email', type: 'email', required: true, slug: 'customer.email' }),
    field({
      key: 'proposerSecondaryEmail',
      label: 'Secondary email',
      type: 'text',
      required: false,
      helperText: 'Multiple emails may be comma/semicolon separated',
    }),
    field({ key: 'proposerMobile', label: 'Mobile no', type: 'phone', required: true, slug: 'customer.phone' }),
    field({ key: 'proposerSecondaryMobile', label: 'Secondary mobile no', type: 'phone', required: false }),
    field({
      key: 'existingPolicyAbove2000',
      label: 'Existing HDFC ERGO policy with premium above ₹2,000?',
      type: 'radio',
      required: false,
      options: [...YES_NO],
      optionsVerified: false,
    }),
    field({
      key: 'existingPolicyNumber',
      label: 'Existing policy number',
      type: 'text',
      required: true,
      showIf: { field: 'existingPolicyAbove2000', equals: 'Yes' },
    }),
    field({
      key: 'existingPolicyConfirm',
      label: 'I confirm I have an active HDFC ERGO policy with premium above ₹2,000',
      type: 'checkbox',
      required: true,
      showIf: { field: 'existingPolicyAbove2000', equals: 'Yes' },
    }),
  ],
};

const proposalCustomer: FormSectionSchema = {
  key: 'proposal_customer',
  title: '2.1 Customer Details',
  workflow: 'proposal',
  fields: [
    field({
      key: 'quoteNo',
      label: 'Quote no',
      type: 'text',
      required: false,
      helperText: 'System-generated by insurer when available — read-only in portal',
    }),
    field({
      key: 'customerCode',
      label: 'Customer code',
      type: 'text',
      required: true,
      helperText: 'Insurer lookup integration unverified — enter manually for now',
    }),
    field({ key: 'customerName', label: 'Customer name', type: 'text', required: true, slug: 'customer.full_name' }),
    field({ key: 'flatNo', label: 'Flat no / house no', type: 'text', required: true, slug: 'customer.house_no' }),
    field({ key: 'houseName', label: 'House / apartment name', type: 'text', required: true, slug: 'address.line2' }),
    field({ key: 'street', label: 'Street name / locality', type: 'text', required: true, slug: 'address.line1' }),
    field({ key: 'city', label: 'City / district', type: 'text', required: true, slug: 'address.city' }),
    field({
      key: 'state',
      label: 'State',
      type: 'text',
      required: true,
      slug: 'address.state',
      helperText: 'Indian state/UT list expected; portal list unverified',
    }),
    field({ key: 'pincode', label: 'Pincode', type: 'text', required: true, slug: 'address.pincode' }),
  ],
};

const proposalPetVerify: FormSectionSchema = {
  key: 'proposal_pet_verify',
  title: '2.2 Pet Verification',
  workflow: 'proposal',
  fields: [
    field({
      key: 'petPhoto',
      label: 'Pet photo upload',
      type: 'file',
      required: false,
      helperText: 'Formats, size limits, and mandatory status unverified',
    }),
    field({
      key: 'petOwnerPhoto',
      label: 'Photo of pet with insured person',
      type: 'file',
      required: false,
      helperText: 'Formats, size limits, and mandatory status unverified',
    }),
    field({
      key: 'proposalIdMark',
      label: 'Pet identification mark',
      type: 'text',
      required: true,
      slug: 'pet.identification_mark',
    }),
  ],
};

const proposalNominee: FormSectionSchema = {
  key: 'proposal_nominee',
  title: '2.3 Nominee Details',
  workflow: 'proposal',
  fields: [
    field({
      key: 'nomineeTitle',
      label: 'Title',
      type: 'select',
      required: false,
      options: ['Mr', 'Mrs', 'Ms'],
      optionsVerified: false,
    }),
    field({ key: 'nomineeName', label: 'Nominee name', type: 'text', required: false }),
    field({ key: 'nomineeDob', label: 'Date of birth', type: 'date', required: false }),
    field({
      key: 'nomineeRelationship',
      label: 'Relationship',
      type: 'select',
      required: false,
      options: ['Spouse', 'Parent', 'Child', 'Sibling'],
      optionsVerified: false,
      helperText: 'Nominee must be an immediate relative (portal note)',
    }),
    field({
      key: 'nomineeAddressSame',
      label: 'Address same as proposer',
      type: 'checkbox',
      required: false,
    }),
    field({
      key: 'nomineeAddress',
      label: 'Nominee address',
      type: 'textarea',
      required: false,
      helperText: 'Portal showed ~300 character counter; hard limit unverified',
      showIf: { field: 'nomineeAddressSame', equals: false },
    }),
  ],
};

const proposalSummary: FormSectionSchema = {
  key: 'proposal_summary',
  title: '2.4 Proposal Summary',
  workflow: 'proposal',
  fields: [
    field({
      key: 'summaryAck',
      label: 'I have reviewed customer, plan, pet, cover, eligibility, personal and nominee details',
      type: 'checkbox',
      required: true,
      helperText: 'Review layout for Warmpawz; editability on insurer summary is unverified',
    }),
  ],
};

/**
 * Default sendable Quote → Proposal form for Warmpawz Insurance vendors.
 * Observed HDFC ERGO Paws n Claws fields only; unverified options are flagged.
 */
export const DEFAULT_PAWS_N_CLAWS_FORM: FormSchema = {
  insurerKey: 'HDFC_ERGO',
  productKey: 'PAWS_N_CLAWS',
  sections: [
    quotePlanDetails,
    quotePetDetails,
    quoteCovers,
    quoteAddOns,
    quoteEligibility,
    quotePersonal,
    proposalCustomer,
    proposalPetVerify,
    proposalNominee,
    proposalSummary,
  ],
};

export const DEFAULT_PAWS_N_CLAWS_FORM_NAME = 'Paws n Claws — Quote & Proposal';
