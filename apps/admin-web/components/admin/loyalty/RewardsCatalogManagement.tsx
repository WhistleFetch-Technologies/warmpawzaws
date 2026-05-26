'use client';

import React, { useEffect, useState } from 'react';
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
  Badge,
  Switch,
  Textarea,
} from '@warmpawz/ui';
import { Gift, Link2, Plus, Edit2, Trash2, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api-client';

interface CatalogReward {
  id: string;
  name: string;
  description?: string | null;
  points_cost: number;
  type: string;
  display_order?: number;
  is_active: boolean;
  links_available?: number;
  links_assigned?: number;
}

interface PoolLink {
  id: string;
  link_url: string;
  status: 'available' | 'assigned';
  assigned_at?: string | null;
  created_at?: string;
}

interface CatalogFormData {
  name: string;
  description: string;
  points_cost: number;
  display_order: number;
  is_active: boolean;
}

const emptyForm: CatalogFormData = {
  name: '',
  description: '',
  points_cost: 5000,
  display_order: 0,
  is_active: true,
};

export function RewardsCatalogManagement() {
  const [rewards, setRewards] = useState<CatalogReward[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showDialog, setShowDialog] = useState(false);
  const [editing, setEditing] = useState<CatalogReward | null>(null);
  const [form, setForm] = useState<CatalogFormData>(emptyForm);

  const [poolReward, setPoolReward] = useState<CatalogReward | null>(null);
  const [poolLinks, setPoolLinks] = useState<PoolLink[]>([]);
  const [poolSummary, setPoolSummary] = useState({ available: 0, assigned: 0, total: 0 });
  const [poolLoading, setPoolLoading] = useState(false);
  const [linksText, setLinksText] = useState('');
  const [uploadingLinks, setUploadingLinks] = useState(false);

  const loadRewards = async () => {
    try {
      setLoading(true);
      const res = await apiClient.get<any>('/admin/rewards-catalog');
      setRewards(res.rewards || []);
    } catch (error) {
      console.error('Error loading rewards catalog:', error);
      toast.error('Failed to load rewards catalog');
    } finally {
      setLoading(false);
    }
  };

  const loadLinkPool = async (rewardId: string) => {
    try {
      setPoolLoading(true);
      const res = await apiClient.get<any>(`/admin/rewards-catalog/${rewardId}/link-pool`);
      setPoolSummary(res.summary || { available: 0, assigned: 0, total: 0 });
      setPoolLinks(res.links || []);
    } catch (error) {
      console.error('Error loading link pool:', error);
      toast.error('Failed to load coupon links');
    } finally {
      setPoolLoading(false);
    }
  };

  useEffect(() => {
    loadRewards();
  }, []);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setShowDialog(true);
  };

  const openEdit = (reward: CatalogReward) => {
    setEditing(reward);
    setForm({
      name: reward.name,
      description: reward.description || '',
      points_cost: reward.points_cost,
      display_order: reward.display_order ?? 0,
      is_active: reward.is_active,
    });
    setShowDialog(true);
  };

  const openLinkPool = async (reward: CatalogReward) => {
    setPoolReward(reward);
    setLinksText('');
    await loadLinkPool(reward.id);
  };

  const handleSave = async () => {
    const name = form.name.trim();
    if (!name) {
      toast.error('Reward name is required');
      return;
    }
    if (!form.points_cost || form.points_cost < 1) {
      toast.error('Points cost must be at least 1');
      return;
    }

    const payload = {
      name,
      description: form.description.trim() || null,
      points_cost: form.points_cost,
      type: 'external_link',
      cash_value: 0,
      display_order: form.display_order,
      is_active: form.is_active,
    };

    try {
      setSaving(true);
      if (editing) {
        await apiClient.put(`/admin/rewards-catalog/${editing.id}`, payload);
        toast.success('Reward updated');
      } else {
        const res = await apiClient.post<any>('/admin/rewards-catalog', payload);
        toast.success('Reward created — add unique coupon links next');
        setShowDialog(false);
        await loadRewards();
        const created = res.reward as CatalogReward | undefined;
        if (created?.id) {
          await openLinkPool(created);
        }
        return;
      }
      setShowDialog(false);
      await loadRewards();
    } catch (error: any) {
      console.error('Error saving catalog reward:', error);
      toast.error(error?.message || 'Failed to save reward');
    } finally {
      setSaving(false);
    }
  };

  const handleUploadLinks = async () => {
    if (!poolReward) return;
    const lines = linksText
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    if (!lines.length) {
      toast.error('Paste at least one URL (one per line)');
      return;
    }

    try {
      setUploadingLinks(true);
      const res = await apiClient.post<any>(
        `/admin/rewards-catalog/${poolReward.id}/link-pool`,
        { linksText: linksText }
      );
      toast.success(res.message || `Added ${res.added} link(s)`);
      setLinksText('');
      await loadLinkPool(poolReward.id);
      await loadRewards();
    } catch (error: any) {
      console.error('Error uploading links:', error);
      toast.error(error?.message || 'Failed to add links');
    } finally {
      setUploadingLinks(false);
    }
  };

  const handleRemoveLink = async (linkId: string) => {
    if (!poolReward) return;
    try {
      await apiClient.delete(`/admin/rewards-catalog/${poolReward.id}/link-pool/${linkId}`);
      toast.success('Link removed');
      await loadLinkPool(poolReward.id);
      await loadRewards();
    } catch (error: any) {
      toast.error(error?.message || 'Could not remove link');
    }
  };

  const handleDeactivate = async (reward: CatalogReward) => {
    if (!confirm(`Deactivate "${reward.name}"? Customers will no longer see it.`)) return;
    try {
      await apiClient.delete(`/admin/rewards-catalog/${reward.id}`);
      toast.success('Reward deactivated');
      await loadRewards();
    } catch (error: any) {
      toast.error(error?.message || 'Failed to deactivate reward');
    }
  };

  const availableLinks = poolLinks.filter((l) => l.status === 'available');

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Gift className="w-5 h-5 text-orange-600" />
              Redeemable Rewards Catalog
            </CardTitle>
            <CardDescription className="mt-1">
              Create a reward (e.g. Amazon voucher at 5000 points), then upload unique coupon URLs —
              one link is assigned per customer when they redeem.
            </CardDescription>
          </div>
          <Button onClick={openCreate} className="bg-orange-600 hover:bg-orange-700 shrink-0">
            <Plus className="w-4 h-4 mr-2" />
            Add Reward
          </Button>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="py-12 text-center text-muted-foreground">Loading catalog…</div>
          ) : rewards.length === 0 ? (
            <div className="py-12 text-center">
              <Gift className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-600 font-medium">No catalog rewards yet</p>
              <Button onClick={openCreate} variant="default" className="mt-4">
                Create first reward
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Status</TableHead>
                  <TableHead>Reward</TableHead>
                  <TableHead>Points</TableHead>
                  <TableHead>Link pool</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rewards.map((reward) => (
                  <TableRow key={reward.id}>
                    <TableCell>
                      <Badge variant={reward.is_active ? 'default' : 'secondary'}>
                        {reward.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{reward.name}</div>
                      {reward.description && (
                        <div className="text-xs text-muted-foreground mt-0.5">{reward.description}</div>
                      )}
                    </TableCell>
                    <TableCell>{reward.points_cost.toLocaleString()}</TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <span className="text-green-700 font-medium">
                          {(reward.links_available ?? 0).toLocaleString()} available
                        </span>
                        <span className="text-muted-foreground mx-1">·</span>
                        <span className="text-muted-foreground">
                          {(reward.links_assigned ?? 0).toLocaleString()} redeemed
                        </span>
                      </div>
                      {reward.is_active && (reward.links_available ?? 0) === 0 && (
                        <p className="text-xs text-amber-600 mt-1">Out of stock — add links</p>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="outline" size="sm" onClick={() => openLinkPool(reward)}>
                          <Upload className="w-4 h-4 mr-1" />
                          Links
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => openEdit(reward)}>
                          <Edit2 className="w-4 h-4" />
                        </Button>
                        {reward.is_active && (
                          <Button variant="destructive" size="sm" onClick={() => handleDeactivate(reward)}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit catalog reward' : 'Add catalog reward'}</DialogTitle>
            <DialogDescription>
              Set name and points cost. You will upload unique coupon URLs separately.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="catalog-name">Reward name *</Label>
              <Input
                id="catalog-name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Amazon Gift Voucher"
              />
            </div>

            <div>
              <Label htmlFor="catalog-description">Description</Label>
              <Textarea
                id="catalog-description"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Redeem 5000 Pawints for a unique Amazon coupon link"
                rows={2}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="catalog-points">Points cost *</Label>
                <Input
                  id="catalog-points"
                  type="number"
                  min={1}
                  value={form.points_cost}
                  onChange={(e) =>
                    setForm({ ...form, points_cost: parseInt(e.target.value, 10) || 0 })
                  }
                />
              </div>
              <div>
                <Label htmlFor="catalog-order">Display order</Label>
                <Input
                  id="catalog-order"
                  type="number"
                  value={form.display_order}
                  onChange={(e) =>
                    setForm({ ...form, display_order: parseInt(e.target.value, 10) || 0 })
                  }
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Switch
                checked={form.is_active}
                onCheckedChange={(checked) => setForm({ ...form, is_active: checked })}
              />
              <Label>Active — visible when links are in stock</Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving} className="bg-orange-600 hover:bg-orange-700">
              {saving ? 'Saving…' : editing ? 'Update reward' : 'Create reward'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(poolReward)} onOpenChange={(open) => !open && setPoolReward(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Link2 className="w-5 h-5" />
              Coupon links — {poolReward?.name}
            </DialogTitle>
            <DialogDescription>
              Paste one unique URL per line. Each customer gets exactly one unused link when they redeem.
            </DialogDescription>
          </DialogHeader>

          {poolReward && (
            <div className="space-y-4">
              <div className="flex gap-4 text-sm">
                <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
                  {poolSummary.available} available
                </Badge>
                <Badge variant="secondary">{poolSummary.assigned} assigned to customers</Badge>
                <Badge variant="outline">{poolSummary.total} total</Badge>
              </div>

              <div>
                <Label htmlFor="bulk-links">Add unique links (one per line)</Label>
                <Textarea
                  id="bulk-links"
                  value={linksText}
                  onChange={(e) => setLinksText(e.target.value)}
                  placeholder={'https://www.amazon.in/gp/voucher/...\nhttps://www.amazon.in/gp/voucher/...'}
                  rows={6}
                  className="font-mono text-xs mt-1"
                />
                <Button
                  onClick={handleUploadLinks}
                  disabled={uploadingLinks || !linksText.trim()}
                  className="mt-2 bg-orange-600 hover:bg-orange-700"
                >
                  {uploadingLinks ? 'Uploading…' : 'Upload links'}
                </Button>
              </div>

              {poolLoading ? (
                <p className="text-sm text-muted-foreground">Loading pool…</p>
              ) : availableLinks.length > 0 ? (
                <div>
                  <p className="text-sm font-medium mb-2">Available links ({availableLinks.length})</p>
                  <div className="border rounded-lg divide-y max-h-48 overflow-y-auto">
                    {availableLinks.slice(0, 20).map((link) => (
                      <div key={link.id} className="flex items-center justify-between gap-2 p-2 text-xs">
                        <span className="truncate font-mono text-muted-foreground">{link.link_url}</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="shrink-0 text-red-600 hover:text-red-700"
                          onClick={() => handleRemoveLink(link.id)}
                        >
                          Remove
                        </Button>
                      </div>
                    ))}
                    {availableLinks.length > 20 && (
                      <p className="p-2 text-xs text-muted-foreground">
                        + {availableLinks.length - 20} more…
                      </p>
                    )}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-amber-600">
                  No links in pool — reward will show as out of stock until you upload URLs.
                </p>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setPoolReward(null)}>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
