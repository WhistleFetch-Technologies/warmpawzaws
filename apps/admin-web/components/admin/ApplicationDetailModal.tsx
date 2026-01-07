'use client';

import { useState } from 'react';
import { X, Check, AlertCircle, FileText, Image as ImageIcon, Download, Eye, CheckCircle, XCircle } from 'lucide-react';
import { Button, Badge } from '@warmpawz/ui';
import { apiClient } from '@/lib/api-client';

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

  if (!isOpen || !application) return null;

  const appId = application.applicationId || application.id;
  const customFields = application.customFields || application.formData || {};

  const handleApprove = async () => {
    try {
      setApproving(true);
      await apiClient.post(`/admin/vendor/application/${appId}/approve`, {
        reviewerName: 'Admin',
        notes: 'Approved after review'
      });
      alert('Application approved successfully');
      onApprove();
      onClose();
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
      await apiClient.post(`/admin/vendor/application/${appId}/reject`, {
        reviewerName: 'Admin',
        reason: rejectionReason,
        allowResubmit: true
      });
      alert('Application rejected');
      onReject();
      onClose();
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
      await apiClient.post(`/admin/vendor/application/${appId}/request-clarification`, {
        reviewerName: 'Admin',
        notes: clarificationNotes || 'Please provide additional information'
      });
      alert('Clarification request sent');
      onRequestClarification();
      onClose();
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
              <div className="bg-gray-50 rounded-xl p-0">
                <h3 className="text-base mb-4">Basic Information</h3>
                <div className="grid grid-cols-2 gap-4">
                  <InfoRow label="Full Name" value={application.fullName} />
                  <InfoRow label="Business Name" value={application.businessName || 'N/A'} />
                  <InfoRow label="Phone" value={application.phone} />
                  <InfoRow label="Email" value={application.email} />
                  <InfoRow label="Service Category" value={application.serviceCategory || application.category || 'N/A'} />
                  <InfoRow label="Vendor Type" value={getVendorTypeName(application.vendorType)} />
                </div>
              </div>

              {/* Address Info */}
              <div className="bg-gray-50 rounded-xl p-0">
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
              <div className="bg-gray-50 rounded-xl p-0">
                <h3 className="text-base mb-4">Business Information</h3>
                <div className="grid grid-cols-2 gap-4">
                  <InfoRow label="Application ID" value={appId} />
                  <InfoRow label="GST Number" value={customFields.gstNumber || application.gstNumber || 'Not provided'} />
                  <InfoRow label="PAN Number" value={customFields.panNumber || application.panNumber || 'Not provided'} />
                  <InfoRow label="License Number" value={customFields.licenseNumber || application.licenseNumber || 'Not provided'} />
                </div>
              </div>
            </div>
          )}

          {activeTab === 'documents' && (
            <div className="space-y-4">
              <p className="text-sm text-gray-600">Documents will be displayed here</p>
              {/* Document viewing logic can be added here */}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-0 py-4 border-t border-gray-200 flex items-center justify-between">
          <div className="flex gap-0">
            <Button
              variant="outline"
              onClick={handleRequestClarification}
              disabled={clarifying}
            >
              <AlertCircle className="w-4 h-4 mr-0" />
              Request Info
            </Button>
          </div>
          
          <div className="flex gap-0">
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
              <XCircle className="w-4 h-4 mr-0" />
              Reject
            </Button>
            <Button
              onClick={handleApprove}
              disabled={rejecting || approving || clarifying}
              className="bg-green-600 hover:bg-green-700"
            >
              <CheckCircle className="w-4 h-4 mr-0" />
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
      <div className="text-xs text-gray-500 mb-0">{label}</div>
      <div className="text-sm text-gray-900">{value || 'N/A'}</div>
    </div>
  );
}

