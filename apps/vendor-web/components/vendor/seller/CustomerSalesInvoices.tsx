'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  FileText,
  Download,
  Eye,
  Search,
  Calendar,
  Building,
  Receipt,
  IndianRupee,
  Printer,
  X,
  Loader2,
} from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import {
  type VendorSalesInvoice,
  type VendorInvoiceSummary,
  normalizeVendorInvoicesListResponse,
  effectiveGstRateFromSummary,
} from '@/lib/seller-invoice-types';
import {
  downloadSalesInvoiceById,
  downloadGstrCsv,
  gstrExportToCsv,
  getSalesInvoiceDownloadMessage,
} from '@/lib/seller-invoice-download';
import { toast } from 'sonner';

interface CustomerSalesInvoicesProps {
  sellerId: string;
  sellerData: Record<string, unknown> | null;
}

function formatMoney(n: number): string {
  return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
}

function formatDate(value: string): string {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value.slice(0, 10) : d.toLocaleDateString('en-IN');
}

function currentMonthValue(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

export function CustomerSalesInvoices({ sellerId, sellerData }: CustomerSalesInvoicesProps) {
  const [invoices, setInvoices] = useState<VendorSalesInvoice[]>([]);
  const [summary, setSummary] = useState<VendorInvoiceSummary>({
    totalInvoices: 0,
    totalSubtotal: 0,
    totalTax: 0,
    totalCGST: 0,
    totalSGST: 0,
    totalIGST: 0,
    totalAmount: 0,
  });
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedInvoice, setSelectedInvoice] = useState<VendorSalesInvoice | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [exportMonth, setExportMonth] = useState(currentMonthValue());
  const [exporting, setExporting] = useState(false);
  const [showExportPicker, setShowExportPicker] = useState(false);

  const loadInvoices = useCallback(async () => {
    if (!sellerId) return;
    try {
      setLoading(true);
      const data = await apiClient.get<unknown>(`/vendor/${sellerId}/invoices`);
      const normalized = normalizeVendorInvoicesListResponse(data);
      setInvoices(normalized.invoices);
      setSummary(normalized.summary);
    } catch (error) {
      console.error('Error loading invoices:', error);
      setInvoices([]);
      toast.error('Could not load invoices');
    } finally {
      setLoading(false);
    }
  }, [sellerId]);

  useEffect(() => {
    loadInvoices();
  }, [loadInvoices]);

  const filteredInvoices = invoices.filter((invoice) => {
    const q = searchQuery.toLowerCase();
    return (
      invoice.invoiceNumber.toLowerCase().includes(q) ||
      (invoice.customerName ?? '').toLowerCase().includes(q)
    );
  });

  const effectiveRate = effectiveGstRateFromSummary(summary);
  const hasCgstSgst = summary.totalCGST > 0 || summary.totalSGST > 0;
  const hasIgst = summary.totalIGST > 0;

  const handleDownload = async (invoice: VendorSalesInvoice) => {
    try {
      setDownloadingId(invoice.id);
      const result = await downloadSalesInvoiceById(invoice.id, invoice.invoiceNumber);
      toast.success(getSalesInvoiceDownloadMessage(result.saveResult));
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : 'Download failed');
    } finally {
      setDownloadingId(null);
    }
  };

  const handlePrint = async (invoice: VendorSalesInvoice) => {
    try {
      setDownloadingId(invoice.id);
      const result = await downloadSalesInvoiceById(invoice.id, invoice.invoiceNumber);
      if (result.openedInBrowser) {
        toast.success('Invoice opened — use Print from your browser');
      } else {
        toast.success(getSalesInvoiceDownloadMessage(result.saveResult));
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not open invoice');
    } finally {
      setDownloadingId(null);
    }
  };

  const handleExportGstr = async () => {
    try {
      setExporting(true);
      const data = await apiClient.get<{
        export?: { b2b?: Record<string, string>[]; b2c?: Record<string, string>[]; hsn?: Record<string, string | number>[] };
      }>(`/vendor/${sellerId}/gstr1-export?month=${exportMonth}`);
      const exportPayload = (data as { export?: typeof data.export }).export ?? (data as { data?: { export?: typeof data.export } }).data?.export;
      if (!exportPayload) {
        toast.error('No export data returned');
        return;
      }
      const csv = gstrExportToCsv(exportPayload);
      if (!csv.trim()) {
        toast.info('No invoices for the selected month');
        return;
      }
      downloadGstrCsv(csv, exportMonth);
      toast.success('GSTR-1 export downloaded');
      setShowExportPicker(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Export failed');
    } finally {
      setExporting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-orange-200 border-t-orange-500 mx-auto" />
          <p className="mt-4 text-slate-500">Loading invoices...</p>
        </div>
      </div>
    );
  }

  const gstin = String(sellerData?.gst_number ?? sellerData?.gstin ?? '');
  const businessName = String(
    sellerData?.business_name ?? sellerData?.businessName ?? 'Your Business'
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Customer Sales Invoices</h2>
          <p className="text-slate-500 mt-1 text-sm">Tax invoices issued to your customers on completed orders</p>
        </div>
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowExportPicker((v) => !v)}
            className="flex items-center gap-2 px-5 py-3 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-xl font-semibold shadow-lg shadow-orange-500/25 hover:shadow-xl transition-all"
          >
            <Download className="w-5 h-5" />
            Export Report
          </button>
          {showExportPicker && (
            <div className="absolute right-0 top-full mt-2 z-20 bg-white border border-slate-200 rounded-xl shadow-lg p-4 w-72">
              <p className="text-sm font-medium text-slate-700 mb-2">GSTR-1 export month</p>
              <input
                type="month"
                value={exportMonth}
                onChange={(e) => setExportMonth(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm mb-3"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleExportGstr}
                  disabled={exporting}
                  className="flex-1 px-3 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium disabled:opacity-60"
                >
                  {exporting ? 'Exporting…' : 'Download CSV'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowExportPicker(false)}
                  className="px-3 py-2 border border-slate-200 rounded-lg text-sm"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-2xl p-6 text-white shadow-xl">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <div className="p-4 bg-white/20 rounded-xl">
              <Building className="w-8 h-8" />
            </div>
            <div>
              <p className="text-indigo-200 text-sm">Business GSTIN</p>
              <p className="text-2xl font-bold mt-1">{gstin || 'Not Registered'}</p>
              <p className="text-indigo-200 text-sm mt-1">{businessName}</p>
            </div>
          </div>
          <div className="text-right">
            {summary.totalInvoices > 0 && effectiveRate != null ? (
              <>
                <p className="text-indigo-200 text-sm">Effective GST (from invoices)</p>
                <p className="text-4xl font-bold mt-1">{effectiveRate}%</p>
                <p className="text-indigo-200 text-sm mt-1">
                  {hasIgst && !hasCgstSgst
                    ? 'IGST on inter-state sales'
                    : hasCgstSgst
                      ? 'CGST + SGST on intra-state sales'
                      : 'Mixed rates by product/service'}
                </p>
              </>
            ) : (
              <>
                <p className="text-indigo-200 text-sm">GST rates</p>
                <p className="text-lg font-semibold mt-1">Admin configured per HSN / category</p>
                <p className="text-indigo-200 text-sm mt-1">Shown on each invoice when generated</p>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-100 rounded-xl">
              <FileText className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-slate-500">Total Invoices</p>
              <p className="text-2xl font-bold text-slate-900">{summary.totalInvoices}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-emerald-100 rounded-xl">
              <IndianRupee className="w-6 h-6 text-emerald-600" />
            </div>
            <div>
              <p className="text-sm text-slate-500">Total Revenue</p>
              <p className="text-2xl font-bold text-emerald-600">{formatMoney(summary.totalAmount)}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-purple-100 rounded-xl">
              <Receipt className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-slate-500">Total GST Collected</p>
              <p className="text-2xl font-bold text-purple-600">{formatMoney(summary.totalTax)}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-amber-100 rounded-xl">
              <Calendar className="w-6 h-6 text-amber-600" />
            </div>
            <div>
              <p className="text-sm text-slate-500">Taxable Value</p>
              <p className="text-2xl font-bold text-amber-600">{formatMoney(summary.totalSubtotal)}</p>
            </div>
          </div>
        </div>
      </div>

      {(hasCgstSgst || hasIgst) && (
        <div className="bg-gradient-to-r from-slate-50 to-slate-100 rounded-2xl p-6 border border-slate-200">
          <h3 className="font-semibold text-slate-900 mb-4">GST collected (from your invoices)</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {hasCgstSgst && (
              <>
                <div className="bg-white rounded-xl p-4 border border-slate-200">
                  <p className="text-sm text-slate-500">CGST</p>
                  <p className="text-xl font-bold text-slate-900">{formatMoney(summary.totalCGST)}</p>
                </div>
                <div className="bg-white rounded-xl p-4 border border-slate-200">
                  <p className="text-sm text-slate-500">SGST</p>
                  <p className="text-xl font-bold text-slate-900">{formatMoney(summary.totalSGST)}</p>
                </div>
              </>
            )}
            {hasIgst && (
              <div className="bg-white rounded-xl p-4 border border-slate-200">
                <p className="text-sm text-slate-500">IGST</p>
                <p className="text-xl font-bold text-slate-900">{formatMoney(summary.totalIGST)}</p>
              </div>
            )}
            <div className="bg-white rounded-xl p-4 border border-slate-200">
              <p className="text-sm text-slate-500">Total tax</p>
              <p className="text-xl font-bold text-orange-600">{formatMoney(summary.totalTax)}</p>
            </div>
          </div>
        </div>
      )}

      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
        <input
          type="text"
          placeholder="Search by invoice number or customer..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
        />
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        {filteredInvoices.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <FileText className="w-8 h-8 text-slate-400" />
            </div>
            <p className="text-slate-600 font-medium">No customer sales invoices yet</p>
            <p className="text-sm text-slate-400 mt-1 max-w-md mx-auto">
              Invoices are created when orders are delivered. Complete an order in Orders, or ask
              your customer to download their invoice from My Orders.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px]">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th className="text-left p-4 font-semibold text-slate-600 text-sm">Invoice #</th>
                  <th className="text-left p-4 font-semibold text-slate-600 text-sm">Date</th>
                  <th className="text-left p-4 font-semibold text-slate-600 text-sm">Customer</th>
                  <th className="text-right p-4 font-semibold text-slate-600 text-sm">Amount</th>
                  <th className="text-right p-4 font-semibold text-slate-600 text-sm">GST</th>
                  <th className="text-right p-4 font-semibold text-slate-600 text-sm">Total</th>
                  <th className="text-center p-4 font-semibold text-slate-600 text-sm">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredInvoices.map((invoice) => (
                  <tr key={invoice.id} className="hover:bg-slate-50 transition-colors">
                    <td className="p-4 font-mono font-medium text-slate-900 text-sm">
                      {invoice.invoiceNumber}
                    </td>
                    <td className="p-4 text-slate-600 text-sm">{formatDate(invoice.date)}</td>
                    <td className="p-4 text-slate-600 text-sm">{invoice.customerName || '—'}</td>
                    <td className="p-4 text-right text-slate-900 text-sm">
                      {formatMoney(invoice.subtotal)}
                    </td>
                    <td className="p-4 text-right text-purple-600 font-medium text-sm">
                      {formatMoney(invoice.tax)}
                    </td>
                    <td className="p-4 text-right font-bold text-slate-900 text-sm">
                      {formatMoney(invoice.total)}
                    </td>
                    <td className="p-4">
                      <div className="flex justify-center gap-2">
                        <button
                          type="button"
                          onClick={() => setSelectedInvoice(invoice)}
                          className="p-2 hover:bg-blue-50 text-blue-600 rounded-lg transition-colors"
                          title="View"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handlePrint(invoice)}
                          disabled={downloadingId === invoice.id}
                          className="p-2 hover:bg-slate-50 text-slate-600 rounded-lg transition-colors disabled:opacity-50"
                          title="Print"
                        >
                          {downloadingId === invoice.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Printer className="w-4 h-4" />
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDownload(invoice)}
                          disabled={downloadingId === invoice.id}
                          className="p-2 hover:bg-emerald-50 text-emerald-600 rounded-lg transition-colors disabled:opacity-50"
                          title="Download"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selectedInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 relative">
            <button
              type="button"
              onClick={() => setSelectedInvoice(null)}
              className="absolute top-4 right-4 p-1 text-slate-400 hover:text-slate-600"
            >
              <X className="w-5 h-5" />
            </button>
            <h3 className="text-lg font-bold text-slate-900 mb-4">Invoice details</h3>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-slate-500">Invoice #</dt>
                <dd className="font-mono font-medium">{selectedInvoice.invoiceNumber}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">Customer</dt>
                <dd>{selectedInvoice.customerName || '—'}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">Date</dt>
                <dd>{formatDate(selectedInvoice.date)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">Subtotal</dt>
                <dd>{formatMoney(selectedInvoice.subtotal)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">GST</dt>
                <dd>{formatMoney(selectedInvoice.tax)}</dd>
              </div>
              {selectedInvoice.cgst > 0 && (
                <div className="flex justify-between">
                  <dt className="text-slate-500">CGST / SGST</dt>
                  <dd>
                    {formatMoney(selectedInvoice.cgst)} / {formatMoney(selectedInvoice.sgst)}
                  </dd>
                </div>
              )}
              {selectedInvoice.igst > 0 && (
                <div className="flex justify-between">
                  <dt className="text-slate-500">IGST</dt>
                  <dd>{formatMoney(selectedInvoice.igst)}</dd>
                </div>
              )}
              <div className="flex justify-between border-t pt-2 font-semibold">
                <dt>Total</dt>
                <dd>{formatMoney(selectedInvoice.total)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">Supply</dt>
                <dd>{selectedInvoice.isInterState ? 'Inter-state (IGST)' : 'Intra-state'}</dd>
              </div>
            </dl>
            <button
              type="button"
              onClick={() => {
                handleDownload(selectedInvoice);
                setSelectedInvoice(null);
              }}
              className="mt-6 w-full py-3 bg-orange-500 text-white rounded-xl font-semibold hover:bg-orange-600"
            >
              Download invoice
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
