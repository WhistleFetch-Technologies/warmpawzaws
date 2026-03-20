'use client';

import { useState, useRef } from 'react';
import { Upload, Download, FileSpreadsheet, AlertCircle, CheckCircle, X, Loader2 } from 'lucide-react';
import { apiClientWithMock as apiClient } from '@/lib/api-client-with-mock';

interface BulkProductUploadProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

interface ValidationResult {
  totalRows: number;
  validRows: number;
  invalidRows: number;
  errors: Array<{
    row: number;
    field: string;
    message: string;
    value?: any;
  }>;
  hasMoreErrors: boolean;
}

interface UploadResult {
  created: number;
  updated: number;
  failed: number;
  errors: Array<{ row: number; error: string }>;
}

export function BulkProductUpload({ isOpen, onClose, onSuccess }: BulkProductUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<'upload' | 'preview' | 'result'>('upload');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [parsedProducts, setParsedProducts] = useState<any[]>([]);
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);

  const handleDownloadTemplate = async () => {
    try {
      const vendorId = localStorage.getItem('vendorId');
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || '/api'}/vendor/${vendorId}/products/bulk/template`);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'product_upload_template.csv';
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Error downloading template:', err);
      // Fallback: create template manually
      const headers = ['name*', 'description', 'category', 'sku', 'price*', 'compare_at_price', 'stock_quantity*', 'hsn_code', 'gst_rate', 'weight_kg', 'dimensions', 'material', 'brand', 'tags', 'image_urls', 'is_active'];
      const sample = [
        '"Premium Dog Food"', '"High-quality grain-free dog food"', '"Pet Food"', '"SKU-001"', '599', '699', '100', '2309', '18', '2.5', '"30x20x10"', '"Chicken, Rice"', '"Warmpawz"', '"dog,food"', '"https://example.com/image.jpg"', 'true'
      ];
      const csv = headers.join(',') + '\n' + sample.join(',');
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'product_upload_template.csv';
      a.click();
      window.URL.revokeObjectURL(url);
    }
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setError('');
    setLoading(true);

    try {
      const content = await file.text();
      const vendorId = localStorage.getItem('vendorId');

      // Parse file
      const parseResult = await apiClient.post<{ parsed?: { products: any[] } }>(`/vendor/${vendorId}/products/bulk/parse`, {
        csvContent: content,
        format: file.name.endsWith('.csv') ? 'csv' : 'excel',
      });

      if (!parseResult.parsed?.products?.length) {
        throw new Error('No products found in file');
      }

      setParsedProducts(parseResult.parsed.products);

      // Validate products
      const validationResult = await apiClient.post<{ validation?: ValidationResult; validProducts?: any[] }>(`/vendor/${vendorId}/products/bulk/validate`, {
        products: parseResult.parsed.products,
      });

      setValidation(validationResult.validation || null);
      setStep('preview');
    } catch (err: any) {
      console.error('Error processing file:', err);
      setError(err.message || 'Failed to process file');
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async () => {
    setLoading(true);
    setError('');

    try {
      const vendorId = localStorage.getItem('vendorId');
      const result = await apiClient.post<{ results?: UploadResult }>(`/vendor/${vendorId}/products/bulk/upload`, {
        products: parsedProducts,
      });

      setUploadResult(result.results || null);
      setStep('result');
    } catch (err: any) {
      console.error('Error uploading products:', err);
      setError(err.message || 'Failed to upload products');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setStep('upload');
    setParsedProducts([]);
    setValidation(null);
    setUploadResult(null);
    setError('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleDone = () => {
    handleReset();
    onSuccess?.();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-3xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b bg-gradient-to-r from-orange-500 to-amber-500 text-white">
          <div className="flex items-center gap-3">
            <FileSpreadsheet className="w-6 h-6" />
            <h2 className="text-xl font-bold">Bulk Product Upload</h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-lg transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto max-h-[calc(90vh-80px)]">
          {/* Step Indicator */}
          <div className="flex items-center justify-center gap-4 mb-8">
            {['upload', 'preview', 'result'].map((s, i) => (
              <div key={s} className="flex items-center">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${
                  step === s ? 'bg-orange-500 text-white' : 
                  ['preview', 'result'].indexOf(step) > i ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-500'
                }`}>
                  {['preview', 'result'].indexOf(step) > i ? <CheckCircle className="w-4 h-4" /> : i + 1}
                </div>
                <span className="ml-2 text-sm font-medium text-gray-600 capitalize hidden sm:block">{s}</span>
                {i < 2 && <div className="w-8 h-0.5 bg-gray-200 mx-2" />}
              </div>
            ))}
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-500 mt-0.5" />
              <div>
                <p className="font-medium text-red-700">Error</p>
                <p className="text-red-600 text-sm">{error}</p>
              </div>
            </div>
          )}

          {/* Upload Step */}
          {step === 'upload' && (
            <div className="space-y-6">
              <div className="text-center">
                <p className="text-gray-600 mb-4">
                  Upload a CSV or Excel file to add multiple products at once.
                </p>
                <button
                  onClick={handleDownloadTemplate}
                  className="inline-flex items-center gap-2 px-4 py-2 text-orange-600 hover:bg-orange-50 rounded-lg transition"
                >
                  <Download className="w-5 h-5" />
                  Download Template
                </button>
              </div>

              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-gray-300 rounded-2xl p-12 text-center cursor-pointer hover:border-orange-400 hover:bg-orange-50 transition"
              >
                {loading ? (
                  <Loader2 className="w-12 h-12 text-orange-500 mx-auto animate-spin" />
                ) : (
                  <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                )}
                <p className="text-gray-600 font-medium">
                  {loading ? 'Processing file...' : 'Click to upload or drag and drop'}
                </p>
                <p className="text-sm text-gray-400 mt-1">CSV or Excel files up to 10MB</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  onChange={handleFileSelect}
                  className="hidden"
                />
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                <h4 className="font-semibold text-amber-800 mb-2">📋 Required Fields</h4>
                <ul className="text-sm text-amber-700 space-y-1">
                  <li>• <strong>name</strong> - Product name (required)</li>
                  <li>• <strong>price</strong> - Selling price in ₹ (required)</li>
                  <li>• <strong>stock_quantity</strong> - Available inventory (required)</li>
                </ul>
              </div>

              <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
                <h4 className="font-semibold text-gray-800 mb-2">📝 Optional Fields</h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-sm text-gray-600">
                  <span>description</span>
                  <span>category</span>
                  <span>sku</span>
                  <span>compare_at_price</span>
                  <span>hsn_code</span>
                  <span>gst_rate</span>
                  <span>weight_kg</span>
                  <span>dimensions</span>
                  <span>material</span>
                  <span>brand</span>
                  <span>tags</span>
                  <span>image_urls</span>
                </div>
              </div>
            </div>
          )}

          {/* Preview Step */}
          {step === 'preview' && validation && (
            <div className="space-y-6">
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-gray-50 rounded-xl p-4 text-center">
                  <p className="text-2xl font-bold text-gray-800">{validation.totalRows}</p>
                  <p className="text-sm text-gray-500">Total Rows</p>
                </div>
                <div className="bg-green-50 rounded-xl p-4 text-center">
                  <p className="text-2xl font-bold text-green-600">{validation.validRows}</p>
                  <p className="text-sm text-green-600">Valid</p>
                </div>
                <div className={`rounded-xl p-4 text-center ${validation.invalidRows > 0 ? 'bg-red-50' : 'bg-gray-50'}`}>
                  <p className={`text-2xl font-bold ${validation.invalidRows > 0 ? 'text-red-600' : 'text-gray-400'}`}>
                    {validation.invalidRows}
                  </p>
                  <p className={`text-sm ${validation.invalidRows > 0 ? 'text-red-600' : 'text-gray-500'}`}>Invalid</p>
                </div>
              </div>

              {validation.errors.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4 max-h-48 overflow-y-auto">
                  <h4 className="font-semibold text-red-700 mb-2">⚠️ Validation Errors</h4>
                  <ul className="text-sm text-red-600 space-y-1">
                    {validation.errors.slice(0, 20).map((err, i) => (
                      <li key={i}>
                        Row {err.row}: <strong>{err.field}</strong> - {err.message}
                        {err.value !== undefined && <span className="text-red-500"> (value: {JSON.stringify(err.value)})</span>}
                      </li>
                    ))}
                    {validation.errors.length > 20 && (
                      <li className="text-red-500 font-medium">...and {validation.errors.length - 20} more errors</li>
                    )}
                  </ul>
                </div>
              )}

              {/* Preview Table */}
              <div className="border rounded-xl overflow-hidden">
                <div className="bg-gray-50 px-4 py-3 font-semibold text-gray-700">
                  Products Preview (first 10)
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-100">
                        <th className="px-3 py-2 text-left">#</th>
                        <th className="px-3 py-2 text-left">Name</th>
                        <th className="px-3 py-2 text-left">Category</th>
                        <th className="px-3 py-2 text-right">Price</th>
                        <th className="px-3 py-2 text-right">Stock</th>
                        <th className="px-3 py-2 text-left">SKU</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {parsedProducts.slice(0, 10).map((product, i) => (
                        <tr key={i} className="hover:bg-gray-50">
                          <td className="px-3 py-2 text-gray-500">{i + 1}</td>
                          <td className="px-3 py-2 font-medium">{product.name}</td>
                          <td className="px-3 py-2 text-gray-600">{product.category || '-'}</td>
                          <td className="px-3 py-2 text-right">₹{product.price}</td>
                          <td className="px-3 py-2 text-right">{product.stock_quantity}</td>
                          <td className="px-3 py-2 text-gray-600">{product.sku || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {parsedProducts.length > 10 && (
                  <div className="px-4 py-2 text-sm text-gray-500 bg-gray-50">
                    ...and {parsedProducts.length - 10} more products
                  </div>
                )}
              </div>

              <div className="flex gap-3">
                <button
                  onClick={handleReset}
                  className="px-6 py-3 border border-gray-300 text-gray-600 rounded-xl hover:bg-gray-100"
                >
                  Start Over
                </button>
                <button
                  onClick={handleUpload}
                  disabled={loading || validation.validRows === 0}
                  className="flex-1 py-3 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-xl font-semibold disabled:opacity-50 hover:shadow-lg transition flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Uploading...
                    </>
                  ) : (
                    <>
                      <Upload className="w-5 h-5" />
                      Upload {validation.validRows} Products
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Result Step */}
          {step === 'result' && uploadResult && (
            <div className="space-y-6 text-center">
              <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle className="w-10 h-10 text-green-500" />
              </div>
              
              <h3 className="text-xl font-bold text-gray-800">Upload Complete!</h3>
              
              <div className="grid grid-cols-3 gap-4 max-w-md mx-auto">
                <div className="bg-green-50 rounded-xl p-4">
                  <p className="text-2xl font-bold text-green-600">{uploadResult.created}</p>
                  <p className="text-sm text-green-600">Created</p>
                </div>
                <div className="bg-blue-50 rounded-xl p-4">
                  <p className="text-2xl font-bold text-blue-600">{uploadResult.updated}</p>
                  <p className="text-sm text-blue-600">Updated</p>
                </div>
                <div className={`rounded-xl p-4 ${uploadResult.failed > 0 ? 'bg-red-50' : 'bg-gray-50'}`}>
                  <p className={`text-2xl font-bold ${uploadResult.failed > 0 ? 'text-red-600' : 'text-gray-400'}`}>
                    {uploadResult.failed}
                  </p>
                  <p className={`text-sm ${uploadResult.failed > 0 ? 'text-red-600' : 'text-gray-500'}`}>Failed</p>
                </div>
              </div>

              {uploadResult.errors.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-left max-h-32 overflow-y-auto">
                  <h4 className="font-semibold text-red-700 mb-2">Failed Rows</h4>
                  <ul className="text-sm text-red-600 space-y-1">
                    {uploadResult.errors.map((err, i) => (
                      <li key={i}>Row {err.row}: {err.error}</li>
                    ))}
                  </ul>
                </div>
              )}

              <button
                onClick={handleDone}
                className="px-8 py-3 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-xl font-semibold hover:shadow-lg transition"
              >
                Done
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
