'use client';

import { X, Upload, FileSpreadsheet, AlertCircle } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@warmpawz/ui';
import { apiClient } from '@/lib/api-client';

interface ImportServicesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function ImportServicesModal({
  isOpen,
  onClose,
  onSuccess
}: ImportServicesModalProps) {
  const [loading, setLoading] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string>('');

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      const validExtensions = ['.csv', '.xlsx', '.xls'];
      const fileExtension = selectedFile.name.substring(selectedFile.name.lastIndexOf('.')).toLowerCase();
      
      if (!validExtensions.includes(fileExtension)) {
        setError('Please select a CSV or Excel file');
        setFile(null);
        return;
      }
      
      setFile(selectedFile);
      setError('');
    }
  };

  const handleImport = async () => {
    if (!file) {
      setError('Please select a file to import');
      return;
    }

    try {
      setLoading(true);
      setError('');

      const formData = new FormData();
      formData.append('file', file);

      // Note: apiClient might need a special method for FormData
      // For now, using fetch directly but with apiClient's base URL
      const response = await fetch(`${apiClient['baseUrl']}/admin/catalog/services/import`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('adminAuthToken') || ''}`
        },
        body: formData
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to import services');
      }

      const data = await response.json();
      alert(`Successfully imported ${data.imported || 0} services!`);
      onSuccess?.();
      onClose();
      setFile(null);
    } catch (error: any) {
      console.error('Error importing services:', error);
      setError(error.message || 'Failed to import services. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
        <div className="flex items-center justify-between p-0 border-b">
          <div className="flex items-center gap-0">
            <div className="p-0 bg-blue-100 rounded-lg">
              <Upload className="w-5 h-5 text-blue-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900">Import Services</h3>
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
              Select File (CSV or Excel)
            </label>
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-0 text-center hover:border-blue-400 transition-colors">
              <input
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={handleFileChange}
                className="hidden"
                id="file-upload"
                disabled={loading}
              />
              <label
                htmlFor="file-upload"
                className="cursor-pointer flex flex-col items-center gap-0"
              >
                <FileSpreadsheet className="w-8 h-8 text-gray-400" />
                <span className="text-sm text-gray-600">
                  {file ? file.name : 'Click to select file'}
                </span>
                <span className="text-xs text-gray-500">
                  CSV or Excel format
                </span>
              </label>
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-0 p-0 bg-red-50 border border-red-200 rounded-lg">
              <AlertCircle className="w-4 h-4 text-red-600" />
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-0">
            <p className="text-xs text-blue-800">
              <strong>Note:</strong> Ensure your file includes columns: name, category, price, description, status
            </p>
          </div>
        </div>

        <div className="flex items-center justify-end gap-0 p-0 border-t">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            className="bg-[#FF8C42] hover:bg-[#FF7A2E]"
            onClick={handleImport}
            disabled={loading || !file}
          >
            {loading ? 'Importing...' : 'Import'}
          </Button>
        </div>
      </div>
    </div>
  );
}

