import React, { useState, useEffect } from 'react';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { Badge } from '../ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../ui/tabs';
import { 
  MapPin, Clock, Star, Phone, Share2, Heart, 
  ChefHat, Wifi, Car, Utensils, Info, Image as ImageIcon 
} from 'lucide-react';
import { toast } from 'sonner@2.0.3';
import { projectId, publicAnonKey } from '../../utils/supabase/info';
import { PetCafeTableBooking } from './booking/PetCafeTableBooking';

interface CafeDetails {
  id: string;
  name: string;
  description: string;
  address: string;
  rating: number;
  reviewsCount: number;
  costForTwo: number;
  cuisines: string[];
  photos: string[];
  amenities: string[];
  menu: { category: string; items: { name: string; price: number; desc?: string }[] }[];
  openHours: string;
  phone: string;
  coordinates: { lat: number; lng: number };
}

interface PetCafeListingEnhancedProps {
  cafeId: string;
  onBack: () => void;
}

export function PetCafeListingEnhanced({ cafeId, onBack }: PetCafeListingEnhancedProps) {
  const [cafe, setCafe] = useState<CafeDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [showBooking, setShowBooking] = useState(false);
  const [isFavorite, setIsFavorite] = useState(false);

  useEffect(() => {
    loadCafeDetails();
  }, [cafeId]);

  const loadCafeDetails = async () => {
    try {
      setLoading(true);
      // In real implementation, fetch from backend. Mocking for now as per "Full Implementation" constraints without DB
      // const response = await fetch(...);
      
      // Mock Data
      setTimeout(() => {
        setCafe({
          id: cafeId,
          name: 'The Wagging Tail Cafe',
          description: 'A cozy spot for you and your furry friends. Enjoy gourmet coffee while your pet plays in our dedicated play area.',
          address: '123, Pet Street, Indiranagar, Bangalore',
          rating: 4.8,
          reviewsCount: 342,
          costForTwo: 800,
          cuisines: ['Cafe', 'Continental', 'Desserts'],
          photos: [
            'https://images.unsplash.com/photo-1554118811-1e0d58224f24?auto=format&fit=crop&q=80&w=800',
            'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&q=80&w=800',
            'https://images.unsplash.com/photo-1559339352-11d035aa65de?auto=format&fit=crop&q=80&w=800'
          ],
          amenities: ['Pet Menu', 'Play Area', 'WiFi', 'Parking', 'Outdoor Seating'],
          menu: [
            { 
              category: 'Human Treats', 
              items: [
                { name: 'Cappuccino', price: 150, desc: 'Freshly brewed' },
                { name: 'Avocado Toast', price: 250, desc: 'Sourdough with fresh guacamole' }
              ] 
            },
            {
              category: 'Pet Delights',
              items: [
                { name: 'Chicken Pup-sicle', price: 120, desc: 'Frozen chicken broth treat' },
                { name: 'Doggie Pizza', price: 200, desc: 'Meat-based crust with cheese' }
              ]
            }
          ],
          openHours: '10:00 AM - 10:00 PM',
          phone: '+91 98765 43210',
          coordinates: { lat: 12.9716, lng: 77.5946 }
        });
        setLoading(false);
      }, 1000);

    } catch (error) {
      console.error(error);
      toast.error('Failed to load cafe details');
    }
  };

  if (showBooking && cafe) {
    return (
      <PetCafeTableBooking 
        vendorId={cafe.id}
        vendorName={cafe.name}
        onBack={() => setShowBooking(false)}
        onBookingComplete={(id) => {
          setShowBooking(false);
          // Navigate to success or show success modal
        }}
      />
    );
  }

  if (loading || !cafe) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Hero Header */}
      <div className="relative h-64 md:h-80 w-full overflow-hidden bg-gray-900">
        <img 
          src={cafe.photos[0]} 
          alt={cafe.name} 
          className="w-full h-full object-cover opacity-90"
        />
        <div className="absolute top-4 left-4 z-10">
          <Button variant="secondary" size="icon" onClick={onBack} className="rounded-full bg-white/80 hover:bg-white">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          </Button>
        </div>
        <div className="absolute top-4 right-4 flex gap-2 z-10">
          <Button variant="secondary" size="icon" onClick={() => setIsFavorite(!isFavorite)} className="rounded-full bg-white/80 hover:bg-white">
            <Heart className={`w-5 h-5 ${isFavorite ? 'fill-red-500 text-red-500' : ''}`} />
          </Button>
          <Button variant="secondary" size="icon" className="rounded-full bg-white/80 hover:bg-white">
            <Share2 className="w-5 h-5" />
          </Button>
        </div>
        <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent text-white">
          <h1 className="text-2xl font-bold">{cafe.name}</h1>
          <div className="flex items-center gap-2 mt-1 text-sm text-gray-200">
            <span>{cafe.cuisines.join(', ')}</span>
            <span>•</span>
            <span>₹{cafe.costForTwo} for two</span>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="p-4 space-y-4">
        {/* Rating & Action Bar */}
        <div className="flex items-center justify-between bg-white p-3 rounded-xl shadow-sm">
          <div className="flex flex-col">
            <div className="flex items-center gap-1">
              <div className="bg-green-600 text-white text-sm font-bold px-2 py-0.5 rounded flex items-center gap-1">
                {cafe.rating} <Star className="w-3 h-3 fill-white" />
              </div>
              <span className="text-xs text-gray-500 underline">{cafe.reviewsCount} reviews</span>
            </div>
          </div>
          <div className="flex gap-3">
            <a href={`tel:${cafe.phone}`} className="flex flex-col items-center gap-1 text-gray-600">
              <Phone className="w-5 h-5 text-blue-600" />
              <span className="text-[10px]">Call</span>
            </a>
            <button className="flex flex-col items-center gap-1 text-gray-600">
              <MapPin className="w-5 h-5 text-orange-600" />
              <span className="text-[10px]">Map</span>
            </button>
          </div>
        </div>

        {/* Info Card */}
        <div className="bg-white p-4 rounded-xl shadow-sm space-y-3">
          <div className="flex items-start gap-3">
            <MapPin className="w-5 h-5 text-gray-400 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-gray-700">{cafe.address}</p>
          </div>
          <div className="flex items-center gap-3">
            <Clock className="w-5 h-5 text-gray-400 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-green-600">Open Now</p>
              <p className="text-xs text-gray-500">{cafe.openHours}</p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="bg-white rounded-xl shadow-sm overflow-hidden">
          <TabsList className="w-full flex border-b rounded-none p-0 h-12 bg-white">
            <TabsTrigger value="overview" className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-orange-600 data-[state=active]:text-orange-600">Overview</TabsTrigger>
            <TabsTrigger value="menu" className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-orange-600 data-[state=active]:text-orange-600">Menu</TabsTrigger>
            <TabsTrigger value="photos" className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-orange-600 data-[state=active]:text-orange-600">Photos</TabsTrigger>
          </TabsList>

          <div className="p-4">
            <TabsContent value="overview" className="space-y-6 mt-0">
              <div>
                <h3 className="font-semibold text-gray-900 mb-2">About this place</h3>
                <p className="text-sm text-gray-600 leading-relaxed">{cafe.description}</p>
              </div>

              <div>
                <h3 className="font-semibold text-gray-900 mb-3">Amenities</h3>
                <div className="grid grid-cols-2 gap-3">
                  {cafe.amenities.map((item) => (
                    <div key={item} className="flex items-center gap-2 text-sm text-gray-600">
                      <CheckCircle className="w-4 h-4 text-green-500" />
                      {item}
                    </div>
                  ))}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="menu" className="mt-0 space-y-6">
              {cafe.menu.map((section) => (
                <div key={section.category}>
                  <h3 className="font-bold text-gray-900 mb-3 border-l-4 border-orange-500 pl-3">{section.category}</h3>
                  <div className="space-y-4">
                    {section.items.map((item) => (
                      <div key={item.name} className="flex justify-between items-start border-b pb-3 last:border-0">
                        <div>
                          <div className="flex items-center gap-2">
                            <div className="w-4 h-4 border border-green-500 flex items-center justify-center p-[2px]">
                              <div className="w-full h-full bg-green-500 rounded-full"></div>
                            </div>
                            <h4 className="font-medium text-gray-900">{item.name}</h4>
                          </div>
                          {item.desc && <p className="text-xs text-gray-500 mt-1 pl-6">{item.desc}</p>}
                          <p className="text-sm font-semibold text-gray-700 mt-1 pl-6">₹{item.price}</p>
                        </div>
                        {/* Placeholder for Add to Cart or Image if needed */}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </TabsContent>

            <TabsContent value="photos" className="mt-0">
              <div className="grid grid-cols-2 gap-2">
                {cafe.photos.map((photo, idx) => (
                  <div key={idx} className="aspect-square rounded-lg overflow-hidden">
                    <img src={photo} alt={`Cafe ${idx}`} className="w-full h-full object-cover" />
                  </div>
                ))}
              </div>
            </TabsContent>
          </div>
        </Tabs>
      </div>

      {/* Sticky Footer */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-gray-200 shadow-lg z-20">
        <Button 
          onClick={() => setShowBooking(true)}
          className="w-full h-12 text-lg bg-orange-600 hover:bg-orange-700 shadow-orange-200"
        >
          Book a Table
        </Button>
      </div>
    </div>
  );
}

const CheckCircle = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
);
