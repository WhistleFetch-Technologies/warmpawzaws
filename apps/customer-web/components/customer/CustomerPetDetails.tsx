'use client';

import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { 
  Camera, Edit2, X, Calendar, Clock, 
  AlertCircle, ChevronRight, ArrowLeft
} from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { ApiError } from '@/lib/error-handling';
import { PresignableImage } from '@/components/shared/PresignableImage';
import { fetchPetById } from '@/lib/fetch-customer-pet';

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
      setBookingsLoadError(null);
      const data = await apiClient.get(`/customer/${phone}/pets/${petId}/bookings`) as any;
      const rows = data?.bookings || [];
      setBookings(rows.map(mapPetBookingFromApi));
    } catch (error) {
      console.error('Error loading bookings:', error);
      setBookings([]);
      setBookingsLoadError('Could not load bookings. Please try again in a moment.');
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
          error?: string;
        } | null;
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

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[200px]">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-[#FF8C42] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading pet details...</p>
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
      <div className="flex items-center justify-center min-h-[200px]">
        <div className="text-center px-6">
          {loading ? (
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500 mx-auto" />
          ) : (
            <>
              <p className="text-gray-600 mb-4">Pet not found</p>
              <Button onClick={onBack} className="bg-[#FF8C42] hover:bg-[#FF7A2E]">
                Go Back
              </Button>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-screen-dynamic w-full max-w-customer flex-col bg-slate-100">
      {/* App-style top bar (narrow column, not full-bleed web) */}
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-slate-200/80 bg-white pb-2 shadow-sm cw-header-safe-top cw-header-safe-x">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onBack}
          className="h-11 min-h-[44px] shrink-0 gap-1 px-1 text-gray-800"
        >
          <ArrowLeft className="h-5 w-5" />
          <span className="font-medium">Back</span>
        </Button>
        <button
          type="button"
          onClick={() => (editMode ? setEditMode(false) : setEditMode(true))}
          className="inline-flex h-11 min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-full transition-colors hover:bg-slate-100 active:bg-slate-200"
          aria-label={editMode ? 'Close edit' : 'Edit pet'}
        >
          {editMode ? (
            <X className="h-5 w-5 text-gray-700" />
          ) : (
            <Edit2 className="h-5 w-5 text-gray-700" />
          )}
        </button>
      </div>

      {/* Scrollable body — grouped cards on canvas like native settings */}
      <div className="min-h-0 flex-1 overflow-y-auto pb-28 pt-3">
        <div className="space-y-3 px-3 pb-[max(1.25rem,env(safe-area-inset-bottom,0px))] sm:px-4">
          {/* Pet Photo */}
          <div className="flex flex-col items-center rounded-2xl border border-slate-100 bg-white px-4 py-6 shadow-sm">
            <div 
              onClick={() => editMode && fileInputRef.current?.click()}
              className={`w-32 h-32 bg-orange-100 rounded-full overflow-hidden flex items-center justify-center border-4 border-white shadow-lg mb-3 relative group ${editMode ? 'cursor-pointer' : ''}`}
            >
              {photoPreview ? (
                <>
                  <PresignableImage
                    src={photoPreview}
                    alt={pet?.name || 'Pet'}
                    className="w-full h-full object-cover"
                  />
                  {editMode && (
                    <div className="absolute inset-0 bg-black bg-opacity-40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <Camera className="w-8 h-8 text-white" />
                    </div>
                  )}
                </>
              ) : (
                <span className="text-5xl" aria-hidden>
                  {petTypeEmoji(pet.type)}
                </span>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handlePhotoUpload}
              className="hidden"
            />
            {editMode && (
              <p className="text-xs text-gray-500 text-center">
                Tap photo to change
              </p>
            )}
          </div>

          <section className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm sm:p-5">
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Basic information
            </h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-2">
                  Pet Name
                </label>
                {editMode ? (
                  <input
                    type="text"
                    value={pet.name}
                    onChange={(e) => setPet({ ...pet, name: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-[#FF8C42] focus:outline-none"
                  />
                ) : (
                  <p className="rounded-xl border border-slate-100 bg-slate-50/90 px-3.5 py-3 text-[15px] font-medium text-slate-900">
                    {pet.name}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-2">
                    Type
                  </label>
                  <p className="rounded-xl border border-slate-100 bg-slate-50/90 px-3.5 py-3 text-[15px] font-medium text-slate-900">
                    {petTypeEmoji(pet.type)} {pet.type}
                  </p>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-2">
                    Gender
                  </label>
                  <p className="rounded-xl border border-slate-100 bg-slate-50/90 px-3.5 py-3 text-[15px] font-medium text-slate-900">
                    {pet.gender || 'Not specified'}
                  </p>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-500 mb-2">
                  Breed
                </label>
                <p className="rounded-xl border border-slate-100 bg-slate-50/90 px-3.5 py-3 text-[15px] font-medium text-slate-900">
                  {pet.breed}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-2">
                    Age
                  </label>
                  <p className="rounded-xl border border-slate-100 bg-slate-50/90 px-3.5 py-3 text-[15px] font-medium text-slate-900">
                    {pet.age} {pet.age === '1' ? 'year' : 'years'}
                  </p>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-2">
                    Weight
                  </label>
                  <p className="rounded-xl border border-slate-100 bg-slate-50/90 px-3.5 py-3 text-[15px] font-medium text-slate-900">
                    {pet.weight ? `${pet.weight} kg` : 'Not specified'}
                  </p>
                </div>
              </div>

              {pet.microchipId && (
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-2">
                    Microchip ID
                  </label>
                  <p className="rounded-xl border border-slate-100 bg-slate-50/90 px-3.5 py-3 font-mono text-sm font-medium text-slate-900">
                    {pet.microchipId}
                  </p>
                </div>
              )}
            </div>
          </section>

          <section className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm sm:p-5">
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Health records
            </h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-2">
                  Last Checkup
                </label>
                {editMode ? (
                  <input
                    type="date"
                    value={pet.healthRecords?.lastCheckup || ''}
                    onChange={(e) => setPet({
                      ...pet,
                      healthRecords: { ...pet.healthRecords, lastCheckup: e.target.value }
                    })}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-[#FF8C42] focus:outline-none"
                  />
                ) : (
                  <p className="rounded-xl border border-slate-100 bg-slate-50/90 px-3.5 py-3 text-[15px] font-medium text-slate-900">
                    {pet.healthRecords?.lastCheckup 
                      ? new Date(pet.healthRecords.lastCheckup).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                      : 'Not recorded'}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-500 mb-2">
                  Allergies
                </label>
                {editMode ? (
                  <textarea
                    value={pet.healthRecords?.allergies || ''}
                    onChange={(e) => setPet({
                      ...pet,
                      healthRecords: { ...pet.healthRecords, allergies: e.target.value }
                    })}
                    rows={2}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-[#FF8C42] focus:outline-none resize-none"
                    placeholder="None"
                  />
                ) : (
                  <p className="rounded-xl border border-slate-100 bg-slate-50/90 px-3.5 py-3 text-[15px] font-medium text-slate-900">
                    {pet.healthRecords?.allergies || 'None recorded'}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-500 mb-2">
                  Current Medications
                </label>
                {editMode ? (
                  <textarea
                    value={pet.healthRecords?.medications || ''}
                    onChange={(e) => setPet({
                      ...pet,
                      healthRecords: { ...pet.healthRecords, medications: e.target.value }
                    })}
                    rows={2}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-[#FF8C42] focus:outline-none resize-none"
                    placeholder="None"
                  />
                ) : (
                  <p className="rounded-xl border border-slate-100 bg-slate-50/90 px-3.5 py-3 text-[15px] font-medium text-slate-900">
                    {pet.healthRecords?.medications || 'None recorded'}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-500 mb-2">
                  Medical Conditions
                </label>
                {editMode ? (
                  <textarea
                    value={pet.healthRecords?.conditions || ''}
                    onChange={(e) => setPet({
                      ...pet,
                      healthRecords: { ...pet.healthRecords, conditions: e.target.value }
                    })}
                    rows={2}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-[#FF8C42] focus:outline-none resize-none"
                    placeholder="None"
                  />
                ) : (
                  <p className="rounded-xl border border-slate-100 bg-slate-50/90 px-3.5 py-3 text-[15px] font-medium text-slate-900">
                    {pet.healthRecords?.conditions || 'None recorded'}
                  </p>
                )}
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm sm:p-5">
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Vaccination chart
            </h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-2">
                  Rabies Vaccine
                </label>
                {editMode ? (
                  <input
                    type="date"
                    value={pet.vaccinations?.rabies || ''}
                    onChange={(e) => setPet({
                      ...pet,
                      vaccinations: { ...pet.vaccinations, rabies: e.target.value }
                    })}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-[#FF8C42] focus:outline-none"
                  />
                ) : (
                  <p className="rounded-xl border border-slate-100 bg-slate-50/90 px-3.5 py-3 text-[15px] font-medium text-slate-900">
                    {pet.vaccinations?.rabies 
                      ? new Date(pet.vaccinations.rabies).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                      : 'Not vaccinated'}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-500 mb-2">
                  Distemper Vaccine
                </label>
                {editMode ? (
                  <input
                    type="date"
                    value={pet.vaccinations?.distemper || ''}
                    onChange={(e) => setPet({
                      ...pet,
                      vaccinations: { ...pet.vaccinations, distemper: e.target.value }
                    })}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-[#FF8C42] focus:outline-none"
                  />
                ) : (
                  <p className="rounded-xl border border-slate-100 bg-slate-50/90 px-3.5 py-3 text-[15px] font-medium text-slate-900">
                    {pet.vaccinations?.distemper 
                      ? new Date(pet.vaccinations.distemper).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                      : 'Not vaccinated'}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-500 mb-2">
                  Parvovirus Vaccine
                </label>
                {editMode ? (
                  <input
                    type="date"
                    value={pet.vaccinations?.parvovirus || ''}
                    onChange={(e) => setPet({
                      ...pet,
                      vaccinations: { ...pet.vaccinations, parvovirus: e.target.value }
                    })}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-[#FF8C42] focus:outline-none"
                  />
                ) : (
                  <p className="rounded-xl border border-slate-100 bg-slate-50/90 px-3.5 py-3 text-[15px] font-medium text-slate-900">
                    {pet.vaccinations?.parvovirus 
                      ? new Date(pet.vaccinations.parvovirus).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                      : 'Not vaccinated'}
                  </p>
                )}
              </div>

              {pet.vaccinations?.other && (
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-2">
                    Other Vaccinations
                  </label>
                  <p className="rounded-xl border border-slate-100 bg-slate-50/90 px-3.5 py-3 text-[15px] font-medium text-slate-900">
                    {pet.vaccinations.other}
                  </p>
                </div>
              )}
            </div>
          </section>

          <section className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm sm:p-5">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Service bookings
              </h3>
              <div className="flex items-center gap-2">
                {bookings.length > 0 && (
                  <span className="text-xs bg-[#FF8C42] text-white px-2 py-1 rounded-full">
                    {bookings.length}
                  </span>
                )}
                {onViewPetProfile && pet && (
                  <button
                    onClick={() => onViewPetProfile(pet)}
                    className="text-xs text-[#FF8C42] hover:text-[#FF7029] font-medium"
                  >
                    View Full History →
                  </button>
                )}
              </div>
            </div>
            {loadingBookings ? (
              <div className="text-center py-6">
                <div className="w-8 h-8 border-2 border-[#FF8C42] border-t-transparent rounded-full animate-spin mx-auto"></div>
              </div>
            ) : bookingsLoadError ? (
              <div className="rounded-xl border border-amber-100 bg-amber-50 p-6 text-center">
                <AlertCircle className="mx-auto mb-3 h-12 w-12 text-amber-600" />
                <p className="text-sm text-gray-800">{bookingsLoadError}</p>
              </div>
            ) : bookings.length === 0 ? (
              <div className="bg-gray-50 rounded-xl p-6 text-center">
                <Calendar className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                <p className="text-gray-600 text-sm">No bookings yet</p>
                <p className="text-gray-500 text-xs mt-1">Book services for {pet.name}</p>
              </div>
            ) : (
              <div className="space-y-3">
                {bookings.map((booking) => (
                  <button
                    key={booking.id}
                    onClick={() => onViewBooking && onViewBooking(booking.id, petId)}
                    className="w-full bg-gradient-to-br from-orange-50 to-pink-50 rounded-xl p-4 border border-orange-100 text-left hover:shadow-md transition-all"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h4 className="font-semibold text-gray-800 mb-1">
                          {booking.serviceType.charAt(0).toUpperCase() + booking.serviceType.slice(1)} Service
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
                        {booking.status.charAt(0).toUpperCase() + booking.status.slice(1)}
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

          <section className="rounded-2xl border border-red-100 bg-white p-4 shadow-sm sm:p-5">
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-red-600">
              Danger zone
            </h3>
            <div className="rounded-xl border border-red-200 bg-red-50 p-4">
              <p className="text-sm text-gray-700 mb-3">
                Once you delete {pet.name}'s profile, it cannot be undone. Booking history will be preserved.
              </p>
              <Button
                onClick={handleDelete}
                disabled={deleting}
                className="w-full h-10 bg-red-600 hover:bg-red-700 rounded-xl text-white disabled:opacity-50"
              >
                {deleting ? 'Deleting...' : `Delete ${pet.name}'s Profile`}
              </Button>
            </div>
          </section>
        </div>
      </div>

      {editMode && (
        <div className="pointer-events-none fixed inset-x-0 bottom-0 z-20 flex justify-center">
          <div className="pointer-events-auto w-full max-w-customer border-t border-slate-200 bg-white px-4 pt-3 shadow-[0_-8px_30px_rgba(0,0,0,0.06)] pb-[max(0.75rem,env(safe-area-inset-bottom,0px))] sm:px-5">
            <Button
              onClick={handleSave}
              disabled={saving}
              className="h-12 w-full rounded-xl bg-[#FF8C42] text-white hover:bg-[#FF7A2E] disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save changes'}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}