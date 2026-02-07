'use client';

export const dynamic = 'force-dynamic';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api-client';
import { ArrowLeft, FileText, Download, Calendar, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

interface Report {
  id: string;
  name: string;
  reportType: string;
  dateRange: string;
  created_at: string;
}

export default function ReportsPage() {
  const router = useRouter();
  const [vendorId, setVendorId] = useState<string | null>(null);
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [showGenerateForm, setShowGenerateForm] = useState(false);
  const [reportConfig, setReportConfig] = useState({
    reportType: 'revenue',
    dateRange: '30d',
    startDate: '',
    endDate: '',
  });

  useEffect(() => {
    const storedVendorId = localStorage.getItem('vendorId');
    if (!storedVendorId) {
      router.push('/onboarding');
      return;
    }
    setVendorId(storedVendorId);
    loadReports();
  }, [router]);

  const loadReports = async () => {
    try {
      setLoading(true);
      // Note: Vendor-specific reports endpoint may need to be added
      // For now, using admin reports endpoint with vendorId filter
      const response = await apiClient.get<any>('/admin/reports');
      setReports(response.reports || []);
    } catch (err: any) {
      console.error('Error loading reports:', err);
      // Don't show error if endpoint doesn't exist yet
      setReports([]);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateReport = async () => {
    if (!vendorId) return;
    try {
      setGenerating(true);
      const response = await apiClient.post('/admin/reports/generate', {
        ...reportConfig,
        vendorId, // Include vendorId for vendor-specific reports
      });
      
      toast.success('Report generated successfully');
      setShowGenerateForm(false);
      // Optionally save the report
      loadReports();
    } catch (err: any) {
      console.error('Error generating report:', err);
      toast.error(err.message || 'Failed to generate report');
    } finally {
      setGenerating(false);
    }
  };

  const handleExport = async (reportId: string, format: 'csv' | 'pdf') => {
    try {
      const report = reports.find(r => r.id === reportId);
      if (!report) {
        toast.error('Report not found');
        return;
      }

      // Fetch report data
      const response = await apiClient.get<any>(`/vendor/${vendorId}/reports/${reportId}/data`);
      const data = response.data || [];

      if (format === 'csv') {
        // Generate CSV
        const headers = Object.keys(data[0] || {});
        const csvContent = [
          headers.join(','),
          ...data.map((row: any) => headers.map(h => row[h]).join(','))
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${report.name.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        toast.success('Report exported successfully!');
      } else {
        // For PDF, open in new window for print
        const printWindow = window.open('', '_blank');
        if (printWindow) {
          printWindow.document.write(`
            <html>
              <head><title>${report.name}</title></head>
              <body>
                <h1>${report.name}</h1>
                <p>Generated: ${new Date(report.created_at).toLocaleDateString()}</p>
                <table border="1" cellpadding="8">
                  <thead><tr>${Object.keys(data[0] || {}).map(h => `<th>${h}</th>`).join('')}</tr></thead>
                  <tbody>${data.map((row: any) => `<tr>${Object.values(row).map(v => `<td>${v}</td>`).join('')}</tr>`).join('')}</tbody>
                </table>
              </body>
            </html>
          `);
          printWindow.document.close();
          printWindow.print();
          toast.success('Report ready for printing!');
        }
      }
    } catch (err: any) {
      console.error('Error exporting report:', err);
      toast.error('Failed to export report');
    }
  };

  const reportTypes = [
    { value: 'revenue', label: 'Revenue Report', description: 'Revenue breakdown by date' },
    { value: 'bookings', label: 'Bookings Report', description: 'Booking statistics and trends' },
    { value: 'settlements', label: 'Settlements Report', description: 'Settlement and payout details' },
    { value: 'payments', label: 'Payments Report', description: 'Payment method breakdown' },
  ];

  const dateRanges = [
    { value: '7d', label: 'Last 7 Days' },
    { value: '30d', label: 'Last 30 Days' },
    { value: '90d', label: 'Last 90 Days' },
    { value: '1y', label: 'Last Year' },
    { value: 'custom', label: 'Custom Range' },
  ];

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-50 to-amber-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-amber-50">
      {/* Header */}
      <div className="bg-white/80 backdrop-blur-sm border-b border-orange-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => router.back()}
                className="rounded-full"
              >
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <div>
                <h1 className="text-2xl font-bold text-gray-800">Reports</h1>
                <p className="text-sm text-gray-500 mt-1">Generate and view business reports</p>
              </div>
            </div>
            <Button
              onClick={() => setShowGenerateForm(true)}
              className="bg-orange-500 hover:bg-orange-600 text-white"
            >
              <FileText className="w-4 h-4 mr-2" />
              Generate Report
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Saved Reports */}
        {reports.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-sm p-12 text-center">
            <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No reports found</h3>
            <p className="text-gray-500 mb-6">
              Generate your first report to get started
            </p>
            <Button
              onClick={() => setShowGenerateForm(true)}
              className="bg-orange-500 hover:bg-orange-600 text-white"
            >
              Generate Report
            </Button>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {reports.map((report) => (
              <div
                key={report.id}
                className="bg-white rounded-2xl shadow-sm p-6 hover:shadow-md transition"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                      <FileText className="w-6 h-6 text-blue-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">{report.name}</h3>
                      <p className="text-sm text-gray-500">
                        {new Date(report.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="mb-4">
                  <Badge className="bg-orange-100 text-orange-700">
                    {report.reportType}
                  </Badge>
                </div>

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleExport(report.id, 'csv')}
                    className="flex-1"
                  >
                    <Download className="w-4 h-4 mr-1" />
                    CSV
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleExport(report.id, 'pdf')}
                    className="flex-1"
                  >
                    <Download className="w-4 h-4 mr-1" />
                    PDF
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Generate Report Modal */}
        {showGenerateForm && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl p-6 w-full max-w-2xl">
              <h2 className="text-xl font-semibold mb-6">Generate Report</h2>
              <div className="space-y-4">
                <div>
                  <Label>Report Type</Label>
                  <select
                    value={reportConfig.reportType}
                    onChange={(e) => setReportConfig({ ...reportConfig, reportType: e.target.value })}
                    className="w-full mt-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500"
                  >
                    {reportTypes.map((type) => (
                      <option key={type.value} value={type.value}>
                        {type.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label>Date Range</Label>
                  <select
                    value={reportConfig.dateRange}
                    onChange={(e) => setReportConfig({ ...reportConfig, dateRange: e.target.value })}
                    className="w-full mt-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500"
                  >
                    {dateRanges.map((range) => (
                      <option key={range.value} value={range.value}>
                        {range.label}
                      </option>
                    ))}
                  </select>
                </div>
                {reportConfig.dateRange === 'custom' && (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Start Date</Label>
                      <Input
                        type="date"
                        value={reportConfig.startDate}
                        onChange={(e) => setReportConfig({ ...reportConfig, startDate: e.target.value })}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label>End Date</Label>
                      <Input
                        type="date"
                        value={reportConfig.endDate}
                        onChange={(e) => setReportConfig({ ...reportConfig, endDate: e.target.value })}
                        className="mt-1"
                      />
                    </div>
                  </div>
                )}
              </div>
              <div className="flex gap-3 mt-6">
                <Button
                  variant="outline"
                  onClick={() => setShowGenerateForm(false)}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleGenerateReport}
                  disabled={generating}
                  className="flex-1 bg-orange-500 hover:bg-orange-600 text-white"
                >
                  {generating ? 'Generating...' : 'Generate Report'}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
