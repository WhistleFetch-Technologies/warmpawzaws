import { useState } from 'react';
import { X, Check, AlertCircle, FileText, Image as ImageIcon, Download, Eye, CheckCircle, XCircle } from 'lucide-react';
import { Button } from '../ui/button';
import { getApiBaseUrl, getAuthHeaders } from '../../utils/api-config';

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
  const [requesting, setRequesting] = useState(false);

  if (!isOpen || !application) return null;

  // Use the correct application ID (try applicationId first, fallback to id)
  const appId = application.applicationId || application.id;
  console.log('📋 Using application ID:', appId);

  const handleApprove = async () => {
    try {
      setApproving(true);
      const response = await fetch(
        `${getApiBaseUrl()}/admin/vendor/application/${appId}/approve`,
        {
          method: 'POST',
          headers: {
            ...getAuthHeaders(),
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            reviewerName: 'Admin',
            notes: 'Approved after review'
          })
        }
      );

      if (response.ok) {
        onApprove();
        onClose();
      } else {
        const error = await response.text();
        console.error('❌ Failed to approve:', error);
        alert('Failed to approve application');
      }
    } catch (error) {
      console.error('Error approving:', error);
      alert('Error approving application');
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
      const response = await fetch(
        `${getApiBaseUrl()}/admin/vendor/application/${appId}/reject`,
        {
          method: 'POST',
          headers: {
            ...getAuthHeaders(),
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            reviewerName: 'Admin',
            reason: rejectionReason,
            allowResubmit: true
          })
        }
      );

      if (response.ok) {
        onReject();
        onClose();
      } else {
        const error = await response.text();
        console.error('❌ Failed to reject:', error);
        alert('Failed to reject application');
      }
    } catch (error) {
      console.error('Error rejecting:', error);
      alert('Error rejecting application');
    } finally {
      setRejecting(false);
    }
  };

  const handleRequestClarification = async () => {
    try {
      setRequesting(true);
      const response = await fetch(
        `${getApiBaseUrl()}/admin/vendor/application/${appId}/request-clarification`,
        {
          method: 'POST',
          headers: {
            ...getAuthHeaders(),
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            reviewerName: 'Admin',
            notes: 'Please provide additional information'
          })
        }
      );

      if (response.ok) {
        onRequestClarification?.();
        onClose();
      }
    } catch (error) {
      console.error('Error requesting clarification:', error);
    } finally {
      setRequesting(false);
    }
  };

  const handleRequestDocumentReupload = async () => {
    try {
      setRequesting(true);
      const response = await fetch(
        `${getApiBaseUrl()}/admin/vendor/application/${appId}/request-document-reupload`,
        {
          method: 'POST',
          headers: {
            ...getAuthHeaders(),
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            reviewerName: 'Admin',
            notes: 'Please upload the missing or invalid documents'
          })
        }
      );

      if (response.ok) {
        alert('✅ Document re-upload request sent successfully!\n\nThe vendor will be notified to re-upload documents.');
        onClose();
      } else {
        alert('❌ Failed to send document re-upload request');
      }
    } catch (error) {
      console.error('Error requesting document re-upload:', error);
      alert('❌ Error occurred while requesting document re-upload');
    } finally {
      setRequesting(false);
    }
  };

  // Map vendor type to readable name
  const getVendorTypeName = (type: string) => {
    if (!type) return 'Not Specified';
    const typeMap: Record<string, string> = {
      'walking': 'Pet Walking',
      'grooming': 'Pet Grooming',
      'boarding': 'Boarding',
      'training': 'Pet Training',
      'cafes': 'Pet Cafes',
      'adoption': 'Adoption',
      'sunset': 'Sunset Services',
      'events': 'Events',
      'insurance': 'Pet Insurance',
      'mating': 'Mating & Dating',
      'vet': 'Veterinary'
    };
    return typeMap[type] || type.charAt(0).toUpperCase() + type.slice(1);
  };

  const getServiceStyleName = (style: string) => {
    if (!style) return 'Not Specified';
    const styleMap: Record<string, string> = {
      'at_home': 'At Customer\'s Home',
      'at_center': 'At Center/Clinic',
      'both': 'Both Locations',
      'home': 'At Customer\'s Home',
      'clinic': 'At Center/Clinic'
    };
    return styleMap[style] || style;
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h2 className="text-xl">Application Details</h2>
            <p className="text-sm text-gray-500">Review vendor application</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="px-6 border-b border-gray-200 flex gap-4">
          <button
            onClick={() => setActiveTab('details')}
            className={`px-4 py-3 text-sm border-b-2 transition-colors ${
              activeTab === 'details'
                ? 'border-[#FF8C42] text-[#FF8C42]'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            Vendor Details
          </button>
          <button
            onClick={() => setActiveTab('documents')}
            className={`px-4 py-3 text-sm border-b-2 transition-colors ${
              activeTab === 'documents'
                ? 'border-[#FF8C42] text-[#FF8C42]'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            Documents & Certificates
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'details' && (
            <div className="space-y-6">
              {/* Basic Info */}
              <div className="bg-gray-50 rounded-xl p-6">
                <h3 className="text-base mb-4">Basic Information</h3>
                <div className="grid grid-cols-2 gap-4">
                  <InfoRow label="Full Name" value={application.fullName} />
                  <InfoRow label="Business Name" value={application.businessName || 'N/A'} />
                  <InfoRow label="Phone" value={application.phone} />
                  <InfoRow label="Email" value={application.email} />
                  <InfoRow label="Service Category" value={application.serviceCategory || application.category || application.roleName || 'N/A'} />
                  <InfoRow label="Vendor Type" value={getVendorTypeName(application.vendorType)} />
                </div>
              </div>

              {/* Address Info */}
              <div className="bg-gray-50 rounded-xl p-6">
                <h3 className="text-base mb-4">Address Information</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <InfoRow label="Full Address" value={application.address} />
                  </div>
                  <InfoRow label="City" value={application.city} />
                  <InfoRow label="State" value={application.state} />
                  <InfoRow label="Pincode" value={application.pincode} />
                </div>
              </div>

              {/* Business Info */}
              <div className="bg-gray-50 rounded-xl p-6">
                <h3 className="text-base mb-4">Business Information</h3>
                <div className="grid grid-cols-2 gap-4">
                  <InfoRow label="GST Number" value={application.gstNumber || 'Not provided'} />
                  <InfoRow label="PAN Number" value={application.panNumber || 'Not provided'} />
                  <InfoRow label="License Number" value={application.licenseNumber || 'Not provided'} />
                  <InfoRow label="License Expiry" value={application.licenseExpiryDate || 'Not provided'} />
                </div>
              </div>

              {/* Timeline */}
              <div className="bg-gray-50 rounded-xl p-6">
                <h3 className="text-base mb-4">Application Timeline</h3>
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <div className="flex-1">
                      <div className="text-sm">Application Submitted</div>
                      <div className="text-xs text-gray-500">
                        {new Date(application.submittedAt).toLocaleString()}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'documents' && (
            <div>
              {application.documents && application.documents.length > 0 ? (
                <div className="space-y-4">
                  {application.documents.map((doc: any, index: number) => (
                    <div key={index} className="bg-gray-50 border border-gray-200 rounded-xl p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <h4 className="font-medium text-gray-900 mb-1">{doc.name}</h4>
                          <div className="flex items-center gap-2 text-xs text-gray-500">
                            <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded">{doc.category}</span>
                            <span>{doc.type}</span>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          {doc.preview && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => window.open(doc.preview, '_blank')}
                              className="h-8"
                            >
                              <Eye className="w-4 h-4 mr-1" />
                              View
                            </Button>
                          )}
                          {doc.preview && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                const link = document.createElement('a');
                                link.href = doc.preview;
                                link.download = `${doc.name}.${doc.fileType?.split('/')[1] || 'jpg'}`;
                                document.body.appendChild(link);
                                link.click();
                                document.body.removeChild(link);
                              }}
                              className="h-8"
                            >
                              <Download className="w-4 h-4 mr-1" />
                              Download
                            </Button>
                          )}
                        </div>
                      </div>
                      {doc.preview && (
                        <div className="mt-3">
                          <img
                            src={doc.preview}
                            alt={doc.name}
                            className="w-full h-48 object-contain bg-white border border-gray-200 rounded-lg"
                          />
                        </div>
                      )}
                      {doc.fileName && (
                        <div className="mt-2 text-xs text-gray-500">
                          <span className="font-medium">File:</span> {doc.fileName}
                          {doc.fileSize && <span className="ml-2">({(doc.fileSize / 1024).toFixed(1)} KB)</span>}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 bg-gray-50 rounded-xl border-2 border-dashed border-gray-300">
                  <FileText className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                  <p className="text-gray-600 mb-6">No documents uploaded</p>
                  <Button
                    onClick={handleRequestDocumentReupload}
                    disabled={requesting}
                    className="bg-orange-500 hover:bg-orange-600 text-white"
                  >
                    {requesting ? 'Requesting...' : 'Request Document Re-upload'}
                  </Button>
                </div>
              )}
              
              {/* Show re-upload button even if some documents exist but seem incomplete */}
              {application.documents && application.documents.length > 0 && application.documents.length < 4 && (
                <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-xl">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                      <p className="text-sm text-yellow-800 mb-3">
                        Some documents may be missing. Expected documents: Aadhar (Front & Back), PAN Card, Cancelled Cheque, and additional documents based on vendor type.
                      </p>
                      <Button
                        size="sm"
                        onClick={handleRequestDocumentReupload}
                        disabled={requesting}
                        className="bg-orange-500 hover:bg-orange-600 text-white"
                      >
                        {requesting ? 'Requesting...' : 'Request Document Re-upload'}
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
          {/* Show different actions based on current status */}
          {application.status === 'pending_approval' || application.status === 'pending_reverification' ? (
            <>
              <div className="flex items-center gap-3">
                <Button
                  onClick={handleApprove}
                  disabled={approving}
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                >
                  <Check className="w-4 h-4 mr-2" />
                  {approving ? 'Approving...' : 'Approve Application'}
                </Button>
                
                <Button
                  onClick={() => setClarifying(!clarifying)}
                  variant="outline"
                  className="flex-1"
                >
                  <AlertCircle className="w-4 h-4 mr-2" />
                  Request Clarification
                </Button>
                
                <Button
                  onClick={() => setRejecting(!rejecting)}
                  variant="outline"
                  className="flex-1 border-red-200 text-red-600 hover:bg-red-50"
                >
                  <X className="w-4 h-4 mr-2" />
                  Reject Application
                </Button>
              </div>

              {/* Rejection Form */}
              {rejecting && (
                <div className="mt-4 bg-white border border-red-200 rounded-lg p-4">
                  <label className="text-sm text-gray-700 mb-2 block">Rejection Reason</label>
                  <textarea
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm mb-3"
                    rows={3}
                    placeholder="Provide reason for rejection..."
                  />
                  <div className="flex gap-2">
                    <Button
                      onClick={handleReject}
                      disabled={!rejectionReason.trim()}
                      className="bg-red-600 hover:bg-red-700 text-white"
                    >
                      Confirm Rejection
                    </Button>
                    <Button
                      onClick={() => {
                        setRejecting(false);
                        setRejectionReason('');
                      }}
                      variant="outline"
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )}

              {/* Clarification Form */}
              {clarifying && (
                <div className="mt-4 bg-white border border-orange-200 rounded-lg p-4">
                  <label className="text-sm text-gray-700 mb-2 block">Clarification Notes</label>
                  <textarea
                    value={clarificationNotes}
                    onChange={(e) => setClarificationNotes(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm mb-3"
                    rows={3}
                    placeholder="What information do you need from the vendor?"
                  />
                  <div className="flex gap-2">
                    <Button
                      onClick={handleRequestClarification}
                      disabled={!clarificationNotes.trim()}
                      className="bg-orange-600 hover:bg-orange-700 text-white"
                    >
                      Send Clarification Request
                    </Button>
                    <Button
                      onClick={() => {
                        setClarifying(false);
                        setClarificationNotes('');
                      }}
                      variant="outline"
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </>
          ) : application.status === 'approved' ? (
            <div className="text-center py-3">
              <div className="inline-flex items-center gap-2 text-green-600 bg-green-50 px-4 py-2 rounded-lg">
                <CheckCircle className="w-5 h-5" />
                <span className="font-medium">This application has been approved</span>
              </div>
            </div>
          ) : application.status === 'rejected' ? (
            <div className="text-center py-3">
              <div className="inline-flex items-center gap-2 text-red-600 bg-red-50 px-4 py-2 rounded-lg">
                <XCircle className="w-5 h-5" />
                <span className="font-medium">This application has been rejected</span>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-gray-500 mb-1">{label}</div>
      <div className="text-sm">{value || 'N/A'}</div>
    </div>
  );
}