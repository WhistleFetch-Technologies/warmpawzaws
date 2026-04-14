'use client';

/**
 * ============================================================================
 * DIAGNOSTICS REPORT UPLOAD COMPONENT
 * ============================================================================
 * 
 * Allows diagnostics vendors to upload lab reports and notify customers/vets
 * - Upload report files (PDF, images)
 * - Add summary and findings
 * - Link to prescribing vet
 * - Auto-notify customer and vet
 * 
 * Date: 2026-01-20
 * ============================================================================
 */

import React, { useState, useEffect } from 'react';
import { 
  Upload, FileText, CheckCircle2, AlertCircle, X, User,
  Loader2, Send, Image, File, Microscope, ClipboardList
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { apiClient } from '@/lib/api-client';
import { toast } from 'sonner';

interface DiagnosticsReportUploadProps {
  vendorId: string;
  bookingId: string;
  bookingData?: {
    customerName: string;
    customerPhone: string;
    petName: string;
    petId: string;
    customerId: string;
    serviceName: string;
    prescribingVetId?: string;
    prescribingVetName?: string;
    prescribingVetBookingId?: string;
  };
  onSuccess?: (reportId: string) => void;
  onCancel?: () => void;
}

const REPORT_TYPES = [
  { value: 'lab', label: 'Lab Test', icon: '🧪' },
  { value: 'imaging', label: 'X-Ray/Imaging', icon: '📷' },
  { value: 'pathology', label: 'Pathology', icon: '🔬' },
  { value: 'other', label: 'Other', icon: '📋' },
];

export function DiagnosticsReportUpload({
  vendorId,
  bookingId,
  bookingData,
  onSuccess,
  onCancel,
}: DiagnosticsReportUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  
  // Form state
  const [reportType, setReportType] = useState<string>('lab');
  const [testName, setTestName] = useState('');
  const [summary, setSummary] = useState('');
  const [findings, setFindings] = useState('');
  const [reportFile, setReportFile] = useState<File | null>(null);
  const [reportUrl, setReportUrl] = useState<string>('');
  const [previewUrl, setPreviewUrl] = useState<string>('');

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      toast.error('Please upload a PDF or image file');
      return;
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast.error('File size must be less than 10MB');
      return;
    }

    setReportFile(file);
    
    // Create preview for images
    if (file.type.startsWith('image/')) {
      setPreviewUrl(URL.createObjectURL(file));
    } else {
      setPreviewUrl('');
    }

    // Upload immediately
    await uploadFile(file);
  };

  const uploadFile = async (file: File) => {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('vendorId', vendorId);
      formData.append('bookingId', bookingId);
      formData.append('documentType', 'diagnostic_report');

      // ✅ FIX: Use post method which handles FormData
      const res = await apiClient.post<any>('/storage/upload', formData);
      
      if (res.url) {
        setReportUrl(res.url);
        toast.success('File uploaded successfully');
      }
    } catch (error: any) {
      console.error('Upload error:', error);
      toast.error(error.message || 'Failed to upload file');
      setReportFile(null);
      setPreviewUrl('');
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async () => {
    if (!testName.trim()) {
      toast.error('Please enter the test name');
      return;
    }

    if (!reportUrl) {
      toast.error('Please upload the report file');
      return;
    }

    setSubmitting(true);
    try {
      const res = await apiClient.post<any>('/diagnostics/reports/upload', {
        bookingId,
        vendorId,
        customerId: bookingData?.customerId,
        petId: bookingData?.petId,
        prescribingVetId: bookingData?.prescribingVetId,
        prescribingVetBookingId: bookingData?.prescribingVetBookingId,
        reportType,
        testName: testName.trim(),
        reportUrl,
        summary: summary.trim() || undefined,
        findings: findings.trim() || undefined,
      });

      if (res.success) {
        setSubmitted(true);
        toast.success('Report uploaded and notifications sent!');
        
        setTimeout(() => {
          onSuccess?.(res.reportId);
        }, 2000);
      }
    } catch (error: any) {
      console.error('Submit error:', error);
      toast.error(error.message || 'Failed to submit report');
    } finally {
      setSubmitting(false);
    }
  };

  const removeFile = () => {
    setReportFile(null);
    setReportUrl('');
    setPreviewUrl('');
  };

  // Success state
  if (submitted) {
    return (
      <div className="min-h-[400px] flex flex-col items-center justify-center p-8 text-center">
        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mb-6">
          <CheckCircle2 className="w-10 h-10 text-green-500" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Report Uploaded!</h2>
        <p className="text-gray-600 mb-4">
          {bookingData?.customerName || 'Customer'} has been notified about the results.
        </p>
        {bookingData?.prescribingVetName && (
          <p className="text-sm text-gray-500">
            Dr. {bookingData.prescribingVetName} has also been notified for review.
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Microscope className="w-6 h-6 text-[#FF8C42]" />
            Upload Diagnostic Report
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            Upload results for {bookingData?.petName || 'patient'}
          </p>
        </div>
        {onCancel && (
          <Button variant="ghost" size="sm" onClick={onCancel}>
            <X className="w-5 h-5" />
          </Button>
        )}
      </div>

      {/* Patient Info */}
      {bookingData && (
        <Card className="bg-gray-50 p-4 border-gray-200">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center">
              <User className="w-6 h-6 text-orange-600" />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-gray-900">{bookingData.customerName}</p>
              <p className="text-sm text-gray-500">Pet: {bookingData.petName}</p>
            </div>
            {bookingData.prescribingVetName && (
              <Badge className="bg-blue-100 text-blue-700">
                Ordered by Dr. {bookingData.prescribingVetName}
              </Badge>
            )}
          </div>
        </Card>
      )}

      {/* Report Type */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Report Type
        </label>
        <div className="grid grid-cols-4 gap-2">
          {REPORT_TYPES.map((type) => (
            <button
              key={type.value}
              onClick={() => setReportType(type.value)}
              className={`p-3 rounded-xl border-2 transition text-center ${
                reportType === type.value
                  ? 'border-[#FF8C42] bg-orange-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <span className="text-2xl">{type.icon}</span>
              <p className="text-xs mt-1">{type.label}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Test Name */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Test Name *
        </label>
        <input
          type="text"
          value={testName}
          onChange={(e) => setTestName(e.target.value)}
          placeholder="e.g., Complete Blood Count (CBC)"
          className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:border-[#FF8C42] outline-none"
        />
      </div>

      {/* File Upload */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Report File *
        </label>
        
        {!reportFile ? (
          <label className="relative block cursor-pointer overflow-hidden rounded-xl">
            <div className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center hover:border-[#FF8C42] transition pointer-events-none">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Upload className="w-8 h-8 text-gray-400" />
              </div>
              <p className="text-gray-900 font-medium mb-1">Click to upload report</p>
              <p className="text-gray-500 text-sm">PDF or images up to 10MB</p>
            </div>
            <input
              type="file"
              accept=".pdf,image/*"
              onChange={handleFileSelect}
              className="absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0"
            />
          </label>
        ) : (
          <div className="border border-gray-200 rounded-xl p-4">
            <div className="flex items-center gap-4">
              {previewUrl ? (
                <img 
                  src={previewUrl} 
                  alt="Report preview" 
                  className="w-20 h-20 object-cover rounded-lg"
                />
              ) : (
                <div className="w-20 h-20 bg-red-100 rounded-lg flex items-center justify-center">
                  <FileText className="w-10 h-10 text-red-500" />
                </div>
              )}
              <div className="flex-1">
                <p className="font-medium text-gray-900 truncate">{reportFile.name}</p>
                <p className="text-sm text-gray-500">
                  {(reportFile.size / 1024 / 1024).toFixed(2)} MB
                </p>
                {uploading && (
                  <div className="flex items-center gap-2 mt-1 text-orange-600">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span className="text-sm">Uploading...</span>
                  </div>
                )}
                {reportUrl && !uploading && (
                  <div className="flex items-center gap-2 mt-1 text-green-600">
                    <CheckCircle2 className="w-4 h-4" />
                    <span className="text-sm">Uploaded</span>
                  </div>
                )}
              </div>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={removeFile}
                disabled={uploading}
              >
                <X className="w-5 h-5" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Summary */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Summary (Optional)
        </label>
        <textarea
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          placeholder="Brief summary of the test results..."
          rows={2}
          className="w-full px-4 py-3 border border-gray-200 rounded-xl resize-none focus:border-[#FF8C42] outline-none"
        />
      </div>

      {/* Findings */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Key Findings (Optional)
        </label>
        <textarea
          value={findings}
          onChange={(e) => setFindings(e.target.value)}
          placeholder="Notable findings or abnormalities..."
          rows={3}
          className="w-full px-4 py-3 border border-gray-200 rounded-xl resize-none focus:border-[#FF8C42] outline-none"
        />
      </div>

      {/* Info */}
      <Card className="bg-blue-50 border-blue-200 p-4">
        <p className="text-blue-800 text-sm flex items-start gap-2">
          <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <span>
            The customer will be notified immediately when you upload the report.
            {bookingData?.prescribingVetName && (
              <> Dr. {bookingData.prescribingVetName} will also be notified for review.</>
            )}
          </span>
        </p>
      </Card>

      {/* Actions */}
      <div className="flex gap-3">
        {onCancel && (
          <Button variant="outline" onClick={onCancel} className="flex-1">
            Cancel
          </Button>
        )}
        <Button
          onClick={handleSubmit}
          disabled={!testName.trim() || !reportUrl || uploading || submitting}
          className="flex-1 bg-[#FF8C42] hover:bg-[#E67A35]"
        >
          {submitting ? (
            <Loader2 className="w-5 h-5 animate-spin mr-2" />
          ) : (
            <Send className="w-5 h-5 mr-2" />
          )}
          Upload & Notify
        </Button>
      </div>
    </div>
  );
}

export default DiagnosticsReportUpload;
