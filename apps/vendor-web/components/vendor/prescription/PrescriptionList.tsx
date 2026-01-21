'use client';

import { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api-client';
import { FileText, Calendar, User, Search, Edit, Send, Clock } from 'lucide-react';
import { CapabilityGate } from '../CapabilityGate';
import { toast } from 'sonner';

interface Prescription {
  id: string;
  booking_id?: string;
  customer_id: string;
  pet_id?: string;
  vendor_id: string;
  medication_name?: string;
  dosage?: string;
  frequency?: string;
  duration?: string;
  instructions?: string;
  prescription_date: string;
  is_active: boolean;
  status?: 'draft' | 'published';
  customer_name?: string;
  pet_name?: string;
}

interface PrescriptionListProps {
  vendorId: string;
  onSelect?: (prescription: Prescription) => void;
  onEdit?: (prescription: Prescription) => void;
}

export function PrescriptionList({ vendorId, onSelect, onEdit }: PrescriptionListProps) {
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [publishing, setPublishing] = useState<string | null>(null);

  useEffect(() => {
    loadPrescriptions();
  }, [vendorId]);

  const loadPrescriptions = async () => {
    try {
      setLoading(true);
      // ✅ FIX: Use correct endpoint for vendor prescriptions
      const response = await apiClient.get<any>(`/prescriptions/vendor/${vendorId}`);
      
      if (response.success || Array.isArray(response)) {
        const data = Array.isArray(response) ? response : (response.prescriptions || response.data || []);
        setPrescriptions(data);
      }
    } catch (error) {
      console.error('Error loading prescriptions:', error);
    } finally {
      setLoading(false);
    }
  };

  // ✅ NEW: Publish draft prescription
  const handlePublish = async (prescription: Prescription) => {
    if (prescription.status !== 'draft') return;
    
    try {
      setPublishing(prescription.id);
      const response = await apiClient.put<any>(`/prescriptions/${prescription.id}`, {
        status: 'published'
      });
      
      if (response.success) {
        toast.success('Prescription published! It is now visible to the customer.');
        loadPrescriptions(); // Refresh list
      } else {
        toast.error(response.error || 'Failed to publish prescription');
      }
    } catch (error: any) {
      console.error('Error publishing prescription:', error);
      toast.error(error.message || 'Failed to publish prescription');
    } finally {
      setPublishing(null);
    }
  };

  const filteredPrescriptions = prescriptions.filter(p => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      p.medication_name?.toLowerCase().includes(term) ||
      p.customer_id?.toLowerCase().includes(term) ||
      p.instructions?.toLowerCase().includes(term)
    );
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <CapabilityGate capability="prescription_create" showDisabledMessage>
      <div className="space-y-4">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search prescriptions..."
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Prescriptions List */}
        {filteredPrescriptions.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
            <FileText className="w-12 h-12 mx-auto text-gray-400 mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No prescriptions found</h3>
            <p className="text-gray-500">Prescriptions will appear here once created</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredPrescriptions.map((prescription) => {
              const isDraft = prescription.status === 'draft';
              const isPublishing = publishing === prescription.id;
              
              return (
                <div
                  key={prescription.id}
                  className={`bg-white rounded-lg p-4 border-2 transition ${
                    isDraft 
                      ? 'border-amber-300 bg-amber-50/50' 
                      : 'border-gray-200 hover:border-blue-300 hover:shadow-md'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div 
                      className="flex-1 cursor-pointer"
                      onClick={() => onSelect?.(prescription)}
                    >
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <FileText className={`w-5 h-5 ${isDraft ? 'text-amber-600' : 'text-blue-600'}`} />
                        <h3 className="font-semibold text-gray-900">
                          {prescription.medication_name || 'Prescription'}
                        </h3>
                        {/* ✅ Status Badge */}
                        {isDraft ? (
                          <span className="px-2 py-1 text-xs bg-amber-100 text-amber-700 rounded-full flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            Draft
                          </span>
                        ) : (
                          <span className="px-2 py-1 text-xs bg-green-100 text-green-700 rounded-full">
                            Published
                          </span>
                        )}
                      </div>
                      
                      {/* Patient Info */}
                      {(prescription.pet_name || prescription.customer_name) && (
                        <div className="text-sm text-gray-600 mb-1">
                          {prescription.pet_name && <span className="font-medium">{prescription.pet_name}</span>}
                          {prescription.customer_name && <span className="text-gray-500"> • {prescription.customer_name}</span>}
                        </div>
                      )}
                      
                      {prescription.dosage && (
                        <div className="text-sm text-gray-600 mb-1">
                          <span className="font-medium">Dosage:</span> {prescription.dosage}
                          {prescription.frequency && ` - ${prescription.frequency}`}
                          {prescription.duration && ` for ${prescription.duration}`}
                        </div>
                      )}

                      <div className="flex items-center gap-4 text-sm text-gray-500 mt-2">
                        <div className="flex items-center gap-1">
                          <Calendar className="w-4 h-4" />
                          {new Date(prescription.prescription_date).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                    
                    {/* ✅ Action Buttons for Drafts */}
                    {isDraft && (
                      <div className="flex flex-col gap-2 ml-3">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onEdit?.(prescription);
                          }}
                          className="px-3 py-1.5 text-xs font-medium text-amber-700 bg-amber-100 rounded-lg hover:bg-amber-200 transition flex items-center gap-1"
                        >
                          <Edit className="w-3 h-3" />
                          Edit
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handlePublish(prescription);
                          }}
                          disabled={isPublishing}
                          className="px-3 py-1.5 text-xs font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 transition flex items-center gap-1 disabled:opacity-50"
                        >
                          {isPublishing ? (
                            <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          ) : (
                            <Send className="w-3 h-3" />
                          )}
                          Publish
                        </button>
                      </div>
                    )}
                  </div>
                  
                  {/* Draft Warning */}
                  {isDraft && (
                    <div className="mt-3 pt-3 border-t border-amber-200 text-xs text-amber-700">
                      ⚠️ This prescription is saved as draft. Publish it to make it visible to the customer.
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </CapabilityGate>
  );
}
