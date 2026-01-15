'use client';

import { useState, useEffect } from 'react';
import { 
  FileText, Download, Eye, Search, Calendar, 
  Building, Receipt, IndianRupee, Printer, Filter
} from 'lucide-react';
import { apiClient } from '@/lib/api-client';

interface GSTInvoicingProps {
  sellerId: string;
  sellerData: any;
}

export function GSTInvoicing({ sellerId, sellerData }: GSTInvoicingProps) {
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState('all');
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null);

  useEffect(() => {
    loadInvoices();
  }, [sellerId]);

  const loadInvoices = async () => {
    try {
      setLoading(true);
      const data = await apiClient.get<{ invoices?: any[] }>(`/vendor/${sellerId}/invoices`);
      setInvoices(data?.invoices || []);
    } catch (error) {
      console.error('Error loading invoices:', error);
      // Use mock data for demo
      setInvoices([]);
    } finally {
      setLoading(false);
    }
  };

  const stats = {
    totalInvoices: invoices.length,
    totalAmount: invoices.reduce((sum, inv) => sum + (inv.total_amount || 0), 0),
    totalGST: invoices.reduce((sum, inv) => sum + (inv.gst_amount || 0), 0),
    pendingGST: invoices.filter(inv => !inv.gst_filed).length
  };

  const filteredInvoices = invoices.filter(invoice => {
    const matchesSearch = 
      invoice.invoice_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      invoice.customer_name?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSearch;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-orange-200 border-t-orange-500 mx-auto"></div>
          <p className="mt-4 text-slate-500">Loading invoices...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">GST Invoicing</h1>
          <p className="text-slate-500 mt-1">Manage tax invoices and GST compliance</p>
        </div>
        <button className="flex items-center gap-2 px-5 py-3 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-xl font-semibold shadow-lg shadow-orange-500/25 hover:shadow-xl transition-all">
          <Download className="w-5 h-5" />
          Export Report
        </button>
      </div>

      {/* GST Info Card */}
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-2xl p-6 text-white shadow-xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-4 bg-white/20 rounded-xl">
              <Building className="w-8 h-8" />
            </div>
            <div>
              <p className="text-indigo-200 text-sm">Business GSTIN</p>
              <p className="text-2xl font-bold mt-1">{sellerData?.gst_number || sellerData?.gstin || 'Not Registered'}</p>
              <p className="text-indigo-200 text-sm mt-1">{sellerData?.business_name || sellerData?.businessName || 'Your Business'}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-indigo-200 text-sm">GST Rate Applied</p>
            <p className="text-4xl font-bold mt-1">18%</p>
            <p className="text-indigo-200 text-sm mt-1">CGST 9% + SGST 9%</p>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-100 rounded-xl">
              <FileText className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-slate-500">Total Invoices</p>
              <p className="text-2xl font-bold text-slate-900">{stats.totalInvoices}</p>
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
              <p className="text-2xl font-bold text-emerald-600">₹{stats.totalAmount.toLocaleString()}</p>
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
              <p className="text-2xl font-bold text-purple-600">₹{stats.totalGST.toLocaleString()}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-amber-100 rounded-xl">
              <Calendar className="w-6 h-6 text-amber-600" />
            </div>
            <div>
              <p className="text-sm text-slate-500">Pending Filing</p>
              <p className="text-2xl font-bold text-amber-600">{stats.pendingGST}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Search */}
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

      {/* Invoices Table */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        {filteredInvoices.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <FileText className="w-8 h-8 text-slate-400" />
            </div>
            <p className="text-slate-600 font-medium">No invoices found</p>
            <p className="text-sm text-slate-400 mt-1">Invoices will be generated automatically when orders are completed</p>
          </div>
        ) : (
          <table className="w-full">
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
              {filteredInvoices.map(invoice => (
                <tr key={invoice.id} className="hover:bg-slate-50 transition-colors">
                  <td className="p-4 font-mono font-medium text-slate-900">{invoice.invoice_number}</td>
                  <td className="p-4 text-slate-600">{new Date(invoice.created_at).toLocaleDateString()}</td>
                  <td className="p-4 text-slate-600">{invoice.customer_name}</td>
                  <td className="p-4 text-right text-slate-900">₹{(invoice.subtotal || 0).toLocaleString()}</td>
                  <td className="p-4 text-right text-purple-600 font-medium">₹{(invoice.gst_amount || 0).toLocaleString()}</td>
                  <td className="p-4 text-right font-bold text-slate-900">₹{(invoice.total_amount || 0).toLocaleString()}</td>
                  <td className="p-4">
                    <div className="flex justify-center gap-2">
                      <button 
                        onClick={() => setSelectedInvoice(invoice)}
                        className="p-2 hover:bg-blue-50 text-blue-600 rounded-lg transition-colors"
                        title="View"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button 
                        className="p-2 hover:bg-slate-50 text-slate-600 rounded-lg transition-colors"
                        title="Print"
                      >
                        <Printer className="w-4 h-4" />
                      </button>
                      <button 
                        className="p-2 hover:bg-emerald-50 text-emerald-600 rounded-lg transition-colors"
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
        )}
      </div>

      {/* GST Breakdown Info */}
      <div className="bg-gradient-to-r from-slate-50 to-slate-100 rounded-2xl p-6 border border-slate-200">
        <h3 className="font-semibold text-slate-900 mb-4">GST Breakdown Reference</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl p-4 border border-slate-200">
            <p className="text-sm text-slate-500">CGST</p>
            <p className="text-xl font-bold text-slate-900">9%</p>
            <p className="text-xs text-slate-400 mt-1">Central GST</p>
          </div>
          <div className="bg-white rounded-xl p-4 border border-slate-200">
            <p className="text-sm text-slate-500">SGST</p>
            <p className="text-xl font-bold text-slate-900">9%</p>
            <p className="text-xs text-slate-400 mt-1">State GST</p>
          </div>
          <div className="bg-white rounded-xl p-4 border border-slate-200">
            <p className="text-sm text-slate-500">IGST</p>
            <p className="text-xl font-bold text-slate-900">18%</p>
            <p className="text-xs text-slate-400 mt-1">Interstate GST</p>
          </div>
          <div className="bg-white rounded-xl p-4 border border-slate-200">
            <p className="text-sm text-slate-500">Total Rate</p>
            <p className="text-xl font-bold text-orange-600">18%</p>
            <p className="text-xs text-slate-400 mt-1">Standard Rate</p>
          </div>
        </div>
      </div>
    </div>
  );
}
