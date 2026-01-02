import { useState, useEffect } from 'react';
import { 
  Shield, Plus, FileText, CheckCircle, XCircle, Clock, 
  TrendingUp, Users, DollarSign, AlertCircle, Eye, Filter,
  Calendar, Download, Search
} from 'lucide-react';
import { Button } from '../../ui/button';
import { Badge } from '../../ui/badge';
import { Card } from '../../ui/card';
// ✅ FIX: Removed Supabase imports - using API Gateway now

interface InsurancePlan {
  id: string;
  planName: string;
  petType: string;
  coverageAmount: number;
  premium: number;
  coveragePercentage: number;
  claimTurnaroundDays: number;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
  approvedAt?: string;
  rejectedAt?: string;
  adminNotes?: string;
}

interface Claim {
  id: string;
  claimNumber: string;
  policyNumber: string;
  customerName: string;
  petName: string;
  claimAmount: number;
  status: 'pending' | 'approved' | 'rejected' | 'info_requested';
  submittedAt: string;
  documents: string[];
  claimType: string;
}

interface DashboardStats {
  totalPlans: number;
  activePlans: number;
  pendingApproval: number;
  totalClaims: number;
  pendingClaims: number;
  claimsApproved: number;
  totalRevenue: number;
  monthlyRevenue: number;
}

export function InsuranceDashboard({ 
  vendorId, 
  onCreatePlan,
  onViewPlan,
  onViewClaim 
}: { 
  vendorId: string;
  onCreatePlan: () => void;
  onViewPlan: (planId: string) => void;
  onViewClaim: (claimId: string) => void;
}) {
  const [activeTab, setActiveTab] = useState<'plans' | 'claims' | 'analytics'>('plans');
  const [stats, setStats] = useState<DashboardStats>({
    totalPlans: 0,
    activePlans: 0,
    pendingApproval: 0,
    totalClaims: 0,
    pendingClaims: 0,
    claimsApproved: 0,
    totalRevenue: 0,
    monthlyRevenue: 0
  });
  const [plans, setPlans] = useState<InsurancePlan[]>([]);
  const [claims, setClaims] = useState<Claim[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>('all');

  useEffect(() => {
    loadDashboardData();
  }, [vendorId]);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      
      // ✅ FIX: Use API Gateway URL instead of Supabase
      const API_GATEWAY_URL = process.env.NEXT_PUBLIC_API_GATEWAY_URL || '';
      if (!API_GATEWAY_URL) {
        throw new Error('API Gateway URL not configured');
      }
      
      const { apiCallJson } = await import('@warmpawz/api-client/http');
      
      // Load plans
      try {
        const plansData = await apiCallJson<any>(
          `${API_GATEWAY_URL}/make-server-3dd53475/vendor/${vendorId}/insurance/plans`
        );
        
        if (plansData.success && plansData.plans) {
          setPlans(plansData.plans);
          
          // Calculate stats
          const totalPlans = plansData.plans.length || 0;
          const activePlans = plansData.plans.filter((p: InsurancePlan) => p.status === 'approved').length || 0;
          const pendingApproval = plansData.plans.filter((p: InsurancePlan) => p.status === 'pending').length || 0;
          
          setStats(prev => ({
            ...prev,
            totalPlans,
            activePlans,
            pendingApproval
          }));
        } else {
          setPlans([]);
        }
      } catch (planError) {
        console.warn('Insurance plans endpoint not available');
        setPlans([]);
      }
      
      // Load claims
      try {
        const claimsData = await apiCallJson<any>(
          `${API_GATEWAY_URL}/make-server-3dd53475/vendor/${vendorId}/insurance/claims`
        );
        
        if (claimsData.success && claimsData.claims) {
          setClaims(claimsData.claims);
          
          const totalClaims = claimsData.claims.length || 0;
          const pendingClaims = claimsData.claims.filter((c: Claim) => c.status === 'pending').length || 0;
          const claimsApproved = claimsData.claims.filter((c: Claim) => c.status === 'approved').length || 0;
          
          setStats(prev => ({
            ...prev,
            totalClaims,
            pendingClaims,
            claimsApproved
          }));
        } else {
          setClaims([]);
        }
      } catch (claimError) {
        console.warn('Insurance claims endpoint not available');
        setClaims([]);
      }
      
    } catch (error: any) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved': return 'bg-green-100 text-green-700';
      case 'rejected': return 'bg-red-100 text-red-700';
      case 'pending': return 'bg-yellow-100 text-yellow-700';
      case 'info_requested': return 'bg-blue-100 text-blue-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'approved': return <CheckCircle className="w-4 h-4" />;
      case 'rejected': return <XCircle className="w-4 h-4" />;
      case 'pending': return <Clock className="w-4 h-4" />;
      case 'info_requested': return <AlertCircle className="w-4 h-4" />;
      default: return <Clock className="w-4 h-4" />;
    }
  };

  const filteredPlans = filterStatus === 'all' 
    ? plans 
    : plans.filter(p => p.status === filterStatus);

  const filteredClaims = filterStatus === 'all'
    ? claims
    : claims.filter(c => c.status === filterStatus);

  return (
    <div className="min-h-screen bg-gray-50 w-full max-w-[430px] mx-auto pb-20">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-6 text-white">
        <div className="flex items-center gap-3 mb-4">
          <Shield className="w-8 h-8" />
          <div>
            <h1 className="text-xl font-bold">Insurance Dashboard</h1>
            <p className="text-blue-100 text-sm">Manage plans & claims</p>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-3 gap-3 mt-4">
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3">
            <div className="text-2xl font-bold">{stats.activePlans}</div>
            <div className="text-xs text-blue-100">Active Plans</div>
          </div>
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3">
            <div className="text-2xl font-bold">{stats.pendingClaims}</div>
            <div className="text-xs text-blue-100">Pending Claims</div>
          </div>
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3">
            <div className="text-2xl font-bold">{stats.totalPlans}</div>
            <div className="text-xs text-blue-100">Total Plans</div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="flex">
          <button
            onClick={() => setActiveTab('plans')}
            className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'plans'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-600'
            }`}
          >
            <FileText className="w-4 h-4 inline mr-1" />
            Plans ({stats.totalPlans})
          </button>
          <button
            onClick={() => setActiveTab('claims')}
            className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'claims'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-600'
            }`}
          >
            <Shield className="w-4 h-4 inline mr-1" />
            Claims ({stats.totalClaims})
          </button>
          <button
            onClick={() => setActiveTab('analytics')}
            className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'analytics'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-600'
            }`}
          >
            <TrendingUp className="w-4 h-4 inline mr-1" />
            Analytics
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        {/* Plans Tab */}
        {activeTab === 'plans' && (
          <div className="space-y-4">
            {/* Create Plan CTA */}
            <Button
              onClick={onCreatePlan}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white"
            >
              <Plus className="w-4 h-4 mr-2" />
              Create New Plan
            </Button>

            {/* Filter */}
            <div className="flex gap-2 overflow-x-auto pb-2">
              {['all', 'approved', 'pending', 'rejected'].map(status => (
                <button
                  key={status}
                  onClick={() => setFilterStatus(status)}
                  className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap ${
                    filterStatus === status
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700'
                  }`}
                >
                  {status.charAt(0).toUpperCase() + status.slice(1)}
                </button>
              ))}
            </div>

            {/* Plans List */}
            {loading ? (
              <div className="text-center py-8 text-gray-500">Loading plans...</div>
            ) : filteredPlans.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-xl border border-dashed border-gray-300">
                <FileText className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                <p className="text-gray-600">No plans found</p>
                <p className="text-sm text-gray-500 mt-1">Create your first insurance plan</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredPlans.map(plan => (
                  <div
                    key={plan.id}
                    onClick={() => onViewPlan(plan.id)}
                    className="bg-white rounded-xl p-4 border border-gray-200 cursor-pointer hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <h3 className="font-semibold text-gray-900">{plan.planName}</h3>
                        <p className="text-sm text-gray-600">{plan.petType}</p>
                      </div>
                      <Badge className={getStatusColor(plan.status)}>
                        {getStatusIcon(plan.status)}
                        <span className="ml-1">{plan.status}</span>
                      </Badge>
                    </div>

                    <div className="grid grid-cols-2 gap-3 mt-3">
                      <div className="bg-blue-50 rounded-lg p-2">
                        <div className="text-xs text-blue-600">Coverage</div>
                        <div className="text-sm font-semibold text-blue-900">
                          ₹{plan.coverageAmount.toLocaleString()}
                        </div>
                      </div>
                      <div className="bg-green-50 rounded-lg p-2">
                        <div className="text-xs text-green-600">Premium</div>
                        <div className="text-sm font-semibold text-green-900">
                          ₹{plan.premium.toLocaleString()}/year
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between mt-3 text-xs text-gray-500">
                      <span>Coverage: {plan.coveragePercentage}%</span>
                      <span>{plan.claimTurnaroundDays} days claim TAT</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Claims Tab */}
        {activeTab === 'claims' && (
          <div className="space-y-4">
            {/* Filter */}
            <div className="flex gap-2 overflow-x-auto pb-2">
              {['all', 'pending', 'approved', 'rejected', 'info_requested'].map(status => (
                <button
                  key={status}
                  onClick={() => setFilterStatus(status)}
                  className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap ${
                    filterStatus === status
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700'
                  }`}
                >
                  {status.replace('_', ' ').charAt(0).toUpperCase() + status.slice(1).replace('_', ' ')}
                </button>
              ))}
            </div>

            {/* Claims List */}
            {loading ? (
              <div className="text-center py-8 text-gray-500">Loading claims...</div>
            ) : filteredClaims.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-xl border border-dashed border-gray-300">
                <Shield className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                <p className="text-gray-600">No claims found</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredClaims.map(claim => (
                  <div
                    key={claim.id}
                    onClick={() => onViewClaim(claim.id)}
                    className="bg-white rounded-xl p-4 border border-gray-200 cursor-pointer hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <div className="text-xs text-gray-500">#{claim.claimNumber}</div>
                        <h3 className="font-semibold text-gray-900">{claim.customerName}</h3>
                        <p className="text-sm text-gray-600">{claim.petName} • {claim.claimType}</p>
                      </div>
                      <Badge className={getStatusColor(claim.status)}>
                        {getStatusIcon(claim.status)}
                        <span className="ml-1">{claim.status.replace('_', ' ')}</span>
                      </Badge>
                    </div>

                    <div className="bg-orange-50 rounded-lg p-3 mt-3">
                      <div className="text-xs text-orange-600">Claim Amount</div>
                      <div className="text-lg font-bold text-orange-900">
                        ₹{claim.claimAmount.toLocaleString()}
                      </div>
                    </div>

                    <div className="flex items-center justify-between mt-3 text-xs text-gray-500">
                      <span>{new Date(claim.submittedAt).toLocaleDateString()}</span>
                      <span>{claim.documents.length} documents</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Analytics Tab */}
        {activeTab === 'analytics' && (
          <div className="space-y-4">
            <Card className="p-4">
              <h3 className="font-semibold mb-4">Performance Overview</h3>
              
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <Users className="w-5 h-5 text-blue-600" />
                    <span className="text-sm text-gray-700">Total Active Policies</span>
                  </div>
                  <span className="font-bold text-blue-900">{stats.activePlans}</span>
                </div>

                <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <CheckCircle className="w-5 h-5 text-green-600" />
                    <span className="text-sm text-gray-700">Claims Approved</span>
                  </div>
                  <span className="font-bold text-green-900">{stats.claimsApproved}</span>
                </div>

                <div className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <Clock className="w-5 h-5 text-yellow-600" />
                    <span className="text-sm text-gray-700">Pending Claims</span>
                  </div>
                  <span className="font-bold text-yellow-900">{stats.pendingClaims}</span>
                </div>

                <div className="flex items-center justify-between p-3 bg-purple-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <DollarSign className="w-5 h-5 text-purple-600" />
                    <span className="text-sm text-gray-700">Total Revenue</span>
                  </div>
                  <span className="font-bold text-purple-900">
                    ₹{stats.totalRevenue.toLocaleString()}
                  </span>
                </div>
              </div>
            </Card>

            <Card className="p-4">
              <h3 className="font-semibold mb-3">Quick Actions</h3>
              <div className="space-y-2">
                <Button variant="outline" className="w-full justify-start">
                  <Download className="w-4 h-4 mr-2" />
                  Export Claims Report
                </Button>
                <Button variant="outline" className="w-full justify-start">
                  <Calendar className="w-4 h-4 mr-2" />
                  View Claim Trends
                </Button>
                <Button variant="outline" className="w-full justify-start">
                  <TrendingUp className="w-4 h-4 mr-2" />
                  Revenue Analytics
                </Button>
              </div>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
