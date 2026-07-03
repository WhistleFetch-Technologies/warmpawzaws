'use client';

import { useState, useRef, useEffect } from 'react';
import { Upload, Download, FileSpreadsheet, AlertCircle, CheckCircle, X, Loader2 } from 'lucide-react';
import { apiClient as vendorApiClient } from '@/lib/api-client';
import { downloadBlob } from '@/lib/download-file';

import { countBulkRowImages, countTitledBulkProducts, MAX_BULK_PRODUCT_ROWS } from '@/lib/bulk-product-limits';

/** Keep under API Gateway JSON body limits after base64 (~33% overhead). */
const MAX_BULK_FILE_BYTES = 6 * 1024 * 1024;
import { TouchFilePicker } from '@/components/shared/TouchFilePicker';
import {
  getBulkVariantHintsForCategory,
  MAX_SKUS_PER_PRODUCT,
  MAX_VARIANT_ATTRIBUTES,
} from '@warmpawz/shared-types';

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

interface ProductGroupPreview {
  name: string;
  category: string;
  product_group_id?: string;
  variants: Array<{
    rowNum: number;
    label: string;
    stock: number;
    price: number;
  }>;
}

function groupValidProductsForPreview(rows: any[]): ProductGroupPreview[] {
  const map = new Map<string, ProductGroupPreview>();
  for (const row of rows) {
    const name = String(row.name ?? '').trim();
    const category = String(row.category ?? '').trim();
    if (!name) continue;
    const pgid = String(row.product_group_id ?? '').trim();
    const brand = String(row.brand ?? '').trim().toLowerCase();
    const key = pgid
      ? `pgid::${pgid.toLowerCase()}`
      : `${brand}::${name.toLowerCase()}::${category.toLowerCase()}`;
    const mrp = Number(row.compare_at_price) || 0;
    const spRaw = row.price;
    const sp =
      spRaw != null && String(spRaw).trim() !== '' ? Number(spRaw) : mrp;
    const variant = {
      rowNum: Number(row.rowNum) || 0,
      label: bulkVariantLabel(row),
      stock: Number(row.stock_quantity) || 0,
      price: Number.isFinite(sp) && sp > 0 ? sp : mrp,
    };
    const existing = map.get(key);
    if (existing) {
      existing.variants.push(variant);
    } else {
      map.set(key, {
        name,
        category,
        product_group_id: pgid || undefined,
        variants: [variant],
      });
    }
  }
  return [...map.values()];
}

function bulkVariantLabel(row: Record<string, unknown>): string {
  const parts: string[] = [];
  if (row.size_variant) parts.push(`Size: ${row.size_variant}`);
  if (row.colour) parts.push(`Color: ${row.colour}`);
  if (row.variant_attr_1 && row.variant_value_1) {
    parts.push(`${row.variant_attr_1}: ${row.variant_value_1}`);
  }
  if (row.variant_attr_2 && row.variant_value_2) {
    parts.push(`${row.variant_attr_2}: ${row.variant_value_2}`);
  }
  if (row.variant_attr_3 && row.variant_value_3) {
    parts.push(`${row.variant_attr_3}: ${row.variant_value_3}`);
  }
  return parts.length > 0 ? parts.join(' · ') : 'Single variant';
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
  const [productGroups, setProductGroups] = useState<ProductGroupPreview[]>([]);
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);
  const [hintCategory, setHintCategory] = useState('Pet Food');
  const [commissionModel, setCommissionModel] = useState<'category' | 'ownership' | null>(null);

  const bulkVariantHints = getBulkVariantHintsForCategory('', hintCategory);

  useEffect(() => {
    if (!isOpen) return;
    const vendorId = resolveVendorId();
    if (!vendorId) return;
    let cancelled = false;
    void (async () => {
      try {
        const data = await vendorApiClient.get<{ commissionModel?: 'category' | 'ownership' | null }>(
          `/vendor/${vendorId}/ecommerce/commission-model`
        );
        if (!cancelled) setCommissionModel(data.commissionModel ?? null);
      } catch {
        if (!cancelled) setCommissionModel(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isOpen, vendorIdOverride]);

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
    const headers = ['name*', 'description', 'key_features', 'brand', 'category*', 'product_specifications', 'weight', 'length_cm', 'breadth_cm', 'height_cm', 'barcode', 'stock_quantity*', 'images*', 'selling_price', 'mrp*', 'pet_type', 'tax*', 'hsn_code*', 'manufacturing_details', 'delivery_regions', 'product_group_id', 'variant_attr_1', 'variant_value_1', 'variant_attr_2', 'variant_value_2', 'variant_attr_3', 'variant_value_3', 'listing_ownership*'];
    const sample = [
      '"Smiling Sunflower Dog Dress"', '"Bright, happy, full of joy."', '"Design: Smiling Flower"', '"15 FURRIES"', '"Pet Accessories"', '"Material:Cotton"', '0.15', '35', '25', '1', '', '100', '"https://example.com/your-product-image-1000x1000.jpg"', '799', '1598', 'Dog', '5%', '62052000', '"Made in India"', '"Mumbai, Pune"', '', '', '', '', '', '', '"Third party"'
    ];
    const csv = headers.join(',') + '\n' + sample.join(',');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    void downloadBlob({
      blob,
      fileName: 'product_upload_template_simple.csv',
      title: 'Product upload template',
      previewHtmlInBrowser: false,
    });
    setTemplateOkMessage(
      'Downloaded simple CSV. Required: name, category, mrp, stock_quantity, hsn_code, gst_rate, images. Optional: selling_price (defaults to MRP).',
    );
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
      await downloadBlob({
        blob,
        fileName: 'product_upload_template.xlsx',
        title: 'Product upload template',
        previewHtmlInBrowser: false,
      });
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
      const nextValid = validationResult.validProducts || [];
      setValidProducts(nextValid);
      setProductGroups(groupValidProductsForPreview(nextValid));
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
    setProductGroups([]);
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

              <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 text-left">
                <h4 className="font-semibold text-orange-900 mb-2">Variant column hints (max {MAX_VARIANT_ATTRIBUTES} attributes per product)</h4>
                <p className="text-xs text-orange-800 mb-3">
                  Each row = one SKU. Use Variant Attribute 1–3 columns — any custom names allowed. See the <strong>Variant Guide</strong> sheet in the Excel template.
                </p>
                <label className="block text-xs font-medium text-orange-900 mb-1">Category for suggestions</label>
                <select
                  value={hintCategory}
                  onChange={(e) => setHintCategory(e.target.value)}
                  className="w-full max-w-xs mb-3 px-3 py-2 text-sm border border-orange-200 rounded-lg bg-white"
                >
                  {['Pet Food', 'Pet Clothing', 'Pet Accessories', 'Pet Grooming', 'Pet Beds & Furniture', 'Pet Toys', 'Pet Health', 'Pet Pharmacy', 'Pet Training', 'Pet Travel'].map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
                <ul className="text-sm text-orange-900 space-y-1">
                  <li><strong>Attr 1 examples:</strong> {bulkVariantHints.attr1Examples.join(', ') || '—'}</li>
                  <li><strong>Attr 2 examples:</strong> {bulkVariantHints.attr2Examples.join(', ') || '—'}</li>
                  {bulkVariantHints.attr3Examples.length > 0 && (
                    <li><strong>Attr 3 examples:</strong> {bulkVariantHints.attr3Examples.join(', ')}</li>
                  )}
                  {bulkVariantHints.sampleCombos.map((combo, i) => (
                    <li key={i}><strong>Example {i + 1}:</strong> {combo}</li>
                  ))}
                </ul>
              </div>

              {commissionModel === 'ownership' && (
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-900">
                  <strong>Listing Ownership*</strong> column is required for your seller account. Use{' '}
                  <em>Own brand</em> or <em>Third party</em> on each product row (column AB in the
                  Excel template).
                </div>
              )}

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

              {/* Grouped preview — same Title + Category = one product */}
              <div className="border rounded-xl overflow-hidden">
                <div className="bg-gray-50 px-4 py-3 font-semibold text-gray-700">
                  Product groups ({productGroups.length} product{productGroups.length === 1 ? '' : 's'},{' '}
                  {validProducts.length} variant row{validProducts.length === 1 ? '' : 's'})
                </div>
                <div className="max-h-64 overflow-y-auto divide-y">
                  {productGroups.slice(0, 15).map((group, gi) => (
                    <div key={gi} className="px-4 py-3">
                      <p className="font-medium text-gray-900">{group.name}</p>
                      <p className="text-xs text-gray-500 mb-2">{group.category || 'Uncategorized'}</p>
                      {group.variants.length > MAX_SKUS_PER_PRODUCT && (
                        <p className="text-xs text-amber-700 font-medium mb-2">
                          Warning: {group.variants.length} variant rows exceeds max {MAX_SKUS_PER_PRODUCT} SKUs per product
                        </p>
                      )}
                      <ul className="space-y-1 text-sm text-gray-700">
                        {group.variants.map((v) => (
                          <li key={v.rowNum} className="flex flex-wrap items-center gap-2">
                            <span className="text-gray-400">Row {v.rowNum}</span>
                            <span>{v.label}</span>
                            <span className="text-gray-500">· stock {v.stock}</span>
                            <span className="text-gray-500">· ₹{v.price}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
                {productGroups.length > 15 && (
                  <div className="px-4 py-2 text-sm text-gray-500 bg-gray-50">
                    ...and {productGroups.length - 15} more product groups
                  </div>
                )}
              </div>

              {/* Flat row preview (first 10) */}
              <div className="border rounded-xl overflow-hidden">
                <div className="bg-gray-50 px-4 py-3 font-semibold text-gray-700">
                  Rows preview (first 10)
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
                        <th className="px-3 py-2 text-left">Variant</th>
                        <th className="px-3 py-2 text-left">Images</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {validProducts.slice(0, 10).map((product, i) => {
                        const imageCount = countBulkRowImages(product.images ?? product.image_urls);
                        return (
                        <tr key={i} className="hover:bg-gray-50">
                          <td className="px-3 py-2 text-gray-500">{product.rowNum ?? i + 1}</td>
                          <td className="px-3 py-2 font-medium">{product.name}</td>
                          <td className="px-3 py-2 text-gray-600">{product.category || '-'}</td>
                          <td className="px-3 py-2 text-right">₹{product.price}</td>
                          <td className="px-3 py-2 text-right">{product.stock_quantity}</td>
                          <td className="px-3 py-2 text-gray-600 text-xs">{bulkVariantLabel(product)}</td>
                          <td className="px-3 py-2 text-gray-600">
                            {imageCount > 0 ? `${imageCount} image${imageCount === 1 ? '' : 's'}` : '—'}
                          </td>
                        </tr>
                      );})}
                    </tbody>
                  </table>
                </div>
                {validProducts.length > 10 && (
                  <div className="px-4 py-2 text-sm text-gray-500 bg-gray-50">
                    ...and {validProducts.length - 10} more rows
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
                      Upload {validation.validRows} row{validation.validRows === 1 ? '' : 's'} (
                      {productGroups.length} product{productGroups.length === 1 ? '' : 's'})
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
