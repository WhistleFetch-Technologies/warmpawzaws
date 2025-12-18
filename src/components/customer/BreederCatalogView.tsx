import { useState, useEffect } from 'react';
import { ArrowLeft, Search, Filter, Heart, Info, ChevronRight, ShieldCheck, Award } from 'lucide-react';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { Badge } from '../ui/badge';
import { Input } from '../ui/input';
import { projectId, publicAnonKey } from '../../utils/supabase/info';
import { toast } from 'sonner@2.0.3';
import { AdoptionNudge } from './AdoptionNudge';

interface BreederCatalogViewProps {
  phone: string;
  onBack: () => void;
  onViewDetails?: (animalId: string) => void;
  onNavigateToAdoption?: () => void;
}

export function BreederCatalogView({ phone, onBack, onViewDetails, onNavigateToAdoption }: BreederCatalogViewProps) {
  const [loading, setLoading] = useState(true);
  const [animals, setAnimals] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBreed, setSelectedBreed] = useState<string | null>(null);
  const [showAdoptionNudge, setShowAdoptionNudge] = useState(true);

  const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475`;

  useEffect(() => {
    loadAnimals();
  }, []);

  const loadAnimals = async () => {
    try {
      setLoading(true);
      let animalData: any[] = [];
      
      // 1. Try New Breeder Listing API
      try {
          const listingResponse = await fetch(`${API_BASE}/breeder/listings`, {
              headers: { Authorization: `Bearer ${publicAnonKey}` }
          });
          if (listingResponse.ok) {
              const data = await listingResponse.json();
              if (data.success && data.listings.length > 0) {
                  animalData = data.listings.map((l: any) => ({
                      id: l.id,
                      name: l.name,
                      breed: l.breed,
                      age: l.dob ? calculateAge(l.dob) : 'Unknown Age',
                      gender: l.gender,
                      price: l.price,
                      vendorName: 'Verified Breeder', // Should fetch vendor name ideally
                      vendorId: l.vendorId,
                      image: l.images && l.images.length > 0 ? l.images[0] : 'https://images.unsplash.com/photo-1543466835-00a7907e9de1?auto=format&fit=crop&q=80&w=1000',
                      certified: l.kciRegistered,
                      description: l.description,
                      kciNumber: l.kciNumber
                  }));
              }
          }
      } catch (e) {
          console.warn('Failed to fetch from new breeder API', e);
      }

      // 2. Fallback to Legacy Services
      if (animalData.length === 0) {
          const response = await fetch(`${API_BASE}/customer/services?roleId=pet_breeder`, {
            headers: { Authorization: `Bearer ${publicAnonKey}` }
          });

          if (response.ok) {
            const data = await response.json();
            const transformedAnimals = (data.services || []).map((s: any) => ({
                id: s.id,
                name: s.name, // e.g., "Golden Retriever Puppy"
                breed: s.name.split(' ')[0], // Simple heuristic
                age: '2 Months', // Mock or parsed
                gender: Math.random() > 0.5 ? 'Male' : 'Female',
                price: s.price,
                vendorName: s.vendorName,
                vendorId: s.vendorId,
                image: 'https://images.unsplash.com/photo-1543466835-00a7907e9de1?auto=format&fit=crop&q=80&w=1000', // Mock
                certified: true, // KCI registered flag
                description: s.description
            }));
            animalData = transformedAnimals;
          }
      }

      setAnimals(animalData);
    } catch (error) {
      console.error('Error loading animals:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateAge = (dob: string) => {
      const birth = new Date(dob);
      const now = new Date();
      const diffMonths = (now.getFullYear() - birth.getFullYear()) * 12 + (now.getMonth() - birth.getMonth());
      if (diffMonths < 1) return '< 1 Month';
      return `${diffMonths} Months`;
  };

  const filteredAnimals = animals.filter(a => 
    (a.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
     a.breed.toLowerCase().includes(searchQuery.toLowerCase())) &&
    (!selectedBreed || a.breed === selectedBreed)
  );

  return (
    <div className="min-h-screen bg-[#FF8C42] gray-50">
      {/* Header */}
      <div className="bg-[#FF8C42] white sticky top-0 z-10 shadow-sm">
        <div className="p-4 flex items-center gap-3 border-b">
          <button onClick={onBack}><ArrowLeft className="w-6 h-6 text-gray-600" /></button>
          <div className="flex-1">
             <h1 className="text-lg font-bold text-gray-900">Find a Pet</h1>
             <p className="text-xs text-gray-500">Verified Breeders Only</p>
          </div>
          <div className="bg-[#FF8C42] green-100 text-green-700 px-2 py-1 rounded-full text-xs font-semibold flex items-center gap-1">
             <ShieldCheck className="w-3 h-3" /> Verified
          </div>
        </div>
        
        <div className="p-4 pb-2">
            <div className="relative">
                <Search className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                <Input 
                    placeholder="Search breed, e.g. Golden Retriever" 
                    className="pl-9 bg-[#FF8C42] gray-100 border-none"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                />
            </div>
        </div>

        {/* Breed Filters */}
        <div className="flex gap-2 overflow-x-auto p-4 pt-0 pb-3 scrollbar-hide">
            {['All', 'Golden Retriever', 'German Shepherd', 'Beagle', 'Husky', 'Poodle'].map(breed => (
                <button 
                    key={breed}
                    onClick={() => setSelectedBreed(breed === 'All' ? null : breed)}
                    className={`px-4 py-1.5 rounded-full text-xs whitespace-nowrap transition-colors ${
                        (breed === 'All' && !selectedBreed) || selectedBreed === breed 
                        ? 'bg-gray-900 text-white' 
                        : 'bg-white border border-gray-200 text-gray-700'
                    }`}
                >
                    {breed}
                </button>
            ))}
        </div>
      </div>

      {/* Catalog Grid */}
      <div className="p-4 pb-24">
        {loading ? (
            <div className="text-center py-12 text-gray-500">Loading pets...</div>
        ) : filteredAnimals.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
                <p className="text-lg mb-2">🐶</p>
                <p>No pets found matching your search.</p>
            </div>
        ) : (
            <div className="grid grid-cols-1 gap-4">
                {filteredAnimals.map(animal => (
                    <Card key={animal.id} className="overflow-hidden hover:shadow-md transition-all cursor-pointer">
                        <div className="flex h-32">
                            <div className="w-32 relative">
                                <img src={animal.image} className="w-full h-full object-cover" />
                                <div className="absolute top-2 left-2 bg-[#FF8C42] white/90 px-1.5 py-0.5 rounded text-[10px] font-bold">
                                    {animal.age}
                                </div>
                            </div>
                            <div className="flex-1 p-3 flex flex-col justify-between">
                                <div>
                                    <div className="flex justify-between items-start">
                                        <h3 className="font-bold text-gray-900 line-clamp-1">{animal.name}</h3>
                                        <Heart className="w-5 h-5 text-gray-400" />
                                    </div>
                                    <p className="text-xs text-gray-500 mb-1">{animal.vendorName}</p>
                                    <div className="flex gap-2 mt-1">
                                        <Badge variant="outline" className="text-[10px] h-5 px-1.5 bg-[#FF8C42] blue-50 text-blue-700 border-blue-100">
                                            {animal.gender}
                                        </Badge>
                                        {animal.certified && (
                                            <Badge variant="outline" className="text-[10px] h-5 px-1.5 bg-[#FF8C42] green-50 text-green-700 border-green-100 flex items-center gap-0.5">
                                                <Award className="w-2 h-2" /> KCI
                                            </Badge>
                                        )}
                                    </div>
                                </div>
                                <div className="flex justify-between items-end mt-2">
                                    <div>
                                        <p className="text-xs text-gray-400">Price</p>
                                        <p className="font-bold text-gray-900">₹{animal.price.toLocaleString()}</p>
                                    </div>
                                    <Button size="sm" className="h-8 bg-[#FF8C42] gray-900 text-white text-xs" onClick={() => {
                                        toast.success(`Interest shown for ${animal.name}! Breeder will contact you.`);
                                    }}>
                                        Contact Breeder
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </Card>
                ))}
            </div>
        )}
      </div>

      {/* Adoption Nudge */}
      {showAdoptionNudge && onNavigateToAdoption && (
        <div className="fixed bottom-20 left-0 right-0 px-4 z-20">
          <AdoptionNudge 
            onDismiss={() => setShowAdoptionNudge(false)} 
            onViewAdoption={onNavigateToAdoption} 
          />
        </div>
      )}
    </div>
  );
}