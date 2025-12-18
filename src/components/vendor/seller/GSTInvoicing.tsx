import { useState, useEffect } from 'react';
import { FileText, Download, Eye, Search, Calendar, Filter } from 'lucide-react';
import { projectId, publicAnonKey } from '../../../utils/supabase/info';
import { toast } from 'sonner@2.0.3';
import { Button } from '../../ui/button';

interface GSTInvoicingProps {
  sellerId: string;
  sellerData: any;
}

export function GSTInvoicing({ sellerId, sellerData }: GSTInvoicingProps) {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null);

  useEffect(() => {
    loadOrders();
  }, [sellerId]);

  const loadOrders = async () => {
    try {
      setLoading(true);
      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/ecommerce/orders?sellerId=${sellerId}`,
        { headers: { 'Authorization': `Bearer ${publicAnonKey}` } }
      );
      
      if (res.ok) {
        const data = await res.json();
        // Filter only delivered orders
        setOrders(data.orders.filter((o: any) => o.status === 'delivered'));
      }
    } catch (error) {
      console.error('Error loading orders:', error);
      toast.error('Failed to load invoices');
    } finally {
      setLoading(false);
    }
  };

  const generateInvoice = (order: any) => {
    const sellerItems = order.items?.filter((item: any) => item.sellerId === sellerId) || [];
    const subtotal = sellerItems.reduce((sum: number, item: any) => 
      sum + (item.price * item.quantity), 0
    );
    
    const cgst = subtotal * 0.09; // 9% CGST
    const sgst = subtotal * 0.09; // 9% SGST
    const total = subtotal + cgst + sgst;

    return {
      invoiceNumber: `INV-${order.id.slice(-8)}`,
      invoiceDate: new Date(order.createdAt).toLocaleDateString(),
      order,
      items: sellerItems,
      subtotal,
      cgst,
      sgst,
      total
    };
  };

  const filteredOrders = orders.filter(order => {
    const matchesSearch = order.id.includes(searchQuery) || 
                          order.customerName?.toLowerCase().includes(searchQuery.toLowerCase());
    const orderMonth = new Date(order.createdAt).toISOString().slice(0, 7);
    const matchesMonth = !selectedMonth || orderMonth === selectedMonth;
    return matchesSearch && matchesMonth;
  });

  const monthlyStats = {
    totalInvoices: filteredOrders.length,
    totalRevenue: filteredOrders.reduce((sum, order) => {
      const sellerItems = order.items?.filter((item: any) => item.sellerId === sellerId) || [];
      return sum + sellerItems.reduce((itemSum: number, item: any) => 
        itemSum + (item.price * item.quantity), 0
      );
    }, 0),
    totalGST: 0
  };
  monthlyStats.totalGST = monthlyStats.totalRevenue * 0.18; // 18% GST

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full p-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FF8C42]"></div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-black">GST Invoicing</h1>
        <p className="text-gray-500 mt-1">Generate and manage GST-compliant invoices</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
          <p className="text-gray-500 text-sm">Total Invoices</p>
          <p className="text-black text-2xl mt-1">{monthlyStats.totalInvoices}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
          <p className="text-gray-500 text-sm">Total Revenue</p>
          <p className="text-black text-2xl mt-1">₹{monthlyStats.totalRevenue.toLocaleString()}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
          <p className="text-gray-500 text-sm">Total GST Collected</p>
          <p className="text-black text-2xl mt-1">₹{monthlyStats.totalGST.toLocaleString()}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search by order ID or customer..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FF8C42]"
            />
          </div>
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FF8C42]"
            />
          </div>
        </div>
      </div>

      {/* Invoices List */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Invoice Number
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Customer
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Subtotal
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  GST (18%)
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Total
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                    <FileText className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                    <p>No invoices found</p>
                  </td>
                </tr>
              ) : (
                filteredOrders.map((order) => {
                  const invoice = generateInvoice(order);
                  
                  return (
                    <tr key={order.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <p className="font-mono text-sm text-black">{invoice.invoiceNumber}</p>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-sm text-gray-600">{invoice.invoiceDate}</p>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-sm font-medium text-black">{order.customerName || 'N/A'}</p>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <p className="text-sm text-black">₹{invoice.subtotal.toLocaleString()}</p>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <p className="text-sm text-black">₹{(invoice.cgst + invoice.sgst).toFixed(2)}</p>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <p className="font-semibold text-black">₹{invoice.total.toFixed(2)}</p>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <Button onClick={() => setSelectedInvoice(invoice)}
                            className="p-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                            title="View Invoice"
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                          <Button onClick={() => {
                              toast.success('Invoice downloaded (demo)');
                            }}
                            className="p-2 bg-[#FF8C42] text-white rounded-lg hover:bg-[#E67A32] transition-colors"
                            title="Download Invoice"
                          >
                            <Download className="w-4 h-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Invoice Preview Modal */}
      {selectedInvoice && (
        <InvoicePreviewModal
          invoice={selectedInvoice}
          sellerData={sellerData}
          onClose={() => setSelectedInvoice(null)}
        />
      )}
    </div>
  );
}

function InvoicePreviewModal({ invoice, sellerData, onClose }: any) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 p-6 flex items-center justify-between">
          <h2 className="text-black">Invoice Preview</h2>
          <div className="flex gap-2">
            <Button onClick={() => toast.success('Invoice downloaded (demo)')}
              className="bg-[#FF8C42] text-white px-4 py-2 rounded-lg hover:bg-[#E67A32] transition-colors flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              Download PDF
            </Button>
            <Button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
              ✕
            </Button>
          </div>
        </div>

        <div className="p-8 bg-gray-50">
          {/* Invoice Content */}
          <div className="bg-white p-8 rounded-lg shadow-sm">
            {/* Header */}
            <div className="flex justify-between items-start mb-8">
              <div>
                <h1 className="text-2xl font-bold text-black">TAX INVOICE</h1>
                <p className="text-sm text-gray-500 mt-1">GST Compliant</p>
              </div>
              <div className="text-right">
                <p className="font-mono text-lg font-bold">{invoice.invoiceNumber}</p>
                <p className="text-sm text-gray-500">Date: {invoice.invoiceDate}</p>
              </div>
            </div>

            {/* Seller & Customer Info */}
            <div className="grid grid-cols-2 gap-8 mb-8">
              <div>
                <p className="text-xs text-gray-500 uppercase mb-2">Seller Details</p>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="font-bold text-black">{sellerData.businessName || sellerData.fullName}</p>
                  <p className="text-sm text-gray-600 mt-1">{sellerData.address || 'Address not available'}</p>
                  <p className="text-sm text-gray-600 mt-2">
                    <span className="font-medium">GSTIN:</span> {sellerData.gstNumber || 'N/A'}
                  </p>
                  <p className="text-sm text-gray-600">
                    <span className="font-medium">Phone:</span> {sellerData.phone}
                  </p>
                </div>
              </div>

              <div>
                <p className="text-xs text-gray-500 uppercase mb-2">Bill To</p>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="font-bold text-black">{invoice.order.customerName || 'Customer'}</p>
                  <p className="text-sm text-gray-600 mt-1">{invoice.order.deliveryAddress || 'Address not available'}</p>
                  <p className="text-sm text-gray-600 mt-2">
                    <span className="font-medium">Phone:</span> {invoice.order.customerPhone}
                  </p>
                </div>
              </div>
            </div>

            {/* Items Table */}
            <table className="w-full mb-8">
              <thead className="border-b-2 border-gray-300">
                <tr>
                  <th className="text-left py-2 text-sm font-medium text-gray-700">Item Description</th>
                  <th className="text-center py-2 text-sm font-medium text-gray-700">Qty</th>
                  <th className="text-right py-2 text-sm font-medium text-gray-700">Rate</th>
                  <th className="text-right py-2 text-sm font-medium text-gray-700">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {invoice.items.map((item: any, index: number) => (
                  <tr key={index}>
                    <td className="py-3 text-sm text-black">{item.name}</td>
                    <td className="py-3 text-sm text-center text-gray-600">{item.quantity}</td>
                    <td className="py-3 text-sm text-right text-gray-600">₹{item.price.toLocaleString()}</td>
                    <td className="py-3 text-sm text-right text-black font-medium">
                      ₹{(item.price * item.quantity).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Totals */}
            <div className="flex justify-end">
              <div className="w-64 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Subtotal:</span>
                  <span className="font-medium text-black">₹{invoice.subtotal.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">CGST (9%):</span>
                  <span className="font-medium text-black">₹{invoice.cgst.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">SGST (9%):</span>
                  <span className="font-medium text-black">₹{invoice.sgst.toFixed(2)}</span>
                </div>
                <div className="border-t-2 border-gray-300 pt-2 flex justify-between">
                  <span className="font-bold text-black">Total:</span>
                  <span className="font-bold text-black text-lg">₹{invoice.total.toFixed(2)}</span>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="mt-8 pt-8 border-t border-gray-200">
              <p className="text-xs text-gray-500">
                This is a computer-generated invoice and does not require a signature.
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Thank you for your business!
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
