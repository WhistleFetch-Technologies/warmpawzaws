'use client';

import { X, Download, FileSpreadsheet } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@warmpawz/ui';
import { apiClient } from '@/lib/api-client';

interface ExportServicesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ExportServicesModal({
  isOpen,
  onClose
}: ExportServicesModalProps) {
  const [loading, setLoading] = useState(false);
  const [format, setFormat] = useState<'csv' | 'excel'>('csv');

  const handleExport = async () => {
    try {
      setLoading(true);
      const data = await apiClient.get<any>(`/admin/catalog/services/export?format=${format}`);
      
      // Create download link
      const blob = new Blob([data.content || ''], { type: format === 'csv' ? 'text/csv' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `services-export-${new Date().toISOString().split('T')[0]}.${format === 'csv' ? 'csv' : 'xlsx'}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      
      alert('Services exported successfully!');
      onClose();
    } catch (error) {
      console.error('Error exporting services:', error);
      alert('Failed to export services. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
        <div className="flex items-center justify-between p-0 border-b">
          <div className="flex items-center gap-3">
            <div className="p-0 bg-blue-100 rounded-lg">
              <Download className="w-5 h-5 text-blue-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900">Export Services</h3>
          </div>
          <button
            onClick={onClose}
            className="p-0 hover:bg-gray-100 rounded"
            disabled={loading}
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="p-0 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-0">
              Export Format
            </label>
            <div className="flex gap-3">
              <button
                onClick={() => setFormat('csv')}
                className={`flex-1 p-0 border-2 rounded-lg transition-colors ${
                  format === 'csv'
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <FileSpreadsheet className="w-5 h-5 mx-auto mb-0 text-gray-600" />
                <span className="text-sm font-medium">CSV</span>
              </button>
              <button
                onClick={() => setFormat('excel')}
                className={`flex-1 p-0 border-2 rounded-lg transition-colors ${
                  format === 'excel'
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <FileSpreadsheet className="w-5 h-5 mx-auto mb-0 text-gray-600" />
                <span className="text-sm font-medium">Excel</span>
              </button>
            </div>
          </div>

          <p className="text-sm text-gray-600">
            Export all services to a {format.toUpperCase()} file for analysis or backup.
          </p>
        </div>

        <div className="flex items-center justify-end gap-3 p-0 border-t">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            className="bg-[#FF8C42] hover:bg-[#FF7A2E]"
            onClick={handleExport}
            disabled={loading}
          >
            {loading ? 'Exporting...' : 'Export'}
          </Button>
        </div>
      </div>
    </div>
  );
}

