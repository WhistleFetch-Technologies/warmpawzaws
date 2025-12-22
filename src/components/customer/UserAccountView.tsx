import React, { useState, useEffect, useRef } from 'react';
import { Button } from '../ui/button';
import { 
  ChevronLeft, Camera, Edit2, Save, X, User, Calendar, 
  MessageSquare, Heart, Settings, ChevronRight, Package,
  Clock, MapPin, Star, Bell, CreditCard, HelpCircle, LogOut,
  Copy, Check, Navigation, Route, Timer, TrendingUp, ShoppingCart,
  Home, FileText, Shield, AlertCircle
} from 'lucide-react';
import { projectId, publicAnonKey } from '../../utils/supabase/info';
import { LOGO_CIRCULAR_ORANGE, WARM_ORANGE } from '../../assets/design-tokens';
import { WarmpawzButton } from '../shared/design-system/WarmpawzButton';

const logoImage = LOGO_CIRCULAR_ORANGE;
import { BookingDetailModal } from './BookingDetailModal';

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
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/customer/profile/${phone}`,
        {
          headers: { 'Authorization': `Bearer ${publicAnonKey}` }
        }
      );

      if (response.ok) {
        const result = await response.json();
        setProfile({
          firstName: result.profile?.firstName || '',
          lastName: result.profile?.lastName || '',
          email: result.profile?.email || '',
          phone: result.profile?.phone || phone,
          address: result.profile?.address || '',
          pincode: result.profile?.pincode || '',
          photo: result.profile?.photo || ''
        });
        setPhotoPreview(result.profile?.photo || '');
        setOriginalProfile({
          firstName: result.profile?.firstName || '',
          lastName: result.profile?.lastName || '',
          email: result.profile?.email || '',
          phone: result.profile?.phone || phone,
          address: result.profile?.address || '',
          pincode: result.profile?.pincode || '',
          photo: result.profile?.photo || ''
        });
      } else {
        setProfile({
          firstName: '',
          lastName: '',
          email: '',
          phone: phone,
          address: '',
          pincode: '',
          photo: ''
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
        photo: ''
      });
    } finally {
      setLoading(false);
    }
  };

  const loadBookings = async () => {
    try {
      setLoadingBookings(true);
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/bookings/${phone}`,
        {
          headers: { 'Authorization': `Bearer ${publicAnonKey}` }
        }
      );

      if (response.ok) {
        const result = await response.json();
        setBookings(result.bookings || []);
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

  const handleSave = async () => {
    if (!profile) return;

    // Validation
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
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/customer/profile`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${publicAnonKey}`,
          },
          body: JSON.stringify({
            phone: phone,
            profile: profile,
          }),
        }
      );

      const result = await response.json();

      if (response.ok) {
        // Show success message
        alert('✅ Profile updated successfully!');
        
        // Reload the profile to ensure we have the latest data
        await loadProfile();
        
        // Exit edit mode
        setEditMode(false);
      } else {
        // Show error message
        alert(`❌ Failed to save profile: ${result.error || 'Unknown error'}`);
        console.error('Save error:', result);
      }
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
    <div className="min-h-screen bg-gray-50 w-full max-w-[430px] mx-auto pb-20">
      {/* Header */}
      <div className="px-6 pt-12 pb-8 sticky top-0 z-20" style={{ background: `linear-gradient(to right, ${WARM_ORANGE}, #FF6B35)` }}>
        <div className="flex items-center gap-4 mb-4">
          <button onClick={onBack} className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm">
            <ChevronLeft className="w-5 h-5 text-white" />
          </button>
          <div className="flex-1">
            <h1 className="text-white text-xl font-bold">My Account</h1>
            <p className="text-white/90 text-sm">{profile?.firstName || 'User'}</p>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex gap-2 overflow-x-auto scrollbar-hide -mx-2 px-2">
          <button
            onClick={() => setActiveTab('bookings')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium whitespace-nowrap transition-all ${
              activeTab === 'bookings' ? 'bg-white' : 'bg-white/20 text-white'
            }`}
            style={{
              color: activeTab === 'bookings' ? WARM_ORANGE : 'white'
            }}
          >
            <Calendar className="w-4 h-4" />
            My Bookings
          </button>
          <button
            onClick={() => setActiveTab('profile')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium whitespace-nowrap transition-all ${
              activeTab === 'profile' ? 'bg-white' : 'bg-white/20 text-white'
            }`}
            style={{
              color: activeTab === 'profile' ? WARM_ORANGE : 'white'
            }}
          >
            <User className="w-4 h-4" />
            Profile
          </button>
          <button
            onClick={() => setActiveTab('complaints')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium whitespace-nowrap transition-all ${
              activeTab === 'complaints' ? 'bg-white' : 'bg-white/20 text-white'
            }`}
            style={{
              color: activeTab === 'complaints' ? WARM_ORANGE : 'white'
            }}
          >
            <MessageSquare className="w-4 h-4" />
            Complaints
          </button>
          <button
            onClick={() => setActiveTab('saved')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium whitespace-nowrap transition-all ${
              activeTab === 'saved' ? 'bg-white' : 'bg-white/20 text-white'
            }`}
            style={{
              color: activeTab === 'saved' ? WARM_ORANGE : 'white'
            }}
          >
            <Heart className="w-4 h-4" />
            Saved
          </button>
          <button
            onClick={() => setActiveTab('settings')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium whitespace-nowrap transition-all ${
              activeTab === 'settings' ? 'bg-white' : 'bg-white/20 text-white'
            }`}
            style={{
              color: activeTab === 'settings' ? WARM_ORANGE : 'white'
            }}
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
                <p className="text-2xl font-bold" style={{ color: WARM_ORANGE }}>{bookings.length}</p>
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
                <div className="w-12 h-12 border-4 border-t-transparent rounded-full animate-spin mx-auto mb-4" style={{ borderColor: `${WARM_ORANGE} ${WARM_ORANGE} ${WARM_ORANGE} transparent` }}></div>
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
                          <span className="font-semibold" style={{ color: WARM_ORANGE }}>₹{booking.price}</span>
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
                        className="gap-2"
                        style={{ backgroundColor: WARM_ORANGE, color: 'white' }}
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
                    <div className="w-24 h-24 rounded-full overflow-hidden bg-gray-200">
                      {photoPreview ? (
                        <img src={photoPreview} alt="Profile" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <User className="w-12 h-12 text-gray-400" />
                        </div>
                      )}
                    </div>
                    {editMode && (
                      <>
                        <button
                          onClick={() => fileInputRef.current?.click()}
                          className="absolute bottom-0 right-0 w-8 h-8 rounded-full flex items-center justify-center"
                          style={{ backgroundColor: WARM_ORANGE }}
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
                          className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none"
                          onFocus={(e) => {
                            e.currentTarget.style.borderColor = WARM_ORANGE;
                            e.currentTarget.style.boxShadow = `0 0 0 3px ${WARM_ORANGE}33`;
                          }}
                          onBlur={(e) => {
                            e.currentTarget.style.borderColor = '#E5E7EB';
                            e.currentTarget.style.boxShadow = 'none';
                          }}
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
                          className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none"
                          onFocus={(e) => {
                            e.currentTarget.style.borderColor = WARM_ORANGE;
                            e.currentTarget.style.boxShadow = `0 0 0 3px ${WARM_ORANGE}33`;
                          }}
                          onBlur={(e) => {
                            e.currentTarget.style.borderColor = '#E5E7EB';
                            e.currentTarget.style.boxShadow = 'none';
                          }}
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
                      <textarea
                        value={profile.address}
                        onChange={(e) => setProfile({ ...profile, address: e.target.value })}
                        rows={3}
                        className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-[#FF8C42] focus:outline-none resize-none"
                      />
                    ) : (
                      <p className="text-black font-medium px-4 py-3 bg-gray-50 rounded-xl">{profile.address}</p>
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
              <WarmpawzButton variant="solid">
                Raise a Complaint
              </WarmpawzButton>
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
    </div>
  );
}