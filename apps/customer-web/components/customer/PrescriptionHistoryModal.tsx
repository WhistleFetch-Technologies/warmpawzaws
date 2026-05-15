'use client';

import { useState, useEffect, useRef } from 'react';
import { X, Upload, FileText, Calendar, Image, File, Download, Eye, Share2, ShoppingCart, Radio, Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { apiClient, getApiBaseUrl } from '@/lib/api-client';
import dynamic from 'next/dynamic';
import { transformPrescriptionData } from './PrescriptionDocument';

// Dynamically import PrescriptionDocument for A4 view
const PrescriptionDocument = dynamic(() => import('./PrescriptionDocument'), {
  loading: () => <div className="flex items-center justify-center p-8">Loading document...</div>,
  ssr: false
});

interface PrescriptionHistoryModalProps {
  bookingId: string;
  petId: string;
  customerPhone: string;
  onClose: () => void;
  onUploadSuccess?: () => void;
  onOrderMedicine?: (prescriptionId: string, bookingId: string, medications?: any[]) => void; // ✅ FIX: Add pharmacy ordering callback
}

interface Prescription {
  id: string;
  title?: string;
  description?: string;
  file_url?: string;
  record_date?: string;
  prescription_date?: string;
  content_data?: any;
  created_at: string;
  vendor_name?: string;
  staff_name?: string;
  diagnosis?: string;
  medication_name?: string;
  recordType?: 'uploaded' | 'prescription';
  status?: string;
  instructions?: string;
}

/** Set to true to re-enable the header "Order" control (UX / business toggle). */
const PHARMACY_ORDER_BUTTON_ENABLED = false;

function isUserShareCancel(err: unknown): boolean {
  if (!err) return false;
  if (err instanceof DOMException && err.name === 'AbortError') return true;
  const n = (err as { name?: string })?.name;
  return n === 'AbortError';
}

function buildPrescriptionShareText(p: Prescription): string {
  const title = p.title || 'Prescription';
  const lines: string[] = [title, ''];
  const diagnosis = p.content_data?.diagnosis || p.diagnosis;
  if (diagnosis) {
    lines.push(`Diagnosis: ${diagnosis}`);
  }
  const meds = p.content_data?.medications;
  if (Array.isArray(meds) && meds.length > 0) {
    lines.push('Medications:');
    meds.forEach((m: { name?: string; dosage?: string; frequency?: string; duration?: string; instructions?: string }, i: number) => {
      const row = [
        `${i + 1}. ${m.name || 'Medication'}`,
        m.dosage && `Dosage: ${m.dosage}`,
        m.frequency && `Frequency: ${m.frequency}`,
        m.duration && `Duration: ${m.duration}`,
        m.instructions && `Note: ${m.instructions}`,
      ]
        .filter(Boolean)
        .join(' | ');
      lines.push(row);
    });
  } else if (p.medication_name) {
    lines.push(`Medication: ${p.medication_name}`);
  }
  const notes = p.content_data?.notes || p.instructions;
  if (notes) lines.push(`Notes: ${notes}`);
  return lines.join('\n');
}

async function copyTextToClipboard(text: string): Promise<boolean> {
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* continue */
  }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.left = '-9999px';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

export function PrescriptionHistoryModal({
  bookingId,
  petId,
  customerPhone,
  onClose,
  onUploadSuccess,
  onOrderMedicine, // ✅ FIX: Add pharmacy ordering callback
}: PrescriptionHistoryModalProps) {
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [fullPrescriptionData, setFullPrescriptionData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [selectedPrescription, setSelectedPrescription] = useState<Prescription | null>(null);
  const [showViewer, setShowViewer] = useState(false);
  const [showA4Document, setShowA4Document] = useState(false);
  const [loadingPrescriptionView, setLoadingPrescriptionView] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [recordDate, setRecordDate] = useState('');
  const [uploadingFile, setUploadingFile] = useState<File | null>(null);
  const [context, setContext] = useState('');

  useEffect(() => {
    loadPrescriptions();
  }, [bookingId]);

  // ✅ FIX: Safe version that uses fetch to avoid automatic redirect on 401
  const loadPrescriptionsSafe = async () => {
    const allPrescriptions: any[] = [];
    const baseUrl = getBaseUrl();
    const token = localStorage.getItem('authToken') || localStorage.getItem('cognitoIdToken');
    
    // 1. Fetch uploaded medical records (handwritten prescriptions)
    try {
      const medicalResponse = await fetch(`${baseUrl}/medical-records/booking/${bookingId}/prescriptions`, {
        method: 'GET',
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          'Content-Type': 'application/json',
        },
      });
      
      if (medicalResponse.ok) {
        const medicalResult = await medicalResponse.json();
        const medicalRecords = medicalResult.prescriptions || [];
        medicalRecords.forEach((record: any) => {
          record.recordType = 'uploaded';
        });
        allPrescriptions.push(...medicalRecords);
      } else if (medicalResponse.status === 401) {
        console.warn('Unauthorized access to medical records - session may have expired');
        // Don't throw, just skip this data
      }
    } catch (error) {
      console.warn('Failed to load medical records:', error);
    }
    
    // 2. Fetch published prescriptions from vendors (with full details for A4 document)
    try {
      const prescriptionResponse = await fetch(`${baseUrl}/prescriptions/booking/${bookingId}?includeDetails=true`, {
        method: 'GET',
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          'Content-Type': 'application/json',
        },
      });
      
      if (prescriptionResponse.ok) {
        const prescriptionResult = await prescriptionResponse.json();
        const prescriptions = prescriptionResult.prescriptions || [];
        prescriptions.forEach((prescription: any) => {
          prescription.recordType = 'prescription';
          // Only include published prescriptions for customers
          if (prescription.status === 'published' || !prescription.status) {
            allPrescriptions.push(prescription);
          }
        });
        
        // Store full data for A4 document view
        if (prescriptions.length > 0) {
          setFullPrescriptionData(prescriptionResult);
        }
      } else if (prescriptionResponse.status === 401) {
        console.warn('Unauthorized access to prescriptions - session may have expired');
        // Don't throw, just skip this data
      }
    } catch (error) {
      console.warn('Failed to load prescriptions:', error);
    }
    
    setPrescriptions(allPrescriptions);
  };

  const loadPrescriptions = async () => {
    try {
      setLoading(true);
      await loadPrescriptionsSafe();
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

  const getBaseUrl = (): string => getApiBaseUrl() || '';

  const handleUpload = async () => {
    if (!uploadingFile || !recordDate) {
      toast.error('Please select a file and enter the prescription date');
      return;
    }

    // ✅ FIX: Ensure customerPhone is available
    const effectiveCustomerPhone = customerPhone || (typeof window !== 'undefined' ? localStorage.getItem('phone') || localStorage.getItem('customerPhone') || '' : '');
    if (!effectiveCustomerPhone) {
      toast.error('Customer phone is missing. Please refresh the page.');
      return;
    }

    try {
      setUploading(true);
      const formData = new FormData();
      formData.append('file', uploadingFile);
      formData.append('recordDate', recordDate);
      formData.append('uploadedBy', 'customer');
      formData.append('userId', effectiveCustomerPhone);
      if (context) {
        formData.append('context', context);
      }

      const baseUrl = getBaseUrl();
      const token = localStorage.getItem('authToken') || localStorage.getItem('cognitoIdToken');
      
      const response = await fetch(`${baseUrl}/medical-records/booking/${bookingId}/upload-prescription`, {
        method: 'POST',
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: formData,
      });

      // ✅ FIX: Handle 401 errors gracefully without redirecting
      if (response.status === 401) {
        const errorData = await response.json().catch(() => ({ error: 'Unauthorized' }));
        toast.error('Your session has expired. Please refresh the page and try again.');
        setUploading(false);
        return; // Don't redirect, let user stay on the page
      }

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Upload failed' }));
        throw new Error(error.error || 'Upload failed');
      }

      toast.success('Prescription uploaded successfully');
      setShowUploadModal(false);
      setUploadingFile(null);
      setRecordDate('');
      setContext('');
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      
      // ✅ FIX: Load prescriptions using fetch to avoid automatic redirect on 401
      // Only reload if upload was successful
      try {
        await loadPrescriptionsSafe();
      } catch (reloadError) {
        console.warn('Failed to reload prescriptions after upload:', reloadError);
        // Don't show error to user, upload was successful
      }
      
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
      setShowViewer(true);
      setLoadingPrescriptionView(true);
      
      // ✅ FIX: Always fetch from view endpoint to get fresh signed URL for S3 files
      // This ensures images/files are properly accessible
      try {
        const result = await apiClient.get(`/medical-records/booking/${bookingId}/view/${prescription.id}`) as any;
        
        // ✅ FIX: Handle both camelCase (contentData) and snake_case (content_data) responses
        // The API returns contentData (camelCase) but we store as content_data (snake_case)
        let contentData = result.contentData || result.content_data || prescription.content_data;
        
        // ✅ FIX: If contentData has medications array, ensure it's properly formatted
        if (contentData && typeof contentData === 'string') {
          try {
            contentData = JSON.parse(contentData);
          } catch (e) {
            // Keep as string if not valid JSON
          }
        }
        
        // ✅ FIX: Also check record object for nested content_data
        if (result.record) {
          const recordContentData = result.record.content_data || result.record.contentData;
          if (recordContentData && !contentData) {
            contentData = typeof recordContentData === 'string' 
              ? JSON.parse(recordContentData) 
              : recordContentData;
          }
        }
        
        // Build updated prescription with all available data
        const updatedPrescription: Prescription = {
          ...prescription,
          file_url: result.fileUrl || result.record?.file_url || prescription.file_url,
          content_data: contentData,
          // ✅ FIX: Also map medication fields from prescriptions table
          diagnosis: contentData?.diagnosis || result.record?.diagnosis || prescription.diagnosis,
          medication_name: contentData?.medications?.[0]?.name || result.record?.medication_name || prescription.medication_name,
          instructions: contentData?.notes || result.record?.instructions || prescription.instructions,
        };
        
        setSelectedPrescription(updatedPrescription);
        console.log('✅ Loaded prescription:', updatedPrescription);
      } catch (fetchError) {
        console.warn('Could not fetch prescription details, using cached data:', fetchError);
        // Continue with existing prescription data
      } finally {
        setLoadingPrescriptionView(false);
      }
    } catch (error) {
      console.error('Error viewing prescription:', error);
      toast.error('Failed to load prescription');
      setShowViewer(false);
      setLoadingPrescriptionView(false);
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

  const shareSelectedPrescription = async (p: Prescription) => {
    const shareTitle = p.title || 'Prescription';
    const bodyText = buildPrescriptionShareText(p);
    const fileUrl = p.file_url?.trim();

    const runShare = async (data: ShareData): Promise<'ok' | 'cancel' | 'unavailable'> => {
      if (typeof navigator === 'undefined' || !navigator.share) return 'unavailable';
      try {
        await navigator.share(data);
        return 'ok';
      } catch (err) {
        if (isUserShareCancel(err)) return 'cancel';
        return 'unavailable';
      }
    };

    if (fileUrl) {
      const blurb = p.description || 'Medical prescription from Warmpawz';
      const r1 = await runShare({ title: shareTitle, text: blurb, url: fileUrl });
      if (r1 === 'ok') {
        toast.success('Shared');
        return;
      }
      if (r1 === 'cancel') return;
      const textWithUrl = `${bodyText}\n\n${fileUrl}`;
      const r2 = await runShare({ title: shareTitle, text: textWithUrl });
      if (r2 === 'ok') {
        toast.success('Shared');
        return;
      }
      if (r2 === 'cancel') return;
      if (await copyTextToClipboard(textWithUrl)) {
        toast.success('Link and details copied — paste into any app to share');
        return;
      }
      toast.error('Could not open share. Try again or use the full document view.');
      return;
    }

    if (bodyText.replace(/\s/g, '').length < 2) {
      toast.error('Nothing to share for this prescription');
      return;
    }

    const r3 = await runShare({ title: shareTitle, text: bodyText });
    if (r3 === 'ok') {
      toast.success('Shared');
      return;
    }
    if (r3 === 'cancel') return;
    if (await copyTextToClipboard(bodyText)) {
      toast.success('Prescription text copied — paste into WhatsApp or another app');
      return;
    }
    toast.error('Could not share. Try copying from the screen or use another device.');
  };

  /** Kept for when PHARMACY_ORDER_BUTTON_ENABLED is true; do not remove. */
  const openPharmacyOrderFromViewer = async () => {
    if (!selectedPrescription) return;
    try {
      let medications: any[] = [];
      if (selectedPrescription.content_data?.medications) {
        medications = Array.isArray(selectedPrescription.content_data.medications)
          ? selectedPrescription.content_data.medications
          : [];
      }
      if (onOrderMedicine) {
        onOrderMedicine(selectedPrescription.id, bookingId, medications);
        setShowViewer(false);
        onClose();
        toast.success('Opening pharmacy order...');
      } else {
        window.dispatchEvent(
          new CustomEvent('orderMedicineFromPrescription', {
            detail: {
              prescriptionId: selectedPrescription.id,
              bookingId,
              medications,
              fileUrl: selectedPrescription.file_url,
            },
          })
        );
        setShowViewer(false);
        onClose();
        toast.success('Opening pharmacy order...');
      }
    } catch (error: unknown) {
      console.error('Error ordering medicine:', error);
      toast.error('Failed to open pharmacy order. Please try again.');
    }
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
        <div className="bg-white w-full max-w-customer rounded-t-[32px] sm:rounded-[32px] max-h-[90vh] overflow-y-auto">
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
              <p className="text-sm text-gray-500">Upload a handwritten prescription or wait for doctor to create one</p>
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
                        <h3 className="font-semibold text-gray-800">
                          {prescription.diagnosis || prescription.title || prescription.medication_name || 'Prescription'}
                        </h3>
                        {prescription.recordType === 'prescription' && (
                          <span className="px-2 py-0.5 bg-purple-100 text-purple-700 text-xs font-medium rounded-full">
                            Prescription
                          </span>
                        )}
                      </div>
                      {prescription.description && (
                        <p className="text-sm text-gray-600 mb-2">{prescription.description}</p>
                      )}
                      <div className="flex items-center gap-4 text-xs text-gray-500">
                        <div className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {formatDate(getPrescriptionDate(prescription))}
                        </div>
                        {(prescription.staff_name || prescription.vendor_name) && (
                          <span>By {prescription.staff_name || prescription.vendor_name}</span>
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

      {/* Upload Modal — scrollable sheet above bottom nav + home indicator (see CustomerScreenWrapper / search pb patterns) */}
      {showUploadModal && (
        <div
          className="fixed inset-0 z-[65] flex items-end justify-center sm:items-center isolate pointer-events-none"
          role="dialog"
          aria-modal="true"
          aria-labelledby="upload-prescription-title"
        >
          <div className="absolute inset-0 bg-black/50 pointer-events-auto" aria-hidden />
          <div
            className="pointer-events-auto relative z-10 flex w-full max-w-customer min-h-0 flex-col overflow-hidden rounded-t-[32px] bg-white shadow-2xl sm:rounded-[32px] max-h-[min(92dvh,calc(100dvh-env(safe-area-inset-bottom,0px)-0.75rem))] sm:max-h-[min(90vh,92dvh)]"
          >
            <div className="flex shrink-0 items-center justify-between border-b border-gray-100 px-6 pb-4 pt-6 rounded-t-[32px] bg-white">
              <h3 id="upload-prescription-title" className="font-bold text-gray-800 pr-2">
                {selectedPrescription ? 'Upload Additional File' : 'Upload Handwritten Prescription'}
              </h3>
              <button
                type="button"
                onClick={() => {
                  setShowUploadModal(false);
                  setUploadingFile(null);
                  setRecordDate('');
                  setContext('');
                  setSelectedPrescription(null);
                }}
                className="shrink-0 w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200"
              >
                <X className="w-5 h-5 text-gray-600" />
              </button>
            </div>

            <div
              className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-6 pt-4 [-webkit-overflow-scrolling:touch] scroll-pb-[calc(6rem+env(safe-area-inset-bottom,0px))] pb-[calc(1rem+5.5rem+env(safe-area-inset-bottom,0px))]"
            >
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
                    Context/Notes (Optional)
                  </label>
                  <textarea
                    value={context}
                    onChange={(e) => setContext(e.target.value)}
                    placeholder="Add any notes or context about this prescription..."
                    rows={3}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none resize-none"
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
                  type="button"
                  onClick={handleUpload}
                  disabled={!uploadingFile || !recordDate || uploading}
                  className="w-full bg-blue-500 hover:bg-blue-600 text-white py-3 rounded-xl scroll-mt-4"
                >
                  {uploading ? 'Uploading...' : 'Upload Prescription'}
                </Button>
              </div>
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
              <div className="flex items-center gap-2">
                {/* View A4 Document Button - Only for published prescriptions with full data */}
                {selectedPrescription.recordType === 'prescription' && (
                  <button
                    onClick={() => {
                      setShowViewer(false);
                      setShowA4Document(true);
                    }}
                    className="p-2 bg-indigo-100 hover:bg-indigo-200 text-indigo-700 rounded-lg transition-colors"
                    title="View Full Prescription (A4)"
                  >
                    <Printer className="w-4 h-4" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => shareSelectedPrescription(selectedPrescription)}
                  className="p-2 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded-lg transition-colors"
                  title="Share"
                >
                  <Share2 className="w-4 h-4" />
                </button>
                {/* ✅ FIX: Broadcast Prescription Button - Share with pharmacies */}
                {selectedPrescription.file_url && (
                  <button
                    onClick={async () => {
                      try {
                        // Broadcast prescription to pharmacies for ordering
                        if (onOrderMedicine) {
                          onOrderMedicine(selectedPrescription.id, bookingId, []);
                          toast.success('Broadcasting prescription to pharmacies...');
                        } else {
                          window.dispatchEvent(new CustomEvent('broadcastPrescription', {
                            detail: {
                              prescriptionId: selectedPrescription.id,
                              bookingId,
                              fileUrl: selectedPrescription.file_url,
                            }
                          }));
                          toast.success('Broadcasting prescription to pharmacies...');
                        }
                      } catch (error: any) {
                        console.error('Error broadcasting prescription:', error);
                        toast.error('Failed to broadcast prescription. Please try again.');
                      }
                    }}
                    className="p-2 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded-lg transition-colors flex items-center gap-1.5"
                    title="Broadcast Prescription to Pharmacies"
                  >
                    <Radio className="w-4 h-4" />
                    <span className="text-xs font-medium">Broadcast</span>
                  </button>
                )}
                
                {/* Pharmacy order: implementation in openPharmacyOrderFromViewer; toggle PHARMACY_ORDER_BUTTON_ENABLED to re-enable */}
                {(selectedPrescription.content_data || selectedPrescription.file_url) && (
                  <button
                    type="button"
                    disabled={!PHARMACY_ORDER_BUTTON_ENABLED}
                    onClick={() => {
                      if (PHARMACY_ORDER_BUTTON_ENABLED) void openPharmacyOrderFromViewer();
                    }}
                    className="p-2 bg-green-100 hover:bg-green-200 text-green-700 rounded-lg transition-colors flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-green-100"
                    title={
                      PHARMACY_ORDER_BUTTON_ENABLED
                        ? 'Order Medicine from Pharmacy'
                        : 'Pharmacy order coming soon'
                    }
                  >
                    <ShoppingCart className="w-4 h-4" />
                    <span className="text-xs font-medium">Order</span>
                  </button>
                )}
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
            </div>
            <div className="flex-1 overflow-auto p-4">
              {loadingPrescriptionView ? (
                <div className="flex flex-col items-center justify-center py-20">
                  <div className="w-12 h-12 border-4 border-[#FF8C42] border-t-transparent rounded-full animate-spin mb-4"></div>
                  <p className="text-gray-600">Loading prescription...</p>
                </div>
              ) : selectedPrescription.file_url ? (
                selectedPrescription.file_url.includes('.pdf') || selectedPrescription.file_url.toLowerCase().endsWith('.pdf') ? (
                  <iframe
                    src={selectedPrescription.file_url}
                    className="w-full h-full min-h-[500px] rounded-lg border border-gray-200"
                    title="Prescription PDF"
                    onError={(e) => {
                      console.error('Error loading PDF:', e);
                      toast.error('Failed to load PDF. Please try again.');
                    }}
                  />
                ) : (
                  <div className="flex items-center justify-center">
                    {selectedPrescription.file_url ? (
                      <img
                        key={selectedPrescription.file_url} // ✅ FIX: Force re-render when URL changes
                        src={selectedPrescription.file_url}
                        alt="Prescription"
                        className="max-w-full h-auto rounded-lg shadow-lg"
                        onError={async (e) => {
                          console.error('Error loading image:', e);
                          const target = e.target as HTMLImageElement;
                          
                          // ✅ FIX: Try to refresh the signed URL once more
                          try {
                            const result = await apiClient.get(`/medical-records/booking/${bookingId}/view/${selectedPrescription.id}`) as any;
                            if (result.fileUrl && result.fileUrl !== selectedPrescription.file_url) {
                              // Update with fresh URL and retry
                              setSelectedPrescription({ ...selectedPrescription, file_url: result.fileUrl });
                              return; // Let the image retry with new URL
                            }
                          } catch (refreshError) {
                            console.error('Failed to refresh signed URL:', refreshError);
                          }
                          
                          // If refresh failed, show error message
                          target.style.display = 'none';
                          const errorDiv = document.createElement('div');
                          errorDiv.className = 'text-center p-8 text-gray-600';
                          errorDiv.innerHTML = `
                            <p class="mb-2">Failed to load image</p>
                            <p class="text-sm text-gray-500">The image may have expired or been deleted</p>
                          `;
                          target.parentElement?.appendChild(errorDiv);
                          toast.error('Failed to load image. Please try again.');
                        }}
                        onLoad={() => {
                          console.log('✅ Image loaded successfully');
                        }}
                      />
                    ) : (
                      <div className="text-center p-8 text-gray-600">
                        <p className="mb-2">No image available</p>
                        <p className="text-sm text-gray-500">File URL is missing</p>
                      </div>
                    )}
                  </div>
                )
              ) : selectedPrescription.content_data || selectedPrescription.diagnosis || selectedPrescription.medication_name ? (
                <div className="space-y-4">
                  {/* Diagnosis section */}
                  {(selectedPrescription.content_data?.diagnosis || selectedPrescription.diagnosis) && (
                    <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
                      <h4 className="font-semibold text-blue-900 mb-2 flex items-center gap-2">
                        <FileText className="w-4 h-4" />
                        Diagnosis
                      </h4>
                      <p className="text-blue-800">{selectedPrescription.content_data?.diagnosis || selectedPrescription.diagnosis}</p>
                    </div>
                  )}
                  
                  {/* Medications section - handle both array format and single medication */}
                  {(selectedPrescription.content_data?.medications || selectedPrescription.medication_name) && (
                    <div>
                      <h4 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                        <FileText className="w-4 h-4 text-green-600" />
                        Medications
                      </h4>
                      <div className="space-y-3">
                        {Array.isArray(selectedPrescription.content_data?.medications) ? (
                          selectedPrescription.content_data.medications.map((med: any, idx: number) => (
                            <div key={idx} className="bg-white border border-gray-200 p-4 rounded-xl shadow-sm">
                              <p className="font-semibold text-gray-900 text-lg">{med.name}</p>
                              <div className="grid grid-cols-3 gap-3 mt-3 text-sm">
                                <div className="bg-gray-50 p-2 rounded-lg">
                                  <p className="text-gray-500 text-xs">Dosage</p>
                                  <p className="font-medium text-gray-800">{med.dosage || '-'}</p>
                                </div>
                                <div className="bg-gray-50 p-2 rounded-lg">
                                  <p className="text-gray-500 text-xs">Frequency</p>
                                  <p className="font-medium text-gray-800">{med.frequency || '-'}</p>
                                </div>
                                <div className="bg-gray-50 p-2 rounded-lg">
                                  <p className="text-gray-500 text-xs">Duration</p>
                                  <p className="font-medium text-gray-800">{med.duration || '-'}</p>
                                </div>
                              </div>
                              {med.instructions && (
                                <div className="mt-3 pt-3 border-t border-gray-100">
                                  <p className="text-xs text-gray-500 mb-1">Instructions</p>
                                  <p className="text-sm text-gray-700">{med.instructions}</p>
                                </div>
                              )}
                            </div>
                          ))
                        ) : selectedPrescription.medication_name ? (
                          <div className="bg-white border border-gray-200 p-4 rounded-xl shadow-sm">
                            <p className="font-semibold text-gray-900 text-lg">{selectedPrescription.medication_name}</p>
                            {selectedPrescription.instructions && (
                              <p className="text-sm text-gray-600 mt-2">{selectedPrescription.instructions}</p>
                            )}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  )}
                  
                  {/* Notes/Instructions section */}
                  {(selectedPrescription.content_data?.notes || selectedPrescription.instructions) && (
                    <div className="bg-yellow-50 p-4 rounded-xl border border-yellow-100">
                      <h4 className="font-semibold text-yellow-900 mb-2">Special Instructions</h4>
                      <p className="text-yellow-800">{selectedPrescription.content_data?.notes || selectedPrescription.instructions}</p>
                    </div>
                  )}
                  
                  {/* Follow-up date if available */}
                  {selectedPrescription.content_data?.followUpDate && (
                    <div className="bg-purple-50 p-4 rounded-xl border border-purple-100">
                      <h4 className="font-semibold text-purple-900 mb-2 flex items-center gap-2">
                        <Calendar className="w-4 h-4" />
                        Follow-up Date
                      </h4>
                      <p className="text-purple-800">{formatDate(selectedPrescription.content_data.followUpDate)}</p>
                    </div>
                  )}
                  
                  {/* Doctor name if available */}
                  {selectedPrescription.content_data?.doctorName && (
                    <div className="mt-4 pt-4 border-t border-gray-200 text-sm text-gray-600">
                      <p>Prescribed by: <span className="font-medium text-gray-800">{selectedPrescription.content_data.doctorName}</span></p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-8">
                  <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-600">No content available</p>
                  <p className="text-sm text-gray-500 mt-1">The prescription details could not be loaded</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* A4 Prescription Document Modal */}
      {showA4Document && selectedPrescription && selectedPrescription.recordType === 'prescription' && (
        <PrescriptionDocument
          prescription={transformPrescriptionData({
            ...selectedPrescription,
            ...fullPrescriptionData,
            // Combine medications if available
            medications: selectedPrescription.content_data?.medications || 
              (selectedPrescription.medication_name ? [{
                name: selectedPrescription.medication_name,
                dosage: (selectedPrescription as any).dosage,
                frequency: (selectedPrescription as any).frequency,
                duration: (selectedPrescription as any).duration,
                instructions: selectedPrescription.instructions
              }] : [])
          })}
          onClose={() => setShowA4Document(false)}
          onOrderMedicine={() => {
            if (onOrderMedicine) {
              const medications = selectedPrescription.content_data?.medications || [];
              onOrderMedicine(selectedPrescription.id, bookingId, medications);
              setShowA4Document(false);
              onClose();
            }
          }}
        />
      )}
    </>
  );
}
