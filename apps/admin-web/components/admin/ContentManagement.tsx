'use client';

import React, { useState, useEffect } from 'react';
import { FileText, Plus, Edit2, Trash2, Loader2, Save, X } from 'lucide-react';
import { apiClient } from '@/lib/api-client';

interface ContentPage {
  pageId: string;
  title: string;
  slug: string;
  content: string;
  category: 'legal' | 'help' | 'marketing' | 'other';
  isPublished: boolean;
  updatedAt: string;
}

export function ContentManagement() {
  const [loading, setLoading] = useState(true);
  const [pages, setPages] = useState<ContentPage[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editingPage, setEditingPage] = useState<ContentPage | null>(null);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    title: '',
    slug: '',
    content: '',
    category: 'other' as ContentPage['category'],
    isPublished: false,
  });

  useEffect(() => {
    loadPages();
  }, []);

  const loadPages = async () => {
    try {
      setLoading(true);
      const data = await apiClient.get<any>('/admin/content/pages');
      setPages(data.pages || []);
    } catch (error) {
      console.error('Error loading pages:', error);
      alert('Failed to load content pages');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (page?: ContentPage) => {
    if (page) {
      setEditingPage(page);
      setFormData({
        title: page.title,
        slug: page.slug,
        content: page.content,
        category: page.category,
        isPublished: page.isPublished,
      });
    } else {
      setEditingPage(null);
      setFormData({
        title: '',
        slug: '',
        content: '',
        category: 'other',
        isPublished: false,
      });
    }
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!formData.title || !formData.slug) {
      alert('Title and slug are required');
      return;
    }

    try {
      setSaving(true);
      const payload = formData;

      if (editingPage) {
        const data = await apiClient.put<any>(`/admin/content/pages/${editingPage.pageId}`, payload);
        if (data.success) {
          alert('Page updated successfully');
          setShowModal(false);
          loadPages();
        } else {
          alert(data.error || 'Failed to update page');
        }
      } else {
        const data = await apiClient.post<any>('/admin/content/pages', payload);
        if (data.success) {
          alert('Page created successfully');
          setShowModal(false);
          loadPages();
        } else {
          alert(data.error || 'Failed to create page');
        }
      }
    } catch (error) {
      console.error('Error saving page:', error);
      alert('An error occurred while saving');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (pageId: string) => {
    if (!confirm('Are you sure you want to delete this page?')) return;

    try {
      const data = await apiClient.delete<any>(`/admin/content/pages/${pageId}`);
      if (data.success) {
        alert('Page deleted successfully');
        loadPages();
      } else {
        alert(data.error || 'Failed to delete page');
      }
    } catch (error) {
      console.error('Error deleting page:', error);
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
          <div className="p-0 bg-teal-100 rounded-xl">
            <FileText className="w-6 h-6 text-teal-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Content Management</h1>
            <p className="text-sm text-gray-600">Manage website content and pages</p>
          </div>
        </div>
        <button
          onClick={() => handleOpenModal()}
          className="flex items-center gap-3 px-4 py-0 bg-orange-600 text-white rounded-lg hover:bg-orange-700"
        >
          <Plus className="w-4 h-4" />
          Create Page
        </button>
      </div>

      <div className="bg-white rounded-xl border-2 border-gray-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-0 py-0 text-left text-xs font-medium text-gray-500 uppercase">Title</th>
              <th className="px-0 py-0 text-left text-xs font-medium text-gray-500 uppercase">Slug</th>
              <th className="px-0 py-0 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
              <th className="px-0 py-0 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="px-0 py-0 text-left text-xs font-medium text-gray-500 uppercase">Updated</th>
              <th className="px-0 py-0 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {pages.map((page) => (
              <tr key={page.pageId} className="hover:bg-gray-50">
                <td className="px-0 py-4 font-medium text-gray-900">{page.title}</td>
                <td className="px-0 py-4 text-sm text-gray-600 font-mono">/{page.slug}</td>
                <td className="px-0 py-4">
                  <span className="px-0 py-0 bg-blue-100 text-blue-700 text-xs font-medium rounded">
                    {page.category}
                  </span>
                </td>
                <td className="px-0 py-4">
                  <span className={`px-0 py-0 text-xs font-medium rounded ${
                    page.isPublished ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
                  }`}>
                    {page.isPublished ? 'Published' : 'Draft'}
                  </span>
                </td>
                <td className="px-0 py-4 text-sm text-gray-600">
                  {new Date(page.updatedAt).toLocaleDateString()}
                </td>
                <td className="px-0 py-4 text-right">
                  <div className="flex items-center justify-end gap-3">
                    <button
                      onClick={() => handleOpenModal(page)}
                      className="p-0 hover:bg-gray-200 rounded-lg"
                    >
                      <Edit2 className="w-4 h-4 text-gray-600" />
                    </button>
                    <button
                      onClick={() => handleDelete(page.pageId)}
                      className="p-0 hover:bg-red-100 rounded-lg"
                    >
                      <Trash2 className="w-4 h-4 text-red-600" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-0 py-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">
                {editingPage ? 'Edit Page' : 'Create Page'}
              </h2>
              <button onClick={() => setShowModal(false)} className="p-0 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="p-0 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-0">Title *</label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                    className="w-full px-0 py-0 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-0">Slug *</label>
                  <input
                    type="text"
                    value={formData.slug}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData(prev => ({ ...prev, slug: e.target.value }))}
                    className="w-full px-0 py-0 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-0">Category</label>
                <select
                  value={formData.category}
                  onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setFormData(prev => ({ ...prev, category: e.target.value as any }))}
                  className="w-full px-0 py-0 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500"
                >
                  <option value="legal">Legal</option>
                  <option value="help">Help</option>
                  <option value="marketing">Marketing</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-0">Content</label>
                <textarea
                  value={formData.content}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setFormData(prev => ({ ...prev, content: e.target.value }))}
                  className="w-full px-0 py-0 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500"
                  rows={12}
                />
              </div>

              <div>
                <label className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={formData.isPublished}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData(prev => ({ ...prev, isPublished: e.target.checked }))}
                    className="w-4 h-4 text-orange-600 rounded focus:ring-orange-500"
                  />
                  <span className="text-sm font-medium text-gray-700">Publish Page</span>
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
                    {editingPage ? 'Update' : 'Create'} Page
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
