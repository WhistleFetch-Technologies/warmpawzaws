import React, { useState, useEffect } from 'react';
import { Button } from '../ui/button';
import { MapPin, Calendar, Users, Heart, Star, Clock, TrendingUp, ChevronRight, Filter, Search } from 'lucide-react';
import { toast } from 'sonner';
import { projectId, publicAnonKey } from '../../utils/supabase/info';

interface HolidayPackage {
  id: string;
  vendorId: string;
  vendorName: string;
  title: string;
  destination: string;
  description: string;
  photos: string[];
  tourType: 'group' | 'private' | 'family';
  duration: number; // days
  price: number;
  pricePerPet?: number;
  inclusions: string[];
  exclusions: string[];
  availableDates: string[];
  maxPets: number;
  maxPeople: number;
  currentBookings: number;
  rating: number;
  reviews: number;
  petTypes: string[];
  difficulty: 'easy' | 'moderate' | 'challenging';
  accommodation: string;
  meals: string;
  activities: string[];
}

interface PetHolidaysBrowserProps {
  customerId: string;
  onBookPackage?: (packageId: string) => void;
}

export function PetHolidaysBrowser({ customerId, onBookPackage }: PetHolidaysBrowserProps) {
  const [packages, setPackages] = useState<HolidayPackage[]>([]);
  const [filteredPackages, setFilteredPackages] = useState<HolidayPackage[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedPackage, setSelectedPackage] = useState<HolidayPackage | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  
  // Filters
  const [tourType, setTourType] = useState<string>('all');
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 100000]);
  const [duration, setDuration] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadHolidayPackages();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [packages, tourType, priceRange, duration, searchQuery]);

  const loadHolidayPackages = async () => {
    try {
      setLoading(true);

      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/holiday-packages`,
        { headers: { 'Authorization': `Bearer ${publicAnonKey}` } }
      );

      if (response.ok) {
        const data = await response.json();
        setPackages(data.packages || []);
      }
    } catch (error) {
      console.error('Error loading holiday packages:', error);
      toast.error('Failed to load holiday packages');
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...packages];

    // Tour type filter
    if (tourType !== 'all') {
      filtered = filtered.filter(p => p.tourType === tourType);
    }

    // Price range filter
    filtered = filtered.filter(p => p.price >= priceRange[0] && p.price <= priceRange[1]);

    // Duration filter
    if (duration !== 'all') {
      if (duration === 'short') filtered = filtered.filter(p => p.duration <= 3);
      if (duration === 'medium') filtered = filtered.filter(p => p.duration > 3 && p.duration <= 7);
      if (duration === 'long') filtered = filtered.filter(p => p.duration > 7);
    }

    // Search query
    if (searchQuery) {
      filtered = filtered.filter(p =>
        p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.destination.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.description.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    setFilteredPackages(filtered);
  };

  const handleBooking = async (pkg: HolidayPackage, selectedDate: string, numberOfPets: number, numberOfPeople: number) => {
    try {
      const bookingData = {
        customerId,
        packageId: pkg.id,
        vendorId: pkg.vendorId,
        packageTitle: pkg.title,
        destination: pkg.destination,
        tourType: pkg.tourType,
        selectedDate,
        numberOfPets,
        numberOfPeople,
        duration: pkg.duration,
        totalAmount: pkg.price + (pkg.pricePerPet ? pkg.pricePerPet * (numberOfPets - 1) : 0),
        inclusions: pkg.inclusions,
        status: 'pending_payment'
      };

      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/holiday-packages/book`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${publicAnonKey}`
          },
          body: JSON.stringify(bookingData)
        }
      );

      if (response.ok) {
        const data = await response.json();
        toast.success('Holiday package booked successfully!');
        if (onBookPackage) onBookPackage(data.booking.id);
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to book package');
      }
    } catch (error) {
      console.error('Error booking package:', error);
      toast.error('Error booking holiday package');
    }
  };

  const renderPackageCard = (pkg: HolidayPackage) => (
    <div
      key={pkg.id}
      onClick={() => setSelectedPackage(pkg)}
      className="bg-white rounded-xl overflow-hidden shadow-md hover:shadow-xl transition-all cursor-pointer border border-gray-200"
    >
      {/* Image */}
      <div className="relative h-48 bg-gradient-to-br from-orange-400 to-orange-600">
        {pkg.photos && pkg.photos[0] ? (
          <img src={pkg.photos[0]} alt={pkg.title} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <MapPin className="w-12 h-12 text-white opacity-50" />
          </div>
        )}
        
        {/* Badges */}
        <div className="absolute top-3 left-3 flex gap-2">
          <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
            pkg.tourType === 'group' ? 'bg-blue-500 text-white' :
            pkg.tourType === 'private' ? 'bg-purple-500 text-white' :
            'bg-green-500 text-white'
          }`}>
            {pkg.tourType === 'group' ? 'Group Tour' : pkg.tourType === 'private' ? 'Private Tour' : 'Family Tour'}
          </span>
        </div>

        {/* Rating */}
        <div className="absolute top-3 right-3 bg-white rounded-full px-2 py-1 flex items-center gap-1">
          <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
          <span className="text-sm font-semibold">{pkg.rating}</span>
        </div>

        {/* Trending */}
        {pkg.currentBookings > 5 && (
          <div className="absolute bottom-3 right-3 bg-orange-500 text-white rounded-full px-3 py-1 flex items-center gap-1 text-xs font-semibold">
            <TrendingUp className="w-3 h-3" />
            Trending
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-4">
        <h3 className="font-bold text-lg text-gray-900 mb-1">{pkg.title}</h3>
        <div className="flex items-center gap-1 text-gray-600 text-sm mb-2">
          <MapPin className="w-4 h-4" />
          <span>{pkg.destination}</span>
        </div>

        <p className="text-sm text-gray-600 mb-3 line-clamp-2">{pkg.description}</p>

        {/* Quick Info */}
        <div className="flex items-center gap-4 text-sm text-gray-600 mb-3">
          <div className="flex items-center gap-1">
            <Calendar className="w-4 h-4" />
            <span>{pkg.duration} days</span>
          </div>
          <div className="flex items-center gap-1">
            <Users className="w-4 h-4" />
            <span>Max {pkg.maxPets} pets</span>
          </div>
        </div>

        {/* Inclusions Preview */}
        <div className="flex flex-wrap gap-1 mb-3">
          {pkg.inclusions.slice(0, 3).map((inclusion, idx) => (
            <span key={idx} className="text-xs bg-green-50 text-green-700 px-2 py-1 rounded-full">
              {inclusion}
            </span>
          ))}
          {pkg.inclusions.length > 3 && (
            <span className="text-xs text-gray-500 px-2 py-1">+{pkg.inclusions.length - 3} more</span>
          )}
        </div>

        {/* Price & CTA */}
        <div className="flex items-center justify-between pt-3 border-t border-gray-200">
          <div>
            <span className="text-sm text-gray-600">Starting from</span>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-bold text-orange-600">₹{pkg.price.toLocaleString()}</span>
              <span className="text-sm text-gray-600">/trip</span>
            </div>
          </div>
          <Button className="bg-orange-600 hover:bg-orange-700">
            View Details
            <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        </div>
      </div>
    </div>
  );

  const renderPackageDetail = () => {
    if (!selectedPackage) return null;

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
          {/* Header */}
          <div className="sticky top-0 bg-white border-b border-gray-200 p-4 flex items-center justify-between">
            <h2 className="text-xl font-bold text-gray-900">{selectedPackage.title}</h2>
            <button onClick={() => setSelectedPackage(null)} className="text-gray-600 hover:text-gray-900">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Photo Gallery */}
          <div className="relative h-64 bg-gradient-to-br from-orange-400 to-orange-600">
            {selectedPackage.photos && selectedPackage.photos[0] ? (
              <img src={selectedPackage.photos[0]} alt={selectedPackage.title} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <MapPin className="w-16 h-16 text-white opacity-50" />
              </div>
            )}
          </div>

          <div className="p-6 space-y-6">
            {/* Quick Info */}
            <div className="flex items-center gap-6 flex-wrap">
              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-orange-600" />
                <span className="font-medium">{selectedPackage.duration} Days</span>
              </div>
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-orange-600" />
                <span className="font-medium">Max {selectedPackage.maxPets} Pets</span>
              </div>
              <div className="flex items-center gap-2">
                <Star className="w-5 h-5 text-yellow-500 fill-yellow-500" />
                <span className="font-medium">{selectedPackage.rating} ({selectedPackage.reviews} reviews)</span>
              </div>
            </div>

            {/* Description */}
            <div>
              <h3 className="font-semibold text-lg text-gray-900 mb-2">About This Trip</h3>
              <p className="text-gray-600">{selectedPackage.description}</p>
            </div>

            {/* Inclusions */}
            <div>
              <h3 className="font-semibold text-lg text-gray-900 mb-3">What's Included</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {selectedPackage.inclusions.map((inclusion, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span className="text-gray-700">{inclusion}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Exclusions */}
            {selectedPackage.exclusions.length > 0 && (
              <div>
                <h3 className="font-semibold text-lg text-gray-900 mb-3">What's Not Included</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {selectedPackage.exclusions.map((exclusion, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                      <span className="text-gray-700">{exclusion}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Activities */}
            {selectedPackage.activities && selectedPackage.activities.length > 0 && (
              <div>
                <h3 className="font-semibold text-lg text-gray-900 mb-3">Activities</h3>
                <div className="flex flex-wrap gap-2">
                  {selectedPackage.activities.map((activity, idx) => (
                    <span key={idx} className="px-3 py-1 bg-orange-50 text-orange-700 rounded-full text-sm">
                      {activity}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Pricing */}
            <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
              <h3 className="font-semibold text-lg text-gray-900 mb-3">Pricing</h3>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-gray-700">Base Price (1 pet)</span>
                  <span className="font-semibold text-gray-900">₹{selectedPackage.price.toLocaleString()}</span>
                </div>
                {selectedPackage.pricePerPet && (
                  <div className="flex items-center justify-between">
                    <span className="text-gray-700">Additional Pet</span>
                    <span className="font-semibold text-gray-900">₹{selectedPackage.pricePerPet.toLocaleString()}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Available Dates */}
            {selectedPackage.availableDates.length > 0 && (
              <div>
                <h3 className="font-semibold text-lg text-gray-900 mb-3">Available Dates</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {selectedPackage.availableDates.slice(0, 6).map((date, idx) => (
                    <div key={idx} className="px-3 py-2 bg-white border border-gray-200 rounded-lg text-center text-sm">
                      {new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* CTA */}
            <div className="flex gap-3">
              <Button onClick={() => setSelectedPackage(null)} variant="outline" className="flex-1">
                Close
              </Button>
              <Button 
                onClick={() => {
                  // Would open booking modal with date/pet selection
                  toast.success('Booking flow would open here');
                }}
                className="flex-1 bg-orange-600 hover:bg-orange-700"
              >
                Book This Trip
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero Section */}
      <div className="bg-gradient-to-r from-orange-500 to-orange-600 text-white py-12 px-4">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-3xl font-bold mb-2">Pet Holidays & Adventures</h1>
          <p className="text-orange-100">Explore curated travel experiences with your furry friends</p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Search & Filters */}
        <div className="bg-white rounded-xl shadow-md p-4 mb-6">
          <div className="flex gap-3 mb-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search destinations, activities..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              />
            </div>
            <Button
              onClick={() => setShowFilters(!showFilters)}
              variant="outline"
              className="flex items-center gap-2"
            >
              <Filter className="w-4 h-4" />
              Filters
            </Button>
          </div>

          {/* Filter Options */}
          {showFilters && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-gray-200">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Tour Type</label>
                <select
                  value={tourType}
                  onChange={(e) => setTourType(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                >
                  <option value="all">All Types</option>
                  <option value="group">Group Tours</option>
                  <option value="private">Private Tours</option>
                  <option value="family">Family Tours</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Duration</label>
                <select
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                >
                  <option value="all">Any Duration</option>
                  <option value="short">1-3 Days</option>
                  <option value="medium">4-7 Days</option>
                  <option value="long">8+ Days</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Price Range</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    placeholder="Min"
                    value={priceRange[0]}
                    onChange={(e) => setPriceRange([parseInt(e.target.value) || 0, priceRange[1]])}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                  />
                  <span>-</span>
                  <input
                    type="number"
                    placeholder="Max"
                    value={priceRange[1]}
                    onChange={(e) => setPriceRange([priceRange[0], parseInt(e.target.value) || 100000])}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Results */}
        <div className="mb-4 flex items-center justify-between">
          <p className="text-gray-600">
            {filteredPackages.length} {filteredPackages.length === 1 ? 'package' : 'packages'} found
          </p>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin w-8 h-8 border-4 border-orange-600 border-t-transparent rounded-full mx-auto mb-2"></div>
            <p className="text-gray-600">Loading holiday packages...</p>
          </div>
        ) : filteredPackages.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-xl shadow-md">
            <MapPin className="w-16 h-16 text-gray-400 mx-auto mb-3" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No packages found</h3>
            <p className="text-gray-600 mb-4">Try adjusting your filters</p>
            <Button onClick={() => {
              setTourType('all');
              setDuration('all');
              setSearchQuery('');
              setPriceRange([0, 100000]);
            }}>
              Clear Filters
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredPackages.map(renderPackageCard)}
          </div>
        )}
      </div>

      {/* Package Detail Modal */}
      {selectedPackage && renderPackageDetail()}
    </div>
  );
}
