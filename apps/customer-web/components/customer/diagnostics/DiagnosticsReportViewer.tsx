'use client';

/**
 * Diagnostics Report Viewer
 * View, download, and share diagnostic lab reports
 */

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  ArrowLeft,
  Download,
  Share2,
  FileText,
  Calendar,
  Clock,
  Building2,
  TestTube,
  CheckCircle,
  AlertCircle,
  Eye,
  Printer,
  Send,
  X,
  ExternalLink,
  Stethoscope,
  Pill,
  Activity
} from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { toast } from 'sonner';

interface DiagnosticsReportViewerProps {
  bookingId: string;
  customerPhone: string;
  onBack: () => void;
  onShareWithVet?: (reportId: string, vetId: string) => void;
  /** Phase 3: Navigate to pharmacy, my-bookings, or vet dashboard for follow-on actions */
  onNavigate?: (screen: string, data?: any) => void;
}

interface Report {
  id: string;
  testName: string;
  testCode?: string;
  category: string;
  reportUrl: string;
  reportDate: string;
  status: 'pending' | 'processing' | 'completed';
  findings?: string;
  normalRange?: string;
  result?: string;
  isAbnormal?: boolean;
  labName?: string;
  reviewedBy?: string;
  reviewedAt?: string;
}

interface BookingDetails {
  id: string;
  bookingNumber: string;
  diagnosticCenter: {
    name: string;
    address: string;
  };
  scheduledDate: string;
  scheduledTime: string;
  status: string;
  tests: any[];
  reports: Report[];
  collectionType: 'home' | 'center';
}

export function DiagnosticsReportViewer({ 
  bookingId, 
  customerPhone, 
  onBack,
  onShareWithVet,
  onNavigate,
}: DiagnosticsReportViewerProps) {
  const [loading, setLoading] = useState(true);
  const [booking, setBooking] = useState<BookingDetails | null>(null);
  const [reports, setReports] = useState<Report[]>([]);
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareLoading, setShareLoading] = useState(false);
  const [vetAppointments, setVetAppointments] = useState<any[]>([]);

  useEffect(() => {
    loadReportData();
    loadVetAppointments();
  }, [bookingId]);

  const loadReportData = async () => {
    try {
      setLoading(true);
      
      // Fetch booking details with reports
      const [bookingRes, reportsRes] = await Promise.allSettled([
        apiClient.get<any>(`/bookings/${bookingId}`),
        apiClient.get<any>(`/diagnostics/reports/booking/${bookingId}`)
      ]);

      if (bookingRes.status === 'fulfilled' && bookingRes.value?.booking) {
        const bookingData = bookingRes.value.booking;
        setBooking({
          id: bookingData.id,
          bookingNumber: bookingData.booking_number || bookingData.id.slice(0, 8).toUpperCase(),
          diagnosticCenter: {
            name: bookingData.vendor_name || 'Diagnostic Center',
            address: bookingData.vendor_address || ''
          },
          scheduledDate: bookingData.booking_date,
          scheduledTime: bookingData.booking_time,
          status: bookingData.status,
          tests: JSON.parse(bookingData.notes || '{}').tests || [],
          reports: [],
          collectionType: bookingData.service_type === 'at_home' ? 'home' : 'center'
        });
      }

      if (reportsRes.status === 'fulfilled' && reportsRes.value?.reports) {
        setReports(reportsRes.value.reports.map((r: any) => ({
          id: r.id,
          testName: r.test_name,
          testCode: r.test_code,
          category: r.category || 'General',
          reportUrl: r.report_url,
          reportDate: r.created_at,
          status: r.status || 'completed',
          findings: r.findings,
          normalRange: r.normal_range,
          result: r.result_value,
          isAbnormal: r.is_abnormal,
          labName: r.lab_name,
          reviewedBy: r.reviewed_by,
          reviewedAt: r.reviewed_at
        })));
      } else {
        // Mock data for demo
        setReports([
          {
            id: 'report-1',
            testName: 'Complete Blood Count',
            testCode: 'CBC',
            category: 'Hematology',
            reportUrl: '/reports/cbc-report.pdf',
            reportDate: new Date().toISOString(),
            status: 'completed',
            findings: 'All values within normal range',
            normalRange: 'RBC: 5.5-8.5 M/uL',
            result: '7.2 M/uL',
            isAbnormal: false,
            labName: 'PetPath Diagnostics',
            reviewedBy: 'Dr. Priya Sharma',
            reviewedAt: new Date().toISOString()
          },
          {
            id: 'report-2',
            testName: 'Liver Function Test',
            testCode: 'LFT',
            category: 'Biochemistry',
            reportUrl: '/reports/lft-report.pdf',
            reportDate: new Date().toISOString(),
            status: 'completed',
            findings: 'Slightly elevated ALT levels',
            normalRange: 'ALT: 10-120 U/L',
            result: '145 U/L',
            isAbnormal: true,
            labName: 'PetPath Diagnostics',
            reviewedBy: 'Dr. Priya Sharma',
            reviewedAt: new Date().toISOString()
          }
        ]);
      }
    } catch (error) {
      console.error('Error loading report data:', error);
      toast.error('Failed to load reports');
    } finally {
      setLoading(false);
    }
  };

  const loadVetAppointments = async () => {
    try {
      const response = await apiClient.get<any>(`/customer/bookings?phone=${customerPhone}&category=vet&status=completed,in_progress`);
      if (response.bookings) {
        setVetAppointments(response.bookings.slice(0, 5));
      }
    } catch (error) {
      console.error('Error loading vet appointments:', error);
    }
  };

  const handleDownloadReport = async (report: Report) => {
    try {
      if (report.reportUrl) {
        // Open report URL in new tab for download
        window.open(report.reportUrl, '_blank');
        toast.success('Downloading report...');
      } else {
        toast.error('Report not available yet');
      }
    } catch (error) {
      toast.error('Failed to download report');
    }
  };

  const handlePrintReport = (report: Report) => {
    if (report.reportUrl) {
      const printWindow = window.open(report.reportUrl, '_blank');
      if (printWindow) {
        printWindow.onload = () => {
          printWindow.print();
        };
      }
    }
  };

  const handleShareReport = async (report: Report, vetAppointmentId: string) => {
    try {
      setShareLoading(true);
      
      await apiClient.post('/diagnostics/reports/share', {
        reportId: report.id,
        bookingId: vetAppointmentId,
        customerPhone
      });

      toast.success('Report shared with vet successfully!');
      setShowShareModal(false);
      setSelectedReport(null);
      
      if (onShareWithVet) {
        onShareWithVet(report.id, vetAppointmentId);
      }
    } catch (error) {
      console.error('Error sharing report:', error);
      toast.error('Failed to share report');
    } finally {
      setShareLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center max-w-md mx-auto">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 max-w-md mx-auto">
      {/* Header */}
      <div className="bg-gradient-to-r from-teal-600 via-teal-700 to-teal-800 text-white px-4 py-4">
        <div className="flex items-center gap-3">
          <button 
            onClick={onBack}
            className="p-2 hover:bg-white/10 rounded-full transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="font-semibold text-lg">Lab Reports</h1>
            {booking && (
              <p className="text-sm text-white/70">
                Booking #{booking.bookingNumber}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Booking Info Card */}
      {booking && (
        <div className="px-4 py-4">
          <Card className="p-4 bg-white border border-gray-100 shadow-sm">
            <div className="flex items-start gap-3">
              <div className="w-12 h-12 bg-teal-100 rounded-xl flex items-center justify-center flex-shrink-0">
                <Building2 className="w-6 h-6 text-teal-600" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold">{booking.diagnosticCenter.name}</h3>
                <p className="text-sm text-gray-500">{booking.diagnosticCenter.address}</p>
                <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    {formatDate(booking.scheduledDate)}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {booking.scheduledTime}
                  </span>
                </div>
              </div>
              <Badge 
                className={`${
                  booking.status === 'completed' 
                    ? 'bg-green-100 text-green-600' 
                    : 'bg-amber-100 text-amber-600'
                } border-none`}
              >
                {booking.status === 'completed' ? 'Completed' : 'In Progress'}
              </Badge>
            </div>
          </Card>
        </div>
      )}

      {/* Reports List */}
      <div className="px-4 pb-24">
        <h2 className="text-lg font-semibold mb-3">Test Reports</h2>
        
        {reports.length > 0 ? (
          <div className="space-y-3">
            {reports.map((report) => (
              <Card 
                key={report.id}
                className="bg-white border border-gray-100 shadow-sm overflow-hidden"
              >
                {/* Report Header */}
                <div className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                        report.isAbnormal 
                          ? 'bg-red-100' 
                          : 'bg-green-100'
                      }`}>
                        {report.status === 'completed' ? (
                          report.isAbnormal ? (
                            <AlertCircle className="w-5 h-5 text-red-600" />
                          ) : (
                            <CheckCircle className="w-5 h-5 text-green-600" />
                          )
                        ) : (
                          <TestTube className="w-5 h-5 text-teal-600" />
                        )}
                      </div>
                      <div>
                        <h3 className="font-semibold">{report.testName}</h3>
                        {report.testCode && (
                          <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                            {report.testCode}
                          </span>
                        )}
                        <p className="text-xs text-gray-500 mt-1">{report.category}</p>
                      </div>
                    </div>
                    <Badge 
                      className={`${
                        report.status === 'completed' 
                          ? report.isAbnormal 
                            ? 'bg-red-100 text-red-600' 
                            : 'bg-green-100 text-green-600'
                          : 'bg-amber-100 text-amber-600'
                      } border-none text-xs`}
                    >
                      {report.status === 'completed' 
                        ? report.isAbnormal ? 'Needs Attention' : 'Normal'
                        : 'Processing'}
                    </Badge>
                  </div>

                  {/* Result Details */}
                  {report.status === 'completed' && (
                    <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                      {report.result && (
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm text-gray-600">Result:</span>
                          <span className={`font-semibold ${
                            report.isAbnormal ? 'text-red-600' : 'text-green-600'
                          }`}>
                            {report.result}
                          </span>
                        </div>
                      )}
                      {report.normalRange && (
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm text-gray-600">Normal Range:</span>
                          <span className="text-sm text-gray-700">{report.normalRange}</span>
                        </div>
                      )}
                      {report.findings && (
                        <div className="mt-2 pt-2 border-t border-gray-200">
                          <span className="text-xs text-gray-500">Findings:</span>
                          <p className="text-sm text-gray-700 mt-1">{report.findings}</p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Report Meta */}
                  <div className="flex items-center gap-2 mt-3 text-xs text-gray-500">
                    <span>{formatDate(report.reportDate)}</span>
                    {report.reviewedBy && (
                      <>
                        <span>•</span>
                        <span>Reviewed by {report.reviewedBy}</span>
                      </>
                    )}
                  </div>
                </div>

                {/* Action Buttons */}
                {report.status === 'completed' && (
                  <div className="border-t border-gray-100 p-3 bg-gray-50 flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 h-9 text-xs"
                      onClick={() => handleDownloadReport(report)}
                    >
                      <Download className="w-4 h-4 mr-1" />
                      Download
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 h-9 text-xs"
                      onClick={() => handlePrintReport(report)}
                    >
                      <Printer className="w-4 h-4 mr-1" />
                      Print
                    </Button>
                    <Button
                      size="sm"
                      className="flex-1 h-9 text-xs bg-teal-600 text-white hover:bg-teal-700"
                      onClick={() => {
                        setSelectedReport(report);
                        setShowShareModal(true);
                      }}
                    >
                      <Share2 className="w-4 h-4 mr-1" />
                      Share
                    </Button>
                  </div>
                )}
              </Card>
            ))}
          </div>
        ) : (
          <Card className="p-8 text-center bg-white border border-gray-100">
            <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <h3 className="font-semibold text-gray-700 mb-1">No Reports Yet</h3>
            <p className="text-sm text-gray-500">
              Reports will appear here once your tests are processed
            </p>
          </Card>
        )}

        {/* Note */}
        <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-100">
          <p className="text-sm text-blue-700">
            <strong>Note:</strong> Reports are typically available within 24-48 hours after sample collection.
            You will be notified once your reports are ready.
          </p>
        </div>

        {/* Phase 3: Next steps – Order medicine, Book follow-up (physio) */}
        {onNavigate && (
          <div className="mt-6 p-4 bg-teal-50 rounded-xl border border-teal-100">
            <h3 className="font-semibold text-gray-900 mb-2">Next steps</h3>
            <p className="text-sm text-gray-600 mb-3">
              After your vet reviews the report, you can order medicine or book follow-up services.
            </p>
            <div className="space-y-2">
              <Button
                variant="outline"
                className="w-full justify-start border-teal-200 text-teal-700 hover:bg-teal-100"
                onClick={() => onNavigate('pharmacy_store')}
              >
                <Pill className="w-4 h-4 mr-2" />
                Order medicine online
              </Button>
              <Button
                variant="outline"
                className="w-full justify-start border-teal-200 text-teal-700 hover:bg-teal-100"
                onClick={() => onNavigate('my-bookings')}
              >
                <FileText className="w-4 h-4 mr-2" />
                View vet appointment & prescription
              </Button>
              <Button
                variant="outline"
                className="w-full justify-start border-teal-200 text-teal-700 hover:bg-teal-100"
                onClick={() => onNavigate('vet')}
              >
                <Activity className="w-4 h-4 mr-2" />
                Book follow-up (e.g. Physiotherapy)
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Share Modal */}
      {showShareModal && selectedReport && (
        <div className="fixed inset-0 bg-black/50 flex items-end justify-center z-50">
          <div className="bg-white w-full max-w-md rounded-t-2xl max-h-[70vh] overflow-y-auto">
            <div className="p-4 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white">
              <h3 className="font-semibold text-lg">Share Report with Vet</h3>
              <button 
                onClick={() => {
                  setShowShareModal(false);
                  setSelectedReport(null);
                }}
                className="p-2 hover:bg-gray-100 rounded-full"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-4">
              <p className="text-sm text-gray-600 mb-4">
                Select a vet appointment to share the <strong>{selectedReport.testName}</strong> report:
              </p>
              
              {vetAppointments.length > 0 ? (
                <div className="space-y-3">
                  {vetAppointments.map((apt) => (
                    <Card 
                      key={apt.id}
                      className="p-4 cursor-pointer hover:border-teal-300 transition-colors"
                      onClick={() => handleShareReport(selectedReport, apt.id)}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                          <Stethoscope className="w-5 h-5 text-blue-600" />
                        </div>
                        <div className="flex-1">
                          <h4 className="font-medium">{apt.vendor_name || 'Vet Consultation'}</h4>
                          <p className="text-xs text-gray-500">
                            {formatDate(apt.booking_date)} • {apt.booking_time}
                          </p>
                        </div>
                        <Send className="w-4 h-4 text-teal-600" />
                      </div>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6">
                  <Stethoscope className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                  <p className="text-sm text-gray-500">No recent vet appointments found</p>
                  <p className="text-xs text-gray-400 mt-1">
                    Book a vet consultation to share this report
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
