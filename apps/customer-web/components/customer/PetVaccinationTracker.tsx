'use client';

import { useState, useEffect } from 'react';
import { ArrowLeft, Calendar, CheckCircle, AlertCircle, Clock, Plus, Edit2 } from 'lucide-react';
import Image from 'next/image';
import { apiClient } from '@/lib/api-client';

interface Vaccination {
  id: string;
  name: string;
  type: 'rabies' | 'distemper' | 'parvovirus' | 'dhpp' | 'bordetella' | 'other';
  dateGiven: string;
  nextDueDate: string;
  veterinarian?: string;
  clinic?: string;
  batchNumber?: string;
  status: 'up_to_date' | 'due_soon' | 'overdue';
}

interface Pet {
  id: string;
  name: string;
  type: string;
  breed: string;
  photo?: string;
  vaccinations?: {
    rabies?: string;
    distemper?: string;
    parvovirus?: string;
    other?: string;
  };
}

interface PetVaccinationTrackerProps {
  phone: string;
  petId: string;
  onBack: () => void;
}

export function PetVaccinationTracker({ phone, petId, onBack }: PetVaccinationTrackerProps) {
  const [pet, setPet] = useState<Pet | null>(null);
  const [vaccinations, setVaccinations] = useState<Vaccination[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);

  useEffect(() => {
    loadPetAndVaccinations();
  }, [petId, phone]);

  const loadPetAndVaccinations = async () => {
    try {
      setLoading(true);
      
      // Load pet details
      const petResponse = await apiClient.get<{ success: boolean; pet: Pet }>(`/pet/${petId}`);
      if (petResponse.success && petResponse.pet) {
        setPet(petResponse.pet);
      }

      // Load vaccinations
      const vaccinationsResponse = await apiClient.get<{ vaccinations: Vaccination[] }>(`/pet/${petId}/vaccinations`);
      if (vaccinationsResponse.vaccinations) {
        setVaccinations(vaccinationsResponse.vaccinations);
      } else if (pet?.vaccinations) {
        // Convert legacy vaccination format to new format
        const legacyVaccinations: Vaccination[] = [];
        if (pet.vaccinations.rabies) {
          legacyVaccinations.push({
            id: 'legacy_rabies',
            name: 'Rabies',
            type: 'rabies',
            dateGiven: pet.vaccinations.rabies,
            nextDueDate: calculateNextDueDate(pet.vaccinations.rabies, 'rabies'),
            status: getVaccinationStatus(pet.vaccinations.rabies, 'rabies')
          });
        }
        if (pet.vaccinations.distemper) {
          legacyVaccinations.push({
            id: 'legacy_distemper',
            name: 'Distemper',
            type: 'distemper',
            dateGiven: pet.vaccinations.distemper,
            nextDueDate: calculateNextDueDate(pet.vaccinations.distemper, 'distemper'),
            status: getVaccinationStatus(pet.vaccinations.distemper, 'distemper')
          });
        }
        if (pet.vaccinations.parvovirus) {
          legacyVaccinations.push({
            id: 'legacy_parvovirus',
            name: 'Parvovirus',
            type: 'parvovirus',
            dateGiven: pet.vaccinations.parvovirus,
            nextDueDate: calculateNextDueDate(pet.vaccinations.parvovirus, 'parvovirus'),
            status: getVaccinationStatus(pet.vaccinations.parvovirus, 'parvovirus')
          });
        }
        setVaccinations(legacyVaccinations);
      }
    } catch (error) {
      console.error('Error loading vaccinations:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateNextDueDate = (dateGiven: string, type: string): string => {
    const date = new Date(dateGiven);
    const monthsToAdd = type === 'rabies' ? 36 : 12; // Rabies: 3 years, Others: 1 year
    date.setMonth(date.getMonth() + monthsToAdd);
    return date.toISOString().split('T')[0];
  };

  const getVaccinationStatus = (dateGiven: string, type: string): 'up_to_date' | 'due_soon' | 'overdue' => {
    const nextDue = calculateNextDueDate(dateGiven, type);
    const today = new Date();
    const dueDate = new Date(nextDue);
    const daysUntilDue = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    if (daysUntilDue < 0) return 'overdue';
    if (daysUntilDue <= 30) return 'due_soon';
    return 'up_to_date';
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'up_to_date': return 'bg-green-100 text-green-700';
      case 'due_soon': return 'bg-yellow-100 text-yellow-700';
      case 'overdue': return 'bg-red-100 text-red-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'up_to_date': return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'due_soon': return <Clock className="w-5 h-5 text-yellow-600" />;
      case 'overdue': return <AlertCircle className="w-5 h-5 text-red-600" />;
      default: return null;
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-IN', { 
      day: 'numeric', 
      month: 'short', 
      year: 'numeric' 
    });
  };

  const overdueCount = vaccinations.filter(v => v.status === 'overdue').length;
  const dueSoonCount = vaccinations.filter(v => v.status === 'due_soon').length;

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center w-full max-w-customer mx-auto">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading vaccinations...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 w-full max-w-customer mx-auto">
      {/* Header */}
      <div className="bg-gradient-to-r from-primary to-primary-dark px-0 pt-12 pb-0 sticky top-0 z-20">
        <div className="flex items-center gap-4 mb-4">
          <button
            onClick={onBack}
            className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm hover:bg-white/30 transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-white" />
          </button>
          <div className="flex-1">
            <h1 className="text-white text-xl font-bold">
              {pet?.name}'s Vaccinations
            </h1>
            <p className="text-white/90 text-sm">Vaccination tracker & schedule</p>
          </div>
        </div>

        {/* Stats */}
        {(overdueCount > 0 || dueSoonCount > 0) && (
          <div className="bg-white/20 backdrop-blur-sm rounded-xl p-4">
            <div className="flex items-center gap-4">
              {overdueCount > 0 && (
                <div className="flex-1 text-center">
                  <p className="text-2xl font-bold text-red-300">{overdueCount}</p>
                  <p className="text-xs text-white/90">Overdue</p>
                </div>
              )}
              {dueSoonCount > 0 && (
                <div className="flex-1 text-center">
                  <p className="text-2xl font-bold text-yellow-300">{dueSoonCount}</p>
                  <p className="text-xs text-white/90">Due Soon</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="px-0 py-0 space-y-6">
        {/* Vaccinations List */}
        <div className="bg-white rounded-2xl p-0 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-gray-900">Vaccination Records</h3>
            <button
              onClick={() => setShowAddForm(true)}
              className="w-10 h-10 bg-primary text-white rounded-full flex items-center justify-center hover:bg-primary-dark transition-colors"
            >
              <Plus className="w-5 h-5" />
            </button>
          </div>

          {vaccinations.length === 0 ? (
            <div className="text-center py-02">
              <AlertCircle className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-600 mb-0">No vaccination records</p>
              <p className="text-sm text-gray-500">Add a vaccination to get started</p>
            </div>
          ) : (
            <div className="space-y-3">
              {vaccinations
                .sort((a, b) => {
                  // Sort by status priority: overdue > due_soon > up_to_date
                  const statusOrder = { overdue: 0, due_soon: 1, up_to_date: 2 };
                  return statusOrder[a.status] - statusOrder[b.status];
                })
                .map((vaccination) => (
                  <div 
                    key={vaccination.id} 
                    className={`rounded-xl p-4 border-2 ${
                      vaccination.status === 'overdue' 
                        ? 'bg-red-50 border-red-200' 
                        : vaccination.status === 'due_soon'
                        ? 'bg-yellow-50 border-yellow-200'
                        : 'bg-gray-50 border-gray-200'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-0">
                      <div className="flex items-center gap-3">
                        {getStatusIcon(vaccination.status)}
                        <div>
                          <h4 className="font-semibold text-gray-900">{vaccination.name}</h4>
                          <span className={`text-xs px-0 py-1 rounded-full ${getStatusColor(vaccination.status)}`}>
                            {vaccination.status === 'up_to_date' ? 'Up to Date' : 
                             vaccination.status === 'due_soon' ? 'Due Soon' : 'Overdue'}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="space-y-2 text-sm text-gray-600">
                      <div className="flex items-center gap-3">
                        <Calendar className="w-4 h-4" />
                        <span>Given: {formatDate(vaccination.dateGiven)}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <Calendar className="w-4 h-4" />
                        <span>Next Due: {formatDate(vaccination.nextDueDate)}</span>
                      </div>
                      {vaccination.veterinarian && (
                        <div className="text-xs text-gray-500">
                          Dr. {vaccination.veterinarian}
                          {vaccination.clinic && ` • ${vaccination.clinic}`}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>

        {/* Recommended Vaccinations */}
        <div className="bg-white rounded-2xl p-0 shadow-sm">
          <h3 className="font-bold text-gray-900 mb-4">Recommended Vaccinations</h3>
          <div className="space-y-2 text-sm text-gray-600">
            <p>• Rabies (Required annually or every 3 years)</p>
            <p>• DHPP (Distemper, Hepatitis, Parvovirus, Parainfluenza)</p>
            <p>• Bordetella (Kennel Cough)</p>
            <p>• Canine Influenza</p>
            <p className="text-xs text-gray-500 mt-0">
              Consult your veterinarian for a complete vaccination schedule
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

