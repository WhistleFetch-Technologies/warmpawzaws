'use client';

import { useState, useEffect, useRef } from 'react';
import { X, Upload, FileText, Calendar, Image, File, Eye, Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api-client';
import dynamic from 'next/dynamic';
import { transformPrescriptionData } from './PrescriptionDocument';

// Dynamically import PrescriptionDocument for A4 view
const PrescriptionDocument = dynamic(() => import('./PrescriptionDocument'), {
  loading: () => <div className="flex items-center justify-center p-8">Loading document...</div>,
  ssr: false
});

interface PrescriptionHistoryModalProps {
  bookingId: string;
  vendorId: string;
  vendorPhone: string;
  onClose: () => void;
  onUploadSuccess?: () => void;
}

interface Prescription {
  id: string;
  title: string;
  description?: string;
  file_url?: string;
  record_date?: string;
  prescription_date?: string;
  content_data?: any;
  created_at: string;
  vendor_name?: string;
  staff_name?: string;
}

export function PrescriptionHistoryModal({
  bookingId,
  vendorId,
  vendorPhone,
  onClose,
  onUploadSuccess,
}: PrescriptionHistoryModalProps) {
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [fullPrescriptionData, setFullPrescriptionData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [selectedPrescription, setSelectedPrescription] = useState<Prescription | null>(null);
  const [showViewer, setShowViewer] = useState(false);
  const [showA4Document, setShowA4Document] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [recordDate, setRecordDate] = useState('');
  const [uploadingFile, setUploadingFile] = useState<File | null>(null);

  useEffect(() => {
    loadPrescriptions();
  }, [bookingId]);

  const loadPrescriptions = async () => {
    try {
      setLoading(true);
      const result = await apiClient.get(`/medical-records/booking/${bookingId}/prescriptions`) as any;
      setPrescriptions(result.prescriptions || []);
      
      // Also load full prescription data with doctor/pet details for A4 view
      try {
        const fullResult = await apiClient.get(`/prescriptions/booking/${bookingId}?includeDetails=true&includeDrafts=true`) as any;
        if (fullResult.prescriptions?.length > 0) {
          setFullPrescriptionData(fullResult);
        }
      } catch {
        // Ignore - full data is optional
      }
    } catch (error) {
      console.error('Error loading prescriptions:', error);
      toast.error('Failed to load prescriptions');
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file size (max 10MB)
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      toast.error('File size must be less than 10MB');
      return;
    }

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf'];
    if (!allowedTypes.includes(file.type)) {
      toast.error('Only images (JPG, PNG, GIF, WEBP) and PDF files are allowed');
      return;
    }

    setUploadingFile(file);
  };

  const getBaseUrl = (): string => {
    if (typeof window !== 'undefined' && (window as any).__WARMPAWZ_RUNTIME_CONFIG__?.apiBaseUrl) {
      return (window as any).__WARMPAWZ_RUNTIME_CONFIG__.apiBaseUrl;
    }
    return process.env.NEXT_PUBLIC_API_BASE_URL || '';
  };

  const handleUpload = async () => {
    if (!uploadingFile || !recordDate) {
      toast.error('Please select a file and enter the prescription date');
      return;
    }

    // ✅ FIX: Ensure vendorId is available
    const effectiveVendorId = vendorId || (typeof window !== 'undefined' ? localStorage.getItem('vendorId') || '' : '');
    if (!effectiveVendorId) {
      toast.error('Vendor ID is missing. Please refresh the page.');
      return;
    }

    try {
      setUploading(true);
      const formData = new FormData();
      formData.append('file', uploadingFile);
      formData.append('recordDate', recordDate);
      formData.append('uploadedBy', 'vendor');
      formData.append('userId', effectiveVendorId);

      const baseUrl = getBaseUrl();
      const token = localStorage.getItem('authToken') || localStorage.getItem('cognitoIdToken');
      
      const response = await fetch(`${baseUrl}/medical-records/booking/${bookingId}/upload-prescription`, {
        method: 'POST',
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Upload failed');
      }

      toast.success('Prescription uploaded successfully');
      setShowUploadModal(false);
      setUploadingFile(null);
      setRecordDate('');
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      loadPrescriptions();
      if (onUploadSuccess) onUploadSuccess();
    } catch (error: any) {
      console.error('Error uploading prescription:', error);
      toast.error(error.message || 'Failed to upload prescription');
    } finally {
      setUploading(false);
    }
  };

  const handleViewPrescription = async (prescription: Prescription) => {
    try {
      setSelectedPrescription(prescription);
      
      // If it has a file URL, show it directly
      if (prescription.file_url) {
        setShowViewer(true);
        return;
      }

      // Otherwise, fetch the prescription details
      const result = await apiClient.get(`/medical-records/booking/${bookingId}/view/${prescription.id}`) as any;
      if (result.fileUrl) {
        setSelectedPrescription({ ...prescription, file_url: result.fileUrl });
        setShowViewer(true);
      } else {
        // Show prescription content data
        setShowViewer(true);
      }
    } catch (error) {
      console.error('Error viewing prescription:', error);
      toast.error('Failed to load prescription');
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A';
    try {
      return new Date(dateString).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
    } catch {
      return dateString;
    }
  };

  const getPrescriptionDate = (prescription: Prescription) => {
    return prescription.prescription_date || prescription.record_date || prescription.created_at;
  };

  // Sort prescriptions by date (latest first)
  const sortedPrescriptions = [...prescriptions].sort((a, b) => {
    const dateA = new Date(getPrescriptionDate(a)).getTime();
    const dateB = new Date(getPrescriptionDate(b)).getTime();
    return dateB - dateA;
  });

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center">
        <div className="bg-white vendor-modal-sheet rounded-t-[32px] sm:rounded-[32px] max-h-[90vh] overflow-y-auto mx-auto">
          {/* Header */}
          <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between rounded-t-[32px] z-10">
            <h2 className="font-bold text-gray-800">Prescription History</h2>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowUploadModal(true)}
                className="px-3 py-1.5 bg-blue-500 text-white rounded-lg text-sm flex items-center gap-1 hover:bg-blue-600"
              >
                <Upload className="w-4 h-4" />
                Upload
              </button>
              <button
                onClick={onClose}
                className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 transition-colors"
              >
                <X className="w-5 h-5 text-gray-600" />
              </button>
            </div>
          </div>

          {loading ? (
            <div className="flex flex-col items-center justify-center py-20">
              <div className="w-12 h-12 border-4 border-[#FF8C42] border-t-transparent rounded-full animate-spin mb-4"></div>
              <p className="text-gray-600">Loading prescriptions...</p>
            </div>
          ) : sortedPrescriptions.length === 0 ? (
            <div className="text-center py-20 px-6">
              <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-600 mb-2">No prescriptions found</p>
              <p className="text-sm text-gray-500">Upload a handwritten prescription or create one</p>
            </div>
          ) : (
            <div className="p-6 space-y-4">
              {sortedPrescriptions.map((prescription) => (
                <div
                  key={prescription.id}
                  className="bg-white border border-gray-200 rounded-xl p-4 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between">
                    <div 
                      className="flex-1 cursor-pointer"
                      onClick={() => handleViewPrescription(prescription)}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        {prescription.file_url ? (
                          prescription.file_url.includes('.pdf') ? (
                            <File className="w-5 h-5 text-red-500" />
                          ) : (
                            <Image className="w-5 h-5 text-blue-500" />
                          )
                        ) : (
                          <FileText className="w-5 h-5 text-green-500" />
                        )}
                        <h3 className="font-semibold text-gray-800">{prescription.title}</h3>
                      </div>
                      {prescription.description && (
                        <p className="text-sm text-gray-600 mb-2">{prescription.description}</p>
                      )}
                      <div className="flex items-center gap-4 text-xs text-gray-500">
                        <div className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {formatDate(getPrescriptionDate(prescription))}
                        </div>
                        {prescription.vendor_name && (
                          <span>By {prescription.vendor_name}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {/* ✅ FIX: Add upload button for older records */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedPrescription(prescription);
                          setShowUploadModal(true);
                        }}
                        className="p-2 bg-blue-100 hover:bg-blue-200 rounded-lg transition-colors"
                        title="Upload additional file for this record"
                      >
                        <Upload className="w-4 h-4 text-blue-600" />
                      </button>
                      <button
                        onClick={() => handleViewPrescription(prescription)}
                        className="p-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                        title="View prescription"
                      >
                        <Eye className="w-4 h-4 text-gray-600" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-end sm:items-center justify-center">
          <div className="bg-white vendor-modal-sheet rounded-t-[32px] sm:rounded-[32px] p-6 mx-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-800">
                {selectedPrescription ? 'Upload Additional File' : 'Upload Handwritten Prescription'}
              </h3>
              <button
                onClick={() => {
                  setShowUploadModal(false);
                  setUploadingFile(null);
                  setRecordDate('');
                  setSelectedPrescription(null);
                }}
                className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200"
              >
                <X className="w-5 h-5 text-gray-600" />
              </button>
            </div>
            
            {selectedPrescription && (
              <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm text-blue-900">
                  <strong>Adding file to:</strong> {selectedPrescription.title}
                </p>
                <p className="text-xs text-blue-700 mt-1">
                  Date: {formatDate(getPrescriptionDate(selectedPrescription))}
                </p>
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Prescription Date <span className="text-red-500">*</span>
                  {selectedPrescription && (
                    <span className="text-xs text-gray-500 ml-2">
                      (for this record: {formatDate(getPrescriptionDate(selectedPrescription))})
                    </span>
                  )}
                </label>
                <input
                  type="date"
                  value={recordDate || (selectedPrescription && getPrescriptionDate(selectedPrescription) ? new Date(getPrescriptionDate(selectedPrescription)).toISOString().split('T')[0] : '')}
                  onChange={(e) => setRecordDate(e.target.value)}
                  max={new Date().toISOString().split('T')[0]}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Upload Photo or PDF <span className="text-red-500">*</span>
                </label>
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center cursor-pointer hover:border-blue-500 transition-colors"
                >
                  {uploadingFile ? (
                    <div>
                      <File className="w-12 h-12 text-blue-500 mx-auto mb-2" />
                      <p className="text-sm text-gray-700">{uploadingFile.name}</p>
                      <p className="text-xs text-gray-500 mt-1">
                        {(uploadingFile.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                    </div>
                  ) : (
                    <div>
                      <Upload className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                      <p className="text-sm text-gray-700">Click to select file</p>
                      <p className="text-xs text-gray-500 mt-1">JPG, PNG, GIF, WEBP, or PDF (max 10MB)</p>
                    </div>
                  )}
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,application/pdf"
                  onChange={handleFileSelect}
                  className="hidden"
                />
              </div>

              <Button
                onClick={handleUpload}
                disabled={!uploadingFile || !recordDate || uploading}
                className="w-full bg-blue-500 hover:bg-blue-600 text-white py-3 rounded-xl"
              >
                {uploading ? 'Uploading...' : 'Upload Prescription'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Viewer Modal */}
      {showViewer && selectedPrescription && (
        <div className="fixed inset-0 bg-black/90 z-[70] flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="font-bold text-gray-800">{selectedPrescription.title}</h3>
              <button
                onClick={() => {
                  setShowViewer(false);
                  setSelectedPrescription(null);
                }}
                className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200"
              >
                <X className="w-5 h-5 text-gray-600" />
              </button>
            </div>
            <div className="flex-1 overflow-auto p-4">
              {selectedPrescription.file_url ? (
                selectedPrescription.file_url.includes('.pdf') ? (
                  <iframe
                    src={selectedPrescription.file_url}
                    className="w-full h-full min-h-[500px] rounded-lg"
                    title="Prescription PDF"
                  />
                ) : (
                  <img
                    src={selectedPrescription.file_url}
                    alt="Prescription"
                    className="w-full h-auto rounded-lg"
                  />
                )
              ) : selectedPrescription.content_data ? (
                <div className="space-y-4">
                  {selectedPrescription.content_data.diagnosis && (
                    <div>
                      <h4 className="font-semibold text-gray-800 mb-2">Diagnosis</h4>
                      <p className="text-gray-700">{selectedPrescription.content_data.diagnosis}</p>
                    </div>
                  )}
                  {selectedPrescription.content_data.medications && (
                    <div>
                      <h4 className="font-semibold text-gray-800 mb-2">Medications</h4>
                      <div className="space-y-2">
                        {Array.isArray(selectedPrescription.content_data.medications) &&
                          selectedPrescription.content_data.medications.map((med: any, idx: number) => (
                            <div key={idx} className="bg-gray-50 p-3 rounded-lg">
                              <p className="font-medium">{med.name}</p>
                              <p className="text-sm text-gray-600">
                                {med.dosage} • {med.frequency} • {med.duration}
                              </p>
                            </div>
                          ))}
                      </div>
                    </div>
                  )}
                  {selectedPrescription.content_data.notes && (
                    <div>
                      <h4 className="font-semibold text-gray-800 mb-2">Notes</h4>
                      <p className="text-gray-700">{selectedPrescription.content_data.notes}</p>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-gray-600">No content available</p>
              )}
            </div>
            
            {/* View A4 Document Button */}
            <div className="p-4 border-t flex gap-2">
              <button
                onClick={() => {
                  setShowViewer(false);
                  setShowA4Document(true);
                }}
                className="flex-1 py-2 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg flex items-center justify-center gap-2"
              >
                <Printer className="w-4 h-4" />
                View Full Prescription (A4)
              </button>
              <button
                onClick={() => setShowViewer(false)}
                className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded-lg"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* A4 Prescription Document Modal */}
      {showA4Document && selectedPrescription && (
        <PrescriptionDocument
          prescription={transformPrescriptionData({
            ...selectedPrescription,
            ...(fullPrescriptionData?.prescriptions?.find((p: any) => p.id === selectedPrescription.id) || {}),
            medications: selectedPrescription.content_data?.medications || [],
          })}
          onClose={() => setShowA4Document(false)}
        />
      )}
    </>
  );
}
