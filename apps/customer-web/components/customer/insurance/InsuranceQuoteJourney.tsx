'use client';

import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Check, Copy, Headphones, Shield } from 'lucide-react';
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

type Step = 1 | 2 | 3 | 4 | 5;

type PetRow = {
  id: string;
  name?: string;
  species?: string;
  breed?: string;
  date_of_birth?: string;
  dob?: string;
  weight?: number | string;
  photo_url?: string;
};

type OwnerForm = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
};

type Props = {
  phone: string;
  initialStep?: Step;
  onBack: () => void;
  onTalkToExpert: () => void;
  onGoMyInsurance: () => void;
};

const STEP_LABELS = ['Pet Details', 'Choose Plan', 'Checkout'] as const;

function formatInr(n: number): string {
  return `₹${n.toLocaleString('en-IN')}`;
}

function readOwnerFromStorage(): OwnerForm {
  if (typeof window === 'undefined') {
    return { firstName: '', lastName: '', email: '', phone: '' };
  }
  try {
    const data = JSON.parse(localStorage.getItem('customerData') || '{}') as Record<string, unknown>;
    const full = String(data.fullName || data.full_name || data.name || '');
    const parts = full.trim().split(/\s+/);
    return {
      firstName: String(data.firstName || data.first_name || parts[0] || ''),
      lastName: String(data.lastName || data.last_name || parts.slice(1).join(' ') || ''),
      email: String(data.email || ''),
      phone: String(data.phone || data.mobile || localStorage.getItem('customerPhone') || ''),
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

function Stepper({ active }: { active: 1 | 2 | 3 }) {
  return (
    <div className="flex items-center gap-2 text-xs font-semibold">
      {STEP_LABELS.map((label, idx) => {
        const n = (idx + 1) as 1 | 2 | 3;
        const done = active > n;
        const current = active === n;
        return (
          <div key={label} className="flex items-center gap-2 flex-1 min-w-0">
            <div
              className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] ${
                done || current ? 'bg-[#FF8C42] text-white' : 'bg-gray-200 text-gray-500'
              }`}
            >
              {done ? <Check className="w-3.5 h-3.5" /> : n}
            </div>
            <span className={`truncate ${current ? 'text-[#FF8C42]' : 'text-gray-500'}`}>{label}</span>
          </div>
        );
      })}
    </div>
  );
}

function Pill({
  selected,
  label,
  onClick,
}: {
  selected: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-2 rounded-full text-sm font-semibold border ${
        selected ? 'bg-[#FF8C42] text-white border-[#FF8C42]' : 'bg-white text-gray-700 border-gray-200'
      }`}
    >
      {label}
    </button>
  );
}

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
  const [petDraft, setPetDraft] = useState({ name: '', species: 'Dog', breed: '', dob: '', weight: '' });
  const [health, setHealth] = useState<HealthDeclarations>({
    priorIllnessOrInjury: 'No',
    priorVetDiagnosis: 'No',
    ongoingMedicationOrTreatment: 'No',
    otherMedicalDisclosure: '',
  });
  const [coverage, setCoverage] = useState<CoverageSelection>({
    mainSection: 'comprehensive',
    myoCovers: [],
    sumInsured: 100_000,
    copayPercent: 10,
    addons: [],
    tripCancellationSumInsured: null,
  });
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
        const phoneDigits = (phone || owner.phone || '').replace(/\D/g, '');
        let list: PetRow[] = [];
        if (phoneDigits.length >= 10) {
          const res = (await apiClient.get(`/customer/pets/${phoneDigits}`)) as {
            pets?: PetRow[];
            data?: { pets?: PetRow[] };
          };
          list = res.pets || res.data?.pets || [];
        }
        if (!list.length && customerId) {
          const res = (await apiClient.get(`/customer/pets?customerId=${customerId}`).catch(() => null)) as {
            pets?: PetRow[];
            data?: { pets?: PetRow[] };
          } | null;
          list = res?.pets || res?.data?.pets || [];
        }
        setPets(Array.isArray(list) ? list : []);
        if (list[0]?.id) setPetId(String(list[0].id));
      } catch {
        setPets([]);
      } finally {
        setLoadingPets(false);
      }
    };
    void load();
  }, [phone, owner.phone]);

  const coverageIssues = useMemo(() => validatePawsCoverageSelection(coverage), [coverage]);
  const selectedPet = pets.find((p) => String(p.id) === petId);

  const ensureAuth = (): boolean => {
    if (hasAuthenticatedCustomerSession()) return true;
    requestGuestAuth({
      mode: 'signup',
      returnPath: '/',
      resumeScreen: 'insurance_quote',
    });
    return false;
  };

  const startQuote = () => {
    if (!ensureAuth()) return;
    setStep(1);
  };

  useEffect(() => {
    if (initialStep === 1 && hasAuthenticatedCustomerSession()) {
      // already authenticated path
    }
  }, [initialStep]);

  const toggleAddon = (key: PawsAddon) => {
    setCoverage((prev) => {
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
      const has = (prev.myoCovers || []).includes(key);
      const myoCovers = has
        ? (prev.myoCovers || []).filter((c) => c !== key)
        : [...(prev.myoCovers || []), key];
      return { ...prev, myoCovers };
    });
  };

  const setMain = (mainSection: PawsMainSection) => {
    if (mainSection === 'comprehensive') {
      setCoverage({
        mainSection,
        myoCovers: [],
        sumInsured: 100_000,
        copayPercent: 10,
        addons: [],
        tripCancellationSumInsured: null,
      });
    } else if (mainSection === 'make_your_own') {
      setCoverage({
        mainSection,
        myoCovers: ['injury'],
        sumInsured: 100_000,
        copayPercent: null,
        addons: [],
        tripCancellationSumInsured: null,
      });
    } else {
      setCoverage({
        mainSection,
        myoCovers: [],
        sumInsured: 100_000,
        copayPercent: null,
        addons: [],
        tripCancellationSumInsured: null,
      });
    }
  };

  const continueFromDetails = () => {
    if (!ensureAuth()) return;
    if (!owner.firstName.trim() || !owner.phone.trim()) {
      setError('Owner name and mobile number are required');
      return;
    }
    if (!petId && !petDraft.name.trim()) {
      setError('Select a pet or enter pet details');
      return;
    }
    setError('');
    setStep(2);
  };

  const continueFromPlan = () => {
    if (!isPawsCoverageSelectionValid(coverage)) {
      setError(coverageIssues[0]?.message || 'Fix coverage selection');
      return;
    }
    setError('');
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
    setSubmitting(true);
    setError('');
    try {
      const customerId = await resolveCustomerId();
      let resolvedPetId = petId;
      if (!resolvedPetId) {
        const phoneDigits = (owner.phone || phone).replace(/\D/g, '');
        const created = (await apiClient.post('/customer/pets', {
          phone: phoneDigits,
          customerId,
          name: petDraft.name,
          species: petDraft.species,
          breed: petDraft.breed,
          dateOfBirth: petDraft.dob || undefined,
          weight: petDraft.weight ? Number(petDraft.weight) : undefined,
        })) as { pet?: { id?: string }; data?: { pet?: { id?: string }; id?: string }; id?: string };
        resolvedPetId = String(
          created.pet?.id || created.data?.pet?.id || created.data?.id || created.id || '',
        );
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

  if (step === 0 as unknown as Step) {
    startQuote();
  }

  return (
    <div className="min-h-[100dvh] bg-white max-w-lg mx-auto">
      <div className="sticky top-0 z-10 bg-white border-b border-gray-100 px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3">
        <div className="flex items-center gap-2 mb-3">
          <button
            type="button"
            onClick={() => {
              if (step === 5) onBack();
              else if (step === 1) onBack();
              else setStep((s) => (s > 1 ? ((s - 1) as Step) : s));
            }}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center"
            aria-label="Back"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <p className="text-sm font-bold text-gray-900">HDFC ERGO Paws N Claws</p>
            <p className="text-xs text-gray-500">Free quote request · insurer confirms premium</p>
          </div>
        </div>
        {step < 5 ? <Stepper active={stepperActive} /> : null}
      </div>

      <div className="px-4 pb-32 pt-4 space-y-4">
        {error ? <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2">{error}</p> : null}

        {step === 1 ? (
          <>
            <section className="rounded-2xl border border-gray-100 p-4 space-y-3">
              <h2 className="font-bold text-gray-900">Pet details</h2>
              {loadingPets ? <p className="text-sm text-gray-500">Loading pets…</p> : null}
              {pets.length > 0 ? (
                <div className="space-y-2">
                  {pets.map((pet) => (
                    <button
                      key={pet.id}
                      type="button"
                      onClick={() => setPetId(String(pet.id))}
                      className={`w-full text-left rounded-xl border px-3 py-3 ${
                        petId === String(pet.id) ? 'border-[#FF8C42] bg-orange-50' : 'border-gray-200'
                      }`}
                    >
                      <p className="font-semibold text-gray-900">{pet.name || 'Pet'}</p>
                      <p className="text-xs text-gray-500">
                        {[pet.species, pet.breed].filter(Boolean).join(' · ') || 'Details on file'}
                      </p>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="space-y-2">
                  <input
                    className="w-full h-11 rounded-xl border border-gray-200 px-3"
                    placeholder="Pet name"
                    value={petDraft.name}
                    onChange={(e) => setPetDraft((p) => ({ ...p, name: e.target.value }))}
                  />
                  <div className="flex gap-2">
                    {['Dog', 'Cat'].map((sp) => (
                      <Pill
                        key={sp}
                        label={sp}
                        selected={petDraft.species === sp}
                        onClick={() => setPetDraft((p) => ({ ...p, species: sp }))}
                      />
                    ))}
                  </div>
                  <input
                    className="w-full h-11 rounded-xl border border-gray-200 px-3"
                    placeholder="Breed"
                    value={petDraft.breed}
                    onChange={(e) => setPetDraft((p) => ({ ...p, breed: e.target.value }))}
                  />
                  <input
                    type="date"
                    className="w-full h-11 rounded-xl border border-gray-200 px-3"
                    value={petDraft.dob}
                    onChange={(e) => setPetDraft((p) => ({ ...p, dob: e.target.value }))}
                  />
                  <input
                    className="w-full h-11 rounded-xl border border-gray-200 px-3"
                    placeholder="Weight (kg)"
                    value={petDraft.weight}
                    onChange={(e) => setPetDraft((p) => ({ ...p, weight: e.target.value }))}
                  />
                </div>
              )}
            </section>

            <section className="rounded-2xl border border-gray-100 p-4 space-y-3">
              <h2 className="font-bold text-gray-900">Pet owner details</h2>
              <div className="grid grid-cols-2 gap-2">
                <input
                  className="h-11 rounded-xl border border-gray-200 px-3"
                  placeholder="First name"
                  value={owner.firstName}
                  onChange={(e) => setOwner((o) => ({ ...o, firstName: e.target.value }))}
                />
                <input
                  className="h-11 rounded-xl border border-gray-200 px-3"
                  placeholder="Last name"
                  value={owner.lastName}
                  onChange={(e) => setOwner((o) => ({ ...o, lastName: e.target.value }))}
                />
              </div>
              <input
                className="w-full h-11 rounded-xl border border-gray-200 px-3"
                placeholder="Email"
                value={owner.email}
                onChange={(e) => setOwner((o) => ({ ...o, email: e.target.value }))}
              />
              <input
                className="w-full h-11 rounded-xl border border-gray-200 px-3"
                placeholder="Mobile"
                value={owner.phone}
                onChange={(e) => setOwner((o) => ({ ...o, phone: e.target.value }))}
              />
            </section>

            <section className="rounded-2xl border border-gray-100 p-4 space-y-3">
              <h2 className="font-bold text-gray-900">Health declarations</h2>
              {HEALTH_DECLARATION_FIELDS.map((field) => (
                <div key={field.key} className="space-y-1">
                  <p className="text-sm text-gray-800">{field.label}</p>
                  {field.type === 'yes_no' ? (
                    <div className="flex gap-2">
                      {(['Yes', 'No'] as const).map((opt) => (
                        <Pill
                          key={opt}
                          label={opt}
                          selected={(health as Record<string, string>)[field.key] === opt}
                          onClick={() => setHealth((h) => ({ ...h, [field.key]: opt }))}
                        />
                      ))}
                    </div>
                  ) : (
                    <textarea
                      className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
                      rows={2}
                      value={health.otherMedicalDisclosure || ''}
                      onChange={(e) => setHealth((h) => ({ ...h, otherMedicalDisclosure: e.target.value }))}
                    />
                  )}
                </div>
              ))}
            </section>
          </>
        ) : null}

        {step === 2 ? (
          <>
            <section className="space-y-3">
              <h2 className="font-bold text-gray-900">Select plan</h2>
              {(
                [
                  ['comprehensive', product.sections.comprehensive],
                  ['make_your_own', product.sections.make_your_own],
                  ['third_party', product.sections.third_party],
                ] as const
              ).map(([key, section]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setMain(key)}
                  className={`w-full text-left rounded-2xl border p-4 ${
                    coverage.mainSection === key ? 'border-[#FF8C42] bg-orange-50' : 'border-gray-200'
                  }`}
                >
                  <p className="font-bold text-gray-900">{section.title}</p>
                  <p className="text-sm text-gray-600 mt-1">{section.subtitle}</p>
                </button>
              ))}
            </section>

            {coverage.mainSection === 'make_your_own' ? (
              <section className="rounded-2xl border border-gray-100 p-4 space-y-2">
                <h3 className="font-semibold text-gray-900">Choose covers</h3>
                {product.sections.make_your_own.covers.map((c) => (
                  <label key={c.key} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={(coverage.myoCovers || []).includes(c.key)}
                      onChange={() => toggleMyo(c.key)}
                    />
                    {c.label}
                  </label>
                ))}
              </section>
            ) : null}

            <section className="rounded-2xl border border-gray-100 p-4 space-y-3">
              <h3 className="font-semibold text-gray-900">Sum insured</h3>
              <div className="flex flex-wrap gap-2">
                {(coverage.mainSection === 'third_party'
                  ? product.sections.third_party.sumInsured
                  : coverage.mainSection === 'make_your_own'
                    ? product.sections.make_your_own.sumInsured
                    : product.sections.comprehensive.sumInsured
                ).map((n) => (
                  <Pill
                    key={n}
                    label={formatInr(n)}
                    selected={coverage.sumInsured === n}
                    onClick={() => setCoverage((c) => ({ ...c, sumInsured: n }))}
                  />
                ))}
              </div>
            </section>

            {coverage.mainSection === 'comprehensive' ? (
              <section className="rounded-2xl border border-gray-100 p-4 space-y-3">
                <h3 className="font-semibold text-gray-900">Co-pay</h3>
                <div className="flex flex-wrap gap-2">
                  {product.sections.comprehensive.copay.map((n) => (
                    <Pill
                      key={n}
                      label={`${n}%`}
                      selected={coverage.copayPercent === n}
                      onClick={() => setCoverage((c) => ({ ...c, copayPercent: n }))}
                    />
                  ))}
                </div>
              </section>
            ) : (
              <p className="text-xs text-gray-500">Nil co-pay for this section (per leaflet).</p>
            )}

            {coverage.mainSection !== 'third_party' ? (
              <section className="rounded-2xl border border-gray-100 p-4 space-y-3">
                <h3 className="font-semibold text-gray-900">Optional covers</h3>
                {product.addons.map((addon) => (
                  <div key={addon.key} className="space-y-2">
                    <label className="flex items-start gap-2 text-sm">
                      <input
                        type="checkbox"
                        className="mt-1"
                        checked={coverage.addons.includes(addon.key)}
                        onChange={() => toggleAddon(addon.key)}
                      />
                      <span>
                        <span className="font-semibold text-gray-900">{addon.label}</span>
                        <span className="block text-gray-600">{addon.description}</span>
                      </span>
                    </label>
                    {addon.key === 'trip_cancellation' && coverage.addons.includes('trip_cancellation') ? (
                      <div className="flex flex-wrap gap-2 pl-6">
                        {addon.sumInsuredOptions?.map((n) => (
                          <Pill
                            key={n}
                            label={formatInr(n)}
                            selected={coverage.tripCancellationSumInsured === n}
                            onClick={() =>
                              setCoverage((c) => ({ ...c, tripCancellationSumInsured: n }))
                            }
                          />
                        ))}
                      </div>
                    ) : null}
                  </div>
                ))}
              </section>
            ) : (
              <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2">
                Optional covers cannot be combined with Third-Party Liability alone.
              </p>
            )}

            <p className="text-xs text-gray-500">
              30-day waiting period applies to Comprehensive and Make Your Own Plan. See exclusions in the product leaflet.
            </p>
          </>
        ) : null}

        {step === 3 || step === 4 ? (
          <>
            <section className="rounded-2xl border border-gray-100 p-4 space-y-2">
              <div className="flex items-center gap-2 text-[#FF8C42] font-semibold text-sm">
                <Shield className="w-4 h-4" />
                HDFC ERGO · Paws N Claws
              </div>
              <p className="font-bold text-gray-900">
                {product.sections[coverage.mainSection].title}
              </p>
              <p className="text-sm text-gray-600">
                Pet:{' '}
                {selectedPet?.name || petDraft.name || 'Selected pet'}
                {selectedPet?.breed || petDraft.breed
                  ? ` · ${selectedPet?.breed || petDraft.breed}`
                  : ''}
              </p>
              <p className="text-sm text-gray-600">Sum insured: {formatInr(coverage.sumInsured)}</p>
              <p className="text-sm text-gray-600">
                Co-pay:{' '}
                {coverage.copayPercent == null ? 'Nil' : `${coverage.copayPercent}%`}
              </p>
              <p className="text-sm text-gray-600">
                Add-ons:{' '}
                {coverage.addons.length
                  ? coverage.addons.map((a) => a.replace(/_/g, ' ')).join(', ')
                  : 'None'}
              </p>
            </section>

            <section className="rounded-2xl border border-dashed border-orange-200 bg-orange-50/50 p-4 space-y-2">
              <p className="font-bold text-gray-900">Awaiting insurer quotation</p>
              <p className="text-sm text-gray-700">
                Warmpawz does not calculate HDFC ERGO premiums. After you submit, an authorised advisor will obtain the official quote and share it with you. Payment is not collected until then.
              </p>
              <p className="text-xs text-gray-500">{product.demoDisclaimer}</p>
            </section>

            <label className="flex items-start gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                className="mt-1"
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
              />
              I agree to the Terms & Conditions and Product Policy.
            </label>
          </>
        ) : null}

        {step === 5 && result ? (
          <section className="text-center space-y-4 pt-6">
            <div className="mx-auto w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center">
              <Check className="w-8 h-8" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900">Application Submitted!</h2>
            <p className="text-sm text-gray-600">
              Your pet insurance application for HDFC ERGO Paws N Claws has been successfully submitted.
            </p>
            <div className="rounded-2xl border border-gray-100 text-left p-4 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm text-gray-600">Application ID</p>
                <button
                  type="button"
                  className="inline-flex items-center gap-1 text-sm font-semibold"
                  onClick={() => navigator.clipboard?.writeText(result.reference)}
                >
                  {result.reference} <Copy className="w-3.5 h-3.5" />
                </button>
              </div>
              <p className="text-sm text-gray-600">
                Provider: <span className="font-semibold text-gray-900">HDFC ERGO</span>
              </p>
              <p className="text-sm">
                Status:{' '}
                <span className="inline-flex rounded-full bg-orange-100 text-[#FF8C42] px-2 py-0.5 text-xs font-bold">
                  Under Review
                </span>
              </p>
            </div>
            <p className="text-xs text-gray-500">
              You will receive the policy on approval. Track status in My Insurance. Active policy appears only after verified insurer issuance.
            </p>
            <button
              type="button"
              onClick={onGoMyInsurance}
              className="w-full h-12 rounded-2xl bg-[#FF8C42] text-white font-bold"
            >
              Go to My Insurance →
            </button>
            <button
              type="button"
              onClick={onTalkToExpert}
              className="w-full h-12 rounded-2xl border border-gray-200 font-semibold inline-flex items-center justify-center gap-2"
            >
              <Headphones className="w-4 h-4" />
              Talk to an Insurance Expert
            </button>
          </section>
        ) : null}
      </div>

      {step < 5 ? (
        <div className="fixed bottom-0 inset-x-0 bg-white border-t border-gray-100 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <div className="max-w-lg mx-auto">
            {step === 1 ? (
              <button
                type="button"
                onClick={continueFromDetails}
                className="w-full h-12 rounded-2xl bg-[#FF8C42] text-white font-bold"
              >
                Continue →
              </button>
            ) : null}
            {step === 2 ? (
              <button
                type="button"
                onClick={continueFromPlan}
                className="w-full h-12 rounded-2xl bg-[#FF8C42] text-white font-bold"
              >
                Review & Checkout →
              </button>
            ) : null}
            {step === 3 || step === 4 ? (
              <button
                type="button"
                disabled={submitting}
                onClick={() => void submitEnquiry()}
                className="w-full h-12 rounded-2xl bg-[#FF8C42] text-white font-bold disabled:opacity-60"
              >
                {submitting ? 'Submitting…' : 'Submit application'}
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
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
