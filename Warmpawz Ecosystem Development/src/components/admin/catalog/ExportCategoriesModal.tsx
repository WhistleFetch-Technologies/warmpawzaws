import { X, Download } from 'lucide-react';
import { useState, useEffect } from 'react';
import { Button } from '../../ui/button';
import { projectId, publicAnonKey } from '../../../utils/supabase/info';

interface ExportCategoriesModalProps {
  isOpen: boolean;
  onClose: () => void;
  categories?: any[];
  onSuccess?: () => void;
}

export function ExportCategoriesModal({ isOpen, onClose, categories, onSuccess }: ExportCategoriesModalProps) {
  const [loading, setLoading] = useState(false);
  const [totalCategories, setTotalCategories] = useState(5);
  const [formData, setFormData] = useState({
    format: 'PDF Report',
    dataRange: 'all'
  });

  useEffect(() => {
    if (isOpen) {
      loadCategoryCount();
    }
  }, [isOpen]);

  const loadCategoryCount = async () => {
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/admin/catalog/categories`,
        {
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`
          }
        }
      );
      
      if (response.ok) {
        const data = await response.json();
        setTotalCategories(data.categories?.length || 0);
      }
    } catch (error) {
      console.error('Error loading category count:', error);
    }
  };

  const handleChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleExport = async () => {
    try {
      setLoading(true);
      
      // Create export operation
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/admin/catalog/export/categories`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            format: formData.format,
            dataRange: formData.dataRange,
            totalItems: totalCategories,
            exportedAt: new Date().toISOString()
          })
        }
      );

      if (response.ok) {
        const data = await response.json();
        console.log('Export initiated:', data);
        
        // In a real implementation, this would trigger a download
        alert(`Export initiated! Format: ${formData.format}\nCategories: ${totalCategories}\n\nDownload will begin shortly.`);
        
        onSuccess?.();
        onClose();
      }
    } catch (error) {
      console.error('Error exporting categories:', error);
      alert('Failed to export. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const fileSize = formData.format === 'PDF Report' ? '2.5 MB' : '1.2 MB';
  const formatExtension = formData.format === 'PDF Report' ? 'PDF' : 'CSV';

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg">
        {/* Header */}
        <div className="border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Download className="w-5 h-5 text-[#FF8C42]" />
              <h2 className="text-lg">Export Categories</h2>
            </div>
            <p className="text-sm text-gray-500">
              Download category data in various formats for reporting and analysis
            </p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {/* Export Format */}
          <div>
            <label className="block text-sm mb-2">Export Format</label>
            <select
              className="w-full px-3 py-2 border border-gray-200 rounded-lg"
              value={formData.format}
              onChange={(e) => handleChange('format', e.target.value)}
            >
              <option value="PDF Report">PDF Report</option>
              <option value="CSV Spreadsheet">CSV Spreadsheet</option>
              <option value="Excel Workbook">Excel Workbook</option>
              <option value="JSON Data">JSON Data</option>
            </select>
          </div>

          {/* Data Range */}
          <div>
            <label className="block text-sm mb-2">Data Range</label>
            <select
              className="w-full px-3 py-2 border border-gray-200 rounded-lg"
              value={formData.dataRange}
              onChange={(e) => handleChange('dataRange', e.target.value)}
            >
              <option value="all">All Categories ({totalCategories} total)</option>
              <option value="active">Active Categories Only</option>
              <option value="inactive">Inactive Categories Only</option>
              <option value="recent">Recently Added (Last 30 days)</option>
            </select>
          </div>

          {/* Export Details */}
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <h3 className="text-sm mb-3">Export Details</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Format:</span>
                <span>{formatExtension}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Data:</span>
                <span>All {totalCategories} Categories</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Includes:</span>
                <span>Service Provider, Range of Services, Rating</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">File Size:</span>
                <span>{fileSize}</span>
              </div>
            </div>
          </div>

          {/* Warning Note */}
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
            <p className="text-sm text-orange-800">
              <span className="font-medium">Note:</span> Exported data contains sensitive vendor information. 
              Please handle according to data privacy policies.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 px-6 py-4 flex justify-end gap-3">
          <Button 
            variant="outline" 
            onClick={onClose}
            className="text-red-600 border-red-600 hover:bg-red-50"
          >
            Cancel
          </Button>
          <Button
            onClick={handleExport}
            disabled={loading}
            className="bg-green-600 hover:bg-green-700 text-white gap-2"
          >
            <Download className="w-4 h-4" />
            {loading ? 'Exporting...' : 'Export Data'}
          </Button>
        </div>
      </div>
    </div>
  );
}