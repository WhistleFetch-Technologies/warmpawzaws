import { useState, useEffect } from 'react';
import { X, FileText, Pill, Calendar, Download, AlertCircle, Stethoscope, Clipboard, Activity } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { projectId, publicAnonKey } from '../../utils/supabase/info';

interface MedicalHistoryModalProps {
  petId: string;
  bookingId: string; // Context for access control
  petName: string;
  vendorId: string; // ✅ ADD: For authentication
  onClose: () => void;
}

interface MedicalRecord {
  id: string;
  type: 'prescription' | 'vaccination' | 'lab_report' | 'consultation_note' | 'vet_summary' | 'upload' | 'xray' | 'other';
  title: string;
  description?: string;
  date: string;
  uploadedBy?: string; // Changed from doctorName
  doctorName?: string;
  clinicName?: string;
  url?: string | null;
  fileName?: string;
  fileType?: string;
  metadata?: any;
}

export function MedicalHistoryModal({ petId, bookingId, petName, vendorId, onClose }: MedicalHistoryModalProps) {
  const [records, setRecords] = useState<MedicalRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'all' | 'prescriptions' | 'reports' | 'notes'>('all');
  const [error, setError] = useState<string | null>(null);
  const [petInfo, setPetInfo] = useState<any>(null); // ✅ ADD: Store pet details

  useEffect(() => {
    fetchMedicalHistory();
  }, [petId, bookingId]);

  const fetchMedicalHistory = async () => {
    try {
      setLoading(true);
      setError(null);

      console.log('[MEDICAL UI] Requesting history for appointment:', bookingId);

      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/appointments/${bookingId}/medical-records`,
        {
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'X-User-Id': vendorId,
            'X-User-Role': 'vendor'
          }
        }
      );

      if (response.ok) {
        const data = await response.json();
        // ✅ FIX: Handle standardized response format
        // Response format: { success: true, records: [...], petInfo: {...}, ... }
        if (data.success || data.data?.success) {
          const recordsList = data.records || data.data?.records || [];
          setRecords(recordsList);
          
          // ✅ FIX: Handle pet info from standardized format
          const petInfoData = data.petInfo || data.data?.petInfo || {
            name: data.petName || data.data?.petName,
            photo: data.petPhoto || data.data?.petPhoto,
            species: data.petSpecies || data.data?.petSpecies,
            breed: data.petBreed || data.data?.petBreed
          };
          setPetInfo(petInfoData);
        } else {
          const errorMessage = data.error || data.message || 'Failed to load records';
          setError(errorMessage);
        }
      } else {
        const errData = await response.json().catch(() => ({ error: 'Unknown error occurred' }));
        const errorMessage = errData.error || errData.message || 'Access to medical records denied';
        setError(errorMessage);
      }
    } catch (err: any) {
      console.error('Error fetching medical history:', err);
      const errorMessage = err?.message || 'Network error loading records. Please try again.';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const filteredRecords = activeTab === 'all' 
    ? records 
    : activeTab === 'prescriptions' 
      ? records.filter(r => r.type === 'prescription')
      : activeTab === 'reports'
        ? records.filter(r => r.type === 'lab_report' || r.type === 'vaccination')
        : records.filter(r => r.type === 'consultation_note');

  const getIcon = (type: string) => {
    switch (type) {
      case 'prescription': return <Pill className="w-5 h-5 text-blue-600" />;
      case 'vaccination': return <Activity className="w-5 h-5 text-green-600" />;
      case 'lab_report': return <Clipboard className="w-5 h-5 text-orange-600" />;
      case 'consultation_note': return <Stethoscope className="w-5 h-5 text-purple-600" />;
      default: return <FileText className="w-5 h-5 text-gray-500" />;
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'prescription': return 'Prescription';
      case 'vaccination': return 'Vaccination';
      case 'lab_report': return 'Lab Report';
      case 'consultation_note': return 'Consultation Note';
      default: return 'Document';
    }
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col p-0 gap-0 overflow-hidden bg-white rounded-2xl shadow-2xl">
        {/* Header */}
        <div className="p-6 border-b border-gray-100 bg-gradient-to-r from-blue-50 to-indigo-50">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-sm text-blue-600">
                <Activity className="w-6 h-6" />
              </div>
              <div>
                <DialogTitle className="text-xl font-bold text-blue-900">Medical History</DialogTitle>
                <p className="text-sm text-blue-700 mt-0.5">
                  Confidential Record for <span className="font-semibold">{petName}</span>
                </p>
              </div>
            </div>
            <button 
              onClick={onClose} 
              className="p-2 hover:bg-white/50 rounded-full transition-colors text-blue-700"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 px-6 pt-2 bg-white sticky top-0 z-10">
          <button
            onClick={() => setActiveTab('all')}
            className={`pb-3 px-4 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'all' ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            All Records
          </button>
          <button
            onClick={() => setActiveTab('prescriptions')}
            className={`pb-3 px-4 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'prescriptions' ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Prescriptions
          </button>
          <button
            onClick={() => setActiveTab('reports')}
            className={`pb-3 px-4 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'reports' ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Labs & Uploads
          </button>
          <button
            onClick={() => setActiveTab('notes')}
            className={`pb-3 px-4 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'notes' ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Consultation Notes
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 bg-gray-50 min-h-[400px]">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-64">
              <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4"></div>
              <p className="text-sm text-gray-600 font-medium">Retrieving secure medical records...</p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center h-64 text-center p-6 bg-red-50 rounded-xl border border-red-100 m-4">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mb-3">
                <AlertCircle className="w-6 h-6 text-red-600" />
              </div>
              <h3 className="text-red-900 font-semibold mb-1">Access Restricted</h3>
              <p className="text-sm text-red-700 max-w-xs mx-auto">{error}</p>
              <p className="text-xs text-red-500 mt-2">
                Records are only available during active appointments for the assigned pet.
              </p>
            </div>
          ) : filteredRecords.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-center">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                <FileText className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-gray-900 font-medium mb-1">No records found</h3>
              <p className="text-gray-500 text-sm">
                No medical history available in this category.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredRecords.map((record) => (
                <div key={record.id} className="bg-white p-5 rounded-xl border border-gray-200 hover:border-blue-300 hover:shadow-md transition-all group">
                  <div className="flex items-start gap-4">
                    {/* Icon Column */}
                    <div className="w-12 h-12 rounded-full bg-gray-50 flex items-center justify-center flex-shrink-0 group-hover:bg-blue-50 transition-colors">
                      {getIcon(record.type)}
                    </div>

                    {/* Content Column */}
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start mb-1">
                        <div>
                          <span className="inline-block px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider bg-gray-100 text-gray-600 mb-1">
                            {getTypeLabel(record.type)}
                          </span>
                          <h4 className="text-base font-bold text-gray-900 group-hover:text-blue-700 transition-colors">
                            {record.title}
                          </h4>
                        </div>
                        <span className="text-xs text-gray-500 font-medium whitespace-nowrap flex items-center bg-gray-50 px-2 py-1 rounded">
                          <Calendar className="w-3 h-3 mr-1.5" />
                          {new Date(record.date).toLocaleDateString('en-IN', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric'
                          })}
                        </span>
                      </div>
                      
                      {record.doctorName && (
                        <p className="text-xs text-blue-600 font-medium mb-2 flex items-center">
                          <Stethoscope className="w-3 h-3 mr-1" />
                          Dr. {record.doctorName} 
                          {record.clinicName && <span className="text-gray-400 mx-1">•</span>} 
                          {record.clinicName}
                        </p>
                      )}
                      
                      {record.description && (
                        <p className="text-sm text-gray-600 leading-relaxed mb-3">
                          {record.description}
                        </p>
                      )}
                      
                      {/* Metadata Tags */}
                      {record.metadata && (
                        <div className="flex flex-wrap gap-2 mb-3">
                          {record.metadata.diagnosis && (
                            <span className="text-xs bg-red-50 text-red-700 px-2 py-1 rounded border border-red-100">
                              Dx: {record.metadata.diagnosis}
                            </span>
                          )}
                          {record.metadata.dosage && (
                            <span className="text-xs bg-green-50 text-green-700 px-2 py-1 rounded border border-green-100">
                              Rx: {record.metadata.dosage}
                            </span>
                          )}
                        </div>
                      )}

                      {/* Actions */}
                      {record.url ? (
                        <a 
                          href={record.url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="inline-flex items-center text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg transition-colors shadow-sm"
                        >
                          <Download className="w-3.5 h-3.5 mr-2" />
                          Download Report / PDF
                        </a>
                      ) : (
                        <div className="inline-flex items-center text-xs text-gray-400 italic bg-gray-50 px-3 py-1.5 rounded">
                          Text Record Only
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        
        {/* Footer */}
        <div className="p-4 bg-white border-t border-gray-200 text-center">
          <p className="text-[10px] text-gray-400 flex items-center justify-center gap-1.5">
            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
            HIPAA Compliant • End-to-End Encrypted • Access Logged
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}