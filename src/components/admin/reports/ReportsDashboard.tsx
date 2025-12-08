import { useState, useEffect } from 'react';
import { Card } from '../../ui/card';
import { Button } from '../../ui/button';
import { Badge } from '../../ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../ui/table';
import { ArrowLeft, Download, FileText, Plus, Calendar, Share2, Eye } from 'lucide-react';
import { projectId, publicAnonKey } from '../../../utils/supabase/info';

interface ReportsDashboardProps {
  onBack: () => void;
}

export function ReportsDashboard({ onBack }: ReportsDashboardProps) {
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475`;

  useEffect(() => {
    loadReports();
  }, []);

  const loadReports = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/admin/reports`, {
        headers: {
          'Authorization': `Bearer ${publicAnonKey}`
        }
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          setReports(result.reports);
        }
      }
    } catch (error) {
      console.error('Error loading reports:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateReport = async (reportId: string) => {
    try {
      const response = await fetch(`${API_BASE}/admin/reports/${reportId}/generate`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${publicAnonKey}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const result = await response.json();
        console.log('Report generated:', result);
      }
    } catch (error) {
      console.error('Error generating report:', error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FF8C42] mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading reports...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="sm" onClick={onBack}>
                <ArrowLeft className="w-4 h-4" />
              </Button>
              <div>
                <h1 className="text-xl font-semibold">Reports & Analytics</h1>
                <p className="text-sm text-gray-500">Generate and manage custom reports</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Button className="bg-[#FF8C42] hover:bg-[#ff7a28]">
                <Plus className="w-4 h-4 mr-2" />
                Create Report
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="bg-blue-500 text-white p-3 rounded-lg">
                <FileText className="w-5 h-5" />
              </div>
            </div>
            <h3 className="text-2xl font-bold mb-1">{reports.length}</h3>
            <p className="text-sm text-gray-500">Total Reports</p>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="bg-green-500 text-white p-3 rounded-lg">
                <Calendar className="w-5 h-5" />
              </div>
            </div>
            <h3 className="text-2xl font-bold mb-1">
              {reports.filter(r => r.schedule?.enabled).length}
            </h3>
            <p className="text-sm text-gray-500">Scheduled Reports</p>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="bg-[#FF8C42] text-white p-3 rounded-lg">
                <Download className="w-5 h-5" />
              </div>
            </div>
            <h3 className="text-2xl font-bold mb-1">
              {reports.reduce((sum, r) => sum + (r.generationCount || 0), 0)}
            </h3>
            <p className="text-sm text-gray-500">Total Generations</p>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="bg-purple-500 text-white p-3 rounded-lg">
                <Share2 className="w-5 h-5" />
              </div>
            </div>
            <h3 className="text-2xl font-bold mb-1">5</h3>
            <p className="text-sm text-gray-500">Shared Reports</p>
          </Card>
        </div>

        {/* Reports Table */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Saved Reports</h2>
          </div>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Report Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Date Range</TableHead>
                  <TableHead>Format</TableHead>
                  <TableHead>Last Generated</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reports.map((report) => (
                  <TableRow key={report.id}>
                    <TableCell className="font-medium">{report.name}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize">{report.type}</Badge>
                    </TableCell>
                    <TableCell>{report.dateRange}</TableCell>
                    <TableCell>
                      <Badge>{report.format.toUpperCase()}</Badge>
                    </TableCell>
                    <TableCell className="text-sm text-gray-500">
                      {report.lastGenerated 
                        ? new Date(report.lastGenerated).toLocaleDateString()
                        : 'Never'}
                    </TableCell>
                    <TableCell>
                      <Badge className={report.schedule?.enabled ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}>
                        {report.schedule?.enabled ? 'Scheduled' : 'Manual'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button variant="ghost" size="sm" onClick={() => generateReport(report.id)}>
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="sm">
                          <Download className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="sm">
                          <Share2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {reports.length === 0 && (
            <div className="text-center py-12">
              <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">No reports created yet</p>
              <p className="text-sm text-gray-400 mt-2">Create your first report to get started</p>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
