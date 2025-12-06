import { useState, useEffect } from 'react';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select';
import { Plus, Trash2, Save, RotateCcw, ArrowLeft, Edit } from 'lucide-react';
import { projectId, publicAnonKey } from '../../../utils/supabase/info';
import { toast } from 'sonner@2.0.3';

interface RefundTier {
  id: string;
  name: string;
  hoursBeforeService: number;
  refundPercentage: number;
  cancellationFee: number | null;
  applicableServices: string[];
  status: 'active' | 'inactive';
  createdAt: string;
}

interface ProviderPolicy {
  id: string;
  name: string;
  refundToCustomer: number;
  additionalCompensation: number;
  cancellationFee: number;
  status: 'active' | 'inactive';
}

interface ProcessingConfig {
  mode: 'auto' | 'manual';
  processingTimeBusinessDays: number;
  actionRefundType: 'immediate' | 'scheduled';
  disputeResolutionTimeDays: number;
  refundPreference: 'wallet' | 'original';
}

interface RefundPoliciesManagementProps {
  onBack: () => void;
}

export function RefundPoliciesManagement({ onBack }: RefundPoliciesManagementProps) {
  const [refundTiers, setRefundTiers] = useState<RefundTier[]>([]);
  const [providerPolicies, setProviderPolicies] = useState<ProviderPolicy[]>([]);
  const [processingConfig, setProcessingConfig] = useState<ProcessingConfig>({
    mode: 'auto',
    processingTimeBusinessDays: 7,
    actionRefundType: 'immediate',
    disputeResolutionTimeDays: 7,
    refundPreference: 'wallet'
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedView, setSelectedView] = useState<'tiers' | 'provider' | 'processing'>('tiers');
  const [editingTier, setEditingTier] = useState<RefundTier | null>(null);
  const [showAddTier, setShowAddTier] = useState(false);

  useEffect(() => {
    loadRefundPolicies();
  }, []);

  const loadRefundPolicies = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/admin/vendor-settings`,
        {
          headers: { 'Authorization': `Bearer ${publicAnonKey}` }
        }
      );

      if (response.ok) {
        const data = await response.json();
        if (data.refundPolicies) {
          const tiers = data.refundPolicies.customerCancellation?.tiers?.map((tier: any, index: number) => ({
            id: `tier_${index + 1}`,
            name: `Tier ${index + 1} - ${tier.hoursBeforeService}h before`,
            hoursBeforeService: tier.hoursBeforeService,
            refundPercentage: tier.refundPercentage,
            cancellationFee: tier.cancellationFee,
            applicableServices: ['All Services'],
            status: 'active' as const,
            createdAt: new Date().toISOString()
          })) || [];
          setRefundTiers(tiers);

          const providerPolicy = data.refundPolicies.providerCancellation;
          if (providerPolicy) {
            setProviderPolicies([{
              id: 'provider_1',
              name: 'Default Provider Cancellation Policy',
              refundToCustomer: providerPolicy.refundToCustomer,
              additionalCompensation: providerPolicy.additionalCompensation,
              cancellationFee: providerPolicy.cancellationFee,
              status: 'active' as const
            }]);
          }

          if (data.refundPolicies.refundProcessing) {
            setProcessingConfig(data.refundPolicies.refundProcessing);
          }
        }
      }
    } catch (error) {
      console.error('Error loading refund policies:', error);
      toast.error('Failed to load refund policies');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveTiers = async () => {
    setSaving(true);
    try {
      const policies = {
        customerCancellation: {
          tiers: refundTiers.filter(t => t.status === 'active').map(tier => ({
            hoursBeforeService: tier.hoursBeforeService,
            refundPercentage: tier.refundPercentage,
            cancellationFee: tier.cancellationFee
          }))
        },
        providerCancellation: providerPolicies[0] ? {
          refundToCustomer: providerPolicies[0].refundToCustomer,
          additionalCompensation: providerPolicies[0].additionalCompensation,
          cancellationFee: providerPolicies[0].cancellationFee
        } : {},
        refundProcessing: processingConfig
      };

      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/admin/vendor-settings/refund`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${publicAnonKey}`
          },
          body: JSON.stringify(policies)
        }
      );

      if (response.ok) {
        toast.success('Refund policies saved successfully!');
        setShowAddTier(false);
        setEditingTier(null);
      } else {
        toast.error('Failed to save refund policies');
      }
    } catch (error) {
      console.error('Error saving refund policies:', error);
      toast.error('Error saving refund policies');
    } finally {
      setSaving(false);
    }
  };

  const handleAddTier = () => {
    const newTier: RefundTier = {
      id: `tier_${Date.now()}`,
      name: `Tier ${refundTiers.length + 1}`,
      hoursBeforeService: 12,
      refundPercentage: 50,
      cancellationFee: null,
      applicableServices: ['All Services'],
      status: 'active',
      createdAt: new Date().toISOString()
    };
    setRefundTiers([...refundTiers, newTier]);
    setEditingTier(newTier);
    setShowAddTier(true);
  };

  const handleDeleteTier = (tierId: string) => {
    if (confirm('Are you sure you want to delete this tier?')) {
      setRefundTiers(refundTiers.filter(t => t.id !== tierId));
      toast.success('Tier deleted successfully');
    }
  };

  const handleToggleTierStatus = (tierId: string) => {
    setRefundTiers(refundTiers.map(tier => 
      tier.id === tierId 
        ? { ...tier, status: tier.status === 'active' ? 'inactive' : 'active' }
        : tier
    ));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FF8C42]"></div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      {/* Header with prominent Create button */}
      <div className="flex items-center justify-between mb-6 pb-4 border-b-2 border-gray-200">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Refund Policies Management</h2>
            <p className="text-sm text-gray-500">Configure cancellation and refund policies for services</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={loadRefundPolicies}>
            <RotateCcw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
          <Button 
            size="default" 
            onClick={handleAddTier} 
            className="bg-green-600 hover:bg-green-700 text-white font-semibold px-6 shadow-lg"
          >
            <Plus className="w-5 h-5 mr-2" />
            Create New Tier
          </Button>
          <Button 
            size="sm" 
            onClick={handleSaveTiers} 
            disabled={saving} 
            className="bg-[#FF8C42] hover:bg-[#FF7A2E]"
          >
            <Save className="w-4 h-4 mr-2" />
            {saving ? 'Saving...' : 'Save All Changes'}
          </Button>
        </div>
      </div>

      <div className="flex gap-2 mb-6 border-b border-gray-200">
        <button
          onClick={() => setSelectedView('tiers')}
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            selectedView === 'tiers'
              ? 'border-b-2 border-[#FF8C42] text-[#FF8C42]'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          Customer Cancellation Tiers
        </button>
        <button
          onClick={() => setSelectedView('provider')}
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            selectedView === 'provider'
              ? 'border-b-2 border-[#FF8C42] text-[#FF8C42]'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          Provider Policies
        </button>
        <button
          onClick={() => setSelectedView('processing')}
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            selectedView === 'processing'
              ? 'border-b-2 border-[#FF8C42] text-[#FF8C42]'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          Processing Settings
        </button>
      </div>

      {selectedView === 'tiers' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-medium text-gray-900">Active Cancellation Tiers</h3>
            <Button size="sm" onClick={handleAddTier} className="bg-[#FF8C42] hover:bg-[#FF7A2E]">
              <Plus className="w-4 h-4 mr-2" />
              Add New Tier
            </Button>
          </div>

          <div className="space-y-3">
            {refundTiers.map((tier) => (
              <div
                key={tier.id}
                className={`border rounded-lg p-4 ${
                  tier.status === 'active' ? 'border-gray-200 bg-white' : 'border-gray-100 bg-gray-50 opacity-60'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h4 className="font-medium text-gray-900">{tier.name}</h4>
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        tier.status === 'active' 
                          ? 'bg-green-100 text-green-700' 
                          : 'bg-gray-100 text-gray-600'
                      }`}>
                        {tier.status}
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div>
                        <span className="text-gray-500">Hours Before:</span>
                        <span className="ml-2 font-medium">{tier.hoursBeforeService}h</span>
                      </div>
                      <div>
                        <span className="text-gray-500">Refund:</span>
                        <span className="ml-2 font-medium">{tier.refundPercentage}%</span>
                      </div>
                      <div>
                        <span className="text-gray-500">Fee:</span>
                        <span className="ml-2 font-medium">
                          {tier.cancellationFee ? `₹${tier.cancellationFee}` : 'None'}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setEditingTier(tier);
                        setShowAddTier(true);
                      }}
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleToggleTierStatus(tier.id)}
                    >
                      {tier.status === 'active' ? 'Deactivate' : 'Activate'}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteTier(tier.id)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {showAddTier && editingTier && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
                <h3 className="text-lg font-semibold mb-4">
                  {editingTier.id.startsWith('tier_') && refundTiers.find(t => t.id === editingTier.id)?.createdAt === editingTier.createdAt
                    ? 'Edit Tier'
                    : 'Add New Tier'}
                </h3>
                <div className="space-y-4">
                  <div>
                    <Label>Tier Name</Label>
                    <Input
                      value={editingTier.name}
                      onChange={(e) => setEditingTier({ ...editingTier, name: e.target.value })}
                      placeholder="e.g., Early Cancellation Tier"
                    />
                  </div>
                  <div>
                    <Label>Hours Before Service</Label>
                    <Input
                      type="number"
                      value={editingTier.hoursBeforeService}
                      onChange={(e) => setEditingTier({ ...editingTier, hoursBeforeService: parseFloat(e.target.value) })}
                    />
                  </div>
                  <div>
                    <Label>Refund Percentage (%)</Label>
                    <Input
                      type="number"
                      value={editingTier.refundPercentage}
                      onChange={(e) => setEditingTier({ ...editingTier, refundPercentage: parseFloat(e.target.value) })}
                    />
                  </div>
                  <div>
                    <Label>Cancellation Fee (₹) - Optional</Label>
                    <Input
                      type="number"
                      value={editingTier.cancellationFee || ''}
                      onChange={(e) => setEditingTier({ 
                        ...editingTier, 
                        cancellationFee: e.target.value ? parseFloat(e.target.value) : null 
                      })}
                      placeholder="Leave empty for no fee"
                    />
                  </div>
                </div>
                <div className="flex gap-2 mt-6">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => {
                      setShowAddTier(false);
                      setEditingTier(null);
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    className="flex-1 bg-[#FF8C42] hover:bg-[#FF7A2E]"
                    onClick={() => {
                      const index = refundTiers.findIndex(t => t.id === editingTier.id);
                      if (index !== -1) {
                        const updated = [...refundTiers];
                        updated[index] = editingTier;
                        setRefundTiers(updated);
                      }
                      setShowAddTier(false);
                      setEditingTier(null);
                      toast.success('Tier updated successfully');
                    }}
                  >
                    Save Tier
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {selectedView === 'provider' && (
        <div>
          <h3 className="font-medium text-gray-900 mb-4">Provider Cancellation Policy</h3>
          {providerPolicies[0] && (
            <div className="border border-gray-200 rounded-lg p-6">
              <div className="grid grid-cols-3 gap-6">
                <div>
                  <Label className="text-sm mb-2">Refund to Customer (%)</Label>
                  <Input
                    type="number"
                    value={providerPolicies[0].refundToCustomer}
                    onChange={(e) => {
                      const updated = [...providerPolicies];
                      updated[0].refundToCustomer = parseFloat(e.target.value);
                      setProviderPolicies(updated);
                    }}
                  />
                </div>
                <div>
                  <Label className="text-sm mb-2">Additional Compensation (%)</Label>
                  <Input
                    type="number"
                    value={providerPolicies[0].additionalCompensation}
                    onChange={(e) => {
                      const updated = [...providerPolicies];
                      updated[0].additionalCompensation = parseFloat(e.target.value);
                      setProviderPolicies(updated);
                    }}
                  />
                </div>
                <div>
                  <Label className="text-sm mb-2">Provider Penalty Fee (₹)</Label>
                  <Input
                    type="number"
                    value={providerPolicies[0].cancellationFee}
                    onChange={(e) => {
                      const updated = [...providerPolicies];
                      updated[0].cancellationFee = parseFloat(e.target.value);
                      setProviderPolicies(updated);
                    }}
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {selectedView === 'processing' && (
        <div>
          <h3 className="font-medium text-gray-900 mb-4">Refund Processing Configuration</h3>
          <div className="border border-gray-200 rounded-lg p-6 space-y-6">
            <div className="grid grid-cols-2 gap-6">
              <div>
                <Label className="text-sm mb-2">Processing Mode</Label>
                <Select
                  value={processingConfig.mode}
                  onValueChange={(value: 'auto' | 'manual') => 
                    setProcessingConfig({ ...processingConfig, mode: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="auto">Automatic</SelectItem>
                    <SelectItem value="manual">Manual Review</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-sm mb-2">Processing Time (Business Days)</Label>
                <Input
                  type="number"
                  value={processingConfig.processingTimeBusinessDays}
                  onChange={(e) => 
                    setProcessingConfig({ 
                      ...processingConfig, 
                      processingTimeBusinessDays: parseFloat(e.target.value) 
                    })
                  }
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-6">
              <div>
                <Label className="text-sm mb-2">Refund Action Type</Label>
                <Select
                  value={processingConfig.actionRefundType}
                  onValueChange={(value: 'immediate' | 'scheduled') => 
                    setProcessingConfig({ ...processingConfig, actionRefundType: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="immediate">Immediate</SelectItem>
                    <SelectItem value="scheduled">Scheduled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-sm mb-2">Dispute Resolution Time (Days)</Label>
                <Input
                  type="number"
                  value={processingConfig.disputeResolutionTimeDays}
                  onChange={(e) => 
                    setProcessingConfig({ 
                      ...processingConfig, 
                      disputeResolutionTimeDays: parseFloat(e.target.value) 
                    })
                  }
                />
              </div>
            </div>

            <div>
              <Label className="text-sm mb-2">Refund Preference</Label>
              <Select
                value={processingConfig.refundPreference}
                onValueChange={(value: 'wallet' | 'original') => 
                  setProcessingConfig({ ...processingConfig, refundPreference: value })
                }
              >
                <SelectTrigger className="max-w-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="wallet">Warmpawz Wallet</SelectItem>
                  <SelectItem value="original">Original Payment Method</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}