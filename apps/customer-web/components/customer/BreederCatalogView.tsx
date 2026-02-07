"use client";

import { useState, useEffect } from 'react';
import { ArrowLeft, Search, Filter, Star, MapPin, Phone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { apiClient } from '@/lib/api-client';
import { toast } from 'sonner';

interface BreederCatalogViewProps {
  phone?: string;
  customerPhone?: string;
  customerId?: string;
  petId?: string;
  bookingId?: string;
  orderId?: string;
  cafeId?: string;
  preSelectedVendorId?: string;
  vendorId?: string;
  onBack: () => void;
  onNavigate?: (screen: string, data?: any) => void;
  onSuccess?: (bookingId?: string) => void;
  onComplete?: () => void;
}

export function BreederCatalogView(props: BreederCatalogViewProps) {
  const [breeders, setBreeders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterBreed, setFilterBreed] = useState('');

  useEffect(() => {
    loadBreeders();
  }, [filterBreed]);

  const loadBreeders = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filterBreed) params.append('breed', filterBreed);
      const response = await apiClient.get<any>(`/breeders?${params.toString()}`);
      setBreeders(response.breeders || response || []);
    } catch (error: any) {
      console.error('Error loading breeders:', error);
      setBreeders([]);
    } finally {
      setLoading(false);
    }
  };

  const filteredBreeders = breeders.filter(breeder =>
    !searchQuery ||
    breeder.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    breeder.breeds?.some((b: string) => b.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="min-h-screen bg-[#FF8C42] pb-24">
      <div className="max-w-md mx-auto min-h-screen">
        {/* Header with ORANGE solid theme matching BreederServicesLanding */}
        <div className="px-6 pt-12 pb-6">
          <div className="flex items-center gap-4 mb-6">
            <button 
              onClick={props.onBack}
              className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center hover:bg-white/30 transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-white" />
            </button>
            <h1 className="text-2xl font-bold text-white">Breeder Catalog</h1>
          </div>
        </div>
        
        {/* Main Content - White Card with Top Radius */}
        <div className="bg-white rounded-t-[32px] px-6 pt-8 min-h-[calc(100vh-180px)]">
          <div className="space-y-4">
            <div className="space-y-3">
            <Input
              placeholder="Search breeders..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full"
            />
            <div className="flex gap-2 overflow-x-auto pb-2">
              {['All', 'Labrador', 'Golden Retriever', 'German Shepherd', 'Persian', 'Siamese'].map((breed) => (
                <Button
                  key={breed}
                  variant={filterBreed === breed ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setFilterBreed(breed === 'All' ? '' : breed)}
                  className={`flex-shrink-0 ${filterBreed === breed ? 'bg-[#FF8C42] text-white' : ''}`}
                >
                  {breed}
                </Button>
              ))}
            </div>
          </div>

          {loading ? (
            <Card className="p-8 text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-4 border-[#FF8C42] border-t-transparent mx-auto mb-4"></div>
              <p className="text-gray-600">Loading breeders...</p>
            </Card>
          ) : filteredBreeders.length === 0 ? (
            <Card className="p-8 text-center">
              <p className="text-gray-600 font-medium mb-2">No breeders found</p>
              <p className="text-sm text-gray-500">Try adjusting your search or filters</p>
            </Card>
          ) : (
            <div className="space-y-3">
              {filteredBreeders.map((breeder) => (
                <Card key={breeder.id} className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900">{breeder.name}</h3>
                      {breeder.rating && (
                        <div className="flex items-center gap-1 mt-1">
                          <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                          <span className="text-sm text-gray-600">{breeder.rating}</span>
                        </div>
                      )}
                    </div>
                    {breeder.verified && (
                      <Badge className="bg-green-100 text-green-700">Verified</Badge>
                    )}
                  </div>
                  {breeder.breeds && (
                    <div className="flex flex-wrap gap-1 mb-2">
                      {breeder.breeds.slice(0, 3).map((breed: string, idx: number) => (
                        <Badge key={idx} variant="outline" className="text-xs">{breed}</Badge>
                      ))}
                    </div>
                  )}
                  {breeder.location && (
                    <div className="flex items-center gap-1 text-sm text-gray-600 mb-2">
                      <MapPin className="w-4 h-4" />
                      {breeder.location}
                    </div>
                  )}
                  {breeder.phone && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => window.location.href = `tel:${breeder.phone}`}
                      className="w-full"
                    >
                      <Phone className="w-4 h-4 mr-2" />
                      Contact
                    </Button>
                  )}
                </Card>
              ))}
            </div>
          )}
          </div>
        </div>
      </div>
    </div>
  );
}
