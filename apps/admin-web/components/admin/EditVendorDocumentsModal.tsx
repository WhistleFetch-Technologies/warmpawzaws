'use client';

import { X, FileText, Upload, Eye, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { useEffect, useState, useRef } from 'react';
import { Button } from '@warmpawz/ui';
import { apiClient } from '@/lib/api-client';

interface VendorDocument {
  id: string;
  type: string;
  name: string;
  url: string;
  uploadedAt?: string;
  status: string;
  verified: boolean;
}

interface EditVendorDocumentsModalProps {
  isOpen: boolean;
  onClose: () => void;
  vendorId: string;
  vendorName: string;
}

const DOCUMENT_TYPE_LABELS: Record<string, string> = {
  'panCard': 'PAN Card',
  'pan_card': 'PAN Card',
  'pan': 'PAN Card',
  'businessLicense': 'Business License',
  'business_license': 'Business License',
  'license': 'Business License',
  'certificate': 'Certification',
  'certifications': 'Certification',
  'veterinaryLicense': 'Veterinary License',
  'gstCertificate': 'GST Certificate',
  'gst_certificate': 'GST Certificate',
  'gst': 'GST Certificate',
  'aadhaarFront': 'Aadhaar Card (Front)',
  'aadhaar_back': 'Aadhaar Card (Back)',
  'addressProof': 'Address Proof',
  'address_proof': 'Address Proof',
};

function getDocumentLabel(type: string): string {
  return DOCUMENT_TYPE_LABELS[type] || type.replace(/_/g, ' ').replace(/([A-Z])/g, ' $1').replace(/\b\w/g, l => l.toUpperCase()).trim();
}

export function EditVendorDocumentsModal({
  isOpen,
  onClose,
  vendorId,
  vendorName
}: EditVendorDocumentsModalProps) {
  const [documents, setDocuments] = useState<VendorDocument[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<Record<string, File>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [success, setSuccess] = useState<string | null>(null);
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const customFileInputRef = useRef<HTMLInputElement | null>(null);
  const customDocTypeRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (isOpen && vendorId) {
      loadDocuments();
    }
  }, [isOpen, vendorId]);

  const loadDocuments = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get<any>(`/admin/vendors/${vendorId}/documents`);
      setDocuments(response.documents || []);
      setErrors({});
      setSuccess(null);
    } catch (error: any) {
      console.error('Error loading documents:', error);
      setErrors({ general: error.message || 'Failed to load documents' });
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = (documentType: string, file: File | null) => {
    if (!file) {
      const newSelected = { ...selectedFiles };
      delete newSelected[documentType];
      setSelectedFiles(newSelected);
      const newErrors = { ...errors };
      delete newErrors[documentType];
      setErrors(newErrors);
      return;
    }

    // Validate file type
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
    const allowedExtensions = ['.pdf', '.jpg', '.jpeg', '.png'];
    const fileExt = file.name.split('.').pop()?.toLowerCase() || '';
    const isValidType = allowedTypes.includes(file.type) || allowedExtensions.includes(`.${fileExt}`);

    if (!isValidType) {
      setErrors({ ...errors, [documentType]: 'Invalid file type. Allowed: PDF, JPG, PNG' });
      return;
    }

    // Validate file size (max 10MB)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      setErrors({ ...errors, [documentType]: 'File size exceeds 10MB limit' });
      return;
    }

    setSelectedFiles({ ...selectedFiles, [documentType]: file });
    const newErrors = { ...errors };
    delete newErrors[documentType];
    setErrors(newErrors);
  };

  const handleSave = async () => {
    if (Object.keys(selectedFiles).length === 0) {
      setErrors({ general: 'Please select at least one file to upload' });
      return;
    }

    try {
      setUploading(true);
      setErrors({});
      setSuccess(null);

      // Create FormData
      const formData = new FormData();
      
      // Add files with appropriate field names
      for (const [documentType, file] of Object.entries(selectedFiles)) {
        // Map document types to field names expected by backend
        const fieldNameMap: Record<string, string> = {
          'pan_card': 'panCard',
          'pan': 'panCard',
          'business_license': 'license',
          'certifications': 'certificate',
          'gst_certificate': 'gstCertificate',
        };
        
        const fieldName = fieldNameMap[documentType] || documentType;
        formData.append(fieldName, file);
      }

      // Use fetch directly for FormData (apiClient might not handle multipart correctly)
      const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || '';
      const token = localStorage.getItem('adminAuthToken') || localStorage.getItem('authToken') || '';
      const response = await fetch(`${baseUrl}/admin/vendors/${vendorId}/documents`, {
        method: 'PATCH',
        headers: {
          // Don't set Content-Type - browser will set it with boundary
          'Authorization': `Bearer ${token}`,
        },
        body: formData,
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to update documents');
      }

      setSuccess(`Successfully updated ${result.updatedDocuments?.length || 0} document(s)`);
      setSelectedFiles({});
      
      // Reload documents
      await loadDocuments();

      // Clear file inputs
      Object.values(fileInputRefs.current).forEach(ref => {
        if (ref) ref.value = '';
      });
    } catch (error: any) {
      console.error('Error updating documents:', error);
      setErrors({ general: error.message || 'Failed to update documents' });
    } finally {
      setUploading(false);
    }
  };

  const handleViewDocument = (url: string) => {
    window.open(url, '_blank');
  };

  if (!isOpen) return null;

  // Get unique document types from existing documents
  const documentTypes = Array.from(new Set(documents.map(d => d.type)));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-2xl font-semibold text-gray-900">Edit Vendor Documents</h2>
            <p className="text-sm text-gray-500 mt-1">{vendorName}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-[#FF8C42]" />
            </div>
          ) : (
            <>
              {errors.general && (
                <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-red-600" />
                  <span className="text-red-700">{errors.general}</span>
                </div>
              )}

              {success && (
                <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                  <span className="text-green-700">{success}</span>
                </div>
              )}

              <div className="space-y-4">
                {documentTypes.length === 0 && documents.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    <FileText className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                    <p>No documents found for this vendor</p>
                  </div>
                ) : (
                  documentTypes.map((docType) => {
                    const doc = documents.find(d => d.type === docType);
                    const selectedFile = selectedFiles[docType];
                    const error = errors[docType];

                    return (
                      <div key={docType} className="border border-gray-200 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <FileText className="w-5 h-5 text-gray-400" />
                            <h3 className="font-medium text-gray-900">
                              {getDocumentLabel(docType)}
                            </h3>
                          </div>
                          {doc && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleViewDocument(doc.url)}
                              className="gap-2"
                            >
                              <Eye className="w-4 h-4" />
                              View
                            </Button>
                          )}
                        </div>

                        {doc && (
                          <div className="mb-3 p-3 bg-gray-50 rounded-lg">
                            <p className="text-sm text-gray-600">
                              Current: {doc.name || 'Document uploaded'}
                            </p>
                            {doc.uploadedAt && (
                              <p className="text-xs text-gray-400 mt-1">
                                Uploaded: {new Date(doc.uploadedAt).toLocaleDateString()}
                              </p>
                            )}
                          </div>
                        )}

                        {error && (
                          <div className="mb-3 p-2 bg-red-50 border border-red-200 rounded text-sm text-red-700">
                            {error}
                          </div>
                        )}

                        <div className="flex items-center gap-2">
                          <input
                            ref={(el) => (fileInputRefs.current[docType] = el)}
                            type="file"
                            accept=".pdf,.jpg,.jpeg,.png"
                            onChange={(e) => handleFileSelect(docType, e.target.files?.[0] || null)}
                            className="hidden"
                            id={`file-input-${docType}`}
                          />
                          <label
                            htmlFor={`file-input-${docType}`}
                            className="flex-1"
                          >
                            <Button
                              type="button"
                              variant="outline"
                              className="w-full gap-2"
                              onClick={() => fileInputRefs.current[docType]?.click()}
                            >
                              <Upload className="w-4 h-4" />
                              {selectedFile ? `Selected: ${selectedFile.name}` : (doc ? 'Replace File' : 'Upload File')}
                            </Button>
                          </label>
                          {selectedFile && (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => handleFileSelect(docType, null)}
                            >
                              <X className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}

                {/* Allow uploading new document types */}
                <div className="border border-dashed border-gray-300 rounded-lg p-4">
                  <h3 className="font-medium text-gray-900 mb-2">Upload Additional Document</h3>
                  <div className="flex items-center gap-2">
                    <input
                      ref={customDocTypeRef}
                      type="text"
                      placeholder="Document type (e.g., insurance, police_verification)"
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FF8C42] focus:border-transparent"
                      id="custom-doc-type"
                    />
                    <input
                      ref={customFileInputRef}
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file && customDocTypeRef.current?.value) {
                          const docType = customDocTypeRef.current.value.trim();
                          if (docType) {
                            handleFileSelect(docType, file);
                            customDocTypeRef.current.value = '';
                            if (customFileInputRef.current) {
                              customFileInputRef.current.value = '';
                            }
                          } else {
                            setErrors({ ...errors, custom: 'Please enter a document type' });
                          }
                        } else if (file && !customDocTypeRef.current?.value) {
                          setErrors({ ...errors, custom: 'Please enter a document type before selecting a file' });
                        }
                      }}
                      className="hidden"
                      id="custom-file-input"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      className="gap-2"
                      onClick={() => {
                        if (!customDocTypeRef.current?.value?.trim()) {
                          setErrors({ ...errors, custom: 'Please enter a document type first' });
                          customDocTypeRef.current?.focus();
                          return;
                        }
                        customFileInputRef.current?.click();
                      }}
                    >
                      <Upload className="w-4 h-4" />
                      Select File
                    </Button>
                  </div>
                  {errors.custom && (
                    <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-sm text-red-700">
                      {errors.custom}
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200 bg-gray-50">
          <Button variant="outline" onClick={onClose} disabled={uploading}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={uploading || Object.keys(selectedFiles).length === 0}
            className="bg-[#FF8C42] hover:bg-[#FF7A2E] gap-2"
          >
            {uploading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Uploading...
              </>
            ) : (
              <>
                <CheckCircle className="w-4 h-4" />
                Save Changes
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
