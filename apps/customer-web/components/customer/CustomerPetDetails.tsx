'use client';

import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { 
  Camera, Edit2, X, Calendar, Clock, 
  AlertCircle, ChevronRight, ArrowLeft
} from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { PresignableImage } from '@/components/shared/PresignableImage';
import { fetchPetById } from '@/lib/fetch-customer-pet';
import {
  normalizePetBookingListItem,
  titleCaseBookingLabel,
  type NormalizedPetBookingListItem,
} from '@/lib/customer-booking-normalize';

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
  status: string;
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

/** Map API pet to UI shape (photo fields, species vs type). */
function mapApiPetToPet(raw: any): Pet {
  const species = String(raw.species || raw.type || '').toLowerCase();
  const typeDisplay =
    species === 'dog' ? 'Dog' : species === 'cat' ? 'Cat' : raw.type || (species ? species.charAt(0).toUpperCase() + species.slice(1) : 'Pet');
  return {
    ...raw,
    id: String(raw.id),
    name: raw.name || 'Pet',
    type: typeDisplay,
    breed: raw.breed || '',
    age: String(raw.age ?? raw.age_years ?? ''),
    gender: raw.gender || '',
    weight: raw.weight != null && raw.weight !== '' ? String(raw.weight) : '',
    photo: photoUrlFromPet(raw),
    healthRecords: raw.healthRecords || raw.health_records,
    vaccinations: raw.vaccinations,
  };
}

function petTypeEmoji(type: string): string {
  const t = String(type || '').toLowerCase();
  if (t === 'dog') return '🐕';
  if (t === 'cat') return '🐈';
  return '🐾';
}

function formatAgeLabel(age: string): string {
  const a = String(age ?? '').trim();
  if (!a) return 'Not specified';
  if (a === '1') return '1 year';
  return `${a} years`;
}

/** Grouped list surface (mobile app style) */
const SECTION_CARD =
  'rounded-[1.25rem] bg-white shadow-[0_1px_3px_rgba(0,0,0,0.06)] ring-1 ring-black/[0.04] overflow-hidden';

export function CustomerPetDetails({ phone, petId, onBack, onViewBooking, onDelete, onViewPetProfile }: CustomerPetDetailsProps) {
  const [pet, setPet] = useState<Pet | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingBookings, setLoadingBookings] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [photoPreview, setPhotoPreview] = useState<string>('');
  const [bookings, setBookings] = useState<Booking[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
        const data = (await apiClient.get(`/customer/${phone}/pets/${petId}`)) as any;
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
    try {
      setLoadingBookings(true);
      const data = await apiClient.get(`/customer/${phone}/pets/${petId}/bookings`) as any;

      const rawList = data?.bookings || [];
      const petBookings = rawList
        .filter((b: any) => String(b.petId ?? b.pet_id ?? '') === String(petId))
        .map(normalizePetBookingListItem)
        .filter((b: NormalizedPetBookingListItem) => b.id);
      setBookings(petBookings);
    } catch (error) {
      console.error('Error loading bookings:', error);
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
      // Update pet directly
      const data = await apiClient.put(`/customer/${phone}/pets/${petId}`, pet) as any;

      if (data && data.success) {
        setEditMode(false);
        alert('Pet profile updated successfully! 🎉');
        await loadPetDetails();
      } else {
        throw new Error(data?.error || 'Failed to update pet');
      }
    } catch (error) {
      console.error('Error saving pet:', error);
      alert('Error saving pet profile. Please try again.');
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
      
      const deleteData = await apiClient.delete(`/customer/${phone}/pets/${petId}`) as any;
      
      if (!deleteData || !deleteData.success) {
        // Check if it's because of active bookings
        if (deleteData?.activeBookingsCount && deleteData.activeBookingsCount > 0) {
          alert(
            `Cannot delete ${pet.name}'s profile\n\n` +
            `This pet has ${deleteData.activeBookingsCount} active booking(s). ` +
            `Please complete or cancel all active bookings before deleting the pet profile.`
          );
          return;
        } else {
          throw new Error(deleteData?.error || 'Failed to delete pet');
        }
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
      alert(`Error: ${error instanceof Error ? error.message : 'Failed to delete pet. Please try again.'}`);
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="mx-auto flex min-h-[100dvh] w-full max-w-customer flex-col bg-[#EFEEF2]">
        <div className="flex flex-1 flex-col items-center justify-center px-6 pb-[max(1.5rem,env(safe-area-inset-bottom,0px))]">
          <div className="h-11 w-11 rounded-full border-[3px] border-[#FF8C42] border-t-transparent animate-spin" />
          <p className="mt-4 text-[15px] text-gray-600">Loading pet…</p>
        </div>
      </div>
    );
  }

  if (!petId) {
    return (
      <div className="mx-auto flex min-h-[100dvh] w-full max-w-customer flex-col bg-[#EFEEF2]">
        <header className="border-b border-gray-200/80 bg-white/95 pt-[env(safe-area-inset-top,0px)] backdrop-blur-md">
          <div className="relative flex h-12 items-center justify-center">
            <Button
              variant="ghost"
              type="button"
              className="absolute left-1 h-11 min-w-[44px] px-3"
              onClick={onBack}
              aria-label="Go back"
            >
              <ArrowLeft className="h-5 w-5 text-gray-800" />
            </Button>
            <h1 className="text-[17px] font-semibold text-gray-900">Pet profile</h1>
          </div>
        </header>
        <div className="flex flex-1 flex-col items-center justify-center px-6 pb-[max(2rem,env(safe-area-inset-bottom,0px))]">
          <AlertCircle className="mx-auto mb-4 h-14 w-14 text-amber-500" />
          <p className="text-center text-[15px] text-gray-600">Pet ID is missing</p>
          <Button onClick={onBack} className="mt-6 h-11 rounded-2xl bg-[#FF8C42] px-6 hover:bg-[#FF7A2E]">
            Go back
          </Button>
        </div>
      </div>
    );
  }

  if (!pet) {
    return (
      <div className="mx-auto flex min-h-[100dvh] w-full max-w-customer flex-col bg-[#EFEEF2]">
        <header className="border-b border-gray-200/80 bg-white/95 pt-[env(safe-area-inset-top,0px)] backdrop-blur-md">
          <div className="relative flex h-12 items-center justify-center">
            <Button
              variant="ghost"
              type="button"
              className="absolute left-1 h-11 min-w-[44px] px-3"
              onClick={onBack}
              aria-label="Go back"
            >
              <ArrowLeft className="h-5 w-5 text-gray-800" />
            </Button>
            <h1 className="text-[17px] font-semibold text-gray-900">Pet profile</h1>
          </div>
        </header>
        <div className="flex flex-1 flex-col items-center justify-center px-6 pb-[max(2rem,env(safe-area-inset-bottom,0px))]">
          {loading ? (
            <div className="h-9 w-9 animate-spin rounded-full border-2 border-[#FF8C42] border-t-transparent" />
          ) : (
            <>
              <p className="text-center text-[15px] text-gray-600">Pet not found</p>
              <Button onClick={onBack} className="mt-6 h-11 rounded-2xl bg-[#FF8C42] px-6 hover:bg-[#FF7A2E]">
                Go back
              </Button>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="relative mx-auto flex min-h-[100dvh] w-full max-w-customer flex-col bg-[#EFEEF2]">
      <header className="sticky top-0 z-20 border-b border-gray-200/80 bg-white/95 pt-[env(safe-area-inset-top,0px)] backdrop-blur-md">
        <div className="relative flex h-12 items-center justify-center px-14">
          <Button
            type="button"
            variant="ghost"
            onClick={onBack}
            className="absolute left-1 top-1/2 h-11 min-w-[44px] -translate-y-1/2 px-2 text-gray-800"
            aria-label="Go back"
          >
            <ArrowLeft className="h-6 w-6" />
          </Button>
          <h1 className="truncate text-center text-[17px] font-semibold tracking-tight text-gray-900">Pet profile</h1>
          <button
            type="button"
            onClick={() => (editMode ? setEditMode(false) : setEditMode(true))}
            className="absolute right-1 top-1/2 flex h-11 min-w-[44px] -translate-y-1/2 items-center justify-center rounded-full text-[#FF8C42] active:bg-gray-100"
            aria-label={editMode ? 'Close edit' : 'Edit pet'}
          >
            {editMode ? <X className="h-5 w-5" /> : <Edit2 className="h-5 w-5" />}
          </button>
        </div>
      </header>

      <div
        className={`flex-1 overflow-y-auto overscroll-y-contain ${editMode ? 'pb-36' : 'pb-[max(1.25rem,env(safe-area-inset-bottom,0px))]'}`}
      >
        <div className="bg-gradient-to-b from-[#FF8C42]/16 via-[#FF8C42]/06 to-transparent px-4 pb-5 pt-5">
          <div className="flex flex-col items-center">
            <div
              onClick={() => editMode && fileInputRef.current?.click()}
              className={`relative mb-3 h-[7.75rem] w-[7.75rem] shrink-0 overflow-hidden rounded-[1.75rem] bg-gradient-to-br from-orange-100 to-amber-50 shadow-[0_8px_28px_rgba(255,140,66,0.25)] ring-4 ring-white ${editMode ? 'cursor-pointer transition-transform active:scale-[0.98]' : ''}`}
            >
              {photoPreview ? (
                <>
                  <PresignableImage
                    src={photoPreview}
                    alt={pet?.name || 'Pet'}
                    className="h-full w-full object-cover"
                  />
                  {editMode && (
                    <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/30">
                      <Camera className="h-8 w-8 text-white drop-shadow-md" />
                    </div>
                  )}
                </>
              ) : (
                <span className="flex h-full w-full items-center justify-center text-5xl" aria-hidden>
                  {petTypeEmoji(pet.type)}
                </span>
              )}
            </div>
            <input ref={fileInputRef} type="file" accept="image/*" onChange={handlePhotoUpload} className="hidden" />
            <h2 className="text-center text-[1.375rem] font-bold leading-tight text-gray-900">{pet.name}</h2>
            <p className="mt-1.5 max-w-[20rem] text-center text-[15px] text-gray-600">
              {[pet.type, pet.breed].filter(Boolean).join(' · ') || `${petTypeEmoji(pet.type)} ${pet.type || 'Pet'}`}
            </p>
            {(pet.age || pet.gender) && (
              <p className="mt-1 text-center text-[13px] text-gray-500">
                {pet.age ? <span>{formatAgeLabel(pet.age)}</span> : null}
                {pet.age && pet.gender ? ' · ' : null}
                {pet.gender ? <span className="capitalize">{pet.gender}</span> : null}
              </p>
            )}
            {editMode && (
              <p className="mt-2 text-center text-xs font-medium text-[#FF8C42]">Tap photo to change</p>
            )}
          </div>
        </div>

        <div className="space-y-5 px-3 pb-8 pt-1">
          <section>
            <h3 className="mb-2 px-1 text-[13px] font-semibold uppercase tracking-wide text-gray-500">Basic information</h3>
            <div className={SECTION_CARD}>
              <div className="divide-y divide-gray-100">
                <div className="px-4 py-3.5">
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">Pet name</div>
                  {editMode ? (
                    <input
                      type="text"
                      value={pet.name}
                      onChange={(e) => setPet({ ...pet, name: e.target.value })}
                      className="mt-1.5 w-full border-0 bg-transparent p-0 text-[16px] font-semibold text-gray-900 outline-none ring-0 focus:ring-0"
                    />
                  ) : (
                    <div className="mt-1 text-[16px] font-semibold text-gray-900">{pet.name}</div>
                  )}
                </div>
                <div className="grid grid-cols-2 divide-x divide-gray-100">
                  <div className="px-4 py-3.5">
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">Type</div>
                    <div className="mt-1 text-[16px] font-medium text-gray-900">
                      {petTypeEmoji(pet.type)} {pet.type}
                    </div>
                  </div>
                  <div className="px-4 py-3.5">
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">Gender</div>
                    <div className="mt-1 text-[16px] font-medium capitalize text-gray-900">
                      {pet.gender || 'Not specified'}
                    </div>
                  </div>
                </div>
                <div className="px-4 py-3.5">
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">Breed</div>
                  <div className="mt-1 text-[16px] font-medium text-gray-900">{pet.breed || '—'}</div>
                </div>
                <div className="grid grid-cols-2 divide-x divide-gray-100">
                  <div className="px-4 py-3.5">
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">Age</div>
                    <div className="mt-1 text-[16px] font-medium text-gray-900">{formatAgeLabel(pet.age)}</div>
                  </div>
                  <div className="px-4 py-3.5">
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">Weight</div>
                    <div className="mt-1 text-[16px] font-medium text-gray-900">
                      {pet.weight ? `${pet.weight} kg` : 'Not specified'}
                    </div>
                  </div>
                </div>
                {pet.microchipId ? (
                  <div className="px-4 py-3.5">
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">Microchip ID</div>
                    <div className="mt-1 font-mono text-[15px] font-medium text-gray-900">{pet.microchipId}</div>
                  </div>
                ) : null}
              </div>
            </div>
          </section>

          <section>
            <h3 className="mb-2 px-1 text-[13px] font-semibold uppercase tracking-wide text-gray-500">Health records</h3>
            <div className={SECTION_CARD}>
              <div className="divide-y divide-gray-100">
                <div className="px-4 py-3.5">
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">Last checkup</div>
                  {editMode ? (
                    <input
                      type="date"
                      value={pet.healthRecords?.lastCheckup || ''}
                      onChange={(e) =>
                        setPet({
                          ...pet,
                          healthRecords: { ...pet.healthRecords, lastCheckup: e.target.value },
                        })
                      }
                      className="mt-2 w-full min-h-[44px] rounded-xl border border-gray-200 bg-gray-50/80 px-3 text-[16px] outline-none focus:border-[#FF8C42]"
                    />
                  ) : (
                    <div className="mt-1 text-[16px] font-medium text-gray-900">
                      {pet.healthRecords?.lastCheckup
                        ? new Date(pet.healthRecords.lastCheckup).toLocaleDateString('en-IN', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })
                        : 'Not recorded'}
                    </div>
                  )}
                </div>
                <div className="px-4 py-3.5">
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">Allergies</div>
                  {editMode ? (
                    <textarea
                      value={pet.healthRecords?.allergies || ''}
                      onChange={(e) =>
                        setPet({
                          ...pet,
                          healthRecords: { ...pet.healthRecords, allergies: e.target.value },
                        })
                      }
                      rows={2}
                      className="mt-2 w-full resize-none rounded-xl border border-gray-200 bg-gray-50/80 px-3 py-2.5 text-[16px] outline-none focus:border-[#FF8C42]"
                      placeholder="None"
                    />
                  ) : (
                    <div className="mt-1 text-[16px] font-medium leading-snug text-gray-900">
                      {pet.healthRecords?.allergies || 'None recorded'}
                    </div>
                  )}
                </div>
                <div className="px-4 py-3.5">
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">Current medications</div>
                  {editMode ? (
                    <textarea
                      value={pet.healthRecords?.medications || ''}
                      onChange={(e) =>
                        setPet({
                          ...pet,
                          healthRecords: { ...pet.healthRecords, medications: e.target.value },
                        })
                      }
                      rows={2}
                      className="mt-2 w-full resize-none rounded-xl border border-gray-200 bg-gray-50/80 px-3 py-2.5 text-[16px] outline-none focus:border-[#FF8C42]"
                      placeholder="None"
                    />
                  ) : (
                    <div className="mt-1 text-[16px] font-medium leading-snug text-gray-900">
                      {pet.healthRecords?.medications || 'None recorded'}
                    </div>
                  )}
                </div>
                <div className="px-4 py-3.5">
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">Medical conditions</div>
                  {editMode ? (
                    <textarea
                      value={pet.healthRecords?.conditions || ''}
                      onChange={(e) =>
                        setPet({
                          ...pet,
                          healthRecords: { ...pet.healthRecords, conditions: e.target.value },
                        })
                      }
                      rows={2}
                      className="mt-2 w-full resize-none rounded-xl border border-gray-200 bg-gray-50/80 px-3 py-2.5 text-[16px] outline-none focus:border-[#FF8C42]"
                      placeholder="None"
                    />
                  ) : (
                    <div className="mt-1 text-[16px] font-medium leading-snug text-gray-900">
                      {pet.healthRecords?.conditions || 'None recorded'}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </section>

          <section>
            <h3 className="mb-2 px-1 text-[13px] font-semibold uppercase tracking-wide text-gray-500">Vaccinations</h3>
            <div className={SECTION_CARD}>
              <div className="divide-y divide-gray-100">
                <div className="px-4 py-3.5">
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">Rabies</div>
                  {editMode ? (
                    <input
                      type="date"
                      value={pet.vaccinations?.rabies || ''}
                      onChange={(e) =>
                        setPet({
                          ...pet,
                          vaccinations: { ...pet.vaccinations, rabies: e.target.value },
                        })
                      }
                      className="mt-2 w-full min-h-[44px] rounded-xl border border-gray-200 bg-gray-50/80 px-3 text-[16px] outline-none focus:border-[#FF8C42]"
                    />
                  ) : (
                    <div className="mt-1 text-[16px] font-medium text-gray-900">
                      {pet.vaccinations?.rabies
                        ? new Date(pet.vaccinations.rabies).toLocaleDateString('en-IN', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })
                        : 'Not vaccinated'}
                    </div>
                  )}
                </div>
                <div className="px-4 py-3.5">
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">Distemper</div>
                  {editMode ? (
                    <input
                      type="date"
                      value={pet.vaccinations?.distemper || ''}
                      onChange={(e) =>
                        setPet({
                          ...pet,
                          vaccinations: { ...pet.vaccinations, distemper: e.target.value },
                        })
                      }
                      className="mt-2 w-full min-h-[44px] rounded-xl border border-gray-200 bg-gray-50/80 px-3 text-[16px] outline-none focus:border-[#FF8C42]"
                    />
                  ) : (
                    <div className="mt-1 text-[16px] font-medium text-gray-900">
                      {pet.vaccinations?.distemper
                        ? new Date(pet.vaccinations.distemper).toLocaleDateString('en-IN', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })
                        : 'Not vaccinated'}
                    </div>
                  )}
                </div>
                <div className="px-4 py-3.5">
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">Parvovirus</div>
                  {editMode ? (
                    <input
                      type="date"
                      value={pet.vaccinations?.parvovirus || ''}
                      onChange={(e) =>
                        setPet({
                          ...pet,
                          vaccinations: { ...pet.vaccinations, parvovirus: e.target.value },
                        })
                      }
                      className="mt-2 w-full min-h-[44px] rounded-xl border border-gray-200 bg-gray-50/80 px-3 text-[16px] outline-none focus:border-[#FF8C42]"
                    />
                  ) : (
                    <div className="mt-1 text-[16px] font-medium text-gray-900">
                      {pet.vaccinations?.parvovirus
                        ? new Date(pet.vaccinations.parvovirus).toLocaleDateString('en-IN', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })
                        : 'Not vaccinated'}
                    </div>
                  )}
                </div>
                {pet.vaccinations?.other ? (
                  <div className="px-4 py-3.5">
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">Other</div>
                    <div className="mt-1 text-[16px] font-medium text-gray-900">{pet.vaccinations.other}</div>
                  </div>
                ) : null}
              </div>
            </div>
          </section>

          <section>
            <div className="mb-2 flex items-center justify-between gap-2 px-1">
              <h3 className="text-[13px] font-semibold uppercase tracking-wide text-gray-500">Service bookings</h3>
              <div className="flex shrink-0 items-center gap-2">
                {bookings.length > 0 ? (
                  <span className="rounded-full bg-[#FF8C42] px-2.5 py-0.5 text-[11px] font-semibold text-white">
                    {bookings.length}
                  </span>
                ) : null}
                {onViewPetProfile && pet ? (
                  <button
                    type="button"
                    onClick={() => onViewPetProfile(pet)}
                    className="text-[13px] font-semibold text-[#FF8C42] active:opacity-80"
                  >
                    Full history
                  </button>
                ) : null}
              </div>
            </div>
            {loadingBookings ? (
              <div className={`${SECTION_CARD} flex justify-center py-10`}>
                <div className="h-9 w-9 animate-spin rounded-full border-2 border-[#FF8C42] border-t-transparent" />
              </div>
            ) : bookings.length === 0 ? (
              <div className={`${SECTION_CARD} px-5 py-8 text-center`}>
                <Calendar className="mx-auto mb-3 h-12 w-12 text-gray-300" />
                <p className="text-[15px] font-medium text-gray-700">No bookings yet</p>
                <p className="mt-1 text-[13px] text-gray-500">Book a service for {pet.name}</p>
              </div>
            ) : (
              <div className="space-y-3">
                {bookings.map((booking) => (
                  <button
                    key={booking.id}
                    type="button"
                    onClick={() => onViewBooking && onViewBooking(booking.id, petId)}
                    className="w-full rounded-2xl border border-orange-100/90 bg-gradient-to-br from-orange-50/90 to-rose-50/80 p-4 text-left shadow-sm transition-all active:scale-[0.99]"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h4 className="font-semibold text-gray-800 mb-1">
                          {titleCaseBookingLabel(booking.serviceType, 'Booking')} Service
                        </h4>
                        <p className="text-sm text-gray-600">{booking.vendorName}</p>
                      </div>
                      <span
                        className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                          booking.status === 'active'
                            ? 'bg-green-100 text-green-700'
                            : booking.status === 'completed'
                            ? 'bg-gray-100 text-gray-700'
                            : 'bg-red-100 text-red-700'
                        }`}
                      >
                        {titleCaseBookingLabel(booking.status, 'Pending')}
                      </span>
                    </div>

                    {/* 🔐 OTP DISPLAY - Show prominently for active/confirmed bookings */}
                    {booking.requiresOTP && booking.completionOTP && 
                     booking.status !== 'completed' && booking.status !== 'cancelled' && (
                      <div className="mb-3 p-3 bg-gradient-to-r from-purple-50 to-purple-100 border border-purple-300 rounded-lg">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-semibold text-purple-700 uppercase tracking-wide">🔐 Service OTP</span>
                        </div>
                        <div className="flex items-center justify-center gap-2 mt-1">
                          <span className="text-2xl font-bold text-purple-600 tracking-widest">
                            {booking.completionOTP}
                          </span>
                        </div>
                        <p className="text-xs text-center text-purple-600 mt-1">
                          Share with vendor to complete service
                        </p>
                      </div>
                    )}

                    {booking.status === 'active' && booking.totalSessions && (
                      <div className="mb-3">
                        <div className="flex items-center justify-between text-xs text-gray-600 mb-1">
                          <span>
                            {booking.completedSessions || 0} of {booking.totalSessions} completed
                          </span>
                          <span>
                            {Math.round(((booking.completedSessions || 0) / booking.totalSessions) * 100)}%
                          </span>
                        </div>
                        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-[#FF8C42] to-[#FF6B35]"
                            style={{ width: `${((booking.completedSessions || 0) / booking.totalSessions) * 100}%` }}
                          />
                        </div>
                      </div>
                    )}

                    <div className="flex items-center justify-between text-sm">
                       <div className="flex items-center gap-2 text-gray-600">
                         <Clock className="w-4 h-4" />
                         <span>{(booking.startDate || booking.scheduledDate) ? new Date(booking.startDate || booking.scheduledDate!).toLocaleDateString() : 'Not scheduled'}</span>
                       </div>
                      <div className="flex items-center gap-1 text-[#FF8C42] font-semibold">
                        ₹{booking.price}
                        <ChevronRight className="w-4 h-4" />
                      </div>
                    </div>

                    {booking.status === 'active' && booking.upcomingSessions > 0 && (
                      <div className="mt-2 text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded-md inline-block">
                        {booking.upcomingSessions} upcoming session{booking.upcomingSessions > 1 ? 's' : ''}
                      </div>
                    )}
                  </button>
                ))}
              </div>
            )}
          </section>

          <section className="pb-2">
            <h3 className="mb-2 px-1 text-[13px] font-semibold uppercase tracking-wide text-red-600">Danger zone</h3>
            <div className="rounded-[1.25rem] border border-red-200/90 bg-red-50/90 p-4 shadow-sm ring-1 ring-red-100">
              <p className="text-[14px] leading-snug text-gray-700">
                Deleting {pet.name}&apos;s profile cannot be undone. Booking history stays on your account.
              </p>
              <Button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="mt-4 h-11 w-full rounded-2xl bg-red-600 text-[15px] font-semibold text-white hover:bg-red-700 disabled:opacity-50"
              >
                {deleting ? 'Deleting…' : `Delete ${pet.name}`}
              </Button>
            </div>
          </section>
        </div>
      </div>

      {editMode ? (
        <div className="fixed inset-x-0 bottom-0 z-30 mx-auto w-full max-w-customer border-t border-gray-200/90 bg-white/98 px-4 pt-3 shadow-[0_-10px_40px_rgba(0,0,0,0.08)] backdrop-blur-md pb-[max(0.75rem,env(safe-area-inset-bottom,0px))]">
          <Button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="h-12 w-full rounded-2xl bg-[#FF8C42] text-[16px] font-semibold text-white hover:bg-[#FF7A2E] disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save changes'}
          </Button>
        </div>
      ) : null}
    </div>
  );
}