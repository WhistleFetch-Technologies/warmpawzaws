'use client';

/**
 * ============================================================================
 * PENDING REPORTS PANEL COMPONENT
 * ============================================================================
 * 
 * Shows vets their pending diagnostic reports that need review
 * - Badge notification on dashboard
 * - Quick access to review reports
 * - Update prescriptions from results
 * 
 * Date: 2026-01-20
 * ============================================================================
 */

import React, { useState, useEffect } from 'react';
import { 
  FileText, AlertCircle, ChevronRight, Loader2, 
  ClipboardCheck, Eye, ExternalLink, User
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { apiClient } from '@/lib/api-client';
import { VetReportReview } from '../diagnostics/VetReportReview';

interface PendingReport {
  id: string;
  bookingId: string;
  originalBookingId?: string;
  testName: string;
  reportType: string;
  reportUrl: string;
  summary?: string;
  status: string;
  diagnosticsVendorName: string;
  customerName: string;
  petName: string;
  petType: string;
  createdAt: string;
}

interface PendingReportsPanelProps {
  vetId: string;
  onReportReviewed?: () => void;
}

export function PendingReportsPanel({
  vetId,
  onReportReviewed,
}: PendingReportsPanelProps) {
  const [loading, setLoading] = useState(true);
  const [reports, setReports] = useState<PendingReport[]>([]);
  const [selectedReport, setSelectedReport] = useState<PendingReport | null>(null);
  const [showReviewModal, setShowReviewModal] = useState(false);

  useEffect(() => {
    fetchPendingReports();
  }, [vetId]);

  const fetchPendingReports = async () => {
    setLoading(true);
    try {
      const res = await apiClient.get<any>(`/diagnostics/reports/vet/${vetId}/pending`);
      if (res.success) {
        setReports(res.reports || []);
      }
    } catch (error) {
      console.error('Error fetching pending reports:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleReviewClick = (report: PendingReport) => {
    setSelectedReport(report);
    setShowReviewModal(true);
  };

  const handleReviewComplete = () => {
    setShowReviewModal(false);
    setSelectedReport(null);
    fetchPendingReports();
    onReportReviewed?.();
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
    
    if (diffHours < 1) return 'Just now';
    if (diffHours < 24) return `${diffHours}h ago`;
    return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  };

  const getReportTypeIcon = (type: string) => {
    switch (type) {
      case 'lab': return '🧪';
      case 'imaging': return '📷';
      case 'pathology': return '🔬';
      default: return '📋';
    }
  };

  if (loading) {
    return (
      <Card className="p-4">
        <div className="flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-[#FF8C42]" />
        </div>
      </Card>
    );
  }

  if (reports.length === 0) {
    return null; // Don't show panel if no pending reports
  }

  return (
    <>
      <Card className="border-orange-200 bg-orange-50 overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-orange-500 to-amber-500 px-4 py-3">
          <div className="flex items-center justify-between text-white">
            <div className="flex items-center gap-2">
              <ClipboardCheck className="w-5 h-5" />
              <span className="font-semibold">Pending Reports</span>
            </div>
            <Badge className="bg-white text-orange-600">
              {reports.length} to review
            </Badge>
          </div>
        </div>

        {/* Reports List */}
        <div className="divide-y divide-orange-100">
          {reports.slice(0, 3).map((report) => (
            <div
              key={report.id}
              className="p-4 hover:bg-orange-100/50 transition cursor-pointer"
              onClick={() => handleReviewClick(report)}
            >
              <div className="flex items-start gap-3">
                {/* Icon */}
                <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center text-xl shadow-sm">
                  {getReportTypeIcon(report.reportType)}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h4 className="font-semibold text-gray-900 truncate">
                      {report.testName}
                    </h4>
                    <span className="text-xs text-gray-500">
                      {formatDate(report.createdAt)}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600">
                    <User className="w-3 h-3 inline mr-1" />
                    {report.petName} • {report.customerName}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    From: {report.diagnosticsVendorName}
                  </p>
                </div>

                {/* Action */}
                <Button
                  size="sm"
                  className="bg-[#FF8C42] hover:bg-[#E67A35]"
                >
                  <Eye className="w-4 h-4 mr-1" />
                  Review
                </Button>
              </div>
            </div>
          ))}
        </div>

        {/* View All */}
        {reports.length > 3 && (
          <div className="px-4 py-3 bg-orange-100/50 text-center">
            <button
              onClick={() => {
                setSelectedReport(reports[0]);
                setShowReviewModal(true);
              }}
              className="text-sm text-orange-600 font-medium hover:underline flex items-center justify-center gap-1"
            >
              View all {reports.length} pending reports
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </Card>

      {/* Review Modal */}
      {showReviewModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="p-4">
              <VetReportReview
                vetId={vetId}
                report={selectedReport || undefined}
                onSuccess={handleReviewComplete}
                onCancel={() => setShowReviewModal(false)}
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default PendingReportsPanel;
