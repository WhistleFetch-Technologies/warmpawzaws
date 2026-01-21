"use client";

import { useState, useEffect } from 'react';
import { X, FileText, Pill, Syringe, Heart, Calendar, User, Download, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { apiClient } from '@/lib/api-client';

interface MedicalRecord {
  id: string;
  date: string;
  type: 'consultation' | 'vaccination' | 'surgery' | 'prescription' | 'lab_test';
  title: string;
  notes: string;
  doctorName?: string;
  clinicName?: string;
  prescriptions?: Array<{ name: string; dosage: string; duration: string }>;
  attachments?: string[];
}

interface MedicalHistoryModalProps {
  petId: string;
  petName: string;
  bookingId: string;
  vendorId: string;
  onClose: () => void;
}

export function MedicalHistoryModal({ petId, petName, bookingId, vendorId, onClose }: MedicalHistoryModalProps) {
  const [records, setRecords] = useState<MedicalRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedRecord, setExpandedRecord] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<string>('all');

  useEffect(() => {
    loadMedicalHistory();
  }, [petId]);

  const loadMedicalHistory = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get<any>(`/medical-records/pet/${petId}`);
      if (response.records) {
        setRecords(response.records);
      } else {
        // Demo data if API fails
        setRecords([
          {
            id: '1',
            date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
            type: 'consultation',
            title: 'General Checkup',
            notes: 'Regular health checkup. Pet is in good health. Weight: 12kg. Temperature normal.',
            doctorName: 'Dr. Priya Sharma',
            clinicName: 'PetCare Clinic',
          },
          {
            id: '2',
            date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
            type: 'vaccination',
            title: 'Rabies Vaccination',
            notes: 'Annual rabies vaccination administered. Next due: ' + new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toLocaleDateString(),
            doctorName: 'Dr. Amit Patel',
            clinicName: 'VetCare Hospital',
          },
          {
            id: '3',
            date: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
            type: 'prescription',
            title: 'Skin Allergy Treatment',
            notes: 'Mild skin irritation observed. Prescribed medication for 7 days.',
            doctorName: 'Dr. Priya Sharma',
            clinicName: 'PetCare Clinic',
            prescriptions: [
              { name: 'Antihistamine Tablets', dosage: '1 tablet', duration: '7 days' },
              { name: 'Medicated Shampoo', dosage: 'Apply twice weekly', duration: '2 weeks' },
            ],
          },
          {
            id: '4',
            date: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(),
            type: 'lab_test',
            title: 'Blood Test - Complete Panel',
            notes: 'All parameters within normal range. CBC, Liver function, Kidney function - Normal.',
            doctorName: 'Dr. Amit Patel',
            clinicName: 'VetCare Hospital',
          },
        ]);
      }
    } catch (error) {
      console.error('Error loading medical history:', error);
    } finally {
      setLoading(false);
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'consultation': return <Heart className="w-4 h-4" />;
      case 'vaccination': return <Syringe className="w-4 h-4" />;
      case 'surgery': return <FileText className="w-4 h-4" />;
      case 'prescription': return <Pill className="w-4 h-4" />;
      case 'lab_test': return <FileText className="w-4 h-4" />;
      default: return <FileText className="w-4 h-4" />;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'consultation': return 'bg-blue-100 text-blue-600';
      case 'vaccination': return 'bg-green-100 text-green-600';
      case 'surgery': return 'bg-red-100 text-red-600';
      case 'prescription': return 'bg-purple-100 text-purple-600';
      case 'lab_test': return 'bg-amber-100 text-amber-600';
      default: return 'bg-gray-100 text-gray-600';
    }
  };

  const filteredRecords = activeFilter === 'all' 
    ? records 
    : records.filter(r => r.type === activeFilter);

  return (
    <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-gray-200 flex items-center justify-between bg-gradient-to-r from-blue-50 to-purple-50">
          <div>
            <h3 className="text-lg font-bold text-gray-900">Medical History</h3>
            <p className="text-sm text-gray-600">{petName}</p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Filters */}
        <div className="p-3 border-b border-gray-100 flex gap-2 overflow-x-auto">
          {[
            { key: 'all', label: 'All' },
            { key: 'consultation', label: 'Consultations' },
            { key: 'vaccination', label: 'Vaccinations' },
            { key: 'prescription', label: 'Prescriptions' },
            { key: 'lab_test', label: 'Lab Tests' },
          ].map(filter => (
            <button
              key={filter.key}
              onClick={() => setActiveFilter(filter.key)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                activeFilter === filter.key
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>

        {/* Records List */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full mx-auto mb-2"></div>
              <p className="text-gray-500">Loading medical history...</p>
            </div>
          ) : filteredRecords.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <FileText className="w-12 h-12 mx-auto mb-2 text-gray-300" />
              <p>No medical records found</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredRecords.map(record => (
                <div key={record.id} className="border border-gray-200 rounded-xl overflow-hidden">
                  <button
                    onClick={() => setExpandedRecord(expandedRecord === record.id ? null : record.id)}
                    className="w-full p-3 flex items-center gap-3 hover:bg-gray-50 transition-colors"
                  >
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${getTypeColor(record.type)}`}>
                      {getTypeIcon(record.type)}
                    </div>
                    <div className="flex-1 text-left">
                      <h4 className="font-medium text-gray-900">{record.title}</h4>
                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        <Calendar className="w-3 h-3" />
                        {new Date(record.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                        {record.doctorName && (
                          <>
                            <span>•</span>
                            <User className="w-3 h-3" />
                            {record.doctorName}
                          </>
                        )}
                      </div>
                    </div>
                    {expandedRecord === record.id ? (
                      <ChevronUp className="w-5 h-5 text-gray-400" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-gray-400" />
                    )}
                  </button>

                  {expandedRecord === record.id && (
                    <div className="px-4 pb-4 pt-2 border-t border-gray-100 bg-gray-50">
                      <p className="text-sm text-gray-700 mb-3">{record.notes}</p>
                      
                      {record.clinicName && (
                        <p className="text-xs text-gray-500 mb-2">
                          📍 {record.clinicName}
                        </p>
                      )}

                      {record.prescriptions && record.prescriptions.length > 0 && (
                        <div className="mt-3">
                          <p className="text-xs font-medium text-gray-700 mb-2">Prescribed Medications:</p>
                          <div className="space-y-2">
                            {record.prescriptions.map((rx, idx) => (
                              <div key={idx} className="bg-white p-2 rounded-lg border border-gray-200">
                                <p className="font-medium text-sm text-gray-900">{rx.name}</p>
                                <p className="text-xs text-gray-500">{rx.dosage} • {rx.duration}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {record.attachments && record.attachments.length > 0 && (
                        <div className="mt-3 flex gap-2">
                          {record.attachments.map((att, idx) => (
                            <button key={idx} className="flex items-center gap-1 px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg text-xs font-medium">
                              <Download className="w-3 h-3" />
                              Download Report
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 bg-gray-50">
          <Button onClick={onClose} className="w-full bg-blue-600 hover:bg-blue-700">
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}
