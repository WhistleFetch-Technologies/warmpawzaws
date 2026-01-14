'use client';

/**
 * Adoption & Breeding Management Page
 * Manages pet profiles for adoption/breeding
 * Capability: adoption, pet_profiles
 */

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api-client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { 
  Heart, 
  Plus, 
  Search, 
  Dog,
  Cat,
  Calendar,
  DollarSign,
  MapPin,
  Info
} from 'lucide-react';

interface PetProfile {
  id: string;
  name: string;
  pet_type: 'dog' | 'cat' | 'bird' | 'other';
  breed: string;
  age: number;
  age_unit: 'weeks' | 'months' | 'years';
  gender: 'male' | 'female';
  size?: 'small' | 'medium' | 'large';
  color?: string;
  description?: string;
  vaccination_status?: string;
  spayed_neutered?: boolean;
  microchipped?: boolean;
  listing_type: 'adoption' | 'breeding';
  adoption_fee: number;
  location_city?: string;
  photos?: string[];
  created_at: string;
}

export default function AdoptionPage() {
  const router = useRouter();
  const [vendorId, setVendorId] = useState<string | null>(null);
  const [pets, setPets] = useState<PetProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'adoption' | 'breeding'>('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [newPet, setNewPet] = useState({
    name: '',
    petType: 'dog' as 'dog' | 'cat' | 'bird' | 'other',
    breed: '',
    age: 1,
    ageUnit: 'months' as 'weeks' | 'months' | 'years',
    gender: 'male' as 'male' | 'female',
    size: 'medium' as 'small' | 'medium' | 'large',
    color: '',
    description: '',
    vaccinationStatus: 'up_to_date',
    spayedNeutered: false,
    listingType: 'adoption' as 'adoption' | 'breeding',
    adoptionFee: 0,
    locationCity: '',
  });

  useEffect(() => {
    const storedVendorId = localStorage.getItem('vendorId');
    if (!storedVendorId) {
      router.push('/onboarding');
      return;
    }
    setVendorId(storedVendorId);
    fetchPets(storedVendorId);
  }, [router]);

  const fetchPets = async (vId?: string) => {
    const id = vId || vendorId;
    if (!id) return;
    
    setLoading(true);
    try {
      const data = await apiClient.get<{ success: boolean; puppies: PetProfile[] }>(`/vendor/${id}/breeder/puppies`);
      setPets(data.puppies || []);
    } catch (error: any) {
      console.error('Error fetching pets:', error);
      if (error.message?.includes('403')) {
        toast.error('You do not have access to adoption management');
      } else {
        toast.error('Failed to load pets');
      }
    } finally {
      setLoading(false);
    }
  };

  const addPet = async () => {
    if (!vendorId || !newPet.name || !newPet.breed) {
      toast.error('Please fill in required fields');
      return;
    }

    try {
      await apiClient.post(`/vendor/${vendorId}/breeder/puppies`, newPet);
      toast.success('Pet profile created successfully');
      setShowAddModal(false);
      setNewPet({
        name: '',
        petType: 'dog',
        breed: '',
        age: 1,
        ageUnit: 'months',
        gender: 'male',
        size: 'medium',
        color: '',
        description: '',
        vaccinationStatus: 'up_to_date',
        spayedNeutered: false,
        listingType: 'adoption',
        adoptionFee: 0,
        locationCity: '',
      });
      fetchPets();
    } catch (error: any) {
      console.error('Error adding pet:', error);
      toast.error(error.message || 'Failed to create pet profile');
    }
  };

  const filteredPets = pets.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         p.breed.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = filterType === 'all' || p.listing_type === filterType;
    return matchesSearch && matchesType;
  });

  const stats = {
    total: pets.length,
    adoption: pets.filter(p => p.listing_type === 'adoption').length,
    breeding: pets.filter(p => p.listing_type === 'breeding').length,
  };

  const getPetIcon = (type: string) => {
    switch (type) {
      case 'dog': return <Dog className="h-5 w-5" />;
      case 'cat': return <Cat className="h-5 w-5" />;
      default: return <Heart className="h-5 w-5" />;
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Heart className="h-8 w-8 text-pink-500" />
            Adoption & Breeding
          </h1>
          <p className="text-muted-foreground">Manage pet profiles for adoption or breeding</p>
        </div>
        <Button onClick={() => setShowAddModal(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Pet
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <Heart className="h-10 w-10 text-pink-500" />
            <div>
              <p className="text-sm text-muted-foreground">Total Pets</p>
              <p className="text-2xl font-bold">{stats.total}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <Dog className="h-10 w-10 text-blue-500" />
            <div>
              <p className="text-sm text-muted-foreground">For Adoption</p>
              <p className="text-2xl font-bold">{stats.adoption}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <Cat className="h-10 w-10 text-purple-500" />
            <div>
              <p className="text-sm text-muted-foreground">For Breeding</p>
              <p className="text-2xl font-bold">{stats.breeding}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search and Filter */}
      <div className="flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name or breed..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <select
          className="border rounded-md px-4"
          value={filterType}
          onChange={(e) => setFilterType(e.target.value as any)}
        >
          <option value="all">All Types</option>
          <option value="adoption">Adoption</option>
          <option value="breeding">Breeding</option>
        </select>
      </div>

      {/* Pets Grid */}
      {loading ? (
        <div className="text-center py-12">Loading pets...</div>
      ) : filteredPets.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            <Heart className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold">No pets found</h3>
            <p className="text-muted-foreground mb-4">
              {searchQuery ? 'Try a different search term' : 'Add your first pet profile to get started'}
            </p>
            {!searchQuery && (
              <Button onClick={() => setShowAddModal(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Pet
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredPets.map((pet) => (
            <Card key={pet.id}>
              <CardHeader className="pb-2">
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      {getPetIcon(pet.pet_type)}
                      {pet.name}
                    </CardTitle>
                    <p className="text-sm text-muted-foreground">{pet.breed}</p>
                  </div>
                  <Badge className={pet.listing_type === 'adoption' ? 'bg-pink-100 text-pink-800' : 'bg-purple-100 text-purple-800'}>
                    {pet.listing_type}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span>{pet.age} {pet.age_unit} old • {pet.gender}</span>
                </div>
                {pet.location_city && (
                  <div className="flex items-center gap-2 text-sm">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <span>{pet.location_city}</span>
                  </div>
                )}
                <div className="flex items-center gap-2 text-sm">
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                  <span>
                    {pet.adoption_fee > 0 ? `₹${pet.adoption_fee} fee` : 'Free adoption'}
                  </span>
                </div>
                {pet.description && (
                  <p className="text-sm text-muted-foreground line-clamp-2">{pet.description}</p>
                )}
                <div className="flex flex-wrap gap-1 mt-2">
                  {pet.vaccination_status && (
                    <Badge variant="secondary" className="text-xs">Vaccinated</Badge>
                  )}
                  {pet.spayed_neutered && (
                    <Badge variant="secondary" className="text-xs">Neutered/Spayed</Badge>
                  )}
                  {pet.microchipped && (
                    <Badge variant="secondary" className="text-xs">Microchipped</Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Add Pet Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 overflow-auto">
          <Card className="w-full max-w-lg mx-4 my-8">
            <CardHeader>
              <CardTitle>Add New Pet</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 max-h-[70vh] overflow-auto">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Pet Name *</label>
                  <Input
                    value={newPet.name}
                    onChange={(e) => setNewPet(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="e.g., Max"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Pet Type</label>
                  <select
                    className="w-full border rounded-md p-2"
                    value={newPet.petType}
                    onChange={(e) => setNewPet(prev => ({ ...prev, petType: e.target.value as any }))}
                  >
                    <option value="dog">Dog</option>
                    <option value="cat">Cat</option>
                    <option value="bird">Bird</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium">Breed *</label>
                <Input
                  value={newPet.breed}
                  onChange={(e) => setNewPet(prev => ({ ...prev, breed: e.target.value }))}
                  placeholder="e.g., Golden Retriever"
                />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="text-sm font-medium">Age</label>
                  <Input
                    type="number"
                    value={newPet.age}
                    onChange={(e) => setNewPet(prev => ({ ...prev, age: parseInt(e.target.value) || 1 }))}
                    min={1}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Unit</label>
                  <select
                    className="w-full border rounded-md p-2"
                    value={newPet.ageUnit}
                    onChange={(e) => setNewPet(prev => ({ ...prev, ageUnit: e.target.value as any }))}
                  >
                    <option value="weeks">Weeks</option>
                    <option value="months">Months</option>
                    <option value="years">Years</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium">Gender</label>
                  <select
                    className="w-full border rounded-md p-2"
                    value={newPet.gender}
                    onChange={(e) => setNewPet(prev => ({ ...prev, gender: e.target.value as any }))}
                  >
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Listing Type</label>
                  <select
                    className="w-full border rounded-md p-2"
                    value={newPet.listingType}
                    onChange={(e) => setNewPet(prev => ({ ...prev, listingType: e.target.value as any }))}
                  >
                    <option value="adoption">For Adoption</option>
                    <option value="breeding">For Breeding</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium">Adoption Fee (₹)</label>
                  <Input
                    type="number"
                    value={newPet.adoptionFee}
                    onChange={(e) => setNewPet(prev => ({ ...prev, adoptionFee: parseFloat(e.target.value) || 0 }))}
                    min={0}
                  />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium">Description</label>
                <textarea
                  className="w-full border rounded-md p-2 min-h-[80px]"
                  value={newPet.description}
                  onChange={(e) => setNewPet(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Describe the pet's personality, health, etc."
                />
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setShowAddModal(false)} className="flex-1">
                  Cancel
                </Button>
                <Button onClick={addPet} className="flex-1">
                  Add Pet
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
