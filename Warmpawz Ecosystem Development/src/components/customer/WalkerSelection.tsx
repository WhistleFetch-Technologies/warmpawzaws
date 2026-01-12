import { useState, useEffect } from 'react';
import { ArrowLeft, Star, MapPin, Award, Clock, DollarSign, ChevronRight, Filter, TrendingUp } from 'lucide-react';
import { Button } from '../ui/button';
import { WalkerDetails } from './WalkerDetails';
import { projectId, publicAnonKey } from '../../utils/supabase/info';

interface Walker {
  id: string;
  name: string;
  photo?: string;
  rating: number;
  reviews: number;
  experience: string;
  distance: number;
  price30min: number;
  price60min: number;
  priceCustom?: number;
  serviceRadius: number;
  specialties: string[];
  verified: boolean;
  location: {
    lat: number;
    lng: number;
    address: string;
  };
  availability: {
    morning: boolean;
    evening: boolean;
    anytime: boolean;
  };
  weeklyPrice?: number;
  monthlyPrice?: number;
  totalWalks: number;
  gender?: string;
  age?: number;
  policeVerified?: boolean;
}

interface BookingDetails {
  petId: string;
  petName: string;
  duration: '30' | '60' | 'custom';
  customDuration?: number;
  schedule: 'morning' | 'evening' | 'anytime';
  frequency: 'single' | 'weekly' | 'monthly';
  sessionsPerDay?: number;
}

export function WalkerSelection({
  bookingDetails,
  userLocation,
  phone,
  onBack,
  onSelectWalker
}: {
  bookingDetails: BookingDetails;
  userLocation: { lat: number; lng: number } | null;
  phone: string;
  onBack: () => void;
  onSelectWalker: (walkerId: string) => void;
}) {
  const [walkers, setWalkers] = useState<Walker[]>([]);
  const [filteredWalkers, setFilteredWalkers] = useState<Walker[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedWalker, setSelectedWalker] = useState<Walker | null>(null);
  const [sortBy, setSortBy] = useState<'distance' | 'rating' | 'price'>('rating');

  useEffect(() => {
    loadWalkers();
  }, []);

  useEffect(() => {
    filterAndSortWalkers();
  }, [walkers, sortBy, bookingDetails.schedule]);

  const loadWalkers = async () => {
    try {
      setLoading(true);
      
      // Load walkers from backend
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/walkers`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${publicAnonKey}`
          },
          body: JSON.stringify({
            userLocation: userLocation,
            schedule: bookingDetails.schedule
          })
        }
      );

      if (response.ok) {
        const result = await response.json();
        setWalkers(result.walkers || []);
      } else {
        // Demo data if backend not ready
        setWalkers(generateDemoWalkers());
      }
    } catch (error) {
      console.error('Error loading walkers:', error);
      setWalkers(generateDemoWalkers());
    } finally {
      setLoading(false);
    }
  };

  const generateDemoWalkers = (): Walker[] => {
    const demoWalkers: Walker[] = [
      {
        id: '1',
        name: 'Rajesh Kumar',
        rating: 4.9,
        reviews: 234,
        experience: '5 years',
        distance: 1.2,
        price30min: 199,
        price60min: 349,
        serviceRadius: 5,
        specialties: ['Large Dogs', 'Behavior Training', 'Senior Pets'],
        verified: true,
        location: {
          lat: userLocation?.lat || 12.9716,
          lng: userLocation?.lng || 77.5946,
          address: 'Koramangala, Bangalore'
        },
        availability: {
          morning: true,
          evening: true,
          anytime: true
        },
        weeklyPrice: 1199,
        monthlyPrice: 3999,
        totalWalks: 2340,
        gender: 'Male',
        age: 32,
        policeVerified: true
      },
      {
        id: '2',
        name: 'Priya Sharma',
        rating: 4.8,
        reviews: 189,
        experience: '3 years',
        distance: 2.1,
        price30min: 179,
        price60min: 329,
        serviceRadius: 3,
        specialties: ['Small Dogs', 'Puppies', 'Multiple Pets'],
        verified: true,
        location: {
          lat: userLocation?.lat || 12.9716,
          lng: userLocation?.lng || 77.5946,
          address: 'Indiranagar, Bangalore'
        },
        availability: {
          morning: true,
          evening: false,
          anytime: true
        },
        weeklyPrice: 1099,
        monthlyPrice: 3699,
        totalWalks: 1890,
        gender: 'Female',
        age: 28,
        policeVerified: true
      },
      {
        id: '3',
        name: 'Amit Patel',
        rating: 4.7,
        reviews: 156,
        experience: '4 years',
        distance: 0.8,
        price30min: 189,
        price60min: 339,
        serviceRadius: 4,
        specialties: ['Active Dogs', 'Jogging', 'Park Training'],
        verified: true,
        location: {
          lat: userLocation?.lat || 12.9716,
          lng: userLocation?.lng || 77.5946,
          address: 'HSR Layout, Bangalore'
        },
        availability: {
          morning: true,
          evening: true,
          anytime: false
        },
        weeklyPrice: 1149,
        monthlyPrice: 3849,
        totalWalks: 1560,
        gender: 'Male',
        age: 35,
        policeVerified: true
      },
      {
        id: '4',
        name: 'Sneha Reddy',
        rating: 5.0,
        reviews: 98,
        experience: '2 years',
        distance: 3.5,
        price30min: 169,
        price60min: 299,
        serviceRadius: 6,
        specialties: ['Puppies', 'First-time Owners', 'Gentle Care'],
        verified: true,
        location: {
          lat: userLocation?.lat || 12.9716,
          lng: userLocation?.lng || 77.5946,
          address: 'Whitefield, Bangalore'
        },
        availability: {
          morning: false,
          evening: true,
          anytime: true
        },
        weeklyPrice: 999,
        monthlyPrice: 3499,
        totalWalks: 980,
        gender: 'Female',
        age: 26,
        policeVerified: true
      },
      {
        id: '5',
        name: 'Karthik Nair',
        rating: 4.6,
        reviews: 145,
        experience: '3 years',
        distance: 1.9,
        price30min: 199,
        price60min: 359,
        serviceRadius: 5,
        specialties: ['All Breeds', 'GPS Tracking', 'Photo Updates'],
        verified: true,
        location: {
          lat: userLocation?.lat || 12.9716,
          lng: userLocation?.lng || 77.5946,
          address: 'Jayanagar, Bangalore'
        },
        availability: {
          morning: true,
          evening: true,
          anytime: true
        },
        weeklyPrice: 1199,
        monthlyPrice: 3999,
        totalWalks: 1450,
        gender: 'Male',
        age: 30,
        policeVerified: true
      }
    ];

    return demoWalkers;
  };

  const filterAndSortWalkers = () => {
    let filtered = [...walkers];

    // Filter by schedule availability
    filtered = filtered.filter(walker => {
      if (bookingDetails.schedule === 'morning') return walker.availability.morning;
      if (bookingDetails.schedule === 'evening') return walker.availability.evening;
      if (bookingDetails.schedule === 'anytime') return walker.availability.anytime;
      return true;
    });

    // Filter by service radius
    if (userLocation) {
      filtered = filtered.filter(walker => walker.distance <= walker.serviceRadius);
    }

    // Sort walkers
    filtered.sort((a, b) => {
      if (sortBy === 'distance') return a.distance - b.distance;
      if (sortBy === 'rating') return b.rating - a.rating;
      if (sortBy === 'price') {
        const priceA = bookingDetails.duration === '30' ? a.price30min : a.price60min;
        const priceB = bookingDetails.duration === '30' ? b.price30min : b.price60min;
        return priceA - priceB;
      }
      return 0;
    });

    setFilteredWalkers(filtered);
  };

  const getPrice = (walker: Walker) => {
    if (bookingDetails.frequency === 'weekly') return walker.weeklyPrice || 1199;
    if (bookingDetails.frequency === 'monthly') return walker.monthlyPrice || 3999;
    if (bookingDetails.duration === '30') return walker.price30min;
    if (bookingDetails.duration === '60') return walker.price60min;
    return walker.price60min;
  };

  const handleWalkerClick = (walker: Walker) => {
    setSelectedWalker(walker);
  };

  if (selectedWalker) {
    return (
      <WalkerDetails
        walker={selectedWalker}
        bookingDetails={bookingDetails}
        phone={phone}
        onBack={() => setSelectedWalker(null)}
        onConfirm={() => onSelectWalker(selectedWalker.id)}
      />
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center w-full max-w-[430px] mx-auto">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-[#FF8C42] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Finding walkers near you...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 w-full max-w-[430px] mx-auto pb-24">
      {/* Header */}
      <div className="bg-gradient-to-r from-[#FF8C42] to-[#FF6B35] px-6 pt-12 pb-6 sticky top-0 z-10">
        <div className="flex items-center gap-4 mb-4">
          <button onClick={onBack} className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm">
            <ArrowLeft className="w-5 h-5 text-white" />
          </button>
          <div className="flex-1">
            <h1 className="text-white text-xl font-bold">Available Walkers</h1>
            <p className="text-white/90 text-sm">{filteredWalkers.length} walkers near you</p>
          </div>
        </div>

        {/* Booking Summary */}
        <div className="bg-white/20 backdrop-blur-sm rounded-xl p-3 text-white text-sm">
          <div className="flex items-center justify-between">
            <span>Pet: {bookingDetails.petName}</span>
            <span>•</span>
            <span>{bookingDetails.duration === 'custom' ? `${bookingDetails.customDuration}min` : `${bookingDetails.duration}min`}</span>
            <span>•</span>
            <span className="capitalize">{bookingDetails.schedule}</span>
          </div>
        </div>
      </div>

      {/* Sort Filters */}
      <div className="bg-white px-6 py-4 border-b border-gray-200 sticky top-[200px] z-10">
        <div className="flex items-center gap-3">
          <Filter className="w-5 h-5 text-gray-600" />
          <div className="flex gap-2 overflow-x-auto scrollbar-hide">
            {[
              { value: 'rating', label: '⭐ Top Rated' },
              { value: 'distance', label: '📍 Nearest' },
              { value: 'price', label: '💰 Best Price' }
            ].map((sort) => (
              <button
                key={sort.value}
                onClick={() => setSortBy(sort.value as any)}
                className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
                  sortBy === sort.value
                    ? 'bg-[#FF8C42] text-white'
                    : 'bg-gray-100 text-gray-700'
                }`}
              >
                {sort.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Walkers List */}
      <div className="px-6 py-6 space-y-4">
        {filteredWalkers.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-20 h-20 bg-gray-100 rounded-full mx-auto mb-4 flex items-center justify-center">
              <MapPin className="w-10 h-10 text-gray-400" />
            </div>
            <h3 className="text-gray-800 font-semibold mb-2">No Walkers Available</h3>
            <p className="text-gray-600 text-sm">
              No walkers found for your selected time and location.
              <br />
              Try adjusting your preferences.
            </p>
          </div>
        ) : (
          filteredWalkers.map((walker) => (
            <button
              key={walker.id}
              onClick={() => handleWalkerClick(walker)}
              className="w-full bg-white rounded-2xl p-5 shadow-sm border border-gray-100 hover:shadow-md transition-all text-left"
            >
              <div className="flex gap-4">
                {/* Walker Photo */}
                <div className="relative flex-shrink-0">
                  <div className="w-20 h-20 rounded-2xl overflow-hidden bg-gradient-to-br from-orange-400 to-pink-400 flex items-center justify-center">
                    {walker.photo ? (
                      <img src={walker.photo} alt={walker.name} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-3xl text-white">👨</span>
                    )}
                  </div>
                  {walker.verified && (
                    <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center border-2 border-white">
                      <Award className="w-3 h-3 text-white" />
                    </div>
                  )}
                </div>

                {/* Walker Info */}
                <div className="flex-1">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h3 className="font-bold text-gray-800 mb-1">{walker.name}</h3>
                      <div className="flex items-center gap-3 text-xs text-gray-600">
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          {walker.distance.toFixed(1)} km away
                        </span>
                        <span>•</span>
                        <span>{walker.experience} exp</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 mb-2">
                    <div className="flex items-center gap-1 bg-yellow-50 px-2 py-1 rounded-full">
                      <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />
                      <span className="text-xs font-semibold text-gray-800">{walker.rating}</span>
                      <span className="text-xs text-gray-600">({walker.reviews})</span>
                    </div>
                    <div className="flex items-center gap-1 bg-green-50 px-2 py-1 rounded-full">
                      <TrendingUp className="w-3 h-3 text-green-600" />
                      <span className="text-xs font-semibold text-green-700">{walker.totalWalks}+ walks</span>
                    </div>
                  </div>

                  {/* Specialties */}
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {walker.specialties.slice(0, 2).map((specialty, index) => (
                      <span
                        key={index}
                        className="text-xs bg-orange-50 text-orange-700 px-2 py-0.5 rounded-full"
                      >
                        {specialty}
                      </span>
                    ))}
                    {walker.specialties.length > 2 && (
                      <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                        +{walker.specialties.length - 2} more
                      </span>
                    )}
                  </div>

                  {/* Price */}
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-2xl font-bold text-[#FF8C42]">₹{getPrice(walker)}</span>
                      <span className="text-xs text-gray-600 ml-1">
                        {bookingDetails.frequency === 'single' 
                          ? '/walk' 
                          : bookingDetails.frequency === 'weekly'
                          ? '/week'
                          : '/month'}
                      </span>
                    </div>
                    <ChevronRight className="w-5 h-5 text-gray-400" />
                  </div>
                </div>
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}