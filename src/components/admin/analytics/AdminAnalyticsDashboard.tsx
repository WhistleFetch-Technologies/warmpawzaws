import { useState, useEffect } from 'react';
import { Card } from '../../ui/card';
import { Button } from '../../ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select';
import { 
  TrendingUp, TrendingDown, DollarSign, Users, ShoppingCart, Package, 
  ArrowLeft, Download, Calendar, Activity, Target, Percent
} from 'lucide-react';
import { 
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, CartesianGrid, XAxis, YAxis, Legend, Bar 
} from 'recharts';
import { RevenueChart } from './RevenueChart';
import { VendorPerformanceTable } from './VendorPerformanceTable';

interface AnalyticsDashboardProps {
  onBack: () => void;
}

interface KPICard {
  title: string;
  value: string | number;
  change: number;
  icon: React.ReactNode;
  color: string;
}

export function AdminAnalyticsDashboard({ onBack }: AnalyticsDashboardProps) {
  const [loading, setLoading] = useState(false);
  const [dateRange, setDateRange] = useState('7d');
  const [activeTab, setActiveTab] = useState('overview');

  // KPI Stats
  const [kpiData, setKpiData] = useState({
    totalGMV: 0,
    totalRevenue: 0,
    activeCustomers: 0,
    activeVendors: 0,
    totalBookings: 0,
    totalOrders: 0,
    avgOrderValue: 0,
    commissionEarned: 0,
    conversionRate: 0,
    churnRate: 0
  });

  // Chart Data
  const [revenueData, setRevenueData] = useState<any[]>([]);
  const [categoryData, setCategoryData] = useState<any[]>([]);
  const [vendorTableData, setVendorTableData] = useState<any[]>([]);

  useEffect(() => {
    loadAnalyticsData();
  }, [dateRange]);

  const loadAnalyticsData = async () => {
    setLoading(true);
    try {
      // Mock KPI data
      setKpiData({
        totalGMV: 2845000,
        totalRevenue: 425000,
        activeCustomers: 12450,
        activeVendors: 567,
        totalBookings: 3890,
        totalOrders: 2340,
        avgOrderValue: 1215,
        commissionEarned: 142500,
        conversionRate: 3.8,
        churnRate: 2.1
      });

      // Mock revenue trend data for RevenueChart
      setRevenueData([
        { date: 'Mon', revenue: 45000, commission: 6750 },
        { date: 'Tue', revenue: 52000, commission: 7800 },
        { date: 'Wed', revenue: 48000, commission: 7200 },
        { date: 'Thu', revenue: 61000, commission: 9150 },
        { date: 'Fri', revenue: 58000, commission: 8700 },
        { date: 'Sat', revenue: 73000, commission: 10950 },
        { date: 'Sun', revenue: 88000, commission: 13200 }
      ]);

      // Mock category distribution
      setCategoryData([
        { name: 'Veterinary', value: 35, revenue: 148750 },
        { name: 'Grooming', value: 22, revenue: 93500 },
        { name: 'E-Commerce', value: 18, revenue: 76500 },
        { name: 'Training', value: 12, revenue: 51000 },
        { name: 'Boarding', value: 8, revenue: 34000 },
        { name: 'Others', value: 5, revenue: 21250 }
      ]);

      // Mock Vendor Table Data
      setVendorTableData([
        { id: '1', name: 'PetCare Veterinary', category: 'Veterinary', totalRevenue: 125000, totalBookings: 145, rating: 4.9, status: 'Active', growth: 12 },
        { id: '2', name: 'Grooming Paradise', category: 'Grooming', totalRevenue: 98000, totalBookings: 112, rating: 4.8, status: 'Active', growth: 8 },
        { id: '3', name: 'Training Masters', category: 'Training', totalRevenue: 75000, totalBookings: 89, rating: 4.7, status: 'Active', growth: -2 },
        { id: '4', name: 'Pet Supplies Pro', category: 'Retail', totalRevenue: 62000, totalBookings: 230, rating: 4.6, status: 'Active', growth: 15 },
        { id: '5', name: 'Happy Paws Boarding', category: 'Boarding', totalRevenue: 54000, totalBookings: 45, rating: 4.5, status: 'Warning', growth: 5 },
        { id: '6', name: 'City Vet Clinic', category: 'Veterinary', totalRevenue: 48000, totalBookings: 67, rating: 4.4, status: 'Active', growth: 3 },
        { id: '7', name: 'Dog Walkers Inc', category: 'Walking', totalRevenue: 32000, totalBookings: 156, rating: 4.8, status: 'Active', growth: 20 },
      ]);

    } catch (error) {
      console.error('Error loading analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const kpiCards: KPICard[] = [
    {
      title: 'Total GMV',
      value: `₹${(kpiData.totalGMV / 1000).toFixed(0)}K`,
      change: 12.5,
      icon: <DollarSign className="w-5 h-5" />,
      color: 'bg-green-500'
    },
    {
      title: 'Commission Earned',
      value: `₹${(kpiData.commissionEarned / 1000).toFixed(0)}K`,
      change: 8.3,
      icon: <Target className="w-5 h-5" />,
      color: 'bg-[#FF8C42]'
    },
    {
      title: 'Active Customers',
      value: kpiData.activeCustomers.toLocaleString(),
      change: 15.2,
      icon: <Users className="w-5 h-5" />,
      color: 'bg-blue-500'
    },
    {
      title: 'Active Vendors',
      value: kpiData.activeVendors.toLocaleString(),
      change: 5.7,
      icon: <Package className="w-5 h-5" />,
      color: 'bg-purple-500'
    },
  ];

  const COLORS = ['#FF8C42', '#4F46E5', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'];

  const exportData = () => {
    console.log('Exporting analytics data...');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FF8C42] mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading analytics...</p>
        </div>
      </div>
    );
  }

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
                <h1 className="text-xl font-semibold">Analytics Dashboard</h1>
                <p className="text-sm text-gray-500">Platform performance metrics</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Select value={dateRange} onValueChange={setDateRange}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="24h">Last 24 Hours</SelectItem>
                  <SelectItem value="7d">Last 7 Days</SelectItem>
                  <SelectItem value="30d">Last 30 Days</SelectItem>
                  <SelectItem value="90d">Last 90 Days</SelectItem>
                  <SelectItem value="1y">Last Year</SelectItem>
                </SelectContent>
              </Select>
              <Button onClick={exportData} className="bg-[#FF8C42] hover:bg-[#ff7a28]">
                <Download className="w-4 h-4 mr-2" />
                Export
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {kpiCards.map((kpi, index) => (
            <Card key={index} className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className={`${kpi.color} text-white p-3 rounded-lg`}>
                  {kpi.icon}
                </div>
                <div className={`flex items-center text-sm ${kpi.change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {kpi.change >= 0 ? <TrendingUp className="w-4 h-4 mr-1" /> : <TrendingDown className="w-4 h-4 mr-1" />}
                  {Math.abs(kpi.change)}%
                </div>
              </div>
              <h3 className="text-2xl font-bold mb-1">{kpi.value}</h3>
              <p className="text-sm text-gray-500">{kpi.title}</p>
            </Card>
          ))}
        </div>

        {/* Tabs for Different Views */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-6">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="revenue">Revenue</TabsTrigger>
            <TabsTrigger value="vendors">Vendors</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Main Revenue Chart */}
              <RevenueChart data={revenueData} title="Platform Revenue Trend" />

              {/* Category Distribution */}
              <Card className="p-6">
                <h3 className="text-lg font-semibold mb-4">Revenue by Category</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={categoryData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      outerRadius={100}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {categoryData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </Card>
            </div>
          </TabsContent>

          {/* Revenue Tab */}
          <TabsContent value="revenue" className="space-y-6">
             <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
               <Card className="p-6">
                 <h4 className="text-sm text-gray-500 mb-2">Total Revenue</h4>
                 <p className="text-3xl font-bold text-[#FF8C42]">₹{(kpiData.totalRevenue / 1000).toFixed(0)}K</p>
                 <p className="text-sm text-green-600 mt-2">+12.5% from last period</p>
               </Card>
               <Card className="p-6">
                 <h4 className="text-sm text-gray-500 mb-2">Commission</h4>
                 <p className="text-3xl font-bold text-purple-600">₹{(kpiData.commissionEarned / 1000).toFixed(0)}K</p>
                 <p className="text-sm text-green-600 mt-2">+8.3% from last period</p>
               </Card>
               <Card className="p-6">
                 <h4 className="text-sm text-gray-500 mb-2">Avg Order Value</h4>
                 <p className="text-3xl font-bold text-blue-600">₹{kpiData.avgOrderValue}</p>
                 <p className="text-sm text-red-600 mt-2">-3.2% from last period</p>
               </Card>
             </div>
             
             <RevenueChart data={revenueData} title="Detailed Revenue Analysis" />
          </TabsContent>

          {/* Vendors Tab */}
          <TabsContent value="vendors" className="space-y-6">
            <Card className="p-6">
               <div className="flex justify-between items-center mb-6">
                  <h3 className="text-lg font-semibold">Vendor Performance</h3>
                  <div className="flex gap-2">
                     <Select defaultValue="revenue">
                        <SelectTrigger className="w-[150px]">
                           <SelectValue placeholder="Sort by" />
                        </SelectTrigger>
                        <SelectContent>
                           <SelectItem value="revenue">Revenue</SelectItem>
                           <SelectItem value="bookings">Bookings</SelectItem>
                           <SelectItem value="rating">Rating</SelectItem>
                        </SelectContent>
                     </Select>
                     <Button variant="outline">
                        <Download className="w-4 h-4 mr-2" /> Export
                     </Button>
                  </div>
               </div>
               
               {/* Updated Table Component */}
               <VendorPerformanceTable data={vendorTableData} />
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
