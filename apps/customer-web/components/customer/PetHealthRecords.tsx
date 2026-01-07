'use client';

import { useState, useEffect } from 'react';
import { ArrowLeft, Calendar, FileText, Plus, Edit2, Trash2, AlertCircle, CheckCircle } from 'lucide-react';
import Image from 'next/image';
import { apiClient } from '@/lib/api-client';

interface HealthRecord {
  id: string;
  date: string;
  type: 'checkup' | 'vaccination' | 'surgery' | 'medication' | 'other';
  title: string;
  description: string;
  veterinarian?: string;
  clinic?: string;
  attachments?: string[];
}

interface Pet {
  id: string;
  name: string;
  type: string;
  breed: string;
  photo?: string;
  healthRecords?: {
    lastCheckup?: string;
    allergies?: string;
    medications?: string;
    conditions?: string;
  };
}

interface PetHealthRecordsProps {
  phone: string;
  petId: string;
  onBack: () => void;
}

export function PetHealthRecords({ phone, petId, onBack }: PetHealthRecordsProps) {
  const [pet, setPet] = useState<Pet | null>(null);
  const [records, setRecords] = useState<HealthRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingRecord, setEditingRecord] = useState<HealthRecord | null>(null);

  useEffect(() => {
    loadPetAndRecords();
  }, [petId, phone]);

  const loadPetAndRecords = async () => {
    try {
      setLoading(true);
      
      // Load pet details
      const petResponse = await apiClient.get<{ success: boolean; pet: Pet }>(`/pet/${petId}`);
      if (petResponse.success && petResponse.pet) {
        setPet(petResponse.pet);
      }

      // Load health records
      const recordsResponse = await apiClient.get<{ records: HealthRecord[] }>(`/pet/${petId}/health-records`);
      if (recordsResponse.records) {
        setRecords(recordsResponse.records);
      }
    } catch (error) {
      console.error('Error loading health records:', error);
    } finally {
      setLoading(false);
    }
  };

  const getRecordTypeIcon = (type: string) => {
    switch (type) {
      case 'checkup': return '🏥';
      case 'vaccination': return '💉';
      case 'surgery': return '⚕️';
      case 'medication': return '💊';
      default: return '📋';
    }
  };

  const getRecordTypeColor = (type: string) => {
    switch (type) {
      case 'checkup': return 'bg-blue-100 text-blue-700';
      case 'vaccination': return 'bg-green-100 text-green-700';
      case 'surgery': return 'bg-red-100 text-red-700';
      case 'medication': return 'bg-purple-100 text-purple-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-IN', { 
      day: 'numeric', 
      month: 'short', 
      year: 'numeric' 
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center w-full max-w-[430px] mx-auto">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading health records...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 w-full max-w-[430px] mx-auto">
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
              {pet?.name}'s Health Records
            </h1>
            <p className="text-white/90 text-sm">Medical history & records</p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="px-0 py-0 space-y-6">
        {/* Quick Health Info */}
        {pet?.healthRecords && (
          <div className="bg-white rounded-2xl p-0 shadow-sm">
            <h3 className="font-bold text-gray-900 mb-4">Quick Health Info</h3>
            <div className="space-y-3">
              {pet.healthRecords.lastCheckup && (
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Last Checkup</span>
                  <span className="font-semibold text-gray-900">
                    {new Date(pet.healthRecords.lastCheckup).toLocaleDateString()}
                  </span>
                </div>
              )}
              {pet.healthRecords.allergies && (
                <div>
                  <span className="text-gray-600">Allergies</span>
                  <p className="font-semibold text-gray-900 mt-0">{pet.healthRecords.allergies}</p>
                </div>
              )}
              {pet.healthRecords.medications && (
                <div>
                  <span className="text-gray-600">Current Medications</span>
                  <p className="font-semibold text-gray-900 mt-0">{pet.healthRecords.medications}</p>
                </div>
              )}
              {pet.healthRecords.conditions && (
                <div>
                  <span className="text-gray-600">Medical Conditions</span>
                  <p className="font-semibold text-gray-900 mt-0">{pet.healthRecords.conditions}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Health Records List */}
        <div className="bg-white rounded-2xl p-0 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-gray-900">Health Records</h3>
            <button
              onClick={() => setShowAddForm(true)}
              className="w-10 h-10 bg-primary text-white rounded-full flex items-center justify-center hover:bg-primary-dark transition-colors"
            >
              <Plus className="w-5 h-5" />
            </button>
          </div>

          {records.length === 0 ? (
            <div className="text-center py-02">
              <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-600 mb-0">No health records yet</p>
              <p className="text-sm text-gray-500">Add a record to get started</p>
            </div>
          ) : (
            <div className="space-y-3">
              {records
                .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                .map((record) => (
                  <div key={record.id} className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                    <div className="flex items-start justify-between mb-0">
                      <div className="flex items-center gap-0">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-xl ${getRecordTypeColor(record.type)}`}>
                          {getRecordTypeIcon(record.type)}
                        </div>
                        <div className="flex-1">
                          <h4 className="font-semibold text-gray-900">{record.title}</h4>
                          <span className={`text-xs px-0 py-1 rounded-full ${getRecordTypeColor(record.type)}`}>
                            {record.type.charAt(0).toUpperCase() + record.type.slice(1)}
                          </span>
                        </div>
                      </div>
                    </div>
                    <p className="text-sm text-gray-600 mb-0">{record.description}</p>
                    <div className="flex items-center gap-4 text-xs text-gray-500">
                      <div className="flex items-center gap-0">
                        <Calendar className="w-3 h-3" />
                        <span>{formatDate(record.date)}</span>
                      </div>
                      {record.veterinarian && (
                        <span>Dr. {record.veterinarian}</span>
                      )}
                      {record.clinic && (
                        <span>• {record.clinic}</span>
                      )}
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

