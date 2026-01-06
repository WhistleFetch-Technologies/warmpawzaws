'use client';

import { useState, useEffect, useRef } from 'react';
import { 
  X, ChevronLeft, Camera, Edit2, Save, User, Calendar, 
  Package, ChevronRight, Heart, Settings, LogOut, FileText,
  ShoppingCart, Home, CreditCard, HelpCircle, Bell, Mail, AlertCircle,
  Wallet, ShoppingBag, Award, Users, MapPin, Trash2, Plus, Check, ChevronDown
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
}

interface UserAccountSidebarProps {
  phone: string;
  onClose: () => void;
  onViewBooking?: (bookingId: string, petId: string) => void;
  onViewCustomerProfile?: () => void;
  onViewAppointments?: () => void;
  onViewWallet?: () => void;
  onNavigate?: (path: string) => void;
}

export function UserAccountSidebar({ 
  phone, 
  onClose, 
  onViewBooking, 
  onViewCustomerProfile, 
  onViewAppointments, 
  onViewWallet, 
  onNavigate 
}: UserAccountSidebarProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeView, setActiveView] = useState<'menu' | 'profile' | 'bookings'>('menu');
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [originalProfile, setOriginalProfile] = useState<UserProfile | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingBookings, setLoadingBookings] = useState(true);
  const [saving, setSaving] = useState(false);
  const [photoPreview, setPhotoPreview] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setTimeout(() => setIsOpen(true), 50);
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
    } finally {
      setLoading(false);
    }
  };

  const loadBookings = async () => {
    try {
      setLoadingBookings(true);
      const response = await apiClient.get<{ bookings: Booking[] }>(`/customer/bookings/history/${phone}`);
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

  const handleClose = () => {
    setIsOpen(false);
    setTimeout(onClose, 300);
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

  const menuItems = [
    { icon: User, label: 'My Profile', color: 'from-blue-100 to-blue-200 text-blue-600', view: 'profile' as const },
    { icon: ShoppingBag, label: 'My Orders', color: 'from-orange-100 to-orange-200 text-orange-600', action: 'orders', isExternal: true },
    { icon: Wallet, label: 'My Wallet', color: 'from-emerald-100 to-emerald-200 text-emerald-600', action: 'wallet', isExternal: true },
    { icon: Award, label: 'Rewards & Loyalty', color: 'from-amber-100 to-amber-200 text-amber-600', action: 'rewards-loyalty', isExternal: true },
    { icon: Users, label: 'Refer & Earn', color: 'from-cyan-100 to-cyan-200 text-cyan-600', action: 'referral-system', isExternal: true },
    { icon: Calendar, label: 'My Appointments', color: 'from-purple-100 to-purple-200 text-purple-600', action: 'appointments', isExternal: true },
    { icon: MapPin, label: 'Address Book', color: 'from-green-100 to-green-200 text-green-600', action: 'addresses', isExternal: true },
    { icon: Package, label: 'My Bookings', color: 'from-teal-100 to-teal-200 text-teal-600', view: 'bookings' as const, badge: activeBookings.length },
    { icon: ShoppingCart, label: 'My Cart', color: 'from-pink-100 to-pink-200 text-pink-600', action: 'cart', isExternal: true },
    { icon: Heart, label: 'Saved Items', color: 'from-red-100 to-red-200 text-red-600', action: 'saved', isExternal: true },
    { icon: CreditCard, label: 'Payment Settings', color: 'from-yellow-100 to-yellow-200 text-yellow-600', action: 'payments', isExternal: true },
    { icon: Bell, label: 'Notifications', color: 'from-indigo-100 to-indigo-200 text-indigo-600', action: 'notifications', isExternal: true },
    { icon: HelpCircle, label: 'Help & Support', color: 'from-gray-100 to-gray-200 text-gray-600', action: 'help', isExternal: true },
  ];

  return (
    <div 
      className={`fixed inset-0 bg-gray-50 z-50 transition-transform duration-300 ${
        isOpen ? 'translate-y-0' : 'translate-y-full'
      }`}
    >
      {/* Full Screen Mobile Container */}
      <div className="w-full max-w-[430px] mx-auto h-full bg-white flex flex-col">
        
        {/* Header - Fixed */}
        <div className="bg-gradient-to-r from-primary to-primary-dark px-6 pt-12 pb-6 flex-shrink-0">
          <div className="flex items-center justify-between mb-6">
            <button 
              onClick={handleClose}
              className="w-11 h-11 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm active:scale-95 transition-transform"
            >
              <X className="w-6 h-6 text-white" />
            </button>
            {activeView !== 'menu' && (
              <button 
                onClick={() => {
                  setActiveView('menu');
                  setEditMode(false);
                }}
                className="text-white flex items-center gap-2 active:opacity-70 transition-opacity"
              >
                <ChevronLeft className="w-5 h-5" />
                <span className="font-medium">Back</span>
              </button>
            )}
          </div>

          {/* User Profile Section */}
          {loading ? (
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-white/20 rounded-full animate-pulse"></div>
              <div className="flex-1">
                <div className="h-5 bg-white/20 rounded w-32 mb-2"></div>
                <div className="h-4 bg-white/20 rounded w-24"></div>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-white rounded-full overflow-hidden flex items-center justify-center">
                {photoPreview ? (
                  <img src={photoPreview} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  <User className="w-8 h-8 text-primary" />
                )}
              </div>
              <div>
                <h2 className="text-white font-bold text-lg">
                  {profile?.firstName || 'User'} {profile?.lastName || ''}
                </h2>
                <p className="text-white/90 text-sm">{phone}</p>
              </div>
            </div>
          )}
        </div>

        {/* Scrollable Content Area */}
        <div className="flex-1 overflow-y-auto overscroll-contain relative">
          {activeView === 'menu' && (
            <div className="p-5 space-y-3 pb-8">
              {menuItems.map((item, index) => (
                <button
                  key={index}
                  onClick={() => {
                    if (item.isExternal) {
                      if (item.action === 'appointments' && onViewAppointments) {
                        onViewAppointments();
                        handleClose();
                      } else if (item.action === 'wallet' && onViewWallet) {
                        onViewWallet();
                        handleClose();
                      } else if (item.action && onNavigate) {
                        if (item.action === 'orders') {
                          onNavigate('account/orders');
                        } else if (item.action === 'addresses') {
                          onNavigate('account/addresses');
                        } else {
                          onNavigate(item.action);
                        }
                        handleClose();
                      }
                    } else if (item.view) {
                      setActiveView(item.view);
                    }
                  }}
                  className="w-full flex items-center justify-between p-4 bg-white border border-gray-200 rounded-2xl active:scale-[0.98] active:bg-gray-50 transition-all shadow-sm"
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-14 h-14 bg-gradient-to-br ${item.color} rounded-2xl flex items-center justify-center`}>
                      <item.icon className="w-7 h-7" />
                    </div>
                    <span className="font-semibold text-gray-800 text-[15px]">{item.label}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    {item.badge !== undefined && item.badge > 0 && (
                      <span className="min-w-[26px] h-[26px] px-2 bg-primary text-white rounded-full flex items-center justify-center text-xs font-bold">
                        {item.badge}
                      </span>
                    )}
                    <ChevronRight className="w-5 h-5 text-gray-400" />
                  </div>
                </button>
              ))}

              {/* Logout Button */}
              <button 
                onClick={() => {
                  localStorage.removeItem('customerPhone');
                  localStorage.removeItem('customerAuthToken');
                  localStorage.removeItem('customerId');
                  window.location.href = '/auth';
                }}
                className="w-full flex items-center justify-between p-4 bg-white border-2 border-red-200 rounded-2xl active:scale-[0.98] active:bg-red-50 transition-all shadow-sm mt-6"
              >
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 bg-gradient-to-br from-red-100 to-red-200 rounded-2xl flex items-center justify-center">
                    <LogOut className="w-7 h-7 text-red-600" />
                  </div>
                  <span className="font-semibold text-red-600 text-[15px]">Logout</span>
                </div>
                <ChevronRight className="w-5 h-5 text-red-400" />
              </button>
            </div>
          )}

          {/* Profile View */}
          {activeView === 'profile' && (
            <div className="p-5 pb-32">
              <h3 className="text-2xl font-bold text-gray-800 mb-6">My Profile</h3>
              
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
                          className="flex-1 h-12 border-2 border-gray-300 rounded-xl text-gray-700 font-medium hover:bg-gray-50 transition-colors"
                        >
                          <X className="w-5 h-5 inline mr-2" />
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

          {/* Bookings View */}
          {activeView === 'bookings' && (
            <div className="p-5 pb-8">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-2xl font-bold text-gray-800">My Bookings</h3>
                {onViewCustomerProfile && (
                  <button
                    onClick={() => {
                      onViewCustomerProfile();
                      handleClose();
                    }}
                    className="text-sm text-primary hover:text-primary-dark font-medium flex items-center gap-1"
                  >
                    View Full History
                    <ChevronRight className="w-4 h-4" />
                  </button>
                )}
              </div>
              
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

              {/* Bookings List */}
              {loadingBookings ? (
                <div className="text-center py-20">
                  <div className="w-14 h-14 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                  <p className="text-gray-600">Loading...</p>
                </div>
              ) : bookings.length === 0 ? (
                <div className="text-center py-20 bg-gray-50 rounded-2xl">
                  <Package className="w-20 h-20 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-gray-800 font-semibold text-lg mb-2">No Bookings Yet</h3>
                  <p className="text-gray-600">Your service bookings will appear here</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {bookings.map((booking) => (
                    <button
                      key={booking.id}
                      onClick={() => {
                        onViewBooking && onViewBooking(booking.id, booking.petId);
                        handleClose();
                      }}
                      className="w-full bg-white border border-gray-200 rounded-2xl p-4 shadow-sm active:scale-[0.98] transition-transform text-left"
                    >
                      <div className="flex gap-3">
                        <div className="w-14 h-14 bg-gradient-to-br from-orange-100 to-pink-100 rounded-xl flex items-center justify-center text-2xl flex-shrink-0">
                          {getServiceIcon(booking.serviceType)}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between mb-2">
                            <h4 className="font-bold text-gray-800">
                              {booking.serviceType.charAt(0).toUpperCase() + booking.serviceType.slice(1)}
                            </h4>
                            <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${getStatusColor(booking.status)}`}>
                              {booking.status}
                            </span>
                          </div>
                          <p className="text-sm text-gray-600 mb-3">
                            {booking.petName} • {booking.vendorName}
                          </p>

                          {booking.status === 'active' && (
                            <div className="mb-3">
                              <div className="flex items-center justify-between text-xs text-gray-600 mb-1.5">
                                <span>{booking.completedSessions}/{booking.totalSessions} sessions</span>
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

                          <div className="flex items-center gap-2 text-sm text-gray-600">
                            <span className="font-semibold text-primary">₹{booking.price}</span>
                            <span>•</span>
                            <span>{new Date(booking.startDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>
                          </div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

