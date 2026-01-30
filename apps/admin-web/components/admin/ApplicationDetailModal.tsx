'use client';

import { useState, useEffect } from 'react';
import { X, Check, AlertCircle, FileText, Image as ImageIcon, Download, Eye, CheckCircle, XCircle, User, Building2, RefreshCw } from 'lucide-react';
import { Button, Badge } from '@warmpawz/ui';
import { apiClient } from '@/lib/api-client';
import { getAdminId } from '@/lib/cognito-auth';

interface VendorDocument {
  id: string;
  type: string;
  name: string;
  url: string;
  uploadedAt?: string;
  status: string;
  verified: boolean;
  fileKey?: string;
  originalName?: string;
}

// Document type labels for display
const DOCUMENT_TYPE_LABELS: Record<string, string> = {
  'businessLicense': 'Business License / Registration Certificate',
  'business_license': 'Business License / Registration Certificate',
  'idProof': 'Owner ID Proof (Aadhaar/PAN/Passport)',
  'id_proof': 'Owner ID Proof (Aadhaar/PAN/Passport)',
  'gstCertificate': 'GST Certificate',
  'gst_certificate': 'GST Certificate',
  'gst': 'GST Certificate',
  'panCard': 'PAN Card',
  'pan_card': 'PAN Card',
  'pan': 'PAN Card',
  'aadhaarFront': 'Aadhaar Card (Front)',
  'aadhaar_front': 'Aadhaar Card (Front)',
  'aadhaarBack': 'Aadhaar Card (Back)',
  'aadhaar_back': 'Aadhaar Card (Back)',
  'policeVerification': 'Police Verification Certificate',
  'police_verification': 'Police Verification Certificate',
  'cancelledCheque': 'Cancelled Cheque',
  'cancelled_cheque': 'Cancelled Cheque',
  'profilePhoto': 'Profile Photo',
  'profile_photo': 'Profile Photo',
  'veterinaryLicense': 'Veterinary License',
  'veterinary_license': 'Veterinary License',
  'certifications': 'Professional Certifications',
  'insurance': 'Insurance Certificate',
  'address_proof': 'Address Proof',
  'addressProof': 'Address Proof',
};

function getDocumentLabel(type: string): string {
  return DOCUMENT_TYPE_LABELS[type] || type.replace(/_/g, ' ').replace(/([A-Z])/g, ' $1').replace(/\b\w/g, l => l.toUpperCase()).trim();
}

interface ApplicationDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  application: any;
  onApprove: () => void;
  onReject: () => void;
  onRequestClarification: () => void;
}

export function ApplicationDetailModal({
  isOpen,
  onClose,
  application,
  onApprove,
  onReject,
  onRequestClarification
}: ApplicationDetailModalProps) {
  const [activeTab, setActiveTab] = useState<'details' | 'documents'>('details');
  const [rejecting, setRejecting] = useState(false);
  const [clarifying, setClarifying] = useState(false);
  const [approving, setApproving] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [clarificationNotes, setClarificationNotes] = useState('');
  const [documents, setDocuments] = useState<VendorDocument[]>([]);
  const [documentsLoading, setDocumentsLoading] = useState(false);

  useEffect(() => {
    if (isOpen && application && activeTab === 'documents') {
      loadDocuments();
    }
  }, [isOpen, application, activeTab]);

  const loadDocuments = async () => {
    const vendorId = application?.vendorId || application?.id;
    if (!vendorId) {
      // No vendorId (e.g. pending application): use only application-embedded documents
      parseDocumentsFromApplication();
      return;
    }

    try {
      setDocumentsLoading(true);
      const data = await apiClient.get<any>(`/admin/vendors/${vendorId}/documents`);
      const apiDocs = data.documents || [];
      if (apiDocs.length > 0) {
        setDocuments(apiDocs);
      } else {
        // API returned empty (e.g. pending vendor): show documents from application payload
        parseDocumentsFromApplication();
      }
    } catch (error) {
      console.error('Error loading documents:', error);
      parseDocumentsFromApplication();
    } finally {
      setDocumentsLoading(false);
    }
  };

  const parseDocumentsFromApplication = () => {
    const docs: VendorDocument[] = [];
    const uploadedDocs = application.uploadedDocuments || application.uploaded_documents;
    const customFields = application.customFields || application.formData || {};
    
    if (uploadedDocs) {
      try {
        const parsed = typeof uploadedDocs === 'string' ? JSON.parse(uploadedDocs) : uploadedDocs;
        if (Array.isArray(parsed)) {
          parsed.forEach((doc: any, idx: number) => {
            docs.push({
              id: doc.id || `doc-${idx}`,
              type: doc.type || doc.documentType || 'document',
              name: doc.name || doc.fileName || doc.type || 'Document',
              url: doc.url || doc.fileUrl,
              status: 'uploaded',
              verified: doc.verified || false
            });
          });
        } else if (typeof parsed === 'object') {
          Object.entries(parsed).forEach(([type, value]) => {
            const docData = typeof value === 'string' ? { url: value } : value as any;
            docs.push({
              id: `doc-${type}`,
              type,
              name: type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
              url: docData.url || value as string,
              status: 'uploaded',
              verified: docData.verified || false
            });
          });
        }
      } catch (e) {
        console.warn('Could not parse uploaded documents:', e);
      }
    }

    // Add documents from custom fields
    if (customFields.gstCertificate) {
      docs.push({ id: 'gst', type: 'gst_certificate', name: 'GST Certificate', url: customFields.gstCertificate, status: 'uploaded', verified: false });
    }
    if (customFields.panCard) {
      docs.push({ id: 'pan', type: 'pan_card', name: 'PAN Card', url: customFields.panCard, status: 'uploaded', verified: false });
    }
    if (customFields.businessLicense || customFields.license) {
      docs.push({ id: 'license', type: 'business_license', name: 'Business License', url: customFields.businessLicense || customFields.license, status: 'uploaded', verified: false });
    }
    if (customFields.profilePhoto) {
      docs.push({ id: 'photo', type: 'profile_photo', name: 'Profile Photo', url: customFields.profilePhoto, status: 'uploaded', verified: false });
    }

    setDocuments(docs);
  };

  const handleViewDocument = async (doc: VendorDocument) => {
    if (!doc.url) {
      alert('Document URL not available');
      return;
    }
    
    try {
      // If the URL is already a presigned URL (from the backend), use it directly
      if (doc.url.includes('X-Amz-Signature') || doc.url.includes('amazonaws.com')) {
        window.open(doc.url, '_blank');
        return;
      }
      
      // Otherwise, get a fresh presigned URL
      const response = await apiClient.get<any>(`/storage/refresh-url?url=${encodeURIComponent(doc.url)}`);
      const viewUrl = response.signedUrl || doc.url;
      window.open(viewUrl, '_blank');
    } catch (error) {
      console.error('Error viewing document:', error);
      // Fallback to direct URL
      window.open(doc.url, '_blank');
    }
  };

  const handleDownloadDocument = async (doc: VendorDocument) => {
    if (!doc.url) {
      alert('Document URL not available');
      return;
    }
    
    try {
      let downloadUrl = doc.url;
      
      // Get fresh presigned URL if needed
      if (!doc.url.includes('X-Amz-Signature')) {
        try {
          const response = await apiClient.get<any>(`/storage/refresh-url?url=${encodeURIComponent(doc.url)}`);
          downloadUrl = response.signedUrl || doc.url;
        } catch {
          // Use original URL if refresh fails
        }
      }
      
      // Fetch and download the file
      const response = await fetch(downloadUrl);
      const blob = await response.blob();
      
      // Determine file extension
      const contentType = response.headers.get('content-type') || '';
      let ext = 'pdf';
      if (contentType.includes('image/jpeg')) ext = 'jpg';
      else if (contentType.includes('image/png')) ext = 'png';
      else if (contentType.includes('application/pdf')) ext = 'pdf';
      
      // Create download link
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${doc.name || doc.type}.${ext}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading document:', error);
      // Fallback to opening in new tab
      window.open(doc.url, '_blank');
    }
  };

  const getVendorTypeBadge = (vendorType: string) => {
    if (vendorType === 'solo') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-purple-100 text-purple-700 border border-purple-200">
          <User className="w-3 h-3" />
          Solo
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-blue-100 text-blue-700 border border-blue-200">
        <Building2 className="w-3 h-3" />
        Business
      </span>
    );
  };

  if (!isOpen || !application) return null;

  const appId = application.applicationId || application.id;
  const customFields = application.customFields || application.formData || {};
  const vendorType = application.vendorType || application.vendor_type || 'business';

  const handleApprove = async () => {
    try {
      setApproving(true);
      // Try onboarding review endpoint first (proper state machine)
      try {
        const adminId = getAdminId() || 'admin'; // Fallback to 'admin' if not available
        await apiClient.post(`/admin/vendor/onboarding/${appId}/review`, {
          action: 'APPROVE',
          admin_id: adminId,
          comments: 'Approved after review'
        });
        alert('Application approved successfully');
        onApprove();
        onClose();
        return;
      } catch (onboardingError: any) {
        // Fallback to compatibility endpoint
        console.warn('Onboarding review endpoint failed, trying compatibility endpoint:', onboardingError);
        await apiClient.post(`/admin/vendor/application/${appId}/approve`, {
          reviewerName: 'Admin',
          notes: 'Approved after review'
        });
        alert('Application approved successfully');
        onApprove();
        onClose();
      }
    } catch (error: any) {
      console.error('Error approving:', error);
      alert(error.message || 'Failed to approve application');
    } finally {
      setApproving(false);
    }
  };

  const handleReject = async () => {
    if (!rejectionReason.trim()) {
      alert('Please provide a rejection reason');
      return;
    }

    try {
      setRejecting(true);
      // Try onboarding review endpoint first (proper state machine)
      try {
        const adminId = getAdminId() || 'admin'; // Fallback to 'admin' if not available
        await apiClient.post(`/admin/vendor/onboarding/${appId}/review`, {
          action: 'REJECT',
          admin_id: adminId,
          rejection_reason: rejectionReason,
          comments: rejectionReason
        });
        alert('Application rejected');
        onReject();
        onClose();
        return;
      } catch (onboardingError: any) {
        // Fallback to compatibility endpoint
        console.warn('Onboarding review endpoint failed, trying compatibility endpoint:', onboardingError);
        await apiClient.post(`/admin/vendor/application/${appId}/reject`, {
          reviewerName: 'Admin',
          reason: rejectionReason,
          allowResubmit: true
        });
        alert('Application rejected');
        onReject();
        onClose();
      }
    } catch (error: any) {
      console.error('Error rejecting:', error);
      alert(error.message || 'Failed to reject application');
    } finally {
      setRejecting(false);
    }
  };

  const handleRequestClarification = async () => {
    try {
      setClarifying(true);
      // Try onboarding review endpoint first (proper state machine)
      try {
        const adminId = getAdminId() || 'admin'; // Fallback to 'admin' if not available
        await apiClient.post(`/admin/vendor/onboarding/${appId}/review`, {
          action: 'REQUEST_CLARIFICATION',
          admin_id: adminId,
          comments: clarificationNotes || 'Please provide additional information'
        });
        alert('Clarification request sent');
        onRequestClarification();
        onClose();
        return;
      } catch (onboardingError: any) {
        // Fallback to compatibility endpoint
        console.warn('Onboarding review endpoint failed, trying compatibility endpoint:', onboardingError);
        await apiClient.post(`/admin/vendor/application/${appId}/request-clarification`, {
          reviewerName: 'Admin',
          notes: clarificationNotes || 'Please provide additional information'
        });
        alert('Clarification request sent');
        onRequestClarification();
        onClose();
      }
    } catch (error: any) {
      console.error('Error requesting clarification:', error);
      alert(error.message || 'Failed to send clarification request');
    } finally {
      setClarifying(false);
    }
  };

  const getVendorTypeName = (type: string) => {
    if (!type) return 'Not Specified';
    const typeMap: Record<string, string> = {
      'walking': 'Pet Walking',
      'grooming': 'Pet Grooming',
      'boarding': 'Boarding',
      'training': 'Pet Training',
      'vet': 'Veterinary'
    };
    return typeMap[type] || type.charAt(0).toUpperCase() + type.slice(1);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-0 py-4 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h2 className="text-xl">Application Details</h2>
            <p className="text-sm text-gray-500">Review vendor application</p>
          </div>
          <button onClick={onClose} className="p-0 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="px-0 border-b border-gray-200 flex gap-4">
          <button
            onClick={() => setActiveTab('details')}
            className={`px-4 py-0 text-sm border-b-2 transition-colors ${
              activeTab === 'details'
                ? 'border-[#FF8C42] text-[#FF8C42]'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            Vendor Details
          </button>
          <button
            onClick={() => setActiveTab('documents')}
            className={`px-4 py-0 text-sm border-b-2 transition-colors ${
              activeTab === 'documents'
                ? 'border-[#FF8C42] text-[#FF8C42]'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            Documents & Certificates
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-0">
          {activeTab === 'details' && (
            <div className="space-y-6">
              {/* Basic Info */}
              <div className="bg-gray-50 rounded-xl p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-base font-medium">Basic Information</h3>
                  {getVendorTypeBadge(vendorType)}
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <InfoRow label="Full Name" value={application.fullName || application.ownerName} />
                  <InfoRow label="Business Name" value={application.businessName || 'N/A'} />
                  <InfoRow label="Phone" value={application.phone || application.mobile} />
                  <InfoRow label="Email" value={application.email} />
                  <InfoRow label="Service Category" value={application.serviceCategory || application.category || application.roleName || 'N/A'} />
                  <InfoRow label="Experience" value={application.experience || (application.experienceYears ? `${application.experienceYears} years` : 'N/A')} />
                </div>
              </div>

              {/* Address Info */}
              <div className="bg-gray-50 rounded-xl p-5">
                <h3 className="text-base font-medium mb-4">Address Information</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <InfoRow label="Full Address" value={application.address} />
                  </div>
                  <InfoRow label="City" value={application.city} />
                  <InfoRow label="State" value={application.state} />
                  <InfoRow label="Pincode" value={application.pincode} />
                  {application.landmark && <InfoRow label="Landmark" value={application.landmark} />}
                </div>
              </div>

              {/* Business Info */}
              <div className="bg-gray-50 rounded-xl p-5">
                <h3 className="text-base font-medium mb-4">Business Information</h3>
                <div className="grid grid-cols-2 gap-4">
                  <InfoRow label="Application ID" value={appId} />
                  <InfoRow label="Vendor Type" value={vendorType === 'solo' ? 'Solo Provider' : 'Business'} />
                  <InfoRow label="GST Number" value={customFields.gstNumber || application.gstNumber || application.gst_number || 'Not provided'} />
                  <InfoRow label="PAN Number" value={customFields.panNumber || application.panNumber || application.pan_number || 'Not provided'} />
                  <InfoRow label="License Number" value={customFields.licenseNumber || application.licenseNumber || application.registration_number || 'Not provided'} />
                  {application.submittedAt && <InfoRow label="Submitted At" value={new Date(application.submittedAt).toLocaleDateString()} />}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'documents' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-medium">Uploaded Documents</h3>
                <Button variant="outline" size="sm" onClick={loadDocuments} disabled={documentsLoading}>
                  <RefreshCw className={`w-4 h-4 mr-2 ${documentsLoading ? 'animate-spin' : ''}`} />
                  {documentsLoading ? 'Loading...' : 'Refresh'}
                </Button>
              </div>
              
              {documentsLoading ? (
                <div className="text-center py-8">
                  <RefreshCw className="w-8 h-8 animate-spin text-[#FF8C42] mx-auto mb-2" />
                  <p className="text-sm text-gray-500">Loading documents...</p>
                </div>
              ) : documents.length === 0 ? (
                <div className="text-center py-12 bg-gray-50 rounded-xl">
                  <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500 font-medium">No documents uploaded</p>
                  <p className="text-sm text-gray-400 mt-1">The vendor hasn't uploaded any documents yet</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3">
                  {documents.map((doc, idx) => {
                    const isImage = doc.type.toLowerCase().includes('photo') || 
                                   doc.type.toLowerCase().includes('image') ||
                                   doc.type.toLowerCase().includes('aadhaar');
                    const displayName = doc.name || getDocumentLabel(doc.type);
                    
                    return (
                      <div key={doc.id || idx} className="bg-white border border-gray-200 rounded-xl p-4 flex items-center justify-between hover:border-[#FF8C42]/30 hover:shadow-sm transition-all">
                        <div className="flex items-center gap-4">
                          <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                            isImage ? 'bg-blue-50' : 'bg-orange-50'
                          }`}>
                            {isImage ? (
                              <ImageIcon className="w-6 h-6 text-blue-500" />
                            ) : (
                              <FileText className="w-6 h-6 text-orange-500" />
                            )}
                          </div>
                          <div>
                            <div className="text-sm font-semibold text-gray-900">{displayName}</div>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded">{doc.type}</span>
                              {doc.verified ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-green-100 text-green-700">
                                  <CheckCircle className="w-3 h-3" />
                                  Verified
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-yellow-100 text-yellow-700">
                                  Pending Review
                                </span>
                              )}
                            </div>
                            {doc.originalName && (
                              <div className="text-xs text-gray-400 mt-1">File: {doc.originalName}</div>
                            )}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline" onClick={() => handleViewDocument(doc)} className="hover:bg-blue-50 hover:border-blue-300">
                            <Eye className="w-4 h-4 mr-1" />
                            View
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => handleDownloadDocument(doc)} className="hover:bg-green-50 hover:border-green-300">
                            <Download className="w-4 h-4 mr-1" />
                            Download
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-0 py-4 border-t border-gray-200 flex items-center justify-between">
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={handleRequestClarification}
              disabled={clarifying}
            >
              <AlertCircle className="w-4 h-4 mr-2" />
              Request Info
            </Button>
          </div>
          
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={() => {
                const reason = prompt('Enter rejection reason:');
                if (reason) {
                  setRejectionReason(reason);
                  handleReject();
                }
              }}
              disabled={rejecting || approving}
              className="text-red-600 hover:bg-red-50"
            >
              <XCircle className="w-4 h-4 mr-2" />
              Reject
            </Button>
            <Button
              onClick={handleApprove}
              disabled={rejecting || approving || clarifying}
              className="bg-green-600 hover:bg-green-700"
            >
              <CheckCircle className="w-4 h-4 mr-2" />
              {approving ? 'Approving...' : 'Approve'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-gray-500 mb-1">{label}</div>
      <div className="text-sm text-gray-900 font-medium">{value || 'N/A'}</div>
    </div>
  );
}

