/**
 * Enterprise Report Builder
 * Custom report creation with advanced filtering, visualization, and export
 */

import { useState, useEffect } from 'react';
import { Card } from '../../ui/card';
import { Button } from '../../ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select';
import { 
  FileText, Filter, Download, Calendar, Plus, X, Play, 
  Save, Clock, BarChart3, PieChart as PieChartIcon, TrendingUp, Table,
  ArrowLeft, Mail, Share2
} from 'lucide-react';
import { getApiBaseUrl, getAuthHeaders } from '../../../utils/api-config';
import { 
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer 
} from 'recharts';

const API_BASE = getApiBaseUrl();

interface ReportConfig {
  id?: string;
  name: string;
  description: string;
  reportType: 'revenue' | 'bookings' | 'vendors' | 'customers' | 'custom';
  dateRange: string;
  groupBy: string;
  filters: ReportFilter[];
  metrics: string[];
  visualizationType: 'table' | 'bar' | 'line' | 'pie';
  schedule?: ScheduleConfig;
}

interface ReportFilter {
  field: string;
  operator: 'equals' | 'contains' | 'greater_than' | 'less_than' | 'between';
  value: any;
}

interface ScheduleConfig {
  enabled: boolean;
  frequency: 'daily' | 'weekly' | 'monthly';
  time: string;
  recipients: string[];
}

interface ReportBuilderProps {
  onBack: () => void;
}

const REPORT_TYPES = [
  { value: 'revenue', label: 'Revenue Analysis' },
  { value: 'bookings', label: 'Booking Performance' },
  { value: 'vendors', label: 'Vendor Analytics' },
  { value: 'customers', label: 'Customer Insights' },
  { value: 'custom', label: 'Custom Report' }
];

const METRICS = [
  { id: 'revenue', name: 'Revenue', category: 'financial' },
  { id: 'commission', name: 'Commission', category: 'financial' },
  { id: 'orders', name: 'Order Count', category: 'operational' },
  { id: 'customers', name: 'Customer Count', category: 'operational' },
  { id: 'vendors', name: 'Vendor Count', category: 'operational' },
  { id: 'aov', name: 'Average Order Value', category: 'financial' },
  { id: 'ltv', name: 'Customer LTV', category: 'financial' },
  { id: 'cac', name: 'Customer CAC', category: 'financial' },
  { id: 'retention', name: 'Retention Rate', category: 'performance' },
  { id: 'conversion', name: 'Conversion Rate', category: 'performance' }
];

const FILTER_FIELDS = [
  { value: 'category', label: 'Service Category' },
  { value: 'vendor_id', label: 'Vendor' },
  { value: 'customer_id', label: 'Customer' },
  { value: 'status', label: 'Status' },
  { value: 'payment_method', label: 'Payment Method' },
  { value: 'location', label: 'Location' }
];

export function ReportBuilder({ onBack }: ReportBuilderProps) {
  const [reportConfig, setReportConfig] = useState<ReportConfig>({
    name: '',
    description: '',
    reportType: 'revenue',
    dateRange: '30d',
    groupBy: 'day',
    filters: [],
    metrics: ['revenue', 'orders'],
    visualizationType: 'bar'
  });

  const [reportData, setReportData] = useState<any[]>([]);
  const [savedReports, setSavedReports] = useState<ReportConfig[]>([]);
  const [loading, setLoading] = useState(false);
  const [showSchedule, setShowSchedule] = useState(false);

  useEffect(() => {
    loadSavedReports();
  }, []);

  const loadSavedReports = async () => {
    try {
      const response = await fetch(`${API_BASE}/admin/reports/saved`, {
        headers: getAuthHeaders()
      });
      if (response.ok) {
        const data = await response.json();
        setSavedReports(data.reports || []);
      }
    } catch (err) {
      console.error('Error loading saved reports:', err);
    }
  };

  const runReport = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/admin/reports/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify(reportConfig)
      });

      if (response.ok) {
        const data = await response.json();
        setReportData(data.data || []);
      } else {
        alert('Failed to generate report');
      }
    } catch (err) {
      console.error('Error running report:', err);
      alert('Failed to generate report');
    } finally {
      setLoading(false);
    }
  };

  const saveReport = async () => {
    if (!reportConfig.name.trim()) {
      alert('Please enter a report name');
      return;
    }

    try {
      const response = await fetch(`${API_BASE}/admin/reports/save`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify(reportConfig)
      });

      if (response.ok) {
        alert('Report saved successfully');
        loadSavedReports();
      } else {
        alert('Failed to save report');
      }
    } catch (err) {
      console.error('Error saving report:', err);
      alert('Failed to save report');
    }
  };

  const exportReport = (format: 'csv' | 'pdf' | 'excel') => {
    try {
      const csvRows = [];
      
      // Header
      csvRows.push(`Report: ${reportConfig.name || 'Custom Report'}`);
      csvRows.push(`Generated: ${new Date().toLocaleString()}`);
      csvRows.push(`Date Range: ${reportConfig.dateRange}`);
      csvRows.push('');
      
      // Data
      if (reportData.length > 0) {
        const headers = Object.keys(reportData[0]);
        csvRows.push(headers.join(','));
        
        reportData.forEach(row => {
          const values = headers.map(h => row[h]);
          csvRows.push(values.join(','));
        });
      }
      
      const csvContent = csvRows.join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${reportConfig.name || 'report'}-${Date.now()}.csv`;
      link.click();
      
      console.log(`✅ Report exported as ${format.toUpperCase()}`);
    } catch (err) {
      console.error('Export error:', err);
      alert('Failed to export report');
    }
  };

  const addFilter = () => {
    setReportConfig(prev => ({
      ...prev,
      filters: [...prev.filters, { field: 'category', operator: 'equals', value: '' }]
    }));
  };

  const removeFilter = (index: number) => {
    setReportConfig(prev => ({
      ...prev,
      filters: prev.filters.filter((_, i) => i !== index)
    }));
  };

  const updateFilter = (index: number, updates: Partial<ReportFilter>) => {
    setReportConfig(prev => ({
      ...prev,
      filters: prev.filters.map((f, i) => i === index ? { ...f, ...updates } : f)
    }));
  };

  const toggleMetric = (metricId: string) => {
    setReportConfig(prev => ({
      ...prev,
      metrics: prev.metrics.includes(metricId)
        ? prev.metrics.filter(m => m !== metricId)
        : [...prev.metrics, metricId]
    }));
  };

  const renderVisualization = () => {
    if (!reportData || reportData.length === 0) {
      return (
        <div className="text-center py-12 text-gray-500">
          <BarChart3 className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>No data to display. Run the report to see results.</p>
        </div>
      );
    }

    const COLORS = ['#FF8C42', '#4F46E5', '#10B981', '#F59E0B', '#EF4444'];

    switch (reportConfig.visualizationType) {
      case 'bar':
        return (
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={reportData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Legend />
              {reportConfig.metrics.map((metric, idx) => (
                <Bar key={metric} dataKey={metric} fill={COLORS[idx % COLORS.length]} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        );

      case 'line':
        return (
          <ResponsiveContainer width="100%" height={400}>
            <LineChart data={reportData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Legend />
              {reportConfig.metrics.map((metric, idx) => (
                <Line key={metric} type="monotone" dataKey={metric} stroke={COLORS[idx % COLORS.length]} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        );

      case 'pie':
        return (
          <ResponsiveContainer width="100%" height={400}>
            <PieChart>
              <Pie
                data={reportData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={(entry) => entry.name}
                outerRadius={120}
                fill="#8884d8"
                dataKey={reportConfig.metrics[0] || 'value'}
              >
                {reportData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        );

      case 'table':
      default:
        return (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  {Object.keys(reportData[0] || {}).map(key => (
                    <th key={key} className="px-4 py-3 text-left text-sm font-semibold">
                      {key}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {reportData.map((row, idx) => (
                  <tr key={idx} className="border-t hover:bg-gray-50">
                    {Object.values(row).map((value: any, i) => (
                      <td key={i} className="px-4 py-3 text-sm">
                        {typeof value === 'number' ? value.toLocaleString() : value}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
    }
  };

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
                <h1 className="text-xl font-semibold">Report Builder</h1>
                <p className="text-sm text-gray-500">Create custom analytics reports</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Button variant="outline" onClick={saveReport}>
                <Save className="w-4 h-4 mr-2" />
                Save Report
              </Button>
              <Button onClick={runReport} disabled={loading} className="bg-[#FF8C42] hover:bg-[#ff7a28]">
                <Play className="w-4 h-4 mr-2" />
                {loading ? 'Running...' : 'Run Report'}
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Configuration Panel */}
          <div className="lg:col-span-1 space-y-6">
            <Card className="p-6">
              <h3 className="font-semibold mb-4">Report Configuration</h3>
              
              {/* Report Name */}
              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">Report Name</label>
                <input
                  type="text"
                  value={reportConfig.name}
                  onChange={(e) => setReportConfig(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  placeholder="e.g., Monthly Revenue Report"
                />
              </div>

              {/* Report Type */}
              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">Report Type</label>
                <Select 
                  value={reportConfig.reportType} 
                  onValueChange={(value: any) => setReportConfig(prev => ({ ...prev, reportType: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {REPORT_TYPES.map(type => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Date Range */}
              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">Date Range</label>
                <Select 
                  value={reportConfig.dateRange} 
                  onValueChange={(value) => setReportConfig(prev => ({ ...prev, dateRange: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="7d">Last 7 Days</SelectItem>
                    <SelectItem value="30d">Last 30 Days</SelectItem>
                    <SelectItem value="90d">Last 90 Days</SelectItem>
                    <SelectItem value="1y">Last Year</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Group By */}
              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">Group By</label>
                <Select 
                  value={reportConfig.groupBy} 
                  onValueChange={(value) => setReportConfig(prev => ({ ...prev, groupBy: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="day">Daily</SelectItem>
                    <SelectItem value="week">Weekly</SelectItem>
                    <SelectItem value="month">Monthly</SelectItem>
                    <SelectItem value="category">By Category</SelectItem>
                    <SelectItem value="vendor">By Vendor</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Visualization Type */}
              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">Visualization</label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { value: 'table', icon: Table, label: 'Table' },
                    { value: 'bar', icon: BarChart3, label: 'Bar Chart' },
                    { value: 'line', icon: TrendingUp, label: 'Line Chart' },
                    { value: 'pie', icon: PieChartIcon, label: 'Pie Chart' }
                  ].map(({ value, icon: Icon, label }) => (
                    <button
                      key={value}
                      onClick={() => setReportConfig(prev => ({ ...prev, visualizationType: value as any }))}
                      className={`p-3 border rounded-lg text-sm flex flex-col items-center gap-2 ${
                        reportConfig.visualizationType === value 
                          ? 'border-[#FF8C42] bg-orange-50 text-[#FF8C42]' 
                          : 'border-gray-300 hover:border-gray-400'
                      }`}
                    >
                      <Icon className="w-5 h-5" />
                      <span>{label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </Card>

            {/* Metrics Selection */}
            <Card className="p-6">
              <h3 className="font-semibold mb-4">Metrics</h3>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {METRICS.map(metric => (
                  <label key={metric.id} className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={reportConfig.metrics.includes(metric.id)}
                      onChange={() => toggleMetric(metric.id)}
                      className="w-4 h-4 text-[#FF8C42] rounded"
                    />
                    <span className="text-sm">{metric.name}</span>
                  </label>
                ))}
              </div>
            </Card>

            {/* Filters */}
            <Card className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold">Filters</h3>
                <Button variant="outline" size="sm" onClick={addFilter}>
                  <Plus className="w-4 h-4 mr-1" />
                  Add
                </Button>
              </div>
              
              <div className="space-y-3">
                {reportConfig.filters.map((filter, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <Select 
                      value={filter.field}
                      onValueChange={(value) => updateFilter(idx, { field: value })}
                    >
                      <SelectTrigger className="flex-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {FILTER_FIELDS.map(field => (
                          <SelectItem key={field.value} value={field.value}>
                            {field.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => removeFilter(idx)}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
                {reportConfig.filters.length === 0 && (
                  <p className="text-sm text-gray-500 text-center py-4">
                    No filters added
                  </p>
                )}
              </div>
            </Card>
          </div>

          {/* Results Panel */}
          <div className="lg:col-span-2 space-y-6">
            {/* Export Actions */}
            {reportData.length > 0 && (
              <Card className="p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">
                    {reportData.length} records found
                  </span>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => exportReport('csv')}>
                      <Download className="w-4 h-4 mr-2" />
                      CSV
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => exportReport('excel')}>
                      <Download className="w-4 h-4 mr-2" />
                      Excel
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setShowSchedule(true)}>
                      <Clock className="w-4 h-4 mr-2" />
                      Schedule
                    </Button>
                  </div>
                </div>
              </Card>
            )}

            {/* Visualization */}
            <Card className="p-6">
              <h3 className="font-semibold mb-4">
                {reportConfig.name || 'Report Results'}
              </h3>
              {renderVisualization()}
            </Card>

            {/* Saved Reports */}
            <Card className="p-6">
              <h3 className="font-semibold mb-4">Saved Reports</h3>
              <div className="space-y-2">
                {savedReports.map(report => (
                  <div 
                    key={report.id} 
                    className="p-3 border rounded-lg hover:bg-gray-50 cursor-pointer"
                    onClick={() => setReportConfig(report)}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-sm">{report.name}</p>
                        <p className="text-xs text-gray-600">{report.description}</p>
                      </div>
                      <FileText className="w-4 h-4 text-gray-400" />
                    </div>
                  </div>
                ))}
                {savedReports.length === 0 && (
                  <p className="text-sm text-gray-500 text-center py-8">
                    No saved reports yet
                  </p>
                )}
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
