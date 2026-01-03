'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api-client';

// ============================================================================
// TYPES
// ============================================================================

interface Pet {
  id: string;
  name: string;
  species: string;
  breed: string;
  age_years?: number;
  age_months?: number;
  profile_photo_url?: string;
}

interface ServiceCategory {
  id: string;
  name: string;
  icon: string;
  description: string;
  service_style: 'centre' | 'home' | 'tele' | 'ecommerce';
}

interface Vendor {
  id: string;
  business_name: string;
  owner_name: string;
  rating: number;
  total_reviews: number;
  distance_km?: number;
  address: string;
  profile_photo_url?: string;
  services: Service[];
  is_previous_provider?: boolean;
}

interface Service {
  id: string;
  name: string;
  description: string;
  price: number;
  duration: number;
  service_style: string;
  vendor_id: string;
  vendor_name?: string;
}

interface Staff {
  id: string;
  name: string;
  photo_url?: string;
  rating: number;
  specializations: string[];
  is_available: boolean;
  is_previous?: boolean;
  distance_km?: number;
}

interface Booking {
  id: string;
  service_name: string;
  vendor_name: string;
  booking_date: string;
  booking_time: string;
  status: string;
  total_amount: number;
  service_style: string;
}

interface ProblemGridItem {
  id: string;
  symptom: string;
  icon: string;
  category: string;
}

interface CustomerProfile {
  id: string;
  name: string;
  phone: string;
  email: string;
  wallet_balance: number;
  addresses: Address[];
}

interface Address {
  id: string;
  label: string;
  address: string;
  city: string;
  pincode: string;
  latitude: number;
  longitude: number;
  is_default: boolean;
}

// ============================================================================
// SERVICE CATEGORIES
// ============================================================================

const SERVICE_CATEGORIES: ServiceCategory[] = [
  { id: 'vet_clinic', name: 'Vet Clinic', icon: '🏥', description: 'Visit a vet clinic', service_style: 'centre' },
  { id: 'home_vet', name: 'Vet at Home', icon: '🏠', description: 'Vet visits your home', service_style: 'home' },
  { id: 'tele_consult', name: 'Video Consult', icon: '📹', description: 'Online consultation', service_style: 'tele' },
  { id: 'grooming', name: 'Grooming', icon: '✂️', description: 'Pet grooming services', service_style: 'centre' },
  { id: 'home_grooming', name: 'Home Grooming', icon: '🛁', description: 'Grooming at home', service_style: 'home' },
  { id: 'training', name: 'Training', icon: '🎓', description: 'Pet training programs', service_style: 'centre' },
  { id: 'home_training', name: 'Home Training', icon: '🏃', description: 'Training at home', service_style: 'home' },
  { id: 'pet_walking', name: 'Pet Walking', icon: '🚶', description: 'Daily walks', service_style: 'home' },
  { id: 'pet_sitting', name: 'Pet Sitting', icon: '🏡', description: 'Pet care at your home', service_style: 'home' },
  { id: 'boarding', name: 'Pet Boarding', icon: '🏨', description: 'Pet stay facilities', service_style: 'centre' },
  { id: 'resort', name: 'Pet Resort', icon: '🏖️', description: 'Luxury pet resort', service_style: 'centre' },
  { id: 'pet_cafe', name: 'Pet Cafe', icon: '☕', description: 'Dine with your pet', service_style: 'centre' },
  { id: 'pharmacy', name: 'Pharmacy', icon: '💊', description: 'Pet medicines', service_style: 'ecommerce' },
  { id: 'diagnostics', name: 'Lab Tests', icon: '🔬', description: 'Diagnostic tests', service_style: 'centre' },
  { id: 'ambulance', name: 'Ambulance', icon: '🚑', description: 'Emergency transport', service_style: 'home' },
  { id: 'insurance', name: 'Pet Insurance', icon: '🛡️', description: 'Insurance plans', service_style: 'ecommerce' },
  { id: 'adoption', name: 'Adoption', icon: '❤️', description: 'Adopt a pet', service_style: 'centre' },
  { id: 'nutrition', name: 'Nutrition', icon: '🥗', description: 'Diet consultation', service_style: 'tele' },
  { id: 'holidays', name: 'Pet Holidays', icon: '✈️', description: 'Pet-friendly tours', service_style: 'centre' },
];

const PROBLEM_GRID: ProblemGridItem[] = [
  { id: 'vomiting', symptom: 'Vomiting', icon: '🤮', category: 'emergency' },
  { id: 'not_eating', symptom: 'Not Eating', icon: '🍽️', category: 'general' },
  { id: 'limping', symptom: 'Limping', icon: '🦿', category: 'orthopedic' },
  { id: 'skin_issues', symptom: 'Skin Issues', icon: '🩹', category: 'dermatology' },
  { id: 'eye_problem', symptom: 'Eye Problem', icon: '👁️', category: 'ophthalmology' },
  { id: 'ear_infection', symptom: 'Ear Infection', icon: '👂', category: 'general' },
  { id: 'breathing', symptom: 'Breathing Issue', icon: '😮‍💨', category: 'emergency' },
  { id: 'vaccination', symptom: 'Vaccination', icon: '💉', category: 'preventive' },
  { id: 'deworming', symptom: 'Deworming', icon: '💊', category: 'preventive' },
  { id: 'dental', symptom: 'Dental Issue', icon: '🦷', category: 'dental' },
  { id: 'behavior', symptom: 'Behavior Issue', icon: '🐕', category: 'behavioral' },
  { id: 'weight', symptom: 'Weight Issue', icon: '⚖️', category: 'nutrition' },
];

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function CustomerHomeComplete({ phone }: { phone: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [customer, setCustomer] = useState<CustomerProfile | null>(null);
  const [pets, setPets] = useState<Pet[]>([]);
  const [upcomingBookings, setUpcomingBookings] = useState<Booking[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Service[]>([]);
  const [showSearch, setShowSearch] = useState(false);
  const [selectedAddress, setSelectedAddress] = useState<Address | null>(null);
  const [activeView, setActiveView] = useState<'home' | 'search' | 'category' | 'booking'>('home');
  const [selectedCategory, setSelectedCategory] = useState<ServiceCategory | null>(null);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [selectedVendor, setSelectedVendor] = useState<Vendor | null>(null);
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [selectedStaff, setSelectedStaff] = useState<Staff | null>(null);
  const [availableStaff, setAvailableStaff] = useState<Staff[]>([]);
  const [bookingStep, setBookingStep] = useState<'service' | 'staff' | 'schedule' | 'payment' | 'confirm'>('service');
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [selectedTime, setSelectedTime] = useState<string>('');
  const [availableSlots, setAvailableSlots] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  // ============================================================================
  // DATA LOADING
  // ============================================================================

  useEffect(() => {
    loadInitialData();
  }, [phone]);

  const loadInitialData = async () => {
    try {
      setLoading(true);
      
      // Load customer profile
      const profileResponse = await apiClient.get<any>(`/customer/profile/unified/${phone}`);
      if (profileResponse.success || profileResponse.profile) {
        const profile = profileResponse.profile || profileResponse;
        setCustomer(profile);
        
        // Set default address
        const defaultAddr = profile.addresses?.find((a: Address) => a.is_default) || profile.addresses?.[0];
        setSelectedAddress(defaultAddr || null);
      }

      // Load pets
      if (profileResponse.profile?.id) {
        const petsResponse = await apiClient.get<any>(`/pets/customer/${profileResponse.profile.id}`);
        setPets(petsResponse.pets || []);
      }

      // Load upcoming bookings
      const bookingsResponse = await apiClient.get<any>(`/customer/bookings/upcoming?phone=${phone}`);
      setUpcomingBookings(bookingsResponse.bookings || []);

    } catch (err: any) {
      console.error('Error loading data:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // ============================================================================
  // SEARCH
  // ============================================================================

  const handleSearch = async (query: string) => {
    setSearchQuery(query);
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }

    try {
      const response = await apiClient.get<any>(`/search?q=${encodeURIComponent(query)}&lat=${selectedAddress?.latitude || 0}&lng=${selectedAddress?.longitude || 0}`);
      setSearchResults(response.results || []);
      setActiveView('search');
    } catch (err) {
      console.error('Search error:', err);
    }
  };

  // ============================================================================
  // CATEGORY SELECTION
  // ============================================================================

  const handleCategorySelect = async (category: ServiceCategory) => {
    setSelectedCategory(category);
    setActiveView('category');
    setLoading(true);

    try {
      // Load vendors for this category with distance-aware sorting
      const response = await apiClient.get<any>(`/service-discovery/vendors?category=${category.id}&service_style=${category.service_style}&lat=${selectedAddress?.latitude || 0}&lng=${selectedAddress?.longitude || 0}&customer_phone=${phone}`);
      
      // Sort: previous providers first, then by distance
      const sorted = (response.vendors || []).sort((a: Vendor, b: Vendor) => {
        if (a.is_previous_provider && !b.is_previous_provider) return -1;
        if (!a.is_previous_provider && b.is_previous_provider) return 1;
        return (a.distance_km || 999) - (b.distance_km || 999);
      });
      
      setVendors(sorted);
    } catch (err) {
      console.error('Error loading vendors:', err);
    } finally {
      setLoading(false);
    }
  };

  // ============================================================================
  // VENDOR & SERVICE SELECTION
  // ============================================================================

  const handleVendorSelect = async (vendor: Vendor) => {
    setSelectedVendor(vendor);
    setBookingStep('service');
    setActiveView('booking');
  };

  const handleServiceSelect = async (service: Service) => {
    setSelectedService(service);
    
    // For home/tele services, load available staff
    if (selectedCategory?.service_style === 'home' || selectedCategory?.service_style === 'tele') {
      try {
        const response = await apiClient.get<any>(`/service-discovery/staff?service_id=${service.id}&vendor_id=${service.vendor_id}&lat=${selectedAddress?.latitude || 0}&lng=${selectedAddress?.longitude || 0}&customer_phone=${phone}`);
        
        // Sort: previous staff first, then by availability
        const sorted = (response.staff || []).sort((a: Staff, b: Staff) => {
          if (a.is_previous && !b.is_previous) return -1;
          if (!a.is_previous && b.is_previous) return 1;
          return 0;
        });
        
        setAvailableStaff(sorted);
        setBookingStep('staff');
      } catch (err) {
        console.error('Error loading staff:', err);
        setBookingStep('schedule');
      }
    } else {
      setBookingStep('schedule');
    }
  };

  const handleStaffSelect = (staff: Staff) => {
    setSelectedStaff(staff);
    setBookingStep('schedule');
    loadAvailableSlots();
  };

  // ============================================================================
  // SCHEDULING
  // ============================================================================

  const loadAvailableSlots = async () => {
    if (!selectedService || !selectedDate) return;

    try {
      const response = await apiClient.get<any>(`/bookings/available-slots?service_id=${selectedService.id}&vendor_id=${selectedService.vendor_id}&staff_id=${selectedStaff?.id || ''}&date=${selectedDate}`);
      setAvailableSlots(response.slots || []);
    } catch (err) {
      console.error('Error loading slots:', err);
    }
  };

  useEffect(() => {
    if (bookingStep === 'schedule' && selectedDate) {
      loadAvailableSlots();
    }
  }, [bookingStep, selectedDate]);

  // ============================================================================
  // BOOKING
  // ============================================================================

  const handleBooking = async () => {
    if (!selectedService || !selectedDate || !selectedTime) {
      setError('Please select all required options');
      return;
    }

    setBookingStep('payment');
  };

  const handlePayment = async (paymentMethod: 'razorpay' | 'wallet') => {
    try {
      setLoading(true);

      // Create booking
      const bookingResponse = await apiClient.post<any>('/bookings/create', {
        customer_phone: phone,
        service_id: selectedService?.id,
        vendor_id: selectedVendor?.id || selectedService?.vendor_id,
        staff_id: selectedStaff?.id,
        booking_date: selectedDate,
        booking_time: selectedTime,
        total_amount: selectedService?.price,
        service_style: selectedCategory?.service_style,
        address_id: selectedAddress?.id,
        payment_method: paymentMethod,
      });

      if (bookingResponse.booking_id) {
        if (paymentMethod === 'razorpay') {
          // Initiate Razorpay payment
          const paymentResponse = await apiClient.post<any>('/payments/create-order', {
            booking_id: bookingResponse.booking_id,
            amount: selectedService?.price,
          });
          
          // Here you would integrate Razorpay SDK
          // For now, simulate success
          setBookingStep('confirm');
        } else {
          // Wallet payment
          setBookingStep('confirm');
        }
      }
    } catch (err: any) {
      setError(err.message || 'Booking failed');
    } finally {
      setLoading(false);
    }
  };

  // ============================================================================
  // RENDER HELPERS
  // ============================================================================

  const getNextDates = () => {
    const dates = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date();
      date.setDate(date.getDate() + i);
      dates.push({
        date: date.toISOString().split('T')[0],
        day: date.toLocaleDateString('en-US', { weekday: 'short' }),
        dayNum: date.getDate(),
        month: date.toLocaleDateString('en-US', { month: 'short' }),
      });
    }
    return dates;
  };

  // ============================================================================
  // RENDER
  // ============================================================================

  if (loading && activeView === 'home') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-50 to-amber-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading your profile...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-amber-50 pb-20">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-orange-400 to-orange-600 rounded-full flex items-center justify-center text-white text-xl">
                🐾
              </div>
              <div>
                <h1 className="text-lg font-bold text-gray-900">Warmpawz</h1>
                <button 
                  onClick={() => setShowSearch(true)}
                  className="flex items-center gap-1 text-sm text-gray-500"
                >
                  📍 {selectedAddress?.label || 'Select address'}
                  <span className="text-xs">▼</span>
                </button>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button className="p-2 hover:bg-gray-100 rounded-full relative">
                <span className="text-xl">🔔</span>
              </button>
              <button className="p-2 hover:bg-gray-100 rounded-full">
                <span className="text-xl">🛒</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {/* Search Bar */}
        <div className="relative">
          <input
            type="text"
            placeholder="Search symptoms, services, or vets..."
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            className="w-full px-5 py-4 pl-12 bg-white rounded-2xl shadow-sm border-2 border-transparent focus:border-orange-300 focus:ring-4 focus:ring-orange-100 outline-none transition text-lg"
          />
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl">🔍</span>
        </div>

        {/* Home View */}
        {activeView === 'home' && (
          <>
            {/* Welcome Banner */}
            <div className="bg-gradient-to-r from-orange-500 to-amber-500 rounded-3xl p-6 text-white">
              <h2 className="text-2xl font-bold mb-2">Hi {customer?.name?.split(' ')[0] || 'Pet Parent'}! 👋</h2>
              <p className="text-orange-100">What does your furry friend need today?</p>
              {customer?.wallet_balance && customer.wallet_balance > 0 && (
                <div className="mt-4 flex items-center gap-2">
                  <span className="text-lg">💰</span>
                  <span className="font-medium">Wallet: ₹{customer.wallet_balance}</span>
                </div>
              )}
            </div>

            {/* Pets Carousel */}
            {pets.length > 0 && (
              <section>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">Your Pets</h3>
                  <button className="text-orange-500 text-sm font-medium">+ Add Pet</button>
                </div>
                <div className="flex gap-4 overflow-x-auto pb-2">
                  {pets.map((pet) => (
                    <div key={pet.id} className="flex-shrink-0 w-32 text-center">
                      <div className="w-20 h-20 mx-auto bg-gradient-to-br from-orange-100 to-amber-100 rounded-full flex items-center justify-center text-3xl overflow-hidden">
                        {pet.profile_photo_url ? (
                          <img src={pet.profile_photo_url} alt={pet.name} className="w-full h-full object-cover" />
                        ) : (
                          pet.species === 'dog' ? '🐕' : pet.species === 'cat' ? '🐱' : '🐾'
                        )}
                      </div>
                      <p className="font-medium text-gray-900 mt-2">{pet.name}</p>
                      <p className="text-xs text-gray-500">{pet.breed}</p>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Problem Grid */}
            <section>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">What's the problem?</h3>
              <div className="grid grid-cols-4 gap-3">
                {PROBLEM_GRID.map((problem) => (
                  <button
                    key={problem.id}
                    onClick={() => handleSearch(problem.symptom)}
                    className="flex flex-col items-center p-3 bg-white rounded-xl shadow-sm hover:shadow-md hover:bg-orange-50 transition"
                  >
                    <span className="text-2xl mb-1">{problem.icon}</span>
                    <span className="text-xs text-gray-700 text-center">{problem.symptom}</span>
                  </button>
                ))}
              </div>
            </section>

            {/* Service Categories */}
            <section>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Browse Services</h3>
              <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                {SERVICE_CATEGORIES.map((category) => (
                  <button
                    key={category.id}
                    onClick={() => handleCategorySelect(category)}
                    className="flex flex-col items-center p-4 bg-white rounded-2xl shadow-sm hover:shadow-md hover:bg-orange-50 transition group"
                  >
                    <span className="text-3xl mb-2 group-hover:scale-110 transition">{category.icon}</span>
                    <span className="text-sm font-medium text-gray-700 text-center">{category.name}</span>
                    <span className="text-xs text-gray-400 mt-1">
                      {category.service_style === 'centre' ? '📍 Centre' :
                       category.service_style === 'home' ? '🏠 Home' :
                       category.service_style === 'tele' ? '📱 Online' : '🛒 Shop'}
                    </span>
                  </button>
                ))}
              </div>
            </section>

            {/* Upcoming Bookings */}
            {upcomingBookings.length > 0 && (
              <section>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">Upcoming Appointments</h3>
                  <button className="text-orange-500 text-sm font-medium">View All →</button>
                </div>
                <div className="space-y-3">
                  {upcomingBookings.slice(0, 3).map((booking) => (
                    <div key={booking.id} className="bg-white rounded-2xl p-4 shadow-sm flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center text-xl">
                          {booking.service_style === 'centre' ? '🏥' : booking.service_style === 'home' ? '🏠' : '📹'}
                        </div>
                        <div>
                          <h4 className="font-medium text-gray-900">{booking.service_name}</h4>
                          <p className="text-sm text-gray-500">{booking.vendor_name}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-medium text-gray-900">{booking.booking_time}</p>
                        <p className="text-sm text-gray-500">{booking.booking_date}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </>
        )}

        {/* Search Results View */}
        {activeView === 'search' && (
          <div className="space-y-4">
            <button 
              onClick={() => { setActiveView('home'); setSearchQuery(''); setSearchResults([]); }}
              className="flex items-center gap-2 text-gray-600 hover:text-orange-500"
            >
              ← Back
            </button>
            <h3 className="text-lg font-semibold text-gray-900">
              Results for "{searchQuery}"
            </h3>
            {searchResults.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-2xl">
                <div className="text-5xl mb-4">🔍</div>
                <p className="text-gray-500">No results found</p>
              </div>
            ) : (
              <div className="space-y-3">
                {searchResults.map((service) => (
                  <button
                    key={service.id}
                    onClick={() => handleServiceSelect(service)}
                    className="w-full text-left bg-white rounded-2xl p-4 shadow-sm hover:shadow-md transition"
                  >
                    <h4 className="font-medium text-gray-900">{service.name}</h4>
                    <p className="text-sm text-gray-500 mt-1">{service.vendor_name}</p>
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-orange-500 font-medium">₹{service.price}</span>
                      <span className="text-sm text-gray-400">{service.duration} mins</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Category View - Vendor List */}
        {activeView === 'category' && selectedCategory && (
          <div className="space-y-4">
            <button 
              onClick={() => { setActiveView('home'); setSelectedCategory(null); }}
              className="flex items-center gap-2 text-gray-600 hover:text-orange-500"
            >
              ← Back
            </button>
            
            <div className="flex items-center gap-3">
              <span className="text-3xl">{selectedCategory.icon}</span>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">{selectedCategory.name}</h3>
                <p className="text-sm text-gray-500">{selectedCategory.description}</p>
              </div>
            </div>

            {loading ? (
              <div className="text-center py-12">
                <div className="animate-spin text-4xl mb-4">⏳</div>
                <p className="text-gray-500">Finding providers near you...</p>
              </div>
            ) : vendors.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-2xl">
                <div className="text-5xl mb-4">😔</div>
                <p className="text-gray-500">No providers found in your area</p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Previous Provider Banner */}
                {vendors.some(v => v.is_previous_provider) && (
                  <div className="bg-green-50 border border-green-200 rounded-xl p-3">
                    <p className="text-sm text-green-700">🌟 Your previous providers are shown first</p>
                  </div>
                )}

                {vendors.map((vendor) => (
                  <button
                    key={vendor.id}
                    onClick={() => handleVendorSelect(vendor)}
                    className="w-full text-left bg-white rounded-2xl p-4 shadow-sm hover:shadow-md transition"
                  >
                    <div className="flex gap-4">
                      <div className="w-16 h-16 bg-orange-100 rounded-xl flex items-center justify-center text-2xl overflow-hidden">
                        {vendor.profile_photo_url ? (
                          <img src={vendor.profile_photo_url} alt={vendor.business_name} className="w-full h-full object-cover" />
                        ) : '🏪'}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-start justify-between">
                          <div>
                            <h4 className="font-medium text-gray-900">{vendor.business_name}</h4>
                            {vendor.is_previous_provider && (
                              <span className="inline-block px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full mt-1">
                                ✓ Visited Before
                              </span>
                            )}
                          </div>
                          <div className="text-right">
                            <div className="flex items-center gap-1">
                              <span className="text-yellow-500">⭐</span>
                              <span className="font-medium">{vendor.rating}</span>
                              <span className="text-gray-400 text-sm">({vendor.total_reviews})</span>
                            </div>
                            {vendor.distance_km && (
                              <p className="text-sm text-gray-500">{vendor.distance_km.toFixed(1)} km</p>
                            )}
                          </div>
                        </div>
                        <p className="text-sm text-gray-500 mt-1">{vendor.address}</p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Booking Flow */}
        {activeView === 'booking' && (
          <div className="space-y-4">
            <button 
              onClick={() => { 
                if (bookingStep === 'service') {
                  setActiveView('category');
                } else {
                  const steps: readonly ('service' | 'staff' | 'schedule' | 'payment' | 'confirm')[] = ['service', 'staff', 'schedule', 'payment', 'confirm'];
                  const currentIndex = steps.indexOf(bookingStep);
                  if (currentIndex > 0) {
                    setBookingStep(steps[currentIndex - 1]);
                  }
                }
              }}
              className="flex items-center gap-2 text-gray-600 hover:text-orange-500"
            >
              ← Back
            </button>

            {/* Service Selection */}
            {bookingStep === 'service' && selectedVendor && (
              <div className="space-y-4">
                <div className="bg-white rounded-2xl p-4 shadow-sm">
                  <div className="flex gap-4">
                    <div className="w-16 h-16 bg-orange-100 rounded-xl flex items-center justify-center text-2xl">🏪</div>
                    <div>
                      <h3 className="font-semibold text-gray-900">{selectedVendor.business_name}</h3>
                      <p className="text-sm text-gray-500">{selectedVendor.address}</p>
                      <div className="flex items-center gap-1 mt-1">
                        <span className="text-yellow-500">⭐</span>
                        <span className="text-sm">{selectedVendor.rating}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <h3 className="text-lg font-semibold text-gray-900">Select Service</h3>
                <div className="space-y-3">
                  {selectedVendor.services?.map((service) => (
                    <button
                      key={service.id}
                      onClick={() => handleServiceSelect(service)}
                      className="w-full text-left bg-white rounded-2xl p-4 shadow-sm hover:shadow-md hover:border-orange-300 border-2 border-transparent transition"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="font-medium text-gray-900">{service.name}</h4>
                          <p className="text-sm text-gray-500">{service.duration} mins</p>
                        </div>
                        <span className="text-lg font-semibold text-orange-500">₹{service.price}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Staff Selection (for home/tele) */}
            {bookingStep === 'staff' && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-900">Select Provider</h3>
                
                {availableStaff.some(s => s.is_previous) && (
                  <div className="bg-green-50 border border-green-200 rounded-xl p-3">
                    <p className="text-sm text-green-700">🌟 Your previous provider is available</p>
                  </div>
                )}

                <div className="space-y-3">
                  {availableStaff.map((staff) => (
                    <button
                      key={staff.id}
                      onClick={() => handleStaffSelect(staff)}
                      disabled={!staff.is_available}
                      className={`w-full text-left bg-white rounded-2xl p-4 shadow-sm transition ${
                        staff.is_available ? 'hover:shadow-md hover:border-orange-300 border-2 border-transparent' : 'opacity-50'
                      }`}
                    >
                      <div className="flex gap-4">
                        <div className="w-14 h-14 bg-orange-100 rounded-full flex items-center justify-center text-xl overflow-hidden">
                          {staff.photo_url ? (
                            <img src={staff.photo_url} alt={staff.name} className="w-full h-full object-cover" />
                          ) : '👤'}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-start justify-between">
                            <div>
                              <h4 className="font-medium text-gray-900">{staff.name}</h4>
                              {staff.is_previous && (
                                <span className="inline-block px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full">
                                  Your Previous Provider
                                </span>
                              )}
                            </div>
                            <div className="text-right">
                              <div className="flex items-center gap-1">
                                <span className="text-yellow-500">⭐</span>
                                <span className="font-medium">{staff.rating}</span>
                              </div>
                              {staff.distance_km && (
                                <p className="text-xs text-gray-500">{staff.distance_km.toFixed(1)} km away</p>
                              )}
                            </div>
                          </div>
                          <p className="text-sm text-gray-500 mt-1">
                            {staff.specializations?.join(', ')}
                          </p>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>

                <button
                  onClick={() => { setSelectedStaff(null); setBookingStep('schedule'); }}
                  className="w-full py-3 text-orange-500 font-medium"
                >
                  Skip - Assign any available provider
                </button>
              </div>
            )}

            {/* Schedule Selection */}
            {bookingStep === 'schedule' && (
              <div className="space-y-6">
                <h3 className="text-lg font-semibold text-gray-900">Select Date & Time</h3>

                {/* Date Selection */}
                <div className="flex gap-2 overflow-x-auto pb-2">
                  {getNextDates().map((d) => (
                    <button
                      key={d.date}
                      onClick={() => setSelectedDate(d.date)}
                      className={`flex-shrink-0 w-16 py-3 rounded-xl text-center transition ${
                        selectedDate === d.date
                          ? 'bg-orange-500 text-white'
                          : 'bg-white text-gray-700 hover:bg-orange-50'
                      }`}
                    >
                      <p className="text-xs">{d.day}</p>
                      <p className="text-lg font-bold">{d.dayNum}</p>
                      <p className="text-xs">{d.month}</p>
                    </button>
                  ))}
                </div>

                {/* Time Slots */}
                {selectedDate && (
                  <div>
                    <h4 className="font-medium text-gray-900 mb-3">Available Slots</h4>
                    {availableSlots.length === 0 ? (
                      <div className="text-center py-8 bg-white rounded-xl">
                        <p className="text-gray-500">No slots available for this date</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-3 gap-2">
                        {availableSlots.map((slot) => (
                          <button
                            key={slot}
                            onClick={() => setSelectedTime(slot)}
                            className={`py-3 rounded-xl text-center transition ${
                              selectedTime === slot
                                ? 'bg-orange-500 text-white'
                                : 'bg-white text-gray-700 hover:bg-orange-50'
                            }`}
                          >
                            {slot}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Continue Button */}
                <button
                  onClick={handleBooking}
                  disabled={!selectedDate || !selectedTime}
                  className="w-full py-4 bg-orange-500 text-white font-semibold rounded-2xl disabled:opacity-50 hover:bg-orange-600 transition"
                >
                  Continue to Payment
                </button>
              </div>
            )}

            {/* Payment */}
            {bookingStep === 'payment' && (
              <div className="space-y-6">
                <h3 className="text-lg font-semibold text-gray-900">Payment</h3>

                {/* Booking Summary */}
                <div className="bg-white rounded-2xl p-4 shadow-sm space-y-3">
                  <h4 className="font-medium text-gray-900">Booking Summary</h4>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Service</span>
                    <span className="text-gray-900">{selectedService?.name}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Date & Time</span>
                    <span className="text-gray-900">{selectedDate} at {selectedTime}</span>
                  </div>
                  {selectedStaff && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Provider</span>
                      <span className="text-gray-900">{selectedStaff.name}</span>
                    </div>
                  )}
                  <hr />
                  <div className="flex justify-between font-semibold">
                    <span>Total</span>
                    <span className="text-orange-500">₹{selectedService?.price}</span>
                  </div>
                </div>

                {/* Payment Methods */}
                <div className="space-y-3">
                  {customer?.wallet_balance && customer.wallet_balance >= (selectedService?.price || 0) && (
                    <button
                      onClick={() => handlePayment('wallet')}
                      className="w-full flex items-center justify-between bg-white rounded-2xl p-4 shadow-sm hover:shadow-md transition"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">💰</span>
                        <div className="text-left">
                          <p className="font-medium text-gray-900">Pay with Wallet</p>
                          <p className="text-sm text-gray-500">Balance: ₹{customer.wallet_balance}</p>
                        </div>
                      </div>
                      <span className="text-orange-500">→</span>
                    </button>
                  )}

                  <button
                    onClick={() => handlePayment('razorpay')}
                    className="w-full flex items-center justify-between bg-white rounded-2xl p-4 shadow-sm hover:shadow-md transition"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">💳</span>
                      <div className="text-left">
                        <p className="font-medium text-gray-900">Pay with Card/UPI</p>
                        <p className="text-sm text-gray-500">Razorpay secure payment</p>
                      </div>
                    </div>
                    <span className="text-orange-500">→</span>
                  </button>
                </div>
              </div>
            )}

            {/* Confirmation */}
            {bookingStep === 'confirm' && (
              <div className="text-center py-12">
                <div className="text-8xl mb-6">🎉</div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Booking Confirmed!</h2>
                <p className="text-gray-500 mb-6">
                  Your appointment has been scheduled for {selectedDate} at {selectedTime}
                </p>
                <button
                  onClick={() => {
                    setActiveView('home');
                    setBookingStep('service');
                    setSelectedVendor(null);
                    setSelectedService(null);
                    setSelectedStaff(null);
                    loadInitialData();
                  }}
                  className="px-8 py-3 bg-orange-500 text-white font-semibold rounded-2xl hover:bg-orange-600 transition"
                >
                  Done
                </button>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-lg">
        <div className="max-w-7xl mx-auto flex justify-around py-2">
          {[
            { icon: '🏠', label: 'Home', id: 'home' },
            { icon: '📅', label: 'Bookings', id: 'bookings' },
            { icon: '🔍', label: 'Explore', id: 'explore' },
            { icon: '🐾', label: 'Pets', id: 'pets' },
            { icon: '👤', label: 'Profile', id: 'profile' },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => {
                if (item.id === 'home') setActiveView('home');
                // Add navigation for other tabs
              }}
              className={`flex flex-col items-center py-2 px-4 ${
                activeView === 'home' && item.id === 'home' ? 'text-orange-500' : 'text-gray-500'
              }`}
            >
              <span className="text-xl">{item.icon}</span>
              <span className="text-xs mt-1">{item.label}</span>
            </button>
          ))}
        </div>
      </nav>

      {/* Error Toast */}
      {error && (
        <div className="fixed bottom-24 left-4 right-4 bg-red-500 text-white p-4 rounded-2xl shadow-lg flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-white/80 hover:text-white">✕</button>
        </div>
      )}
    </div>
  );
}
