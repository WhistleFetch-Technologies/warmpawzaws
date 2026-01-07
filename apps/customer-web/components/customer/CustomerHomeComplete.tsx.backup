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
  weight_kg?: number;
  weight_change?: number;
  last_checkup?: string;
  mood?: string;
  is_active?: boolean;
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

interface Deal {
  id: string;
  title: string;
  discount_percent: number;
  original_price: number;
  discounted_price: number;
  icon: string;
  color: string;
}

interface CustomerProfile {
  id: string;
  name: string;
  phone: string;
  email: string;
  wallet_balance: number;
  addresses: Address[];
  profile_photo_url?: string;
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
// QUICK SERVICES (matching design mockup)
// ============================================================================

const QUICK_SERVICES = [
  { id: 'vet', name: 'Vet', icon: '🩺', color: 'bg-green-50 text-green-600' },
  { id: 'grooming', name: 'Grooming', icon: '✂️', color: 'bg-pink-50 text-pink-600' },
  { id: 'store', name: 'Store', icon: '🛍️', color: 'bg-orange-50 text-orange-600' },
  { id: 'boarding', name: 'Boarding', icon: '🏠', color: 'bg-blue-50 text-blue-600' },
];

// Today's Hot Deals (matching design mockup)
const HOT_DEALS: Deal[] = [
  { id: 'vet-checkup', title: 'Vet Checkup', discount_percent: 50, original_price: 998, discounted_price: 499, icon: '🩺', color: 'from-blue-500 to-blue-600' },
  { id: 'spa-grooming', title: 'Spa Grooming', discount_percent: 30, original_price: 1149, discounted_price: 799, icon: '✨', color: 'from-green-500 to-green-600' },
];

// ============================================================================
// PET EMOJI HELPER
// ============================================================================

const getPetEmoji = (species: string, name: string) => {
  const petEmojis: Record<string, string> = {
    'oreo': '🐕',
    'sky': '🐶',
    'blue': '🐩',
    'ginger': '🐱',
  };
  return petEmojis[name.toLowerCase()] || (species === 'dog' ? '🐕' : species === 'cat' ? '🐱' : '🐾');
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function CustomerHomeComplete({ phone }: { phone: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [customer, setCustomer] = useState<CustomerProfile | null>(null);
  const [pets, setPets] = useState<Pet[]>([]);
  const [selectedPet, setSelectedPet] = useState<Pet | null>(null);
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
  const [activeTab, setActiveTab] = useState('home');

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
        const loadedPets = petsResponse.pets || [];
        setPets(loadedPets);
        // Select first pet by default
        if (loadedPets.length > 0) {
          setSelectedPet(loadedPets[0]);
        }
      }

      // Load upcoming bookings
      const bookingsResponse = await apiClient.get<any>(`/customer/bookings/upcoming?phone=${phone}`);
      setUpcomingBookings(bookingsResponse.bookings || []);

    } catch (err: any) {
      console.error('Error loading data:', err);
      // Set mock data for UI demonstration
      setCustomer({
        id: 'demo',
        name: 'Priya',
        phone: phone,
        email: 'priya@example.com',
        wallet_balance: 500,
        addresses: [],
        profile_photo_url: undefined,
      });
      setPets([
        { id: '1', name: 'Oreo', species: 'dog', breed: 'Golden Retriever', age_years: 6, weight_kg: 12.5, weight_change: 0.5, last_checkup: 'Oct 15', mood: 'Happy', is_active: true },
        { id: '2', name: 'Sky', species: 'dog', breed: 'Husky', age_years: 3 },
        { id: '3', name: 'Blue', species: 'dog', breed: 'Poodle', age_years: 2 },
        { id: '4', name: 'Ginger', species: 'cat', breed: 'Persian', age_years: 4 },
      ]);
      setSelectedPet({ id: '1', name: 'Oreo', species: 'dog', breed: 'Golden Retriever', age_years: 6, weight_kg: 12.5, weight_change: 0.5, last_checkup: 'Oct 15', mood: 'Happy', is_active: true });
    } finally {
      setLoading(false);
    }
  };

  // ============================================================================
  // HELPER FUNCTIONS
  // ============================================================================

  const getFirstName = () => {
    return customer?.name?.split(' ')[0] || 'Pet Parent';
  };

  const getDaysAgo = (date: string) => {
    // Simple mock - in production calculate actual days
    return '14 days ago';
  };

  // ============================================================================
  // RENDER
  // ============================================================================

  if (loading && activeView === 'home') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading your profile...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Orange Header */}
      <header className="bg-primary px-4 pt-12 pb-6">
        <div className="flex items-center justify-between">
          {/* User Avatar & Greeting */}
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-white overflow-hidden border-2 border-white shadow-lg">
              {customer?.profile_photo_url ? (
                <img src={customer.profile_photo_url} alt={customer.name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-gray-200 flex items-center justify-center text-2xl">👩</div>
              )}
            </div>
            <div>
              <h1 className="text-white text-lg font-bold">Hi, {getFirstName()}!</h1>
              <p className="text-white/80 text-sm">How's {selectedPet?.name || 'your pet'} today?</p>
            </div>
          </div>
          
          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            <button className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center text-white hover:bg-white/30 transition">
              🔍
            </button>
            <button className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center text-white hover:bg-white/30 transition relative">
              🔔
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full text-[10px] flex items-center justify-center">2</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="px-4 -mt-2">
        {/* Pets Carousel */}
        <section className="mb-4">
          <div className="flex gap-4 overflow-x-auto pb-2 pt-2">
            {pets.map((pet) => (
              <button
                key={pet.id}
                onClick={() => setSelectedPet(pet)}
                className="flex-shrink-0 text-center group"
              >
                <div className={`w-16 h-16 rounded-full flex items-center justify-center text-2xl transition-all duration-200 ${
                  selectedPet?.id === pet.id 
                    ? 'ring-4 ring-primary ring-offset-2 bg-primary/10' 
                    : 'bg-gray-100 hover:bg-gray-200'
                }`}>
                  {pet.profile_photo_url ? (
                    <img src={pet.profile_photo_url} alt={pet.name} className="w-full h-full rounded-full object-cover" />
                  ) : (
                    getPetEmoji(pet.species, pet.name)
                  )}
                </div>
                <p className={`text-xs mt-1 font-medium ${selectedPet?.id === pet.id ? 'text-primary' : 'text-gray-600'}`}>
                  {pet.name}
                </p>
              </button>
            ))}
            {/* Add Pet Button */}
            <button className="flex-shrink-0 text-center">
              <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center text-2xl text-gray-400 hover:bg-gray-200 transition border-2 border-dashed border-gray-300">
                +
              </div>
              <p className="text-xs mt-1 text-gray-500">Add Pet</p>
            </button>
          </div>
        </section>

        {/* Pet Dashboard Card */}
        {selectedPet && (
          <section className="bg-white rounded-3xl p-5 shadow-lg mb-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className="text-2xl">🐾</span>
                <h3 className="font-bold text-gray-900 text-lg">{selectedPet.name}'s Dashboard</h3>
              </div>
              <span className="px-3 py-1 bg-green-100 text-green-600 text-xs font-semibold rounded-full">
                Active
              </span>
            </div>
            <p className="text-gray-500 text-sm mb-4">
              {selectedPet.breed} | {selectedPet.age_years} years old
            </p>
            
            {/* Stats Grid */}
            <div className="grid grid-cols-3 gap-3">
              {/* Weight */}
              <div className="bg-gray-50 rounded-2xl p-3">
                <div className="flex items-center gap-1 text-gray-500 text-xs mb-1">
                  <span>📊</span>
                  <span>Weight</span>
                </div>
                <p className="font-bold text-gray-900">{selectedPet.weight_kg || 12.5} kg</p>
                <p className="text-green-500 text-xs font-medium">+{selectedPet.weight_change || 0.5}%</p>
              </div>
              
              {/* Checkup */}
              <div className="bg-gray-50 rounded-2xl p-3">
                <div className="flex items-center gap-1 text-gray-500 text-xs mb-1">
                  <span>📅</span>
                  <span>Checkup</span>
                </div>
                <p className="font-bold text-gray-900">{selectedPet.last_checkup || 'Oct 15'}</p>
                <p className="text-gray-400 text-xs">{getDaysAgo(selectedPet.last_checkup || '')}</p>
              </div>
              
              {/* Mood */}
              <div className="bg-gray-50 rounded-2xl p-3">
                <div className="flex items-center gap-1 text-gray-500 text-xs mb-1">
                  <span>❤️</span>
                  <span>Mood</span>
                </div>
                <p className="font-bold text-gray-900">{selectedPet.mood || 'Happy'}</p>
                <p className="text-xl">😊</p>
              </div>
            </div>
          </section>
        )}

        {/* Today's Hot Deals */}
        <section className="mb-6">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-xl">⚡</span>
            <h3 className="font-bold text-gray-900 text-lg">Today's Hot Deals</h3>
          </div>
          <div className="flex gap-4 overflow-x-auto pb-2">
            {HOT_DEALS.map((deal) => (
              <div
                key={deal.id}
                className={`flex-shrink-0 w-44 bg-gradient-to-br ${deal.color} rounded-2xl p-4 text-white relative overflow-hidden`}
              >
                {/* Discount Badge */}
                <span className="absolute top-3 left-3 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full">
                  {deal.discount_percent}% OFF
                </span>
                
                {/* Icon */}
                <div className="absolute top-3 right-3 w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center text-2xl">
                  {deal.icon}
                </div>
                
                {/* Content */}
                <div className="mt-12">
                  <h4 className="font-bold text-lg">{deal.title}</h4>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-white/60 line-through text-sm">₹{deal.original_price}</span>
                    <span className="font-bold text-xl">₹{deal.discounted_price}</span>
                  </div>
                </div>
                
                {/* Book Button */}
                <button className="mt-4 w-full bg-white text-gray-800 font-semibold py-2 rounded-xl hover:bg-gray-100 transition">
                  Book Now
                </button>
              </div>
            ))}
          </div>
        </section>

        {/* Quick Services */}
        <section className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-gray-900 text-lg">Quick Services</h3>
            <button className="text-primary text-sm font-medium">See All</button>
          </div>
          <div className="grid grid-cols-4 gap-3">
            {QUICK_SERVICES.map((service) => (
              <button
                key={service.id}
                onClick={() => router.push(`/search?category=${service.id}`)}
                className="flex flex-col items-center"
              >
                <div className={`w-14 h-14 rounded-2xl ${service.color} flex items-center justify-center text-2xl mb-2 hover:scale-105 transition`}>
                  {service.icon}
                </div>
                <span className="text-xs text-gray-600 font-medium">{service.name}</span>
              </button>
            ))}
          </div>
        </section>

        {/* Upcoming Appointments */}
        {upcomingBookings.length > 0 && (
          <section className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-900 text-lg">Upcoming Appointments</h3>
              <button className="text-primary text-sm font-medium">View All</button>
            </div>
            <div className="space-y-3">
              {upcomingBookings.slice(0, 2).map((booking) => (
                <div key={booking.id} className="bg-white rounded-2xl p-4 shadow-sm flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center text-xl">
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
      </main>

      {/* Bottom Navigation - Matching Design */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-lg safe-area-bottom">
        <div className="flex justify-around py-2 px-4">
          {[
            { id: 'home', icon: '🏠', label: 'Home' },
            { id: 'services', icon: '🩺', label: 'Services' },
            { id: 'store', icon: '🛍️', label: 'Store' },
            { id: 'community', icon: '👥', label: 'Community' },
            { id: 'profile', icon: '👤', label: 'Profile' },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => {
                setActiveTab(item.id);
                if (item.id === 'profile') router.push('/profile');
                if (item.id === 'services') router.push('/search');
                if (item.id === 'store') router.push('/orders');
              }}
              className={`flex flex-col items-center py-2 px-3 rounded-xl transition ${
                activeTab === item.id 
                  ? 'text-primary' 
                  : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              <span className={`text-xl ${activeTab === item.id ? 'scale-110' : ''} transition`}>{item.icon}</span>
              <span className={`text-xs mt-1 ${activeTab === item.id ? 'font-semibold' : ''}`}>{item.label}</span>
            </button>
          ))}
        </div>
      </nav>

      {/* Error Toast */}
      {error && (
        <div className="fixed bottom-24 left-4 right-4 bg-red-500 text-white p-4 rounded-2xl shadow-lg flex items-center justify-between z-50">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-white/80 hover:text-white">✕</button>
        </div>
      )}
    </div>
  );
}
