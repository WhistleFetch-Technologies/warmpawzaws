import React from 'react';
import { TrendingUp, TrendingDown, Heart, MessageSquare, Share2, Eye, Users, BarChart3 } from 'lucide-react';
import { Card } from '../../ui/card';

interface EngagementMetric {
  label: string;
  value: string;
  change: number;
  icon: React.ReactNode;
  trend: 'up' | 'down';
}

export function EngagementInsightsTab() {
  const metrics: EngagementMetric[] = [
    {
      label: 'Total Engagement',
      value: '125.4K',
      change: 12.5,
      icon: <BarChart3 className="w-5 h-5" />,
      trend: 'up'
    },
    {
      label: 'Average Likes',
      value: '2.4K',
      change: 8.2,
      icon: <Heart className="w-5 h-5" />,
      trend: 'up'
    },
    {
      label: 'Average Comments',
      value: '156',
      change: -3.1,
      icon: <MessageSquare className="w-5 h-5" />,
      trend: 'down'
    },
    {
      label: 'Average Shares',
      value: '89',
      change: 15.3,
      icon: <Share2 className="w-5 h-5" />,
      trend: 'up'
    },
    {
      label: 'Reach',
      value: '450K',
      change: 22.1,
      icon: <Eye className="w-5 h-5" />,
      trend: 'up'
    },
    {
      label: 'Followers',
      value: '125K',
      change: 5.7,
      icon: <Users className="w-5 h-5" />,
      trend: 'up'
    }
  ];

  const topPosts = [
    {
      id: '1',
      title: 'Pet Care Tips',
      engagement: 12500,
      type: 'image'
    },
    {
      id: '2',
      title: 'Product Launch',
      engagement: 9800,
      type: 'video'
    },
    {
      id: '3',
      title: 'Customer Story',
      engagement: 7500,
      type: 'carousel'
    }
  ];

  return (
    <div className="space-y-6">
      {/* Time Period Selector */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Engagement Insights</h3>
        <select className="px-4 py-2 border border-gray-300 rounded-lg text-sm">
          <option>Last 7 days</option>
          <option>Last 30 days</option>
          <option>Last 90 days</option>
          <option>Last year</option>
        </select>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {metrics.map((metric, index) => (
          <Card key={index} className="p-4">
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-center gap-2 text-gray-600">
                {metric.icon}
                <span className="text-sm font-medium">{metric.label}</span>
              </div>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-gray-900">{metric.value}</span>
              <div className={`flex items-center gap-1 text-sm ${
                metric.trend === 'up' ? 'text-green-600' : 'text-red-600'
              }`}>
                {metric.trend === 'up' ? (
                  <TrendingUp className="w-4 h-4" />
                ) : (
                  <TrendingDown className="w-4 h-4" />
                )}
                <span>{Math.abs(metric.change)}%</span>
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-1">vs previous period</p>
          </Card>
        ))}
      </div>

      {/* Top Performing Posts */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Top Performing Posts</h3>
        <div className="space-y-3">
          {topPosts.map((post, index) => (
            <div key={post.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gray-200 rounded-lg flex items-center justify-center text-lg">
                  {post.type === 'video' ? '🎥' : post.type === 'carousel' ? '🖼️' : '📷'}
                </div>
                <div>
                  <p className="font-medium text-sm">{post.title}</p>
                  <p className="text-xs text-gray-500">{post.type}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="font-semibold text-sm">{post.engagement.toLocaleString()}</p>
                <p className="text-xs text-gray-500">engagement</p>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Engagement Chart Placeholder */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Engagement Over Time</h3>
        <div className="h-64 bg-gray-50 rounded-lg flex items-center justify-center">
          <p className="text-gray-400">Chart visualization would go here</p>
        </div>
      </Card>
    </div>
  );
}

