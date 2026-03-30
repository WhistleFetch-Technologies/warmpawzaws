'use client';

import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { 
  Camera, Edit2, Save, X, User, Calendar, 
  MessageSquare, Heart, Settings, ChevronRight, Package,
  Clock, MapPin, Star, Bell, CreditCard, HelpCircle, LogOut,
  Copy, Check, Navigation, Route, Timer, TrendingUp, ShoppingCart,
  Home, FileText, Shield, AlertCircle
} from 'lucide-react';
import { BookingDetailModal } from './BookingDetailModal';
import { apiClient } from '@/lib/api-client';
import { EnhancedAddressAutocomplete, AddressComponents } from '@/components/shared/EnhancedAddressAutocomplete';
import { validateEmail, cleanPhone } from '@/lib/validation';
import { coerceCustomerBookingListRow, extractBookingsArray, titleCaseBookingLabel } from '@/lib/customer-booking-normalize';
import { houseNoFloorFromProfilePayload } from '@/lib/normalize-customer-profile-api';
import { inferCityStateFromCommaAddress, mergeStreetAddressLineOnly } from '@/lib/profile-address-format';

interface UserProfile {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  address: string;
  pincode: string;
  houseNo: string;
  floor: string;
  city?: string;
  state?: string;
  photo?: string;
}

interface Booking {
  id: string;
  serviceType: 'walker' | 'grooming' | 'vet' | 'boarding';
  petId: string;
  petName: string;
  petPhoto?: string;
  vendorId: string;
  vendorName: string;
  vendorPhoto?: string;
  startDate: string;
  endDate?: string;
  duration: string;
  frequency: 'single' | 'weekly' | 'monthly';
  schedule: 'morning' | 'evening' | 'anytime';
  sessionsPerDay?: number;
  totalSessions: number;
  completedSessions: number;
  upcomingSessions: number;
  status: 'active' | 'completed' | 'cancelled';
  price: number;
  requiresOTP?: boolean;
  completionOTP?: string;
}

interface CustomerProfileViewProps {
  phone: string;
  onBack: () => void;
  onViewBooking?: (bookingId: string, petId: string) => void;
}

export function UserAccountView({ phone, onBack, onViewBooking }: CustomerProfileViewProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'bookings' | 'profile' | 'complaints' | 'saved' | 'settings'>('bookings');
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [originalProfile, setOriginalProfile] = useState<UserProfile | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [editMode, setEditMode] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingBookings, setLoadingBookings] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [photoPreview, setPhotoPreview] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedBookingForModal, setSelectedBookingForModal] = useState<{ bookingId: string; petId: string } | null>(null);

  useEffect(() => {
    // Slide in animation on mount
    setTimeout(() => setIsOpen(true), 50);
    loadProfile();
    loadBookings();
  }, [phone]);

  const loadProfile = async () => {
    try {
      setLoading(true);
      const result = await apiClient.get<{ profile?: UserProfile & Record<string, unknown> }>(
        `/customer/profile?phone=${phone}`
      );
      console.log('Profile API response:', result);
      if (result.profile) {
        const raw = result.profile as Record<string, unknown>;
        const street =
          typeof result.profile.address === 'string'
            ? result.profile.address
            : '';
        const addressLine = mergeStreetAddressLineOnly({
          address: street,
          city: result.profile.city,
          state: result.profile.state,
        });
        const { houseNo, floor } = houseNoFloorFromProfilePayload(raw);
        const { city: ic, state: ist } = inferCityStateFromCommaAddress(addressLine);
        const next: UserProfile = {
          firstName: result.profile.firstName || '',
          lastName: result.profile.lastName || '',
          email: result.profile.email || '',
          phone: result.profile.phone || phone,
          address: addressLine,
          pincode: result.profile.pincode || '',
          houseNo,
          floor,
          city: ic ?? result.profile.city,
          state: ist ?? result.profile.state,
          photo: result.profile.photo || '',
        };
        setProfile(next);
        setPhotoPreview(result.profile.photo || '');
        setOriginalProfile({ ...next });
      } else {
        setProfile({
          firstName: '',
          lastName: '',
          email: '',
          phone: phone,
          address: '',
          pincode: '',
          houseNo: '',
          floor: '',
          photo: '',
        });
      }
    } catch (error) {
      console.error('Error loading profile:', error);
      setProfile({
        firstName: '',
        lastName: '',
        email: '',
        phone: phone,
        address: '',
        pincode: '',
        houseNo: '',
        floor: '',
        photo: '',
      });
    } finally {
      setLoading(false);
    }
  };

  const loadBookings = async () => {
    try {
      setLoadingBookings(true);
      const result = await apiClient.get<{ bookings?: Booking[] }>(`/customer/bookings?phone=${phone}`);
      const raw = extractBookingsArray(result);
      setBookings(raw.map(coerceCustomerBookingListRow) as Booking[]);
    } catch (error) {
      console.error('Error loading bookings:', error);
    } finally {
      setLoadingBookings(false);
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && profile) {
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
      
      // Upload to S3 with progress tracking
      setUploadingPhoto(true);
      setUploadProgress(0);
      try {
        const { uploadCustomerPhotoWithProgress } = await import('@/lib/photo-upload-enhanced');
        const result = await uploadCustomerPhotoWithProgress(file, phone, {
          onProgress: (progress) => {
            setUploadProgress(progress);
          },
          verifyUpload: true,
          maxRetries: 3,
        });
        
        if (result.success && result.publicUrl) {
          setProfile(prev => prev ? { ...prev, photo: result.publicUrl } : null);
          setPhotoPreview(result.publicUrl || '');
          console.log('✅ Customer photo uploaded to S3:', result.publicUrl);
        } else {
          alert(result.error || 'Failed to upload photo. Please try again.');
          setPhotoPreview(profile?.photo || '');
        }
      } catch (error: any) {
        console.error('Error uploading photo to S3:', error);
        alert(error.message || 'Failed to upload photo. Please try again.');
        setPhotoPreview(profile?.photo || '');
      } finally {
        setUploadingPhoto(false);
        setUploadProgress(0);
      }
    }
  };

  const handleSave = async () => {
    if (!profile) return;

    // Validation
    if (!profile.firstName || !profile.lastName || !profile.email || !profile.address || !profile.pincode) {
      alert('Please fill in all required fields');
      return;
    }

    if (!validateEmail(profile.email)) {
      alert('Please enter a valid email address');
      return;
    }

    if (!/^\d{6}$/.test(profile.pincode)) {
      alert('Please enter a valid 6-digit pincode');
      return;
    }

    setSaving(true);
    try {
      const phoneForApi = cleanPhone(phone) || cleanPhone(profile.phone);
      if (!phoneForApi) {
        alert('Invalid phone number. Please sign in again.');
        return;
      }
      const houseNo = (profile.houseNo ?? '').trim();
      const floor = (profile.floor ?? '').trim();
      const addr = profile.address.trim();
      const { city: inferredCity, state: inferredState } = inferCityStateFromCommaAddress(addr);
      const profileForApi: UserProfile = {
        ...profile,
        address: addr,
        city: inferredCity ?? profile.city,
        state: inferredState ?? profile.state,
        houseNo,
        floor,
        pincode: String(profile.pincode).replace(/\D/g, '').slice(0, 6),
      };
      console.log('Sending profile update:', { houseNo, floor });
      const postRes = await apiClient.post<{ profile?: Record<string, unknown> }>('/customer/profile', {
        phone: phoneForApi,
        profile: profileForApi,
      });
      if (postRes?.profile) {
        const { houseNo: resHouse, floor: resFloor } = houseNoFloorFromProfilePayload(postRes.profile);
        setProfile((prev) =>
          prev
            ? {
                ...prev,
                houseNo: resHouse,
                floor: resFloor,
              }
            : null
        );
      }

      // Show success message
      alert('✅ Profile updated successfully!');
      
      // Reload the profile to ensure we have the latest data
      await loadProfile();
      
      // Exit edit mode
      setEditMode(false);
    } catch (error) {
      console.error('Error saving profile:', error);
      alert(`❌ Error saving profile: ${error instanceof Error ? error.message : 'Network error. Please try again.'}`);
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    if (originalProfile) {
      setProfile(originalProfile);
      setPhotoPreview(originalProfile.photo || '');
    }
    setEditMode(false);
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

  const activeBookings = bookings.filter(b => b.status === 'active');
  const completedBookings = bookings.filter(b => b.status === 'completed');

  return (
    <>
      {/* Header is provided by renderScreenWithLayout wrapper (StandardizedHeader) */}
      
      {/* Tab Navigation */}
      <div className="px-6 pt-4 pb-2">
        <div className="flex gap-2 overflow-x-auto scrollbar-hide -mx-2 px-2">
          <button
            onClick={() => setActiveTab('bookings')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium whitespace-nowrap transition-all ${
              activeTab === 'bookings'
                ? 'bg-[#FF8C42] text-white'
                : 'bg-gray-100 text-gray-700'
            }`}
          >
            <Calendar className="w-4 h-4" />
            My Bookings
          </button>
          <button
            onClick={() => setActiveTab('profile')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium whitespace-nowrap transition-all ${
              activeTab === 'profile'
                ? 'bg-[#FF8C42] text-white'
                : 'bg-gray-100 text-gray-700'
            }`}
          >
            <User className="w-4 h-4" />
            Profile
          </button>
          <button
            onClick={() => setActiveTab('complaints')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium whitespace-nowrap transition-all ${
              activeTab === 'complaints'
                ? 'bg-[#FF8C42] text-white'
                : 'bg-gray-100 text-gray-700'
            }`}
          >
            <MessageSquare className="w-4 h-4" />
            Complaints
          </button>
          <button
            onClick={() => setActiveTab('saved')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium whitespace-nowrap transition-all ${
              activeTab === 'saved'
                ? 'bg-[#FF8C42] text-white'
                : 'bg-gray-100 text-gray-700'
            }`}
          >
            <Heart className="w-4 h-4" />
            Saved
          </button>
          <button
            onClick={() => setActiveTab('settings')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium whitespace-nowrap transition-all ${
              activeTab === 'settings'
                ? 'bg-[#FF8C42] text-white'
                : 'bg-gray-100 text-gray-700'
            }`}
          >
            <Settings className="w-4 h-4" />
            Settings
          </button>
        </div>
      </div>

      {/* Content with Curved Top */}
      <div className="bg-white rounded-t-[32px] -mt-6 px-6 py-6">
        {/* My Bookings Tab */}
        {activeTab === 'bookings' && (
          <div className="space-y-6">
            {/* Stats */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-white rounded-xl p-4 text-center shadow-sm">
                <p className="text-2xl font-bold text-[#FF8C42]">{bookings.length}</p>
                <p className="text-xs text-gray-600 mt-1">Total</p>
              </div>
              <div className="bg-white rounded-xl p-4 text-center shadow-sm">
                <p className="text-2xl font-bold text-green-600">{activeBookings.length}</p>
                <p className="text-xs text-gray-600 mt-1">Active</p>
              </div>
              <div className="bg-white rounded-xl p-4 text-center shadow-sm">
                <p className="text-2xl font-bold text-gray-600">{completedBookings.length}</p>
                <p className="text-xs text-gray-600 mt-1">Completed</p>
              </div>
            </div>

            {/* Bookings List */}
            {loadingBookings ? (
              <div className="text-center py-12">
                <div className="w-12 h-12 border-4 border-[#FF8C42] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                <p className="text-gray-600">Loading bookings...</p>
              </div>
            ) : bookings.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-2xl">
                <div className="w-20 h-20 bg-gray-100 rounded-full mx-auto mb-4 flex items-center justify-center">
                  <Package className="w-10 h-10 text-gray-400" />
                </div>
                <h3 className="text-gray-800 font-semibold mb-2">No Bookings Yet</h3>
                <p className="text-gray-600 text-sm">
                  Your service bookings will appear here
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <h3 className="font-semibold text-gray-800">All Bookings</h3>
                {bookings.map((booking) => (
                  <button
                    key={booking.id}
                    onClick={() => onViewBooking && onViewBooking(booking.id, booking.petId)}
                    className="w-full bg-white border border-gray-200 rounded-2xl p-4 shadow-sm hover:shadow-md transition-all text-left"
                  >
                    <div className="flex gap-4">
                      {/* Service Icon */}
                      <div className="w-14 h-14 bg-gradient-to-br from-orange-100 to-pink-100 rounded-xl flex items-center justify-center text-2xl flex-shrink-0">
                        {getServiceIcon(booking.serviceType)}
                      </div>

                      {/* Booking Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <h3 className="font-bold text-gray-800 mb-1">
                              {titleCaseBookingLabel(booking.serviceType, 'Booking')} Service
                            </h3>
                            <p className="text-sm text-gray-600">
                              {booking.petName} • {booking.vendorName}
                            </p>
                          </div>
                          <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${getStatusColor(booking.status)}`}>
                            {titleCaseBookingLabel(booking.status, 'Pending')}
                          </span>
                        </div>

                        {/* 🔐 OTP DISPLAY */}
                        {booking.requiresOTP && booking.completionOTP && 
                         booking.status !== 'completed' && booking.status !== 'cancelled' && (
                          <div className="mb-3 p-3 bg-gradient-to-r from-orange-50 to-amber-50 border-2 border-orange-300 rounded-xl">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs font-semibold text-orange-700 uppercase tracking-wide">🔐 Service OTP</span>
                            </div>
                            <div className="flex items-center justify-center gap-2 mt-2">
                              <span className="text-3xl font-bold text-orange-600 tracking-widest">
                                {booking.completionOTP}
                              </span>
                            </div>
                            <p className="text-xs text-center text-orange-600 mt-2">
                              Share this OTP with vendor to complete service
                            </p>
                          </div>
                        )}

                        {/* Progress */}
                        {booking.status === 'active' && (
                          <div className="mb-3">
                            <div className="flex items-center justify-between text-xs text-gray-600 mb-1">
                              <span>{booking.completedSessions} of {booking.totalSessions} sessions</span>
                              <span>{Math.round((booking.completedSessions / booking.totalSessions) * 100)}%</span>
                            </div>
                            <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                              <div 
                                className="h-full bg-gradient-to-r from-[#FF8C42] to-[#FF6B35]"
                                style={{ width: `${(booking.completedSessions / booking.totalSessions) * 100}%` }}
                              />
                            </div>
                          </div>
                        )}

                        {/* Details */}
                        <div className="flex items-center gap-3 text-xs text-gray-600">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {new Date(booking.startDate).toLocaleDateString()}
                          </span>
                          <span>•</span>
                          <span className="font-semibold text-[#FF8C42]">₹{booking.price}</span>
                        </div>

                        {booking.status === 'active' && booking.upcomingSessions > 0 && (
                          <div className="mt-2 text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded-md inline-block">
                            {booking.upcomingSessions} upcoming session{booking.upcomingSessions > 1 ? 's' : ''}
                          </div>
                        )}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Profile Tab */}
        {activeTab === 'profile' && (
          <div className="bg-white rounded-2xl p-6 shadow-sm">
            {loading ? (
              <div className="text-center py-12">
                <div className="w-12 h-12 border-4 border-[#FF8C42] border-t-transparent rounded-full animate-spin mx-auto"></div>
              </div>
            ) : !profile ? (
              <p className="text-center text-gray-600">Profile not found</p>
            ) : (
              <>
                {/* Edit Button */}
                <div className="flex justify-end mb-4">
                  {editMode ? (
                    <div className="flex gap-2">
                      <Button
                        onClick={handleCancel}
                        variant="outline"
                        className="gap-2"
                      >
                        <X className="w-4 h-4" />
                        Cancel
                      </Button>
                      <Button
                        onClick={handleSave}
                        disabled={saving}
                        className="bg-[#FF8C42] text-white gap-2"
                      >
                        {saving ? (
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        ) : (
                          <Save className="w-4 h-4" />
                        )}
                        Save
                      </Button>
                    </div>
                  ) : (
                    <Button
                      onClick={() => setEditMode(true)}
                      variant="outline"
                      className="gap-2"
                    >
                      <Edit2 className="w-4 h-4" />
                      Edit Profile
                    </Button>
                  )}
                </div>

                {/* Photo */}
                <div className="flex flex-col items-center mb-6">
                  <div className="relative">
                    <div className="w-24 h-24 rounded-full overflow-hidden bg-gray-200 relative">
                      {photoPreview && !uploadingPhoto ? (
                        <img src={photoPreview} alt="Profile" className="w-full h-full object-cover" />
                      ) : uploadingPhoto ? (
                        <div className="w-full h-full flex flex-col items-center justify-center bg-black bg-opacity-50">
                          <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin mb-1" />
                          <span className="text-white text-[10px]">{uploadProgress}%</span>
                        </div>
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <User className="w-12 h-12 text-gray-400" />
                        </div>
                      )}
                    </div>
                    {editMode && (
                      <>
                        <button
                          onClick={() => !uploadingPhoto && fileInputRef.current?.click()}
                          disabled={uploadingPhoto}
                          className={`absolute bottom-0 right-0 w-8 h-8 bg-[#FF8C42] rounded-full flex items-center justify-center ${uploadingPhoto ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                          {uploadingPhoto ? (
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          ) : (
                            <Camera className="w-4 h-4 text-white" />
                          )}
                        </button>
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/*"
                          onChange={handlePhotoUpload}
                          disabled={uploadingPhoto}
                          className="hidden"
                        />
                      </>
                    )}
                  </div>
                </div>

                {/* Profile Fields */}
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-2">First Name</label>
                      {editMode ? (
                        <input
                          type="text"
                          value={profile.firstName}
                          onChange={(e) => setProfile({ ...profile, firstName: e.target.value })}
                          className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-[#FF8C42] focus:outline-none"
                        />
                      ) : (
                        <p className="text-black font-medium px-4 py-3 bg-gray-50 rounded-xl">{profile.firstName}</p>
                      )}
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-2">Last Name</label>
                      {editMode ? (
                        <input
                          type="text"
                          value={profile.lastName}
                          onChange={(e) => setProfile({ ...profile, lastName: e.target.value })}
                          className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-[#FF8C42] focus:outline-none"
                        />
                      ) : (
                        <p className="text-black font-medium px-4 py-3 bg-gray-50 rounded-xl">{profile.lastName}</p>
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-2">Phone Number</label>
                    <p className="text-black font-medium px-4 py-3 bg-gray-100 rounded-xl">{profile.phone}</p>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-2">Email</label>
                    {editMode ? (
                      <input
                        type="email"
                        value={profile.email}
                        onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                        className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-[#FF8C42] focus:outline-none"
                      />
                    ) : (
                      <p className="text-black font-medium px-4 py-3 bg-gray-50 rounded-xl">{profile.email}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-2">Address</label>
                    {editMode ? (
                      <EnhancedAddressAutocomplete
                        value={profile.address}
                        onChange={(address: string, components?: AddressComponents) => {
                          setProfile(prev => {
                            if (!prev) return null;
                            const updated: UserProfile = { ...prev, address };
                            if (components?.pincode != null && String(components.pincode).trim() !== '') {
                              updated.pincode = String(components.pincode).replace(/\D/g, '').slice(0, 6);
                            }
                            return updated;
                          });
                        }}
                        placeholder="Search address, landmark, city..."
                        className="w-full"
                        required
                      />
                    ) : (
                      <p className="text-black font-medium px-4 py-3 bg-gray-50 rounded-xl">{profile.address}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-2">House No / Flat No</label>
                    {editMode ? (
                      <input
                        type="text"
                        value={profile.houseNo}
                        onChange={(e) => setProfile({ ...profile, houseNo: e.target.value })}
                        placeholder="e.g., A-101, Flat 12B"
                        className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-[#FF8C42] focus:outline-none"
                      />
                    ) : (
                      <p className="text-black font-medium px-4 py-3 bg-gray-50 rounded-xl">
                        {profile.houseNo?.trim() || '-'}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-2">Floor</label>
                    {editMode ? (
                      <input
                        type="text"
                        value={profile.floor}
                        onChange={(e) => setProfile({ ...profile, floor: e.target.value })}
                        placeholder="e.g., 1st Floor"
                        className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-[#FF8C42] focus:outline-none"
                      />
                    ) : (
                      <p className="text-black font-medium px-4 py-3 bg-gray-50 rounded-xl">
                        {profile.floor?.trim() || '-'}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-2">Pincode</label>
                    {editMode ? (
                      <input
                        type="text"
                        value={profile.pincode}
                        onChange={(e) => setProfile({ ...profile, pincode: e.target.value })}
                        maxLength={6}
                        className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-[#FF8C42] focus:outline-none"
                      />
                    ) : (
                      <p className="text-black font-medium px-4 py-3 bg-gray-50 rounded-xl">{profile.pincode}</p>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* Complaints Tab */}
        {activeTab === 'complaints' && (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl p-6 text-center shadow-sm">
              <MessageSquare className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="font-semibold text-gray-800 mb-2">No Complaints</h3>
              <p className="text-sm text-gray-600 mb-4">You haven't raised any complaints yet</p>
              <Button className="bg-[#FF8C42] text-white">
                Raise a Complaint
              </Button>
            </div>
          </div>
        )}

        {/* Saved Items Tab */}
        {activeTab === 'saved' && (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl p-6 text-center shadow-sm">
              <Heart className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="font-semibold text-gray-800 mb-2">No Saved Items</h3>
              <p className="text-sm text-gray-600">Save your favorite products and services</p>
            </div>
          </div>
        )}

        {/* Settings Tab */}
        {activeTab === 'settings' && (
          <div className="space-y-3">
            <button className="w-full flex items-center justify-between p-4 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-all">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-blue-100 to-blue-200 rounded-full flex items-center justify-center">
                  <Bell className="w-5 h-5 text-blue-600" />
                </div>
                <span className="font-medium text-gray-800">Notifications</span>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-400" />
            </button>

            <button className="w-full flex items-center justify-between p-4 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-all">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-green-100 to-green-200 rounded-full flex items-center justify-center">
                  <CreditCard className="w-5 h-5 text-green-600" />
                </div>
                <span className="font-medium text-gray-800">Payment Methods</span>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-400" />
            </button>

            <button className="w-full flex items-center justify-between p-4 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-all">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-purple-100 to-purple-200 rounded-full flex items-center justify-center">
                  <HelpCircle className="w-5 h-5 text-purple-600" />
                </div>
                <span className="font-medium text-gray-800">Help & Support</span>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-400" />
            </button>

            <button className="w-full flex items-center justify-between p-4 bg-white border border-red-200 rounded-xl hover:bg-red-50 transition-all">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-red-100 to-red-200 rounded-full flex items-center justify-center">
                  <LogOut className="w-5 h-5 text-red-600" />
                </div>
                <span className="font-medium text-red-600">Logout</span>
              </div>
              <ChevronRight className="w-5 h-5 text-red-400" />
            </button>
          </div>
        )}
      </div>
    </>
  );
}