'use client';

import { useState, useRef } from 'react';
import { Upload, Download, FileSpreadsheet, AlertCircle, CheckCircle, X, Loader2 } from 'lucide-react';
import { apiClient as vendorApiClient } from '@/lib/api-client';

import { countBulkRowImages, countTitledBulkProducts, MAX_BULK_PRODUCT_ROWS } from '@/lib/bulk-product-limits';

/** Keep under API Gateway JSON body limits after base64 (~33% overhead). */
const MAX_BULK_FILE_BYTES = 6 * 1024 * 1024;
import { TouchFilePicker } from '@/components/shared/TouchFilePicker';

interface BulkProductUploadProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  /** When set (e.g. Seller Hub `sellerId`), used instead of `localStorage.vendorId` for API paths */
  vendorId?: string;
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

export function BulkProductUpload({
  isOpen,
  onClose,
  onSuccess,
  vendorId: vendorIdOverride,
}: BulkProductUploadProps) {
  const resolveVendorId = (): string | null => {
    const v = vendorIdOverride?.trim();
    if (v) return v;
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('vendorId');
  };

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<'upload' | 'preview' | 'result'>('upload');
  const [loading, setLoading] = useState(false);
  const [templateLoading, setTemplateLoading] = useState(false);
  const [templateOkMessage, setTemplateOkMessage] = useState('');
  const [error, setError] = useState('');

  const [parsedProducts, setParsedProducts] = useState<any[]>([]);
  /** Only rows that passed server-side validation — what we actually upload. */
  const [validProducts, setValidProducts] = useState<any[]>([]);
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);

  async function blobLooksLikeXlsx(blob: Blob): Promise<boolean> {
    if (!blob || blob.size < 64) return false;
    const head = new Uint8Array(await blob.slice(0, 4).arrayBuffer());
    // ZIP / Office Open XML: PK\x03\x04
    return head[0] === 0x50 && head[1] === 0x4b && head[2] === 0x03 && head[3] === 0x04;
  }

  const handleDownloadCsvFallback = () => {
    setError('');
    setTemplateOkMessage('');
    // Compulsory headers carry `*` so the parser still maps them after
    // normalization (`*` is stripped). Order matches the XLSX template.
    const headers = ['name*', 'description', 'category*', 'mrp*', 'selling_price', 'stock_quantity*', 'hsn_code*', 'gst_rate*', 'weight', 'dimensions', 'material', 'brand', 'tags', 'images*', 'is_active'];
    const sample = [
      '"Smiling Sunflower Dog Dress"', '"Bright, happy, full of joy."', '"Pet Accessories"', '1598', '799', '100', '62052000', '5', '0.15', '"35x25x1"', '"Cotton Rayon Blend"', '"15 FURRIES"', '"dog,dress"', '"https://example.com/your-product-image-1000x1000.jpg"', 'false'
    ];
    const csv = headers.join(',') + '\n' + sample.join(',');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'product_upload_template_simple.csv';
    a.click();
    window.URL.revokeObjectURL(url);
    setTemplateOkMessage('Downloaded simple CSV. Required: name, category, mrp, stock_quantity, hsn_code, gst_rate, images. Optional: selling_price (defaults to MRP). Legacy column compare_at_price also accepted as MRP.');
  };

  const handleDownloadTemplate = async () => {
    setTemplateLoading(true);
    setTemplateOkMessage('');
    setError('');
    try {
      const vendorId = resolveVendorId();
      if (!vendorId) {
        throw new Error('Vendor ID not found. Please sign in again.');
      }
      const blob = await vendorApiClient.getBlob(`/vendor/${vendorId}/products/bulk/template`);
      if (!blob || blob.size < 500) {
        throw new Error('Template from server was empty or too small. Check your connection or sign in again.');
      }
      if (!(await blobLooksLikeXlsx(blob))) {
        throw new Error(
          'Server did not return a valid Excel file (corrupt or an error page). Try again, or use the simple CSV below.'
        );
      }
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'product_upload_template.xlsx';
      a.click();
      window.URL.revokeObjectURL(url);
      setTemplateOkMessage(
        'Saved product_upload_template.xlsx. Open in Excel, or in Google Drive: upload the file → right-click → Open with → Google Sheets.'
      );
    } catch (err) {
      console.error('Error downloading template:', err);
      const msg = err instanceof Error ? err.message : 'Download failed.';
      setError(msg);
    } finally {
      setTemplateLoading(false);
    }
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setError('');
    setLoading(true);

    if (file.size > MAX_BULK_FILE_BYTES) {
      setError(
        `File is too large (${Math.round(file.size / 1024 / 1024)} MB). Max ${MAX_BULK_FILE_BYTES / 1024 / 1024} MB for bulk upload. Try fewer rows or CSV.`
      );
      setLoading(false);
      return;
    }

    try {
      const vendorId = resolveVendorId();
      if (!vendorId) {
        throw new Error('Vendor ID not found. Please sign in again.');
      }
      const isXlsx = file.name.toLowerCase().endsWith('.xlsx');

      let parsePayload: Record<string, unknown>;
      if (isXlsx) {
        const fileBase64 = await new Promise<string>((resolve, reject) => {
          const r = new FileReader();
          r.onload = () => {
            const s = r.result as string;
            const comma = s.indexOf(',');
            resolve(comma >= 0 ? s.slice(comma + 1) : s);
          };
          r.onerror = () => reject(r.error ?? new Error('Failed to read file'));
          r.readAsDataURL(file);
        });
        parsePayload = { fileBase64, fileName: file.name, format: 'xlsx' };
      } else {
        const content = await file.text();
        parsePayload = { csvContent: content, format: 'csv' };
      }

      const parseResult = await vendorApiClient.post<{ parsed?: { products: any[] } }>(
        `/vendor/${vendorId}/products/bulk/parse`,
        parsePayload
      );

      if (!parseResult.parsed?.products?.length) {
        throw new Error('No products found in file');
      }

      const titledCount = countTitledBulkProducts(parseResult.parsed.products);
      if (titledCount > MAX_BULK_PRODUCT_ROWS) {
        throw new Error(
          `Maximum ${MAX_BULK_PRODUCT_ROWS} products per file (rows with Title). Found ${titledCount}. Split into multiple files.`
        );
      }

      setParsedProducts(parseResult.parsed.products);

      // Validate products
      const validationResult = await vendorApiClient.post<{ validation?: ValidationResult; validProducts?: any[] }>(
        `/vendor/${vendorId}/products/bulk/validate`,
        {
          products: parseResult.parsed.products,
        }
      );

      setValidation(validationResult.validation || null);
      setValidProducts(validationResult.validProducts || []);
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
      const vendorId = resolveVendorId();
      if (!vendorId) {
        throw new Error('Vendor ID not found. Please sign in again.');
      }
      // Only push rows that passed server-side validation — falls back to raw
      // parsedProducts if for some reason validProducts wasn't populated.
      const productsToUpload = validProducts.length > 0 ? validProducts : parsedProducts;
      const result = await vendorApiClient.post<{ results?: UploadResult }>(`/vendor/${vendorId}/products/bulk/upload`, {
        products: productsToUpload,
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
    setValidProducts([]);
    setValidation(null);
    setUploadResult(null);
    setError('');
    setTemplateOkMessage('');
    setTemplateLoading(false);
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
              <div className="text-center space-y-3">
                <p className="text-gray-600 mb-2">
                  Upload an XLSX template (or CSV) from your device to add multiple products at once. You do{' '}
                  <strong>not</strong> need Google Sheets in the browser—pick the saved file here.
                </p>
                <p className="text-xs text-gray-500 max-w-lg mx-auto">
                  If sheets.google.com shows “File could not open”, clear google.com cookies or use Excel / LibreOffice,
                  then upload the .xlsx here.
                </p>
                <div className="flex flex-col items-center gap-2">
                  <button
                    type="button"
                    onClick={handleDownloadTemplate}
                    disabled={templateLoading}
                    className="inline-flex items-center gap-2 px-4 py-2 text-orange-600 hover:bg-orange-50 rounded-lg transition disabled:opacity-60 disabled:pointer-events-none"
                  >
                    {templateLoading ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <Download className="w-5 h-5" />
                    )}
                    {templateLoading ? 'Downloading…' : 'Download Excel template'}
                  </button>
                  <button
                    type="button"
                    onClick={handleDownloadCsvFallback}
                    className="text-sm text-gray-500 hover:text-orange-600 underline underline-offset-2"
                  >
                    Simple CSV instead (basic columns)
                  </button>
                </div>
                {templateOkMessage && (
                  <div className="p-3 bg-green-50 border border-green-200 rounded-xl text-left text-sm text-green-800 max-w-lg mx-auto">
                    {templateOkMessage}
                  </div>
                )}
              </div>

              <TouchFilePicker
                ref={fileInputRef}
                accept=".xlsx,.csv"
                onFileChange={handleFileSelect}
                disabled={loading}
                className="cursor-pointer rounded-2xl border-2 border-dashed border-gray-300 p-12 text-center transition hover:border-orange-400 hover:bg-orange-50"
                innerClassName="min-h-[12rem] gap-3"
              >
                {loading ? (
                  <Loader2 className="mx-auto h-12 w-12 animate-spin text-orange-500" />
                ) : (
                  <Upload className="mx-auto mb-4 h-12 w-12 text-gray-400" />
                )}
                <p className="font-medium text-gray-600">
                  {loading ? 'Processing file...' : 'Tap to upload or drag and drop'}
                </p>
                <p className="mt-1 text-sm text-gray-400">
                  XLSX or CSV — up to {MAX_BULK_PRODUCT_ROWS} products per file, {MAX_BULK_FILE_BYTES / 1024 / 1024} MB max
                </p>
              </TouchFilePicker>

              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                <h4 className="font-semibold text-amber-800 mb-2">Required fields (marked <span className="font-mono">*</span> in the template)</h4>
                <ul className="text-sm text-amber-700 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1">
                  <li>• <strong>Title*</strong> — product name</li>
                  <li>• <strong>Quantity*</strong> — whole number ≥ 0</li>
                  <li>• <strong>Image*</strong> — at least one http(s) URL per row; multiple images = comma-separated in the same cell</li>
                  <li>• <strong>MRP*</strong> — maximum retail price in ₹ (&gt; 0)</li>
                  <li>• <strong>Category*</strong> — column Y (dropdown)</li>
                  <li>• <strong>Tax*</strong> — 0, 5, 12, 18, or 28%</li>
                  <li>• <strong>HSN*</strong> — 4–8 digit code</li>
                </ul>
                <p className="text-xs text-amber-700 mt-2">
                  <strong>SP</strong> (selling price) is optional — leave blank to sell at MRP. Use <strong>Category*</strong> (column Y), not Type (Category). Up to {MAX_BULK_PRODUCT_ROWS} products per file (rows with Title); max {MAX_BULK_FILE_BYTES / 1024 / 1024} MB.
                </p>
              </div>

              <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
                <h4 className="font-semibold text-gray-800 mb-2">Recommended (not required to upload)</h4>
                <ul className="text-sm text-gray-600 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1">
                  <li>• Re-upload same Title to update an existing product</li>
                  <li>• Description, Brand, Barcode (EAN)</li>
                  <li>• SKU is auto-generated by the system</li>
                  <li>• SP — discount below MRP</li>
                </ul>
                <p className="text-xs text-gray-500 mt-2">
                  Weight and dimensions are optional (you ship orders). Other columns improve listing quality.
                </p>
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
                        <th className="px-3 py-2 text-left">Images</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {parsedProducts.slice(0, 10).map((product, i) => {
                        const imageCount = countBulkRowImages(product.images ?? product.image_urls);
                        return (
                        <tr key={i} className="hover:bg-gray-50">
                          <td className="px-3 py-2 text-gray-500">{i + 1}</td>
                          <td className="px-3 py-2 font-medium">{product.name}</td>
                          <td className="px-3 py-2 text-gray-600">{product.category || '-'}</td>
                          <td className="px-3 py-2 text-right">₹{product.price}</td>
                          <td className="px-3 py-2 text-right">{product.stock_quantity}</td>
                          <td className="px-3 py-2 text-gray-600">
                            {imageCount > 0 ? `${imageCount} image${imageCount === 1 ? '' : 's'}` : '—'}
                          </td>
                        </tr>
                      );})}
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
