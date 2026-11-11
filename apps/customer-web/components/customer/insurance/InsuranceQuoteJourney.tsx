'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Cat,
  Check,
  Copy,
  Dog,
  Headphones,
  Home,
  PawPrint,
  Shield,
  ShieldAlert,
  Sparkles,
  Stethoscope,
} from 'lucide-react';
import {
  PAWS_N_CLAWS_PRODUCT,
  HEALTH_DECLARATION_FIELDS,
  isPawsCoverageSelectionValid,
  validatePawsCoverageSelection,
  type CoverageSelection,
  type HealthDeclarations,
  type MakeYourOwnCover,
  type PawsAddon,
  type PawsMainSection,
} from '@warmpawz/shared-types';
import { apiClient } from '@/lib/api-client';
import { resolveCustomerId } from '@/lib/insurance-customer';
import {
  hasAuthenticatedCustomerSession,
  requestGuestAuth,
} from '@/lib/guest-auth-gate';
import { breedsForSpecies } from '@/lib/pet-breeds';
import {
  BreedSearchInput,
  EligibilityPill,
  FieldLabel,
  InfoBanner,
  JourneyShell,
  JourneyStepper,
  PrimaryButton,
  SecondaryButton,
  SectionTitle,
  SelectChip,
  SelectableCard,
  SoftCard,
  TextInput,
  formatInr,
  petAgeFromDob,
} from './insurance-journey-ui';

type Step = 1 | 2 | 3 | 4 | 5;

type PetRow = {
  id: string;
  name?: string;
  species?: string;
  type?: string;
  breed?: string;
  date_of_birth?: string;
  dob?: string;
  weight?: number | string;
  photo_url?: string;
  gender?: string;
};

type OwnerForm = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
};

function isPlaceholderCustomerName(value: string, phoneDigits = ''): boolean {
  const trimmed = value.trim();
  if (!trimmed) return true;
  const last4 = phoneDigits.replace(/\D/g, '').slice(-4);
  if (last4 && /^customer\s+\d{4}$/i.test(trimmed) && trimmed.toLowerCase().endsWith(last4)) {
    return true;
  }
  return /^customer\s+\d{3,}$/i.test(trimmed);
}

function petRowId(pet: Record<string, unknown>): string {
  return String(pet.id || pet.petId || pet.pet_id || '').trim();
}

function normalizePetsPayload(raw: unknown): PetRow[] {
  if (!raw) return [];
  if (Array.isArray(raw)) {
    return raw
      .map((row) => {
        const pet = row as Record<string, unknown>;
        const id = petRowId(pet);
        if (!id) return null;
        return {
          id,
          name: pet.name ? String(pet.name) : undefined,
          species: pet.species ? String(pet.species) : pet.type ? String(pet.type) : undefined,
          type: pet.type ? String(pet.type) : undefined,
          breed: pet.breed ? String(pet.breed) : undefined,
          date_of_birth: pet.date_of_birth ? String(pet.date_of_birth) : undefined,
          dob: pet.dob ? String(pet.dob) : undefined,
          weight: (pet.weight as number | string | undefined) ?? undefined,
          photo_url: pet.photo_url ? String(pet.photo_url) : undefined,
          gender: pet.gender ? String(pet.gender) : undefined,
        } as PetRow;
      })
      .filter(Boolean) as PetRow[];
  }
  if (typeof raw === 'object' && Array.isArray((raw as { pets?: unknown }).pets)) {
    return normalizePetsPayload((raw as { pets: unknown }).pets);
  }
  return [];
}

function readOwnerFromStorage(): OwnerForm {
  if (typeof window === 'undefined') {
    return { firstName: '', lastName: '', email: '', phone: '' };
  }
  try {
    const data = JSON.parse(localStorage.getItem('customerData') || '{}') as Record<string, unknown>;
    const phone = String(data.phone || data.mobile || localStorage.getItem('customerPhone') || '');
    const fullRaw = String(data.fullName || data.full_name || data.name || '').trim();
    const firstRaw = String(data.firstName || data.first_name || '').trim();
    const lastRaw = String(data.lastName || data.last_name || '').trim();
    const full = isPlaceholderCustomerName(fullRaw, phone) ? '' : fullRaw;
    const firstFromFull = full ? full.split(/\s+/)[0] || '' : '';
    const lastFromFull = full ? full.split(/\s+/).slice(1).join(' ') : '';
    const firstName = isPlaceholderCustomerName(firstRaw, phone) ? firstFromFull : firstRaw || firstFromFull;
    const lastName = isPlaceholderCustomerName(`${firstRaw} ${lastRaw}`.trim(), phone)
      ? lastFromFull
      : lastRaw || lastFromFull;
    return {
      firstName,
      lastName,
      email: String(data.email || ''),
      phone,
    };
  } catch {
    return {
      firstName: '',
      lastName: '',
      email: '',
      phone: typeof window !== 'undefined' ? localStorage.getItem('customerPhone') || '' : '',
    };
  }
}

function healthDetailKey(
  key: 'priorIllnessOrInjury' | 'priorVetDiagnosis' | 'ongoingMedicationOrTreatment',
): keyof HealthDeclarations {
  if (key === 'priorIllnessOrInjury') return 'priorIllnessOrInjuryDetails';
  if (key === 'priorVetDiagnosis') return 'priorVetDiagnosisDetails';
  return 'ongoingMedicationOrTreatmentDetails';
}

type Props = {
  phone: string;
  initialStep?: Step;
  onBack: () => void;
  onTalkToExpert: () => void;
  onGoMyInsurance: () => void;
};

const PLAN_ICONS: Record<PawsMainSection, typeof Shield> = {
  comprehensive: Shield,
  make_your_own: Sparkles,
  third_party: ShieldAlert,
};

export function InsuranceQuoteJourney({
  phone,
  initialStep = 1,
  onBack,
  onTalkToExpert,
  onGoMyInsurance,
}: Props) {
  const [step, setStep] = useState<Step>(initialStep);
  const [planId, setPlanId] = useState('');
  const [owner, setOwner] = useState<OwnerForm>(() => readOwnerFromStorage());
  const [pets, setPets] = useState<PetRow[]>([]);
  const [petId, setPetId] = useState('');
  const [petDraft, setPetDraft] = useState({
    name: '',
    species: 'Dog',
    breed: '',
    dob: '',
    weight: '',
    gender: '' as '' | 'male' | 'female' | 'neutered' | 'spayed',
  });
  const [addingNewPet, setAddingNewPet] = useState(false);
  const [health, setHealth] = useState<HealthDeclarations>({
    priorIllnessOrInjury: 'No',
    priorVetDiagnosis: 'No',
    ongoingMedicationOrTreatment: 'No',
    otherMedicalDisclosure: '',
    priorIllnessOrInjuryDetails: '',
    priorVetDiagnosisDetails: '',
    ongoingMedicationOrTreatmentDetails: '',
  });
  const [coverage, setCoverage] = useState<CoverageSelection | null>(null);
  const [planNotice, setPlanNotice] = useState('');
  const [consent, setConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<{
    applicationId: string;
    reference: string;
    status: string;
  } | null>(null);
  const [loadingPets, setLoadingPets] = useState(false);

  useEffect(() => {
    apiClient
      .get<{ data?: { planId?: string } }>('/customer/insurance/products/paws-n-claws')
      .then((res) => setPlanId(String(res.data?.planId || '')))
      .catch(() => setPlanId(''));
  }, []);

  useEffect(() => {
    if (!hasAuthenticatedCustomerSession()) return;
    setOwner(readOwnerFromStorage());
    const load = async () => {
      setLoadingPets(true);
      try {
        const customerId = await resolveCustomerId().catch(() => '');
        const phoneDigits = (phone || owner.phone || localStorage.getItem('customerPhone') || '').replace(
          /\D/g,
          '',
        );
        let list: PetRow[] = [];
        if (phoneDigits.length >= 10) {
          const res = await apiClient.get(`/customer/pets/${phoneDigits}`);
          list = normalizePetsPayload(
            (res as { pets?: unknown }).pets ?? (res as { data?: { pets?: unknown } }).data?.pets ?? res,
          );
        }
        if (!list.length && customerId) {
          const res = await apiClient.get(`/customer/pets?customerId=${customerId}`).catch(() => null);
          list = normalizePetsPayload(
            (res as { pets?: unknown } | null)?.pets ??
              (res as { data?: { pets?: unknown } } | null)?.data?.pets ??
              res,
          );
        }
        setPets(list);
        if (list[0]?.id) setPetId(list[0].id);
      } catch {
        setPets([]);
      } finally {
        setLoadingPets(false);
      }
    };
    void load();
  }, [phone, owner.phone]);

  const coverageIssues = useMemo(
    () => (coverage ? validatePawsCoverageSelection(coverage) : [{ code: 'MAIN_REQUIRED', message: 'Select a plan to continue' }]),
    [coverage],
  );
  const selectedPet = pets.find((p) => String(p.id) === petId);
  const usingNewPet = addingNewPet || !petId;
  const effectiveDob = usingNewPet
    ? petDraft.dob
    : String(selectedPet?.dob || selectedPet?.date_of_birth || '').slice(0, 10);
  const ageInfo = petAgeFromDob(effectiveDob);
  const breedOptions = breedsForSpecies(petDraft.species);

  const ensureAuth = (): boolean => {
    if (hasAuthenticatedCustomerSession()) return true;
    requestGuestAuth({
      mode: 'signup',
      returnPath: '/',
      resumeScreen: 'insurance_quote',
    });
    return false;
  };

  const toggleAddon = (key: PawsAddon) => {
    setCoverage((prev) => {
      if (!prev) return prev;
      const has = prev.addons.includes(key);
      const addons = has ? prev.addons.filter((a) => a !== key) : [...prev.addons, key];
      return {
        ...prev,
        addons,
        tripCancellationSumInsured:
          key === 'trip_cancellation' && !has
            ? prev.tripCancellationSumInsured || 10_000
            : key === 'trip_cancellation' && has
              ? null
              : prev.tripCancellationSumInsured,
      };
    });
  };

  const toggleMyo = (key: MakeYourOwnCover) => {
    setCoverage((prev) => {
      if (!prev) return prev;
      const has = (prev.myoCovers || []).includes(key);
      const myoCovers = has
        ? (prev.myoCovers || []).filter((c) => c !== key)
        : [...(prev.myoCovers || []), key];
      return { ...prev, myoCovers };
    });
  };

  const setMain = (mainSection: PawsMainSection) => {
    const hadAddons = (coverage?.addons.length || 0) > 0;
    if (mainSection === 'comprehensive') {
      setCoverage({
        mainSection,
        myoCovers: [],
        sumInsured: 100_000,
        copayPercent: 10,
        addons: [],
        tripCancellationSumInsured: null,
      });
      setPlanNotice(
        hadAddons && coverage?.mainSection === 'third_party'
          ? ''
          : hadAddons
            ? 'Optional covers were reset when changing plan — re-select any add-ons that still apply.'
            : '',
      );
    } else if (mainSection === 'make_your_own') {
      setCoverage({
        mainSection,
        myoCovers: ['injury'],
        sumInsured: 100_000,
        copayPercent: null,
        addons: [],
        tripCancellationSumInsured: null,
      });
      setPlanNotice(
        hadAddons
          ? 'Optional covers were reset when changing plan — re-select any add-ons that still apply.'
          : '',
      );
    } else {
      setCoverage({
        mainSection,
        myoCovers: [],
        sumInsured: 100_000,
        copayPercent: null,
        addons: [],
        tripCancellationSumInsured: null,
      });
      setPlanNotice(
        hadAddons
          ? 'Optional covers were removed — they cannot be combined with Third-Party Liability alone.'
          : 'Third-Party Liability has nil co-pay. Optional covers are not available with this section.',
      );
    }
  };

  const continueFromDetails = () => {
    if (!ensureAuth()) return;
    if (
      !owner.firstName.trim() ||
      isPlaceholderCustomerName(`${owner.firstName} ${owner.lastName}`.trim(), owner.phone) ||
      !owner.phone.trim()
    ) {
      setError('Enter your real name and mobile number to continue');
      return;
    }
    if (usingNewPet) {
      if (!petDraft.name.trim() || !petDraft.breed.trim() || !petDraft.dob.trim()) {
        setError('Enter pet name, breed, and date of birth');
        return;
      }
      if (!petDraft.gender) {
        setError('Select pet gender to continue');
        return;
      }
    } else if (!petId) {
      setError('Select a pet or enter pet details');
      return;
    }
    setError('');
    setStep(2);
  };

  const continueFromPlan = () => {
    if (!coverage || !isPawsCoverageSelectionValid(coverage)) {
      setError(coverageIssues[0]?.message || 'Fix coverage selection');
      return;
    }
    setError('');
    setPlanNotice('');
    setStep(3);
  };

  const submitEnquiry = async () => {
    if (!consent) {
      setError('Please accept Terms & Conditions');
      return;
    }
    if (!ensureAuth()) return;
    if (!planId) {
      setError('Paws N Claws product is not published yet. Please try again shortly.');
      return;
    }
    if (!coverage || !isPawsCoverageSelectionValid(coverage)) {
      setError(coverageIssues[0]?.message || 'Fix coverage selection');
      return;
    }
    if (submitting) return;
    setSubmitting(true);
    setError('');
    try {
      const customerId = await resolveCustomerId();
      let resolvedPetId = !addingNewPet && petId && petId !== 'undefined' ? petId : '';
      if (!resolvedPetId) {
        if (!petDraft.name.trim() || !petDraft.breed.trim() || !petDraft.dob.trim() || !petDraft.gender) {
          throw new Error('Pet name, breed, date of birth, and gender are required');
        }
        const phoneDigits = (owner.phone || phone || localStorage.getItem('customerPhone') || '').replace(
          /\D/g,
          '',
        );
        const created = (await apiClient.post('/customer/pets', {
          phone: phoneDigits,
          source: 'insurance_quote',
          pets: [
            {
              name: petDraft.name.trim(),
              type: petDraft.species || 'Dog',
              species: petDraft.species || 'Dog',
              breed: petDraft.breed.trim(),
              dob: petDraft.dob,
              gender: petDraft.gender,
              weight: petDraft.weight ? Number(petDraft.weight) : undefined,
            },
          ],
        })) as { pets?: Array<{ id?: string }>; data?: { pets?: Array<{ id?: string }> } };
        const createdList = normalizePetsPayload(created.pets || created.data?.pets || []);
        resolvedPetId = createdList[0]?.id || String(created.pets?.[0]?.id || '');
      }
      if (!resolvedPetId) throw new Error('Could not resolve pet');

      const res = await apiClient.post<{
        data?: { applicationId?: string; reference?: string; status?: string };
        error?: { message?: string };
      }>('/customer/insurance/enquiries', {
        customerId,
        petId: resolvedPetId,
        planId,
        coverageSelection: coverage,
        healthDeclarations: health,
        ownerSnapshot: owner,
      });
      const applicationId = String(res.data?.applicationId || '');
      if (!applicationId) throw new Error((res as { error?: { message?: string } }).error?.message || 'Submit failed');
      setResult({
        applicationId,
        reference: String(res.data?.reference || `APP-${applicationId.slice(0, 8).toUpperCase()}`),
        status: String(res.data?.status || 'enquiry_submitted'),
      });
      setStep(5);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not submit application');
    } finally {
      setSubmitting(false);
    }
  };

  const product = PAWS_N_CLAWS_PRODUCT;
  const stepperActive: 1 | 2 | 3 = step <= 1 ? 1 : step === 2 ? 2 : 3;
  const petDisplayName = selectedPet?.name || petDraft.name || 'Your pet';
  const planTitle = coverage ? product.sections[coverage.mainSection].title : 'Not selected';

  const stepMeta =
    step === 1
      ? {
          title: 'Pet & owner details',
          description: 'Tell us about your pet so HDFC ERGO can assess eligibility.',
        }
      : step === 2
        ? {
            title: 'Choose your coverage',
            description: 'Pick a plan, then customise sum insured and optional covers.',
          }
        : step === 3 || step === 4
          ? {
              title: 'Review your application',
              description: 'Confirm details before requesting an insurer quotation.',
            }
          : {
              title: 'Application submitted',
              description: 'An advisor will obtain the official HDFC ERGO quote.',
            };

  const footer =
    step === 1 ? (
      <PrimaryButton onClick={continueFromDetails}>Continue to coverage</PrimaryButton>
    ) : step === 2 ? (
      <PrimaryButton onClick={continueFromPlan}>Review application</PrimaryButton>
    ) : step === 3 || step === 4 ? (
      <PrimaryButton disabled={submitting} onClick={() => void submitEnquiry()}>
        {submitting ? 'Submitting…' : 'Submit & Get My Quote'}
      </PrimaryButton>
    ) : null;

  return (
    <JourneyShell
      title="HDFC ERGO · Paws N Claws"
      subtitle={stepMeta.title}
      onBack={() => {
        if (step === 5 || step === 1) onBack();
        else setStep((s) => (s > 1 ? ((s - 1) as Step) : s));
      }}
      footer={footer}
    >
      {step < 5 ? <JourneyStepper active={stepperActive} /> : null}

      <div className="space-y-1">
        <h1 className="text-xl font-bold text-[#1F2A37]">{stepMeta.title}</h1>
        <p className="text-sm text-[#6B7280]">{stepMeta.description}</p>
      </div>

      {error ? (
        <div className="text-sm text-red-700 bg-red-50 border border-red-100 rounded-xl px-3 py-2">{error}</div>
      ) : null}

      {step === 1 ? (
        <>
          <SoftCard className="space-y-3">
            <SectionTitle
              title="Pet profile"
              description="Age is used for entry eligibility (typically 6 months–5 years). Final underwriting is by HDFC ERGO."
            />
            {loadingPets ? <p className="text-sm text-[#6B7280]">Loading pets…</p> : null}

            {pets.length > 0 && !addingNewPet ? (
              <div className="space-y-2">
                {pets.map((pet) => (
                  <SelectableCard
                    key={pet.id}
                    selected={petId === String(pet.id)}
                    onClick={() => {
                      setAddingNewPet(false);
                      setPetId(String(pet.id));
                    }}
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-xl bg-[#FFF4EC] text-[#FF8C42] flex items-center justify-center">
                        <PawPrint className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="font-semibold">{pet.name || 'Pet'}</p>
                        <p className="text-xs text-[#6B7280]">
                          {[pet.species || pet.type, pet.breed].filter(Boolean).join(' · ') ||
                            'Details on file'}
                        </p>
                      </div>
                    </div>
                  </SelectableCard>
                ))}
                <button
                  type="button"
                  className="text-sm font-semibold text-[#FF8C42]"
                  onClick={() => {
                    setAddingNewPet(true);
                    setPetId('');
                  }}
                >
                  + Add a different pet
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {pets.length > 0 ? (
                  <button
                    type="button"
                    className="text-sm font-semibold text-[#6B7280]"
                    onClick={() => {
                      setAddingNewPet(false);
                      if (pets[0]?.id) setPetId(String(pets[0].id));
                    }}
                  >
                    ← Choose an existing pet
                  </button>
                ) : null}

                <div>
                  <FieldLabel>Pet name</FieldLabel>
                  <TextInput
                    value={petDraft.name}
                    onChange={(e) => setPetDraft((p) => ({ ...p, name: e.target.value }))}
                    placeholder="e.g. Scooby"
                  />
                </div>

                <div>
                  <FieldLabel>Species</FieldLabel>
                  <div className="grid grid-cols-2 gap-2">
                    {(
                      [
                        { value: 'Dog', icon: Dog },
                        { value: 'Cat', icon: Cat },
                      ] as const
                    ).map((sp) => (
                      <SelectableCard
                        key={sp.value}
                        selected={petDraft.species === sp.value}
                        onClick={() =>
                          setPetDraft((p) => ({
                            ...p,
                            species: sp.value,
                            breed: '',
                          }))
                        }
                        className="!p-3"
                      >
                        <div className="flex items-center gap-2">
                          <sp.icon className="w-5 h-5 text-[#FF8C42]" />
                          <span className="font-semibold">{sp.value}</span>
                        </div>
                      </SelectableCard>
                    ))}
                  </div>
                </div>

                <div>
                  <FieldLabel hint="Search from common breeds or type your own">Breed</FieldLabel>
                  <BreedSearchInput
                    value={petDraft.breed}
                    options={breedOptions}
                    onChange={(breed) => setPetDraft((p) => ({ ...p, breed }))}
                  />
                </div>

                <div>
                  <FieldLabel>Gender</FieldLabel>
                  <div className="flex flex-wrap gap-2">
                    {(
                      [
                        { value: 'male', label: 'Male' },
                        { value: 'female', label: 'Female' },
                        { value: 'neutered', label: 'Neutered' },
                        { value: 'spayed', label: 'Spayed' },
                      ] as const
                    ).map((g) => (
                      <SelectChip
                        key={g.value}
                        label={g.label}
                        selected={petDraft.gender === g.value}
                        onClick={() => setPetDraft((p) => ({ ...p, gender: g.value }))}
                      />
                    ))}
                  </div>
                </div>

                <div>
                  <FieldLabel hint="Used to calculate age for entry eligibility">Date of birth</FieldLabel>
                  <TextInput
                    type="date"
                    value={petDraft.dob}
                    onChange={(e) => setPetDraft((p) => ({ ...p, dob: e.target.value }))}
                  />
                </div>

                <div>
                  <FieldLabel hint="Optional — share if known">Weight (kg)</FieldLabel>
                  <TextInput
                    inputMode="decimal"
                    value={petDraft.weight}
                    onChange={(e) => setPetDraft((p) => ({ ...p, weight: e.target.value }))}
                    placeholder="e.g. 12"
                  />
                </div>
              </div>
            )}

            {effectiveDob ? (
              <div className="space-y-2 pt-1">
                <p className="text-sm font-semibold text-[#1F2A37]">
                  Age: <span className="text-[#FF8C42]">{ageInfo.label}</span>
                </p>
                <EligibilityPill status={ageInfo.entryStatus} message={ageInfo.entryMessage} />
              </div>
            ) : usingNewPet ? (
              <EligibilityPill status="unknown" message={ageInfo.entryMessage} />
            ) : null}
          </SoftCard>

          <SoftCard className="space-y-3">
            <SectionTitle title="Pet owner details" description="Prefills from your Warmpawz profile when available." />
            <div className="grid grid-cols-2 gap-2">
              <div>
                <FieldLabel>First name</FieldLabel>
                <TextInput
                  value={owner.firstName}
                  onChange={(e) => setOwner((o) => ({ ...o, firstName: e.target.value }))}
                />
              </div>
              <div>
                <FieldLabel>Last name</FieldLabel>
                <TextInput
                  value={owner.lastName}
                  onChange={(e) => setOwner((o) => ({ ...o, lastName: e.target.value }))}
                />
              </div>
            </div>
            <div>
              <FieldLabel>Email</FieldLabel>
              <TextInput
                type="email"
                inputMode="email"
                value={owner.email}
                onChange={(e) => setOwner((o) => ({ ...o, email: e.target.value }))}
              />
            </div>
            <div>
              <FieldLabel>Registered mobile</FieldLabel>
              <TextInput
                inputMode="tel"
                value={owner.phone}
                onChange={(e) => setOwner((o) => ({ ...o, phone: e.target.value }))}
              />
            </div>
          </SoftCard>

          <SoftCard className="space-y-3">
            <SectionTitle
              title="Health declarations"
              description="Honest disclosures help the insurer underwrite accurately."
            />
            {HEALTH_DECLARATION_FIELDS.map((field) => (
              <div
                key={field.key}
                className="rounded-xl border border-[#F0E6DB] bg-[#FFFCF8] p-3 space-y-2"
              >
                <p className="text-sm font-medium text-[#1F2A37]">{field.label}</p>
                {field.type === 'yes_no' ? (
                  <>
                    <div className="flex gap-2">
                      {(['Yes', 'No'] as const).map((opt) => (
                        <SelectChip
                          key={opt}
                          label={opt}
                          selected={(health as Record<string, string>)[field.key] === opt}
                          onClick={() => setHealth((h) => ({ ...h, [field.key]: opt }))}
                        />
                      ))}
                    </div>
                    {(health as Record<string, string>)[field.key] === 'Yes' ? (
                      <div className="pl-1 border-l-2 border-[#FF8C42]/60 ml-1">
                        <FieldLabel hint="Optional but recommended">{field.followUpHint || 'Add details'}</FieldLabel>
                        <TextInput
                          value={String(
                            (health as Record<string, string | undefined>)[
                              healthDetailKey(
                                field.key as
                                  | 'priorIllnessOrInjury'
                                  | 'priorVetDiagnosis'
                                  | 'ongoingMedicationOrTreatment',
                              )
                            ] || '',
                          )}
                          onChange={(e) =>
                            setHealth((h) => ({
                              ...h,
                              [healthDetailKey(
                                field.key as
                                  | 'priorIllnessOrInjury'
                                  | 'priorVetDiagnosis'
                                  | 'ongoingMedicationOrTreatment',
                              )]: e.target.value,
                            }))
                          }
                          placeholder="Share a short note"
                        />
                      </div>
                    ) : null}
                  </>
                ) : (
                  <textarea
                    className="w-full rounded-xl border border-[#E8DED3] bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#FF8C42]/30"
                    rows={2}
                    value={health.otherMedicalDisclosure || ''}
                    onChange={(e) => setHealth((h) => ({ ...h, otherMedicalDisclosure: e.target.value }))}
                    placeholder="Optional details"
                  />
                )}
              </div>
            ))}
          </SoftCard>
        </>
      ) : null}

      {step === 2 ? (
        <>
          <SoftCard className="space-y-3">
            <SectionTitle title="Select a plan" description="No plan is pre-selected — choose what fits your pet." />
            {(
              [
                ['comprehensive', product.sections.comprehensive],
                ['make_your_own', product.sections.make_your_own],
                ['third_party', product.sections.third_party],
              ] as const
            ).map(([key, section]) => {
              const Icon = PLAN_ICONS[key];
              const selected = coverage?.mainSection === key;
              return (
                <SelectableCard key={key} selected={!!selected} onClick={() => setMain(key)}>
                  <div className="flex gap-3">
                    <div
                      className={`h-11 w-11 rounded-xl flex items-center justify-center shrink-0 ${
                        selected ? 'bg-[#FF8C42] text-white' : 'bg-[#FFF4EC] text-[#FF8C42]'
                      }`}
                    >
                      <Icon className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold">{section.title}</p>
                      <p className="text-sm text-[#6B7280] mt-1 leading-snug">{section.subtitle}</p>
                      <p className="text-[11px] font-medium text-[#9A6B3F] mt-2">
                        Sum insured {formatInr(section.sumInsured[0])}–
                        {formatInr(section.sumInsured[section.sumInsured.length - 1])}
                        {section.nilCopay ? ' · Nil co-pay' : ' · Co-pay 10/20/30%'}
                      </p>
                    </div>
                  </div>
                </SelectableCard>
              );
            })}
          </SoftCard>

          {planNotice ? <InfoBanner tone="amber">{planNotice}</InfoBanner> : null}

          {coverage ? (
            <>
              {coverage.mainSection === 'make_your_own' ? (
                <SoftCard className="space-y-3">
                  <SectionTitle title="Build your cover" description="Select at least one of Injury, Illness or Surgery." />
                  <div className="space-y-2">
                    {product.sections.make_your_own.covers.map((c) => {
                      const on = (coverage.myoCovers || []).includes(c.key);
                      return (
                        <SelectableCard key={c.key} selected={on} onClick={() => toggleMyo(c.key)} className="!p-3">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-semibold text-sm">{c.label}</span>
                            <span
                              className={`h-5 w-5 rounded-full border flex items-center justify-center ${
                                on ? 'bg-[#FF8C42] border-[#FF8C42] text-white' : 'border-[#D1D5DB]'
                              }`}
                            >
                              {on ? <Check className="w-3 h-3" /> : null}
                            </span>
                          </div>
                        </SelectableCard>
                      );
                    })}
                  </div>
                </SoftCard>
              ) : null}

              <SoftCard className="space-y-3">
                <SectionTitle
                  title="Sum insured"
                  description="Choose the maximum coverage amount available under your selected policy. This is not a guaranteed payout for every claim."
                />
                <p className="text-2xl font-bold text-[#FF8C42]">{formatInr(coverage.sumInsured)}</p>
                <div className="flex flex-wrap gap-2">
                  {(coverage.mainSection === 'third_party'
                    ? product.sections.third_party.sumInsured
                    : coverage.mainSection === 'make_your_own'
                      ? product.sections.make_your_own.sumInsured
                      : product.sections.comprehensive.sumInsured
                  ).map((n) => (
                    <SelectChip
                      key={n}
                      label={formatInr(n)}
                      selected={coverage.sumInsured === n}
                      onClick={() => setCoverage((c) => (c ? { ...c, sumInsured: n } : c))}
                    />
                  ))}
                </div>
              </SoftCard>

              {coverage.mainSection === 'comprehensive' ? (
                <SoftCard className="space-y-3">
                  <SectionTitle
                    title="Co-pay"
                    description="Co-pay is the percentage of an admissible claim that you pay yourself."
                  />
                  <div className="flex flex-wrap gap-2">
                    {product.sections.comprehensive.copay.map((n) => (
                      <SelectChip
                        key={n}
                        label={`${n}%`}
                        selected={coverage.copayPercent === n}
                        onClick={() => setCoverage((c) => (c ? { ...c, copayPercent: n } : c))}
                      />
                    ))}
                  </div>
                </SoftCard>
              ) : (
                <InfoBanner tone="navy" title="Nil co-pay">
                  {coverage.mainSection === 'make_your_own'
                    ? 'Make Your Own Plan includes nil co-pay per the product leaflet.'
                    : 'Third-Party Liability includes nil co-pay per the product leaflet.'}
                </InfoBanner>
              )}

              {coverage.mainSection !== 'third_party' ? (
                <SoftCard className="space-y-3">
                  <SectionTitle
                    title="Add extra protection"
                    description="Optional covers available with Comprehensive or Make Your Own configurations."
                  />
                  {product.addons.map((addon) => {
                    const on = coverage.addons.includes(addon.key);
                    return (
                      <div
                        key={addon.key}
                        className={`rounded-xl border p-3 space-y-2 ${
                          on ? 'border-[#FF8C42] bg-[#FFF4EC]' : 'border-[#E8DED3] bg-white'
                        }`}
                      >
                        <button type="button" className="w-full text-left" onClick={() => toggleAddon(addon.key)}>
                          <div className="flex items-start gap-3">
                            <div className="h-9 w-9 rounded-xl bg-white border border-[#F0E6DB] flex items-center justify-center shrink-0">
                              <Stethoscope className="w-4 h-4 text-[#FF8C42]" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center justify-between gap-2">
                                <p className="font-semibold text-sm">{addon.label}</p>
                                <span
                                  className={`h-5 w-5 rounded-full border flex items-center justify-center ${
                                    on ? 'bg-[#FF8C42] border-[#FF8C42] text-white' : 'border-[#D1D5DB]'
                                  }`}
                                >
                                  {on ? <Check className="w-3 h-3" /> : null}
                                </span>
                              </div>
                              <p className="text-xs text-[#6B7280] mt-1 leading-relaxed">{addon.description}</p>
                            </div>
                          </div>
                        </button>
                        {addon.key === 'trip_cancellation' && on ? (
                          <div className="pl-12 space-y-2">
                            <p className="text-xs font-semibold text-[#6B7280]">Trip cancellation sum insured</p>
                            <div className="flex flex-wrap gap-2">
                              {addon.sumInsuredOptions?.map((n) => (
                                <SelectChip
                                  key={n}
                                  label={formatInr(n)}
                                  selected={coverage.tripCancellationSumInsured === n}
                                  onClick={() =>
                                    setCoverage((c) => (c ? { ...c, tripCancellationSumInsured: n } : c))
                                  }
                                />
                              ))}
                            </div>
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </SoftCard>
              ) : (
                <InfoBanner tone="amber" title="Optional covers unavailable">
                  Optional covers cannot be combined with Third-Party Liability alone.
                </InfoBanner>
              )}

              {coverage.mainSection !== 'third_party' ? (
                <InfoBanner tone="peach" title="Waiting period">
                  A 30-day waiting period applies to Comprehensive Cover and Make Your Own Plan. Please review the
                  policy wording for applicable exclusions and conditions.
                </InfoBanner>
              ) : null}
            </>
          ) : (
            <InfoBanner tone="navy">Select a plan above to configure sum insured and optional covers.</InfoBanner>
          )}
        </>
      ) : null}

      {step === 3 || step === 4 ? (
        <>
          <SoftCard className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <p className="font-bold">Pet details</p>
              <button type="button" className="text-sm font-semibold text-[#FF8C42]" onClick={() => setStep(1)}>
                Edit
              </button>
            </div>
            <p className="text-sm text-[#6B7280]">
              {petDisplayName}
              {selectedPet?.species || selectedPet?.type || petDraft.species
                ? ` · ${selectedPet?.species || selectedPet?.type || petDraft.species}`
                : ''}
              {selectedPet?.breed || petDraft.breed ? ` · ${selectedPet?.breed || petDraft.breed}` : ''}
              {ageInfo.label ? ` · Age ${ageInfo.label}` : ''}
            </p>
          </SoftCard>

          <SoftCard className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <p className="font-bold">Owner details</p>
              <button type="button" className="text-sm font-semibold text-[#FF8C42]" onClick={() => setStep(1)}>
                Edit
              </button>
            </div>
            <p className="text-sm text-[#6B7280]">
              {[owner.firstName, owner.lastName].filter(Boolean).join(' ') || '—'}
            </p>
            <p className="text-sm text-[#6B7280]">{owner.email || 'No email on file'}</p>
            <p className="text-sm text-[#6B7280]">{owner.phone || '—'}</p>
          </SoftCard>

          <SoftCard className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <p className="font-bold">Selected coverage</p>
              <button type="button" className="text-sm font-semibold text-[#FF8C42]" onClick={() => setStep(2)}>
                Edit
              </button>
            </div>
            <p className="text-sm font-semibold text-[#1F2A37]">{planTitle}</p>
            {coverage ? (
              <>
                <p className="text-sm text-[#6B7280]">Sum insured: {formatInr(coverage.sumInsured)}</p>
                <p className="text-sm text-[#6B7280]">
                  Co-pay: {coverage.copayPercent == null ? 'Nil' : `${coverage.copayPercent}%`}
                </p>
                {coverage.mainSection === 'make_your_own' ? (
                  <p className="text-sm text-[#6B7280]">
                    Covers:{' '}
                    {(coverage.myoCovers || []).map((c) => c.replace(/_/g, ' ')).join(', ') || 'None'}
                  </p>
                ) : null}
                <p className="text-sm text-[#6B7280]">
                  Optional covers:{' '}
                  {coverage.addons.length
                    ? coverage.addons.map((a) => a.replace(/_/g, ' ')).join(', ')
                    : 'None'}
                </p>
              </>
            ) : null}
          </SoftCard>

          <InfoBanner tone="navy" title="Your quotation is being confirmed by HDFC ERGO">
            Warmpawz does not independently calculate HDFC ERGO premiums. After you submit your application, an
            authorised advisor will obtain the official quotation and share it with you. Payment is not collected at
            this stage.
            <p className="mt-2 text-[11px] opacity-80">{product.demoDisclaimer}</p>
          </InfoBanner>

          <label className="flex items-start gap-3 text-sm text-[#1F2A37] bg-white border border-[#F0E6DB] rounded-2xl p-3">
            <input
              type="checkbox"
              className="mt-1 accent-[#FF8C42]"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
            />
            <span>
              I agree to the Terms &amp; Conditions and Product Policy for HDFC ERGO Paws N Claws. (Product leaflet
              terms apply; policy documents will be shared with any official quotation.)
            </span>
          </label>
        </>
      ) : null}

      {step === 5 && result ? (
        <div className="space-y-4 pt-2">
          <div className="text-center space-y-3">
            <div className="mx-auto w-16 h-16 rounded-full bg-[#ECF8F1] text-[#1B5E3B] flex items-center justify-center">
              <Check className="w-8 h-8" />
            </div>
            <h2 className="text-2xl font-bold">Your application has been submitted!</h2>
            <p className="text-sm text-[#6B7280] leading-relaxed">
              An authorised insurance advisor will review your details and obtain the official HDFC ERGO quotation.
            </p>
          </div>

          <SoftCard className="space-y-2 text-left">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm text-[#6B7280]">Application reference</p>
              <button
                type="button"
                className="inline-flex items-center gap-1 text-sm font-semibold"
                onClick={() => navigator.clipboard?.writeText(result.reference)}
              >
                {result.reference} <Copy className="w-3.5 h-3.5" />
              </button>
            </div>
            <p className="text-sm text-[#6B7280]">
              Pet: <span className="font-semibold text-[#1F2A37]">{petDisplayName}</span>
            </p>
            <p className="text-sm text-[#6B7280]">
              Plan: <span className="font-semibold text-[#1F2A37]">{planTitle}</span>
            </p>
            <p className="text-sm">
              Status:{' '}
              <span className="inline-flex rounded-full bg-[#FFF4EC] text-[#FF8C42] px-2 py-0.5 text-xs font-bold">
                Application received
              </span>
            </p>
          </SoftCard>

          <SoftCard className="space-y-3">
            <p className="font-bold">What happens next</p>
            {[
              'Application received',
              'Advisor reviews the application',
              'Official insurer quotation is shared',
              'You review the quotation and decide whether to proceed',
            ].map((label, idx) => (
              <div key={label} className="flex items-start gap-3">
                <div className="h-7 w-7 rounded-full bg-[#FFF4EC] text-[#FF8C42] text-xs font-bold flex items-center justify-center shrink-0">
                  {idx + 1}
                </div>
                <p className="text-sm pt-1">{label}</p>
              </div>
            ))}
          </SoftCard>

          <PrimaryButton onClick={onGoMyInsurance}>View / track application</PrimaryButton>
          <SecondaryButton onClick={onTalkToExpert} className="inline-flex items-center justify-center gap-2">
            <Headphones className="w-4 h-4" />
            Talk to an insurance expert
          </SecondaryButton>
          <SecondaryButton onClick={onBack} className="inline-flex items-center justify-center gap-2">
            <Home className="w-4 h-4" />
            Return to Home
          </SecondaryButton>
        </div>
      ) : null}
    </JourneyShell>
  );
}

/** Entry gate: auth check then open journey step 1. */
export function beginInsuranceQuoteOrAuth(onAuthenticated: () => void): void {
  if (!hasAuthenticatedCustomerSession()) {
    requestGuestAuth({
      mode: 'signup',
      returnPath: '/',
      resumeScreen: 'insurance_quote',
    });
    return;
  }
  onAuthenticated();
}
