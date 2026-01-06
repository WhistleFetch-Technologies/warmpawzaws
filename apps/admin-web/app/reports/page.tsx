'use client';

import React, { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api-client';
import { AdminLayout } from '@/components/AdminLayout';

// ============================================================================
// TYPES
// ============================================================================

interface ReportTemplate {
  id: string;
  name: string;
  description: string;
  category: 'financial' | 'operational' | 'vendor' | 'customer' | 'custom';
  parameters: ReportParameter[];
  schedule?: { frequency: string; recipients: string[] };
  last_generated?: string;
}

interface ReportParameter {
  name: string;
  label: string;
  type: 'date' | 'daterange' | 'select' | 'multiselect' | 'text';
  required: boolean;
  options?: { value: string; label: string }[];
  default?: any;
}

interface GeneratedReport {
  id: string;
  template_id: string;
  template_name: string;
  parameters: Record<string, any>;
  status: 'generating' | 'completed' | 'failed';
  format: 'pdf' | 'csv' | 'xlsx';
  download_url?: string;
  generated_at: string;
  generated_by: string;
}

interface SavedReport {
  id: string;
  name: string;
  template_id: string;
  parameters: Record<string, any>;
  is_favorite: boolean;
  created_at: string;
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function ReportsPage() {
  const [templates, setTemplates] = useState<ReportTemplate[]>([]);
  const [generatedReports, setGeneratedReports] = useState<GeneratedReport[]>([]);
  const [savedReports, setSavedReports] = useState<SavedReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  // Generator state
  const [selectedTemplate, setSelectedTemplate] = useState<ReportTemplate | null>(null);
  const [reportParams, setReportParams] = useState<Record<string, any>>({});
  const [generating, setGenerating] = useState(false);
  const [exportFormat, setExportFormat] = useState<'pdf' | 'csv' | 'xlsx'>('pdf');
  
  // Filter
  const [filterCategory, setFilterCategory] = useState<string>('');

  // ============================================================================
  // DATA LOADING
  // ============================================================================

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const [templatesRes, reportsRes, savedRes] = await Promise.all([
        apiClient.get<any>('/admin/reports/templates'),
        apiClient.get<any>('/admin/reports/generated?limit=10'),
        apiClient.get<any>('/admin/reports/saved'),
      ]);
      
      setTemplates(templatesRes.templates || templatesRes || []);
      setGeneratedReports(reportsRes.reports || reportsRes || []);
      setSavedReports(savedRes.reports || savedRes || []);
    } catch (err: any) {
      console.error('Error loading reports:', err);
      setError(err.message || 'Failed to load reports');
    } finally {
      setLoading(false);
    }
  };

  // ============================================================================
  // ACTIONS
  // ============================================================================

  const handleSelectTemplate = (template: ReportTemplate) => {
    setSelectedTemplate(template);
    // Initialize default parameters
    const defaults: Record<string, any> = {};
    template.parameters.forEach(param => {
      if (param.default !== undefined) defaults[param.name] = param.default;
      if (param.type === 'daterange') {
        defaults[`${param.name}_start`] = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        defaults[`${param.name}_end`] = new Date().toISOString().split('T')[0];
      }
    });
    setReportParams(defaults);
  };

  const handleGenerateReport = async () => {
    if (!selectedTemplate) return;
    
    try {
      setGenerating(true);
      setError(null);
      
      await apiClient.post('/admin/reports/generate', {
        template_id: selectedTemplate.id,
        parameters: reportParams,
        format: exportFormat,
      });
      
      setSuccess('Report generation started. It will appear in Recent Reports when ready.');
      loadData();
    } catch (err: any) {
      setError(err.message || 'Failed to generate report');
    } finally {
      setGenerating(false);
    }
  };

  const handleSaveReport = async () => {
    if (!selectedTemplate) return;
    
    const name = prompt('Enter a name for this saved report:');
    if (!name) return;
    
    try {
      await apiClient.post('/admin/reports/save', {
        name,
        template_id: selectedTemplate.id,
        parameters: reportParams,
      });
      setSuccess('Report configuration saved');
      loadData();
    } catch (err: any) {
      setError(err.message || 'Failed to save report');
    }
  };

  const handleLoadSavedReport = (saved: SavedReport) => {
    const template = templates.find(t => t.id === saved.template_id);
    if (template) {
      setSelectedTemplate(template);
      setReportParams(saved.parameters);
    }
  };

  // ============================================================================
  // RENDER
  // ============================================================================

  if (loading) {
    return (
      <AdminLayout>
        <div className="min-h-screen flex items-center justify-center bg-slate-50">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading reports...</p>
          </div>
        </div>
      </AdminLayout>
    );
  }

  const filteredTemplates = filterCategory
    ? templates.filter(t => t.category === filterCategory)
    : templates;

  const categoryIcons: Record<string, string> = {
    financial: '💰',
    operational: '📊',
    vendor: '🏪',
    customer: '👤',
    custom: '⚙️',
  };

  return (
    <AdminLayout>
      <div className="min-h-screen bg-slate-50">
        {/* Header */}
        <header className="bg-white border-b px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Reports Builder</h1>
              <p className="text-gray-500">Generate, export, and schedule reports</p>
            </div>
          </div>
        </header>

        <main className="p-8">
          {/* Messages */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 flex items-center justify-between">
              <span>{error}</span>
              <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600">✕</button>
            </div>
          )}
          
          {success && (
            <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-xl text-green-700 flex items-center justify-between">
              <span>{success}</span>
              <button onClick={() => setSuccess(null)} className="text-green-400 hover:text-green-600">✕</button>
            </div>
          )}

          <div className="grid grid-cols-3 gap-8">
            {/* Left Column: Templates */}
            <div className="col-span-1">
              <div className="bg-white rounded-2xl shadow-sm p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Report Templates</h2>
                
                {/* Category Filter */}
                <div className="flex flex-wrap gap-2 mb-4">
                  <button
                    onClick={() => setFilterCategory('')}
                    className={`px-3 py-1 rounded-full text-sm transition ${!filterCategory ? 'bg-orange-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                  >
                    All
                  </button>
                  {['financial', 'operational', 'vendor', 'customer'].map(cat => (
                    <button
                      key={cat}
                      onClick={() => setFilterCategory(cat)}
                      className={`px-3 py-1 rounded-full text-sm transition ${filterCategory === cat ? 'bg-orange-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                    >
                      {categoryIcons[cat]} {cat.charAt(0).toUpperCase() + cat.slice(1)}
                    </button>
                  ))}
                </div>
                
                {/* Template List */}
                <div className="space-y-2">
                  {filteredTemplates.map(template => (
                    <button
                      key={template.id}
                      onClick={() => handleSelectTemplate(template)}
                      className={`w-full text-left p-4 rounded-xl border transition ${
                        selectedTemplate?.id === template.id
                          ? 'border-orange-500 bg-orange-50'
                          : 'border-gray-100 hover:border-orange-200'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <span className="text-2xl">{categoryIcons[template.category]}</span>
                        <div>
                          <h3 className="font-medium text-gray-900">{template.name}</h3>
                          <p className="text-sm text-gray-500 mt-1">{template.description}</p>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
              
              {/* Saved Reports */}
              {savedReports.length > 0 && (
                <div className="bg-white rounded-2xl shadow-sm p-6 mt-6">
                  <h2 className="text-lg font-semibold text-gray-900 mb-4">Saved Reports</h2>
                  <div className="space-y-2">
                    {savedReports.map(saved => (
                      <button
                        key={saved.id}
                        onClick={() => handleLoadSavedReport(saved)}
                        className="w-full text-left p-3 rounded-lg border border-gray-100 hover:border-orange-200 transition"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-gray-900">{saved.name}</span>
                          {saved.is_favorite && <span>⭐</span>}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Middle Column: Generator */}
            <div className="col-span-1">
              <div className="bg-white rounded-2xl shadow-sm p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Generate Report</h2>
                
                {!selectedTemplate ? (
                  <div className="text-center py-12 text-gray-500">
                    <div className="text-4xl mb-3">📋</div>
                    <p>Select a template to configure</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="p-4 bg-orange-50 rounded-xl">
                      <h3 className="font-semibold text-orange-900">{selectedTemplate.name}</h3>
                      <p className="text-sm text-orange-700 mt-1">{selectedTemplate.description}</p>
                    </div>
                    
                    {/* Parameters */}
                    {selectedTemplate.parameters.map(param => (
                      <div key={param.name}>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          {param.label} {param.required && <span className="text-red-500">*</span>}
                        </label>
                        
                        {param.type === 'daterange' && (
                          <div className="grid grid-cols-2 gap-2">
                            <input
                              type="date"
                              value={reportParams[`${param.name}_start`] || ''}
                              onChange={(e) => setReportParams(prev => ({ ...prev, [`${param.name}_start`]: e.target.value }))}
                              className="px-3 py-2 border border-gray-200 rounded-lg focus:border-orange-500 outline-none"
                            />
                            <input
                              type="date"
                              value={reportParams[`${param.name}_end`] || ''}
                              onChange={(e) => setReportParams(prev => ({ ...prev, [`${param.name}_end`]: e.target.value }))}
                              className="px-3 py-2 border border-gray-200 rounded-lg focus:border-orange-500 outline-none"
                            />
                          </div>
                        )}
                        
                        {param.type === 'select' && (
                          <select
                            value={reportParams[param.name] || ''}
                            onChange={(e) => setReportParams(prev => ({ ...prev, [param.name]: e.target.value }))}
                            className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:border-orange-500 outline-none"
                          >
                            <option value="">Select...</option>
                            {param.options?.map(opt => (
                              <option key={opt.value} value={opt.value}>{opt.label}</option>
                            ))}
                          </select>
                        )}
                      </div>
                    ))}
                    
                    {/* Export Format */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Export Format</label>
                      <div className="flex gap-2">
                        {(['pdf', 'csv', 'xlsx'] as const).map(format => (
                          <button
                            key={format}
                            onClick={() => setExportFormat(format)}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                              exportFormat === format
                                ? 'bg-orange-500 text-white'
                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                            }`}
                          >
                            {format.toUpperCase()}
                          </button>
                        ))}
                      </div>
                    </div>
                    
                    {/* Actions */}
                    <div className="flex gap-3 pt-4">
                      <button
                        onClick={handleGenerateReport}
                        disabled={generating}
                        className="flex-1 py-3 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 transition disabled:opacity-50"
                      >
                        {generating ? '⏳ Generating...' : '📊 Generate Report'}
                      </button>
                      <button
                        onClick={handleSaveReport}
                        className="px-4 py-3 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition"
                      >
                        💾
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Right Column: Recent Reports */}
            <div className="col-span-1">
              <div className="bg-white rounded-2xl shadow-sm p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Reports</h2>
                
                {generatedReports.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    <div className="text-4xl mb-3">📄</div>
                    <p>No reports generated yet</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {generatedReports.map(report => (
                      <div key={report.id} className="p-4 border rounded-xl">
                        <div className="flex items-start justify-between">
                          <div>
                            <h3 className="font-medium text-gray-900">{report.template_name}</h3>
                            <p className="text-xs text-gray-500 mt-1">
                              {new Date(report.generated_at).toLocaleString()}
                            </p>
                          </div>
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                            report.status === 'completed' ? 'bg-green-100 text-green-700' :
                            report.status === 'generating' ? 'bg-blue-100 text-blue-700' :
                            'bg-red-100 text-red-700'
                          }`}>
                            {report.status}
                          </span>
                        </div>
                        
                        {report.status === 'completed' && report.download_url && (
                          <a
                            href={report.download_url}
                            className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition"
                          >
                            📥 Download {report.format.toUpperCase()}
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </main>
      </div>
    </AdminLayout>
  );
}

