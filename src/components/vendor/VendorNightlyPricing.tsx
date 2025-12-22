/**
 * VENDOR NIGHTLY PRICING
 * 
 * Manages nightly pricing for boarding/resort with:
 * - Base nightly rates
 * - Seasonal pricing
 * - Pet size-based pricing
 * - Special offers and discounts
 * - Dynamic pricing rules
 */

import React, { useState, useEffect } from 'react';
import { 
  ArrowLeft, 
  Plus, 
  Edit, 
  Trash2, 
  Save, 
  X, 
  DollarSign,
  Calendar,
  TrendingUp,
  Settings,
  AlertCircle
} from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { projectId, publicAnonKey } from '../../utils/supabase/info';
import { toast } from 'sonner';
import { authenticatedFetch } from '../../utils/session-manager';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../ui/dialog';

interface VendorNightlyPricingProps {
  vendorId: string;
  vendorData: any;
  onBack: () => void;
}

interface PricingRule {
  id: string;
  roomId: string;
  roomName: string;
  baseNightPrice: number;
  seasonalPricing: SeasonalPrice[];
  sizeBasedPricing: {
    small: number;
    medium: number;
    large: number;
    extraLarge: number;
  };
  specialOffers: SpecialOffer[];
  isActive: boolean;
}

interface SeasonalPrice {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  multiplier: number; // e.g., 1.5 for 50% increase
  description?: string;
}

interface SpecialOffer {
  id: string;
  name: string;
  discountPercentage: number;
  minNights: number;
  startDate: string;
  endDate: string;
  isActive: boolean;
}

const PET_SIZES = ['small', 'medium', 'large', 'extraLarge'];

export function VendorNightlyPricing({ 
  vendorId, 
  vendorData, 
  onBack 
}: VendorNightlyPricingProps) {
  const [rooms, setRooms] = useState<any[]>([]);
  const [pricingRules, setPricingRules] = useState<PricingRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingRule, setEditingRule] = useState<PricingRule | null>(null);
  const [selectedRoom, setSelectedRoom] = useState<string>('');

  // Form state
  const [formData, setFormData] = useState({
    roomId: '',
    baseNightPrice: '',
    sizeBasedPricing: {
      small: '',
      medium: '',
      large: '',
      extraLarge: ''
    },
    seasonalPricing: [] as SeasonalPrice[],
    specialOffers: [] as SpecialOffer[],
    isActive: true
  });

  useEffect(() => {
    fetchData();
  }, [vendorId]);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      // Fetch rooms
      const roomsResponse = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/vendor/${vendorId}/boarding/rooms`,
        {
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (roomsResponse.ok) {
        const data = await roomsResponse.json();
        setRooms(data.rooms || data.data?.rooms || []);
      }

      // Fetch pricing rules
      const pricingResponse = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/vendor/${vendorId}/boarding/pricing`,
        {
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (pricingResponse.ok) {
        const data = await pricingResponse.json();
        setPricingRules(data.pricingRules || data.data?.pricingRules || []);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Failed to load pricing data');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.roomId || !formData.baseNightPrice) {
      toast.error('Room and base price are required');
      return;
    }

    try {
      const pricingData = {
        vendorId,
        roomId: formData.roomId,
        baseNightPrice: parseFloat(formData.baseNightPrice),
        sizeBasedPricing: {
          small: parseFloat(formData.sizeBasedPricing.small) || parseFloat(formData.baseNightPrice),
          medium: parseFloat(formData.sizeBasedPricing.medium) || parseFloat(formData.baseNightPrice),
          large: parseFloat(formData.sizeBasedPricing.large) || parseFloat(formData.baseNightPrice),
          extraLarge: parseFloat(formData.sizeBasedPricing.extraLarge) || parseFloat(formData.baseNightPrice)
        },
        seasonalPricing: formData.seasonalPricing,
        specialOffers: formData.specialOffers,
        isActive: formData.isActive
      };

      const url = editingRule
        ? `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/vendor/${vendorId}/boarding/pricing/${editingRule.id}`
        : `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/vendor/${vendorId}/boarding/pricing`;

      const response = await authenticatedFetch(url, {
        method: editingRule ? 'PUT' : 'POST',
        body: JSON.stringify(pricingData)
      });

      if (response.ok) {
        toast.success(editingRule ? 'Pricing updated successfully' : 'Pricing added successfully');
        setShowAddModal(false);
        setEditingRule(null);
        resetForm();
        fetchData();
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to save pricing');
      }
    } catch (error: any) {
      console.error('Error saving pricing:', error);
      toast.error(error.message || 'Failed to save pricing');
    }
  };

  const handleDelete = async (ruleId: string) => {
    if (!confirm('Are you sure you want to delete this pricing rule?')) return;

    try {
      const response = await authenticatedFetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/vendor/${vendorId}/boarding/pricing/${ruleId}`,
        {
          method: 'DELETE'
        }
      );

      if (response.ok) {
        toast.success('Pricing rule deleted successfully');
        fetchData();
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to delete pricing rule');
      }
    } catch (error: any) {
      console.error('Error deleting rule:', error);
      toast.error('Failed to delete pricing rule');
    }
  };

  const calculatePrice = (rule: PricingRule, petSize: string, date: Date): number => {
    let price = rule.sizeBasedPricing[petSize as keyof typeof rule.sizeBasedPricing] || rule.baseNightPrice;
    
    // Apply seasonal pricing
    const seasonal = rule.seasonalPricing.find(sp => {
      const start = new Date(sp.startDate);
      const end = new Date(sp.endDate);
      return date >= start && date <= end;
    });
    
    if (seasonal) {
      price = price * seasonal.multiplier;
    }
    
    return Math.round(price);
  };

  const resetForm = () => {
    setFormData({
      roomId: '',
      baseNightPrice: '',
      sizeBasedPricing: {
        small: '',
        medium: '',
        large: '',
        extraLarge: ''
      },
      seasonalPricing: [],
      specialOffers: [],
      isActive: true
    });
    setSelectedRoom('');
  };

  const handleEdit = (rule: PricingRule) => {
    setEditingRule(rule);
    setFormData({
      roomId: rule.roomId,
      baseNightPrice: rule.baseNightPrice.toString(),
      sizeBasedPricing: {
        small: rule.sizeBasedPricing.small.toString(),
        medium: rule.sizeBasedPricing.medium.toString(),
        large: rule.sizeBasedPricing.large.toString(),
        extraLarge: rule.sizeBasedPricing.extraLarge.toString()
      },
      seasonalPricing: rule.seasonalPricing,
      specialOffers: rule.specialOffers,
      isActive: rule.isActive
    });
    setSelectedRoom(rule.roomId);
    setShowAddModal(true);
  };

  const addSeasonalPricing = () => {
    setFormData({
      ...formData,
      seasonalPricing: [
        ...formData.seasonalPricing,
        {
          id: `seasonal_${Date.now()}`,
          name: '',
          startDate: '',
          endDate: '',
          multiplier: 1,
          description: ''
        }
      ]
    });
  };

  const removeSeasonalPricing = (id: string) => {
    setFormData({
      ...formData,
      seasonalPricing: formData.seasonalPricing.filter(sp => sp.id !== id)
    });
  };

  const updateSeasonalPricing = (id: string, field: string, value: any) => {
    setFormData({
      ...formData,
      seasonalPricing: formData.seasonalPricing.map(sp =>
        sp.id === id ? { ...sp, [field]: value } : sp
      )
    });
  };

  if (loading && pricingRules.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading pricing...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200 p-4 sticky top-0 z-10">
        <div className="flex items-center gap-3 mb-4">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-lg font-semibold">Nightly Pricing</h1>
            <p className="text-xs text-gray-500">{pricingRules.length} pricing rule(s)</p>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="text-lg font-semibold">Pricing Rules</h2>
          <Button
            onClick={() => {
              resetForm();
              setEditingRule(null);
              setShowAddModal(true);
            }}
            className="bg-orange-500 hover:bg-orange-600"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Pricing Rule
          </Button>
        </div>

        {pricingRules.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
            <DollarSign className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 mb-2">No pricing rules configured yet</p>
            <Button
              onClick={() => {
                resetForm();
                setShowAddModal(true);
              }}
              variant="outline"
            >
              Add First Pricing Rule
            </Button>
          </div>
        ) : (
          <div className="grid gap-4">
            {pricingRules.map(rule => {
              const room = rooms.find(r => r.id === rule.roomId);
              
              return (
                <div key={rule.id} className="bg-white rounded-lg border border-gray-200 p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="font-semibold text-gray-900">{room?.name || 'Unknown Room'}</h3>
                        {rule.isActive ? (
                          <Badge className="bg-green-100 text-green-700 border-green-200">Active</Badge>
                        ) : (
                          <Badge className="bg-gray-100 text-gray-700 border-gray-200">Inactive</Badge>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-4 mt-3">
                        <div>
                          <p className="text-xs text-gray-500">Base Night Price</p>
                          <p className="font-semibold text-lg">₹{rule.baseNightPrice}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Size-based Pricing</p>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {PET_SIZES.map(size => (
                              <Badge key={size} variant="outline" className="text-xs">
                                {size}: ₹{rule.sizeBasedPricing[size as keyof typeof rule.sizeBasedPricing]}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      </div>

                      {rule.seasonalPricing.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-gray-200">
                          <p className="text-xs text-gray-500 mb-2">Seasonal Pricing:</p>
                          <div className="space-y-1">
                            {rule.seasonalPricing.map(seasonal => (
                              <div key={seasonal.id} className="text-xs text-gray-600">
                                {seasonal.name}: {seasonal.multiplier}x ({new Date(seasonal.startDate).toLocaleDateString()} - {new Date(seasonal.endDate).toLocaleDateString()})
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {rule.specialOffers.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-gray-200">
                          <p className="text-xs text-gray-500 mb-2">Special Offers:</p>
                          <div className="space-y-1">
                            {rule.specialOffers.filter(offer => offer.isActive).map(offer => (
                              <Badge key={offer.id} variant="outline" className="text-xs bg-orange-50 text-orange-700">
                                {offer.name}: {offer.discountPercentage}% off (min {offer.minNights} nights)
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEdit(rule)}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(rule.id)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Add/Edit Pricing Modal */}
      {showAddModal && (
        <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingRule ? 'Edit Pricing Rule' : 'Add Pricing Rule'}</DialogTitle>
              <DialogDescription>
                Configure nightly pricing for rooms. You can set base prices, size-based pricing, seasonal rates, and special offers.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Room *</label>
                <select
                  value={formData.roomId}
                  onChange={(e) => {
                    setFormData({ ...formData, roomId: e.target.value });
                    setSelectedRoom(e.target.value);
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  required
                >
                  <option value="">Select a room</option>
                  {rooms.map(room => (
                    <option key={room.id} value={room.id}>{room.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Base Night Price (₹) *</label>
                <Input
                  type="number"
                  value={formData.baseNightPrice}
                  onChange={(e) => setFormData({ ...formData, baseNightPrice: e.target.value })}
                  required
                  min="0"
                  step="0.01"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Size-based Pricing (₹)</label>
                <p className="text-xs text-gray-500 mb-2">Leave empty to use base price</p>
                <div className="grid grid-cols-2 gap-3">
                  {PET_SIZES.map(size => (
                    <div key={size}>
                      <label className="block text-xs text-gray-500 mb-1 capitalize">{size}</label>
                      <Input
                        type="number"
                        value={formData.sizeBasedPricing[size as keyof typeof formData.sizeBasedPricing]}
                        onChange={(e) => setFormData({
                          ...formData,
                          sizeBasedPricing: {
                            ...formData.sizeBasedPricing,
                            [size]: e.target.value
                          }
                        })}
                        min="0"
                        step="0.01"
                        placeholder={formData.baseNightPrice || 'Base price'}
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Seasonal Pricing */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium">Seasonal Pricing</label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addSeasonalPricing}
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    Add Season
                  </Button>
                </div>
                
                {formData.seasonalPricing.map(seasonal => (
                  <div key={seasonal.id} className="border border-gray-200 rounded-lg p-3 mb-2">
                    <div className="flex items-start justify-between mb-2">
                      <Input
                        placeholder="Season name (e.g., Peak Season)"
                        value={seasonal.name}
                        onChange={(e) => updateSeasonalPricing(seasonal.id, 'name', e.target.value)}
                        className="flex-1 mr-2"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeSeasonalPricing(seasonal.id)}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Start Date</label>
                        <Input
                          type="date"
                          value={seasonal.startDate}
                          onChange={(e) => updateSeasonalPricing(seasonal.id, 'startDate', e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">End Date</label>
                        <Input
                          type="date"
                          value={seasonal.endDate}
                          onChange={(e) => updateSeasonalPricing(seasonal.id, 'endDate', e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Multiplier</label>
                        <Input
                          type="number"
                          value={seasonal.multiplier}
                          onChange={(e) => updateSeasonalPricing(seasonal.id, 'multiplier', parseFloat(e.target.value) || 1)}
                          min="0.5"
                          max="5"
                          step="0.1"
                          placeholder="1.5"
                        />
                        <p className="text-xs text-gray-400 mt-1">1.5 = 50% increase</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="isActive"
                  checked={formData.isActive}
                  onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                  className="w-4 h-4"
                />
                <label htmlFor="isActive" className="text-sm">Active (pricing rule is applied)</label>
              </div>

              <div className="flex gap-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowAddModal(false);
                    setEditingRule(null);
                    resetForm();
                  }}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button type="submit" className="flex-1 bg-orange-500 hover:bg-orange-600">
                  <Save className="w-4 h-4 mr-2" />
                  {editingRule ? 'Update' : 'Add'} Pricing Rule
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

