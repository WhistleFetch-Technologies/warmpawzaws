'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  FileText,
  Download,
  Eye,
  RefreshCcw,
  AlertCircle,
  Loader2,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  getPlatformTaxApiStatus,
  getPlatformTaxDocuments,
  getPlatformTaxDocument,
} from '@/lib/platform-tax/platform-tax-service';
import type {
  PlatformTaxApiStatus,
  PlatformTaxDocumentDetail,
  PlatformTaxDocumentSummary,
} from '@/lib/platform-tax/types';
import { downloadFromApi, getDownloadMessage } from '@/lib/download-file';

interface PlatformCommissionInvoicesProps {
  sellerId: string;
}

function formatMoney(value: number): string {
  return `₹${value.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(value: string | null | undefined): string {
  if (!value) return '—';
  return value.slice(0, 10);
}

function formatPeriod(from: string, to: string): string {
  return `${formatDate(from)} – ${formatDate(to)}`;
}

function docTypeLabel(type: string): string {
  if (type === 'CREDIT_NOTE') return 'Credit note';
  if (type === 'DEBIT_NOTE') return 'Debit note';
  return 'Tax invoice';
}

type PlatformTaxUnavailableReason = Extract<
  PlatformTaxApiStatus,
  { available: false }
>['reason'];

function DisabledState({ reason }: { reason: PlatformTaxUnavailableReason }) {
  const detail =
    reason === 'MIGRATION_REQUIRED'
      ? 'Database migration is pending on the API environment. Contact your administrator.'
      : reason === 'DISABLED'
        ? 'Platform tax documents are not enabled on the backend yet.'
        : 'Platform tax API is not available. Try again later.';

  return (
    <div className="flex flex-col items-center justify-center px-3 py-8 text-center sm:px-6 sm:py-12">
      <div className="max-w-lg rounded-xl border border-orange-100 bg-orange-50 px-4 py-6 sm:rounded-2xl sm:px-8 sm:py-10">
        <FileText className="mx-auto mb-3 h-8 w-8 text-orange-500 sm:mb-4 sm:h-12 sm:w-12" />
        <h2 className="text-base font-semibold text-slate-900 sm:text-xl">Platform tax documents</h2>
        <p className="mt-2 text-orange-700 font-medium">Not available</p>
        <p className="mt-1 text-slate-600 text-sm">{detail}</p>
      </div>
    </div>
  );
}

export function PlatformCommissionInvoices({ sellerId }: PlatformCommissionInvoicesProps) {
  const [apiStatus, setApiStatus] = useState<PlatformTaxApiStatus | null>(null);
  const [documents, setDocuments] = useState<PlatformTaxDocumentSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [selectedDoc, setSelectedDoc] = useState<PlatformTaxDocumentDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const load = useCallback(async () => {
    if (!sellerId) return;
    setLoading(true);
    try {
      const status = await getPlatformTaxApiStatus(sellerId);
      setApiStatus(status);
      if (!status.available) {
        setDocuments([]);
        setTotal(0);
        return;
      }
      const { documents: docs, total: t } = await getPlatformTaxDocuments(sellerId, { limit: 50 });
      setDocuments(docs);
      setTotal(t);
    } catch (err) {
      console.error(err);
      setApiStatus({ available: false, reason: 'UNAVAILABLE' });
    } finally {
      setLoading(false);
    }
  }, [sellerId]);

  useEffect(() => {
    load();
  }, [load]);

  const handleView = async (doc: PlatformTaxDocumentSummary) => {
    try {
      setDetailLoading(true);
      const detail = await getPlatformTaxDocument(sellerId, doc.id);
      setSelectedDoc(detail);
    } catch {
      toast.error('Could not load document details');
    } finally {
      setDetailLoading(false);
    }
  };

  const handleDownloadDocument = async (doc: PlatformTaxDocumentSummary) => {
    try {
      setDownloadingId(doc.id);
      const fileName = doc.invoiceNumber
        ? `platform-tax-${doc.invoiceNumber.replace(/[^\w.-]+/g, '_')}.html`
        : `platform-tax-${doc.id.slice(0, 8)}.html`;
      const result = await downloadFromApi({
        path: `/vendor/${sellerId}/platform-tax-documents/${doc.id}/pdf`,
        fileName,
        title: docTypeLabel(doc.documentType),
        shareText: 'Save the WarmPawz tax document.',
        shareDialogTitle: 'Save document',
        previewHtmlInBrowser: true,
      });
      toast.success(getDownloadMessage(result.saveResult, 'document'));
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Download failed';
      if (msg.includes('404') || msg.includes('PDF_NOT_GENERATED')) {
        toast.error('Document file has not been generated yet. Please try again later.');
      } else {
        toast.error(msg);
      }
    } finally {
      setDownloadingId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-orange-200 border-t-orange-500" />
      </div>
    );
  }

  if (apiStatus && !apiStatus.available) {
    return (
      <div className="space-y-3 sm:space-y-4">
        <div>
          <h2 className="text-sm font-bold text-slate-900 sm:text-xl">Platform documents</h2>
          <p className="mt-0.5 hidden text-sm text-slate-500 sm:block">
            GST tax invoices and credit notes issued by WarmPawz for platform commission and fees
          </p>
        </div>
        <DisabledState reason={apiStatus.reason} />
        <button
          type="button"
          onClick={load}
          className="mx-auto flex items-center gap-2 text-sm text-orange-600 hover:text-orange-700"
        >
          <RefreshCcw className="w-4 h-4" />
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3 sm:space-y-6">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <h2 className="text-sm font-bold text-slate-900 sm:text-xl">Platform documents</h2>
          <p className="mt-0.5 hidden text-sm text-slate-500 sm:block">
            Commission and platform fee tax invoices issued by WarmPawz to your business
          </p>
        </div>
        <button
          type="button"
          onClick={load}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-600 hover:bg-slate-50 sm:rounded-xl sm:px-4 sm:text-sm"
        >
          <RefreshCcw className="h-4 w-4" />
          Refresh
        </button>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-100 bg-white shadow-sm sm:rounded-2xl">
        {documents.length === 0 ? (
          <div className="p-8 text-center sm:p-12">
            <AlertCircle className="mx-auto mb-3 h-8 w-8 text-slate-300 sm:h-10 sm:w-10" />
            <p className="text-sm font-medium text-slate-600 sm:text-base">No platform invoices issued yet</p>
            <p className="mx-auto mt-1 max-w-md text-xs text-slate-400 sm:text-sm">
              WarmPawz will issue tax documents for platform commission after admin settlement /
              billing runs for your account.
            </p>
          </div>
        ) : (
          <>
            <div className="divide-y divide-slate-100 md:hidden">
              {documents.map((doc) => (
                <div key={doc.id} className="flex items-center gap-2 px-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-mono text-xs font-medium text-slate-900">
                      {doc.invoiceNumber || doc.id.slice(0, 8)}
                    </p>
                    <p className="mt-0.5 truncate text-[11px] text-slate-500">
                      {formatPeriod(doc.periodFrom, doc.periodTo)} · {docTypeLabel(doc.documentType)}
                    </p>
                    <p className="mt-0.5 text-xs">
                      <span className="font-semibold">{formatMoney(doc.totalAmount)}</span>
                      <span className="text-purple-600"> · GST {formatMoney(doc.gstAmount)}</span>
                      <span
                        className={`ml-1 inline-flex rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
                          doc.status === 'ISSUED'
                            ? 'bg-emerald-100 text-emerald-700'
                            : doc.status === 'VOID'
                              ? 'bg-slate-100 text-slate-600'
                              : 'bg-amber-100 text-amber-700'
                        }`}
                      >
                        {doc.status}
                      </span>
                    </p>
                  </div>
                  <div className="flex shrink-0">
                    <button
                      type="button"
                      onClick={() => handleView(doc)}
                      disabled={detailLoading}
                      className="rounded-lg p-2 text-blue-600 hover:bg-blue-50"
                      title="View"
                    >
                      <Eye className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDownloadDocument(doc)}
                      disabled={downloadingId === doc.id || doc.status !== 'ISSUED'}
                      className="rounded-lg p-2 text-emerald-600 hover:bg-emerald-50 disabled:opacity-40"
                      title="Download document"
                    >
                      {downloadingId === doc.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Download className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <div className="hidden overflow-x-auto md:block">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th className="text-left p-3 text-sm font-semibold text-slate-600">Document</th>
                  <th className="text-left p-3 text-sm font-semibold text-slate-600">Period</th>
                  <th className="text-left p-3 text-sm font-semibold text-slate-600">Type</th>
                  <th className="text-right p-3 text-sm font-semibold text-slate-600">Taxable</th>
                  <th className="text-right p-3 text-sm font-semibold text-slate-600">GST</th>
                  <th className="text-right p-3 text-sm font-semibold text-slate-600">Total</th>
                  <th className="text-center p-3 text-sm font-semibold text-slate-600">Status</th>
                  <th className="text-center p-3 text-sm font-semibold text-slate-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {documents.map((doc) => (
                  <tr key={doc.id} className="hover:bg-slate-50">
                    <td className="p-3 font-mono text-sm">{doc.invoiceNumber || doc.id.slice(0, 8)}</td>
                    <td className="p-3 text-sm text-slate-600">
                      {formatPeriod(doc.periodFrom, doc.periodTo)}
                    </td>
                    <td className="p-3 text-sm">{docTypeLabel(doc.documentType)}</td>
                    <td className="p-3 text-right text-sm">{formatMoney(doc.taxableAmount)}</td>
                    <td className="p-3 text-right text-sm text-purple-600">
                      {formatMoney(doc.gstAmount)}
                    </td>
                    <td className="p-3 text-right text-sm font-semibold">
                      {formatMoney(doc.totalAmount)}
                    </td>
                    <td className="p-3 text-center">
                      <span
                        className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
                          doc.status === 'ISSUED'
                            ? 'bg-emerald-100 text-emerald-700'
                            : doc.status === 'VOID'
                              ? 'bg-slate-100 text-slate-600'
                              : 'bg-amber-100 text-amber-700'
                        }`}
                      >
                        {doc.status}
                      </span>
                    </td>
                    <td className="p-3">
                      <div className="flex justify-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleView(doc)}
                          disabled={detailLoading}
                          className="p-2 hover:bg-blue-50 text-blue-600 rounded-lg"
                          title="View"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDownloadDocument(doc)}
                          disabled={downloadingId === doc.id || doc.status !== 'ISSUED'}
                          className="p-2 hover:bg-emerald-50 text-emerald-600 rounded-lg disabled:opacity-40"
                          title="Download document"
                        >
                          {downloadingId === doc.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Download className="w-4 h-4" />
                          )}
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

      {total > documents.length && (
        <p className="text-sm text-slate-500 text-center">
          Showing {documents.length} of {total} documents
        </p>
      )}

      {selectedDoc && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-3 sm:items-center sm:p-4">
          <div className="relative max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-4 shadow-xl sm:p-6">
            <button
              type="button"
              onClick={() => setSelectedDoc(null)}
              className="absolute top-4 right-4 p-1 text-slate-400 hover:text-slate-600"
            >
              <X className="w-5 h-5" />
            </button>
            <h3 className="mb-3 pr-8 text-base font-bold text-slate-900 sm:mb-4 sm:text-lg">
              {docTypeLabel(selectedDoc.documentType)}
            </h3>
            <dl className="space-y-2 text-sm mb-4">
              <div className="flex justify-between">
                <dt className="text-slate-500">Number</dt>
                <dd className="font-mono">{selectedDoc.invoiceNumber || '—'}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">Period</dt>
                <dd>{formatPeriod(selectedDoc.periodFrom, selectedDoc.periodTo)}</dd>
              </div>
              <div className="flex justify-between font-semibold border-t pt-2">
                <dt>Total</dt>
                <dd>{formatMoney(selectedDoc.totalAmount)}</dd>
              </div>
            </dl>
            {selectedDoc.lines?.length > 0 && (
              <div className="border-t pt-4">
                <p className="text-sm font-medium text-slate-700 mb-2">Line items</p>
                <ul className="space-y-2 text-sm">
                  {selectedDoc.lines.map((line) => (
                    <li key={line.id} className="flex justify-between gap-2">
                      <span className="text-slate-600 truncate">{line.description}</span>
                      <span className="shrink-0">
                        {formatMoney(line.totalAmount)} @ {line.gstRate}% GST
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {selectedDoc.status === 'ISSUED' && (
              <button
                type="button"
                onClick={() => {
                  handleDownloadDocument(selectedDoc);
                  setSelectedDoc(null);
                }}
                className="mt-4 w-full rounded-xl bg-orange-500 py-2.5 text-sm font-semibold text-white sm:mt-6 sm:py-3"
              >
                Download document
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
