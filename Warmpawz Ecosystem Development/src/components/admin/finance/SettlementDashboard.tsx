import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '../../ui/card';
import { Button } from '../../ui/button';
import { Badge } from '../../ui/badge';
import { 
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow 
} from '../../ui/table';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell 
} from 'recharts';
import { 
  TrendingUp, DollarSign, Users, Calendar, Filter, Download, CheckCircle2 
} from 'lucide-react';
import { toast } from 'sonner@2.0.3';
import { getApiBaseUrl, getAuthHeaders } from '../../../utils/api-config';

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

  const API_BASE = getApiBaseUrl();
  const COLORS = ['#FF8C42', '#4F46E5', '#10B981', '#F59E0B'];

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      // Load Settlements
      const settlementsRes = await fetch(`${API_BASE}/admin/payments/settlements`, {
        headers: getAuthHeaders()
      });
      
      // Load Analytics
      const analyticsRes = await fetch(`${API_BASE}/admin/payments/analytics`, {
        headers: getAuthHeaders()
      });

      if (settlementsRes.ok && analyticsRes.ok) {
        const settlementsData = await settlementsRes.json();
        const analyticsData = await analyticsRes.json();
        
        setSettlements(settlementsData.settlements || []);
        setAnalytics(analyticsData.analytics);
      }
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Failed to load settlement data');
    } finally {
      setLoading(false);
    }
  };

  const handleProcessSettlements = async () => {
    const dueSettlements = settlements.filter(s => s.status === 'Due').map(s => s.id);
    if (dueSettlements.length === 0) {
      toast.info('No due settlements to process');
      return;
    }

    setProcessing(true);
    try {
      const response = await fetch(`${API_BASE}/admin/payments/settlements/process`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify({ settlementIds: dueSettlements })
      });

      if (response.ok) {
        toast.success(`Processed ${dueSettlements.length} settlements successfully`);
        // Refresh data
        loadData();
      } else {
        toast.error('Failed to process settlements');
      }
    } catch (error) {
      toast.error('Error processing settlements');
    } finally {
      setProcessing(false);
    }
  };

  const pieData = analytics ? Object.entries(analytics.revenueByTier).map(([name, value]) => ({ name, value })) : [];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Settlements & Analytics</h2>
          <p className="text-sm text-slate-500">Manage payouts and view revenue insights</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline">
            <Download className="w-4 h-4 mr-2" /> Export Report
          </Button>
          <Button onClick={handleProcessSettlements} disabled={processing || loading} className="bg-green-600 hover:bg-green-700">
            <CheckCircle2 className="w-4 h-4 mr-2" />
            {processing ? 'Processing...' : 'Process All Due'}
          </Button>
        </div>
      </div>

      {/* Analytics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-100">
          <CardContent className="p-6">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm font-medium text-blue-600 mb-1">Total Revenue</p>
                <h3 className="text-2xl font-bold text-slate-900">
                  ₹{analytics?.totalRevenue.toLocaleString() || '0'}
                </h3>
              </div>
              <div className="p-2 bg-blue-100 rounded-lg">
                <DollarSign className="w-5 h-5 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-br from-green-50 to-emerald-50 border-green-100">
          <CardContent className="p-6">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm font-medium text-green-600 mb-1">Platform Commission</p>
                <h3 className="text-2xl font-bold text-slate-900">
                  ₹{analytics?.totalCommission.toLocaleString() || '0'}
                </h3>
              </div>
              <div className="p-2 bg-green-100 rounded-lg">
                <TrendingUp className="w-5 h-5 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-orange-50 to-amber-50 border-orange-100">
          <CardContent className="p-6">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm font-medium text-orange-600 mb-1">Vendor Payouts</p>
                <h3 className="text-2xl font-bold text-slate-900">
                  ₹{analytics?.vendorPayout.toLocaleString() || '0'}
                </h3>
              </div>
              <div className="p-2 bg-orange-100 rounded-lg">
                <Users className="w-5 h-5 text-orange-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Settlements Table */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle className="text-lg">Recent Settlements</CardTitle>
              <Button variant="ghost" size="sm">
                <Filter className="w-4 h-4 mr-2" /> Filter
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Vendor</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Commission</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {settlements.map((settlement) => (
                  <TableRow key={settlement.id}>
                    <TableCell className="font-medium">{settlement.vendorName}</TableCell>
                    <TableCell>{settlement.date}</TableCell>
                    <TableCell>₹{settlement.amount.toLocaleString()}</TableCell>
                    <TableCell className="text-muted-foreground">₹{settlement.commission.toLocaleString()}</TableCell>
                    <TableCell>
                      <Badge 
                        className={
                          settlement.status === 'Due' ? 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200' :
                          settlement.status === 'Paid' ? 'bg-green-100 text-green-700 hover:bg-green-200' :
                          'bg-slate-100 text-slate-700 hover:bg-slate-200'
                        }
                      >
                        {settlement.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {settlement.status === 'Due' && (
                        <Button size="sm" variant="outline" className="h-8">Process</Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {settlements.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      No settlements found
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Revenue Charts */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-lg">Revenue by Tier</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[250px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-3 mt-4">
              {pieData.map((entry, index) => (
                <div key={index} className="flex justify-between items-center text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }}></div>
                    <span>{entry.name}</span>
                  </div>
                  <span className="font-bold">₹{entry.value.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
