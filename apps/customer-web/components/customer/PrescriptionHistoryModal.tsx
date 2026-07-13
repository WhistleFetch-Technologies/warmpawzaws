'use client';

import { useState, useEffect, useRef } from 'react';
import { X, Upload, FileText, Calendar, Image, File, Download, Share2, ArrowLeft, ChevronRight } from 'lucide-react';
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
  /** Raw booking status — controls upload vs view-only UX */
  bookingStatus?: string;
  /** When false, customer can view/share but not upload new documents */
  allowCustomerUpload?: boolean;
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

/** Vendor-issued Rx (doctor); customer uploads use recordType === 'uploaded'. */
function isVendorPrescription(p: Prescription): boolean {
  return p.recordType === 'prescription';
}

function isCustomerUpload(p: Prescription): boolean {
  return p.recordType === 'uploaded';
}

/** Map API row to list item recordType (vendor Rx vs customer upload). */
function mapRecordType(row: Record<string, unknown>): 'prescription' | 'uploaded' {
  const source = String(row.source || '');
  const apiRecordType = String(row.record_type || row.recordType || '');
  if (source === 'medical_records' || apiRecordType === 'uploaded') return 'uploaded';
  if (source === 'prescriptions' || apiRecordType === 'prescription') return 'prescription';
  if (row.file_url && !row.medications && !row.content_data) return 'uploaded';
  return 'prescription';
}

function normalizePrescriptionRow(row: Record<string, unknown>): Prescription {
  return {
    id: String(row.id ?? ''),
    created_at: String(row.created_at ?? row.createdAt ?? new Date().toISOString()),
    ...row,
    recordType: mapRecordType(row),
  } as Prescription;
}

function countMedications(p: Prescription): number {
  const meds = p.content_data?.medications;
  if (Array.isArray(meds) && meds.length > 0) return meds.length;
  if (p.medication_name?.trim()) return 1;
  return 0;
}

function hasStructuredPrescriptionData(p: Prescription): boolean {
  return (
    countMedications(p) > 0 ||
    Boolean(formatDiagnosisForDisplay(p.diagnosis || p.content_data?.diagnosis))
  );
}

function formatDiagnosisForDisplay(diagnosis?: string): string | null {
  const text = diagnosis?.trim();
  if (!text || /^no$/i.test(text)) return null;
  return text;
}

function getPrescriptionListTitle(p: Prescription, formatDate: (d: string) => string): string {
  const date = formatDate(p.prescription_date || p.record_date || p.created_at);
  if (isCustomerUpload(p)) {
    const custom = p.title?.trim();
    if (custom && custom.length > 2 && !/^no$/i.test(custom)) {
      return custom;
    }
    return `Uploaded document · ${date}`;
  }
  return `Prescription · ${date}`;
}

function getPrescriptionListSubtitle(p: Prescription): string {
  const parts: string[] = [];
  const vendor = p.staff_name || p.vendor_name;
  if (vendor) parts.push(vendor);
  const medCount = countMedications(p);
  if (medCount > 0) {
    parts.push(`${medCount} medicine${medCount > 1 ? 's' : ''}`);
  } else if (p.file_url?.toLowerCase().includes('.pdf')) {
    parts.push('PDF file');
  } else if (p.file_url) {
    parts.push('Image file');
  }
  const diagnosis = formatDiagnosisForDisplay(p.diagnosis || p.content_data?.diagnosis);
  if (diagnosis) {
    parts.push(diagnosis.length > 36 ? `${diagnosis.slice(0, 36)}…` : diagnosis);
  }
  return parts.join(' · ') || 'Tap to open';
}

export function PrescriptionHistoryModal({
  bookingId,
  petId,
  customerPhone,
  bookingStatus,
  allowCustomerUpload = true,
  onClose,
  onUploadSuccess,
  onOrderMedicine, // ✅ FIX: Add pharmacy ordering callback
}: PrescriptionHistoryModalProps) {
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [a4PrescriptionDetails, setA4PrescriptionDetails] = useState<any>(null);
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
    const allPrescriptions: Prescription[] = [];
    const seenIds = new Set<string>();
    const baseUrl = getBaseUrl();
    const token = localStorage.getItem('authToken') || localStorage.getItem('cognitoIdToken');
    const authHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };

    const pushUnique = (rows: Record<string, any>[]) => {
      for (const row of rows) {
        if (!row?.id || seenIds.has(row.id)) continue;
        seenIds.add(row.id);
        allPrescriptions.push(normalizePrescriptionRow(row));
      }
    };
    
    // 1. Combined prescriptions + customer uploads for this booking
    try {
      const medicalResponse = await fetch(`${baseUrl}/medical-records/booking/${bookingId}/prescriptions`, {
        method: 'GET',
        headers: authHeaders,
      });
      
      if (medicalResponse.ok) {
        const medicalResult = await medicalResponse.json();
        pushUnique(medicalResult.prescriptions || []);
      } else if (medicalResponse.status === 401) {
        console.warn('Unauthorized access to medical records - session may have expired');
      }
    } catch (error) {
      console.warn('Failed to load medical records:', error);
    }

    // 2. Fallback: raw medical_records for this booking (customer uploads)
    try {
      const recordsResponse = await fetch(`${baseUrl}/bookings/${bookingId}/medical-records`, {
        method: 'GET',
        headers: authHeaders,
      });
      if (recordsResponse.ok) {
        const recordsResult = await recordsResponse.json();
        const uploads = (recordsResult.medicalRecords || recordsResult.records || []).filter(
          (r: Record<string, any>) =>
            r.record_type === 'prescription' ||
            (r.record_type === 'treatment' && String(r.title || '').toLowerCase().includes('prescription'))
        );
        pushUnique(
          uploads.map((r: Record<string, any>) => ({
            ...r,
            source: 'medical_records',
            record_type: 'uploaded',
          }))
        );
      }
    } catch (error) {
      console.warn('Failed to load booking medical records fallback:', error);
    }
    
    // 3. Published vendor prescriptions (full details for A4 document)
    try {
      const prescriptionResponse = await fetch(`${baseUrl}/prescriptions/booking/${bookingId}?includeDetails=true`, {
        method: 'GET',
        headers: authHeaders,
      });
      
      if (prescriptionResponse.ok) {
        const prescriptionResult = await prescriptionResponse.json();
        const prescriptions = (prescriptionResult.prescriptions || []).filter(
          (p: Record<string, any>) => p.status === 'published' || !p.status
        );
        pushUnique(
          prescriptions.map((p: Record<string, any>) => ({
            ...p,
            source: 'prescriptions',
            record_type: 'prescription',
          }))
        );
      } else if (prescriptionResponse.status === 401) {
        console.warn('Unauthorized access to prescriptions - session may have expired');
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

  const openA4Document = async (prescription: Prescription) => {
    setSelectedPrescription(prescription);
    setA4PrescriptionDetails(null);
    setLoadingPrescriptionView(true);
    try {
      const baseUrl = getBaseUrl();
      const token = localStorage.getItem('authToken') || localStorage.getItem('cognitoIdToken');
      const response = await fetch(
        `${baseUrl}/prescriptions/${prescription.id}?includeDetails=true`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        }
      );

      if (response.ok) {
        const result = await response.json();
        setA4PrescriptionDetails(result.prescription || result);
      } else {
        const fallbackResponse = await fetch(
          `${baseUrl}/prescriptions/booking/${bookingId}?includeDetails=true`,
          {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
          }
        );
        if (fallbackResponse.ok) {
          const fallbackResult = await fallbackResponse.json();
          const match = (fallbackResult.prescriptions || []).find(
            (row: Record<string, any>) => row.id === prescription.id
          );
          setA4PrescriptionDetails(match || prescription);
        } else {
          setA4PrescriptionDetails(prescription);
        }
      }
    } catch (error) {
      console.warn('Failed to load full prescription for A4 view:', error);
      setA4PrescriptionDetails(prescription);
    } finally {
      setLoadingPrescriptionView(false);
      setShowA4Document(true);
    }
  };

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

      const uploadResult = await response.json().catch(() => ({}));
      const uploadedRecord = uploadResult.record;
      if (uploadedRecord?.id) {
        setPrescriptions((prev) => {
          const next = normalizePrescriptionRow({
            ...uploadedRecord,
            source: 'medical_records',
            file_url: uploadResult.fileUrl || uploadedRecord.file_url,
          });
          if (prev.some((p) => p.id === next.id)) return prev;
          return [next, ...prev];
        });
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
    setSelectedPrescription(prescription);

    const openStructuredDocument =
      isVendorPrescription(prescription) &&
      (hasStructuredPrescriptionData(prescription) || !prescription.file_url);

    if (openStructuredDocument) {
      await openA4Document(prescription);
      return;
    }

    setShowViewer(true);
    setLoadingPrescriptionView(true);

    try {
      const result = await apiClient.get(`/medical-records/booking/${bookingId}/view/${prescription.id}`) as any;

      let contentData = result.contentData || result.content_data || prescription.content_data;

      if (contentData && typeof contentData === 'string') {
        try {
          contentData = JSON.parse(contentData);
        } catch {
          /* keep string */
        }
      }

      if (result.record) {
        const recordContentData = result.record.content_data || result.record.contentData;
        if (recordContentData && !contentData) {
          contentData =
            typeof recordContentData === 'string' ? JSON.parse(recordContentData) : recordContentData;
        }
      }

      setSelectedPrescription({
        ...prescription,
        file_url: result.fileUrl || result.record?.file_url || prescription.file_url,
        content_data: contentData,
        diagnosis: contentData?.diagnosis || result.record?.diagnosis || prescription.diagnosis,
        medication_name:
          contentData?.medications?.[0]?.name || result.record?.medication_name || prescription.medication_name,
        instructions: contentData?.notes || result.record?.instructions || prescription.instructions,
      });
    } catch (fetchError) {
      console.warn('Could not fetch prescription details, using cached data:', fetchError);
    } finally {
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

  // Sort prescriptions by date (latest first)
  const sortedPrescriptions = [...prescriptions].sort((a, b) => {
    const dateA = new Date(getPrescriptionDate(a)).getTime();
    const dateB = new Date(getPrescriptionDate(b)).getTime();
    return dateB - dateA;
  });

  const statusNorm = String(bookingStatus || '')
    .trim()
    .toLowerCase()
    .replace(/\s/g, '_')
    .replace(/-/g, '_');
  const isCancelledBooking = statusNorm === 'cancelled' || statusNorm === 'no_show';
  const readOnlyHint = isCancelledBooking
    ? 'This booking was cancelled. You can view documents that were already saved.'
    : !allowCustomerUpload
      ? 'View only for now. Your provider will add prescriptions after the visit; you can upload your own files once the booking is completed.'
      : null;

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center">
        <div className="bg-white w-full max-w-customer rounded-t-[32px] sm:rounded-[32px] max-h-[min(92dvh,90vh)] flex flex-col overflow-hidden">
          {/* Header */}
          <div className="sticky top-0 bg-white border-b border-gray-200 px-4 py-3 sm:px-6 sm:py-4 flex items-center gap-3 rounded-t-[32px] z-10 shrink-0 cw-header-safe-top cw-header-safe-x">
            <button
              type="button"
              onClick={onClose}
              className="w-9 h-9 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 transition-colors shrink-0"
              aria-label="Close"
            >
              <X className="w-5 h-5 text-gray-600" />
            </button>
            <div className="flex-1 min-w-0">
              <h2 className="font-bold text-gray-800 truncate">Prescriptions</h2>
              <p className="text-xs text-gray-500">
                {loading
                  ? 'Loading…'
                  : `${sortedPrescriptions.length} document${sortedPrescriptions.length === 1 ? '' : 's'}`}
              </p>
            </div>
            {allowCustomerUpload ? (
              <button
                type="button"
                onClick={() => setShowUploadModal(true)}
                className="px-3 py-1.5 bg-blue-500 text-white rounded-lg text-sm flex items-center gap-1 hover:bg-blue-600 shrink-0"
              >
                <Upload className="w-4 h-4" />
                <span className="sr-only sm:not-sr-only sm:inline">Upload</span>
              </button>
            ) : null}
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]">
          {readOnlyHint ? (
            <div className="mx-6 mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              {readOnlyHint}
            </div>
          ) : null}

          {loading ? (
            <div className="flex flex-col items-center justify-center py-20">
              <div className="w-12 h-12 border-4 border-[#FF8C42] border-t-transparent rounded-full animate-spin mb-4"></div>
              <p className="text-gray-600">Loading prescriptions...</p>
            </div>
          ) : sortedPrescriptions.length === 0 ? (
            <div className="text-center py-20 px-6">
              <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-600 mb-2">No prescriptions or documents yet</p>
              <p className="text-sm text-gray-500">
                {allowCustomerUpload
                  ? 'Upload a photo or PDF, or wait for your vet to publish a prescription'
                  : 'Documents will appear here after your provider publishes them.'}
              </p>
            </div>
          ) : (
            <div className="p-4 sm:p-6 space-y-3">
              {sortedPrescriptions.map((prescription) => (
                <button
                  key={prescription.id}
                  type="button"
                  onClick={() => void handleViewPrescription(prescription)}
                  className="w-full text-left bg-white border border-gray-200 rounded-xl p-4 hover:border-orange-200 hover:shadow-sm transition-all active:scale-[0.99]"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="shrink-0 w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center">
                      {prescription.file_url ? (
                        prescription.file_url.includes('.pdf') ? (
                          <File className="w-5 h-5 text-red-500" />
                        ) : (
                          <Image className="w-5 h-5 text-blue-500" />
                        )
                      ) : (
                        <FileText className="w-5 h-5 text-green-600" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5 min-w-0">
                        <p className="font-semibold text-gray-900 truncate">
                          {getPrescriptionListTitle(prescription, formatDate)}
                        </p>
                        {isVendorPrescription(prescription) ? (
                          <span className="shrink-0 px-2 py-0.5 bg-purple-100 text-purple-700 text-[10px] font-medium rounded-full">
                            Vet
                          </span>
                        ) : null}
                        {isCustomerUpload(prescription) ? (
                          <span className="shrink-0 px-2 py-0.5 bg-indigo-100 text-indigo-700 text-[10px] font-medium rounded-full">
                            Yours
                          </span>
                        ) : null}
                      </div>
                      <p className="text-sm text-gray-500 truncate">
                        {getPrescriptionListSubtitle(prescription)}
                      </p>
                    </div>
                    <ChevronRight className="w-5 h-5 text-gray-400 shrink-0" />
                  </div>
                </button>
              ))}
            </div>
          )}
          </div>
        </div>
      </div>

      {/* Upload Modal — scrollable sheet above bottom nav + home indicator (see CustomerScreenWrapper / search pb patterns) */}
      {allowCustomerUpload && showUploadModal && (
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
                Upload Handwritten Prescription
              </h3>
              <button
                type="button"
                onClick={() => {
                  setShowUploadModal(false);
                  setUploadingFile(null);
                  setRecordDate('');
                  setContext('');
                }}
                className="shrink-0 w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200"
              >
                <X className="w-5 h-5 text-gray-600" />
              </button>
            </div>

            <div
              className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-6 pt-4 [-webkit-overflow-scrolling:touch] scroll-pb-[calc(6rem+env(safe-area-inset-bottom,0px))] pb-[calc(1rem+5.5rem+env(safe-area-inset-bottom,0px))]"
            >
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Prescription Date <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={recordDate}
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

      {/* File viewer — uploads and PDF/image-only documents */}
      {showViewer && selectedPrescription && (
        <div className="fixed inset-0 z-[75] flex flex-col bg-white sm:bg-black/60 sm:items-center sm:justify-center sm:p-4">
          <div className="bg-white w-full h-full sm:h-auto sm:max-w-4xl sm:max-h-[95vh] sm:rounded-xl overflow-hidden flex flex-col min-h-0">
            <div className="flex items-center gap-2 border-b px-3 py-3 sm:px-4 shrink-0 cw-header-safe-top cw-header-safe-x">
              <button
                type="button"
                onClick={() => {
                  setShowViewer(false);
                  setSelectedPrescription(null);
                }}
                className="p-2 rounded-full hover:bg-gray-100 shrink-0"
                aria-label="Back to list"
              >
                <ArrowLeft className="w-5 h-5 text-gray-700" />
              </button>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-gray-900 truncate">
                  {getPrescriptionListTitle(selectedPrescription, formatDate)}
                </h3>
                <p className="text-xs text-gray-500 truncate">
                  {getPrescriptionListSubtitle(selectedPrescription)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => void shareSelectedPrescription(selectedPrescription)}
                className="p-2 rounded-full hover:bg-gray-100 shrink-0"
                aria-label="Share"
              >
                <Share2 className="w-5 h-5 text-gray-600" />
              </button>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden overscroll-y-contain p-3 sm:p-4 [-webkit-overflow-scrolling:touch]">
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
                  {formatDiagnosisForDisplay(
                    selectedPrescription.content_data?.diagnosis || selectedPrescription.diagnosis
                  ) ? (
                    <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
                      <h4 className="font-semibold text-blue-900 mb-2 flex items-center gap-2">
                        <FileText className="w-4 h-4" />
                        Diagnosis
                      </h4>
                      <p className="text-blue-800">
                        {formatDiagnosisForDisplay(
                          selectedPrescription.content_data?.diagnosis || selectedPrescription.diagnosis
                        )}
                      </p>
                    </div>
                  ) : null}
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
                              <p className="font-semibold text-gray-900 text-lg">{med.name?.trim() || 'Medicine'}</p>
                              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3 mt-3 text-sm">
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

      {loadingPrescriptionView && !showViewer && !showA4Document ? (
        <div className="fixed inset-0 z-[74] flex items-center justify-center bg-black/30">
          <div className="bg-white rounded-2xl px-8 py-6 shadow-xl flex flex-col items-center gap-3">
            <div className="w-10 h-10 border-4 border-[#FF8C42] border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-gray-600">Opening prescription…</p>
          </div>
        </div>
      ) : null}

      {/* Full prescription document — vet structured Rx */}
      {showA4Document && selectedPrescription && selectedPrescription.recordType === 'prescription' && (
        <PrescriptionDocument
          headerTitle={getPrescriptionListTitle(selectedPrescription, formatDate)}
          headerSubtitle={selectedPrescription.staff_name || selectedPrescription.vendor_name || undefined}
          prescription={transformPrescriptionData({
            ...selectedPrescription,
            ...(a4PrescriptionDetails || {}),
            // Combine medications if available
            medications: a4PrescriptionDetails?.medications ||
              selectedPrescription.content_data?.medications || 
              (selectedPrescription.medication_name ? [{
                name: selectedPrescription.medication_name,
                dosage: (selectedPrescription as any).dosage,
                frequency: (selectedPrescription as any).frequency,
                duration: (selectedPrescription as any).duration,
                instructions: selectedPrescription.instructions
              }] : [])
          })}
          onClose={() => {
            setShowA4Document(false);
            setA4PrescriptionDetails(null);
          }}
          onShare={() => {
            if (selectedPrescription) void shareSelectedPrescription(selectedPrescription);
          }}
          onOrderMedicine={
            onOrderMedicine
              ? () => {
                  const medications = selectedPrescription.content_data?.medications || [];
                  onOrderMedicine(selectedPrescription.id, bookingId, medications);
                  setShowA4Document(false);
                  onClose();
                }
              : undefined
          }
        />
      )}
    </>
  );
}
