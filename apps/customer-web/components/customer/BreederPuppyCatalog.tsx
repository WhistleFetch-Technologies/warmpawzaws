"use client";

import { useState, useEffect } from 'react';
import { ArrowLeft, ShieldCheck, Star, Filter, Search, ChevronRight, Check, X, Heart, Phone, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { apiClient } from '@/lib/api-client';
import { toast } from 'sonner';

interface BreederPuppyCatalogProps {
  phone?: string;
  customerPhone?: string;
  customerId?: string;
  petType?: string;
  vendorId?: string;
  onBack: () => void;
  onNavigate?: (screen: string, data?: any) => void;
  onSuccess?: (bookingId?: string) => void;
}

interface Puppy {
  id: string;
  name: string;
  petType: string;
  breed: string;
  age: number;
  ageUnit: string;
  gender: string;
  color: string;
  price: number;
  photos: string[];
  vaccinated: boolean;
  pedigree: boolean;
  kciRegistered: boolean;
  breeder: {
    id: string;
    name: string;
    city: string;
    phone: string;
    isCertified: boolean;
    rating: string;
    puppiesSold: number;
  };
}

export function BreederPuppyCatalog({
  phone,
  customerPhone,
  customerId,
  petType = 'dog',
  vendorId,
  onBack,
  onNavigate,
  onSuccess,
}: BreederPuppyCatalogProps) {
  const [loading, setLoading] = useState(true);
  const [puppies, setPuppies] = useState<Puppy[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBreed, setSelectedBreed] = useState('');
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 200000]);
  const [showFilters, setShowFilters] = useState(false);
  const [selectedPuppy, setSelectedPuppy] = useState<Puppy | null>(null);
  const [showInquiryModal, setShowInquiryModal] = useState(false);
  const [inquiryMessage, setInquiryMessage] = useState('');
  const [sendingInquiry, setSendingInquiry] = useState(false);

  const userPhone = customerPhone || phone;

  const popularBreeds = petType === 'dog'
    ? ['Golden Retriever', 'Labrador', 'German Shepherd', 'Beagle', 'Shih Tzu', 'Pomeranian']
    : ['Persian', 'Siamese', 'Maine Coon', 'British Shorthair', 'Ragdoll', 'Bengal'];

  useEffect(() => {
    loadPuppies();
  }, [petType, selectedBreed, vendorId]);

  const loadPuppies = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (petType) params.append('petType', petType);
      if (selectedBreed) params.append('breed', selectedBreed);
      if (vendorId) params.append('vendorId', vendorId);
      if (priceRange[0] > 0) params.append('priceMin', priceRange[0].toString());
      if (priceRange[1] < 200000) params.append('priceMax', priceRange[1].toString());

      const response = await apiClient.get<any>(`/breeder/puppies?${params.toString()}`);
      setPuppies(response.puppies || []);
    } catch (error) {
      console.error('Error loading puppies:', error);
      setPuppies([]);
    } finally {
      setLoading(false);
    }
  };

  const handlePuppySelect = (puppy: Puppy) => {
    setSelectedPuppy(puppy);
  };

  const handleInquiry = async () => {
    if (!selectedPuppy) return;

    try {
      setSendingInquiry(true);
      await apiClient.post('/breeder/inquiry', {
        customerId,
        customerPhone: userPhone,
        puppyId: selectedPuppy.id,
        message: inquiryMessage || `I'm interested in ${selectedPuppy.name}. Please contact me.`,
      });

      toast.success('Inquiry sent! The breeder will contact you soon.');
      setShowInquiryModal(false);
      setInquiryMessage('');
      setSelectedPuppy(null);
    } catch (error) {
      console.error('Error sending inquiry:', error);
      toast.error('Failed to send inquiry');
    } finally {
      setSendingInquiry(false);
    }
  };

  const handleReserve = async () => {
    if (!selectedPuppy || !customerId) {
      toast.error('Please login to reserve');
      return;
    }

    try {
      setSendingInquiry(true);
      const response = await apiClient.post<any>('/breeder/reserve', {
        customerId,
        puppyId: selectedPuppy.id,
      });

      toast.success('Puppy reserved! Complete the deposit to confirm.');
      onNavigate?.('payment', { bookingId: response.reservation?.id, amount: selectedPuppy.price * 0.2 });
    } catch (error) {
      console.error('Error reserving puppy:', error);
      toast.error('Failed to reserve');
    } finally {
      setSendingInquiry(false);
    }
  };

  const filteredPuppies = puppies.filter(puppy => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      puppy.name.toLowerCase().includes(query) ||
      puppy.breed.toLowerCase().includes(query) ||
      puppy.breeder.name.toLowerCase().includes(query)
    );
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-amber-50 to-white flex items-center justify-center max-w-md mx-auto">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-amber-500 border-t-transparent mx-auto mb-4"></div>
          <p className="text-gray-600">Finding adorable puppies...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FF8C42] max-w-md mx-auto pb-24">
      {/* Header */}
      <div className="px-6 pt-12 pb-6">
        <div className="flex items-center gap-4 mb-6">
          <button
            onClick={onBack}
            className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center hover:bg-white/30 transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-white" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-white">
              {petType === 'dog' ? 'Puppies' : 'Kittens'} for Sale
            </h1>
            <p className="text-white/80 text-sm">{puppies.length} available</p>
          </div>
        </div>

        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <Input
            placeholder="Search by breed, name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-white/95 border-0 text-gray-800"
          />
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="absolute right-3 top-1/2 transform -translate-y-1/2"
          >
            <Filter className="w-5 h-5 text-gray-500" />
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="bg-white rounded-t-[32px] px-4 pt-6 min-h-[calc(100vh-200px)]">
        {/* Breed Filter */}
        <div className="flex gap-2 overflow-x-auto pb-4 scrollbar-hide mb-4">
          <button
            onClick={() => setSelectedBreed('')}
            className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap ${
              !selectedBreed
                ? 'bg-amber-500 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            All Breeds
          </button>
          {popularBreeds.map((breed) => (
            <button
              key={breed}
              onClick={() => setSelectedBreed(breed)}
              className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap ${
                selectedBreed === breed
                  ? 'bg-amber-500 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {breed}
            </button>
          ))}
        </div>

        {/* Puppies Grid */}
        {filteredPuppies.length === 0 ? (
          <Card className="p-8 text-center">
            <span className="text-6xl mb-4 block">{petType === 'dog' ? '🐕' : '🐱'}</span>
            <h3 className="font-semibold text-gray-900 mb-2">No {petType === 'dog' ? 'Puppies' : 'Kittens'} Found</h3>
            <p className="text-sm text-gray-500">Try adjusting your filters</p>
          </Card>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {filteredPuppies.map((puppy) => (
              <div
                key={puppy.id}
                onClick={() => handlePuppySelect(puppy)}
                className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden cursor-pointer hover:shadow-md transition-shadow"
              >
                <div className="aspect-square bg-gradient-to-br from-amber-100 to-orange-100 relative">
                  {puppy.photos && puppy.photos[0] ? (
                    <img
                      src={puppy.photos[0]}
                      alt={puppy.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <span className="text-5xl">{petType === 'dog' ? '🐕' : '🐱'}</span>
                    </div>
                  )}
                  {puppy.breeder.isCertified && (
                    <Badge className="absolute top-2 left-2 bg-green-500 text-white text-xs">
                      <ShieldCheck className="w-3 h-3 mr-1" /> Verified
                    </Badge>
                  )}
                  <button className="absolute top-2 right-2 w-8 h-8 bg-white/80 backdrop-blur-sm rounded-full flex items-center justify-center">
                    <Heart className="w-4 h-4 text-rose-500" />
                  </button>
                </div>
                <div className="p-3">
                  <h3 className="font-bold text-gray-900 text-sm truncate">{puppy.name}</h3>
                  <p className="text-xs text-gray-500 truncate">{puppy.breed}</p>
                  <div className="flex items-center justify-between mt-2">
                    <div className="flex items-center gap-1 text-xs text-gray-500">
                      <span>{puppy.age} {puppy.ageUnit}</span>
                      <span>•</span>
                      <span>{puppy.gender}</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    <p className="text-amber-600 font-bold">₹{puppy.price.toLocaleString()}</p>
                    <div className="flex items-center gap-1 text-xs text-gray-500">
                      <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />
                      {puppy.breeder.rating}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Puppy Detail Modal */}
      {selectedPuppy && !showInquiryModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end">
          <div className="bg-white w-full max-w-md mx-auto rounded-t-3xl max-h-[90vh] overflow-y-auto">
            {/* Puppy Image */}
            <div className="aspect-video bg-gradient-to-br from-amber-100 to-orange-100 relative">
              {selectedPuppy.photos && selectedPuppy.photos[0] ? (
                <img
                  src={selectedPuppy.photos[0]}
                  alt={selectedPuppy.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <span className="text-7xl">{petType === 'dog' ? '🐕' : '🐱'}</span>
                </div>
              )}
              <button
                onClick={() => setSelectedPuppy(null)}
                className="absolute top-4 right-4 w-10 h-10 bg-white/80 backdrop-blur-sm rounded-full flex items-center justify-center"
              >
                <X className="w-5 h-5 text-gray-700" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {/* Puppy Info */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h2 className="text-2xl font-bold text-gray-900">{selectedPuppy.name}</h2>
                  <span className="text-amber-600 font-bold text-xl">₹{selectedPuppy.price.toLocaleString()}</span>
                </div>
                <p className="text-gray-600">{selectedPuppy.breed} • {selectedPuppy.age} {selectedPuppy.ageUnit} • {selectedPuppy.gender}</p>
              </div>

              {/* Quick Info Badges */}
              <div className="flex flex-wrap gap-2">
                {selectedPuppy.vaccinated && (
                  <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                    <Check className="w-3 h-3 mr-1" /> Vaccinated
                  </Badge>
                )}
                {selectedPuppy.pedigree && (
                  <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">
                    <Check className="w-3 h-3 mr-1" /> Pedigree
                  </Badge>
                )}
                {selectedPuppy.kciRegistered && (
                  <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                    <Check className="w-3 h-3 mr-1" /> KCI Registered
                  </Badge>
                )}
              </div>

              {/* Breeder Info */}
              <div className="bg-gray-50 rounded-xl p-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center text-xl font-bold text-amber-600">
                    {selectedPuppy.breeder.name.charAt(0)}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-semibold text-gray-900">{selectedPuppy.breeder.name}</h4>
                      {selectedPuppy.breeder.isCertified && (
                        <ShieldCheck className="w-4 h-4 text-green-600" />
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <span>{selectedPuppy.breeder.city}</span>
                      <span>•</span>
                      <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                      <span>{selectedPuppy.breeder.rating}</span>
                      <span>•</span>
                      <span>{selectedPuppy.breeder.puppiesSold} sold</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="space-y-3 pt-4">
                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => setShowInquiryModal(true)}
                  >
                    <MessageCircle className="w-4 h-4 mr-2" />
                    Send Inquiry
                  </Button>
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => window.open(`tel:${selectedPuppy.breeder.phone}`)}
                  >
                    <Phone className="w-4 h-4 mr-2" />
                    Call
                  </Button>
                </div>
                <Button
                  className="w-full bg-gradient-to-r from-amber-500 to-orange-600 text-white py-6"
                  onClick={handleReserve}
                >
                  Reserve with 20% Deposit (₹{Math.round(selectedPuppy.price * 0.2).toLocaleString()})
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Inquiry Modal */}
      {showInquiryModal && selectedPuppy && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-2xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-900">Send Inquiry</h3>
              <button onClick={() => setShowInquiryModal(false)}>
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <p className="text-sm text-gray-600">
              Inquiring about: <span className="font-semibold">{selectedPuppy.name}</span> ({selectedPuppy.breed})
            </p>

            <div>
              <Label className="mb-2 block">Your Message</Label>
              <Textarea
                placeholder="Hi, I'm interested in this puppy. Could you please share more details?"
                value={inquiryMessage}
                onChange={(e) => setInquiryMessage(e.target.value)}
                rows={4}
              />
            </div>

            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => setShowInquiryModal(false)}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={handleInquiry}
                disabled={sendingInquiry}
                className="flex-1 bg-gradient-to-r from-amber-500 to-orange-600 text-white"
              >
                {sendingInquiry ? 'Sending...' : 'Send Inquiry'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
