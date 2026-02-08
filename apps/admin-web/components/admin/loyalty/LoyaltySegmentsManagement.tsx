'use client';

import React, { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  Button,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Badge,
  Switch,
  Textarea,
} from '@warmpawz/ui';
import { Plus, Edit2, Trash2, Users, Filter, Save, Link2 } from 'lucide-react';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api-client';

// ============================================================================
// TYPES
// ============================================================================

interface SegmentCriteria {
  service_categories?: string[];
  customer_tiers?: string[];
  purchase_history?: {
    min_purchases?: number;
    max_purchases?: number;
    min_amount?: number;
    max_amount?: number;
  };
  registration_date?: {
    before?: string;
    after?: string;
  };
  pet_count?: {
    min?: number;
    max?: number;
  };
  location?: {
    cities?: string[];
    states?: string[];
    pincodes?: string[];
  };
  vendor_ids?: string[];
  service_types?: string[];
  first_purchase?: boolean;
  birthday_month?: boolean;
  has_pet_profile?: boolean;
  has_health_records?: boolean;
  [key: string]: any;
}

interface LoyaltySegment {
  id: string;
  segment_name: string;
  segment_type: 'customer' | 'vendor' | 'both';
  description?: string;
  criteria: SegmentCriteria;
  match_type: 'all' | 'any';
  is_active: boolean;
  priority: number;
  created_at: string;
  updated_at: string;
}

interface SegmentFormData {
  segment_name: string;
  segment_type: 'customer' | 'vendor' | 'both';
  description: string;
  criteria: SegmentCriteria;
  match_type: 'all' | 'any';
  is_active: boolean;
  priority: number;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function LoyaltySegmentsManagement() {
  const [segments, setSegments] = useState<LoyaltySegment[]>([]);
  const [actionRules, setActionRules] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [editingSegment, setEditingSegment] = useState<LoyaltySegment | null>(null);
  const [formData, setFormData] = useState<SegmentFormData>({
    segment_name: '',
    segment_type: 'customer',
    description: '',
    criteria: {},
    match_type: 'all',
    is_active: true,
    priority: 100,
  });

  useEffect(() => {
    loadSegments();
    loadActionRules();
  }, []);

  const loadSegments = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get<{ success: boolean; segments: LoyaltySegment[] }>(
        '/admin/loyalty-segments'
      );
      if (response.success) {
        setSegments(response.segments || []);
      }
    } catch (error: any) {
      console.error('Error loading segments:', error);
      toast.error('Failed to load segments');
    } finally {
      setLoading(false);
    }
  };

  const loadActionRules = async () => {
    try {
      const response = await apiClient.get<{ success: boolean; rules: any[] }>(
        '/admin/loyalty-action-rules'
      );
      if (response.success) {
        setActionRules(response.rules || []);
      }
    } catch (error: any) {
      console.error('Error loading action rules:', error);
      // Don't show error toast - this is optional data
    }
  };

  const getRulesUsingSegment = (segmentId: string): string[] => {
    return actionRules
      .filter(rule => rule.conditions?.segment_ids?.includes(segmentId))
      .map(rule => rule.action_name);
  };

  const handleCreate = () => {
    setEditingSegment(null);
    setFormData({
      segment_name: '',
      segment_type: 'customer',
      description: '',
      criteria: {},
      match_type: 'all',
      is_active: true,
      priority: 100,
    });
    setShowDialog(true);
  };

  const handleEdit = (segment: LoyaltySegment) => {
    setEditingSegment(segment);
    setFormData({
      segment_name: segment.segment_name,
      segment_type: segment.segment_type,
      description: segment.description || '',
      criteria: segment.criteria || {},
      match_type: segment.match_type,
      is_active: segment.is_active,
      priority: segment.priority,
    });
    setShowDialog(true);
  };

  const handleDelete = async (segmentId: string) => {
    if (!confirm('Are you sure you want to delete this segment?')) {
      return;
    }

    try {
      await apiClient.delete(`/admin/loyalty-segments/${segmentId}`);
      toast.success('Segment deleted successfully');
      loadSegments();
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete segment');
    }
  };

  const handleSave = async () => {
    try {
      if (!formData.segment_name.trim()) {
        toast.error('Segment name is required');
        return;
      }

      if (editingSegment) {
        await apiClient.put(`/admin/loyalty-segments/${editingSegment.id}`, formData);
        toast.success('Segment updated successfully');
      } else {
        await apiClient.post('/admin/loyalty-segments', formData);
        toast.success('Segment created successfully');
      }

      setShowDialog(false);
      loadSegments();
    } catch (error: any) {
      toast.error(error.message || 'Failed to save segment');
    }
  };

  const updateCriteria = (key: string, value: any) => {
    setFormData((prev) => ({
      ...prev,
      criteria: {
        ...prev.criteria,
        [key]: value,
      },
    }));
  };

  const formatCriteria = (criteria: SegmentCriteria): string => {
    const parts: string[] = [];
    
    if (criteria.service_categories?.length) {
      parts.push(`Categories: ${criteria.service_categories.join(', ')}`);
    }
    if (criteria.customer_tiers?.length) {
      parts.push(`Tiers: ${criteria.customer_tiers.join(', ')}`);
    }
    if (criteria.purchase_history) {
      const ph = criteria.purchase_history;
      if (ph.min_purchases !== undefined) parts.push(`Min purchases: ${ph.min_purchases}`);
      if (ph.max_purchases !== undefined) parts.push(`Max purchases: ${ph.max_purchases}`);
      if (ph.min_amount !== undefined) parts.push(`Min amount: ₹${ph.min_amount}`);
      if (ph.max_amount !== undefined) parts.push(`Max amount: ₹${ph.max_amount}`);
    }
    if (criteria.registration_date) {
      const rd = criteria.registration_date;
      if (rd.after) parts.push(`Registered after: ${rd.after}`);
      if (rd.before) parts.push(`Registered before: ${rd.before}`);
    }
    if (criteria.pet_count) {
      const pc = criteria.pet_count;
      if (pc.min !== undefined || pc.max !== undefined) {
        parts.push(`Pets: ${pc.min || 0}-${pc.max || '∞'}`);
      }
    }
    if (criteria.location) {
      const loc = criteria.location;
      if (loc.cities?.length) parts.push(`Cities: ${loc.cities.join(', ')}`);
      if (loc.states?.length) parts.push(`States: ${loc.states.join(', ')}`);
      if (loc.pincodes?.length) parts.push(`Pincodes: ${loc.pincodes.join(', ')}`);
    }
    if (criteria.vendor_ids?.length) {
      parts.push(`Vendors: ${criteria.vendor_ids.length} selected`);
    }
    if (criteria.service_types?.length) {
      parts.push(`Service types: ${criteria.service_types.join(', ')}`);
    }
    if (criteria.first_purchase) parts.push('First purchase');
    if (criteria.birthday_month) parts.push('Birthday month');
    if (criteria.has_pet_profile) parts.push('Has pet profile');
    if (criteria.has_health_records) parts.push('Has health records');
    
    return parts.length > 0 ? parts.join(' | ') : 'No criteria';
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Loyalty Segments</h2>
          <p className="text-muted-foreground">
            Define customer and vendor segments for targeted loyalty rules
          </p>
        </div>
        <Button onClick={handleCreate}>
          <Plus className="mr-2 h-4 w-4" /> Create Segment
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Segments</CardTitle>
          <CardDescription>
            Segments are used in loyalty rules to target specific customer groups
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">Loading segments...</div>
          ) : segments.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No segments defined. Create your first segment to get started.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Criteria</TableHead>
                  <TableHead>Used By</TableHead>
                  <TableHead>Match Type</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {segments.map((segment) => {
                  const rulesUsing = getRulesUsingSegment(segment.id);
                  return (
                    <TableRow key={segment.id}>
                      <TableCell className="font-medium">
                        <div>
                          <p>{segment.segment_name}</p>
                          {segment.description && (
                            <p className="text-xs text-muted-foreground">{segment.description}</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{segment.segment_type}</Badge>
                      </TableCell>
                      <TableCell className="max-w-md">
                        <div className="text-sm truncate" title={formatCriteria(segment.criteria)}>
                          {formatCriteria(segment.criteria)}
                        </div>
                      </TableCell>
                      <TableCell>
                        {rulesUsing.length > 0 ? (
                          <div className="flex flex-col gap-1">
                            {rulesUsing.slice(0, 2).map((ruleName, idx) => (
                              <Badge key={idx} variant="outline" className="text-xs">
                                <Link2 className="w-3 h-3 mr-1" />
                                {ruleName}
                              </Badge>
                            ))}
                            {rulesUsing.length > 2 && (
                              <span className="text-xs text-muted-foreground">
                                +{rulesUsing.length - 2} more
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">Not used</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{segment.match_type.toUpperCase()}</Badge>
                      </TableCell>
                      <TableCell>{segment.priority}</TableCell>
                      <TableCell>
                        <Badge variant={segment.is_active ? 'default' : 'secondary'}>
                          {segment.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEdit(segment)}
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(segment.id)}
                            disabled={rulesUsing.length > 0}
                            title={rulesUsing.length > 0 ? `Cannot delete: used by ${rulesUsing.length} rule(s)` : 'Delete segment'}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingSegment ? 'Edit Segment' : 'Create Segment'}
            </DialogTitle>
            <DialogDescription>
              Define criteria for customer/vendor segmentation
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="segment_name">Segment Name *</Label>
              <Input
                id="segment_name"
                value={formData.segment_name}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setFormData((prev) => ({ ...prev, segment_name: e.target.value }))
                }
                placeholder="e.g., Medicine Buyers, Gold Tier Customers"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="segment_type">Segment Type</Label>
              <Select
                value={formData.segment_type}
                onValueChange={(value: 'customer' | 'vendor' | 'both') =>
                  setFormData((prev) => ({ ...prev, segment_type: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="customer">Customer</SelectItem>
                  <SelectItem value="vendor">Vendor</SelectItem>
                  <SelectItem value="both">Both</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                  setFormData((prev) => ({ ...prev, description: e.target.value }))
                }
                placeholder="Describe this segment..."
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="match_type">Match Type</Label>
              <Select
                value={formData.match_type}
                onValueChange={(value: 'all' | 'any') =>
                  setFormData((prev) => ({ ...prev, match_type: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All (AND) - All criteria must match</SelectItem>
                  <SelectItem value="any">Any (OR) - Any criterion must match</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="priority">Priority</Label>
              <Input
                id="priority"
                type="number"
                value={formData.priority}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setFormData((prev) => ({
                    ...prev,
                    priority: parseInt(e.target.value) || 100,
                  }))
                }
                placeholder="100"
              />
              <p className="text-xs text-muted-foreground">
                Higher priority segments are evaluated first
              </p>
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="is_active"
                checked={formData.is_active}
                onCheckedChange={(checked: boolean) =>
                  setFormData((prev) => ({ ...prev, is_active: checked }))
                }
              />
              <Label htmlFor="is_active">Active</Label>
            </div>

            {/* Criteria Section */}
            <div className="border-t pt-4 space-y-4">
              <h3 className="font-semibold">Criteria</h3>

              <div className="space-y-2">
                <Label>Service Categories (comma-separated)</Label>
                <Input
                  value={formData.criteria.service_categories?.join(', ') || ''}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    updateCriteria(
                      'service_categories',
                      e.target.value
                        .split(',')
                        .map((s) => s.trim())
                        .filter((s) => s.length > 0)
                    )
                  }
                  placeholder="Medicine, Grooming, Veterinary"
                />
              </div>

              <div className="space-y-2">
                <Label>Customer Tiers (comma-separated)</Label>
                <Input
                  value={formData.criteria.customer_tiers?.join(', ') || ''}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    updateCriteria(
                      'customer_tiers',
                      e.target.value
                        .split(',')
                        .map((s) => s.trim())
                        .filter((s) => s.length > 0)
                    )
                  }
                  placeholder="gold, platinum"
                />
              </div>

              {/* Purchase History - Complete */}
              <div className="space-y-2">
                <Label className="font-semibold">Purchase History</Label>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs">Min Purchases</Label>
                    <Input
                      type="number"
                      value={formData.criteria.purchase_history?.min_purchases || ''}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        updateCriteria('purchase_history', {
                          ...formData.criteria.purchase_history,
                          min_purchases: e.target.value ? parseInt(e.target.value) : undefined,
                        })
                      }
                      placeholder="5"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Max Purchases</Label>
                    <Input
                      type="number"
                      value={formData.criteria.purchase_history?.max_purchases || ''}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        updateCriteria('purchase_history', {
                          ...formData.criteria.purchase_history,
                          max_purchases: e.target.value ? parseInt(e.target.value) : undefined,
                        })
                      }
                      placeholder="100"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Min Amount (₹)</Label>
                    <Input
                      type="number"
                      value={formData.criteria.purchase_history?.min_amount || ''}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        updateCriteria('purchase_history', {
                          ...formData.criteria.purchase_history,
                          min_amount: e.target.value ? parseFloat(e.target.value) : undefined,
                        })
                      }
                      placeholder="10000"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Max Amount (₹)</Label>
                    <Input
                      type="number"
                      value={formData.criteria.purchase_history?.max_amount || ''}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        updateCriteria('purchase_history', {
                          ...formData.criteria.purchase_history,
                          max_amount: e.target.value ? parseFloat(e.target.value) : undefined,
                        })
                      }
                      placeholder="100000"
                    />
                  </div>
                </div>
              </div>

              {/* Registration Date */}
              <div className="space-y-2">
                <Label className="font-semibold">Registration Date</Label>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs">Registered After</Label>
                    <Input
                      type="date"
                      value={formData.criteria.registration_date?.after || ''}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        updateCriteria('registration_date', {
                          ...formData.criteria.registration_date,
                          after: e.target.value || undefined,
                        })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Registered Before</Label>
                    <Input
                      type="date"
                      value={formData.criteria.registration_date?.before || ''}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        updateCriteria('registration_date', {
                          ...formData.criteria.registration_date,
                          before: e.target.value || undefined,
                        })
                      }
                    />
                  </div>
                </div>
              </div>

              {/* Pet Count */}
              <div className="space-y-2">
                <Label className="font-semibold">Pet Count</Label>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs">Min Pets</Label>
                    <Input
                      type="number"
                      value={formData.criteria.pet_count?.min || ''}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        updateCriteria('pet_count', {
                          ...formData.criteria.pet_count,
                          min: e.target.value ? parseInt(e.target.value) : undefined,
                        })
                      }
                      placeholder="1"
                      min="0"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Max Pets</Label>
                    <Input
                      type="number"
                      value={formData.criteria.pet_count?.max || ''}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        updateCriteria('pet_count', {
                          ...formData.criteria.pet_count,
                          max: e.target.value ? parseInt(e.target.value) : undefined,
                        })
                      }
                      placeholder="5"
                      min="0"
                    />
                  </div>
                </div>
              </div>

              {/* Location */}
              <div className="space-y-2">
                <Label className="font-semibold">Location</Label>
                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label className="text-xs">Cities (comma-separated)</Label>
                    <Input
                      value={formData.criteria.location?.cities?.join(', ') || ''}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        updateCriteria('location', {
                          ...formData.criteria.location,
                          cities: e.target.value
                            .split(',')
                            .map((s) => s.trim())
                            .filter((s) => s.length > 0),
                        })
                      }
                      placeholder="Mumbai, Delhi, Bangalore"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">States (comma-separated)</Label>
                    <Input
                      value={formData.criteria.location?.states?.join(', ') || ''}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        updateCriteria('location', {
                          ...formData.criteria.location,
                          states: e.target.value
                            .split(',')
                            .map((s) => s.trim())
                            .filter((s) => s.length > 0),
                        })
                      }
                      placeholder="Maharashtra, Karnataka"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Pincodes (comma-separated)</Label>
                    <Input
                      value={formData.criteria.location?.pincodes?.join(', ') || ''}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        updateCriteria('location', {
                          ...formData.criteria.location,
                          pincodes: e.target.value
                            .split(',')
                            .map((s) => s.trim())
                            .filter((s) => s.length > 0),
                        })
                      }
                      placeholder="400001, 560001"
                    />
                  </div>
                </div>
              </div>

              {/* Vendor IDs */}
              <div className="space-y-2">
                <Label>Vendor IDs (comma-separated UUIDs)</Label>
                <Input
                  value={formData.criteria.vendor_ids?.join(', ') || ''}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    updateCriteria(
                      'vendor_ids',
                      e.target.value
                        .split(',')
                        .map((s) => s.trim())
                        .filter((s) => s.length > 0)
                    )
                  }
                  placeholder="vendor-uuid-1, vendor-uuid-2"
                />
                <p className="text-xs text-muted-foreground">
                  Customers who have purchased from these specific vendors
                </p>
              </div>

              {/* Service Types */}
              <div className="space-y-2">
                <Label>Service Types (comma-separated)</Label>
                <Input
                  value={formData.criteria.service_types?.join(', ') || ''}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    updateCriteria(
                      'service_types',
                      e.target.value
                        .split(',')
                        .map((s) => s.trim())
                        .filter((s) => s.length > 0)
                    )
                  }
                  placeholder="at_vendor, at_home, online"
                />
                <p className="text-xs text-muted-foreground">
                  Service delivery types: at_vendor, at_home, online, at_clinic, video_consultation
                </p>
              </div>

              {/* Special Flags */}
              <div className="space-y-2">
                <Label className="font-semibold">Special Conditions</Label>
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="first_purchase"
                      checked={formData.criteria.first_purchase || false}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateCriteria('first_purchase', e.target.checked || undefined)}
                      className="rounded"
                    />
                    <Label htmlFor="first_purchase" className="text-sm">First Purchase Only</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="birthday_month"
                      checked={formData.criteria.birthday_month || false}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateCriteria('birthday_month', e.target.checked || undefined)}
                      className="rounded"
                    />
                    <Label htmlFor="birthday_month" className="text-sm">Birthday Month</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="has_pet_profile"
                      checked={formData.criteria.has_pet_profile || false}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateCriteria('has_pet_profile', e.target.checked || undefined)}
                      className="rounded"
                    />
                    <Label htmlFor="has_pet_profile" className="text-sm">Has Pet Profile</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="has_health_records"
                      checked={formData.criteria.has_health_records || false}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateCriteria('has_health_records', e.target.checked || undefined)}
                      className="rounded"
                    />
                    <Label htmlFor="has_health_records" className="text-sm">Has Health Records</Label>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave}>
              <Save className="mr-2 h-4 w-4" />
              {editingSegment ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
