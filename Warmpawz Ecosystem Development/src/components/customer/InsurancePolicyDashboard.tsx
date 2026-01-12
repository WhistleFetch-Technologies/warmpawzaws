import React, { useState, useEffect } from 'react';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { Badge } from '../ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../ui/tabs';
import { 
  Shield, FileText, Download, Plus, AlertCircle, 
  CheckCircle, Clock, XCircle, ChevronRight, FilePlus
} from 'lucide-react';
import { toast } from 'sonner@2.0.3';
import MockAPI from '../../lib/mockAPI';
import { format } from 'date-fns';

interface InsurancePolicyDashboardProps {
  customerId: string;
  onBack: () => void;
  onFileClaim: (policyId: string) => void;
}

export function InsurancePolicyDashboard({ customerId, onBack, onFileClaim }: InsurancePolicyDashboardProps) {
  const [policies, setPolicies] = useState<any[]>([]);
  const [claims, setClaims] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('policies');

  useEffect(() => {
    loadDashboardData();
  }, [customerId]);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      
      // Get customer insurance data from MockAPI
      const [customerPolicies, customerClaims] = await Promise.all([
        MockAPI.integratedServices.getCustomerPolicies(customerId),
        MockAPI.integratedServices.getCustomerClaims(customerId)
      ]);

      setPolicies(customerPolicies);
      setClaims(customerClaims);

    } catch (error) {
      console.error('Error loading dashboard:', error);
      toast.error('Failed to load insurance data');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800 border-green-200';
      case 'expired': return 'bg-gray-100 text-gray-800 border-gray-200';
      case 'pending_documents': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'under_review': return 'bg-blue-100 text-blue-800 border-blue-200';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getClaimStatusColor = (status: string) => {
    switch (status) {
      case 'approved': return 'bg-green-100 text-green-800';
      case 'paid': return 'bg-green-100 text-green-800';
      case 'rejected': return 'bg-red-100 text-red-800';
      case 'submitted': return 'bg-blue-100 text-blue-800';
      case 'under_review': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const handleDownloadPolicy = (policy: any) => {
    toast.success(`Downloading policy for ${policy.petName}...`);
    // Simulate download
    setTimeout(() => {
        const element = document.createElement("a");
        const file = new Blob([
            `POLICY DOCUMENT\n\nPolicy Number: ${policy.policyNumber}\nPet: ${policy.petName}\nCoverage: ₹${policy.coverageAmount}\nDates: ${policy.startDate} to ${policy.endDate}\nStatus: ${policy.status.toUpperCase()}`
        ], {type: 'text/plain'});
        element.href = URL.createObjectURL(file);
        element.download = `Policy-${policy.policyNumber}.txt`;
        document.body.appendChild(element);
        element.click();
    }, 1500);
  };

  if (loading) {
    return <div className="p-8 text-center text-gray-500">Loading your insurance portfolio...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <div className="bg-white p-4 border-b sticky top-0 z-10 flex items-center gap-3 shadow-sm">
        <Button variant="ghost" size="icon" onClick={onBack}>
            <ChevronRight className="w-6 h-6 rotate-180" />
        </Button>
        <h1 className="text-lg font-bold text-gray-900">My Insurance</h1>
      </div>

      <div className="p-4">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="w-full grid grid-cols-2 mb-6">
            <TabsTrigger value="policies">My Policies</TabsTrigger>
            <TabsTrigger value="claims">Claims History</TabsTrigger>
          </TabsList>

          <TabsContent value="policies" className="space-y-4">
            {policies.length === 0 ? (
              <div className="text-center py-12">
                <Shield className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <h3 className="text-lg font-semibold text-gray-900">No Active Policies</h3>
                <p className="text-gray-500 mb-6">Protect your pets today with comprehensive coverage.</p>
                <Button onClick={onBack} className="bg-orange-600 hover:bg-orange-700">
                  Browse Plans
                </Button>
              </div>
            ) : (
              policies.map(policy => (
                <Card key={policy.policyId} className="overflow-hidden border-l-4 border-l-orange-500">
                  <div className="p-4">
                    <div className="flex justify-between items-start mb-3">
                        <div>
                            <h3 className="font-bold text-gray-900">{policy.planName}</h3>
                            <p className="text-sm text-gray-500">Pet: {policy.petName}</p>
                        </div>
                        <Badge className={`${getStatusColor(policy.status)} border`}>
                            {policy.status.replace('_', ' ').toUpperCase()}
                        </Badge>
                    </div>

                    <div className="grid grid-cols-2 gap-4 my-4 text-sm">
                        <div>
                            <p className="text-gray-500 text-xs">Policy Number</p>
                            <p className="font-mono font-medium">{policy.policyNumber}</p>
                        </div>
                        <div className="text-right">
                            <p className="text-gray-500 text-xs">Coverage</p>
                            <p className="font-bold text-gray-900">₹{policy.coverageAmount.toLocaleString()}</p>
                        </div>
                        <div>
                            <p className="text-gray-500 text-xs">Valid Until</p>
                            <p className="font-medium">{format(new Date(policy.endDate), 'dd MMM yyyy')}</p>
                        </div>
                        <div className="text-right">
                            <p className="text-gray-500 text-xs">Premium</p>
                            <p className="font-medium">₹{policy.premiumAmount.toLocaleString()}/{policy.paymentFrequency === 'monthly' ? 'mo' : 'yr'}</p>
                        </div>
                    </div>

                    <div className="flex gap-3 pt-3 border-t border-gray-100">
                        <Button 
                            variant="outline" 
                            size="sm" 
                            className="flex-1"
                            onClick={() => handleDownloadPolicy(policy)}
                        >
                            <Download className="w-4 h-4 mr-2" /> Policy
                        </Button>
                        {policy.status === 'active' && (
                            <Button 
                                size="sm" 
                                className="flex-1 bg-red-600 hover:bg-red-700 text-white"
                                onClick={() => onFileClaim(policy.policyId)}
                            >
                                <FilePlus className="w-4 h-4 mr-2" /> File Claim
                            </Button>
                        )}
                    </div>
                  </div>
                </Card>
              ))
            )}
          </TabsContent>

          <TabsContent value="claims" className="space-y-4">
            {claims.length === 0 ? (
              <div className="text-center py-12">
                <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <h3 className="text-lg font-semibold text-gray-900">No Claims Yet</h3>
                <p className="text-gray-500">Your claim history will appear here.</p>
              </div>
            ) : (
              claims.map(claim => (
                <Card key={claim.claimId} className="p-4">
                    <div className="flex justify-between items-start mb-2">
                        <div>
                            <h4 className="font-bold text-gray-900">{claim.claimType.charAt(0).toUpperCase() + claim.claimType.slice(1)} Claim</h4>
                            <p className="text-xs text-gray-500">{format(new Date(claim.incidentDate), 'dd MMM yyyy')}</p>
                        </div>
                        <Badge className={getClaimStatusColor(claim.status)}>
                            {claim.status.toUpperCase()}
                        </Badge>
                    </div>
                    
                    <div className="flex justify-between items-end mt-3">
                        <div>
                            <p className="text-xs text-gray-500">Amount Claimed</p>
                            <p className="font-bold text-gray-900">₹{claim.claimAmount.toLocaleString()}</p>
                        </div>
                        {claim.approvedAmount && (
                            <div className="text-right">
                                <p className="text-xs text-gray-500">Approved</p>
                                <p className="font-bold text-green-600">₹{claim.approvedAmount.toLocaleString()}</p>
                            </div>
                        )}
                    </div>

                    {claim.rejectionReason && (
                        <div className="mt-3 bg-red-50 p-2 rounded text-xs text-red-700 flex gap-2 items-start">
                            <AlertCircle className="w-4 h-4 flex-shrink-0" />
                            <p>{claim.rejectionReason}</p>
                        </div>
                    )}
                </Card>
              ))
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}