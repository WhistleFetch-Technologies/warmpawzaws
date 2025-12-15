import React, { useState, useEffect } from 'react';
import { Button } from '../ui/button';
import {
  Mail,
  MessageSquare,
  Bell,
  Plus,
  Edit,
  Trash2,
  Eye,
  Copy,
  BarChart3,
  Power,
  Check,
  X
} from 'lucide-react';
import { toast } from 'sonner';
import { projectId, publicAnonKey } from '../../utils/supabase/info';

const BASE_URL = `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475`;

interface NotificationTemplate {
  templateId: string;
  templateName: string;
  templateCode: string;
  channel: 'sms' | 'email' | 'whatsapp' | 'push';
  eventType: string;
  subject?: string;
  body: string;
  variables: Array<{
    name: string;
    type: string;
    required: boolean;
    defaultValue?: any;
  }>;
  metadata: {
    category: string;
    priority: string;
    tags: string[];
  };
  analytics: {
    totalSent: number;
    totalDelivered: number;
    totalFailed: number;
    totalOpened: number;
  };
  isActive: boolean;
  createdAt: string;
}

export function NotificationTemplateManager() {
  const [templates, setTemplates] = useState<NotificationTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedChannel, setSelectedChannel] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [previewTemplate, setPreviewTemplate] = useState<NotificationTemplate | null>(null);
  const [previewData, setPreviewData] = useState<any>(null);

  useEffect(() => {
    fetchTemplates();
  }, [selectedChannel]);

  const fetchTemplates = async () => {
    setLoading(true);
    try {
      const url = selectedChannel
        ? `${BASE_URL}/notification-templates?channel=${selectedChannel}`
        : `${BASE_URL}/notification-templates`;

      const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${publicAnonKey}` }
      });

      if (response.ok) {
        const data = await response.json();
        setTemplates(data.templates || []);
      }
    } catch (error) {
      console.error('Error fetching templates:', error);
      toast.error('Failed to load templates');
    } finally {
      setLoading(false);
    }
  };

  const toggleTemplate = async (templateId: string) => {
    try {
      const response = await fetch(
        `${BASE_URL}/notification-templates/${templateId}/toggle`,
        {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${publicAnonKey}` }
        }
      );

      if (response.ok) {
        toast.success('Template status updated');
        fetchTemplates();
      }
    } catch (error) {
      console.error('Error toggling template:', error);
      toast.error('Failed to update template');
    }
  };

  const previewTemplateWithData = async (template: NotificationTemplate, sampleData: any) => {
    try {
      const response = await fetch(
        `${BASE_URL}/notification-templates/${template.templateId}/preview`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ variables: sampleData })
        }
      );

      if (response.ok) {
        const data = await response.json();
        setPreviewData(data.preview);
      }
    } catch (error) {
      console.error('Error previewing template:', error);
      toast.error('Failed to preview template');
    }
  };

  const getChannelIcon = (channel: string) => {
    const icons: Record<string, any> = {
      'sms': MessageSquare,
      'email': Mail,
      'whatsapp': MessageSquare,
      'push': Bell
    };
    return icons[channel] || MessageSquare;
  };

  const getChannelColor = (channel: string) => {
    const colors: Record<string, string> = {
      'sms': 'bg-blue-100 text-blue-700 border-blue-200',
      'email': 'bg-purple-100 text-purple-700 border-purple-200',
      'whatsapp': 'bg-green-100 text-green-700 border-green-200',
      'push': 'bg-orange-100 text-orange-700 border-orange-200'
    };
    return colors[channel] || 'bg-gray-100 text-gray-700 border-gray-200';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl border-2 border-gray-200 p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-1">
              Notification Templates
            </h1>
            <p className="text-gray-600">
              Manage SMS, Email, WhatsApp & Push notification templates
            </p>
          </div>

          <Button
            onClick={() => setShowCreateModal(true)}
            className="bg-orange-600 hover:bg-orange-700"
          >
            <Plus className="w-4 h-4 mr-2" />
            Create Template
          </Button>
        </div>

        {/* Channel Filter */}
        <div className="flex gap-3">
          <button
            onClick={() => setSelectedChannel(null)}
            className={`px-4 py-2 rounded-lg border-2 transition-colors ${
              selectedChannel === null
                ? 'border-orange-600 bg-orange-50 text-orange-900'
                : 'border-gray-200 hover:border-orange-300'
            }`}
          >
            All Channels
          </button>
          
          {['sms', 'email', 'whatsapp', 'push'].map((channel) => {
            const Icon = getChannelIcon(channel);
            return (
              <button
                key={channel}
                onClick={() => setSelectedChannel(channel)}
                className={`px-4 py-2 rounded-lg border-2 transition-colors flex items-center gap-2 ${
                  selectedChannel === channel
                    ? 'border-orange-600 bg-orange-50 text-orange-900'
                    : 'border-gray-200 hover:border-orange-300'
                }`}
              >
                <Icon className="w-4 h-4" />
                {channel.toUpperCase()}
              </button>
            );
          })}
        </div>
      </div>

      {/* Templates Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600" />
        </div>
      ) : templates.length === 0 ? (
        <div className="bg-white rounded-xl border-2 border-gray-200 p-12 text-center">
          <Mail className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="font-bold text-gray-900 mb-2">No Templates Found</h3>
          <p className="text-gray-600 mb-4">Create your first notification template</p>
          <Button
            onClick={() => setShowCreateModal(true)}
            className="bg-orange-600 hover:bg-orange-700"
          >
            <Plus className="w-4 h-4 mr-2" />
            Create Template
          </Button>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {templates.map((template) => {
            const Icon = getChannelIcon(template.channel);

            return (
              <div
                key={template.templateId}
                className="bg-white rounded-xl border-2 border-gray-200 overflow-hidden hover:border-orange-300 transition-colors"
              >
                {/* Header */}
                <div className="p-6 border-b border-gray-200">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <h3 className="font-bold text-gray-900 mb-1">
                        {template.templateName}
                      </h3>
                      <p className="text-sm text-gray-600 mb-2">
                        Code: <code className="px-2 py-0.5 bg-gray-100 rounded text-xs">
                          {template.templateCode}
                        </code>
                      </p>
                    </div>

                    <div className={`px-3 py-1 rounded-full text-xs font-medium border-2 flex items-center gap-1 ${getChannelColor(template.channel)}`}>
                      <Icon className="w-3 h-3" />
                      {template.channel.toUpperCase()}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 text-xs text-gray-600">
                    <span className="px-2 py-1 bg-gray-100 rounded">
                      {template.eventType}
                    </span>
                    <span className="px-2 py-1 bg-gray-100 rounded capitalize">
                      {template.metadata.category}
                    </span>
                  </div>
                </div>

                {/* Body Preview */}
                <div className="p-6 bg-gray-50 border-b border-gray-200">
                  {template.subject && (
                    <p className="text-sm font-medium text-gray-900 mb-2">
                      {template.subject}
                    </p>
                  )}
                  <p className="text-sm text-gray-600 line-clamp-3">
                    {template.body}
                  </p>
                </div>

                {/* Variables */}
                {template.variables.length > 0 && (
                  <div className="p-4 bg-blue-50 border-b border-gray-200">
                    <p className="text-xs font-medium text-blue-900 mb-2">
                      Variables ({template.variables.length}):
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {template.variables.slice(0, 3).map((v, idx) => (
                        <code key={idx} className="text-xs px-2 py-0.5 bg-white border border-blue-200 rounded">
                          {`{{${v.name}}}`}
                        </code>
                      ))}
                      {template.variables.length > 3 && (
                        <span className="text-xs text-blue-600">
                          +{template.variables.length - 3} more
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* Analytics */}
                <div className="p-4 border-b border-gray-200">
                  <div className="grid grid-cols-2 gap-3 text-center">
                    <div>
                      <p className="text-xl font-bold text-gray-900">
                        {template.analytics.totalSent}
                      </p>
                      <p className="text-xs text-gray-600">Sent</p>
                    </div>
                    <div>
                      <p className="text-xl font-bold text-green-600">
                        {template.analytics.totalDelivered}
                      </p>
                      <p className="text-xs text-gray-600">Delivered</p>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="p-4 bg-gray-50 flex items-center gap-2">
                  <button
                    onClick={() => {
                      setPreviewTemplate(template);
                      setPreviewData(null);
                    }}
                    className="flex-1 px-3 py-2 border-2 border-gray-200 rounded-lg hover:border-orange-300 transition-colors flex items-center justify-center gap-2 text-sm"
                  >
                    <Eye className="w-4 h-4" />
                    Preview
                  </button>

                  <button
                    onClick={() => toggleTemplate(template.templateId)}
                    className={`px-3 py-2 border-2 rounded-lg transition-colors ${
                      template.isActive
                        ? 'border-green-200 bg-green-50 text-green-700 hover:bg-green-100'
                        : 'border-gray-200 bg-gray-50 text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    <Power className="w-4 h-4" />
                  </button>

                  <button className="px-3 py-2 border-2 border-gray-200 rounded-lg hover:border-blue-300 transition-colors">
                    <BarChart3 className="w-4 h-4 text-blue-600" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
