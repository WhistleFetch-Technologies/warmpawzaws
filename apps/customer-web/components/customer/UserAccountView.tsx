'use client';

import { useState, useEffect, useRef } from 'react';
import { 
  ChevronLeft, Camera, Edit2, Save, X, User, Calendar, 
  Package, ChevronRight, Heart, Settings, LogOut, FileText,
  ShoppingCart, CreditCard, HelpCircle, Bell, Mail, AlertCircle,
  Wallet, ShoppingBag, Award, Users, MapPin
} from 'lucide-react';
import Image from 'next/image';
import { apiClient } from '@/lib/api-client';

interface UserProfile {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  address: string;
  pincode: string;
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

interface UserAccountViewProps {
  phone: string;
  onBack: () => void;
  onViewBooking?: (bookingId: string, petId: string) => void;
}

export function UserAccountView({ phone, onBack, onViewBooking }: UserAccountViewProps) {
  const [activeTab, setActiveTab] = useState<'bookings' | 'profile' | 'complaints' | 'saved' | 'settings'>('bookings');
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [originalProfile, setOriginalProfile] = useState<UserProfile | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [editMode, setEditMode] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingBookings, setLoadingBookings] = useState(true);
  const [saving, setSaving] = useState(false);
  const [photoPreview, setPhotoPreview] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadProfile();
    loadBookings();
  }, [phone]);

  const loadProfile = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get<{ profile: UserProfile }>(`/customer/profile/${phone}`);
      if (response.profile) {
        setProfile(response.profile);
        setPhotoPreview(response.profile.photo || '');
        setOriginalProfile(response.profile);
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
        photo: ''
      });
    } finally {
      setLoading(false);
    }
  };

  const loadBookings = async () => {
    try {
      setLoadingBookings(true);
      const response = await apiClient.get<{ bookings: Booking[] }>(`/bookings/${phone}`);
      if (response.bookings) {
        setBookings(response.bookings);
      }
    } catch (error) {
      console.error('Error loading bookings:', error);
    } finally {
      setLoadingBookings(false);
    }
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && profile) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoPreview(reader.result as string);
        setProfile({ ...profile, photo: reader.result as string });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSaveProfile = async () => {
    if (!profile) return;

    if (!profile.firstName || !profile.lastName || !profile.email || !profile.address || !profile.pincode) {
      alert('Please fill in all required fields');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(profile.email)) {
      alert('Please enter a valid email address');
      return;
    }

    if (!/^\d{6}$/.test(profile.pincode)) {
      alert('Please enter a valid 6-digit pincode');
      return;
    }

    setSaving(true);
    try {
      await apiClient.post('/customer/profile', {
        phone: phone,
        profile: profile,
      });

      await loadProfile();
      setEditMode(false);
      alert('✅ Profile updated successfully!');
    } catch (error) {
      console.error('Error saving profile:', error);
      alert('❌ Failed to save profile');
    } finally {
      setSaving(false);
    }
  };

  const handleCancelEdit = () => {
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
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={onBack}
            className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm hover:bg-white/30 transition-colors"
          >
            <ChevronLeft className="w-5 h-5 text-white" />
          </button>
          <h2 className="text-white font-bold text-lg">My Account</h2>
          <div className="w-10"></div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab('bookings')}
            className={`flex-1 py-2.5 rounded-lg font-medium transition-all ${
              activeTab === 'bookings'
                ? 'bg-white text-primary'
                : 'bg-white/20 text-white'
            }`}
          >
            My Bookings
          </button>
          <button
            onClick={() => setActiveTab('profile')}
            className={`flex-1 py-2.5 rounded-lg font-medium transition-all ${
              activeTab === 'profile'
                ? 'bg-white text-primary'
                : 'bg-white/20 text-white'
            }`}
          >
            Profile
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'bookings' && (
          <div className="p-6 space-y-4">
            {/* Stats */}
            <div className="grid grid-cols-3 gap-3 mb-6">
              <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-2xl p-4 text-center border border-orange-200">
                <p className="text-3xl font-bold text-primary">{bookings.length}</p>
                <p className="text-xs text-gray-600 mt-1.5">Total</p>
              </div>
              <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-2xl p-4 text-center border border-green-200">
                <p className="text-3xl font-bold text-green-600">{activeBookings.length}</p>
                <p className="text-xs text-gray-600 mt-1.5">Active</p>
              </div>
              <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-2xl p-4 text-center border border-gray-200">
                <p className="text-3xl font-bold text-gray-600">{completedBookings.length}</p>
                <p className="text-xs text-gray-600 mt-1.5">Done</p>
              </div>
            </div>

            {loadingBookings ? (
              <div className="text-center py-12">
                <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                <p className="text-gray-600">Loading bookings...</p>
              </div>
            ) : bookings.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-20 h-20 bg-gray-100 rounded-full mx-auto mb-4 flex items-center justify-center">
                  <Package className="w-10 h-10 text-gray-400" />
                </div>
                <h3 className="text-gray-800 font-semibold mb-2">No Bookings Yet</h3>
                <p className="text-gray-600 text-sm">
                  Your service bookings will appear here
                </p>
              </div>
            ) : (
              bookings.map((booking) => (
                <button
                  key={booking.id}
                  onClick={() => onViewBooking?.(booking.id, booking.petId)}
                  className="w-full bg-white border border-gray-200 rounded-2xl p-4 shadow-sm hover:shadow-md transition-all text-left active:scale-[0.98]"
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
                            {booking.serviceType.charAt(0).toUpperCase() + booking.serviceType.slice(1)} Service
                          </h3>
                          <p className="text-sm text-gray-600">
                            {booking.petName} • {booking.vendorName}
                          </p>
                        </div>
                        <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${getStatusColor(booking.status)}`}>
                          {booking.status.charAt(0).toUpperCase() + booking.status.slice(1)}
                        </span>
                      </div>

                      {/* Progress */}
                      {booking.status === 'active' && (
                        <div className="mb-3">
                          <div className="flex items-center justify-between text-xs text-gray-600 mb-1">
                            <span>{booking.completedSessions} of {booking.totalSessions} sessions</span>
                            <span>{Math.round((booking.completedSessions / booking.totalSessions) * 100)}%</span>
                          </div>
                          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-gradient-to-r from-primary to-primary-dark"
                              style={{ width: `${(booking.completedSessions / booking.totalSessions) * 100}%` }}
                            />
                          </div>
                        </div>
                      )}

                      {/* OTP Display */}
                      {booking.requiresOTP && booking.completionOTP && 
                       booking.status !== 'completed' && booking.status !== 'cancelled' && (
                        <div className="mb-3 p-3 bg-gradient-to-r from-orange-50 to-amber-50 border-2 border-orange-300 rounded-xl">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-semibold text-orange-700 uppercase tracking-wide">🔐 Service OTP</span>
                            <span className="text-xs text-orange-600">Share with vendor</span>
                          </div>
                          <div className="flex items-center justify-center gap-2 mt-2">
                            <span className="text-3xl font-bold text-orange-600 tracking-widest">
                              {booking.completionOTP}
                            </span>
                          </div>
                          <p className="text-xs text-center text-orange-600 mt-2">
                            ⚠️ Share this OTP with the vendor to complete your service
                          </p>
                        </div>
                      )}

                      {/* Details */}
                      <div className="flex items-center gap-3 text-xs text-gray-600">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {new Date(booking.startDate).toLocaleDateString()}
                        </span>
                        <span>•</span>
                        <span className="font-semibold text-primary">₹{booking.price}</span>
                      </div>

                      {booking.status === 'active' && booking.upcomingSessions > 0 && (
                        <div className="mt-2 text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded-md inline-block">
                          {booking.upcomingSessions} upcoming session{booking.upcomingSessions > 1 ? 's' : ''}
                        </div>
                      )}
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        )}

        {activeTab === 'profile' && (
          <div className="p-6 space-y-3">
            {loading ? (
              <div className="text-center py-20">
                <div className="w-14 h-14 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto"></div>
              </div>
            ) : !profile ? (
              <p className="text-center text-gray-600 py-20">Profile not found</p>
            ) : (
              <>
                {/* Edit/Save Buttons */}
                <div className="flex justify-end mb-6">
                  {editMode ? (
                    <div className="flex gap-3 w-full">
                      <button
                        onClick={handleCancelEdit}
                        className="flex-1 h-12 border-2 border-gray-300 rounded-xl text-gray-700 font-medium hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
                      >
                        <X className="w-5 h-5" />
                        Cancel
                      </button>
                      <button
                        onClick={handleSaveProfile}
                        disabled={saving}
                        className="flex-1 h-12 bg-primary hover:bg-primary-dark rounded-xl text-white font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                      >
                        {saving ? (
                          <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        ) : (
                          <Save className="w-5 h-5" />
                        )}
                        Save
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setEditMode(true)}
                      className="h-12 px-6 border-2 border-gray-300 rounded-xl text-gray-700 font-medium hover:bg-gray-50 transition-colors flex items-center gap-2"
                    >
                      <Edit2 className="w-5 h-5" />
                      Edit Profile
                    </button>
                  )}
                </div>

                {/* Photo */}
                <div className="flex flex-col items-center mb-10">
                  <div className="relative">
                    <div className="w-32 h-32 rounded-full overflow-hidden bg-gray-200 border-4 border-white shadow-lg">
                      {photoPreview ? (
                        <img src={photoPreview} alt="Profile" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <User className="w-16 h-16 text-gray-400" />
                        </div>
                      )}
                    </div>
                    {editMode && (
                      <>
                        <button
                          onClick={() => fileInputRef.current?.click()}
                          className="absolute bottom-0 right-0 w-12 h-12 bg-primary rounded-full flex items-center justify-center shadow-lg active:scale-95 transition-transform"
                        >
                          <Camera className="w-6 h-6 text-white" />
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
                </div>

                {/* Profile Fields */}
                <div className="space-y-5">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 mb-2.5">First Name</label>
                      {editMode ? (
                        <input
                          type="text"
                          value={profile.firstName}
                          onChange={(e) => setProfile({ ...profile, firstName: e.target.value })}
                          className="w-full px-4 py-3.5 border-2 border-gray-200 rounded-xl focus:border-primary focus:outline-none"
                        />
                      ) : (
                        <p className="text-black font-medium px-4 py-3.5 bg-gray-50 rounded-xl">{profile.firstName || '-'}</p>
                      )}
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 mb-2.5">Last Name</label>
                      {editMode ? (
                        <input
                          type="text"
                          value={profile.lastName}
                          onChange={(e) => setProfile({ ...profile, lastName: e.target.value })}
                          className="w-full px-4 py-3.5 border-2 border-gray-200 rounded-xl focus:border-primary focus:outline-none"
                        />
                      ) : (
                        <p className="text-black font-medium px-4 py-3.5 bg-gray-50 rounded-xl">{profile.lastName || '-'}</p>
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-2.5">Phone Number</label>
                    <p className="text-black font-medium px-4 py-3.5 bg-gray-100 rounded-xl">{profile.phone}</p>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-2.5">Email</label>
                    {editMode ? (
                      <input
                        type="email"
                        value={profile.email}
                        onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                        className="w-full px-4 py-3.5 border-2 border-gray-200 rounded-xl focus:border-primary focus:outline-none"
                      />
                    ) : (
                      <p className="text-black font-medium px-4 py-3.5 bg-gray-50 rounded-xl">{profile.email || '-'}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-2.5">Address</label>
                    {editMode ? (
                      <textarea
                        value={profile.address}
                        onChange={(e) => setProfile({ ...profile, address: e.target.value })}
                        rows={3}
                        className="w-full px-4 py-3.5 border-2 border-gray-200 rounded-xl focus:border-primary focus:outline-none resize-none"
                      />
                    ) : (
                      <p className="text-black font-medium px-4 py-3.5 bg-gray-50 rounded-xl">{profile.address || '-'}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-2.5">Pincode</label>
                    {editMode ? (
                      <input
                        type="text"
                        value={profile.pincode}
                        onChange={(e) => {
                          const value = e.target.value.replace(/\D/g, '').slice(0, 6);
                          setProfile({ ...profile, pincode: value });
                        }}
                        maxLength={6}
                        className="w-full px-4 py-3.5 border-2 border-gray-200 rounded-xl focus:border-primary focus:outline-none"
                      />
                    ) : (
                      <p className="text-black font-medium px-4 py-3.5 bg-gray-50 rounded-xl">{profile.pincode || '-'}</p>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

