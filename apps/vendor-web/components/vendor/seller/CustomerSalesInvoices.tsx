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
      <div className="flex h-full min-h-[200px] items-center justify-center sm:min-h-[400px]">
        <div className="text-center">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-orange-200 border-t-orange-500 sm:h-16 sm:w-16" />
          <p className="mt-3 text-sm text-slate-500 sm:mt-4">Loading invoices...</p>
        </div>
      </div>
    );
  }

  const gstin = String(sellerData?.gst_number ?? sellerData?.gstin ?? '');
  const businessName = String(
    sellerData?.business_name ?? sellerData?.businessName ?? 'Your Business'
  );

  return (
    <div className="space-y-3 sm:space-y-6">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <h2 className="text-sm font-bold text-slate-900 sm:text-xl">Customer sales</h2>
          <p className="mt-0.5 hidden text-sm text-slate-500 sm:block">
            Tax invoices issued to your customers on completed orders
          </p>
        </div>
        <div className="relative shrink-0">
          <button
            type="button"
            onClick={() => setShowExportPicker((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-orange-500 to-amber-500 px-3 py-2 text-xs font-semibold text-white sm:rounded-xl sm:px-5 sm:py-3 sm:text-sm"
          >
            <Download className="h-4 w-4 sm:h-5 sm:w-5" />
            Export
          </button>
          {showExportPicker && (
            <div className="absolute right-0 top-full z-20 mt-2 w-[min(18rem,calc(100vw-2rem))] rounded-xl border border-slate-200 bg-white p-4 shadow-lg">
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

      <div className="rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 p-3 text-white shadow-lg sm:rounded-2xl sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2 sm:gap-4">
            <div className="shrink-0 rounded-lg bg-white/20 p-2 sm:rounded-xl sm:p-4">
              <Building className="h-5 w-5 sm:h-8 sm:w-8" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] text-indigo-200 sm:text-sm">Business GSTIN</p>
              <p className="truncate text-sm font-bold sm:text-2xl">{gstin || 'Not Registered'}</p>
              <p className="truncate text-[11px] text-indigo-200 sm:text-sm">{businessName}</p>
            </div>
          </div>
          <div className="shrink-0 text-right">
            {summary.totalInvoices > 0 && effectiveRate != null ? (
              <>
                <p className="text-[11px] text-indigo-200 sm:text-sm">Effective GST</p>
                <p className="text-xl font-bold sm:text-4xl">{effectiveRate}%</p>
              </>
            ) : (
              <p className="max-w-[9rem] text-[11px] text-indigo-100 sm:max-w-none sm:text-sm">
                GST rates set per HSN / category
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 md:grid-cols-4 sm:gap-4">
        <div className="rounded-xl border border-slate-100 bg-white p-2.5 shadow-sm sm:rounded-2xl sm:p-5">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="rounded-lg bg-blue-100 p-1.5 sm:rounded-xl sm:p-3">
              <FileText className="h-4 w-4 text-blue-600 sm:h-6 sm:w-6" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] text-slate-500 sm:text-sm">Total Invoices</p>
              <p className="text-base font-bold text-slate-900 sm:text-2xl">{summary.totalInvoices}</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-slate-100 bg-white p-2.5 shadow-sm sm:rounded-2xl sm:p-5">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="rounded-lg bg-emerald-100 p-1.5 sm:rounded-xl sm:p-3">
              <IndianRupee className="h-4 w-4 text-emerald-600 sm:h-6 sm:w-6" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] text-slate-500 sm:text-sm">Total Revenue</p>
              <p className="text-base font-bold text-emerald-600 sm:text-2xl">{formatMoney(summary.totalAmount)}</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-slate-100 bg-white p-2.5 shadow-sm sm:rounded-2xl sm:p-5">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="rounded-lg bg-purple-100 p-1.5 sm:rounded-xl sm:p-3">
              <Receipt className="h-4 w-4 text-purple-600 sm:h-6 sm:w-6" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] text-slate-500 sm:text-sm">Total GST Collected</p>
              <p className="text-base font-bold text-purple-600 sm:text-2xl">{formatMoney(summary.totalTax)}</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-slate-100 bg-white p-2.5 shadow-sm sm:rounded-2xl sm:p-5">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="rounded-lg bg-amber-100 p-1.5 sm:rounded-xl sm:p-3">
              <Calendar className="h-4 w-4 text-amber-600 sm:h-6 sm:w-6" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] text-slate-500 sm:text-sm">Taxable Value</p>
              <p className="text-base font-bold text-amber-600 sm:text-2xl">{formatMoney(summary.totalSubtotal)}</p>
            </div>
          </div>
        </div>
      </div>

      {(hasCgstSgst || hasIgst) && (
        <div className="rounded-xl border border-slate-200 bg-gradient-to-r from-slate-50 to-slate-100 p-3 sm:rounded-2xl sm:p-6">
          <h3 className="mb-2 text-xs font-semibold text-slate-900 sm:mb-4 sm:text-base">GST collected</h3>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4 sm:gap-4">
            {hasCgstSgst && (
              <>
                <div className="rounded-lg border border-slate-200 bg-white p-2.5 sm:rounded-xl sm:p-4">
                  <p className="text-[11px] text-slate-500 sm:text-sm">CGST</p>
                  <p className="text-sm font-bold text-slate-900 sm:text-xl">{formatMoney(summary.totalCGST)}</p>
                </div>
                <div className="rounded-lg border border-slate-200 bg-white p-2.5 sm:rounded-xl sm:p-4">
                  <p className="text-[11px] text-slate-500 sm:text-sm">SGST</p>
                  <p className="text-sm font-bold text-slate-900 sm:text-xl">{formatMoney(summary.totalSGST)}</p>
                </div>
              </>
            )}
            {hasIgst && (
              <div className="rounded-lg border border-slate-200 bg-white p-2.5 sm:rounded-xl sm:p-4">
                <p className="text-[11px] text-slate-500 sm:text-sm">IGST</p>
                <p className="text-sm font-bold text-slate-900 sm:text-xl">{formatMoney(summary.totalIGST)}</p>
              </div>
            )}
            <div className="rounded-lg border border-slate-200 bg-white p-2.5 sm:rounded-xl sm:p-4">
              <p className="text-[11px] text-slate-500 sm:text-sm">Total tax</p>
              <p className="text-sm font-bold text-orange-600 sm:text-xl">{formatMoney(summary.totalTax)}</p>
            </div>
          </div>
        </div>
      )}

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 sm:left-4 sm:h-5 sm:w-5" />
        <input
          type="text"
          placeholder="Search invoice or customer..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20 sm:rounded-xl sm:py-3 sm:pl-12 sm:pr-4"
        />
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-100 bg-white shadow-sm sm:rounded-2xl">
        {filteredInvoices.length === 0 ? (
          <div className="p-8 text-center sm:p-12">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 sm:mb-4 sm:h-16 sm:w-16">
              <FileText className="h-6 w-6 text-slate-400 sm:h-8 sm:w-8" />
            </div>
            <p className="text-sm font-medium text-slate-600 sm:text-base">No customer sales invoices yet</p>
            <p className="mx-auto mt-1 max-w-md text-xs text-slate-400 sm:text-sm">
              Invoices are created when orders are delivered. Complete an order in Orders, or ask
              your customer to download their invoice from My Orders.
            </p>
          </div>
        ) : (
          <>
            <div className="divide-y divide-slate-100 md:hidden">
              {filteredInvoices.map((invoice) => (
                <div key={invoice.id} className="flex items-center gap-2 px-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-mono text-xs font-medium text-slate-900">
                      {invoice.invoiceNumber}
                    </p>
                    <p className="mt-0.5 truncate text-[11px] text-slate-500">
                      {formatDate(invoice.date)} · {invoice.customerName || '—'}
                    </p>
                    <p className="mt-0.5 text-xs">
                      <span className="font-semibold text-slate-900">{formatMoney(invoice.total)}</span>
                      <span className="text-purple-600"> · GST {formatMoney(invoice.tax)}</span>
                    </p>
                  </div>
                  <div className="flex shrink-0">
                    <button
                      type="button"
                      onClick={() => setSelectedInvoice(invoice)}
                      className="rounded-lg p-2 text-blue-600 hover:bg-blue-50"
                      title="View"
                    >
                      <Eye className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handlePrint(invoice)}
                      disabled={downloadingId === invoice.id}
                      className="rounded-lg p-2 text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                      title="Print"
                    >
                      {downloadingId === invoice.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Printer className="h-4 w-4" />
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDownload(invoice)}
                      disabled={downloadingId === invoice.id}
                      className="rounded-lg p-2 text-emerald-600 hover:bg-emerald-50 disabled:opacity-50"
                      title="Download"
                    >
                      <Download className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <div className="hidden overflow-x-auto md:block">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th className="text-left p-3 font-semibold text-slate-600 text-sm">Invoice #</th>
                  <th className="text-left p-3 font-semibold text-slate-600 text-sm">Date</th>
                  <th className="text-left p-3 font-semibold text-slate-600 text-sm">Customer</th>
                  <th className="text-right p-3 font-semibold text-slate-600 text-sm">Amount</th>
                  <th className="text-right p-3 font-semibold text-slate-600 text-sm">GST</th>
                  <th className="text-right p-3 font-semibold text-slate-600 text-sm">Total</th>
                  <th className="text-center p-3 font-semibold text-slate-600 text-sm">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredInvoices.map((invoice) => (
                  <tr key={invoice.id} className="hover:bg-slate-50 transition-colors">
                    <td className="p-3 font-mono font-medium text-slate-900 text-sm">
                      {invoice.invoiceNumber}
                    </td>
                    <td className="p-3 text-slate-600 text-sm">{formatDate(invoice.date)}</td>
                    <td className="p-3 text-slate-600 text-sm">{invoice.customerName || '—'}</td>
                    <td className="p-3 text-right text-slate-900 text-sm">
                      {formatMoney(invoice.subtotal)}
                    </td>
                    <td className="p-3 text-right text-purple-600 font-medium text-sm">
                      {formatMoney(invoice.tax)}
                    </td>
                    <td className="p-3 text-right font-bold text-slate-900 text-sm">
                      {formatMoney(invoice.total)}
                    </td>
                    <td className="p-3">
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
          </>
        )}
      </div>

      {selectedInvoice && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-3 sm:items-center sm:p-4">
          <div className="relative w-full max-w-md rounded-2xl bg-white p-4 shadow-xl sm:p-6">
            <button
              type="button"
              onClick={() => setSelectedInvoice(null)}
              className="absolute top-4 right-4 p-1 text-slate-400 hover:text-slate-600"
            >
              <X className="w-5 h-5" />
            </button>
            <h3 className="mb-3 pr-8 text-base font-bold text-slate-900 sm:mb-4 sm:text-lg">Invoice details</h3>
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
              className="mt-4 w-full rounded-xl bg-orange-500 py-2.5 text-sm font-semibold text-white hover:bg-orange-600 sm:mt-6 sm:py-3"
            >
              Download invoice
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
