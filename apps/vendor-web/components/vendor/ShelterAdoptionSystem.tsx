'use client';

import { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api-client';
import { 
  ArrowLeft, Plus, Heart, Search, Filter, Eye, Edit, Trash2,
  Dog, Cat, Camera, MapPin, Calendar, User, CheckCircle, Clock
} from 'lucide-react';
import { toast } from 'sonner';

interface Pet {
  id: string;
  name: string;
  type: 'dog' | 'cat' | 'other';
  breed: string;
  age: string;
  gender: 'male' | 'female';
  status: 'available' | 'pending' | 'adopted';
  description: string;
  imageUrl: string;
  healthStatus: string;
  vaccinated: boolean;
  spayedNeutered: boolean;
}

interface ShelterAdoptionSystemProps {
  vendorId: string;
  onBack?: () => void;
}

export function ShelterAdoptionSystem({ vendorId, onBack }: ShelterAdoptionSystemProps) {
  const [pets, setPets] = useState<Pet[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showAddModal, setShowAddModal] = useState(false);

  useEffect(() => {
    loadData();
  }, [vendorId]);

  const loadData = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get<any>(`/vendor/${vendorId}/adoption/pets`);

      if (response.success) {
        setPets(response.pets || []);
      } else {
        // Mock data
        setPets([
          {
            id: '1',
            name: 'Buddy',
            type: 'dog',
            breed: 'Golden Retriever',
            age: '2 years',
            gender: 'male',
            status: 'available',
            description: 'Friendly and playful',
            imageUrl: '',
            healthStatus: 'Healthy',
            vaccinated: true,
            spayedNeutered: true
          },
          {
            id: '2',
            name: 'Luna',
            type: 'cat',
            breed: 'Persian',
            age: '1 year',
            gender: 'female',
            status: 'pending',
            description: 'Calm and affectionate',
            imageUrl: '',
            healthStatus: 'Healthy',
            vaccinated: true,
            spayedNeutered: false
          }
        ]);
      }
    } catch (error) {
      console.error('Error loading pets:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'available': return 'bg-green-100 text-green-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'adopted': return 'bg-blue-100 text-blue-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const filteredPets = pets.filter(p => {
    if (statusFilter !== 'all' && p.status !== statusFilter) return false;
    if (searchQuery && !p.name.toLowerCase().includes(searchQuery.toLowerCase()) &&
        !p.breed.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50 vendor-app-column">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FF8C42]"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 vendor-app-column">
      {/* Header */}
      <div className="bg-gradient-to-r from-[#FF8C42] to-[#FF6B2C] text-white p-4 sticky top-0 z-10">
        <div className="flex items-center gap-3 mb-4">
          {onBack && (
            <button onClick={onBack} className="p-2 hover:bg-white/10 rounded-full">
              <ArrowLeft className="w-6 h-6" />
            </button>
          )}
          <div>
            <h1 className="text-xl font-bold">Adoption System</h1>
            <p className="text-sm text-white/80">{pets.length} pets available</p>
          </div>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search pets..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white text-gray-800"
          />
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 p-4 overflow-x-auto">
        {['all', 'available', 'pending', 'adopted'].map((status) => (
          <button
            key={status}
            onClick={() => setStatusFilter(status)}
            className={`px-4 py-2 rounded-full text-sm ${
              statusFilter === status
                ? 'bg-[#FF8C42] text-white'
                : 'bg-white text-gray-600 border'
            }`}
          >
            {status.charAt(0).toUpperCase() + status.slice(1)}
          </button>
        ))}
      </div>

      {/* Pet List */}
      <div className="p-4 space-y-4">
        <button
          onClick={() => setShowAddModal(true)}
          className="w-full py-3 bg-[#FF8C42] text-white rounded-xl font-semibold flex items-center justify-center gap-2"
        >
          <Plus className="w-5 h-5" />
          Add New Pet
        </button>

        {filteredPets.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-xl">
            <Heart className="w-16 h-16 mx-auto mb-4 text-gray-300" />
            <h3 className="text-lg font-semibold text-gray-800">No Pets Found</h3>
            <p className="text-gray-500">Add pets for adoption</p>
          </div>
        ) : (
          filteredPets.map((pet) => (
            <div key={pet.id} className="bg-white rounded-xl p-4 border border-gray-200">
              <div className="flex items-start gap-3 mb-3">
                <div className="w-16 h-16 bg-gray-200 rounded-xl flex items-center justify-center">
                  {pet.type === 'dog' ? <Dog className="w-8 h-8 text-gray-400" /> : <Cat className="w-8 h-8 text-gray-400" />}
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-gray-800">{pet.name}</h3>
                    <span className={`px-2 py-1 rounded-full text-xs ${getStatusColor(pet.status)}`}>
                      {pet.status}
                    </span>
                  </div>
                  <p className="text-sm text-gray-500">{pet.breed} • {pet.age}</p>
                  <p className="text-sm text-gray-500 capitalize">{pet.gender}</p>
                </div>
              </div>

              <p className="text-sm text-gray-600 mb-3">{pet.description}</p>

              <div className="flex gap-2 mb-3">
                {pet.vaccinated && (
                  <span className="px-2 py-1 bg-green-50 text-green-700 text-xs rounded-full flex items-center gap-1">
                    <CheckCircle className="w-3 h-3" /> Vaccinated
                  </span>
                )}
                {pet.spayedNeutered && (
                  <span className="px-2 py-1 bg-blue-50 text-blue-700 text-xs rounded-full flex items-center gap-1">
                    <CheckCircle className="w-3 h-3" /> Spayed/Neutered
                  </span>
                )}
              </div>

              <div className="flex gap-2">
                <button className="flex-1 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 flex items-center justify-center gap-1">
                  <Eye className="w-4 h-4" /> View
                </button>
                <button className="flex-1 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 flex items-center justify-center gap-1">
                  <Edit className="w-4 h-4" /> Edit
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default ShelterAdoptionSystem;
