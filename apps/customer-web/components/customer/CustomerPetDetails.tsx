'use client';

import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { 
  ChevronLeft, Camera, Edit2, Save, X, Calendar, Clock, 
  MapPin, User, Upload, Heart, AlertCircle, Check,
  ChevronRight, Package
} from 'lucide-react';
import { projectId, publicAnonKey } from '@/lib/supabase/info';
import { BookingDetailModal } from './BookingDetailModal';

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

export function CustomerPetDetails({ phone, petId, onBack, onViewBooking, onDelete, onViewPetProfile }: CustomerPetDetailsProps) {
  const [pet, setPet] = useState<Pet | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingBookings, setLoadingBookings] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [photoPreview, setPhotoPreview] = useState<string>('');
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [selectedBookingForModal, setSelectedBookingForModal] = useState<{ bookingId: string; petId: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadPetDetails();
    loadPetBookings();
  }, [phone, petId]);

  const loadPetDetails = async () => {
    try {
      setLoading(true);
      // Fetch specific pet by ID
      const response = await apiClient.get('/customer/endpoint').then(res => res.ok ? res.json() : null){
          headers: { 'Authorization': `Bearer ${publicAnonKey}` }
        }
      );

      if (response.ok) {
        const result = await response.json();
        if (result.success && result.pet) {
          setPet(result.pet);
          setPhotoPreview(result.pet.photo || '');
        }
      } else {
        console.error('Failed to load pet:', response.status);
      }
    } catch (error) {
      console.error('Error loading pet details:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadPetBookings = async () => {
    try {
      setLoadingBookings(true);
      const response = await apiClient.get('/customer/endpoint').then(res => res.ok ? res.json() : null){
          headers: { 'Authorization': `Bearer ${publicAnonKey}` }
        }
      );

      if (response.ok) {
        const result = await response.json();
        // Filter bookings for this specific pet
        const petBookings = (result.bookings || []).filter((b: any) => b.petId === petId);
        setBookings(petBookings);
      }
    } catch (error) {
      console.error('Error loading bookings:', error);
    } finally {
      setLoadingBookings(false);
    }
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && pet) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoPreview(reader.result as string);
        setPet({ ...pet, photo: reader.result as string });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = async () => {
    if (!pet) return;

    setSaving(true);
    try {
      // Load all pets first
      const response = await apiClient.get('/customer/endpoint').then(res => res.ok ? res.json() : null){
          headers: { 'Authorization': `Bearer ${publicAnonKey}` }
        }
      );

      if (response.ok) {
        const result = await response.json();
        
        // ✅ Robust response parsing
        let allPets = [];
        if (Array.isArray(result)) {
          allPets = result;
        } else if (Array.isArray(result.pets)) {
          allPets = result.pets;
        } else if (result.pets?.pets && Array.isArray(result.pets.pets)) {
          allPets = result.pets.pets;
        }
        
        // Update the current pet
        const updatedPets = allPets.map((p: Pet) => p.id === petId ? pet : p);

        // Save back
        const saveResponse = await apiClient.get('/customer/endpoint').then(res => res.ok ? res.json() : null){
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${publicAnonKey}`,
            },
            body: JSON.stringify({
              phone: phone,
              pets: updatedPets,
            }),
          }
        );

        if (!saveResponse.ok) {
          throw new Error('Failed to update pet');
        }

        setEditMode(false);
        alert('Pet profile updated successfully! 🎉');
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
      
      const deleteResponse = await apiClient.get('/customer/endpoint').then(res => res.ok ? res.json() : null){
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`
          }
        }
      );
      
      const deleteData = await deleteResponse.json();
      
      if (!deleteResponse.ok) {
        // Check if it's because of active bookings
        if (deleteData.activeBookingsCount > 0) {
          alert(
            `Cannot delete ${pet.name}'s profile\n\n` +
            `This pet has ${deleteData.activeBookingsCount} active booking(s). ` +
            `Please complete or cancel all active bookings before deleting the pet profile.`
          );
        } else {
          throw new Error(deleteData.error || 'Failed to delete pet');
        }
        return;
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
      <div className="min-h-screen bg-white flex items-center justify-center w-full max-w-[430px] mx-auto">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-[#FF8C42] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading pet details...</p>
        </div>
      </div>
    );
  }

  if (!pet) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center w-full max-w-[430px] mx-auto">
        <div className="text-center px-6">
          <p className="text-gray-600 mb-4">Pet not found</p>
          <Button onClick={onBack} className="bg-[#FF8C42] hover:bg-[#FF7A2E]">
            Go Back
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col w-full max-w-[430px] mx-auto">
      {/* Status Bar */}
      <div className="bg-gradient-to-r from-[#FF8C42] to-[#FF6B35] px-6 pt-3 pb-2 flex justify-between items-center">
        <span className="text-white text-sm font-medium">09:41</span>
        <div className="flex gap-1.5 items-center">
          <svg width="17" height="12" viewBox="0 0 17 12" fill="none">
            <rect y="8" width="3" height="4" rx="0.5" fill="white"/>
            <rect x="4.5" y="5" width="3" height="7" rx="0.5" fill="white"/>
            <rect x="9" y="2" width="3" height="10" rx="0.5" fill="white"/>
            <rect x="13.5" y="0" width="3" height="12" rx="0.5" fill="white"/>
          </svg>
          <svg width="16" height="12" viewBox="0 0 16 12" fill="none">
            <path d="M0.5 7.5C2.5 5.5 5.5 4 8 4C10.5 4 13.5 5.5 15.5 7.5M3.5 10C5 8.5 6.5 8 8 8C9.5 8 11 8.5 12.5 10" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          <svg width="25" height="12" viewBox="0 0 25 12" fill="none">
            <rect x="0.75" y="1.5" width="20" height="9" rx="2" stroke="white" strokeWidth="1.5"/>
            <rect x="2.5" y="3" width="16.5" height="6" rx="1" fill="white"/>
            <rect x="22" y="4" width="2.5" height="4" rx="1" fill="white"/>
          </svg>
        </div>
      </div>

      {/* Header Section with Curved Bottom */}
      <div className="bg-gradient-to-r from-[#FF8C42] to-[#FF6B35] px-6 pb-8">
        <div className="flex items-center justify-between">
          <button onClick={onBack} className="p-2 -ml-2 hover:bg-white/20 rounded-full transition-all">
            <ChevronLeft className="w-6 h-6 text-white" />
          </button>
          <h1 className="text-white font-semibold">{pet.name}'s Profile</h1>
          <button 
            onClick={() => editMode ? setEditMode(false) : setEditMode(true)}
            className="p-2 -mr-2 hover:bg-white/20 rounded-full transition-all"
          >
            {editMode ? (
              <X className="w-6 h-6 text-white" />
            ) : (
              <Edit2 className="w-5 h-5 text-white" />
            )}
          </button>
        </div>
      </div>

      {/* Scrollable Content with Curved Top */}
      <div className="flex-1 bg-white rounded-t-[32px] -mt-6 overflow-y-auto pb-32">
        <div className="px-6 py-6">
          {/* Pet Photo */}
          <div className="flex flex-col items-center mb-8">
            <div 
              onClick={() => editMode && fileInputRef.current?.click()}
              className={`w-32 h-32 bg-orange-100 rounded-full overflow-hidden flex items-center justify-center border-4 border-white shadow-lg mb-3 relative group ${editMode ? 'cursor-pointer' : ''}`}
            >
              {photoPreview ? (
                <>
                  <img src={photoPreview} alt={pet.name} className="w-full h-full object-cover" />
                  {editMode && (
                    <div className="absolute inset-0 bg-black bg-opacity-40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <Camera className="w-8 h-8 text-white" />
                    </div>
                  )}
                </>
              ) : (
                <span className="text-5xl">
                  {pet.type === 'Dog' ? '🐕' : pet.type === 'Cat' ? '🐈' : '🐾'}
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
                Click photo to change
              </p>
            )}
          </div>

          {/* Basic Information */}
          <div className="mb-6">
            <h3 className="text-sm font-medium text-gray-700 mb-4">Basic Information</h3>
            <div className="space-y-4">
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
                  <p className="text-black font-medium px-4 py-3 bg-gray-50 rounded-xl">
                    {pet.name}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-2">
                    Type
                  </label>
                  <p className="text-black font-medium px-4 py-3 bg-gray-50 rounded-xl">
                    {pet.type === 'Dog' ? '🐕 Dog' : pet.type === 'Cat' ? '🐈 Cat' : '🐾 ' + pet.type}
                  </p>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-2">
                    Gender
                  </label>
                  <p className="text-black font-medium px-4 py-3 bg-gray-50 rounded-xl">
                    {pet.gender || 'Not specified'}
                  </p>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-500 mb-2">
                  Breed
                </label>
                <p className="text-black font-medium px-4 py-3 bg-gray-50 rounded-xl">
                  {pet.breed}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-2">
                    Age
                  </label>
                  <p className="text-black font-medium px-4 py-3 bg-gray-50 rounded-xl">
                    {pet.age} {pet.age === '1' ? 'year' : 'years'}
                  </p>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-2">
                    Weight
                  </label>
                  <p className="text-black font-medium px-4 py-3 bg-gray-50 rounded-xl">
                    {pet.weight ? `${pet.weight} kg` : 'Not specified'}
                  </p>
                </div>
              </div>

              {pet.microchipId && (
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-2">
                    Microchip ID
                  </label>
                  <p className="text-black font-medium px-4 py-3 bg-gray-50 rounded-xl font-mono text-sm">
                    {pet.microchipId}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Health Records */}
          <div className="mb-6 pt-6 border-t border-gray-200">
            <h3 className="text-sm font-medium text-gray-700 mb-4">🏥 Health Records</h3>
            <div className="space-y-4">
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
                  <p className="text-black font-medium px-4 py-3 bg-gray-50 rounded-xl">
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
                  <p className="text-black font-medium px-4 py-3 bg-gray-50 rounded-xl">
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
                  <p className="text-black font-medium px-4 py-3 bg-gray-50 rounded-xl">
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
                  <p className="text-black font-medium px-4 py-3 bg-gray-50 rounded-xl">
                    {pet.healthRecords?.conditions || 'None recorded'}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Vaccination Records */}
          <div className="mb-6 pt-6 border-t border-gray-200">
            <h3 className="text-sm font-medium text-gray-700 mb-4">💉 Vaccination Chart</h3>
            <div className="space-y-4">
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
                  <p className="text-black font-medium px-4 py-3 bg-gray-50 rounded-xl">
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
                  <p className="text-black font-medium px-4 py-3 bg-gray-50 rounded-xl">
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
                  <p className="text-black font-medium px-4 py-3 bg-gray-50 rounded-xl">
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
                  <p className="text-black font-medium px-4 py-3 bg-gray-50 rounded-xl">
                    {pet.vaccinations.other}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Service Bookings */}
          <div className="mb-6 pt-6 border-t border-gray-200">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-gray-700">📅 Service Bookings</h3>
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
                          booking.status === 'active' || booking.status === 'confirmed'
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
                        <span>{new Date(booking.startDate || booking.scheduledDate).toLocaleDateString()}</span>
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
          </div>

          {/* Danger Zone - Delete Pet */}
          <div className="mb-6 pt-6 border-t-2 border-red-100">
            <h3 className="text-sm font-medium text-red-600 mb-3">⚠️ Danger Zone</h3>
            <div className="bg-red-50 border border-red-200 rounded-xl p-4">
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
          </div>
        </div>
      </div>

      {/* Fixed Bottom Button */}
      {editMode && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-6 py-4 max-w-[430px] mx-auto w-full">
          <Button
            onClick={handleSave}
            disabled={saving}
            className="w-full h-12 bg-[#FF8C42] hover:bg-[#FF7A2E] rounded-xl text-white disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>

          {/* Home Indicator */}
          <div className="flex justify-center mt-4">
            <div className="w-32 h-1 bg-black rounded-full"></div>
          </div>
        </div>
      )}

      {/* Home Indicator (when not in edit mode) */}
      {!editMode && (
        <div className="fixed bottom-0 left-0 right-0 bg-white px-6 py-4 max-w-[430px] mx-auto w-full">
          <div className="flex justify-center">
            <div className="w-32 h-1 bg-black rounded-full"></div>
          </div>
        </div>
      )}
    </div>
  );
}