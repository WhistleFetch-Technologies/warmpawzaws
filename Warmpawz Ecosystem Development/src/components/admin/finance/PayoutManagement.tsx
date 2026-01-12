import { useState, useEffect } from 'react';
import { Card } from '../../ui/card';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../ui/tabs';
import { Badge } from '../../ui/badge';
import { 
  ArrowLeft, DollarSign, Clock, CheckCircle, XCircle, Download,
  Filter, Search, Calendar, TrendingUp, AlertCircle, Eye, FileText
} from 'lucide-react';
import { toast } from 'sonner@2.0.3';
import { projectId, publicAnonKey } from '../../../utils/supabase/info';

interface PayoutManagementProps {
  onBack: () => void;
}

interface Payout {
  id: string;
  vendorId: string;
  vendorName: string;
  vendorPhone: string;
  amount: number;
  commission: number;
  tds: number;
  netAmount: number;
  status: 'pending' | 'processing' | 'completed' | 'rejected';
  period: string;
  bookingsCount: number;
  ordersCount: number;
  createdAt: string;
  processedAt?: string;
  bankAccount?: {
    accountNumber: string;
    ifsc: string;
    accountHolder: string;
    verified: boolean;
  };
  rejectionReason?: string;
}

export function PayoutManagement({ onBack }: PayoutManagementProps) {
  const [loading, setLoading] = useState(false);
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [filteredPayouts, setFilteredPayouts] = useState<Payout[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedPayout, setSelectedPayout] = useState<Payout | null>(null);
  const [showDetails, setShowDetails] = useState(false);

  // Stats
  const [stats, setStats] = useState({
    pendingAmount: 0,
    processingAmount: 0,
    completedAmount: 0,
    pendingCount: 0,
    processingCount: 0,
    completedCount: 0
  });

  useEffect(() => {
    loadPayouts();
    loadStats();
  }, []);

  useEffect(() => {
    filterPayouts();
  }, [searchQuery, statusFilter, payouts]);

  const loadPayouts = async () => {
    setLoading(true);
    try {
      // GET /make-server-3dd53475/admin/payouts
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/admin/payouts`,
        {
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`
          }
        }
      );

      if (response.ok) {
        const data = await response.json();
        setPayouts(data.payouts || []);
      } else {
        // Mock data for demo
        const mockPayouts: Payout[] = [
          {
            id: 'payout_1',
            vendorId: 'vendor_1',
            vendorName: 'PetCare Veterinary',
            vendorPhone: '+919876543210',
            amount: 45000,
            commission: 6750,
            tds: 675,
            netAmount: 6075,
            status: 'pending',
            period: 'Nov 25-Dec 1, 2024',
            bookingsCount: 34,
            ordersCount: 0,
            createdAt: '2024-12-02T10:00:00Z',
            bankAccount: {
              accountNumber: '****5678',
              ifsc: 'HDFC0001234',
              accountHolder: 'PetCare Veterinary',
              verified: true
            }
          },
          {
            id: 'payout_2',
            vendorId: 'vendor_2',
            vendorName: 'Grooming Paradise',
            vendorPhone: '+919876543211',
            amount: 38000,
            commission: 5700,
            tds: 570,
            netAmount: 5130,
            status: 'processing',
            period: 'Nov 25-Dec 1, 2024',
            bookingsCount: 28,
            ordersCount: 0,
            createdAt: '2024-12-02T10:00:00Z',
            processedAt: '2024-12-02T14:30:00Z',
            bankAccount: {
              accountNumber: '****9012',
              ifsc: 'ICIC0002345',
              accountHolder: 'Grooming Paradise',
              verified: true
            }
          },
          {
            id: 'payout_3',
            vendorId: 'vendor_3',
            vendorName: 'Pet Supplies Pro',
            vendorPhone: '+919876543212',
            amount: 125000,
            commission: 18750,
            tds: 1875,
            netAmount: 16875,
            status: 'completed',
            period: 'Nov 18-Nov 24, 2024',
            bookingsCount: 0,
            ordersCount: 87,
            createdAt: '2024-11-25T10:00:00Z',
            processedAt: '2024-11-26T16:45:00Z',
            bankAccount: {
              accountNumber: '****3456',
              ifsc: 'SBIN0003456',
              accountHolder: 'Pet Supplies Pro',
              verified: true
            }
          }
        ];
        setPayouts(mockPayouts);
      }
    } catch (error) {
      console.error('Error loading payouts:', error);
      toast.error('Failed to load payouts');
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      // GET /make-server-3dd53475/admin/payouts/stats
      // Mock stats
      setStats({
        pendingAmount: 156750,
        processingAmount: 45600,
        completedAmount: 892000,
        pendingCount: 23,
        processingCount: 8,
        completedCount: 145
      });
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  const filterPayouts = () => {
    let filtered = payouts;

    if (statusFilter !== 'all') {
      filtered = filtered.filter(p => p.status === statusFilter);
    }

    if (searchQuery) {
      filtered = filtered.filter(p => 
        p.vendorName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.vendorPhone.includes(searchQuery) ||
        p.id.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    setFilteredPayouts(filtered);
  };

  const approvePayout = async (payoutId: string) => {
    setLoading(true);
    try {
      // POST /make-server-3dd53475/admin/payouts/{id}/approve
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/admin/payouts/${payoutId}/approve`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.ok) {
        toast.success('Payout approved and moved to processing');
        loadPayouts();
        loadStats();
        setShowDetails(false);
      }
    } catch (error) {
      console.error('Error approving payout:', error);
      toast.error('Failed to approve payout');
    } finally {
      setLoading(false);
    }
  };

  const completePayout = async (payoutId: string) => {
    setLoading(true);
    try {
      // POST /make-server-3dd53475/admin/payouts/{id}/complete
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/admin/payouts/${payoutId}/complete`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            transactionId: 'TXN_' + Date.now(),
            notes: 'Payout processed successfully'
          })
        }
      );

      if (response.ok) {
        toast.success('Payout marked as completed');
        loadPayouts();
        loadStats();
        setShowDetails(false);
      }
    } catch (error) {
      console.error('Error completing payout:', error);
      toast.error('Failed to complete payout');
    } finally {
      setLoading(false);
    }
  };

  const rejectPayout = async (payoutId: string, reason: string) => {
    setLoading(true);
    try {
      // POST /make-server-3dd53475/admin/payouts/{id}/reject
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/admin/payouts/${payoutId}/reject`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ reason })
        }
      );

      if (response.ok) {
        toast.success('Payout rejected');
        loadPayouts();
        loadStats();
        setShowDetails(false);
      }
    } catch (error) {
      console.error('Error rejecting payout:', error);
      toast.error('Failed to reject payout');
    } finally {
      setLoading(false);
    }
  };

  const exportPayouts = () => {
    toast.success('Exporting payouts to CSV...');
    // Implementation for CSV export
  };

  const getStatusColor = (status: string) => {
    const colors = {
      pending: 'bg-yellow-100 text-yellow-700',
      processing: 'bg-blue-100 text-blue-700',
      completed: 'bg-green-100 text-green-700',
      rejected: 'bg-red-100 text-red-700'
    };
    return colors[status as keyof typeof colors] || 'bg-gray-100 text-gray-700';
  };

  const getStatusIcon = (status: string) => {
    const icons = {
      pending: <Clock className="w-4 h-4" />,
      processing: <TrendingUp className="w-4 h-4" />,
      completed: <CheckCircle className="w-4 h-4" />,
      rejected: <XCircle className="w-4 h-4" />
    };
    return icons[status as keyof typeof icons] || <Clock className="w-4 h-4" />;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="sm" onClick={onBack}>
                <ArrowLeft className="w-4 h-4" />
              </Button>
              <div>
                <h1 className="text-xl font-semibold">Payout Management</h1>
                <p className="text-sm text-gray-500">Manage vendor commission settlements</p>
              </div>
            </div>
            <Button onClick={exportPayouts} className="bg-[#FF8C42] hover:bg-[#ff7a28]">
              <Download className="w-4 h-4 mr-2" />
              Export
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 mb-1">Pending Payouts</p>
                <p className="text-2xl font-bold">₹{(stats.pendingAmount / 1000).toFixed(0)}K</p>
                <p className="text-sm text-gray-600 mt-1">{stats.pendingCount} vendors</p>
              </div>
              <div className="bg-yellow-100 text-yellow-700 p-3 rounded-lg">
                <Clock className="w-6 h-6" />
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 mb-1">Processing</p>
                <p className="text-2xl font-bold">₹{(stats.processingAmount / 1000).toFixed(0)}K</p>
                <p className="text-sm text-gray-600 mt-1">{stats.processingCount} vendors</p>
              </div>
              <div className="bg-blue-100 text-blue-700 p-3 rounded-lg">
                <TrendingUp className="w-6 h-6" />
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 mb-1">Completed</p>
                <p className="text-2xl font-bold">₹{(stats.completedAmount / 1000).toFixed(0)}K</p>
                <p className="text-sm text-gray-600 mt-1">{stats.completedCount} payouts</p>
              </div>
              <div className="bg-green-100 text-green-700 p-3 rounded-lg">
                <CheckCircle className="w-6 h-6" />
              </div>
            </div>
          </Card>
        </div>

        {/* Filters */}
        <Card className="p-4 mb-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <Input
                  placeholder="Search by vendor name, phone, or payout ID..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="flex gap-2">
              {['all', 'pending', 'processing', 'completed', 'rejected'].map((status) => (
                <Button
                  key={status}
                  size="sm"
                  variant={statusFilter === status ? 'default' : 'outline'}
                  onClick={() => setStatusFilter(status)}
                  className={statusFilter === status ? 'bg-[#FF8C42] hover:bg-[#ff7a28]' : ''}
                >
                  {status.charAt(0).toUpperCase() + status.slice(1)}
                </Button>
              ))}
            </div>
          </div>
        </Card>

        {/* Payouts Table */}
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Vendor</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Period</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Volume</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Commission</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">TDS</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Net Payout</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredPayouts.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-12 text-center text-gray-500">
                      No payouts found
                    </td>
                  </tr>
                ) : (
                  filteredPayouts.map((payout) => (
                    <tr key={payout.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <div>
                          <p className="font-medium">{payout.vendorName}</p>
                          <p className="text-sm text-gray-500">{payout.vendorPhone}</p>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-sm">{payout.period}</p>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm">
                          {payout.bookingsCount > 0 && <p>{payout.bookingsCount} bookings</p>}
                          {payout.ordersCount > 0 && <p>{payout.ordersCount} orders</p>}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <p className="font-medium">₹{payout.commission.toLocaleString()}</p>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-sm">₹{payout.tds.toLocaleString()}</p>
                      </td>
                      <td className="px-6 py-4">
                        <p className="font-bold text-[#FF8C42]">₹{payout.netAmount.toLocaleString()}</p>
                      </td>
                      <td className="px-6 py-4">
                        <Badge className={getStatusColor(payout.status)}>
                          <span className="flex items-center gap-1">
                            {getStatusIcon(payout.status)}
                            {payout.status}
                          </span>
                        </Badge>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setSelectedPayout(payout);
                              setShowDetails(true);
                            }}
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                          {payout.status === 'pending' && (
                            <Button
                              size="sm"
                              className="bg-green-600 hover:bg-green-700 text-white"
                              onClick={() => approvePayout(payout.id)}
                            >
                              Approve
                            </Button>
                          )}
                          {payout.status === 'processing' && (
                            <Button
                              size="sm"
                              className="bg-[#FF8C42] hover:bg-[#ff7a28]"
                              onClick={() => completePayout(payout.id)}
                            >
                              Complete
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      {/* Payout Details Modal */}
      {showDetails && selectedPayout && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <Card className="max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold">Payout Details</h2>
                <Button variant="ghost" size="sm" onClick={() => setShowDetails(false)}>
                  ✕
                </Button>
              </div>

              <div className="space-y-6">
                {/* Vendor Info */}
                <div>
                  <h3 className="font-medium mb-3">Vendor Information</h3>
                  <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg">
                    <div>
                      <p className="text-sm text-gray-500">Name</p>
                      <p className="font-medium">{selectedPayout.vendorName}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Phone</p>
                      <p className="font-medium">{selectedPayout.vendorPhone}</p>
                    </div>
                  </div>
                </div>

                {/* Bank Details */}
                {selectedPayout.bankAccount && (
                  <div>
                    <h3 className="font-medium mb-3">Bank Account</h3>
                    <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg">
                      <div>
                        <p className="text-sm text-gray-500">Account Number</p>
                        <p className="font-medium">{selectedPayout.bankAccount.accountNumber}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">IFSC Code</p>
                        <p className="font-medium">{selectedPayout.bankAccount.ifsc}</p>
                      </div>
                      <div className="col-span-2">
                        <p className="text-sm text-gray-500">Account Holder</p>
                        <p className="font-medium">{selectedPayout.bankAccount.accountHolder}</p>
                        {selectedPayout.bankAccount.verified && (
                          <Badge className="mt-1 bg-green-100 text-green-700">
                            <CheckCircle className="w-3 h-3 mr-1" />
                            Verified
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Payout Breakdown */}
                <div>
                  <h3 className="font-medium mb-3">Payout Breakdown</h3>
                  <div className="p-4 bg-gray-50 rounded-lg space-y-2">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Total Commission</span>
                      <span className="font-medium">₹{selectedPayout.commission.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">TDS (10%)</span>
                      <span className="font-medium text-red-600">- ₹{selectedPayout.tds.toLocaleString()}</span>
                    </div>
                    <div className="border-t pt-2 flex justify-between">
                      <span className="font-semibold">Net Payout</span>
                      <span className="font-bold text-[#FF8C42]">₹{selectedPayout.netAmount.toLocaleString()}</span>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                {selectedPayout.status === 'pending' && (
                  <div className="flex gap-3">
                    <Button
                      className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                      onClick={() => approvePayout(selectedPayout.id)}
                      disabled={loading}
                    >
                      <CheckCircle className="w-4 h-4 mr-2" />
                      Approve Payout
                    </Button>
                    <Button
                      variant="outline"
                      className="flex-1 text-red-600 border-red-200 hover:bg-red-50"
                      onClick={() => {
                        const reason = prompt('Enter rejection reason:');
                        if (reason) rejectPayout(selectedPayout.id, reason);
                      }}
                    >
                      <XCircle className="w-4 h-4 mr-2" />
                      Reject
                    </Button>
                  </div>
                )}

                {selectedPayout.status === 'processing' && (
                  <Button
                    className="w-full bg-[#FF8C42] hover:bg-[#ff7a28]"
                    onClick={() => completePayout(selectedPayout.id)}
                    disabled={loading}
                  >
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Mark as Completed
                  </Button>
                )}
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
