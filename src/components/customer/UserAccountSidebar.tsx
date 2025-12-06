import { useState, useEffect, useRef } from 'react';
import { Button } from '../ui/button';
import { 
  ChevronLeft, Camera, Edit2, Save, X, User, Calendar, 
  MessageSquare, Heart, Settings, ChevronRight, Package,
  Clock, MapPin, Star, Bell, CreditCard, HelpCircle, LogOut,
  ShoppingCart, Home as HomeIcon, FileText, Shield, AlertCircle, Mail,
  Trash2, Plus, Check, ChevronDown, ArrowRight, Wallet, ShoppingBag
} from 'lucide-react';
import { projectId, publicAnonKey } from '../../utils/supabase/info';

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

interface CartItem {
  itemId: string;
  type: 'product' | 'service';
  name: string;
  price: number;
  quantity: number;
  photo?: string;
  vendorId?: string;
  details?: any;
}

interface SavedItem {
  itemId: string;
  type: 'product' | 'service' | 'vendor';
  name: string;
  photo?: string;
  savedAt: string;
  details?: any;
}

interface Address {
  id: string;
  label: string;
  name: string;
  phone: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  pincode: string;
  landmark?: string;
  coordinates?: { lat: number; lng: number };
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

interface PaymentMethod {
  id: string;
  type: 'card' | 'upi' | 'netbanking';
  cardNumber?: string;
  cardHolderName?: string;
  expiryMonth?: string;
  expiryYear?: string;
  cardType?: 'visa' | 'mastercard' | 'rupay' | 'amex';
  upiId?: string;
  bankName?: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

interface NotificationSettings {
  push: boolean;
  email: boolean;
  sms: boolean;
  bookingUpdates: boolean;
  promotions: boolean;
  newServices: boolean;
  newsletter: boolean;
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

export function UserAccountSidebar({ phone, onClose, onViewBooking, onViewCustomerProfile, onViewAppointments, onViewWallet, onNavigate }: UserAccountSidebarProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeView, setActiveView] = useState<'menu' | 'profile' | 'bookings' | 'cart' | 'saved' | 'addresses' | 'payments' | 'notifications' | 'help'>('menu');
  
  // Profile states
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [originalProfile, setOriginalProfile] = useState<UserProfile | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [photoPreview, setPhotoPreview] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Bookings states
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loadingBookings, setLoadingBookings] = useState(true);
  
  // Cart states
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [loadingCart, setLoadingCart] = useState(true);
  const [cartTotal, setCartTotal] = useState(0);
  
  // Saved items states
  const [savedItems, setSavedItems] = useState<SavedItem[]>([]);
  const [loadingSaved, setLoadingSaved] = useState(true);
  
  // Address states
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [loadingAddresses, setLoadingAddresses] = useState(true);
  const [showAddressForm, setShowAddressForm] = useState(false);
  const [editingAddress, setEditingAddress] = useState<Address | null>(null);
  
  // Payment states
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [loadingPayments, setLoadingPayments] = useState(true);
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [newPayment, setNewPayment] = useState({
    type: 'card' as 'card' | 'upi' | 'netbanking',
    cardNumber: '',
    cardHolderName: '',
    expiryMonth: '',
    expiryYear: '',
    cvv: '',
    cardType: 'visa' as 'visa' | 'mastercard' | 'rupay' | 'amex',
    upiId: '',
    bankName: '',
    isDefault: false
  });
  
  // Notification states
  const [notificationSettings, setNotificationSettings] = useState<NotificationSettings>({
    push: true,
    email: false,
    sms: true,
    bookingUpdates: true,
    promotions: true,
    newServices: false,
    newsletter: false
  });
  const [loadingNotifications, setLoadingNotifications] = useState(true);
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showScrollIndicator, setShowScrollIndicator] = useState(true);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setTimeout(() => setIsOpen(true), 50);
    loadProfile();
    loadBookings();
  }, [phone]);

  // Handle scroll to hide indicator
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      if (container.scrollTop > 50) {
        setShowScrollIndicator(false);
      } else {
        setShowScrollIndicator(true);
      }
    };

    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, []);

  // Reset scroll indicator when view changes
  useEffect(() => {
    setShowScrollIndicator(true);
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = 0;
    }
  }, [activeView]);

  useEffect(() => {
    if (activeView === 'cart') loadCart();
    if (activeView === 'saved') loadSaved();
    if (activeView === 'addresses') loadAddresses();
    if (activeView === 'payments') loadPayments();
    if (activeView === 'notifications') loadNotificationSettings();
    if (activeView === 'bookings') loadBookings(); // Reload bookings when viewing bookings tab
  }, [activeView]);

  // ============================================
  // PROFILE FUNCTIONS
  // ============================================
  
  const loadProfile = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/customer/profile/${phone}`,
        { headers: { 'Authorization': `Bearer ${publicAnonKey}` } }
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
      }
    } catch (error) {
      console.error('Error loading profile:', error);
    } finally {
      setLoading(false);
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
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/customer/profile`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${publicAnonKey}`,
          },
          body: JSON.stringify({ phone: phone, profile: profile }),
        }
      );

      const result = await response.json();

      if (response.ok) {
        alert('✅ Profile updated successfully!');
        await loadProfile();
        setEditMode(false);
      } else {
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

  const handleCancelEdit = () => {
    if (originalProfile) {
      setProfile(originalProfile);
      setPhotoPreview(originalProfile.photo || '');
    }
    setEditMode(false);
  };

  // ============================================
  // BOOKINGS FUNCTIONS
  // ============================================
  
  const loadBookings = async () => {
    try {
      setLoadingBookings(true);
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/customer/bookings/history/${phone}`,
        { headers: { 'Authorization': `Bearer ${publicAnonKey}` } }
      );

      if (response.ok) {
        const result = await response.json();
        console.log('📚 [CUSTOMER-PROFILE] Loaded bookings:', result);
        setBookings(result.bookings || []);
      }
    } catch (error) {
      console.error('Error loading bookings:', error);
    } finally {
      setLoadingBookings(false);
    }
  };

  // ============================================
  // CART FUNCTIONS
  // ============================================
  
  const loadCart = async () => {
    try {
      setLoadingCart(true);
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/customer/${phone}/cart`,
        { headers: { 'Authorization': `Bearer ${publicAnonKey}` } }
      );

      if (response.ok) {
        const result = await response.json();
        setCartItems(result.cartItems || []);
        setCartTotal(result.totalPrice || 0);
      }
    } catch (error) {
      console.error('Error loading cart:', error);
    } finally {
      setLoadingCart(false);
    }
  };

  const updateCartQuantity = async (itemId: string, quantity: number) => {
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/customer/${phone}/cart/${itemId}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${publicAnonKey}`
          },
          body: JSON.stringify({ quantity })
        }
      );

      if (response.ok) {
        await loadCart();
      }
    } catch (error) {
      console.error('Error updating cart:', error);
    }
  };

  const removeFromCart = async (itemId: string) => {
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/customer/${phone}/cart/${itemId}`,
        {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${publicAnonKey}` }
        }
      );

      if (response.ok) {
        await loadCart();
      }
    } catch (error) {
      console.error('Error removing from cart:', error);
    }
  };

  // ============================================
  // SAVED ITEMS FUNCTIONS
  // ============================================
  
  const loadSaved = async () => {
    try {
      setLoadingSaved(true);
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/customer/${phone}/saved`,
        { headers: { 'Authorization': `Bearer ${publicAnonKey}` } }
      );

      if (response.ok) {
        const result = await response.json();
        setSavedItems(result.savedItems || []);
      }
    } catch (error) {
      console.error('Error loading saved items:', error);
    } finally {
      setLoadingSaved(false);
    }
  };

  const removeFromSaved = async (itemId: string, type: string) => {
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/customer/${phone}/saved/${itemId}?type=${type}`,
        {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${publicAnonKey}` }
        }
      );

      if (response.ok) {
        await loadSaved();
      }
    } catch (error) {
      console.error('Error removing from saved:', error);
    }
  };

  // ============================================
  // ADDRESS FUNCTIONS
  // ============================================
  
  const loadAddresses = async () => {
    try {
      setLoadingAddresses(true);
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/customer/${phone}/addresses`,
        { headers: { 'Authorization': `Bearer ${publicAnonKey}` } }
      );

      if (response.ok) {
        const result = await response.json();
        setAddresses(result.addresses || []);
      }
    } catch (error) {
      console.error('Error loading addresses:', error);
    } finally {
      setLoadingAddresses(false);
    }
  };

  const saveAddress = async (addressData: any) => {
    try {
      const url = editingAddress
        ? `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/customer/${phone}/addresses/${editingAddress.id}`
        : `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/customer/${phone}/addresses`;

      const response = await fetch(url, {
        method: editingAddress ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${publicAnonKey}`
        },
        body: JSON.stringify(addressData)
      });

      if (response.ok) {
        alert(editingAddress ? '✅ Address updated!' : '✅ Address added!');
        await loadAddresses();
        setShowAddressForm(false);
        setEditingAddress(null);
      } else {
        const result = await response.json();
        alert(`❌ Error: ${result.error || 'Failed to save address'}`);
      }
    } catch (error) {
      console.error('Error saving address:', error);
      alert('❌ Error saving address');
    }
  };

  const deleteAddress = async (addressId: string) => {
    if (!confirm('Are you sure you want to delete this address?')) return;

    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/customer/${phone}/addresses/${addressId}`,
        {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${publicAnonKey}` }
        }
      );

      if (response.ok) {
        alert('�� Address deleted!');
        await loadAddresses();
      }
    } catch (error) {
      console.error('Error deleting address:', error);
    }
  };

  // ============================================
  // PAYMENT FUNCTIONS
  // ============================================
  
  const loadPayments = async () => {
    try {
      setLoadingPayments(true);
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/customer/${phone}/payments`,
        { headers: { 'Authorization': `Bearer ${publicAnonKey}` } }
      );

      if (response.ok) {
        const result = await response.json();
        setPaymentMethods(result.paymentMethods || []);
      }
    } catch (error) {
      console.error('Error loading payment methods:', error);
    } finally {
      setLoadingPayments(false);
    }
  };

  const savePaymentMethod = async () => {
    try {
      // Validate based on payment type
      if (newPayment.type === 'card') {
        if (!newPayment.cardNumber || !newPayment.cardHolderName || !newPayment.expiryMonth || !newPayment.expiryYear || !newPayment.cvv) {
          alert('❌ Please fill all card details');
          return;
        }
        if (newPayment.cardNumber.replace(/\s/g, '').length !== 16) {
          alert('❌ Card number must be 16 digits');
          return;
        }
        if (newPayment.cvv.length !== 3) {
          alert('❌ CVV must be 3 digits');
          return;
        }
      } else if (newPayment.type === 'upi') {
        if (!newPayment.upiId) {
          alert('❌ Please enter UPI ID');
          return;
        }
      } else if (newPayment.type === 'netbanking') {
        if (!newPayment.bankName) {
          alert('❌ Please select a bank');
          return;
        }
      }

      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/customer/${phone}/payments`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${publicAnonKey}`
          },
          body: JSON.stringify(newPayment)
        }
      );

      if (response.ok) {
        alert('✅ Payment method added successfully!');
        setShowPaymentForm(false);
        setNewPayment({
          type: 'card',
          cardNumber: '',
          cardHolderName: '',
          expiryMonth: '',
          expiryYear: '',
          cvv: '',
          cardType: 'visa',
          upiId: '',
          bankName: '',
          isDefault: false
        });
        await loadPayments();
      } else {
        const errorData = await response.json();
        alert(`❌ Error: ${errorData.error || 'Failed to add payment method'}`);
      }
    } catch (error) {
      console.error('Error saving payment method:', error);
      alert('❌ Failed to save payment method');
    }
  };

  const deletePaymentMethod = async (paymentId: string) => {
    if (!confirm('Are you sure you want to remove this payment method?')) return;

    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/customer/${phone}/payments/${paymentId}`,
        {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${publicAnonKey}` }
        }
      );

      if (response.ok) {
        alert('✅ Payment method removed!');
        await loadPayments();
      }
    } catch (error) {
      console.error('Error deleting payment method:', error);
    }
  };

  // ============================================
  // NOTIFICATION FUNCTIONS
  // ============================================
  
  const loadNotificationSettings = async () => {
    try {
      setLoadingNotifications(true);
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/customer/${phone}/notification-settings`,
        { headers: { 'Authorization': `Bearer ${publicAnonKey}` } }
      );

      if (response.ok) {
        const result = await response.json();
        setNotificationSettings(result.settings);
      }
    } catch (error) {
      console.error('Error loading notification settings:', error);
    } finally {
      setLoadingNotifications(false);
    }
  };

  const toggleNotification = async (key: keyof NotificationSettings) => {
    const newSettings = { ...notificationSettings, [key]: !notificationSettings[key] };
    setNotificationSettings(newSettings);

    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/customer/${phone}/notification-settings`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${publicAnonKey}`
          },
          body: JSON.stringify(newSettings)
        }
      );

      if (!response.ok) {
        setNotificationSettings(notificationSettings);
      }
    } catch (error) {
      console.error('Error updating notification settings:', error);
      setNotificationSettings(notificationSettings);
    }
  };

  // ============================================
  // UI HELPERS
  // ============================================
  
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
    { icon: Calendar, label: 'My Appointments', color: 'from-purple-100 to-purple-200 text-purple-600', action: 'appointments', isExternal: true },
    { icon: MapPin, label: 'Address Book', color: 'from-green-100 to-green-200 text-green-600', action: 'addresses', isExternal: true },
    { icon: Package, label: 'My Bookings', color: 'from-teal-100 to-teal-200 text-teal-600', view: 'bookings' as const, badge: activeBookings.length },
    { icon: ShoppingCart, label: 'My Cart', color: 'from-pink-100 to-pink-200 text-pink-600', view: 'cart' as const, badge: cartItems.length },
    { icon: Heart, label: 'Saved Items', color: 'from-red-100 to-red-200 text-red-600', view: 'saved' as const, badge: savedItems.length },
    { icon: CreditCard, label: 'Payment Settings', color: 'from-yellow-100 to-yellow-200 text-yellow-600', view: 'payments' as const },
    { icon: Bell, label: 'Notifications', color: 'from-indigo-100 to-indigo-200 text-indigo-600', view: 'notifications' as const },
    { icon: HelpCircle, label: 'Help & Support', color: 'from-gray-100 to-gray-200 text-gray-600', view: 'help' as const },
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
        <div className="bg-gradient-to-r from-[#FF8C42] to-[#FF6B35] px-6 pt-12 pb-6 flex-shrink-0">
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
                  setShowAddressForm(false);
                  setShowPaymentForm(false);
                  setEditingAddress(null);
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
                  <User className="w-8 h-8 text-[#FF8C42]" />
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

        {/* Scrollable Content Area - Fixed Height with Proper Overflow */}
        <div 
          ref={scrollContainerRef}
          className="flex-1 overflow-y-auto overscroll-contain relative" 
          style={{ WebkitOverflowScrolling: 'touch' }}
        >
          {/* Scroll Indicator - Shows user can scroll */}
          {showScrollIndicator && activeView !== 'menu' && (
            <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 z-10 pointer-events-none animate-bounce">
              <div className="bg-[#FF8C42] text-white rounded-full p-2 shadow-lg">
                <ChevronDown className="w-5 h-5" />
              </div>
            </div>
          )}

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
                      <span className="min-w-[26px] h-[26px] px-2 bg-[#FF8C42] text-white rounded-full flex items-center justify-center text-xs font-bold">
                        {item.badge}
                      </span>
                    )}
                    <ChevronRight className="w-5 h-5 text-gray-400" />
                  </div>
                </button>
              ))}

              {/* Logout Button */}
              <button className="w-full flex items-center justify-between p-4 bg-white border-2 border-red-200 rounded-2xl active:scale-[0.98] active:bg-red-50 transition-all shadow-sm mt-6">
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
                  <div className="w-14 h-14 border-4 border-[#FF8C42] border-t-transparent rounded-full animate-spin mx-auto"></div>
                </div>
              ) : !profile ? (
                <p className="text-center text-gray-600 py-20">Profile not found</p>
              ) : (
                <>
                  {/* Edit/Save Buttons */}
                  <div className="flex justify-end mb-6">
                    {editMode ? (
                      <div className="flex gap-3 w-full">
                        <Button
                          onClick={handleCancelEdit}
                          variant="outline"
                          className="flex-1 h-12 gap-2"
                        >
                          <X className="w-5 h-5" />
                          Cancel
                        </Button>
                        <Button
                          onClick={handleSaveProfile}
                          disabled={saving}
                          className="flex-1 h-12 bg-[#FF8C42] hover:bg-[#FF7A2E] text-white gap-2"
                        >
                          {saving ? (
                            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                          ) : (
                            <Save className="w-5 h-5" />
                          )}
                          Save
                        </Button>
                      </div>
                    ) : (
                      <Button
                        onClick={() => setEditMode(true)}
                        variant="outline"
                        className="h-12 gap-2 px-6"
                      >
                        <Edit2 className="w-5 h-5" />
                        Edit Profile
                      </Button>
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
                            className="absolute bottom-0 right-0 w-12 h-12 bg-[#FF8C42] rounded-full flex items-center justify-center shadow-lg active:scale-95 transition-transform"
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
                            className="w-full px-4 py-3.5 border-2 border-gray-200 rounded-xl focus:border-[#FF8C42] focus:outline-none"
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
                            className="w-full px-4 py-3.5 border-2 border-gray-200 rounded-xl focus:border-[#FF8C42] focus:outline-none"
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
                          className="w-full px-4 py-3.5 border-2 border-gray-200 rounded-xl focus:border-[#FF8C42] focus:outline-none"
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
                          className="w-full px-4 py-3.5 border-2 border-gray-200 rounded-xl focus:border-[#FF8C42] focus:outline-none resize-none"
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
                          onChange={(e) => setProfile({ ...profile, pincode: e.target.value })}
                          maxLength={6}
                          className="w-full px-4 py-3.5 border-2 border-gray-200 rounded-xl focus:border-[#FF8C42] focus:outline-none"
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
                    className="text-sm text-[#FF8C42] hover:text-[#FF7029] font-medium flex items-center gap-1"
                  >
                    View Full History
                    <ArrowRight className="w-4 h-4" />
                  </button>
                )}
              </div>
              
              {/* Stats */}
              <div className="grid grid-cols-3 gap-3 mb-6">
                <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-2xl p-4 text-center border border-orange-200">
                  <p className="text-3xl font-bold text-[#FF8C42]">{bookings.length}</p>
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
                  <div className="w-14 h-14 border-4 border-[#FF8C42] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
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

                          {/* 🔐 OTP DISPLAY - Show prominently for active/confirmed bookings */}
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
                          
                          {/* Completed OTP indicator */}
                          {booking.status === 'completed' && booking.otpVerifiedAt && (
                            <div className="mb-3 p-2 bg-green-50 border border-green-200 rounded-lg">
                              <p className="text-xs text-center text-green-700">
                                ✓ Service completed on {new Date(booking.otpVerifiedAt).toLocaleString('en-IN', { 
                                  day: 'numeric', 
                                  month: 'short', 
                                  hour: '2-digit', 
                                  minute: '2-digit' 
                                })}
                              </p>
                            </div>
                          )}

                          {booking.status === 'active' && (
                            <div className="mb-3">
                              <div className="flex items-center justify-between text-xs text-gray-600 mb-1.5">
                                <span>{booking.completedSessions}/{booking.totalSessions} sessions</span>
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

                          <div className="flex items-center gap-2 text-sm text-gray-600">
                            <span className="font-semibold text-[#FF8C42]">₹{booking.price}</span>
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

          {/* Cart View */}
          {activeView === 'cart' && (
            <div className="p-5 pb-32">
              <h3 className="text-2xl font-bold text-gray-800 mb-6">My Cart</h3>
              
              {loadingCart ? (
                <div className="text-center py-20">
                  <div className="w-14 h-14 border-4 border-[#FF8C42] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                </div>
              ) : cartItems.length === 0 ? (
                <div className="text-center py-20 bg-gray-50 rounded-2xl">
                  <ShoppingCart className="w-20 h-20 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-gray-800 font-semibold text-lg mb-2">Your cart is empty</h3>
                  <p className="text-gray-600 mb-6">Add products to get started</p>
                  <Button onClick={handleClose} className="bg-[#FF8C42] hover:bg-[#FF7A2E] text-white h-12 px-8">
                    Continue Shopping
                  </Button>
                </div>
              ) : (
                <>
                  <div className="space-y-3 mb-6">
                    {cartItems.map((item) => (
                      <div key={item.itemId} className="bg-white border border-gray-200 rounded-2xl p-4">
                        <div className="flex gap-3">
                          <div className="w-20 h-20 bg-gray-200 rounded-xl overflow-hidden flex-shrink-0">
                            {item.photo && <img src={item.photo} alt={item.name} className="w-full h-full object-cover" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="font-semibold text-gray-800 mb-1.5">{item.name}</h4>
                            <p className="text-[#FF8C42] font-bold text-lg mb-3">₹{item.price}</p>
                            <div className="flex items-center gap-3">
                              <button
                                onClick={() => updateCartQuantity(item.itemId, item.quantity - 1)}
                                className="w-9 h-9 bg-gray-200 rounded-lg flex items-center justify-center active:bg-gray-300 transition-colors"
                              >
                                <span className="text-lg font-bold">-</span>
                              </button>
                              <span className="font-semibold w-10 text-center">{item.quantity}</span>
                              <button
                                onClick={() => updateCartQuantity(item.itemId, item.quantity + 1)}
                                className="w-9 h-9 bg-gray-200 rounded-lg flex items-center justify-center active:bg-gray-300 transition-colors"
                              >
                                <span className="text-lg font-bold">+</span>
                              </button>
                              <button
                                onClick={() => removeFromCart(item.itemId)}
                                className="ml-auto text-red-500 active:text-red-700 p-2"
                              >
                                <Trash2 className="w-5 h-5" />
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Spacing for checkout bar */}
                  <div className="h-8"></div>
                </>
              )}
            </div>
          )}

          {/* Saved Items View */}
          {activeView === 'saved' && (
            <div className="p-5 pb-8">
              <h3 className="text-2xl font-bold text-gray-800 mb-6">Saved Items</h3>
              
              {loadingSaved ? (
                <div className="text-center py-20">
                  <div className="w-14 h-14 border-4 border-[#FF8C42] border-t-transparent rounded-full animate-spin mx-auto"></div>
                </div>
              ) : savedItems.length === 0 ? (
                <div className="text-center py-20 bg-gray-50 rounded-2xl">
                  <Heart className="w-20 h-20 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-gray-800 font-semibold text-lg mb-2">No saved items</h3>
                  <p className="text-gray-600">Save your favorite products and services</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  {savedItems.map((item) => (
                    <div key={`${item.itemId}-${item.type}`} className="bg-white border border-gray-200 rounded-2xl p-3">
                      <div className="w-full aspect-square bg-gray-200 rounded-xl overflow-hidden mb-3">
                        {item.photo && <img src={item.photo} alt={item.name} className="w-full h-full object-cover" />}
                      </div>
                      <h4 className="font-semibold text-gray-800 text-sm mb-3 line-clamp-2 min-h-[40px]">{item.name}</h4>
                      <button
                        onClick={() => removeFromSaved(item.itemId, item.type)}
                        className="w-full py-2.5 text-sm font-medium text-red-600 hover:bg-red-50 rounded-xl active:bg-red-100 transition-colors"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Addresses View */}
          {activeView === 'addresses' && (
            <div className="p-5 pb-32">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-2xl font-bold text-gray-800">My Addresses</h3>
                {!showAddressForm && (
                  <Button 
                    onClick={() => setShowAddressForm(true)} 
                    className="bg-[#FF8C42] hover:bg-[#FF7A2E] text-white h-11 px-5 gap-2"
                  >
                    <Plus className="w-5 h-5" />
                    Add
                  </Button>
                )}
              </div>

              {showAddressForm ? (
                <AddressForm
                  address={editingAddress}
                  onSave={saveAddress}
                  onCancel={() => {
                    setShowAddressForm(false);
                    setEditingAddress(null);
                  }}
                />
              ) : loadingAddresses ? (
                <div className="text-center py-20">
                  <div className="w-14 h-14 border-4 border-[#FF8C42] border-t-transparent rounded-full animate-spin mx-auto"></div>
                </div>
              ) : addresses.length === 0 ? (
                <div className="text-center py-20 bg-gray-50 rounded-2xl">
                  <HomeIcon className="w-20 h-20 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-gray-800 font-semibold text-lg mb-2">No saved addresses</h3>
                  <p className="text-gray-600">Add delivery addresses for faster checkout</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {addresses.map((addr) => (
                    <div key={addr.id} className="bg-white border border-gray-200 rounded-2xl p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <div className="flex items-center gap-2 mb-2">
                            <h4 className="font-bold text-gray-800 text-lg">{addr.label}</h4>
                            {addr.isDefault && (
                              <span className="px-2.5 py-1 bg-green-100 text-green-700 text-xs font-semibold rounded-lg">Default</span>
                            )}
                          </div>
                          <p className="text-sm text-gray-700 mb-1">{addr.name}</p>
                          <p className="text-sm text-gray-600">{addr.addressLine1}</p>
                          {addr.addressLine2 && <p className="text-sm text-gray-600">{addr.addressLine2}</p>}
                          <p className="text-sm text-gray-600">{addr.city}, {addr.state} - {addr.pincode}</p>
                          <p className="text-sm text-gray-600 mt-1.5">📞 {addr.phone}</p>
                        </div>
                      </div>
                      <div className="flex gap-2.5 pt-3 border-t border-gray-200">
                        <Button 
                          variant="outline" 
                          className="flex-1 h-11"
                          onClick={() => {
                            setEditingAddress(addr);
                            setShowAddressForm(true);
                          }}
                        >
                          <Edit2 className="w-4 h-4 mr-2" />
                          Edit
                        </Button>
                        <Button 
                          variant="outline" 
                          className="flex-1 h-11 text-red-600 hover:bg-red-50 border-red-200"
                          onClick={() => deleteAddress(addr.id)}
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Delete
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Payment Methods View */}
          {activeView === 'payments' && (
            <div className="p-5 pb-32">
              {!showPaymentForm ? (
                <>
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-2xl font-bold text-gray-800">Payment Methods</h3>
                    <Button 
                      className="bg-[#FF8C42] hover:bg-[#FF7A2E] text-white h-11 px-5 gap-2"
                      onClick={() => setShowPaymentForm(true)}
                    >
                      <Plus className="w-5 h-5" />
                      Add
                    </Button>
                  </div>
              
              {loadingPayments ? (
                <div className="text-center py-20">
                  <div className="w-14 h-14 border-4 border-[#FF8C42] border-t-transparent rounded-full animate-spin mx-auto"></div>
                </div>
              ) : paymentMethods.length === 0 ? (
                <div className="text-center py-20 bg-gray-50 rounded-2xl">
                  <CreditCard className="w-20 h-20 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-gray-800 font-semibold text-lg mb-2">No payment methods</h3>
                  <p className="text-gray-600">Add a card for faster payments</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {paymentMethods.map((pm) => (
                    <div key={pm.id} className="bg-white border border-gray-200 rounded-2xl p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <div className="flex items-center gap-2 mb-2">
                            <h4 className="font-bold text-gray-800 text-lg">
                              {pm.type === 'card' ? `${pm.cardType?.toUpperCase()} ****${pm.cardNumber}` : 
                               pm.type === 'upi' ? pm.upiId : pm.bankName}
                            </h4>
                            {pm.isDefault && (
                              <span className="px-2.5 py-1 bg-green-100 text-green-700 text-xs font-semibold rounded-lg">Default</span>
                            )}
                          </div>
                          {pm.type === 'card' && <p className="text-sm text-gray-600">{pm.cardHolderName}</p>}
                          {pm.type === 'card' && <p className="text-sm text-gray-600">Expires: {pm.expiryMonth}/{pm.expiryYear}</p>}
                        </div>
                      </div>
                      <Button 
                        variant="outline" 
                        className="w-full h-11 text-red-600 hover:bg-red-50 border-red-200"
                        onClick={() => deletePaymentMethod(pm.id)}
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Remove
                      </Button>
                    </div>
                  ))}
                </div>
              )}
                </>
              ) : (
                /* Add Payment Form */
                <div>
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-2xl font-bold text-gray-800">Add Payment Method</h3>
                    <button 
                      onClick={() => setShowPaymentForm(false)}
                      className="text-gray-600 hover:text-gray-800"
                    >
                      <X className="w-6 h-6" />
                    </button>
                  </div>

                  {/* Payment Type Selector */}
                  <div className="mb-6">
                    <label className="block text-sm font-semibold text-gray-700 mb-3">Payment Type</label>
                    <div className="grid grid-cols-3 gap-3">
                      <button
                        onClick={() => setNewPayment({ ...newPayment, type: 'card' })}
                        className={`p-4 border-2 rounded-xl text-center transition-all ${
                          newPayment.type === 'card' 
                            ? 'border-[#FF8C42] bg-orange-50' 
                            : 'border-gray-200 bg-white'
                        }`}
                      >
                        <CreditCard className={`w-6 h-6 mx-auto mb-2 ${newPayment.type === 'card' ? 'text-[#FF8C42]' : 'text-gray-400'}`} />
                        <span className={`text-sm font-semibold ${newPayment.type === 'card' ? 'text-[#FF8C42]' : 'text-gray-600'}`}>Card</span>
                      </button>
                      <button
                        onClick={() => setNewPayment({ ...newPayment, type: 'upi' })}
                        className={`p-4 border-2 rounded-xl text-center transition-all ${
                          newPayment.type === 'upi' 
                            ? 'border-[#FF8C42] bg-orange-50' 
                            : 'border-gray-200 bg-white'
                        }`}
                      >
                        <span className={`text-2xl mb-2 block ${newPayment.type === 'upi' ? 'opacity-100' : 'opacity-40'}`}>📱</span>
                        <span className={`text-sm font-semibold ${newPayment.type === 'upi' ? 'text-[#FF8C42]' : 'text-gray-600'}`}>UPI</span>
                      </button>
                      <button
                        onClick={() => setNewPayment({ ...newPayment, type: 'netbanking' })}
                        className={`p-4 border-2 rounded-xl text-center transition-all ${
                          newPayment.type === 'netbanking' 
                            ? 'border-[#FF8C42] bg-orange-50' 
                            : 'border-gray-200 bg-white'
                        }`}
                      >
                        <span className={`text-2xl mb-2 block ${newPayment.type === 'netbanking' ? 'opacity-100' : 'opacity-40'}`}>🏦</span>
                        <span className={`text-sm font-semibold ${newPayment.type === 'netbanking' ? 'text-[#FF8C42]' : 'text-gray-600'}`}>Net Banking</span>
                      </button>
                    </div>
                  </div>

                  {/* Card Form */}
                  {newPayment.type === 'card' && (
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">Card Number</label>
                        <input
                          type="text"
                          placeholder="1234 5678 9012 3456"
                          maxLength={19}
                          value={newPayment.cardNumber}
                          onChange={(e) => {
                            const value = e.target.value.replace(/\s/g, '').replace(/\D/g, '');
                            const formatted = value.match(/.{1,4}/g)?.join(' ') || value;
                            setNewPayment({ ...newPayment, cardNumber: formatted });
                          }}
                          className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-[#FF8C42] focus:outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">Card Holder Name</label>
                        <input
                          type="text"
                          placeholder="John Doe"
                          value={newPayment.cardHolderName}
                          onChange={(e) => setNewPayment({ ...newPayment, cardHolderName: e.target.value.toUpperCase() })}
                          className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-[#FF8C42] focus:outline-none"
                        />
                      </div>

                      <div className="grid grid-cols-3 gap-3">
                        <div>
                          <label className="block text-sm font-semibold text-gray-700 mb-2">Month</label>
                          <input
                            type="text"
                            placeholder="MM"
                            maxLength={2}
                            value={newPayment.expiryMonth}
                            onChange={(e) => {
                              const value = e.target.value.replace(/\D/g, '');
                              if (value === '' || (parseInt(value) >= 1 && parseInt(value) <= 12)) {
                                setNewPayment({ ...newPayment, expiryMonth: value });
                              }
                            }}
                            className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-[#FF8C42] focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-semibold text-gray-700 mb-2">Year</label>
                          <input
                            type="text"
                            placeholder="YY"
                            maxLength={2}
                            value={newPayment.expiryYear}
                            onChange={(e) => {
                              const value = e.target.value.replace(/\D/g, '');
                              setNewPayment({ ...newPayment, expiryYear: value });
                            }}
                            className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-[#FF8C42] focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-semibold text-gray-700 mb-2">CVV</label>
                          <input
                            type="password"
                            placeholder="123"
                            maxLength={3}
                            value={newPayment.cvv}
                            onChange={(e) => {
                              const value = e.target.value.replace(/\D/g, '');
                              setNewPayment({ ...newPayment, cvv: value });
                            }}
                            className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-[#FF8C42] focus:outline-none"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">Card Type</label>
                        <div className="grid grid-cols-4 gap-2">
                          {['visa', 'mastercard', 'rupay', 'amex'].map((type) => (
                            <button
                              key={type}
                              onClick={() => setNewPayment({ ...newPayment, cardType: type as any })}
                              className={`p-3 border-2 rounded-xl text-sm font-semibold capitalize transition-all ${
                                newPayment.cardType === type
                                  ? 'border-[#FF8C42] bg-orange-50 text-[#FF8C42]'
                                  : 'border-gray-200 bg-white text-gray-600'
                              }`}
                            >
                              {type}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* UPI Form */}
                  {newPayment.type === 'upi' && (
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">UPI ID</label>
                        <input
                          type="text"
                          placeholder="yourname@upi"
                          value={newPayment.upiId}
                          onChange={(e) => setNewPayment({ ...newPayment, upiId: e.target.value.toLowerCase() })}
                          className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-[#FF8C42] focus:outline-none"
                        />
                      </div>
                    </div>
                  )}

                  {/* Net Banking Form */}
                  {newPayment.type === 'netbanking' && (
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">Select Bank</label>
                        <select
                          value={newPayment.bankName}
                          onChange={(e) => setNewPayment({ ...newPayment, bankName: e.target.value })}
                          className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-[#FF8C42] focus:outline-none"
                        >
                          <option value="">Choose a bank</option>
                          <option value="HDFC Bank">HDFC Bank</option>
                          <option value="ICICI Bank">ICICI Bank</option>
                          <option value="State Bank of India">State Bank of India</option>
                          <option value="Axis Bank">Axis Bank</option>
                          <option value="Kotak Mahindra Bank">Kotak Mahindra Bank</option>
                          <option value="Punjab National Bank">Punjab National Bank</option>
                          <option value="Bank of Baroda">Bank of Baroda</option>
                          <option value="Yes Bank">Yes Bank</option>
                          <option value="IDFC First Bank">IDFC First Bank</option>
                        </select>
                      </div>
                    </div>
                  )}

                  {/* Default Checkbox */}
                  <div className="mt-6">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={newPayment.isDefault}
                        onChange={(e) => setNewPayment({ ...newPayment, isDefault: e.target.checked })}
                        className="w-5 h-5 text-[#FF8C42] border-gray-300 rounded focus:ring-[#FF8C42]"
                      />
                      <span className="text-sm font-semibold text-gray-700">Set as default payment method</span>
                    </label>
                  </div>

                  {/* Action Buttons */}
                  <div className="mt-8 space-y-3">
                    <Button 
                      onClick={savePaymentMethod}
                      className="w-full bg-[#FF8C42] hover:bg-[#FF7A2E] text-white h-14 text-lg"
                    >
                      Save Payment Method
                    </Button>
                    <Button 
                      variant="outline"
                      onClick={() => setShowPaymentForm(false)}
                      className="w-full h-14 text-lg"
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Notifications View */}
          {activeView === 'notifications' && (
            <div className="p-5 pb-8">
              <h3 className="text-2xl font-bold text-gray-800 mb-6">Notifications</h3>
              
              {loadingNotifications ? (
                <div className="text-center py-20">
                  <div className="w-14 h-14 border-4 border-[#FF8C42] border-t-transparent rounded-full animate-spin mx-auto"></div>
                </div>
              ) : (
                <div className="space-y-3">
                  <NotificationToggle
                    label="Push Notifications"
                    description="Receive booking updates instantly"
                    enabled={notificationSettings.push}
                    onToggle={() => toggleNotification('push')}
                  />
                  <NotificationToggle
                    label="Email Notifications"
                    description="Receive offers via email"
                    enabled={notificationSettings.email}
                    onToggle={() => toggleNotification('email')}
                  />
                  <NotificationToggle
                    label="SMS Notifications"
                    description="Get booking confirmations via SMS"
                    enabled={notificationSettings.sms}
                    onToggle={() => toggleNotification('sms')}
                  />
                  <NotificationToggle
                    label="Booking Updates"
                    description="Get notified about your bookings"
                    enabled={notificationSettings.bookingUpdates}
                    onToggle={() => toggleNotification('bookingUpdates')}
                  />
                  <NotificationToggle
                    label="Promotions & Offers"
                    description="Special deals and discounts"
                    enabled={notificationSettings.promotions}
                    onToggle={() => toggleNotification('promotions')}
                  />
                </div>
              )}
            </div>
          )}

          {/* Help & Support View */}
          {activeView === 'help' && (
            <div className="p-5 pb-8">
              <h3 className="text-2xl font-bold text-gray-800 mb-6">Help & Support</h3>
              <div className="space-y-3">
                <button className="w-full flex items-center gap-4 p-4 bg-white border border-gray-200 rounded-2xl active:scale-[0.98] active:bg-gray-50 transition-all shadow-sm">
                  <div className="w-12 h-12 bg-gradient-to-br from-blue-100 to-blue-200 rounded-xl flex items-center justify-center flex-shrink-0">
                    <HelpCircle className="w-6 h-6 text-blue-600" />
                  </div>
                  <div className="flex-1 text-left">
                    <p className="font-semibold text-gray-800">FAQ</p>
                    <p className="text-sm text-gray-600">Find answers to common questions</p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-400" />
                </button>

                <button className="w-full flex items-center gap-4 p-4 bg-white border border-gray-200 rounded-2xl active:scale-[0.98] active:bg-gray-50 transition-all shadow-sm">
                  <div className="w-12 h-12 bg-gradient-to-br from-green-100 to-green-200 rounded-xl flex items-center justify-center flex-shrink-0">
                    <MessageSquare className="w-6 h-6 text-green-600" />
                  </div>
                  <div className="flex-1 text-left">
                    <p className="font-semibold text-gray-800">Chat with Us</p>
                    <p className="text-sm text-gray-600">Get instant support</p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-400" />
                </button>

                <button className="w-full flex items-center gap-4 p-4 bg-white border border-gray-200 rounded-2xl active:scale-[0.98] active:bg-gray-50 transition-all shadow-sm">
                  <div className="w-12 h-12 bg-gradient-to-br from-purple-100 to-purple-200 rounded-xl flex items-center justify-center flex-shrink-0">
                    <Mail className="w-6 h-6 text-purple-600" />
                  </div>
                  <div className="flex-1 text-left">
                    <p className="font-semibold text-gray-800">Email Support</p>
                    <p className="text-sm text-gray-600">support@warmpawz.com</p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-400" />
                </button>

                <button className="w-full flex items-center gap-4 p-4 bg-white border border-gray-200 rounded-2xl active:scale-[0.98] active:bg-gray-50 transition-all shadow-sm">
                  <div className="w-12 h-12 bg-gradient-to-br from-red-100 to-red-200 rounded-xl flex items-center justify-center flex-shrink-0">
                    <AlertCircle className="w-6 h-6 text-red-600" />
                  </div>
                  <div className="flex-1 text-left">
                    <p className="font-semibold text-gray-800">Report an Issue</p>
                    <p className="text-sm text-gray-600">Let us know about problems</p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-400" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Fixed Checkout Bar - Only visible in Cart view */}
        {activeView === 'cart' && cartItems.length > 0 && (
          <div className="flex-shrink-0 bg-white border-t-2 border-gray-200 p-5 shadow-lg">
            <div className="flex justify-between items-center mb-4">
              <span className="font-semibold text-lg">Total:</span>
              <span className="text-3xl font-bold text-[#FF8C42]">₹{cartTotal}</span>
            </div>
            <Button className="w-full bg-[#FF8C42] hover:bg-[#FF7A2E] text-white h-14 text-lg">
              Proceed to Checkout
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

// Helper Components
function NotificationToggle({ label, description, enabled, onToggle }: {
  label: string;
  description: string;
  enabled: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="flex items-center justify-between p-4 bg-white border border-gray-200 rounded-2xl">
      <div className="flex-1">
        <p className="font-semibold text-gray-800">{label}</p>
        <p className="text-sm text-gray-600 mt-0.5">{description}</p>
      </div>
      <button
        onClick={onToggle}
        className={`w-14 h-8 rounded-full relative transition-colors flex-shrink-0 ml-4 ${
          enabled ? 'bg-[#FF8C42]' : 'bg-gray-300'
        }`}
      >
        <div className={`absolute top-1 w-6 h-6 bg-white rounded-full transition-transform shadow-md ${
          enabled ? 'right-1' : 'left-1'
        }`} />
      </button>
    </div>
  );
}

function AddressForm({ address, onSave, onCancel }: {
  address: Address | null;
  onSave: (data: any) => void;
  onCancel: () => void;
}) {
  const [formData, setFormData] = useState({
    label: address?.label || 'Home',
    name: address?.name || '',
    phone: address?.phone || '',
    addressLine1: address?.addressLine1 || '',
    addressLine2: address?.addressLine2 || '',
    city: address?.city || '',
    state: address?.state || '',
    pincode: address?.pincode || '',
    landmark: address?.landmark || '',
    isDefault: address?.isDefault || false
  });

  const [detectingLocation, setDetectingLocation] = useState(false);

  const detectCurrentLocation = () => {
    if (!navigator.geolocation) {
      alert('❌ Geolocation is not supported by your browser');
      return;
    }

    setDetectingLocation(true);

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        console.log('📍 Location detected:', { latitude, longitude });

        // Reverse geocode using Google Maps
        try {
          const response = await fetch(
            `https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&key=${import.meta.env.VITE_GOOGLE_MAPS_API_KEY}`
          );
          const data = await response.json();

          if (data.results && data.results[0]) {
            const result = data.results[0];
            const addressComponents = result.address_components;

            // Extract address details
            let street = '';
            let locality = '';
            let city = '';
            let state = '';
            let pincode = '';

            addressComponents.forEach((component: any) => {
              if (component.types.includes('street_number') || component.types.includes('route')) {
                street += component.long_name + ' ';
              }
              if (component.types.includes('sublocality') || component.types.includes('locality')) {
                locality = component.long_name;
              }
              if (component.types.includes('locality') || component.types.includes('administrative_area_level_2')) {
                city = component.long_name;
              }
              if (component.types.includes('administrative_area_level_1')) {
                state = component.long_name;
              }
              if (component.types.includes('postal_code')) {
                pincode = component.long_name;
              }
            });

            setFormData(prev => ({
              ...prev,
              addressLine1: street.trim() || locality,
              city: city,
              state: state,
              pincode: pincode
            }));

            alert('✅ Location detected successfully!');
          }
        } catch (error) {
          console.error('Error reverse geocoding:', error);
          alert('⚠️ Location detected but could not fetch address details');
        } finally {
          setDetectingLocation(false);
        }
      },
      (error) => {
        setDetectingLocation(false);
        
        // Log user-friendly message instead of error object
        if (error.code === 1) { // PERMISSION_DENIED
          console.log('💡 Location permission denied by user');
          alert('📍 Location access denied. Please enable location permissions in your browser settings or enter your address manually.');
        } else if (error.code === 2) { // POSITION_UNAVAILABLE
          console.log('💡 Location information unavailable');
          alert('📍 Location information unavailable. Please try again or enter your address manually.');
        } else if (error.code === 3) { // TIMEOUT
          console.log('💡 Location request timeout');
          alert('📍 Location request timeout. Please try again or enter your address manually.');
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      }
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Detect Location Button */}
      <button
        type="button"
        onClick={detectCurrentLocation}
        disabled={detectingLocation}
        className="w-full py-4 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl font-semibold flex items-center justify-center gap-3 active:scale-[0.98] transition-all shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {detectingLocation ? (
          <>
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            <span>Detecting Location...</span>
          </>
        ) : (
          <>
            <MapPin className="w-5 h-5" />
            <span>📍 Detect My Current Location</span>
          </>
        )}
      </button>

      <div className="relative">
        <div className="absolute inset-x-0 flex items-center">
          <div className="w-full border-t border-gray-300"></div>
        </div>
        <div className="relative flex justify-center">
          <span className="bg-white px-4 text-sm text-gray-500">or enter manually</span>
        </div>
      </div>

      <div>
        <label className="block text-xs font-semibold text-gray-500 mb-2.5">Label</label>
        <select
          value={formData.label}
          onChange={(e) => setFormData({ ...formData, label: e.target.value })}
          className="w-full px-4 py-3.5 border-2 border-gray-200 rounded-xl focus:border-[#FF8C42] focus:outline-none"
        >
          <option value="Home">Home</option>
          <option value="Work">Work</option>
          <option value="Other">Other</option>
        </select>
      </div>

      <div>
        <label className="block text-xs font-semibold text-gray-500 mb-2.5">Name</label>
        <input
          type="text"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          className="w-full px-4 py-3.5 border-2 border-gray-200 rounded-xl focus:border-[#FF8C42] focus:outline-none"
          required
        />
      </div>

      <div>
        <label className="block text-xs font-semibold text-gray-500 mb-2.5">Phone</label>
        <input
          type="tel"
          value={formData.phone}
          onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
          className="w-full px-4 py-3.5 border-2 border-gray-200 rounded-xl focus:border-[#FF8C42] focus:outline-none"
          required
        />
      </div>

      <div>
        <label className="block text-xs font-semibold text-gray-500 mb-2.5">Address Line 1</label>
        <input
          type="text"
          value={formData.addressLine1}
          onChange={(e) => setFormData({ ...formData, addressLine1: e.target.value })}
          className="w-full px-4 py-3.5 border-2 border-gray-200 rounded-xl focus:border-[#FF8C42] focus:outline-none"
          required
        />
      </div>

      <div>
        <label className="block text-xs font-semibold text-gray-500 mb-2.5">Address Line 2 (Optional)</label>
        <input
          type="text"
          value={formData.addressLine2}
          onChange={(e) => setFormData({ ...formData, addressLine2: e.target.value })}
          className="w-full px-4 py-3.5 border-2 border-gray-200 rounded-xl focus:border-[#FF8C42] focus:outline-none"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-semibold text-gray-500 mb-2.5">City</label>
          <input
            type="text"
            value={formData.city}
            onChange={(e) => setFormData({ ...formData, city: e.target.value })}
            className="w-full px-4 py-3.5 border-2 border-gray-200 rounded-xl focus:border-[#FF8C42] focus:outline-none"
            required
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-500 mb-2.5">State</label>
          <input
            type="text"
            value={formData.state}
            onChange={(e) => setFormData({ ...formData, state: e.target.value })}
            className="w-full px-4 py-3.5 border-2 border-gray-200 rounded-xl focus:border-[#FF8C42] focus:outline-none"
            required
          />
        </div>
      </div>

      <div>
        <label className="block text-xs font-semibold text-gray-500 mb-2.5">Pincode</label>
        <input
          type="text"
          value={formData.pincode}
          onChange={(e) => setFormData({ ...formData, pincode: e.target.value })}
          maxLength={6}
          className="w-full px-4 py-3.5 border-2 border-gray-200 rounded-xl focus:border-[#FF8C42] focus:outline-none"
          required
        />
      </div>

      <div>
        <label className="block text-xs font-semibold text-gray-500 mb-2.5">Landmark (Optional)</label>
        <input
          type="text"
          value={formData.landmark}
          onChange={(e) => setFormData({ ...formData, landmark: e.target.value })}
          className="w-full px-4 py-3.5 border-2 border-gray-200 rounded-xl focus:border-[#FF8C42] focus:outline-none"
        />
      </div>

      <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl">
        <input
          type="checkbox"
          id="isDefault"
          checked={formData.isDefault}
          onChange={(e) => setFormData({ ...formData, isDefault: e.target.checked })}
          className="w-5 h-5 accent-[#FF8C42]"
        />
        <label htmlFor="isDefault" className="text-sm font-medium text-gray-700">Make this my default address</label>
      </div>

      <div className="flex gap-3 pt-4">
        <Button type="button" variant="outline" onClick={onCancel} className="flex-1 h-12">
          Cancel
        </Button>
        <Button type="submit" className="flex-1 h-12 bg-[#FF8C42] hover:bg-[#FF7A2E] text-white">
          {address ? 'Update' : 'Add'} Address
        </Button>
      </div>
    </form>
  );
}
