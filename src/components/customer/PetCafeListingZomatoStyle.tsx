import React, { useState, useEffect } from 'react';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { Badge } from '../ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../ui/tabs';
import { 
  MapPin, Clock, Star, Phone, Share2, Heart, 
  ChefHat, Wifi, Car, Utensils, Info, Image as ImageIcon,
  Navigation, CalendarCheck, ShieldCheck, FileText
} from 'lucide-react';
import { toast } from 'sonner';
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
  menu: { category: string; items: { name: string; price: number; desc?: string; isVeg?: boolean }[] }[];
  openHours: string;
  phone: string;
  coordinates: { lat: number; lng: number };
  petPolicy?: string[];
  bookingPolicy?: string[];
}

interface PetCafeListingZomatoStyleProps {
  cafeId: string;
  onBack: () => void;
  onNavigate?: (screen: string, data?: any) => void;
}

export function PetCafeListingZomatoStyle({ cafeId, onBack, onNavigate }: PetCafeListingZomatoStyleProps) {
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
      
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/cafe/profile/${cafeId}`,
        { headers: { 'Authorization': `Bearer ${publicAnonKey}` } }
      );

      if (response.ok) {
        const data = await response.json();
        const profile = data.profile;
        
        // Mocking missing data for Zomato-style fullness if API is incomplete
        if (!profile.petPolicy) {
             profile.petPolicy = [
                 "Pets must remain on leash unless in play zone",
                 "Up-to-date vaccinations required",
                 "Aggressive pets may be asked to leave"
             ];
        }
        if (!profile.menu || profile.menu.length === 0) {
            profile.menu = [
                {
                    category: "Signature Bowls",
                    items: [
                        { name: "Chicken & Rice Bowl", price: 350, desc: "Grilled chicken breast with brown rice", isVeg: false },
                        { name: "Veggie Delight", price: 280, desc: "Steamed veggies with quinoa", isVeg: true }
                    ]
                },
                {
                    category: "Pet Treats",
                    items: [
                        { name: "Pup Cup", price: 120, desc: "Whipped cream with dog biscuit", isVeg: true },
                        { name: "Chicken Jerky", price: 180, desc: "Dehydrated chicken strips", isVeg: false }
                    ]
                }
            ];
        }

        setCafe(profile);
      } else {
        toast.error('Failed to load cafe details');
      }

    } catch (error) {
      console.error(error);
      toast.error('Error loading cafe details');
    } finally {
      setLoading(false);
    }
  };

  const openDirections = () => {
      if (!cafe) return;
      const url = `https://www.google.com/maps/dir/?api=1&destination=${cafe.coordinates.lat},${cafe.coordinates.lng}`;
      window.open(url, '_blank');
  };

  if (showBooking && cafe) {
    return (
      <PetCafeTableBooking 
        vendorId={cafe.id}
        vendorName={cafe.name}
        onBack={() => setShowBooking(false)}
        onBookingComplete={(id) => {
          setShowBooking(false);
          toast.success("Table reserved successfully!");
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
      {/* Hero Header - Immersive Image Slider */}
      <div className="relative h-72 w-full overflow-hidden bg-gray-900 group">
        <img 
          src={cafe.photos[0]} 
          alt={cafe.name} 
          className="w-full h-full object-cover opacity-95 transition-transform duration-500 group-hover:scale-105"
        />
        <div className="absolute top-0 left-0 right-0 p-4 flex justify-between items-start bg-gradient-to-b from-black/60 to-transparent">
          <Button variant="secondary" size="icon" onClick={onBack} className="rounded-full bg-white/20 backdrop-blur-md hover:bg-white/40 text-white border-0">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          </Button>
          <div className="flex gap-2">
            <Button variant="secondary" size="icon" onClick={() => setIsFavorite(!isFavorite)} className="rounded-full bg-white/20 backdrop-blur-md hover:bg-white/40 text-white border-0">
              <Heart className={`w-6 h-6 ${isFavorite ? 'fill-red-500 text-red-500' : ''}`} />
            </Button>
            <Button variant="secondary" size="icon" className="rounded-full bg-white/20 backdrop-blur-md hover:bg-white/40 text-white border-0">
              <Share2 className="w-6 h-6" />
            </Button>
          </div>
        </div>
        
        {/* Gallery Preview Badges */}
        <div className="absolute bottom-4 right-4 bg-black/60 backdrop-blur text-white text-xs px-2 py-1 rounded flex items-center gap-1">
            <ImageIcon className="w-3 h-3" />
            <span>{cafe.photos.length} Photos</span>
        </div>
      </div>

      {/* Main Content */}
      <div className="bg-white -mt-4 relative rounded-t-3xl shadow-xl border-t border-gray-100 p-5 space-y-6">
          
        {/* Title & Key Stats */}
        <div>
            <div className="flex justify-between items-start">
                <h1 className="text-2xl font-bold text-gray-900">{cafe.name}</h1>
                <div className="bg-green-600 text-white text-sm font-bold px-2 py-1 rounded-lg flex flex-col items-center leading-none">
                    <span className="text-lg flex items-center gap-0.5">{cafe.rating} <Star className="w-3 h-3 fill-white" /></span>
                    <span className="text-[10px] font-normal opacity-90">{cafe.reviewsCount} reviews</span>
                </div>
            </div>
            <p className="text-sm text-gray-500 mt-1">{cafe.cuisines.join(', ')}</p>
            <p className="text-sm text-gray-500">₹{cafe.costForTwo} for two (approx.)</p>
        </div>

        {/* Action Buttons - Zomato Style */}
        <div className="grid grid-cols-2 gap-3">
             <Button variant="outline" className="border-red-100 bg-red-50 text-red-600 hover:bg-red-100 hover:text-red-700 h-10" onClick={openDirections}>
                 <Navigation className="w-4 h-4 mr-2" /> Direction
             </Button>
             <Button variant="outline" className="border-blue-100 bg-blue-50 text-blue-600 hover:bg-blue-100 hover:text-blue-700 h-10">
                 <Phone className="w-4 h-4 mr-2" /> Call
             </Button>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="w-full flex justify-start overflow-x-auto bg-transparent border-b h-auto p-0 gap-6">
            <TabsTrigger value="overview" className="rounded-none border-b-2 border-transparent data-[state=active]:border-red-500 data-[state=active]:text-red-500 px-0 pb-2 bg-transparent text-gray-500 font-semibold">Overview</TabsTrigger>
            <TabsTrigger value="menu" className="rounded-none border-b-2 border-transparent data-[state=active]:border-red-500 data-[state=active]:text-red-500 px-0 pb-2 bg-transparent text-gray-500 font-semibold">Menu</TabsTrigger>
            <TabsTrigger value="reviews" className="rounded-none border-b-2 border-transparent data-[state=active]:border-red-500 data-[state=active]:text-red-500 px-0 pb-2 bg-transparent text-gray-500 font-semibold">Reviews</TabsTrigger>
            <TabsTrigger value="photos" className="rounded-none border-b-2 border-transparent data-[state=active]:border-red-500 data-[state=active]:text-red-500 px-0 pb-2 bg-transparent text-gray-500 font-semibold">Photos</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-4 space-y-6">
             {/* Map Integration Preview */}
             <div className="rounded-xl overflow-hidden border border-gray-200 h-32 relative bg-gray-100" onClick={openDirections}>
                 {/* Simulated Map Background */}
                 <div className="absolute inset-0 opacity-50 bg-[url('https://maps.googleapis.com/maps/api/staticmap?center=28.61,77.20&zoom=14&size=400x200&key=YOUR_KEY')] bg-cover bg-center"></div>
                 <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                     <div className="bg-white/90 backdrop-blur px-3 py-1.5 rounded-lg shadow-sm text-xs font-semibold text-gray-700 flex items-center gap-1">
                         <MapPin className="w-4 h-4 text-red-500" />
                         {cafe.address.substring(0, 30)}...
                     </div>
                 </div>
             </div>

             {/* Pet Policy */}
             <div className="bg-yellow-50 border border-yellow-100 rounded-xl p-4">
                 <h3 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
                     <ShieldCheck className="w-5 h-5 text-yellow-600" /> Pet Policy
                 </h3>
                 <ul className="space-y-2">
                     {cafe.petPolicy?.map((p, i) => (
                         <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                             <div className="w-1.5 h-1.5 rounded-full bg-yellow-400 mt-1.5 flex-shrink-0" />
                             {p}
                         </li>
                     ))}
                 </ul>
             </div>

             {/* Amenities */}
             <div>
                 <h3 className="font-bold text-gray-900 mb-3">Amenities</h3>
                 <div className="flex flex-wrap gap-2">
                     {cafe.amenities.map(a => (
                         <Badge key={a} variant="outline" className="bg-gray-50 border-gray-200 text-gray-600 py-1.5">
                             <CheckCircle className="w-3 h-3 mr-1 text-green-500" /> {a}
                         </Badge>
                     ))}
                 </div>
             </div>
          </TabsContent>

          <TabsContent value="menu" className="mt-4">
             <div className="space-y-6">
                 {cafe.menu.map((category) => (
                     <div key={category.category}>
                         <h3 className="text-lg font-bold text-gray-800 mb-3">{category.category}</h3>
                         <div className="space-y-4">
                             {category.items.map((item) => (
                                 <div key={item.name} className="flex justify-between items-start group">
                                     <div className="flex-1 pr-4">
                                         <div className="flex items-center gap-2">
                                             <div className={`w-4 h-4 border flex items-center justify-center p-[2px] ${item.isVeg ? 'border-green-600' : 'border-red-600'}`}>
                                                 <div className={`w-full h-full rounded-full ${item.isVeg ? 'bg-green-600' : 'bg-red-600'}`}></div>
                                             </div>
                                             <h4 className="font-semibold text-gray-900">{item.name}</h4>
                                         </div>
                                         <p className="text-sm font-medium text-gray-900 mt-1">₹{item.price}</p>
                                         <p className="text-xs text-gray-500 mt-1">{item.desc}</p>
                                     </div>
                                     <div className="w-24 h-24 bg-gray-100 rounded-lg overflow-hidden relative">
                                         {/* Placeholder for Item Image */}
                                         <div className="absolute inset-0 flex items-center justify-center text-gray-400 text-xs">No Image</div>
                                         <Button size="sm" variant="secondary" className="absolute bottom-1 left-1/2 -translate-x-1/2 h-7 text-xs bg-white text-green-600 shadow-sm border border-green-100">ADD</Button>
                                     </div>
                                 </div>
                             ))}
                         </div>
                         <div className="h-px bg-gray-100 w-full my-4"></div>
                     </div>
                 ))}
             </div>
          </TabsContent>

          <TabsContent value="photos">
              <div className="columns-2 gap-2 space-y-2">
                  {cafe.photos.map((p, i) => (
                      <div key={i} className="rounded-lg overflow-hidden break-inside-avoid">
                          <img src={p} className="w-full h-auto object-cover" loading="lazy" />
                      </div>
                  ))}
              </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Booking Footer */}
      <div className="fixed bottom-0 left-0 right-0 p-3 bg-white border-t border-gray-200 shadow-[0_-5px_10px_rgba(0,0,0,0.05)] z-20 flex items-center gap-3 max-w-[430px] mx-auto">
          <div className="flex-1">
              <p className="text-xs text-gray-500 uppercase font-semibold">Table Booking</p>
              <p className="text-sm font-medium text-green-600">Available Today</p>
          </div>
          <Button 
            onClick={() => setShowBooking(true)}
            className="flex-[2] h-12 text-lg font-bold bg-red-600 hover:bg-red-700 text-white rounded-xl shadow-lg shadow-red-200"
          >
            Book Table
          </Button>
      </div>
    </div>
  );
}

const CheckCircle = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
);
