'use client';

/**
 * ============================================================================
 * PERFORA INVOICE UPLOAD COMPONENT
 * ============================================================================
 * 
 * Upload perfora invoice for pharmacy orders
 * - File upload to S3
 * - Invoice amount and items entry
 * - Preview functionality
 * 
 * Phase: Phase 4 - Pharmacy & Delivery Flow
 * Date: 2026-01-28
 * ============================================================================
 */

import { useState, useRef } from 'react';
import { Upload, FileText, X, CheckCircle2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { TouchFilePicker } from '@/components/shared/TouchFilePicker';
import { apiClient } from '@/lib/api-client';
import { toast } from 'sonner';

interface PerforaInvoiceUploadProps {
  orderId: string;
  onUploadComplete?: (invoiceUrl: string) => void;
}

export function PerforaInvoiceUpload({ orderId, onUploadComplete }: PerforaInvoiceUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [uploaded, setUploaded] = useState(false);
  const [invoiceUrl, setInvoiceUrl] = useState<string | null>(null);
  const [invoiceAmount, setInvoiceAmount] = useState('');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/') && file.type !== 'application/pdf') {
      toast.error('Please upload an image or PDF file');
      return;
    }

    // Validate file size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('File size must be less than 5MB');
      return;
    }

    try {
      setUploading(true);

      // Get presigned URL from backend
      const presignedResponse = await apiClient.post('/admin/upload/presigned-url', {
        fileName: file.name,
        fileType: file.type,
        folder: 'pharmacy-invoices',
      }) as any;

      if (!presignedResponse.success || !presignedResponse.uploadUrl) {
        throw new Error('Failed to get upload URL');
      }

      // Upload to S3
      const uploadResponse = await fetch(presignedResponse.uploadUrl, {
        method: 'PUT',
        body: file,
        headers: {
          'Content-Type': file.type,
        },
      });

      if (!uploadResponse.ok) {
        throw new Error('Failed to upload file');
      }

      const fileUrl = presignedResponse.fileUrl;
      setInvoiceUrl(fileUrl);
      setPreviewUrl(URL.createObjectURL(file));

      toast.success('Invoice uploaded successfully');
    } catch (error: any) {
      console.error('Error uploading invoice:', error);
      toast.error(error.message || 'Failed to upload invoice');
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async () => {
    if (!invoiceUrl) {
      toast.error('Please upload an invoice first');
      return;
    }

    if (!invoiceAmount || parseFloat(invoiceAmount) <= 0) {
      toast.error('Please enter a valid invoice amount');
      return;
    }

    try {
      setUploading(true);

      const response = await apiClient.post(`/pharmacy/orders/${orderId}/invoice`, {
        invoiceUrl,
        invoiceAmount: parseFloat(invoiceAmount),
      }) as any;

      if (response.success) {
        setUploaded(true);
        toast.success('Invoice submitted successfully');
        if (onUploadComplete) {
          onUploadComplete(invoiceUrl);
        }
      } else {
        throw new Error(response.error || 'Failed to submit invoice');
      }
    } catch (error: any) {
      console.error('Error submitting invoice:', error);
      toast.error(error.message || 'Failed to submit invoice');
    } finally {
      setUploading(false);
    }
  };

  const handleRemove = () => {
    setInvoiceUrl(null);
    setPreviewUrl(null);
    setInvoiceAmount('');
    setUploaded(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-4">
      <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
        <FileText className="w-5 h-5 text-[#FF8C42]" />
        Upload Perfora Invoice
      </h3>

      {uploaded ? (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-6 h-6 text-green-600" />
            <div>
              <div className="font-medium text-green-900">Invoice uploaded successfully</div>
              <div className="text-sm text-green-700">Customer has been notified</div>
            </div>
          </div>
          <Button
            onClick={handleRemove}
            variant="outline"
            size="sm"
            className="border-green-300 text-green-700"
          >
            Upload New
          </Button>
        </div>
      ) : (
        <>
          {/* File Upload */}
          {previewUrl ? (
            <div
              className={`rounded-xl border-2 border-dashed p-6 text-center transition-colors ${
                uploading ? 'border-[#FF8C42] bg-orange-50' : 'border-gray-300'
              }`}
            >
              <div className="space-y-3">
                {previewUrl.startsWith('blob:') && (
                  <img
                    src={previewUrl}
                    alt="Invoice preview"
                    className="mx-auto max-h-48 rounded-lg"
                  />
                )}
                <div className="flex items-center justify-center gap-2">
                  <FileText className="h-5 w-5 text-green-600" />
                  <span className="text-sm text-gray-700">File selected</span>
                  <button
                    type="button"
                    onClick={handleRemove}
                    className="text-red-500 hover:text-red-700"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <TouchFilePicker
              ref={fileInputRef}
              accept="image/*,application/pdf"
              disabled={uploading}
              onFileChange={handleFileSelect}
              className={`rounded-xl border-2 border-dashed p-6 text-center transition-colors ${
                uploading ? 'border-[#FF8C42] bg-orange-50' : 'border-gray-300 hover:border-[#FF8C42]'
              }`}
              innerClassName="min-h-[10rem] gap-2"
            >
              {uploading ? (
                <Loader2 className="mx-auto h-12 w-12 animate-spin text-[#FF8C42]" />
              ) : (
                <Upload className="mx-auto h-12 w-12 text-gray-400" />
              )}
              <p className="text-sm font-medium text-[#FF8C42]">
                {uploading ? 'Uploading...' : 'Tap to upload invoice'}
              </p>
              <p className="mt-1 text-xs text-gray-500">PNG, JPG, or PDF (max 5MB)</p>
            </TouchFilePicker>
          )}

          {/* Invoice Amount */}
          {invoiceUrl && (
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">
                Invoice Amount (₹)
              </label>
              <input
                type="number"
                value={invoiceAmount}
                onChange={(e) => setInvoiceAmount(e.target.value)}
                placeholder="Enter invoice amount"
                className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#FF8C42]"
                min="0"
                step="0.01"
              />
            </div>
          )}

          {/* Submit Button */}
          {invoiceUrl && invoiceAmount && (
            <Button
              onClick={handleSubmit}
              disabled={uploading}
              className="w-full bg-[#FF8C42] hover:bg-[#FF7A29] text-white"
            >
              {uploading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  Submitting...
                </>
              ) : (
                'Submit Invoice'
              )}
            </Button>
          )}
        </>
      )}
    </div>
  );
}
