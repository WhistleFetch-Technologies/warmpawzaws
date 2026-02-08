'use client';

import React, { useState, useEffect } from 'react';
import { Bell, Plus, Edit2, Trash2, Loader2, Save, X } from 'lucide-react';
import { apiClient } from '@/lib/api-client';

interface NotificationTemplate {
  templateId: string;
  name: string;
  code: string;
  channel: 'email' | 'sms' | 'push' | 'whatsapp';
  subject?: string;
  body: string;
  variables: string[];
  isActive: boolean;
}

export function NotificationTemplateManager() {
  const [loading, setLoading] = useState(true);
  const [templates, setTemplates] = useState<NotificationTemplate[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<NotificationTemplate | null>(null);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    code: '',
    channel: 'email' as NotificationTemplate['channel'],
    subject: '',
    body: '',
    variables: '',
    isActive: true,
  });

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    try {
      setLoading(true);
      const data = await apiClient.get<any>('/admin/notifications/templates');
      setTemplates(data.templates || []);
    } catch (error) {
      console.error('Error loading templates:', error);
      alert('Failed to load notification templates');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (template?: NotificationTemplate) => {
    if (template) {
      setEditingTemplate(template);
      setFormData({
        name: template.name,
        code: template.code,
        channel: template.channel,
        subject: template.subject || '',
        body: template.body,
        variables: template.variables.join(', '),
        isActive: template.isActive,
      });
    } else {
      setEditingTemplate(null);
      setFormData({
        name: '',
        code: '',
        channel: 'email',
        subject: '',
        body: '',
        variables: '',
        isActive: true,
      });
    }
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!formData.name || !formData.code || !formData.body) {
      alert('Name, code, and body are required');
      return;
    }

    try {
      setSaving(true);
      const payload = {
        name: formData.name,
        code: formData.code,
        channel: formData.channel,
        subject: formData.subject,
        body: formData.body,
        variables: formData.variables.split(',').map(v => v.trim()).filter(Boolean),
        isActive: formData.isActive,
      };

      if (editingTemplate) {
        const data = await apiClient.put<any>(`/admin/notifications/templates/${editingTemplate.templateId}`, payload);
        if (data.success) {
          alert('Template updated successfully');
          setShowModal(false);
          loadTemplates();
        } else {
          alert(data.error || 'Failed to update template');
        }
      } else {
        const data = await apiClient.post<any>('/admin/notifications/templates', payload);
        if (data.success) {
          alert('Template created successfully');
          setShowModal(false);
          loadTemplates();
        } else {
          alert(data.error || 'Failed to create template');
        }
      }
    } catch (error) {
      console.error('Error saving template:', error);
      alert('An error occurred while saving');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (templateId: string) => {
    if (!confirm('Are you sure you want to delete this template?')) return;

    try {
      const data = await apiClient.delete<any>(`/admin/notifications/templates/${templateId}`);
      if (data.success) {
        alert('Template deleted successfully');
        loadTemplates();
      } else {
        alert(data.error || 'Failed to delete template');
      }
    } catch (error) {
      console.error('Error deleting template:', error);
      alert('An error occurred while deleting');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 text-orange-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-0 bg-yellow-100 rounded-xl">
            <Bell className="w-6 h-6 text-yellow-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Notification Templates</h1>
            <p className="text-sm text-gray-600">Manage notification templates</p>
          </div>
        </div>
        <button
          onClick={() => handleOpenModal()}
          className="flex items-center gap-3 px-4 py-0 bg-orange-600 text-white rounded-lg hover:bg-orange-700"
        >
          <Plus className="w-4 h-4" />
          Create Template
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {templates.map((template) => (
          <div key={template.templateId} className="bg-white rounded-xl border-2 border-gray-200 p-0">
            <div className="flex items-start justify-between mb-0">
              <div>
                <div className="flex items-center gap-3 mb-0">
                  <h3 className="font-semibold text-gray-900">{template.name}</h3>
                  <span className={`px-0 py-0 text-xs font-medium rounded ${
                    template.channel === 'email' ? 'bg-blue-100 text-blue-700' :
                    template.channel === 'sms' ? 'bg-green-100 text-green-700' :
                    template.channel === 'push' ? 'bg-purple-100 text-purple-700' :
                    'bg-teal-100 text-teal-700'
                  }`}>
                    {template.channel.toUpperCase()}
                  </span>
                  <span className={`px-0 py-0 text-xs font-medium rounded ${
                    template.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
                  }`}>
                    {template.isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>
                <p className="text-sm text-gray-600 font-mono">{template.code}</p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => handleOpenModal(template)}
                  className="p-0 hover:bg-gray-100 rounded-lg"
                >
                  <Edit2 className="w-4 h-4 text-gray-600" />
                </button>
                <button
                  onClick={() => handleDelete(template.templateId)}
                  className="p-0 hover:bg-red-100 rounded-lg"
                >
                  <Trash2 className="w-4 h-4 text-red-600" />
                </button>
              </div>
            </div>
            {template.subject && (
              <p className="text-sm font-medium text-gray-900 mb-0">Subject: {template.subject}</p>
            )}
            <p className="text-sm text-gray-600 mb-0 line-clamp-0">{template.body}</p>
            {template.variables.length > 0 && (
              <div className="flex flex-wrap gap-3">
                {template.variables.map(variable => (
                  <span key={variable} className="px-0 py-0 bg-gray-100 text-gray-700 text-xs font-mono rounded">
                    {`{{${variable}}}`}
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-0 py-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">
                {editingTemplate ? 'Edit Template' : 'Create Template'}
              </h2>
              <button onClick={() => setShowModal(false)} className="p-0 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="p-0 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-0">Template Name *</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full px-0 py-0 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-0">Template Code *</label>
                  <input
                    type="text"
                    value={formData.code}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData(prev => ({ ...prev, code: e.target.value.toUpperCase() }))}
                    className="w-full px-0 py-0 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-0">Channel</label>
                <select
                  value={formData.channel}
                  onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setFormData(prev => ({ ...prev, channel: e.target.value as any }))}
                  className="w-full px-0 py-0 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500"
                >
                  <option value="email">Email</option>
                  <option value="sms">SMS</option>
                  <option value="push">Push Notification</option>
                  <option value="whatsapp">WhatsApp</option>
                </select>
              </div>

              {formData.channel === 'email' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-0">Subject</label>
                  <input
                    type="text"
                    value={formData.subject}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData(prev => ({ ...prev, subject: e.target.value }))}
                    className="w-full px-0 py-0 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500"
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-0">Body *</label>
                <textarea
                  value={formData.body}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setFormData(prev => ({ ...prev, body: e.target.value }))}
                  className="w-full px-0 py-0 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500"
                  rows={8}
                  placeholder="Use {{variable}} for dynamic content"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-0">Variables (comma-separated)</label>
                <input
                  type="text"
                  value={formData.variables}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData(prev => ({ ...prev, variables: e.target.value }))}
                  className="w-full px-0 py-0 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500"
                  placeholder="name, email, date"
                />
              </div>

              <div>
                <label className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={formData.isActive}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData(prev => ({ ...prev, isActive: e.target.checked }))}
                    className="w-4 h-4 text-orange-600 rounded focus:ring-orange-500"
                  />
                  <span className="text-sm font-medium text-gray-700">Active Template</span>
                </label>
              </div>
            </div>

            <div className="sticky bottom-0 bg-white border-t border-gray-200 px-0 py-4 flex gap-3">
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 px-4 py-0 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 px-4 py-0 bg-orange-600 text-white rounded-lg hover:bg-orange-700 font-medium flex items-center justify-center gap-3 disabled:opacity-50"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    {editingTemplate ? 'Update' : 'Create'} Template
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
