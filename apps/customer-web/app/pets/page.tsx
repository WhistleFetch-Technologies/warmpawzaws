'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api-client';
import { getResolvedCustomerId } from '@/lib/customer-id-storage';

interface Pet {
  id: string;
  name: string;
  species: string;
  breed: string;
  age: number;
  weight: number;
  gender: string;
  photo_url?: string;
  medical_conditions?: string[];
  vaccinations?: { name: string; date: string }[];
}

export default function PetsPage() {
  const router = useRouter();
  const [pets, setPets] = useState<Pet[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newPet, setNewPet] = useState<Partial<Pet>>({
    species: 'dog',
    gender: 'male',
  });

  useEffect(() => {
    const phone = localStorage.getItem('customerPhone');
    if (!phone) {
      router.push('/auth');
      return;
    }
    loadPets();
  }, [router]);

  const loadPets = async () => {
    try {
      const customerId = getResolvedCustomerId();
      if (customerId) {
        const response = await apiClient.get<{ pets: Pet[] }>(`/customer/${customerId}/pets`);
        setPets(response.pets || []);
      }
    } catch (err) {
      console.error('Error loading pets:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddPet = async () => {
    try {
      const customerId = getResolvedCustomerId();
      if (!customerId) {
        throw new Error('Customer not found');
      }
      await apiClient.post(`/customer/${customerId}/pets`, {
        ...newPet,
      });
      setShowAddForm(false);
      setNewPet({ species: 'dog', gender: 'male' });
      loadPets();
    } catch (err) {
      console.error('Error adding pet:', err);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-50 to-amber-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-amber-50">
      {/* Header - Match consistency pattern: max-w-7xl mx-auto px-6 py-4 */}
      <div className="bg-white/90 backdrop-blur-sm border-b border-orange-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              {/* ✅ FIX: Match consistency - text-2xl font-bold */}
              <h1 className="text-2xl font-bold text-gray-800">My Pets</h1>
              <p className="text-sm text-gray-500 mt-1">Manage your pet profiles</p>
            </div>
            <button
              onClick={() => setShowAddForm(true)}
              className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition"
            >
              + Add Pet
            </button>
          </div>
        </div>
      </div>

      {/* Main Content - Match consistency pattern: max-w-7xl mx-auto p-6 or p-8 */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-7xl mx-auto p-6">

        {pets.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-xl shadow-sm">
            <div className="text-6xl mb-4">🐾</div>
            <p className="text-gray-500">No pets added yet. Add your first pet!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {pets.map((pet) => (
              <div key={pet.id} className="bg-white rounded-xl shadow-sm p-6 hover:shadow-md transition">
                <div className="flex items-start gap-4">
                  <div className="w-20 h-20 rounded-full bg-orange-100 flex items-center justify-center text-3xl">
                    {pet.species === 'dog' ? '🐕' : pet.species === 'cat' ? '🐈' : '🐾'}
                  </div>
                  <div className="flex-1">
                    <h3 className="text-xl font-semibold text-gray-800">{pet.name}</h3>
                    <p className="text-gray-500">{pet.breed} • {pet.age} years</p>
                    <p className="text-gray-400 text-sm">{pet.gender} • {pet.weight}kg</p>
                    <button
                      onClick={() => router.push(`/pets/${pet.id}`)}
                      className="mt-2 text-orange-500 hover:text-orange-600 text-sm font-medium"
                    >
                      View Profile →
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
        </div>
      </div>

      {/* Modals - Outside main content wrapper */}
      {showAddForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
              <h2 className="text-xl font-semibold mb-4">Add New Pet</h2>
              <div className="space-y-4">
                <input
                  type="text"
                  placeholder="Pet Name"
                  value={newPet.name || ''}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewPet({ ...newPet, name: e.target.value })}
                  className="w-full p-3 border rounded-lg"
                />
                <select
                  value={newPet.species}
                  onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setNewPet({ ...newPet, species: e.target.value })}
                  className="w-full p-3 border rounded-lg"
                >
                  <option value="dog">Dog</option>
                  <option value="cat">Cat</option>
                  <option value="bird">Bird</option>
                  <option value="other">Other</option>
                </select>
                <input
                  type="text"
                  placeholder="Breed"
                  value={newPet.breed || ''}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewPet({ ...newPet, breed: e.target.value })}
                  className="w-full p-3 border rounded-lg"
                />
                <div className="grid grid-cols-2 gap-4">
                  <input
                    type="number"
                    placeholder="Age (years)"
                    value={newPet.age || ''}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewPet({ ...newPet, age: parseInt(e.target.value) })}
                    className="w-full p-3 border rounded-lg"
                  />
                  <input
                    type="number"
                    placeholder="Weight (kg)"
                    value={newPet.weight || ''}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewPet({ ...newPet, weight: parseFloat(e.target.value) })}
                    className="w-full p-3 border rounded-lg"
                  />
                </div>
                <select
                  value={newPet.gender}
                  onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setNewPet({ ...newPet, gender: e.target.value })}
                  className="w-full p-3 border rounded-lg"
                >
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                </select>
              </div>
              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setShowAddForm(false)}
                  className="flex-1 p-3 border rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddPet}
                  className="flex-1 p-3 bg-orange-500 text-white rounded-lg hover:bg-orange-600"
                >
                  Add Pet
                </button>
              </div>
            </div>
          </div>
        )}
    </div>
  );
}
