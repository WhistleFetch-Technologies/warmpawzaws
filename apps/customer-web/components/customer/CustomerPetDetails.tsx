'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Calendar, AlertCircle, Scale, User, Shield, Heart, ChevronRight } from 'lucide-react';
import { fetchPetById } from '@/lib/fetch-customer-pet';
import { apiClient } from '@/lib/api-client';
import { ApiError } from '@/lib/error-handling';
import { breedsForSpecies } from '@/lib/pet-breeds';
import { ProfileAccountHero } from '@/components/customer/profile/ProfileAccountHero';
import { ProfileMetricStrip } from '@/components/customer/profile/ProfileMetricStrip';
import { ProfileSectionCard } from '@/components/customer/profile/ProfileSectionCard';
import { ProfileGridField, ProfileGridFields } from '@/components/customer/profile/ProfileGridField';
import { ProfileFieldLabel } from '@/components/customer/profile/ProfileFieldLabel';
import { ProfileDangerZone } from '@/components/customer/profile/ProfileDangerZone';
import { ProfileStickySaveBar } from '@/components/customer/profile/ProfileStickySaveBar';
import { ProfileBookingPreviewCard } from '@/components/customer/profile/ProfileBookingPreviewCard';
import {
  petTypeEmoji,
  formatPetAge,
  formatPetWeight,
  deriveHealthStatus,
  deriveVaccinationStatus,
  deriveNextDueDate,
  formatDisplayDate,
  formatHealthFieldText,
  formatBloodType,
  normalizeVaccinationsFromApi,
  normalizeVaccinationDateToIso,
  extractVaccinationEntriesFromApi,
  vaccinationEntriesToApiPayload,
  genderSymbol,
  type VaccinationEntryDisplay,
} from '@/lib/pet-profile-display';
import { flatMapFromVaccinationEntries } from '@/lib/vaccine-label-mapping';
import { BloodTypeSelector } from '@/components/customer/pet-blood-type';
import { normalizeBloodTypeKey } from '@/lib/pet-blood-types';
import { normalizePetSpecies } from '@/lib/pet-vaccination-schedule';

interface Pet {
  id: string;
  name: string;
  type: string;
  breed: string;
  age: string;
  gender: string;
  weight: string;
  photo?: string;
  color?: string;
  microchipId?: string;
  bloodType?: string;
  dateOfBirth?: string;
  ageUnit?: 'months' | 'years';
  healthRecords?: {
    lastCheckup?: string;
    allergies?: string;
    medications?: string;
    conditions?: string;
  };
  vaccinations?: {
    rabies?: string;
    distemper?: string;
    parvovirus?: string;
    other?: string;
  };
  vaccinationEntries: VaccinationEntryDisplay[];
}

interface Booking {
  id: string;
  serviceType: string;
  vendorName: string;
  startDate: string;
  endDate?: string;
  totalSessions: number;
  completedSessions: number;
  upcomingSessions: number;
  status: 'active' | 'completed' | 'cancelled';
  price: number;
  requiresOTP?: boolean;
  completionOTP?: string;
  scheduledDate?: string;
}

interface CustomerPetDetailsProps {
  phone: string;
  petId: string;
  onBack: () => void;
  onViewBooking?: (bookingId: string, petId: string) => void;
  onDelete?: () => void; // Add this callback for navigation after delete
  onViewPetProfile?: (petData: any) => void; // View full pet profile with booking history
}

function photoUrlFromPet(raw: any): string {
  return (
    raw?.photo ||
    raw?.image ||
    raw?.profile_photo_url ||
    raw?.profilePhotoUrl ||
    ''
  );
}

/** Resolve age + unit from API raw pet row. */
function resolveAgeFromRaw(raw: any): { age: string; ageUnit: 'months' | 'years' } {
  if (raw.age_months != null && raw.age_months !== '') {
    return { age: String(raw.age_months), ageUnit: 'months' };
  }
  if (raw.age_years != null && raw.age_years !== '') {
    return { age: String(raw.age_years), ageUnit: 'years' };
  }
  const ageRaw = raw.age;
  if (ageRaw != null && ageRaw !== '') {
    const ageStr = String(ageRaw).trim();
    if (/month/i.test(ageStr)) {
      const num = parseInt(ageStr.replace(/\D/g, ''), 10);
      return { age: Number.isNaN(num) ? '' : String(num), ageUnit: 'months' };
    }
    const num = parseFloat(ageStr);
    if (!Number.isNaN(num) && num > 0 && num < 1) {
      return { age: String(Math.max(1, Math.round(num * 12))), ageUnit: 'months' };
    }
    if (!Number.isNaN(num)) {
      return { age: String(Math.round(num)), ageUnit: 'years' };
    }
    return { age: ageStr, ageUnit: 'years' };
  }
  return { age: '', ageUnit: 'months' };
}

function normalizeGender(gender: string): string {
  const g = String(gender || '').toLowerCase();
  if (g === 'female' || g === 'f') return 'Female';
  if (g === 'male' || g === 'm') return 'Male';
  return gender || '';
}

/** Map API pet to UI shape (photo fields, species vs type). */
function mapApiPetToPet(raw: any): Pet {
  const species = String(raw.species || raw.type || '').toLowerCase();
  const typeDisplay =
    species === 'dog' ? 'Dog' : species === 'cat' ? 'Cat' : raw.type || (species ? species.charAt(0).toUpperCase() + species.slice(1) : 'Pet');
  const hr = raw.healthRecords ?? raw.health_records ?? raw.medical_history ?? {};
  const { age, ageUnit } = resolveAgeFromRaw(raw);
  const speciesForBlood = normalizePetSpecies(typeDisplay);
  const rawBloodType = hr.bloodType ?? raw.bloodType ?? raw.medical_history?.bloodType;
  return {
    ...raw,
    id: String(raw.id),
    name: raw.name || 'Pet',
    type: typeDisplay,
    breed: raw.breed || '',
    age,
    ageUnit,
    gender: normalizeGender(raw.gender),
    weight: raw.weight != null && raw.weight !== '' ? String(raw.weight).replace(/[^\d.]/g, '') || String(raw.weight) : '',
    photo: photoUrlFromPet(raw),
    dateOfBirth: raw.dateOfBirth ?? raw.date_of_birth,
    microchipId: raw.microchipId ?? raw.microchip_id ?? hr.microchipId ?? '',
    bloodType: normalizeBloodTypeKey(rawBloodType, speciesForBlood),
    healthRecords: {
      lastCheckup: hr.lastCheckup ?? hr.last_checkup ?? '',
      allergies: formatHealthFieldText(hr.allergies),
      medications: formatHealthFieldText(hr.medications ?? hr.currentMedications ?? hr.current_medications),
      conditions: formatHealthFieldText(
        hr.conditions ?? hr.chronicConditions ?? hr.chronic_conditions ?? hr.medicalConditions
      ),
    },
    vaccinations: (() => {
      const v = normalizeVaccinationsFromApi(raw);
      return {
        rabies: normalizeVaccinationDateToIso(v.rabies),
        distemper: normalizeVaccinationDateToIso(v.distemper),
        parvovirus: normalizeVaccinationDateToIso(v.parvovirus),
        other: normalizeVaccinationDateToIso(v.other),
      };
    })(),
    vaccinationEntries: extractVaccinationEntriesFromApi(raw),
  };
}

/** Map GET /customer/:phone/pets/:petId/bookings row to UI booking card shape. */
function mapPetBookingFromApi(raw: any): Booking {
  const st = String(raw?.status ?? '').toLowerCase();
  let uiStatus: Booking['status'] = 'active';
  if (st === 'completed' || st === 'partially_completed') uiStatus = 'completed';
  else if (st === 'cancelled' || st === 'no_show') uiStatus = 'cancelled';
  else uiStatus = 'active';

  const schedule =
    raw?.scheduledDate ??
    raw?.scheduled_date ??
    raw?.bookingDate ??
    raw?.booking_date ??
    raw?.startDate;
  const priceRaw = raw?.price ?? raw?.total_amount ?? 0;
  const priceNum = typeof priceRaw === 'number' ? priceRaw : parseFloat(String(priceRaw)) || 0;

  return {
    id: String(raw?.id ?? ''),
    serviceType: String(raw?.serviceName ?? raw?.service_name ?? 'Service'),
    vendorName: String(raw?.vendorName ?? raw?.vendor_name ?? ''),
    startDate: schedule != null && schedule !== '' ? String(schedule) : '',
    totalSessions: raw?.totalSessions ?? 1,
    completedSessions: raw?.completedSessions ?? 0,
    upcomingSessions: raw?.upcomingSessions ?? 0,
    status: uiStatus,
    price: priceNum,
    requiresOTP: raw?.requiresOTP,
    completionOTP: raw?.completionOTP ?? raw?.otp_code,
    scheduledDate: schedule != null && schedule !== '' ? String(schedule) : undefined,
  };
}

function extractBookingsList(payload: any): any[] {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload.bookings)) return payload.bookings;
  if (Array.isArray(payload.data)) return payload.data;
  return [];
}

function buildVaccinationPayload(pet: Pet): {
  vaccinations: ReturnType<typeof vaccinationEntriesToApiPayload>;
  healthRecords: Pet['healthRecords'] & {
    vaccinationDates?: Pet['vaccinations'];
    vaccinations?: ReturnType<typeof vaccinationEntriesToApiPayload>;
  };
} {
  const entries = pet.vaccinationEntries ?? [];
  const flat = flatMapFromVaccinationEntries(
    entries.map((e) => ({ name: e.name, date: e.date, lastDate: e.date }))
  );
  const vaccinationDates = {
    rabies: normalizeVaccinationDateToIso(flat.rabies),
    distemper: normalizeVaccinationDateToIso(flat.distemper),
    parvovirus: normalizeVaccinationDateToIso(flat.parvovirus),
    other: normalizeVaccinationDateToIso(flat.other),
  };
  const vaccinations = vaccinationEntriesToApiPayload(entries);
  return {
    vaccinations,
    healthRecords: {
      ...pet.healthRecords,
      vaccinationDates,
      vaccinations,
    },
  };
}

function formatPetSaveError(error: unknown): string {
  const fallback = 'Error saving pet profile. Please try again.';
  if (error instanceof ApiError) {
    const data = ((error as ApiError & { responseData?: unknown }).responseData ??
      (error as { response?: unknown }).response) as { error?: string } | undefined;
    if (typeof data?.error === 'string' && data.error.trim()) {
      return `${fallback}\n\n${data.error.trim()}`;
    }
    const msg = error.message?.trim();
    if (msg && !/^HTTP \d+$/.test(msg)) {
      return `${fallback}\n\n${msg}`;
    }
  }
  if (error instanceof Error && error.message?.trim()) {
    return `${fallback}\n\n${error.message.trim()}`;
  }
  return fallback;
}

export function CustomerPetDetails({ phone, petId, onBack, onViewBooking, onDelete, onViewPetProfile }: CustomerPetDetailsProps) {
  const [pet, setPet] = useState<Pet | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingBookings, setLoadingBookings] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [photoPreview, setPhotoPreview] = useState<string>('');
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [bookingsLoadError, setBookingsLoadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const previewBookings = useMemo(() => bookings.slice(0, 2), [bookings]);

  useEffect(() => {
    if (!petId) {
      console.error('Pet ID is missing');
      setLoading(false);
      return;
    }
    loadPetDetails();
    loadPetBookings();
  }, [phone, petId]);

  const loadPetDetails = async () => {
    if (!petId) {
      console.error('Cannot load pet details: petId is missing');
      setLoading(false);
      return;
    }
    
    try {
      setLoading(true);
      let raw: any = null;

      try {
        const data = (await apiClient.get(
          `/customer/${encodeURIComponent(phone)}/pets/${encodeURIComponent(petId)}`
        )) as any;
        if (data?.success && data.pet) raw = data.pet;
      } catch {
        /* fallback below */
      }

      if (!raw) {
        raw = await fetchPetById(petId, phone);
      }

      if (raw) {
        const mapped = mapApiPetToPet(raw);
        setPet(mapped);
        setPhotoPreview(photoUrlFromPet(raw));
      } else {
        console.error('Failed to load pet');
      }
    } catch (error: any) {
      console.error('Error loading pet details:', error);
      if (error?.status === 404 || error?.response?.status === 404) {
        console.error('Pet not found');
      }
    } finally {
      setLoading(false);
    }
  };

  const loadPetBookings = async () => {
    const normalizeAndSet = (rows: any[]) => {
      setBookings((rows || []).map(mapPetBookingFromApi));
      setBookingsLoadError(null);
    };

    try {
      setLoadingBookings(true);
      setBookingsLoadError(null);

      // Primary endpoint: pet-scoped history route.
      try {
        const data = (await apiClient.get(`/customer/${phone}/pets/${petId}/bookings`)) as any;
        const rows = extractBookingsList(data);
        normalizeAndSet(rows);
        return;
      } catch (primaryError) {
        console.warn('Primary pet-bookings endpoint failed, trying fallback route:', primaryError);
      }

      // Fallback endpoint: customer bookings with petId filter (used in other pet views).
      try {
        const fallbackData = (await apiClient.get(
          `/customer/bookings?phone=${encodeURIComponent(phone)}&petId=${encodeURIComponent(petId)}`
        )) as any;
        const fallbackRows = extractBookingsList(fallbackData);
        normalizeAndSet(fallbackRows);
        return;
      } catch (fallbackError) {
        console.error('Error loading bookings (primary + fallback):', fallbackError);
        setBookings([]);
        if (fallbackError instanceof ApiError && fallbackError.statusCode === 404) {
          // Missing route should behave like "no bookings", not a hard error card.
          setBookingsLoadError(null);
        } else {
          setBookingsLoadError('Could not load bookings. Please try again in a moment.');
        }
      }
    } finally {
      setLoadingBookings(false);
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && pet) {
      // Check file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        alert('Image size should be less than 5MB');
        return;
      }
      
      // Show preview immediately
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
      
      // Upload to S3
      try {
        setSaving(true);
        const { uploadPetPhoto } = await import('@/lib/photo-upload');
        const result = await uploadPetPhoto(file, pet.id, phone);
        
        if (result.success && result.publicUrl) {
          setPet({ ...pet, photo: result.publicUrl });
          console.log('✅ Pet photo uploaded to S3:', result.publicUrl);
        } else {
          console.error('Failed to upload photo:', result.error);
          // Fallback to base64 if S3 upload fails
          const base64Reader = new FileReader();
          base64Reader.onloadend = () => {
            setPet({ ...pet, photo: base64Reader.result as string });
          };
          base64Reader.readAsDataURL(file);
        }
      } catch (error) {
        console.error('Error uploading photo to S3:', error);
        // Fallback to base64
        const base64Reader = new FileReader();
        base64Reader.onloadend = () => {
          setPet({ ...pet, photo: base64Reader.result as string });
        };
        base64Reader.readAsDataURL(file);
      } finally {
        setSaving(false);
      }
    }
  };

  const handleSave = async () => {
    if (!pet) return;

    setSaving(true);
    try {
      const { vaccinations, healthRecords } = buildVaccinationPayload(pet);
      const payload = {
        name: pet.name.trim(),
        breed: pet.breed,
        gender: pet.gender?.toLowerCase(),
        type: pet.type,
        species: pet.type,
        age: pet.age,
        ageUnit: pet.ageUnit || 'years',
        weight: pet.weight ? parseFloat(String(pet.weight).replace(/[^\d.]/g, '')) : undefined,
        dateOfBirth: pet.dateOfBirth,
        photo: pet.photo,
        microchipId: pet.microchipId,
        healthRecords: {
          ...healthRecords,
          ...(pet.bloodType ? { bloodType: pet.bloodType } : {}),
        },
        vaccinations,
      };

      const data = await apiClient.put(`/customer/${encodeURIComponent(phone)}/pets/${encodeURIComponent(petId)}`, payload) as any;

      if (data && data.success) {
        setEditMode(false);
        await loadPetDetails();
        alert('Pet profile updated successfully! 🎉');
      } else {
        throw new Error(data?.error || 'Failed to update pet');
      }
    } catch (error) {
      console.error('Error saving pet:', error);
      alert(formatPetSaveError(error));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!pet) return;
    
    // First confirmation
    const confirmed = confirm(
      `Are you sure you want to delete ${pet.name}'s profile?\n\n` +
      `This action cannot be undone. All booking history will be preserved but the pet will be removed from your list.`
    );
    
    if (!confirmed) return;
    
    setDeleting(true);
    
    try {
      console.log(`=== DELETING PET ${petId} ===`);

      const deleteData = (await apiClient.delete(`/customer/${phone}/pets/${petId}`)) as any;

      if (!deleteData || !deleteData.success) {
        throw new Error(deleteData?.error || 'Failed to delete pet');
      }

      console.log('Pet deleted successfully');
      
      // Show success message
      alert(`${pet.name} has been removed from your pet list. ✅\n\nAll booking history has been preserved.`);
      
      // Go back to previous screen
      if (onDelete) {
        onDelete();
      } else {
        onBack();
      }
      
    } catch (error) {
      console.error('Error deleting pet:', error);
      if (error instanceof ApiError && error.statusCode === 400) {
        const data = ((error as any).responseData ?? (error as any).response) as {
          activeBookingsCount?: number;
          pendingMealOrdersCount?: number;
          activeMealSubscriptionsCount?: number;
          error?: string;
        } | null;
        const apiMessage = data?.error?.trim();
        if (apiMessage) {
          alert(apiMessage);
          return;
        }
        const count = data?.activeBookingsCount;
        if (count != null && count > 0) {
          alert(
            `Cannot delete ${pet.name}'s profile\n\n` +
              `This pet has ${count} active booking(s). ` +
              `Please complete or cancel all active bookings before deleting the pet profile.`
          );
          return;
        }
      }
      alert(`Error: ${error instanceof Error ? error.message : 'Failed to delete pet. Please try again.'}`);
    } finally {
      setDeleting(false);
    }
  };

  const toggleEditMode = () => setEditMode((prev) => !prev);

  const inputClass =
    'w-full rounded-xl border-2 border-gray-200 px-4 py-3 focus:border-[#FF8C42] focus:outline-none';

  const heroChip =
    'inline-flex h-9 max-w-full items-center gap-1.5 rounded-full border border-[rgba(255,255,255,0.20)] bg-[rgba(255,255,255,0.15)] px-3 text-xs font-medium text-white backdrop-blur-[10px]';

  const genderBadge = genderSymbol(pet?.gender);

  const hero = pet ? (
    <ProfileAccountHero
      displayName={loading ? 'Pet' : pet.name}
      photoUrl={photoPreview || pet.photo}
      loading={loading}
      onCloseToHome={onBack}
      onEdit={toggleEditMode}
      editModeActive={editMode}
      editMode={editMode}
      onPhotoClick={() => fileInputRef.current?.click()}
      hideDefaultChips
      badge={
        genderBadge ? (
          <span
            className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white text-sm font-bold shadow-sm ${genderBadge.colorClass}`}
            aria-label={pet.gender}
          >
            {genderBadge.symbol}
          </span>
        ) : null
      }
      subtitle={
        <div className="flex flex-wrap items-center gap-2">
          <span className={heroChip}>
            {petTypeEmoji(pet.type)} {pet.type}
          </span>
          {pet.breed && (
            <>
              <span className="text-white/60" aria-hidden>
                |
              </span>
              <span className={heroChip}>{pet.breed}</span>
            </>
          )}
        </div>
      }
      metaChips={
        <>
          <span className={heroChip}>
            <Calendar className="h-3.5 w-3.5 shrink-0" strokeWidth={2} aria-hidden />
            {formatPetAge(pet)}
          </span>
          <span className={heroChip}>
            <Scale className="h-3.5 w-3.5 shrink-0" strokeWidth={2} aria-hidden />
            {formatPetWeight(pet.weight)}
          </span>
        </>
      }
      fallbackAvatar={
        <span className="text-4xl" aria-hidden>
          {petTypeEmoji(pet.type)}
        </span>
      }
    />
  ) : null;

  if (loading) {
    return (
      <div className="mx-auto min-h-screen w-full max-w-customer bg-[#F5F5F5]">
        <ProfileAccountHero
          displayName="Pet"
          loading
          onCloseToHome={onBack}
          onEdit={toggleEditMode}
          hideDefaultChips
        />
        <div className="flex items-center justify-center py-24">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-[#FF8C42] border-t-transparent" />
        </div>
      </div>
    );
  }

  if (!petId) {
    return (
      <div className="min-h-screen bg-gray-50 pb-20">
        <div className="sticky top-0 z-10 bg-white border-b px-4 py-4 flex items-center">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ChevronRight className="w-5 h-5 rotate-180" />
          </Button>
          <h1 className="text-lg font-bold">Pet Details</h1>
        </div>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <AlertCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
            <p className="text-gray-600 mb-2">Pet ID is missing</p>
            <Button onClick={onBack} className="mt-4">Go Back</Button>
          </div>
        </div>
      </div>
    );
  }

  if (!pet) {
    return (
      <div className="mx-auto min-h-screen w-full max-w-customer bg-[#F5F5F5]">
        {hero}
        <div className="flex flex-col items-center justify-center px-6 py-24">
          <p className="mb-4 text-gray-600">Pet not found</p>
          <Button onClick={onBack} className="bg-[#FF8C42] hover:bg-[#FF7A2E]">
            Go Back
          </Button>
        </div>
      </div>
    );
  }

  const metricItems = [
    {
      icon: Heart,
      iconBg: 'bg-blue-50',
      iconColor: 'text-blue-600',
      value: deriveHealthStatus(pet),
      label: 'Health Status',
    },
    {
      icon: Shield,
      iconBg: 'bg-orange-50',
      iconColor: 'text-[#FF8C42]',
      value: deriveVaccinationStatus(pet),
      label: 'Vaccination',
    },
    {
      icon: Calendar,
      iconBg: 'bg-purple-50',
      iconColor: 'text-purple-600',
      value: formatDisplayDate(pet.healthRecords?.lastCheckup),
      label: 'Last Checkup',
    },
    {
      icon: Calendar,
      iconBg: 'bg-emerald-50',
      iconColor: 'text-emerald-600',
      value: String(bookings.length),
      label: 'Total Bookings',
    },
  ];

  return (
    <div className="mx-auto min-h-screen w-full max-w-customer bg-[#F5F5F5]">
      {hero}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handlePhotoUpload}
        className="hidden"
      />

      <div className={`pb-28 ${editMode ? 'pt-2' : ''}`}>
        {!editMode && <ProfileMetricStrip items={metricItems} />}

        <div className="mt-3 space-y-4 px-4 pb-[max(1.25rem,env(safe-area-inset-bottom,0px))] sm:px-5">
          <ProfileSectionCard
            title="Basic Information"
            titleIcon={User}
            onEdit={editMode ? undefined : () => setEditMode(true)}
          >
            {editMode ? (
              <div className="space-y-3">
                <div>
                  <ProfileFieldLabel>Pet Name</ProfileFieldLabel>
                  <input
                    type="text"
                    value={pet.name}
                    onChange={(e) => setPet({ ...pet, name: e.target.value })}
                    className={inputClass}
                  />
                </div>

                <div>
                  <ProfileFieldLabel>Type</ProfileFieldLabel>
                  <div className="grid grid-cols-2 gap-3">
                    {(['Dog', 'Cat'] as const).map((type) => (
                      <button
                        key={type}
                        type="button"
                        onClick={() =>
                          setPet((prev) =>
                            prev
                              ? {
                                  ...prev,
                                  type,
                                  breed: prev.type === type ? prev.breed : '',
                                }
                              : prev
                          )
                        }
                        className={`rounded-xl border-2 px-4 py-3 text-sm font-semibold transition ${
                          pet.type === type
                            ? 'border-[#FF8C42] bg-orange-50 text-[#FF8C42]'
                            : 'border-gray-200 bg-white text-gray-700'
                        }`}
                      >
                        {petTypeEmoji(type)} {type}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <ProfileFieldLabel>Gender</ProfileFieldLabel>
                    <select
                      value={pet.gender || ''}
                      onChange={(e) => setPet({ ...pet, gender: e.target.value })}
                      className={inputClass}
                    >
                      <option value="">Select gender</option>
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                    </select>
                  </div>
                  <div>
                    <ProfileFieldLabel>Breed</ProfileFieldLabel>
                    <select
                      value={pet.breed}
                      onChange={(e) => setPet({ ...pet, breed: e.target.value })}
                      className={inputClass}
                    >
                      <option value="">Select breed</option>
                      {(() => {
                        const options = breedsForSpecies(pet.type);
                        const withCurrent =
                          pet.breed && !options.includes(pet.breed)
                            ? [pet.breed, ...options]
                            : options;
                        return withCurrent.map((breed) => (
                          <option key={breed} value={breed}>
                            {breed}
                          </option>
                        ));
                      })()}
                    </select>
                  </div>
                </div>

                {pet.dateOfBirth ? (
                  <div>
                    <ProfileFieldLabel>Date of Birth</ProfileFieldLabel>
                    <input
                      type="date"
                      value={pet.dateOfBirth.split('T')[0]}
                      max={new Date().toISOString().split('T')[0]}
                      onChange={(e) => setPet({ ...pet, dateOfBirth: e.target.value })}
                      className={inputClass}
                    />
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <ProfileFieldLabel>Age</ProfileFieldLabel>
                      <input
                        type="number"
                        min={1}
                        value={pet.age}
                        onChange={(e) => setPet({ ...pet, age: e.target.value })}
                        className={inputClass}
                        placeholder="e.g. 2"
                      />
                    </div>
                    <div>
                      <ProfileFieldLabel>Age Unit</ProfileFieldLabel>
                      <select
                        value={pet.ageUnit || 'months'}
                        onChange={(e) =>
                          setPet({
                            ...pet,
                            ageUnit: e.target.value as 'months' | 'years',
                          })
                        }
                        className={inputClass}
                      >
                        <option value="months">Months</option>
                        <option value="years">Years</option>
                      </select>
                    </div>
                  </div>
                )}

                <div>
                  <ProfileFieldLabel>Weight (kg)</ProfileFieldLabel>
                  <input
                    type="number"
                    step="0.01"
                    min={0}
                    value={pet.weight}
                    onChange={(e) => setPet({ ...pet, weight: e.target.value })}
                    className={inputClass}
                    placeholder="e.g. 11.8"
                  />
                </div>

                <div>
                  <ProfileFieldLabel>Microchip ID</ProfileFieldLabel>
                  <input
                    type="text"
                    value={pet.microchipId || ''}
                    onChange={(e) => setPet({ ...pet, microchipId: e.target.value })}
                    className={inputClass}
                    placeholder="Optional"
                  />
                </div>

                <div>
                  <ProfileFieldLabel>
                    Blood Type <span className="text-gray-400 text-xs font-normal">(Optional)</span>
                  </ProfileFieldLabel>
                  <BloodTypeSelector
                    species={normalizePetSpecies(pet.type)}
                    value={pet.bloodType || ''}
                    onChange={(key) => setPet({ ...pet, bloodType: key })}
                    name="profileBloodType"
                  />
                </div>
              </div>
            ) : (
              <ProfileGridFields>
                <ProfileGridField label="Pet Name" value={pet.name} />
                <ProfileGridField label="Breed" value={pet.breed || '—'} />
                <ProfileGridField label="Type" value={`${petTypeEmoji(pet.type)} ${pet.type}`} />
                <ProfileGridField label="Gender" value={pet.gender || 'Not specified'} />
                <ProfileGridField label="Age" value={formatPetAge(pet)} />
                <ProfileGridField label="Weight" value={formatPetWeight(pet.weight)} />
                <ProfileGridField
                  label="Microchip ID"
                  value={pet.microchipId?.trim() ? pet.microchipId : 'Not recorded'}
                />
                <ProfileGridField
                  label="Blood Type"
                  value={formatBloodType(pet.bloodType, normalizePetSpecies(pet.type))}
                />
              </ProfileGridFields>
            )}
          </ProfileSectionCard>

          <ProfileSectionCard
            title="Health Records"
            titleIcon={Shield}
            titleIconBg="bg-emerald-50"
            titleIconColor="text-emerald-600"
            headerLink={
              !editMode
                ? {
                    label: 'View History →',
                    onClick: () => setEditMode(true),
                  }
                : undefined
            }
          >
            {editMode ? (
              <div className="space-y-4">
                <div className="space-y-3">
                  <ProfileFieldLabel>Last Checkup</ProfileFieldLabel>
                  <div className="warmpawz-date-field-wrap">
                    <input
                      type="date"
                      value={pet.healthRecords?.lastCheckup || ''}
                      onChange={(e) =>
                        setPet({
                          ...pet,
                          healthRecords: { ...pet.healthRecords, lastCheckup: e.target.value },
                        })
                      }
                      className={inputClass}
                    />
                  </div>
                  <ProfileFieldLabel>Allergies</ProfileFieldLabel>
                  <textarea
                    value={pet.healthRecords?.allergies || ''}
                    onChange={(e) =>
                      setPet({
                        ...pet,
                        healthRecords: { ...pet.healthRecords, allergies: e.target.value },
                      })
                    }
                    rows={2}
                    className={`${inputClass} resize-none`}
                    placeholder="e.g. chicken, pollen"
                  />
                  <ProfileFieldLabel>Current Medications</ProfileFieldLabel>
                  <textarea
                    value={pet.healthRecords?.medications || ''}
                    onChange={(e) =>
                      setPet({
                        ...pet,
                        healthRecords: { ...pet.healthRecords, medications: e.target.value },
                      })
                    }
                    rows={2}
                    className={`${inputClass} resize-none`}
                    placeholder="Leave blank if none"
                  />
                  <ProfileFieldLabel>Medical Conditions</ProfileFieldLabel>
                  <textarea
                    value={pet.healthRecords?.conditions || ''}
                    onChange={(e) =>
                      setPet({
                        ...pet,
                        healthRecords: { ...pet.healthRecords, conditions: e.target.value },
                      })
                    }
                    rows={2}
                    className={`${inputClass} resize-none`}
                    placeholder="Leave blank if none"
                  />
                </div>
                <div className="border-t border-stone-100 pt-4">
                  <h4 className="mb-3 text-sm font-semibold text-gray-700">Vaccination Chart</h4>
                  {pet.vaccinationEntries.length === 0 ? (
                    <p className="text-sm text-gray-500">No vaccinations recorded</p>
                  ) : (
                    <div className="space-y-3">
                      {pet.vaccinationEntries.map((entry, index) => (
                        <div key={entry.key ?? `${entry.name}-${index}`}>
                          <ProfileFieldLabel>{entry.name}</ProfileFieldLabel>
                          <div className="warmpawz-date-field-wrap">
                            <input
                              type="date"
                              value={entry.date || ''}
                              onChange={(e) => {
                                const nextEntries = pet.vaccinationEntries.map((item, i) =>
                                  i === index ? { ...item, date: e.target.value } : item
                                );
                                setPet({ ...pet, vaccinationEntries: nextEntries });
                              }}
                              className={inputClass}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <ProfileGridFields>
                <ProfileGridField
                  label="Last Checkup"
                  value={formatDisplayDate(pet.healthRecords?.lastCheckup)}
                />
                <ProfileGridField label="Next Due" value={deriveNextDueDate({ ...pet, vaccinationEntries: pet.vaccinationEntries })} />
                <ProfileGridField
                  label="Allergies"
                  value={formatHealthFieldText(pet.healthRecords?.allergies) || 'None'}
                />
                <ProfileGridField
                  label="Vaccination"
                  value={deriveVaccinationStatus({ ...pet, vaccinationEntries: pet.vaccinationEntries })}
                />
                {pet.vaccinationEntries.map((entry, index) => (
                  <ProfileGridField
                    key={entry.key ?? `${entry.name}-${index}`}
                    label={entry.name}
                    value={formatDisplayDate(entry.date)}
                  />
                ))}
              </ProfileGridFields>
            )}
          </ProfileSectionCard>

          <ProfileSectionCard
            title="Service Bookings"
            titleIcon={Calendar}
            titleIconBg="bg-violet-50"
            titleIconColor="text-violet-600"
            headerExtra={
              bookings.length > 0 ? (
                <span className="rounded-full bg-[#FF8C42] px-2 py-0.5 text-xs font-semibold text-white">
                  {bookings.length}
                </span>
              ) : null
            }
            headerLink={
              onViewPetProfile && bookings.length > 0
                ? { label: 'View All Bookings →', onClick: () => onViewPetProfile(pet) }
                : undefined
            }
          >
            {loadingBookings ? (
              <div className="py-6 text-center">
                <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-[#FF8C42] border-t-transparent" />
              </div>
            ) : bookingsLoadError ? (
              <div className="rounded-xl border border-amber-100 bg-amber-50 p-6 text-center">
                <AlertCircle className="mx-auto mb-3 h-12 w-12 text-amber-600" />
                <p className="text-sm text-gray-800">{bookingsLoadError}</p>
              </div>
            ) : bookings.length === 0 ? (
              <div className="rounded-xl bg-gray-50 p-6 text-center">
                <Calendar className="mx-auto mb-3 h-12 w-12 text-gray-400" />
                <p className="text-sm text-gray-600">No bookings yet</p>
                <p className="mt-1 text-xs text-gray-500">Book services for {pet.name}</p>
              </div>
            ) : (
              <div className="space-y-3">
                {previewBookings.map((booking) => (
                  <ProfileBookingPreviewCard
                    key={booking.id}
                    booking={booking}
                    onClick={() => onViewBooking?.(booking.id, petId)}
                  />
                ))}
                {bookings.length > previewBookings.length && (
                  <p className="text-center text-xs text-gray-500">
                    Showing latest {previewBookings.length} of {bookings.length} bookings
                  </p>
                )}
              </div>
            )}
          </ProfileSectionCard>

          <ProfileDangerZone
            warningText={`Once you delete ${pet.name}'s profile, it cannot be undone. Booking history will be preserved.`}
            onDelete={handleDelete}
            deleting={deleting}
            deleteLabel={`Delete ${pet.name}'s Profile`}
          />
        </div>
      </div>

      {editMode && <ProfileStickySaveBar onSave={handleSave} saving={saving} />}
    </div>
  );
}