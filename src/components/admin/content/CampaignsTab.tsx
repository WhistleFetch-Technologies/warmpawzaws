import React, { useState } from 'react';
import { Plus, Calendar, Target, TrendingUp, Users, Eye, Edit, Trash2, Play, Pause } from 'lucide-react';
import { Badge } from '../../ui/badge';
import { Button } from '../../ui/button';
import { Card } from '../../ui/card';

interface Campaign {
  id: string;
  name: string;
  status: 'draft' | 'active' | 'paused' | 'completed';
  startDate: string;
  endDate: string;
  budget: number;
  spent: number;
  reach: number;
  impressions: number;
  clicks: number;
  conversions: number;
  objective: string;
}

export function CampaignsTab() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([
    {
      id: '1',
      name: 'Summer Pet Care Campaign',
      status: 'active',
      startDate: '2024-01-01',
      endDate: '2024-01-31',
      budget: 10000,
      spent: 6500,
      reach: 125000,
      impressions: 450000,
      clicks: 12500,
      conversions: 890,
      objective: 'Brand Awareness'
    },
    {
      id: '2',
      name: 'Product Launch Campaign',
      status: 'paused',
      startDate: '2024-01-15',
      endDate: '2024-02-15',
      budget: 15000,
      spent: 3200,
      reach: 85000,
      impressions: 280000,
      clicks: 8900,
      conversions: 450,
      objective: 'Conversions'
    }
  ]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-700';
      case 'paused': return 'bg-yellow-100 text-yellow-700';
      case 'completed': return 'bg-blue-100 text-blue-700';
      case 'draft': return 'bg-gray-100 text-gray-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const getBudgetPercentage = (spent: number, budget: number) => {
    return Math.min((spent / budget) * 100, 100);
  };

  return (
    <div className="space-y-4">
      {/* Header Actions */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Marketing Campaigns</h3>
          <p className="text-sm text-gray-500">Manage and track your marketing campaigns</p>
        </div>
        <Button>
          <Plus className="w-4 h-4 mr-2" />
          Create Campaign
        </Button>
      </div>

      {/* Campaigns List */}
      <div className="space-y-4">
        {campaigns.map((campaign) => (
          <Card key={campaign.id} className="p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <h4 className="text-lg font-semibold">{campaign.name}</h4>
                  <Badge className={getStatusColor(campaign.status)}>
                    {campaign.status}
                  </Badge>
                </div>
                <div className="flex items-center gap-4 text-sm text-gray-600 mb-3">
                  <div className="flex items-center gap-1">
                    <Calendar className="w-4 h-4" />
                    {campaign.startDate} - {campaign.endDate}
                  </div>
                  <div className="flex items-center gap-1">
                    <Target className="w-4 h-4" />
                    {campaign.objective}
                  </div>
                </div>

                {/* Budget Progress */}
                <div className="mb-4">
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="text-gray-600">Budget</span>
                    <span className="font-semibold">
                      ₹{campaign.spent.toLocaleString()} / ₹{campaign.budget.toLocaleString()}
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full transition-all"
                      style={{ width: `${getBudgetPercentage(campaign.spent, campaign.budget)}%` }}
                    />
                  </div>
                </div>

                {/* Metrics Grid */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Reach</p>
                    <p className="text-lg font-semibold flex items-center gap-1">
                      <Users className="w-4 h-4 text-gray-400" />
                      {campaign.reach.toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Impressions</p>
                    <p className="text-lg font-semibold flex items-center gap-1">
                      <Eye className="w-4 h-4 text-gray-400" />
                      {campaign.impressions.toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Clicks</p>
                    <p className="text-lg font-semibold">{campaign.clicks.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Conversions</p>
                    <p className="text-lg font-semibold flex items-center gap-1">
                      <TrendingUp className="w-4 h-4 text-gray-400" />
                      {campaign.conversions.toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">CTR</p>
                    <p className="text-lg font-semibold">
                      {((campaign.clicks / campaign.impressions) * 100).toFixed(2)}%
                    </p>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 ml-4">
                {campaign.status === 'active' ? (
                  <Button size="sm" variant="outline">
                    <Pause className="w-4 h-4 mr-1" />
                    Pause
                  </Button>
                ) : campaign.status === 'paused' ? (
                  <Button size="sm" variant="outline">
                    <Play className="w-4 h-4 mr-1" />
                    Resume
                  </Button>
                ) : null}
                <Button size="sm" variant="outline">
                  <Edit className="w-4 h-4 mr-1" />
                  Edit
                </Button>
                <Button size="sm" variant="outline" className="text-red-600 hover:text-red-700">
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {campaigns.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          <Target className="w-12 h-12 mx-auto mb-4 text-gray-300" />
          <p>No campaigns found</p>
          <Button className="mt-4">
            <Plus className="w-4 h-4 mr-2" />
            Create Your First Campaign
          </Button>
        </div>
      )}
    </div>
  );
}

