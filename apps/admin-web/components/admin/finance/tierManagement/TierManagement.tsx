'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
  Textarea,
  Switch,
  Label,
  Input,
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardDescription,
} from '@warmpawz/ui';
import { Plus, Edit2, Trash2, Layers, RefreshCw } from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { toast } from 'sonner';

interface Tier {
  id: string;
  name: string;
  displayName: string;
  description: string;
  commissionRate: number;
  payoutPeriodDays: number;
  monthlyCost: number;
  yearlyCost: number;
  sixMonthCost?: number;
  sixMonthDiscountPercentage?: number;
  twelveMonthCost?: number;
  twelveMonthDiscountPercentage?: number;
  allowSplitPayment?: boolean;
  splitPaymentInstallments?: number;
  splitPaymentIntervalDays?: number;
  features: string[];
  roles: string[];
  isDefault: boolean;
  isActive: boolean;
}

const AVAILABLE_ROLES = [
  { id: 'veterinarian', label: 'Veterinarian' },
  { id: 'groomer', label: 'Pet Groomer' },
  { id: 'trainer', label: 'Pet Trainer' },
  { id: 'boarding', label: 'Boarding Facility' },
  { id: 'walker', label: 'Pet Walker' },
  { id: 'shop', label: 'Pet Shop' },
];

export function TierManagement() {
  const [tiers, setTiers] = useState<Tier[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentTier, setCurrentTier] = useState<Tier | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadTiers();
  }, []);

  const loadTiers = async () => {
    setLoading(true);
    try {
      const data = await apiClient.get<any>('/admin/payments/tiers');
      const raw = (data as any)?.data?.tiers ?? (data as any)?.tiers;
      setTiers(Array.isArray(raw) ? raw : []);
    } catch (error) {
      console.error('Error loading tiers:', error);
      toast.error('Failed to load payment tiers');
      setTiers([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSeedDefaults = async () => {
    setLoading(true);
    try {
      const data = await apiClient.post<any>('/admin/payments/tiers/seed-defaults');
      const raw = (data as any)?.data?.tiers ?? (data as any)?.tiers;
      setTiers(Array.isArray(raw) ? raw : []);
      toast.success('Default tiers seeded successfully');
    } catch (error) {
      toast.error('Error seeding tiers');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveTier = async () => {
    if (!currentTier) return;

    setSaving(true);
    try {
      if (currentTier.id) {
        const data = await apiClient.put<any>(`/admin/payments/tiers/${currentTier.id}`, currentTier);
        const updatedTier = (data as any)?.data?.tier ?? (data as any)?.tier;
    setTiers((tiers ?? []).map((t) => (t.id === currentTier.id && updatedTier ? { ...t, ...updatedTier } : t)));
        toast.success('Tier updated successfully');
      } else {
        const data = await apiClient.post<any>('/admin/payments/tiers', currentTier);
        const newTier = (data as any)?.data?.tier ?? (data as any)?.tier;
        setTiers(newTier ? [...(tiers ?? []), newTier] : (tiers ?? []));
        toast.success('Tier created successfully');
      }
      setIsModalOpen(false);
      setCurrentTier(null);
    } catch (error) {
      toast.error('Failed to save tier');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteTier = async (id: string) => {
    if (!confirm('Are you sure you want to delete this tier?')) return;

    try {
      await apiClient.delete(`/admin/payments/tiers/${id}`);
      setTiers(tiers.filter((t) => t.id !== id));
      toast.success('Tier deleted successfully');
    } catch (error) {
      toast.error('Failed to delete tier');
    }
  };

  const openModal = (tier?: Tier) => {
    if (tier) {
      setCurrentTier({ ...tier });
    } else {
      setCurrentTier({
        id: '',
        name: '',
        displayName: '',
        description: '',
        commissionRate: 15,
        payoutPeriodDays: 7,
        monthlyCost: 0,
        yearlyCost: 0,
        sixMonthCost: undefined,
        sixMonthDiscountPercentage: 0,
        twelveMonthCost: undefined,
        twelveMonthDiscountPercentage: 0,
        allowSplitPayment: false,
        splitPaymentInstallments: 3,
        splitPaymentIntervalDays: 30,
        features: [],
        roles: [],
        isDefault: false,
        isActive: true,
      });
    }
    setIsModalOpen(true);
  };

  const toggleRole = (roleId: string) => {
    if (!currentTier) return;
    const newRoles = currentTier.roles.includes(roleId)
      ? currentTier.roles.filter((r) => r !== roleId)
      : [...currentTier.roles, roleId];
    setCurrentTier({ ...currentTier, roles: newRoles });
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Tier Configuration</h2>
          <p className="text-sm text-slate-500">Manage vendor commission tiers and payout rules</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleSeedDefaults} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Seed Defaults
          </Button>
          <Button onClick={() => openModal()} className="bg-[#FF8C42] hover:bg-[#FF7A2E]">
            <Plus className="w-4 h-4 mr-2" />
            Create New Tier
          </Button>
        </div>
      </div>

      {loading && tiers.length === 0 ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FF8C42]"></div>
        </div>
      ) : tiers.length === 0 ? (
        <div className="text-center py-12 border-2 border-dashed border-slate-200 rounded-lg bg-slate-50">
          <Layers className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-lg font-medium text-slate-900">No Tiers Configured</h3>
          <p className="text-slate-500 mb-4">Create a new tier or seed defaults to get started.</p>
          <Button onClick={handleSeedDefaults} variant="outline">
            Seed Default Tiers
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-full">
          {(tiers ?? []).map((tier) => (
            <Card
              key={tier.id}
              className={`relative overflow-hidden border-2 transition-all w-full max-w-full ${
                tier.isDefault
                  ? 'border-blue-200 bg-blue-50/30'
                  : 'border-slate-200 hover:border-orange-200'
              }`}
            >
              {tier.isDefault && (
                <div className="absolute top-0 right-0 bg-blue-500 text-white text-xs px-3 py-1 rounded-bl-lg font-medium">
                  Default
                </div>
              )}
              <CardHeader className="pb-2">
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-lg font-bold text-slate-900">
                      {tier.displayName}
                    </CardTitle>
                    <div className="text-sm font-medium text-slate-500 mt-1">{tier.name}</div>
                  </div>
                  <div
                    className={`p-2 rounded-lg ${
                      tier.isActive ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    <Layers className="w-5 h-5" />
                  </div>
                </div>
                <CardDescription className="mt-2 line-clamp-2 h-10">
                  {tier.description}
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-6">
                <div className="grid grid-cols-2 gap-4 py-4 border-t border-b border-slate-100">
                  <div>
                    <div className="text-xs text-slate-500 uppercase tracking-wide font-semibold">
                      Commission
                    </div>
                    <div className="text-2xl font-bold text-slate-900">
                      {tier.commissionRate}%
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500 uppercase tracking-wide font-semibold">
                      Payout
                    </div>
                    <div className="text-2xl font-bold text-slate-900">
                      T+{tier.payoutPeriodDays}
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-600">Monthly Cost</span>
                    <span className="font-semibold">
                      {tier.monthlyCost === 0 ? 'Free' : `₹${tier.monthlyCost}`}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-600">Applicable Roles</span>
                    <span className="font-medium text-slate-900">
                      {tier.roles.length === 0 ? 'All Roles' : `${tier.roles.length} Roles`}
                    </span>
                  </div>
                </div>

                <div className="flex gap-2 pt-2">
                  <Button variant="outline" className="flex-1" onClick={() => openModal(tier)}>
                    <Edit2 className="w-4 h-4 mr-2" /> Edit
                  </Button>
                  {!tier.isDefault && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-red-500 hover:bg-red-50"
                      onClick={() => handleDeleteTier(tier.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Tier Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="w-full max-w-lg md:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{currentTier?.id ? 'Edit Tier' : 'Create New Tier'}</DialogTitle>
            <DialogDescription>
              Configure commission rates, payouts costs and features.
            </DialogDescription>
          </DialogHeader>

          {currentTier && (
            <div className="grid grid-cols-2 gap-6 py-4">
              <div className="space-y-4 col-span-2 md:col-span-1">
                <div className="space-y-2">
                  <Label>Display Name</Label>
                  <Input
                    value={currentTier.displayName}
                    onChange={(e) =>
                      setCurrentTier({
                        ...currentTier,
                        displayName: e.target.value,
                      })
                    }
                    placeholder="e.g. Professional Tier"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Internal Name</Label>
                  <Input
                    value={currentTier.name}
                    onChange={(e) => setCurrentTier({ ...currentTier, name: e.target.value })}
                    placeholder="e.g. Tier 2"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Textarea
                    value={currentTier.description}
                    onChange={(e) =>
                      setCurrentTier({
                        ...currentTier,
                        description: e.target.value,
                      })
                    }
                    placeholder="Tier details..."
                    className="resize-none h-20"
                  />
                </div>
                <div className="space-y-4 pt-2">
                  <div className="flex items-center justify-between border p-3 rounded-lg">
                    <Label className="cursor-pointer" htmlFor="active-mode">
                      Active Status
                    </Label>
                    <Switch
                      id="active-mode"
                      checked={currentTier.isActive}
                      onCheckedChange={(c) => setCurrentTier({ ...currentTier, isActive: c })}
                    />
                  </div>
                  <div className="flex items-center justify-between border p-3 rounded-lg">
                    <div className="space-y-0.5">
                      <Label className="cursor-pointer" htmlFor="default-mode">
                        Set as Default
                      </Label>
                      <p className="text-xs text-muted-foreground">Apply to new vendors</p>
                    </div>
                    <Switch
                      id="default-mode"
                      checked={currentTier.isDefault}
                      onCheckedChange={(c) => setCurrentTier({ ...currentTier, isDefault: c })}
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-4 col-span-2 md:col-span-1">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Commission (%)</Label>
                    <Input
                      type="number"
                      value={currentTier.commissionRate}
                      onChange={(e) =>
                        setCurrentTier({
                          ...currentTier,
                          commissionRate: parseFloat(e.target.value),
                        })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Payout Period (days)</Label>
                    <Input
                      type="number"
                      value={currentTier.payoutPeriodDays}
                      onChange={(e) =>
                        setCurrentTier({
                          ...currentTier,
                          payoutPeriodDays: parseInt(e.target.value),
                        })
                      }
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Monthly Cost (₹)</Label>
                    <Input
                      type="number"
                      value={currentTier.monthlyCost}
                      onChange={(e) =>
                        setCurrentTier({
                          ...currentTier,
                          monthlyCost: parseFloat(e.target.value),
                        })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Yearly Cost (₹)</Label>
                    <Input
                      type="number"
                      value={currentTier.yearlyCost}
                      onChange={(e) =>
                        setCurrentTier({
                          ...currentTier,
                          yearlyCost: parseFloat(e.target.value),
                        })
                      }
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Applicable Roles</Label>
                  <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto border p-2 rounded-lg">
                    {AVAILABLE_ROLES.map((role) => (
                      <div key={role.id} className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={currentTier.roles.includes(role.id)}
                          onChange={() => toggleRole(role.id)}
                          className="w-4 h-4"
                        />
                        <Label className="text-sm">{role.label}</Label>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSaveTier}
              disabled={saving}
              className="bg-[#FF8C42] hover:bg-[#FF7A2E]"
            >
              {saving ? 'Saving...' : 'Save Tier'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
