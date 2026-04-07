'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Camera, ChevronDown } from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { DOG_BREEDS, CAT_BREEDS } from '@/lib/breed-data';
import { goBackOrHome } from '@/lib/go-back-or-replace';
import { addPetErrorMessage, resolveCustomerIdForPetMutation } from '@/lib/pet-create-helpers';
import { toast } from 'sonner';
import {
  emptyPetHealthRecords,
  emptyPetVaccinations,
  PetHealthVaccinationFormBody,
  type PetHealthRecordsForm,
  type PetVaccinationsForm,
} from '@/components/customer/PetHealthVaccinationFormBody';

type PetKind = 'Dog' | 'Cat' | 'Other';

export default function AddPetClient() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [petType, setPetType] = useState<PetKind>('Dog');
  const [breed, setBreed] = useState('');
  const [breedSearchQuery, setBreedSearchQuery] = useState('');
  const [breedDropdownOpen, setBreedDropdownOpen] = useState(false);
  const breedInputRef = useRef<HTMLInputElement>(null);
  const breedDropdownRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [age, setAge] = useState('');
  const [gender, setGender] = useState<'male' | 'female' | ''>('');
  const [weight, setWeight] = useState('');
  const [microchipId, setMicrochipId] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [photoPreview, setPhotoPreview] = useState('');
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [step, setStep] = useState(1);
  const [healthRecords, setHealthRecords] = useState<PetHealthRecordsForm>(() => emptyPetHealthRecords());
  const [vaccinations, setVaccinations] = useState<PetVaccinationsForm>(() => emptyPetVaccinations());

  const phone =
    typeof window !== 'undefined'
      ? (
          localStorage.getItem('customerPhone') ||
          localStorage.getItem('customer_phone') ||
          localStorage.getItem('phone')
        )
          ?.trim() || ''
      : '';

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const p =
      localStorage.getItem('customerPhone')?.trim() ||
      localStorage.getItem('customer_phone')?.trim() ||
      localStorage.getItem('phone')?.trim() ||
      '';
    let hasToken = !!(localStorage.getItem('authToken') || localStorage.getItem('cognitoAccessToken'));
    if (!hasToken) {
      try {
        const raw = localStorage.getItem('customerCognitoTokens');
        if (raw) {
          const parsed = JSON.parse(raw) as { idToken?: string };
          hasToken = !!parsed?.idToken;
        }
      } catch {
        /* ignore */
      }
    }
    if (!p || !hasToken) {
      router.replace('/auth');
    }
  }, [router]);

  const getFilteredBreeds = useCallback((): string[] => {
    const breedList =
      petType === 'Dog' ? DOG_BREEDS : petType === 'Cat' ? CAT_BREEDS : [...DOG_BREEDS, ...CAT_BREEDS];
    if (!breedSearchQuery) return breedList;
    const q = breedSearchQuery.toLowerCase();
    return breedList.filter((b) => b.toLowerCase().includes(q));
  }, [petType, breedSearchQuery]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        breedDropdownRef.current &&
        !breedDropdownRef.current.contains(event.target as Node) &&
        breedInputRef.current &&
        !breedInputRef.current.contains(event.target as Node)
      ) {
        setBreedDropdownOpen(false);
        setBreedSearchQuery('');
      }
    };
    if (breedDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [breedDropdownOpen]);

  useEffect(() => {
    setBreedSearchQuery('');
    setBreedDropdownOpen(false);
  }, [petType]);

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!phone) {
      toast.error('Sign in to upload a photo');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image size should be less than 5MB');
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => setPhotoPreview(reader.result as string);
    reader.readAsDataURL(file);

    setUploadingPhoto(true);
    setUploadProgress(0);
    try {
      const { uploadPetPhotoWithProgress } = await import('@/lib/photo-upload-enhanced');
      const tempId = `pet_${Date.now()}`;
      const result = await uploadPetPhotoWithProgress(file, tempId, phone, {
        onProgress: setUploadProgress,
        verifyUpload: true,
        maxRetries: 3,
      });
      if (result.success && result.publicUrl) {
        setPhotoUrl(result.publicUrl);
        toast.success('Photo uploaded');
      } else {
        toast.error(result.error || 'Upload failed');
        setPhotoPreview(photoUrl || '');
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Upload failed');
      setPhotoPreview(photoUrl || '');
    } finally {
      setUploadingPhoto(false);
      setUploadProgress(0);
    }
  };

  const validateBasicFields = (): boolean => {
    const nameTrim = name.trim();
    if (!nameTrim) {
      toast.error('Please enter a pet name');
      return false;
    }
    if (petType === 'Other') {
      toast.error('Please choose Dog or Cat — the platform supports dogs and cats only.');
      return false;
    }
    const breedTrim = breed.trim();
    if (!breedTrim) {
      toast.error('Please enter a breed');
      return false;
    }
    const ageNum = parseInt(age, 10);
    if (age === '' || Number.isNaN(ageNum) || ageNum < 0) {
      toast.error('Please enter a valid age in years');
      return false;
    }
    return true;
  };

  /** Shapes merged into DB medical_history; top-level allergies/vaccinations/chronicConditions must be set separately because POST /pets overwrites those keys after spreading medicalHistory. */
  const buildMedicalHistoryPayload = (): Record<string, unknown> => {
    const hr = healthRecords;
    const vac = vaccinations;
    return {
      lastCheckup: hr.lastCheckup || undefined,
      medications: hr.medications || undefined,
      conditions: hr.conditions || undefined,
      vaccinationRecords: {
        rabies: vac.rabies || '',
        distemper: vac.distemper || '',
        parvovirus: vac.parvovirus || '',
        other: vac.other || '',
      },
    };
  };

  const handleContinueToHealth = () => {
    if (!validateBasicFields()) return;
    setStep(2);
  };

  const handleSubmit = async () => {
    if (!validateBasicFields()) return;

    setSubmitting(true);
    try {
      const customerId = await resolveCustomerIdForPetMutation();
      if (!customerId) {
        toast.error('Customer not found. Try signing out and back in.');
        return;
      }
      const nameTrim = name.trim();
      const breedTrim = breed.trim();
      const ageNum = parseInt(age, 10);

      const condTrim = healthRecords.conditions?.trim();
      const allergTrim = healthRecords.allergies?.trim();

      const payload: Record<string, unknown> = {
        customerId,
        name: nameTrim,
        petType,
        breed: breedTrim,
        age: ageNum,
        ageUnit: 'years',
        medicalHistory: buildMedicalHistoryPayload(),
        ...(allergTrim ? { allergies: allergTrim } : {}),
        ...(condTrim ? { chronicConditions: [condTrim] } : {}),
        vaccinations: {
          rabies: vaccinations.rabies || '',
          distemper: vaccinations.distemper || '',
          parvovirus: vaccinations.parvovirus || '',
          other: vaccinations.other || '',
        },
      };
      if (gender) payload.gender = gender;
      const w = parseFloat(weight);
      if (weight.trim() !== '' && !Number.isNaN(w)) payload.weight = w;
      const chip = microchipId.trim();
      if (chip) payload.microchipId = chip;
      if (photoUrl) payload.photo = photoUrl;

      await apiClient.post('/pets', payload);
      toast.success('Pet added');
      router.replace('/');
    } catch (err) {
      console.error('Error adding pet:', err);
      toast.error(addPetErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const inputClass =
    'w-full min-h-11 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-base text-gray-900 outline-none focus:border-[#FF8C42] sm:text-sm';

  return (
    <div className="flex min-h-dvh justify-center bg-zinc-200 supports-[height:100dvh]:min-h-[100dvh]">
      <div className="relative flex min-h-dvh w-full max-w-md flex-col overflow-x-hidden bg-gray-50 shadow-[0_0_0_1px_rgba(0,0,0,0.04)] md:my-3 md:h-[calc(100dvh-1.5rem)] md:min-h-0 md:max-h-[calc(100dvh-1.5rem)] md:rounded-3xl md:shadow-xl">
      <div className="sticky top-0 z-50 shrink-0 border-b border-gray-200 bg-white cw-header-safe-top">
        <div className="flex h-14 items-center px-4">
          <button
            type="button"
            onClick={() => (step === 1 ? goBackOrHome(router) : setStep(1))}
            className="flex h-10 w-10 shrink-0 touch-manipulation items-center justify-center text-xl text-gray-800 active:opacity-70"
            aria-label={step === 1 ? 'Go back' : 'Back to basic info'}
          >
            ←
          </button>
          <h1 className="ml-4 text-base font-semibold text-gray-900">
            {step === 1 ? 'Add Pet' : 'Health Records'}
          </h1>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-gray-50">
        {step === 1 ? (
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-4 py-4 pb-28 [-webkit-overflow-scrolling:touch]">
          <div className="mb-6 flex justify-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#FF8C42]/15">
              <span className="text-3xl" aria-hidden>
                🐾
              </span>
            </div>
          </div>
          <p className="mb-6 text-center text-sm font-medium text-gray-700">Basic Info 📝</p>

          <div className="mb-6 flex flex-col items-center">
            <button
              type="button"
              disabled={uploadingPhoto || !phone}
              onClick={() => !uploadingPhoto && fileInputRef.current?.click()}
              className={`relative mb-2 flex h-32 w-32 items-center justify-center overflow-hidden rounded-full border-4 border-white bg-orange-100 shadow-md ${
                uploadingPhoto ? 'cursor-not-allowed opacity-75' : 'cursor-pointer active:scale-[0.99]'
              }`}
            >
              {photoPreview && !uploadingPhoto ? (
                <img src={photoPreview} alt="" className="h-full w-full object-cover" />
              ) : uploadingPhoto ? (
                <div className="flex flex-col items-center gap-1 text-xs text-gray-700">
                  <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#FF8C42] border-t-transparent" />
                  <span>{uploadProgress}%</span>
                </div>
              ) : (
                <div className="flex flex-col items-center">
                  <Camera className="mb-1 h-10 w-10 text-[#FF8C42]" />
                  <span className="text-xs font-medium text-[#FF8C42]">Add Photo</span>
                </div>
              )}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handlePhotoUpload}
              disabled={uploadingPhoto}
            />
            <p className="text-center text-xs text-gray-500">Click to upload your pet&apos;s photo</p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Pet Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Oreo, Max, Bella"
                className={inputClass}
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Pet Type <span className="text-red-500">*</span>
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(['Dog', 'Cat', 'Other'] as const).map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setPetType(type)}
                    className={`min-h-12 touch-manipulation rounded-xl border-2 px-1.5 py-2.5 text-xs font-medium transition-colors active:scale-[0.98] min-[380px]:px-2 min-[380px]:text-sm ${
                      petType === type
                        ? 'border-[#FF8C42] bg-orange-50 text-[#FF8C42]'
                        : 'border-gray-200 bg-white text-gray-700'
                    }`}
                  >
                    <span className="mr-1">{type === 'Dog' ? '🐕' : type === 'Cat' ? '🐈' : '🐾'}</span>
                    {type}
                  </button>
                ))}
              </div>
            </div>

            <div className="relative">
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Breed <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  ref={breedInputRef}
                  type="text"
                  value={breedSearchQuery || breed}
                  onChange={(e) => {
                    const q = e.target.value;
                    setBreedSearchQuery(q);
                    setBreedDropdownOpen(true);
                    const breedList =
                      petType === 'Dog'
                        ? DOG_BREEDS
                        : petType === 'Cat'
                          ? CAT_BREEDS
                          : [...DOG_BREEDS, ...CAT_BREEDS];
                    const filtered = !q
                      ? breedList
                      : breedList.filter((b) => b.toLowerCase().includes(q.toLowerCase()));
                    if (q && !filtered.includes(q)) setBreed(q);
                  }}
                  onFocus={() => setBreedDropdownOpen(true)}
                  placeholder="Search breed or type custom..."
                  className={`${inputClass} pr-10`}
                />
                <button
                  type="button"
                  onClick={() => {
                    setBreedDropdownOpen((o) => !o);
                    breedInputRef.current?.focus();
                  }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400"
                  aria-label="Toggle breeds"
                >
                  <ChevronDown className={`h-5 w-5 transition-transform ${breedDropdownOpen ? 'rotate-180' : ''}`} />
                </button>
                {breedDropdownOpen && (
                  <div
                    ref={breedDropdownRef}
                    className="absolute z-50 mt-1 max-h-60 w-full overflow-y-auto rounded-xl border border-gray-200 bg-white shadow-lg"
                  >
                    {getFilteredBreeds().length > 0 ? (
                      getFilteredBreeds().map((b) => (
                        <button
                          key={b}
                          type="button"
                          onClick={() => {
                            setBreed(b);
                            setBreedSearchQuery('');
                            setBreedDropdownOpen(false);
                          }}
                          className="w-full px-4 py-2.5 text-left text-sm hover:bg-orange-50"
                        >
                          {b}
                        </button>
                      ))
                    ) : (
                      <div className="px-4 py-2 text-sm text-gray-500">No breeds found. Type a custom breed.</div>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Age (years) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  min={0}
                  inputMode="numeric"
                  value={age}
                  onChange={(e) => setAge(e.target.value)}
                  placeholder="e.g., 3"
                  className={inputClass}
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">Gender</label>
                <select
                  value={gender}
                  onChange={(e) => setGender(e.target.value as 'male' | 'female' | '')}
                  className={inputClass}
                >
                  <option value="">Select</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                </select>
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">Weight (kg)</label>
              <input
                type="number"
                min={0}
                step="0.1"
                inputMode="decimal"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                placeholder="e.g., 12.5"
                className={inputClass}
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">Microchip ID (Optional)</label>
              <input
                type="text"
                value={microchipId}
                onChange={(e) => setMicrochipId(e.target.value)}
                placeholder="e.g., 123456789012345"
                className={inputClass}
              />
            </div>
          </div>
        </div>
        ) : (
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-4 py-4 pb-24 [-webkit-overflow-scrolling:touch]">
            <PetHealthVaccinationFormBody
              petName={name.trim() || 'your pet'}
              showIntro
              healthRecords={healthRecords}
              vaccinations={vaccinations}
              onHealthRecordsChange={setHealthRecords}
              onVaccinationsChange={setVaccinations}
            />
          </div>
        </div>
        )}
      </div>

      <div className="fixed bottom-0 left-1/2 z-50 w-full max-w-md -translate-x-1/2 border-t border-gray-200 bg-white p-4 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] md:rounded-b-3xl">
        {step === 1 ? (
          <button
            type="button"
            disabled={submitting}
            onClick={handleContinueToHealth}
            className="min-h-12 w-full touch-manipulation rounded-xl bg-orange-500 py-3 text-center text-base font-semibold text-white active:bg-orange-600 disabled:opacity-60"
          >
            Next
          </button>
        ) : (
          <div className="flex gap-3">
            <button
              type="button"
              disabled={submitting}
              onClick={() => setStep(1)}
              className="min-h-12 flex-1 touch-manipulation rounded-xl border border-gray-200 bg-white py-3 text-center text-base font-semibold text-gray-800 active:bg-gray-50 disabled:opacity-60"
            >
              Back
            </button>
            <button
              type="button"
              disabled={submitting}
              onClick={handleSubmit}
              className="min-h-12 flex-1 touch-manipulation rounded-xl bg-orange-500 py-3 text-center text-base font-semibold text-white active:bg-orange-600 disabled:opacity-60"
            >
              {submitting ? 'Saving…' : 'Save Pet'}
            </button>
          </div>
        )}
      </div>
      </div>
    </div>
  );
}
