'use client';

import React, { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api-client';
import {
  Receipt, Search, Filter, Download, Calendar, TrendingUp,
  FileText, DollarSign, AlertCircle, Clock, Check, Eye
} from 'lucide-react';

interface GSTSummary {
  period: string;
  total_sales: number;
  taxable_amount: number;
  cgst_collected: number;
  sgst_collected: number;
  igst_collected: number;
  total_gst_collected: number;
  input_gst: number;
  net_gst_payable: number;
  filing_status: 'pending' | 'filed' | 'overdue';
  due_date: string;
}

interface Invoice {
  id: string;
  invoice_number: string;
  order_id: string;
  vendor_id: string;
  vendor_name: string;
  customer_name: string;
  invoice_date: string;
  taxable_amount: number;
  cgst: number;
  sgst: number;
  igst: number;
  total_amount: number;
  gst_number?: string;
  status: 'generated' | 'sent' | 'cancelled';
}

const filingStatusConfig: Record<string, { color: string; bg: string; label: string }> = {
  pending: { color: 'text-amber-700', bg: 'bg-amber-100', label: 'Pending' },
  filed: { color: 'text-emerald-700', bg: 'bg-emerald-100', label: 'Filed' },
  overdue: { color: 'text-red-700', bg: 'bg-red-100', label: 'Overdue' },
};

export default function GSTDashboard() {
  const [gstSummary, setGstSummary] = useState<GSTSummary | null>(null);
  const [monthlyData, setMonthlyData] = useState<GSTSummary[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'summary' | 'invoices' | 'reports'>('summary');
  const [selectedPeriod, setSelectedPeriod] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    loadData();
  }, [selectedPeriod]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const params = new URLSearchParams();
      if (selectedPeriod) params.append('period', selectedPeriod);
      
      const [summaryRes, monthlyRes, invoicesRes] = await Promise.all([
        apiClient.get<any>(`/admin/gst/summary?${params.toString()}`),
        apiClient.get<any>('/admin/gst/monthly'),
        apiClient.get<any>(`/admin/gst/invoices?${params.toString()}`),
      ]);
      
      setGstSummary((summaryRes as any)?.summary || null);
      setMonthlyData((monthlyRes as any)?.data || []);
      setInvoices((invoicesRes as any)?.invoices || []);
    } catch (err: any) {
      console.error('Error loading GST data:', err);
      setError(err.message || 'Failed to load GST data');
    } finally {
      setLoading(false);
    }
  };

  const downloadGSTR = async (type: string) => {
    try {
      const result = await apiClient.get<any>(`/admin/gst/download/${type}?period=${selectedPeriod}`);
      alert(`GSTR-${type} report downloaded successfully!`);
    } catch (err: any) {
      console.error('Error downloading GSTR:', err);
      alert('Failed to download report: ' + (err.message || 'Unknown error'));
    }
  };

  const filteredInvoices = invoices.filter(invoice =>
    invoice.invoice_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    invoice.vendor_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    invoice.customer_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Generate last 12 months for period selection
  const periods = Array.from({ length: 12 }, (_, i) => {
    const date = new Date();
    date.setMonth(date.getMonth() - i);
    return {
      value: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`,
      label: date.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
    };
  });

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">GST Dashboard</h1>
          <p className="text-slate-500">GST calculation, invoicing, and compliance</p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={selectedPeriod}
            onChange={(e) => setSelectedPeriod(e.target.value)}
            className="px-4 py-2 border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-orange-500/20"
          >
            <option value="">Current Period</option>
            {periods.map(period => (
              <option key={period.value} value={period.value}>{period.label}</option>
            ))}
          </select>
          <button
            onClick={() => downloadGSTR('1')}
            className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl hover:bg-slate-200 flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            GSTR-1
          </button>
          <button
            onClick={() => downloadGSTR('3B')}
            className="px-4 py-2 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-xl shadow-lg flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            GSTR-3B
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 border-b border-slate-100">
        {[
          { id: 'summary', label: 'Summary', icon: Receipt },
          { id: 'invoices', label: 'Invoices', icon: FileText },
          { id: 'reports', label: 'Reports', icon: TrendingUp },
        ].map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-4 py-3 flex items-center gap-2 font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'text-orange-600 border-orange-500'
                  : 'text-slate-500 border-transparent hover:text-slate-700'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-orange-200 border-t-orange-500" />
        </div>
      ) : error ? (
        <div className="text-center py-20 bg-white rounded-2xl border border-slate-100">
          <AlertCircle className="w-12 h-12 mx-auto mb-4 text-red-300" />
          <p className="text-slate-600">{error}</p>
          <button onClick={loadData} className="mt-4 px-6 py-2 bg-orange-500 text-white rounded-lg">
            Retry
          </button>
        </div>
      ) : (
        <>
          {/* Summary Tab */}
          {activeTab === 'summary' && (
            <div className="space-y-6">
              {/* GST Overview Cards */}
              <div className="grid grid-cols-4 gap-4">
                <div className="bg-white rounded-xl border border-slate-100 p-5">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="p-3 bg-blue-100 rounded-lg">
                      <DollarSign className="w-5 h-5 text-blue-600" />
                    </div>
                    <p className="text-sm text-slate-500">Total Sales</p>
                  </div>
                  <p className="text-2xl font-bold text-slate-900">₹{(gstSummary?.total_sales || 0).toLocaleString()}</p>
                </div>
                <div className="bg-white rounded-xl border border-slate-100 p-5">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="p-3 bg-emerald-100 rounded-lg">
                      <Receipt className="w-5 h-5 text-emerald-600" />
                    </div>
                    <p className="text-sm text-slate-500">GST Collected</p>
                  </div>
                  <p className="text-2xl font-bold text-emerald-600">₹{(gstSummary?.total_gst_collected || 0).toLocaleString()}</p>
                </div>
                <div className="bg-white rounded-xl border border-slate-100 p-5">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="p-3 bg-amber-100 rounded-lg">
                      <TrendingUp className="w-5 h-5 text-amber-600" />
                    </div>
                    <p className="text-sm text-slate-500">Input GST</p>
                  </div>
                  <p className="text-2xl font-bold text-amber-600">₹{(gstSummary?.input_gst || 0).toLocaleString()}</p>
                </div>
                <div className="bg-white rounded-xl border border-slate-100 p-5">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="p-3 bg-orange-100 rounded-lg">
                      <Receipt className="w-5 h-5 text-orange-600" />
                    </div>
                    <p className="text-sm text-slate-500">Net Payable</p>
                  </div>
                  <p className="text-2xl font-bold text-orange-600">₹{(gstSummary?.net_gst_payable || 0).toLocaleString()}</p>
                </div>
              </div>

              {/* GST Breakdown */}
              <div className="bg-white rounded-xl border border-slate-100 p-6">
                <h3 className="font-semibold text-slate-900 mb-4">GST Breakdown</h3>
                <div className="grid grid-cols-3 gap-4">
                  <div className="p-4 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl">
                    <p className="text-sm text-blue-600 mb-1">CGST</p>
                    <p className="text-2xl font-bold text-blue-900">₹{(gstSummary?.cgst_collected || 0).toLocaleString()}</p>
                    <p className="text-sm text-blue-500 mt-1">Central GST @ 9%</p>
                  </div>
                  <div className="p-4 bg-gradient-to-br from-emerald-50 to-teal-50 rounded-xl">
                    <p className="text-sm text-emerald-600 mb-1">SGST</p>
                    <p className="text-2xl font-bold text-emerald-900">₹{(gstSummary?.sgst_collected || 0).toLocaleString()}</p>
                    <p className="text-sm text-emerald-500 mt-1">State GST @ 9%</p>
                  </div>
                  <div className="p-4 bg-gradient-to-br from-orange-50 to-amber-50 rounded-xl">
                    <p className="text-sm text-orange-600 mb-1">IGST</p>
                    <p className="text-2xl font-bold text-orange-900">₹{(gstSummary?.igst_collected || 0).toLocaleString()}</p>
                    <p className="text-sm text-orange-500 mt-1">Integrated GST @ 18%</p>
                  </div>
                </div>
              </div>

              {/* Filing Status */}
              <div className="bg-white rounded-xl border border-slate-100 p-6">
                <h3 className="font-semibold text-slate-900 mb-4">Filing Status</h3>
                <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-white rounded-xl shadow-sm">
                      <FileText className="w-6 h-6 text-slate-600" />
                    </div>
                    <div>
                      <p className="font-semibold text-slate-900">GSTR-3B for {gstSummary?.period || 'Current Period'}</p>
                      <p className="text-sm text-slate-500">Due Date: {gstSummary?.due_date || 'N/A'}</p>
                    </div>
                  </div>
                  <span className={`px-4 py-2 rounded-xl text-sm font-semibold ${filingStatusConfig[gstSummary?.filing_status || 'pending'].bg} ${filingStatusConfig[gstSummary?.filing_status || 'pending'].color}`}>
                    {filingStatusConfig[gstSummary?.filing_status || 'pending'].label}
                  </span>
                </div>
              </div>

              {/* Monthly Trend */}
              <div className="bg-white rounded-xl border border-slate-100 p-6">
                <h3 className="font-semibold text-slate-900 mb-4">Monthly GST Trend</h3>
                {monthlyData.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-slate-100">
                          <th className="text-left py-3 px-4 font-semibold text-slate-600">Period</th>
                          <th className="text-right py-3 px-4 font-semibold text-slate-600">Sales</th>
                          <th className="text-right py-3 px-4 font-semibold text-slate-600">GST Collected</th>
                          <th className="text-right py-3 px-4 font-semibold text-slate-600">Input GST</th>
                          <th className="text-right py-3 px-4 font-semibold text-slate-600">Net Payable</th>
                          <th className="text-center py-3 px-4 font-semibold text-slate-600">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {monthlyData.map((month, index) => (
                          <tr key={index} className="border-b border-slate-50">
                            <td className="py-3 px-4 font-medium text-slate-900">{month.period}</td>
                            <td className="py-3 px-4 text-right text-slate-900">₹{month.total_sales?.toLocaleString()}</td>
                            <td className="py-3 px-4 text-right text-emerald-600">₹{month.total_gst_collected?.toLocaleString()}</td>
                            <td className="py-3 px-4 text-right text-amber-600">₹{month.input_gst?.toLocaleString()}</td>
                            <td className="py-3 px-4 text-right font-semibold text-orange-600">₹{month.net_gst_payable?.toLocaleString()}</td>
                            <td className="py-3 px-4 text-center">
                              <span className={`px-3 py-1 rounded-full text-xs font-semibold ${filingStatusConfig[month.filing_status || 'pending'].bg} ${filingStatusConfig[month.filing_status || 'pending'].color}`}>
                                {filingStatusConfig[month.filing_status || 'pending'].label}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-center text-slate-500 py-8">No monthly data available</p>
                )}
              </div>
            </div>
          )}

          {/* Invoices Tab */}
          {activeTab === 'invoices' && (
            <div className="space-y-6">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search invoices..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/20 bg-white"
                />
              </div>

              {filteredInvoices.length === 0 ? (
                <div className="text-center py-20 bg-white rounded-2xl border border-slate-100">
                  <FileText className="w-16 h-16 mx-auto mb-4 text-slate-200" />
                  <p className="text-slate-500">No invoices found</p>
                </div>
              ) : (
                <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
                  <table className="w-full">
                    <thead className="bg-slate-50 border-b border-slate-100">
                      <tr>
                        <th className="text-left p-4 font-semibold text-slate-600">Invoice #</th>
                        <th className="text-left p-4 font-semibold text-slate-600">Vendor</th>
                        <th className="text-left p-4 font-semibold text-slate-600">Customer</th>
                        <th className="text-left p-4 font-semibold text-slate-600">Date</th>
                        <th className="text-right p-4 font-semibold text-slate-600">Taxable</th>
                        <th className="text-right p-4 font-semibold text-slate-600">GST</th>
                        <th className="text-right p-4 font-semibold text-slate-600">Total</th>
                        <th className="text-center p-4 font-semibold text-slate-600">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredInvoices.map(invoice => (
                        <tr key={invoice.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                          <td className="p-4 font-mono font-medium text-slate-900">{invoice.invoice_number}</td>
                          <td className="p-4 text-slate-700">{invoice.vendor_name}</td>
                          <td className="p-4 text-slate-700">{invoice.customer_name}</td>
                          <td className="p-4 text-slate-500">{invoice.invoice_date}</td>
                          <td className="p-4 text-right text-slate-900">₹{invoice.taxable_amount?.toLocaleString()}</td>
                          <td className="p-4 text-right text-emerald-600">₹{((invoice.cgst || 0) + (invoice.sgst || 0) + (invoice.igst || 0)).toLocaleString()}</td>
                          <td className="p-4 text-right font-semibold text-slate-900">₹{invoice.total_amount?.toLocaleString()}</td>
                          <td className="p-4 text-center">
                            <button className="p-2 hover:bg-slate-100 rounded-lg">
                              <Download className="w-4 h-4 text-slate-500" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Reports Tab */}
          {activeTab === 'reports' && (
            <div className="grid grid-cols-2 gap-6">
              {[
                { title: 'GSTR-1', desc: 'Outward supplies report', icon: FileText, color: 'blue' },
                { title: 'GSTR-3B', desc: 'Monthly summary return', icon: Receipt, color: 'emerald' },
                { title: 'GSTR-2A', desc: 'Auto-drafted inward supplies', icon: TrendingUp, color: 'amber' },
                { title: 'HSN Summary', desc: 'HSN-wise sales summary', icon: FileText, color: 'purple' },
              ].map((report, index) => {
                const Icon = report.icon;
                return (
                  <div key={index} className="bg-white rounded-xl border border-slate-100 p-6 hover:shadow-lg transition-shadow">
                    <div className={`w-12 h-12 bg-${report.color}-100 rounded-xl flex items-center justify-center mb-4`}>
                      <Icon className={`w-6 h-6 text-${report.color}-600`} />
                    </div>
                    <h3 className="font-semibold text-slate-900">{report.title}</h3>
                    <p className="text-sm text-slate-500 mb-4">{report.desc}</p>
                    <button 
                      onClick={() => downloadGSTR(report.title.replace('GSTR-', ''))}
                      className="w-full py-2 border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 flex items-center justify-center gap-2"
                    >
                      <Download className="w-4 h-4" />
                      Download
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
