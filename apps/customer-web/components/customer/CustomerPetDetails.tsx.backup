'use client';

import { useState, useEffect, useRef } from 'react';
import { ChevronLeft, Camera, Edit2, Save, X, Calendar, Clock, MapPin, Trash2, AlertCircle, Check } from 'lucide-react';
import Image from 'next/image';
import { apiClient } from '@/lib/api-client';

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
  onDelete?: () => void;
  onViewPetProfile?: (petData: any) => void;
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
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadPetDetails();
    loadPetBookings();
  }, [phone, petId]);

  const loadPetDetails = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get<{ success: boolean; pet: Pet }>(`/pet/${petId}`);
      if (response.success && response.pet) {
        setPet(response.pet);
        setPhotoPreview(response.pet.photo || '');
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
      const response = await apiClient.get<{ bookings: Booking[] }>(`/bookings/${phone}`);
      if (response.bookings) {
        const petBookings = response.bookings.filter((b: any) => b.petId === petId);
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
      const response: any = await apiClient.get(`/customer/pets/${phone}`);
      let allPets: Pet[] = [];
      
      if (Array.isArray(response)) {
        allPets = response;
      } else if (Array.isArray(response.pets)) {
        allPets = response.pets;
      } else if (response.pets?.pets && Array.isArray(response.pets.pets)) {
        allPets = response.pets.pets;
      }

      const updatedPets = allPets.map((p: Pet) => p.id === petId ? pet : p);

      await apiClient.post('/customer/pets', {
        phone: phone,
        pets: updatedPets,
      });

      setEditMode(false);
      alert('Pet profile updated successfully! 🎉');
    } catch (error) {
      console.error('Error saving pet:', error);
      alert('Error saving pet profile. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm(`Are you sure you want to delete ${pet?.name}? This action cannot be undone.`)) {
      return;
    }

    setDeleting(true);
    try {
      const response: any = await apiClient.get(`/customer/pets/${phone}`);
      let allPets: Pet[] = [];
      
      if (Array.isArray(response)) {
        allPets = response;
      } else if (Array.isArray(response.pets)) {
        allPets = response.pets;
      } else if (response.pets?.pets && Array.isArray(response.pets.pets)) {
        allPets = response.pets.pets;
      }

      const updatedPets = allPets.filter((p: Pet) => p.id !== petId);

      await apiClient.post('/customer/pets', {
        phone: phone,
        pets: updatedPets,
      });

      alert('Pet deleted successfully');
      onDelete?.();
    } catch (error) {
      console.error('Error deleting pet:', error);
      alert('Error deleting pet. Please try again.');
    } finally {
      setDeleting(false);
    }
  };

  const getServiceIcon = (type: string) => {
    switch (type) {
      case 'walker': return '🐕';
      case 'grooming': return '✂️';
      case 'vet': return '⚕️';
      case 'boarding': return '🏠';
      default: return '📦';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-700';
      case 'completed': return 'bg-gray-100 text-gray-700';
      case 'cancelled': return 'bg-red-100 text-red-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center w-full max-w-[430px] mx-auto">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading pet details...</p>
        </div>
      </div>
    );
  }

  if (!pet) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center w-full max-w-[430px] mx-auto p-6">
        <div className="text-center">
          <p className="text-gray-600 mb-4">Pet not found</p>
          <button
            onClick={onBack}
            className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white flex flex-col w-full max-w-[430px] mx-auto">
      {/* Status Bar */}
      <div className="px-6 pt-3 pb-2 flex justify-between items-center">
        <span className="text-black text-sm">09:41</span>
        <div className="flex gap-1.5 items-center">
          <svg width="17" height="12" viewBox="0 0 17 12" fill="none">
            <rect y="8" width="3" height="4" rx="0.5" fill="black"/>
            <rect x="4.5" y="5" width="3" height="7" rx="0.5" fill="black"/>
            <rect x="9" y="2" width="3" height="10" rx="0.5" fill="black"/>
            <rect x="13.5" y="0" width="3" height="12" rx="0.5" fill="black"/>
          </svg>
          <svg width="16" height="12" viewBox="0 0 16 12" fill="none">
            <path d="M0.5 7.5C2.5 5.5 5.5 4 8 4C10.5 4 13.5 5.5 15.5 7.5M3.5 10C5 8.5 6.5 8 8 8C9.5 8 11 8.5 12.5 10" stroke="black" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          <svg width="25" height="12" viewBox="0 0 25 12" fill="none">
            <rect x="0.75" y="1.5" width="20" height="9" rx="2" stroke="black" strokeWidth="1.5"/>
            <rect x="2.5" y="3" width="16.5" height="6" rx="1" fill="black"/>
            <rect x="22" y="4" width="2.5" height="4" rx="1" fill="black"/>
          </svg>
        </div>
      </div>

      {/* Header */}
      <div className="bg-gradient-to-r from-primary to-primary-dark px-6 py-6">
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={onBack}
            className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm hover:bg-white/30 transition-colors"
          >
            <ChevronLeft className="w-5 h-5 text-white" />
          </button>
          <h2 className="text-white font-bold text-lg">{pet.name}</h2>
          <div className="w-10"></div>
        </div>

        {/* Pet Photo & Basic Info */}
        <div className="flex items-center gap-4 mb-4">
          <div className="relative">
            <div className="w-20 h-20 rounded-full overflow-hidden bg-white border-4 border-white shadow-lg">
              {photoPreview ? (
                <img src={photoPreview} alt={pet.name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-gray-200">
                  <span className="text-3xl">
                    {pet.type === 'dog' ? '🐕' : pet.type === 'cat' ? '🐈' : '🐾'}
                  </span>
                </div>
              )}
            </div>
            {editMode && (
              <>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute bottom-0 right-0 w-8 h-8 bg-primary rounded-full flex items-center justify-center shadow-lg active:scale-95 transition-transform"
                >
                  <Camera className="w-4 h-4 text-white" />
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoUpload}
                  className="hidden"
                />
              </>
            )}
          </div>
          <div className="flex-1 text-white">
            <h3 className="text-xl font-bold">{pet.name}</h3>
            <p className="text-white/90 text-sm">{pet.breed}</p>
            <div className="flex items-center gap-2 mt-1 text-xs text-white/80">
              <span>{pet.age}</span>
              {pet.gender && <span>• {pet.gender}</span>}
              {pet.weight && <span>• {pet.weight}</span>}
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2">
          {editMode ? (
            <>
              <button
                onClick={() => setEditMode(false)}
                className="flex-1 py-2 bg-white/20 rounded-lg text-white font-medium hover:bg-white/30 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 py-2 bg-white rounded-lg text-primary font-medium hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {saving ? (
                  <>
                    <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    Save
                  </>
                )}
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => setEditMode(true)}
                className="flex-1 py-2 bg-white/20 rounded-lg text-white font-medium hover:bg-white/30 transition-colors flex items-center justify-center gap-2"
              >
                <Edit2 className="w-4 h-4" />
                Edit
              </button>
              {onViewPetProfile && (
                <button
                  onClick={() => onViewPetProfile(pet)}
                  className="flex-1 py-2 bg-white/20 rounded-lg text-white font-medium hover:bg-white/30 transition-colors"
                >
                  Full Profile
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto pb-32">
        <div className="px-6 py-6 space-y-6">
          {/* Pet Details */}
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-200">
            <h3 className="font-bold text-gray-900 mb-4">Pet Information</h3>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-2">Type</label>
                  {editMode ? (
                    <select
                      value={pet.type}
                      onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setPet({ ...pet, type: e.target.value })}
                      className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-xl focus:border-primary focus:outline-none"
                    >
                      <option value="Dog">Dog</option>
                      <option value="Cat">Cat</option>
                      <option value="Bird">Bird</option>
                      <option value="Rabbit">Rabbit</option>
                      <option value="Other">Other</option>
                    </select>
                  ) : (
                    <p className="text-gray-900 font-medium px-4 py-2.5 bg-gray-50 rounded-xl">{pet.type}</p>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-2">Breed</label>
                  {editMode ? (
                    <input
                      type="text"
                      value={pet.breed}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPet({ ...pet, breed: e.target.value })}
                      className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-xl focus:border-primary focus:outline-none"
                    />
                  ) : (
                    <p className="text-gray-900 font-medium px-4 py-2.5 bg-gray-50 rounded-xl">{pet.breed}</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-2">Age</label>
                  {editMode ? (
                    <input
                      type="text"
                      value={pet.age}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPet({ ...pet, age: e.target.value })}
                      placeholder="e.g., 2 years"
                      className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-xl focus:border-primary focus:outline-none"
                    />
                  ) : (
                    <p className="text-gray-900 font-medium px-4 py-2.5 bg-gray-50 rounded-xl">{pet.age}</p>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-2">Gender</label>
                  {editMode ? (
                    <select
                      value={pet.gender}
                      onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setPet({ ...pet, gender: e.target.value })}
                      className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-xl focus:border-primary focus:outline-none"
                    >
                      <option value="">Select</option>
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                    </select>
                  ) : (
                    <p className="text-gray-900 font-medium px-4 py-2.5 bg-gray-50 rounded-xl">{pet.gender || '-'}</p>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-2">Weight</label>
                {editMode ? (
                  <input
                    type="text"
                    value={pet.weight}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPet({ ...pet, weight: e.target.value })}
                    placeholder="e.g., 15 kg"
                    className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-xl focus:border-primary focus:outline-none"
                  />
                ) : (
                  <p className="text-gray-900 font-medium px-4 py-2.5 bg-gray-50 rounded-xl">{pet.weight || '-'}</p>
                )}
              </div>

              {pet.microchipId && (
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-2">Microchip ID</label>
                  <p className="text-gray-900 font-medium px-4 py-2.5 bg-gray-50 rounded-xl">{pet.microchipId}</p>
                </div>
              )}
            </div>
          </div>

          {/* Bookings Section */}
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-200">
            <h3 className="font-bold text-gray-900 mb-4">Recent Bookings</h3>
            {loadingBookings ? (
              <div className="text-center py-8">
                <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                <p className="text-gray-600 text-sm">Loading...</p>
              </div>
            ) : bookings.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-600 text-sm">No bookings yet</p>
              </div>
            ) : (
              <div className="space-y-3">
                {bookings.slice(0, 3).map((booking) => (
                  <button
                    key={booking.id}
                    onClick={() => onViewBooking?.(booking.id, petId)}
                    className="w-full bg-gray-50 rounded-xl p-4 hover:bg-gray-100 transition-colors text-left"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-gradient-to-br from-orange-100 to-pink-100 rounded-xl flex items-center justify-center text-xl">
                        {getServiceIcon(booking.serviceType)}
                      </div>
                      <div className="flex-1">
                        <h4 className="font-semibold text-gray-900">{booking.serviceType}</h4>
                        <p className="text-sm text-gray-600">{booking.vendorName}</p>
                        <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
                          <Calendar className="w-3 h-3" />
                          <span>{new Date(booking.startDate).toLocaleDateString()}</span>
                        </div>
                      </div>
                      <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${getStatusColor(booking.status)}`}>
                        {booking.status}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Delete Button */}
          {!editMode && (
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="w-full py-3 bg-red-50 border-2 border-red-200 rounded-xl text-red-600 font-medium hover:bg-red-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {deleting ? (
                <>
                  <div className="w-4 h-4 border-2 border-red-600 border-t-transparent rounded-full animate-spin"></div>
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4" />
                  Delete Pet
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

