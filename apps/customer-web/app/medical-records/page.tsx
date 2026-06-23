'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api-client';
import { downloadFromUrl, getDownloadMessage } from '@/lib/download-file';
import { getResolvedCustomerId } from '@/lib/customer-id-storage';

// ============================================================================
// TYPES
// ============================================================================

interface Pet {
  id: string;
  name: string;
  species: string;
  breed: string;
  image_url?: string;
}

interface MedicalRecord {
  id: string;
  pet_id: string;
  type: 'consultation' | 'vaccination' | 'surgery' | 'diagnostic' | 'prescription' | 'lab_report';
  title: string;
  description: string;
  date: string;
  vendor_name: string;
  doctor_name?: string;
  attachments: Attachment[];
  notes?: string;
  follow_up_date?: string;
  tags: string[];
}

interface Attachment {
  id: string;
  name: string;
  type: string;
  url: string;
  size: number;
}

interface Vaccination {
  id: string;
  pet_id: string;
  vaccine_name: string;
  batch_number: string;
  date_administered: string;
  next_due_date: string;
  administered_by: string;
  clinic_name: string;
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

const UI_TO_BACKEND_TYPE: Record<string, string> = {
  consultation: 'consultation_notes',
  vaccination: 'vaccination',
  surgery: 'surgery_notes',
  diagnostic: 'diagnostic_report',
  lab_report: 'lab_result',
  prescription: 'prescription',
};

const BACKEND_TO_UI_TYPE: Record<string, MedicalRecord['type']> = {
  consultation_notes: 'consultation',
  consultation: 'consultation',
  vaccination: 'vaccination',
  surgery_notes: 'surgery',
  surgery: 'surgery',
  diagnostic_report: 'diagnostic',
  diagnostic: 'diagnostic',
  lab_result: 'lab_report',
  lab_report: 'lab_report',
  prescription: 'prescription',
};

export default function MedicalRecordsPage() {
  const router = useRouter();
  const [pets, setPets] = useState<Pet[]>([]);
  const [records, setRecords] = useState<MedicalRecord[]>([]);
  const [vaccinations, setVaccinations] = useState<Vaccination[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [customerPhone, setCustomerPhone] = useState<string | null>(null);
  const [customerId, setCustomerId] = useState<string | null>(null);
  
  // Filters
  const [selectedPet, setSelectedPet] = useState<string>('');
  const [selectedType, setSelectedType] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  
  // UI States
  const [activeTab, setActiveTab] = useState<'timeline' | 'vaccinations'>('timeline');
  const [showRecord, setShowRecord] = useState<MedicalRecord | null>(null);
  const [sharing, setSharing] = useState(false);

  // ============================================================================
  // DATA LOADING
  // ============================================================================

  useEffect(() => {
    const phone = localStorage.getItem('customerPhone');
    if (!phone) {
      router.push('/auth');
      return;
    }
    setCustomerPhone(phone);
    setCustomerId(getResolvedCustomerId());
  }, [router]);

  useEffect(() => {
    if (!customerPhone) return;
    loadData();
  }, [customerPhone, customerId, selectedPet, selectedType]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      if (!customerPhone) {
        setError('Please log in to view medical records');
        setLoading(false);
        return;
      }

      let resolvedCustomerId = customerId;
      if (!resolvedCustomerId) {
        try {
          const customerRes = await apiClient.get<any>(`/customer/by-phone?phone=${encodeURIComponent(customerPhone)}`);
          resolvedCustomerId = customerRes?.customer?.id || null;
          if (resolvedCustomerId) {
            setCustomerId(resolvedCustomerId);
          }
        } catch (err) {
          console.warn('Could not resolve customerId by phone', err);
        }
      }

      const petsPromise = resolvedCustomerId
        ? apiClient.get<any>(`/customer/${resolvedCustomerId}/pets`)
        : Promise.resolve({ pets: [] });

      const params = new URLSearchParams();
      const backendType = selectedType ? (UI_TO_BACKEND_TYPE[selectedType] || selectedType) : '';
      if (backendType) params.append('type', backendType);

      const recordsEndpoint = selectedPet
        ? `/medical-records/pet/${selectedPet}`
        : `/customer/${encodeURIComponent(customerPhone)}/medical-records`;
      const recordsUrl = params.toString() ? `${recordsEndpoint}?${params.toString()}` : recordsEndpoint;

      const [petsRes, recordsRes] = await Promise.all([
        petsPromise,
        apiClient.get<any>(recordsUrl),
      ]);

      const petsList = (petsRes?.pets || petsRes || []).map((pet: any) => ({
        id: pet.id,
        name: pet.name,
        species: pet.species || pet.type || 'pet',
        breed: pet.breed || '',
        image_url: pet.image_url || pet.profile_photo_url,
      }));

      const normalizeRecordType = (recordType?: string): MedicalRecord['type'] => {
        if (!recordType) return 'consultation';
        const key = recordType.toLowerCase();
        return BACKEND_TO_UI_TYPE[key] || (key as MedicalRecord['type']) || 'consultation';
      };

      const normalizeAttachments = (record: any): Attachment[] => {
        const attachments = Array.isArray(record.attachments) ? record.attachments : [];
        const mapped = attachments.map((att: any, index: number) => ({
          id: att.id || `${record.id}-att-${index}`,
          name: att.name || att.file_name || att.title || 'Attachment',
          type: att.type || att.mime_type || 'file',
          url: att.url || att.file_url || att.document_url || att.s3_url || '',
          size: Number(att.size || att.file_size || 0),
        }));

        if (record.document_url && mapped.length === 0) {
          mapped.push({
            id: `${record.id}-doc`,
            name: record.title || 'Document',
            type: 'document',
            url: record.document_url,
            size: 0,
          });
        }

        return mapped;
      };

      const normalizedRecords: MedicalRecord[] = (recordsRes?.records || recordsRes || []).map((record: any) => ({
        id: record.id,
        pet_id: record.pet_id,
        type: normalizeRecordType(record.record_type || record.type),
        title: record.title || record.record_type || 'Medical Record',
        description: record.description || record.notes || '',
        date: record.date || record.record_date || record.prescription_date || record.created_at,
        vendor_name: record.vendor_name || record.clinic_name || record.vendorName || '',
        doctor_name: record.doctor_name || record.veterinarian_name || record.staff_name || record.doctorName,
        attachments: normalizeAttachments(record),
        notes: record.notes || record.instructions,
        follow_up_date: record.follow_up_date || record.followUpDate,
        tags: Array.isArray(record.tags) ? record.tags : [],
      }));

      const vaccinationRecords: Vaccination[] = normalizedRecords
        .filter((record) => record.type === 'vaccination')
        .map((record) => ({
          id: record.id,
          pet_id: record.pet_id,
          vaccine_name: record.title || 'Vaccination',
          batch_number: '',
          date_administered: record.date,
          next_due_date: record.follow_up_date || record.date,
          administered_by: record.doctor_name || '',
          clinic_name: record.vendor_name || '',
        }));

      setPets(petsList);
      setRecords(normalizedRecords);
      setVaccinations(vaccinationRecords);
    } catch (err: any) {
      console.error('Error loading medical records:', err);
      setError(err.message || 'Failed to load medical records');
    } finally {
      setLoading(false);
    }
  };

  // ============================================================================
  // ACTIONS
  // ============================================================================

  const handleDownload = async (attachment: Attachment) => {
    try {
      const { saveResult } = await downloadFromUrl({
        url: attachment.url,
        fileName: attachment.name,
        title: attachment.name,
        previewHtmlInBrowser: false,
      });
      if (saveResult === 'failed') {
        alert(getDownloadMessage(saveResult, 'file'));
      }
    } catch {
      alert('Failed to download file');
    }
  };

  const handleShare = async (record: MedicalRecord) => {
    try {
      setSharing(true);
      
      // Try Web Share API first
      if (navigator.share) {
        await navigator.share({
          title: record.title,
          text: `Medical record for my pet: ${record.title}`,
          // In production, this would be a shareable link
        });
      } else {
        // Fallback: Copy link to clipboard
        await navigator.clipboard.writeText(`Medical record: ${record.title} - ${record.date}`);
        alert('Link copied to clipboard!');
      }
    } catch (err) {
      console.error('Share failed:', err);
    } finally {
      setSharing(false);
    }
  };

  const handleExportAll = async () => {
    try {
      setError('Export is not available yet. Please contact support if you need a copy.');
    } catch (err: any) {
      setError(err.message || 'Failed to export records');
    }
  };

  // ============================================================================
  // FILTER
  // ============================================================================

  const filteredRecords = records.filter(record => {
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      return (
        record.title.toLowerCase().includes(search) ||
        record.description.toLowerCase().includes(search) ||
        record.vendor_name.toLowerCase().includes(search) ||
        record.tags.some(tag => tag.toLowerCase().includes(search))
      );
    }
    return true;
  });

  const filteredVaccinations = vaccinations.filter(v => !selectedPet || v.pet_id === selectedPet);

  // ============================================================================
  // RENDER
  // ============================================================================

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-50 to-amber-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading medical records...</p>
        </div>
      </div>
    );
  }

  const typeIcons: Record<string, { icon: string; color: string }> = {
    consultation: { icon: '🩺', color: 'bg-blue-100 text-blue-600' },
    vaccination: { icon: '💉', color: 'bg-green-100 text-green-600' },
    surgery: { icon: '🏥', color: 'bg-red-100 text-red-600' },
    diagnostic: { icon: '🔬', color: 'bg-purple-100 text-purple-600' },
    prescription: { icon: '💊', color: 'bg-orange-100 text-orange-600' },
    lab_report: { icon: '📋', color: 'bg-teal-100 text-teal-600' },
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-amber-50">
      {/* Header - Match consistency pattern: max-w-7xl mx-auto px-6 py-4 */}
      <div className="bg-white/90 backdrop-blur-sm border-b border-orange-200 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              {/* ✅ FIX: Match consistency - text-2xl font-bold */}
              <h1 className="text-2xl font-bold text-gray-800">Medical Records</h1>
              <p className="text-sm text-gray-500 mt-1">Track your pet's health history</p>
            </div>
            <button
              onClick={handleExportAll}
              className="px-4 py-2 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 transition"
            >
              📥 Export All
            </button>
          </div>
        </div>
      </div>

      {/* Pet Selector */}
      <div className="bg-white/90 backdrop-blur-sm border-b border-orange-200">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex gap-3 overflow-x-auto pb-2">
            <button
              onClick={() => setSelectedPet('')}
              className={`flex items-center gap-2 px-4 py-2 rounded-full whitespace-nowrap transition ${
                !selectedPet ? 'bg-orange-500 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              All Pets
            </button>
            {pets.map(pet => (
              <button
                key={pet.id}
                onClick={() => setSelectedPet(pet.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-full whitespace-nowrap transition ${
                  selectedPet === pet.id ? 'bg-orange-500 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {pet.species === 'dog' ? '🐕' : pet.species === 'cat' ? '🐱' : '🐾'} {pet.name}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Content - Match consistency pattern: max-w-7xl mx-auto p-6 or p-8 */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-7xl mx-auto p-6">
          
          {/* Tabs */}
          <div className="mb-6">
            <div className="flex bg-white rounded-xl p-1 shadow-sm">
          <button
            onClick={() => setActiveTab('timeline')}
            className={`flex-1 py-3 rounded-lg font-medium transition ${
              activeTab === 'timeline' ? 'bg-orange-500 text-white' : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            📅 Timeline
          </button>
          <button
            onClick={() => setActiveTab('vaccinations')}
            className={`flex-1 py-3 rounded-lg font-medium transition ${
              activeTab === 'vaccinations' ? 'bg-orange-500 text-white' : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            💉 Vaccinations
          </button>
        </div>
      </div>

          {/* Error */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700">
              {error}
            </div>
          )}

          {/* Timeline Tab */}
        {activeTab === 'timeline' && (
          <>
            {/* Filters */}
            <div className="flex flex-wrap gap-3 mb-6">
              <input
                type="text"
                placeholder="Search records..."
                value={searchTerm}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchTerm(e.target.value)}
                className="flex-1 min-w-[200px] px-4 py-2 border border-gray-200 rounded-lg focus:border-orange-500 outline-none"
              />
              <select
                value={selectedType}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setSelectedType(e.target.value)}
                className="px-4 py-2 border border-gray-200 rounded-lg focus:border-orange-500 outline-none"
              >
                <option value="">All Types</option>
                <option value="consultation">Consultations</option>
                <option value="vaccination">Vaccinations</option>
                <option value="prescription">Prescriptions</option>
                <option value="diagnostic">Diagnostics</option>
                <option value="surgery">Surgeries</option>
              </select>
            </div>

            {/* Timeline */}
            {filteredRecords.length === 0 ? (
              <div className="bg-white rounded-2xl p-12 text-center shadow-sm">
                <div className="text-5xl mb-4">📋</div>
                <p className="text-gray-500">No medical records found</p>
              </div>
            ) : (
              <div className="relative">
                {/* Timeline line */}
                <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-gray-200" />
                
                <div className="space-y-6">
                  {filteredRecords.map((record, idx) => (
                    <div key={record.id} className="relative pl-14">
                      {/* Timeline dot */}
                      <div className={`absolute left-4 w-5 h-5 rounded-full border-2 border-white ${typeIcons[record.type]?.color || 'bg-gray-100'}`} />
                      
                      <div className="bg-white rounded-2xl p-5 shadow-sm hover:shadow-md transition cursor-pointer" onClick={() => setShowRecord(record)}>
                        <div className="flex items-start justify-between">
                          <div className="flex items-start gap-3">
                            <span className="text-2xl">{typeIcons[record.type]?.icon || '📄'}</span>
                            <div>
                              <h3 className="font-semibold text-gray-900">{record.title}</h3>
                              <p className="text-sm text-gray-600 mt-1">{record.description}</p>
                              <p className="text-sm text-gray-500 mt-2">
                                {record.vendor_name} {record.doctor_name && `• ${record.doctor_name}`}
                              </p>
                            </div>
                          </div>
                          <span className="text-sm text-gray-400">
                            {new Date(record.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </span>
                        </div>
                        
                        {/* Tags */}
                        {record.tags.length > 0 && (
                          <div className="flex gap-2 mt-3">
                            {record.tags.map(tag => (
                              <span key={tag} className="px-2 py-1 bg-gray-100 text-gray-600 rounded text-xs">
                                #{tag}
                              </span>
                            ))}
                          </div>
                        )}
                        
                        {/* Attachments count */}
                        {record.attachments.length > 0 && (
                          <div className="mt-3 text-sm text-orange-600">
                            📎 {record.attachments.length} attachment(s)
                          </div>
                        )}
                        
                        {/* Order Medicine button for prescription records */}
                        {record.type === 'prescription' && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              router.push(`/prescriptions/${record.id}/order`);
                            }}
                            className="mt-3 w-full py-2 bg-emerald-50 text-emerald-700 rounded-lg font-medium hover:bg-emerald-100 transition-colors flex items-center justify-center gap-2"
                          >
                            <span>💊</span>
                            Order Medicine
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {/* Vaccinations Tab */}
        {activeTab === 'vaccinations' && (
          <div className="space-y-4">
            {/* Upcoming */}
            <div className="bg-orange-50 rounded-2xl p-5">
              <h3 className="font-semibold text-orange-900 mb-3">⏰ Upcoming Vaccinations</h3>
              {filteredVaccinations.filter(v => new Date(v.next_due_date) > new Date()).length === 0 ? (
                <p className="text-orange-700 text-sm">No upcoming vaccinations</p>
              ) : (
                <div className="space-y-3">
                  {filteredVaccinations
                    .filter(v => new Date(v.next_due_date) > new Date())
                    .sort((a, b) => new Date(a.next_due_date).getTime() - new Date(b.next_due_date).getTime())
                    .map(v => (
                      <div key={v.id} className="bg-white rounded-xl p-4 flex items-center justify-between">
                        <div>
                          <p className="font-medium text-gray-900">{v.vaccine_name}</p>
                          <p className="text-sm text-gray-500">
                            {pets.find(p => p.id === v.pet_id)?.name}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold text-orange-600">
                            {new Date(v.next_due_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </p>
                          <p className="text-xs text-gray-400">Due</p>
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>

            {/* All Vaccinations */}
            <h3 className="font-semibold text-gray-900 mt-6 mb-3">💉 Vaccination History</h3>
            <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
              {filteredVaccinations.length === 0 ? (
                <div className="p-12 text-center">
                  <div className="text-5xl mb-4">💉</div>
                  <p className="text-gray-500">No vaccination records</p>
                </div>
              ) : (
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Vaccine</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Pet</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Next Due</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Clinic</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {filteredVaccinations.map(v => (
                      <tr key={v.id}>
                        <td className="px-4 py-3 font-medium text-gray-900">{v.vaccine_name}</td>
                        <td className="px-4 py-3 text-gray-600">{pets.find(p => p.id === v.pet_id)?.name}</td>
                        <td className="px-4 py-3 text-gray-600">{new Date(v.date_administered).toLocaleDateString()}</td>
                        <td className="px-4 py-3">
                          <span className={`font-medium ${new Date(v.next_due_date) < new Date() ? 'text-red-600' : 'text-green-600'}`}>
                            {new Date(v.next_due_date).toLocaleDateString()}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-600">{v.clinic_name}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}
        </div>
      </div>

      {/* Modals - Outside main content wrapper */}

      {/* Record Detail Modal */}
      {showRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowRecord(null)} />
          <div className="relative bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b sticky top-0 bg-white">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{typeIcons[showRecord.type]?.icon}</span>
                  <h2 className="text-xl font-semibold">{showRecord.title}</h2>
                </div>
                <button onClick={() => setShowRecord(null)} className="text-gray-400 hover:text-gray-600 text-2xl">✕</button>
              </div>
            </div>
            
            <div className="p-6 space-y-4">
              <div>
                <p className="text-sm text-gray-500 mb-1">Date</p>
                <p className="font-medium">{new Date(showRecord.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
              </div>
              
              <div>
                <p className="text-sm text-gray-500 mb-1">Provider</p>
                <p className="font-medium">{showRecord.vendor_name}</p>
                {showRecord.doctor_name && <p className="text-sm text-gray-600">{showRecord.doctor_name}</p>}
              </div>
              
              <div>
                <p className="text-sm text-gray-500 mb-1">Description</p>
                <p className="text-gray-700">{showRecord.description}</p>
              </div>
              
              {showRecord.notes && (
                <div>
                  <p className="text-sm text-gray-500 mb-1">Notes</p>
                  <p className="text-gray-700 bg-yellow-50 p-3 rounded-lg">{showRecord.notes}</p>
                </div>
              )}
              
              {showRecord.follow_up_date && (
                <div className="p-3 bg-blue-50 rounded-lg">
                  <p className="text-sm text-blue-700">
                    <span className="font-medium">Follow-up scheduled:</span> {new Date(showRecord.follow_up_date).toLocaleDateString()}
                  </p>
                </div>
              )}
              
              {showRecord.attachments.length > 0 && (
                <div>
                  <p className="text-sm text-gray-500 mb-2">Attachments</p>
                  <div className="space-y-2">
                    {showRecord.attachments.map(att => (
                      <button
                        key={att.id}
                        onClick={() => handleDownload(att)}
                        className="w-full flex items-center gap-3 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition"
                      >
                        <span className="text-2xl">{att.type === 'pdf' ? '📄' : '🖼️'}</span>
                        <div className="flex-1 text-left">
                          <p className="font-medium text-gray-900">{att.name}</p>
                          <p className="text-xs text-gray-500">{(att.size / 1024).toFixed(1)} KB</p>
                        </div>
                        <span className="text-orange-500">📥</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
            
            <div className="p-6 border-t bg-gray-50 flex gap-3">
              <button
                onClick={() => handleShare(showRecord)}
                disabled={sharing}
                className="flex-1 py-3 bg-white border border-gray-200 rounded-lg font-medium hover:bg-gray-50 transition"
              >
                {sharing ? '...' : '📤 Share'}
              </button>
              <button
                onClick={() => setShowRecord(null)}
                className="flex-1 py-3 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
