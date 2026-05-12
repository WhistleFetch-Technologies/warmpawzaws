'use client';

import React, { useState, useEffect } from 'react';
import { 
  ArrowLeft, Camera, Edit2, Trash2, Calendar, Weight, Heart,
  Syringe, AlertCircle, Shield, Bell, Clock, ChevronRight,
  Star, Activity, Dog, Cat, PawPrint, Plus, Check, X,
  Phone, MapPin, FileText, Settings
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { apiClient } from '@/lib/api-client';
import { urlCustomerPetsByPhonePath } from '@/lib/customer-service-list-urls';
import { toast } from 'sonner';
import { EnhancedAddPetModal } from './EnhancedAddPetModal';

// ============================================================================
// TYPES
// ============================================================================

interface VaccinationRecord {
  id: string;
  name: string;
  lastDate: string;
  nextDueDate: string;
  veterinarian?: string;
  batchNumber?: string;
  notes?: string;
}

interface Pet {
  id: string;
  name: string;
  type: 'Dog' | 'Cat';
  breed: string;
  dateOfBirth?: string;
  age?: string | number;
  gender: 'Male' | 'Female';
  weight: string;
  color?: string;
  photo?: string;
  microchipId?: string;
  size?: string;
  coatType?: string;
  isSpayedNeutered?: boolean;
  allergies?: string[];
  currentMedications?: string[];
  chronicConditions?: string[];
  vaccinations?: VaccinationRecord[];
  activityLevel?: string;
  temperament?: string;
  isGoodWithKids?: boolean;
  isGoodWithOtherPets?: boolean;
  specialNeeds?: string;
  hasInsurance?: boolean;
  insuranceProvider?: string;
  insurancePolicyNumber?: string;
  emergencyVetName?: string;
  emergencyVetPhone?: string;
  createdAt?: string;
  updatedAt?: string;
}

interface EnhancedPetProfilePageProps {
  phone: string;
  onBack: () => void;
  onNavigate: (screen: string, data?: any) => void;
  onAddPet: () => void;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function EnhancedPetProfilePage({ 
  phone, 
  onBack, 
  onNavigate, 
  onAddPet 
}: EnhancedPetProfilePageProps) {
  const [pets, setPets] = useState<Pet[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPet, setSelectedPet] = useState<Pet | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingPet, setEditingPet] = useState<Pet | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'health' | 'vaccinations'>('overview');

  // Fetch pets on mount
  useEffect(() => {
    fetchPets();
  }, [phone]);

  const fetchPets = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get(urlCustomerPetsByPhonePath(phone)) as any;
      
      let petsData: Pet[] = [];
      if (Array.isArray(response)) {
        petsData = response;
      } else if (Array.isArray(response?.pets)) {
        petsData = response.pets;
      } else if (response?.pets?.pets && Array.isArray(response.pets.pets)) {
        petsData = response.pets.pets;
      }
      
      setPets(petsData);
      
      // Auto-select first pet if available
      if (petsData.length > 0 && !selectedPet) {
        setSelectedPet(petsData[0]);
      }
    } catch (error) {
      console.error('Error fetching pets:', error);
      toast.error('Failed to load pets');
    } finally {
      setLoading(false);
    }
  };

  const calculateAge = (dob?: string, age?: string | number): string => {
    if (dob) {
      const birthDate = new Date(dob);
      const today = new Date();
      const years = today.getFullYear() - birthDate.getFullYear();
      const months = today.getMonth() - birthDate.getMonth();
      
      if (years < 1) {
        const totalMonths = Math.max(1, years * 12 + months);
        return `${totalMonths} month${totalMonths !== 1 ? 's' : ''}`;
      }
      return `${years} year${years !== 1 ? 's' : ''}`;
    }
    if (age) {
      return typeof age === 'number' ? `${age} years` : age;
    }
    return 'Unknown';
  };

  const getUpcomingVaccinations = (pet: Pet): VaccinationRecord[] => {
    if (!pet.vaccinations) return [];
    
    const today = new Date();
    const thirtyDaysFromNow = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);
    
    return pet.vaccinations.filter(v => {
      const dueDate = new Date(v.nextDueDate);
      return dueDate <= thirtyDaysFromNow && dueDate >= today;
    }).sort((a, b) => new Date(a.nextDueDate).getTime() - new Date(b.nextDueDate).getTime());
  };

  const getOverdueVaccinations = (pet: Pet): VaccinationRecord[] => {
    if (!pet.vaccinations) return [];
    
    const today = new Date();
    return pet.vaccinations.filter(v => new Date(v.nextDueDate) < today)
      .sort((a, b) => new Date(a.nextDueDate).getTime() - new Date(b.nextDueDate).getTime());
  };

  const handleDeletePet = async (petId: string) => {
    if (!confirm('Are you sure you want to remove this pet?')) return;
    
    try {
      const updatedPets = pets.filter(p => p.id !== petId);
      await apiClient.post('/customer/pets', { phone, pets: updatedPets });
      setPets(updatedPets);
      setSelectedPet(updatedPets[0] || null);
      toast.success('Pet removed successfully');
    } catch (error) {
      toast.error('Failed to remove pet');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 to-amber-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading your pets...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-amber-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-orange-500 via-amber-500 to-orange-400 px-4 py-5">
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={onBack}
            className="w-10 h-10 bg-white/20 backdrop-blur rounded-full flex items-center justify-center"
          >
            <ArrowLeft className="w-5 h-5 text-white" />
          </button>
          <h1 className="text-xl font-bold text-white">My Pets</h1>
          <button
            onClick={() => setShowAddModal(true)}
            className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-lg"
          >
            <Plus className="w-5 h-5 text-orange-500" />
          </button>
        </div>

        {/* Pet Selector - Horizontal Scroll */}
        {pets.length > 0 && (
          <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide">
            {pets.map((pet) => (
              <button
                key={pet.id}
                onClick={() => setSelectedPet(pet)}
                className={`flex-shrink-0 flex items-center gap-2 px-4 py-2 rounded-full transition-all ${
                  selectedPet?.id === pet.id
                    ? 'bg-white text-orange-600 shadow-lg'
                    : 'bg-white/20 text-white hover:bg-white/30'
                }`}
              >
                <div className="w-8 h-8 rounded-full overflow-hidden bg-white/20 flex items-center justify-center">
                  {pet.photo ? (
                    <img src={pet.photo} alt={pet.name} className="w-full h-full object-cover" />
                  ) : (
                    pet.type === 'Dog' ? <Dog className="w-5 h-5" /> : <Cat className="w-5 h-5" />
                  )}
                </div>
                <span className="font-medium">{pet.name}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Content */}
      {pets.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
          <div className="w-24 h-24 bg-orange-100 rounded-full flex items-center justify-center mb-6">
            <PawPrint className="w-12 h-12 text-orange-500" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">No Pets Added Yet</h2>
          <p className="text-gray-600 mb-6 max-w-sm">
            Add your furry friend to access personalized services, track vaccinations, and more!
          </p>
          <Button 
            onClick={() => setShowAddModal(true)}
            className="bg-gradient-to-r from-orange-500 to-amber-500 text-white px-8 py-3 rounded-xl"
          >
            <Plus className="w-5 h-5 mr-2" />
            Add Your First Pet
          </Button>
        </div>
      ) : selectedPet ? (
        <div className="p-4 space-y-4">
          {/* Pet Hero Card */}
          <Card className="overflow-hidden border-0 shadow-lg">
            <div className="relative">
              {/* Pet Photo */}
              <div className="h-48 bg-gradient-to-br from-orange-100 to-amber-100">
                {selectedPet.photo ? (
                  <img 
                    src={selectedPet.photo} 
                    alt={selectedPet.name} 
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    {selectedPet.type === 'Dog' ? <Dog className="w-20 h-20 text-orange-500" /> : <Cat className="w-20 h-20 text-orange-500" />}
                  </div>
                )}
              </div>
              
              {/* Edit/Delete Actions */}
              <div className="absolute top-3 right-3 flex gap-2">
                <button
                  onClick={() => setEditingPet(selectedPet)}
                  className="w-10 h-10 bg-white rounded-full shadow flex items-center justify-center"
                >
                  <Edit2 className="w-4 h-4 text-gray-600" />
                </button>
                <button
                  onClick={() => handleDeletePet(selectedPet.id)}
                  className="w-10 h-10 bg-white rounded-full shadow flex items-center justify-center"
                >
                  <Trash2 className="w-4 h-4 text-red-500" />
                </button>
              </div>
              
              {/* Insurance Badge */}
              {selectedPet.hasInsurance && (
                <div className="absolute top-3 left-3">
                  <Badge className="bg-green-500 text-white">
                    <Shield className="w-3 h-3 mr-1" />
                    Insured
                  </Badge>
                </div>
              )}
            </div>
            
            {/* Pet Info */}
            <div className="p-4">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">{selectedPet.name}</h2>
                  <p className="text-gray-600">{selectedPet.breed}</p>
                </div>
                <Badge className={`${
                  selectedPet.gender === 'Male' 
                    ? 'bg-blue-100 text-blue-700' 
                    : 'bg-pink-100 text-pink-700'
                }`}>
                  {selectedPet.gender === 'Male' ? '♂' : '♀'} {selectedPet.gender}
                </Badge>
              </div>
              
              {/* Quick Stats */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-gray-50 rounded-xl p-3 text-center">
                  <Calendar className="w-5 h-5 mx-auto text-orange-500 mb-1" />
                  <p className="text-xs text-gray-500">Age</p>
                  <p className="font-bold text-gray-900">
                    {calculateAge(selectedPet.dateOfBirth, selectedPet.age)}
                  </p>
                </div>
                <div className="bg-gray-50 rounded-xl p-3 text-center">
                  <Weight className="w-5 h-5 mx-auto text-orange-500 mb-1" />
                  <p className="text-xs text-gray-500">Weight</p>
                  <p className="font-bold text-gray-900">{selectedPet.weight || 'N/A'} kg</p>
                </div>
                <div className="bg-gray-50 rounded-xl p-3 text-center">
                  <Activity className="w-5 h-5 mx-auto text-orange-500 mb-1" />
                  <p className="text-xs text-gray-500">Activity</p>
                  <p className="font-bold text-gray-900">{selectedPet.activityLevel || 'N/A'}</p>
                </div>
              </div>
            </div>
          </Card>

          {/* Vaccination Alerts */}
          {(getOverdueVaccinations(selectedPet).length > 0 || getUpcomingVaccinations(selectedPet).length > 0) && (
            <Card className="border-0 shadow-lg overflow-hidden">
              {/* Overdue */}
              {getOverdueVaccinations(selectedPet).length > 0 && (
                <div className="p-4 bg-red-50 border-l-4 border-red-500">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertCircle className="w-5 h-5 text-red-500" />
                    <span className="font-bold text-red-700">Overdue Vaccinations</span>
                  </div>
                  {getOverdueVaccinations(selectedPet).map((vax) => (
                    <p key={vax.id} className="text-sm text-red-600">
                      • {vax.name} - was due {vax.nextDueDate}
                    </p>
                  ))}
                </div>
              )}
              
              {/* Upcoming */}
              {getUpcomingVaccinations(selectedPet).length > 0 && (
                <div className="p-4 bg-amber-50">
                  <div className="flex items-center gap-2 mb-2">
                    <Bell className="w-5 h-5 text-amber-600" />
                    <span className="font-bold text-amber-700">Upcoming Vaccinations</span>
                  </div>
                  {getUpcomingVaccinations(selectedPet).map((vax) => (
                    <p key={vax.id} className="text-sm text-amber-600">
                      • {vax.name} - due {vax.nextDueDate}
                    </p>
                  ))}
                </div>
              )}
            </Card>
          )}

          {/* Tab Navigation */}
          <div className="flex bg-gray-100 rounded-xl p-1">
            {(['overview', 'health', 'vaccinations'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition ${
                  activeTab === tab
                    ? 'bg-white text-orange-600 shadow'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          {activeTab === 'overview' && (
            <div className="space-y-4">
              {/* Physical Details */}
              <Card className="p-4 border-0 shadow">
                <h3 className="font-bold text-gray-900 mb-3">Physical Details</h3>
                <div className="grid grid-cols-2 gap-4">
                  <InfoRow label="Type" value={selectedPet.type} />
                  <InfoRow label="Breed" value={selectedPet.breed} />
                  <InfoRow label="Color" value={selectedPet.color || 'N/A'} />
                  <InfoRow label="Size" value={selectedPet.size || 'N/A'} />
                  <InfoRow label="Coat Type" value={selectedPet.coatType || 'N/A'} />
                  <InfoRow 
                    label="Spayed/Neutered" 
                    value={selectedPet.isSpayedNeutered ? 'Yes' : 'No'} 
                  />
                </div>
              </Card>

              {/* Behavior */}
              <Card className="p-4 border-0 shadow">
                <h3 className="font-bold text-gray-900 mb-3">Behavior & Personality</h3>
                <div className="grid grid-cols-2 gap-4">
                  <InfoRow label="Temperament" value={selectedPet.temperament || 'N/A'} />
                  <InfoRow label="Activity Level" value={selectedPet.activityLevel || 'N/A'} />
                  <InfoRow 
                    label="Good with Kids" 
                    value={selectedPet.isGoodWithKids === undefined ? 'Unknown' : selectedPet.isGoodWithKids ? 'Yes' : 'No'} 
                  />
                  <InfoRow 
                    label="Good with Pets" 
                    value={selectedPet.isGoodWithOtherPets === undefined ? 'Unknown' : selectedPet.isGoodWithOtherPets ? 'Yes' : 'No'} 
                  />
                </div>
                {selectedPet.specialNeeds && (
                  <div className="mt-3 pt-3 border-t">
                    <p className="text-xs text-gray-500 mb-1">Special Needs</p>
                    <p className="text-sm text-gray-700">{selectedPet.specialNeeds}</p>
                  </div>
                )}
              </Card>

              {/* Identification */}
              <Card className="p-4 border-0 shadow">
                <h3 className="font-bold text-gray-900 mb-3">Identification</h3>
                <div className="space-y-2">
                  <InfoRow label="Microchip ID" value={selectedPet.microchipId || 'Not registered'} />
                </div>
              </Card>

              {/* Insurance */}
              {selectedPet.hasInsurance && (
                <Card className="p-4 border-0 shadow bg-green-50">
                  <div className="flex items-center gap-2 mb-3">
                    <Shield className="w-5 h-5 text-green-600" />
                    <h3 className="font-bold text-green-800">Pet Insurance</h3>
                  </div>
                  <div className="space-y-2">
                    <InfoRow label="Provider" value={selectedPet.insuranceProvider || 'N/A'} />
                    <InfoRow label="Policy Number" value={selectedPet.insurancePolicyNumber || 'N/A'} />
                  </div>
                </Card>
              )}
            </div>
          )}

          {activeTab === 'health' && (
            <div className="space-y-4">
              {/* Allergies */}
              <Card className="p-4 border-0 shadow">
                <h3 className="font-bold text-gray-900 mb-3">
                  <AlertCircle className="w-5 h-5 inline mr-2 text-red-500" />
                  Allergies
                </h3>
                {selectedPet.allergies && selectedPet.allergies.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {selectedPet.allergies.map((allergy, i) => (
                      <Badge key={i} className="bg-red-100 text-red-700">{allergy}</Badge>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">No known allergies</p>
                )}
              </Card>

              {/* Medications */}
              <Card className="p-4 border-0 shadow">
                <h3 className="font-bold text-gray-900 mb-3">
                  <Heart className="w-5 h-5 inline mr-2 text-blue-500" />
                  Current Medications
                </h3>
                {selectedPet.currentMedications && selectedPet.currentMedications.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {selectedPet.currentMedications.map((med, i) => (
                      <Badge key={i} className="bg-blue-100 text-blue-700">{med}</Badge>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">No current medications</p>
                )}
              </Card>

              {/* Chronic Conditions */}
              <Card className="p-4 border-0 shadow">
                <h3 className="font-bold text-gray-900 mb-3">
                  <FileText className="w-5 h-5 inline mr-2 text-purple-500" />
                  Chronic Conditions
                </h3>
                {selectedPet.chronicConditions && selectedPet.chronicConditions.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {selectedPet.chronicConditions.map((cond, i) => (
                      <Badge key={i} className="bg-purple-100 text-purple-700">{cond}</Badge>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">No chronic conditions</p>
                )}
              </Card>
            </div>
          )}

          {activeTab === 'vaccinations' && (
            <div className="space-y-4">
              {selectedPet.vaccinations && selectedPet.vaccinations.length > 0 ? (
                selectedPet.vaccinations.map((vax) => {
                  const isOverdue = new Date(vax.nextDueDate) < new Date();
                  const isDueSoon = new Date(vax.nextDueDate) <= new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
                  
                  return (
                    <Card 
                      key={vax.id} 
                      className={`p-4 border-0 shadow ${
                        isOverdue ? 'bg-red-50 border-l-4 border-l-red-500' :
                        isDueSoon ? 'bg-amber-50 border-l-4 border-l-amber-500' :
                        'bg-green-50 border-l-4 border-l-green-500'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <h4 className="font-bold text-gray-900">{vax.name}</h4>
                          <div className="mt-2 space-y-1 text-sm">
                            <p className="text-gray-600">
                              <Clock className="w-4 h-4 inline mr-1" />
                              Last: {vax.lastDate}
                            </p>
                            <p className={`${
                              isOverdue ? 'text-red-600 font-medium' :
                              isDueSoon ? 'text-amber-600 font-medium' :
                              'text-green-600'
                            }`}>
                              <Calendar className="w-4 h-4 inline mr-1" />
                              Next Due: {vax.nextDueDate}
                            </p>
                          </div>
                        </div>
                        <Badge className={`${
                          isOverdue ? 'bg-red-500 text-white' :
                          isDueSoon ? 'bg-amber-500 text-white' :
                          'bg-green-500 text-white'
                        }`}>
                          {isOverdue ? 'Overdue' : isDueSoon ? 'Due Soon' : 'Up to Date'}
                        </Badge>
                      </div>
                    </Card>
                  );
                })
              ) : (
                <div className="text-center py-8">
                  <Syringe className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500">No vaccination records</p>
                  <p className="text-sm text-gray-400 mt-1">
                    Edit your pet to add vaccination records
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Quick Actions */}
          <div className="grid grid-cols-2 gap-3 pb-6">
            <Button
              onClick={() => onNavigate('vet-booking', { petId: selectedPet.id })}
              className="bg-orange-500 hover:bg-orange-600 text-white h-12 rounded-xl"
            >
              <Calendar className="w-4 h-4 mr-2" />
              Book Vet Visit
            </Button>
            <Button
              onClick={() => onNavigate('grooming', { petId: selectedPet.id })}
              variant="outline"
              className="h-12 rounded-xl border-2"
            >
              <Star className="w-4 h-4 mr-2" />
              Book Grooming
            </Button>
          </div>
        </div>
      ) : null}

      {/* Add Pet Modal */}
      <EnhancedAddPetModal
        phone={phone}
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSuccess={() => {
          fetchPets();
          setShowAddModal(false);
        }}
      />

      {/* Edit Pet Modal */}
      {editingPet && (
        <EnhancedAddPetModal
          phone={phone}
          isOpen={true}
          onClose={() => setEditingPet(null)}
          onSuccess={() => {
            fetchPets();
            setEditingPet(null);
          }}
          editPet={editingPet as any}
        />
      )}
    </div>
  );
}

// Helper component for info rows
function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-gray-500">{label}</p>
      <p className="text-sm font-medium text-gray-900">{value}</p>
    </div>
  );
}

export default EnhancedPetProfilePage;
