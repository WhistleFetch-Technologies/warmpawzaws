'use client';

/**
 * ============================================================================
 * DOCUMENT EXPIRY ALERTS COMPONENT
 * ============================================================================
 * 
 * Shows vendors their documents with expiry tracking
 * - Visual alerts for expiring/expired documents
 * - Quick renewal actions
 * - Upload new documents
 * 
 * Date: 2026-01-20
 * ============================================================================
 */

import React, { useState, useEffect } from 'react';
import { 
  FileText, AlertCircle, AlertTriangle, CheckCircle2, 
  Upload, Calendar, Clock, RefreshCw, X, Eye, Loader2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { apiClient } from '@/lib/api-client';
import { toast } from 'sonner';
import { TouchFilePicker } from '@/components/shared/TouchFilePicker';

interface VendorDocument {
  id: string;
  documentType: string;
  documentName: string;
  documentUrl: string;
  expiryDate: string | null;
  issuedDate?: string;
  issuingAuthority?: string;
  status: 'valid' | 'expiring_soon' | 'expired' | 'pending_review';
  daysUntilExpiry: number | null;
}

interface DocumentSummary {
  total: number;
  valid: number;
  expiringSoon: number;
  expired: number;
  needsAttention: number;
}

interface DocumentExpiryAlertsProps {
  vendorId: string;
  compact?: boolean;
  onNeedsAttention?: (count: number) => void;
}

const STATUS_CONFIG = {
  valid: {
    label: 'Valid',
    color: 'bg-green-100 text-green-700 border-green-200',
    icon: CheckCircle2,
    iconColor: 'text-green-500',
  },
  expiring_soon: {
    label: 'Expiring Soon',
    color: 'bg-yellow-100 text-yellow-700 border-yellow-200',
    icon: AlertTriangle,
    iconColor: 'text-yellow-500',
  },
  expired: {
    label: 'Expired',
    color: 'bg-red-100 text-red-700 border-red-200',
    icon: AlertCircle,
    iconColor: 'text-red-500',
  },
  pending_review: {
    label: 'Pending Review',
    color: 'bg-gray-100 text-gray-700 border-gray-200',
    icon: Clock,
    iconColor: 'text-gray-500',
  },
};

export function DocumentExpiryAlerts({
  vendorId,
  compact = false,
  onNeedsAttention,
}: DocumentExpiryAlertsProps) {
  const [loading, setLoading] = useState(true);
  const [documents, setDocuments] = useState<VendorDocument[]>([]);
  const [summary, setSummary] = useState<DocumentSummary | null>(null);
  const [showRenewModal, setShowRenewModal] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState<VendorDocument | null>(null);
  const [uploading, setUploading] = useState(false);
  const [newExpiryDate, setNewExpiryDate] = useState('');
  const [newDocumentFile, setNewDocumentFile] = useState<File | null>(null);

  useEffect(() => {
    fetchDocuments();
  }, [vendorId]);

  const fetchDocuments = async () => {
    setLoading(true);
    try {
      const res = await apiClient.get<any>(`/vendor/${vendorId}/documents/expiry`);
      if (res.success) {
        setDocuments(res.documents || []);
        setSummary(res.summary);
        onNeedsAttention?.(res.summary?.needsAttention || 0);
      }
    } catch (error) {
      console.error('Error fetching documents:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRenew = (doc: VendorDocument) => {
    setSelectedDocument(doc);
    setNewExpiryDate('');
    setNewDocumentFile(null);
    setShowRenewModal(true);
  };

  const handleSubmitRenewal = async () => {
    if (!selectedDocument) return;
    if (!newExpiryDate) {
      toast.error('Please enter the new expiry date');
      return;
    }

    setUploading(true);
    try {
      let newDocumentUrl = undefined;

      // Upload new document if provided
      if (newDocumentFile) {
        const formData = new FormData();
        formData.append('file', newDocumentFile);
        formData.append('vendorId', vendorId);
        formData.append('documentType', selectedDocument.documentType);

        // ✅ FIX: Use post method which handles FormData
        const uploadRes = await apiClient.post<any>('/storage/upload', formData);
        if (uploadRes.url) {
          newDocumentUrl = uploadRes.url;
        }
      }

      // Update document expiry
      const res = await apiClient.put<any>(`/vendor/documents/${selectedDocument.id}/expiry`, {
        expiryDate: newExpiryDate,
        newDocumentUrl,
      });

      if (res.success) {
        toast.success('Document renewed successfully!');
        setShowRenewModal(false);
        fetchDocuments();
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to renew document');
    } finally {
      setUploading(false);
    }
  };

  const formatExpiryText = (doc: VendorDocument) => {
    if (!doc.expiryDate) return 'No expiry';
    
    if (doc.daysUntilExpiry === null) return 'No expiry';
    if (doc.daysUntilExpiry < 0) {
      return `Expired ${Math.abs(doc.daysUntilExpiry)} days ago`;
    }
    if (doc.daysUntilExpiry === 0) return 'Expires today';
    if (doc.daysUntilExpiry === 1) return 'Expires tomorrow';
    return `Expires in ${doc.daysUntilExpiry} days`;
  };

  // Loading
  if (loading) {
    return (
      <Card className="p-4 flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-[#FF8C42]" />
      </Card>
    );
  }

  // No documents
  if (documents.length === 0) {
    return null;
  }

  // Compact mode - just show alert banner if there are issues
  if (compact && summary?.needsAttention === 0) {
    return null;
  }

  if (compact) {
    const urgentDocs = documents.filter(d => d.status === 'expired' || d.status === 'expiring_soon');
    if (urgentDocs.length === 0) return null;

    return (
      <div className={`rounded-xl p-4 ${summary?.expired && summary.expired > 0 ? 'bg-red-50 border border-red-200' : 'bg-yellow-50 border border-yellow-200'}`}>
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${summary?.expired && summary.expired > 0 ? 'bg-red-100' : 'bg-yellow-100'}`}>
            {summary?.expired && summary.expired > 0 ? (
              <AlertCircle className="w-5 h-5 text-red-500" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-yellow-500" />
            )}
          </div>
          <div className="flex-1">
            <p className={`font-semibold ${summary?.expired && summary.expired > 0 ? 'text-red-900' : 'text-yellow-900'}`}>
              {summary?.expired && summary.expired > 0 
                ? `${summary.expired} Document${summary.expired > 1 ? 's' : ''} Expired`
                : `${summary?.expiringSoon} Document${summary?.expiringSoon !== 1 ? 's' : ''} Expiring Soon`}
            </p>
            <p className={`text-sm ${summary?.expired && summary.expired > 0 ? 'text-red-700' : 'text-yellow-700'}`}>
              Update your documents to continue providing services
            </p>
          </div>
          <Button
            size="sm"
            className="bg-white hover:bg-gray-50 text-gray-900 border border-gray-200"
            onClick={() => window.location.href = '/settings/documents'}
          >
            <RefreshCw className="w-4 h-4 mr-1" />
            Renew
          </Button>
        </div>
      </div>
    );
  }

  // Full view
  return (
    <div className="space-y-4">
      {/* Summary */}
      {summary && (
        <div className="grid grid-cols-4 gap-3">
          <Card className="p-3 text-center border-gray-200">
            <p className="text-2xl font-bold text-gray-900">{summary.total}</p>
            <p className="text-xs text-gray-500">Total</p>
          </Card>
          <Card className="p-3 text-center border-green-200 bg-green-50">
            <p className="text-2xl font-bold text-green-600">{summary.valid}</p>
            <p className="text-xs text-green-700">Valid</p>
          </Card>
          <Card className="p-3 text-center border-yellow-200 bg-yellow-50">
            <p className="text-2xl font-bold text-yellow-600">{summary.expiringSoon}</p>
            <p className="text-xs text-yellow-700">Expiring</p>
          </Card>
          <Card className="p-3 text-center border-red-200 bg-red-50">
            <p className="text-2xl font-bold text-red-600">{summary.expired}</p>
            <p className="text-xs text-red-700">Expired</p>
          </Card>
        </div>
      )}

      {/* Documents List */}
      <div className="space-y-3">
        {documents.map((doc) => {
          const config = STATUS_CONFIG[doc.status];
          const IconComponent = config.icon;

          return (
            <Card key={doc.id} className={`p-4 border ${config.color.split(' ')[0]}`}>
              <div className="flex items-start gap-4">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${config.color.split(' ')[0]}`}>
                  <FileText className={`w-6 h-6 ${config.iconColor}`} />
                </div>

                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h4 className="font-semibold text-gray-900">{doc.documentName}</h4>
                    <Badge className={config.color}>
                      <IconComponent className="w-3 h-3 mr-1" />
                      {config.label}
                    </Badge>
                  </div>
                  <p className="text-sm text-gray-500">{doc.documentType}</p>
                  
                  {doc.expiryDate && (
                    <p className={`text-sm mt-1 flex items-center gap-1 ${
                      doc.status === 'expired' ? 'text-red-600' :
                      doc.status === 'expiring_soon' ? 'text-yellow-600' : 'text-gray-600'
                    }`}>
                      <Calendar className="w-3 h-3" />
                      {formatExpiryText(doc)}
                      <span className="text-gray-400 mx-1">•</span>
                      {new Date(doc.expiryDate).toLocaleDateString('en-IN', {
                        day: 'numeric', month: 'short', year: 'numeric'
                      })}
                    </p>
                  )}
                </div>

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => window.open(doc.documentUrl, '_blank')}
                  >
                    <Eye className="w-4 h-4" />
                  </Button>
                  {(doc.status === 'expired' || doc.status === 'expiring_soon') && (
                    <Button
                      size="sm"
                      className="bg-[#FF8C42] hover:bg-[#E67A35]"
                      onClick={() => handleRenew(doc)}
                    >
                      <RefreshCw className="w-4 h-4 mr-1" />
                      Renew
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Renew Modal */}
      {showRenewModal && selectedDocument && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <Card className="bg-white rounded-2xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900">Renew Document</h3>
              <button onClick={() => setShowRenewModal(false)}>
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="font-medium text-gray-900">{selectedDocument.documentName}</p>
                <p className="text-sm text-gray-500">{selectedDocument.documentType}</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  New Expiry Date *
                </label>
                <input
                  type="date"
                  value={newExpiryDate}
                  onChange={(e) => setNewExpiryDate(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:border-[#FF8C42] outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Upload New Document (Optional)
                </label>
                <TouchFilePicker
                  onFileChange={(e) => {
                    setNewDocumentFile(e.target.files?.[0] || null);
                  }}
                  accept=".pdf,.jpg,.jpeg,.png"
                  className="block w-full min-h-[5rem] overflow-hidden rounded-xl"
                  innerClassName="flex w-full min-h-[5rem] items-center justify-center p-0"
                >
                  <div
                    className={`w-full border-2 border-dashed rounded-xl p-4 text-center transition ${
                      newDocumentFile ? 'border-green-300 bg-green-50' : 'border-gray-300 hover:border-[#FF8C42]'
                    }`}
                  >
                    {newDocumentFile ? (
                      <div className="flex items-center justify-center gap-2 text-green-700">
                        <CheckCircle2 className="w-5 h-5" />
                        <span>{newDocumentFile.name}</span>
                      </div>
                    ) : (
                      <div className="text-gray-500">
                        <Upload className="w-6 h-6 mx-auto mb-1" />
                        <span className="text-sm">Click to upload</span>
                      </div>
                    )}
                  </div>
                </TouchFilePicker>
              </div>

              <div className="flex gap-3 pt-4">
                <Button
                  variant="outline"
                  onClick={() => setShowRenewModal(false)}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSubmitRenewal}
                  disabled={uploading || !newExpiryDate}
                  className="flex-1 bg-[#FF8C42] hover:bg-[#E67A35]"
                >
                  {uploading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2" />
                      Renew
                    </>
                  )}
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

export default DocumentExpiryAlerts;
