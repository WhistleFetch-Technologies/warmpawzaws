'use client';

import { useState, useEffect } from 'react';
import {
  TrendingUp,
  DollarSign,
  Users,
  Calendar,
  Filter,
  Download,
  CheckCircle2,
} from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { toast } from 'sonner';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Button,
  Badge,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@warmpawz/ui';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
} from 'recharts';
import { PolicyHelpButton } from '@/components/PolicyHelpButton';

interface Settlement {
  id: string;
  vendorName: string;
  amount: number;
  commission: number;
  status: 'Due' | 'Pending' | 'Paid';
  date: string;
}

interface AnalyticsData {
  totalRevenue: number;
  totalCommission: number;
  vendorPayout: number;
  revenueByTier: Record<string, number>;
  topVendors: { name: string; revenue: number }[];
}

export function SettlementDashboard() {
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);

  const COLORS = ['#FF8C42', '#4F46E5', '#10B981', '#F59E0B'];

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [settlementsData, analyticsData] = await Promise.all([
        apiClient.get<any>('/admin/payments/settlements'),
        apiClient.get<any>('/admin/payments/analytics'),
      ]);

      setSettlements(Array.isArray(settlementsData?.data?.settlements) ? settlementsData.data.settlements : (settlementsData?.settlements ?? []));
      setAnalytics(analyticsData?.data?.analytics ?? analyticsData?.analytics ?? null);
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Failed to load settlement data');
    } finally {
      setLoading(false);
    }
  };

  const handleProcessSettlement = async (settlementId: string) => {
    try {
      setProcessing(true);
      await apiClient.post(`/admin/payments/settlements/${settlementId}/process`);
      toast.success('Settlement processed successfully');
      loadData();
    } catch (error) {
      toast.error('Failed to process settlement');
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FF8C42]"></div>
      </div>
    );
  }

  const statusCounts = {
    Due: settlements.filter((s) => s.status === 'Due').length,
    Pending: settlements.filter((s) => s.status === 'Pending').length,
    Paid: settlements.filter((s) => s.status === 'Paid').length,
  };

  const pieData = [
    { name: 'Due', value: statusCounts.Due },
    { name: 'Pending', value: statusCounts.Pending },
    { name: 'Paid', value: statusCounts.Paid },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-2">
        <h2 className="text-black text-xl font-semibold">Settlements</h2>
        <PolicyHelpButton docKey="finance-settlements" />
      </div>
      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ₹{analytics?.totalRevenue?.toLocaleString() || 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Platform Commission</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ₹{analytics?.totalCommission?.toLocaleString() || 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Vendor Payout</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ₹{analytics?.vendorPayout?.toLocaleString() || 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Settlements</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{statusCounts.Pending}</div>
          </CardContent>
        </Card>
      </div>

      {/* Charts and Table */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Settlement Status</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Settlements</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {settlements.slice(0, 5).map((settlement) => (
                <div
                  key={settlement.id}
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div>
                    <p className="font-medium">{settlement.vendorName}</p>
                    <p className="text-sm text-gray-500">₹{settlement.amount.toLocaleString()}</p>
                  </div>
                  <Badge
                    variant={
                      settlement.status === 'Paid'
                        ? 'default'
                        : settlement.status === 'Pending'
                          ? 'secondary'
                          : 'outline'
                    }
                  >
                    {settlement.status}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Settlements Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>All Settlements</CardTitle>
            <div className="flex gap-2">
              <Button variant="outline" size="sm">
                <Filter className="w-4 h-4 mr-2" />
                Filter
              </Button>
              <Button variant="outline" size="sm">
                <Download className="w-4 h-4 mr-2" />
                Export
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Vendor</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Commission</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {settlements.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                    No settlements found
                  </TableCell>
                </TableRow>
              ) : (
                settlements.map((settlement) => (
                  <TableRow key={settlement.id}>
                    <TableCell className="font-medium">{settlement.vendorName}</TableCell>
                    <TableCell>₹{settlement.amount.toLocaleString()}</TableCell>
                    <TableCell>₹{settlement.commission.toLocaleString()}</TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          settlement.status === 'Paid'
                            ? 'default'
                            : settlement.status === 'Pending'
                              ? 'secondary'
                              : 'outline'
                        }
                      >
                        {settlement.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{new Date(settlement.date).toLocaleDateString()}</TableCell>
                    <TableCell>
                      {settlement.status !== 'Paid' && (
                        <Button
                          size="sm"
                          onClick={() => handleProcessSettlement(settlement.id)}
                          disabled={processing}
                        >
                          <CheckCircle2 className="w-4 h-4 mr-2" />
                          Process
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

