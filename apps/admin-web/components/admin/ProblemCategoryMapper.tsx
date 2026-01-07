'use client';

import React, { useState, useEffect } from 'react';
import { Tag, Plus, Edit2, Trash2, Loader2, Save, X, AlertTriangle } from 'lucide-react';
import { apiClient } from '@/lib/api-client';

interface ProblemCategory {
  categoryId: string;
  categoryName: string;
  categoryCode: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  autoAssign: boolean;
  assignedTeam?: string;
  slaHours: number;
  isActive: boolean;
  problemCount: number;
  avgResolutionTime: number;
}

const SEVERITY_LEVELS = [
  { id: 'low', name: 'Low', color: 'bg-blue-100 text-blue-700' },
  { id: 'medium', name: 'Medium', color: 'bg-yellow-100 text-yellow-700' },
  { id: 'high', name: 'High', color: 'bg-orange-100 text-orange-700' },
  { id: 'critical', name: 'Critical', color: 'bg-red-100 text-red-700' },
];

const TEAMS = ['Support', 'Technical', 'Operations', 'Finance', 'Compliance'];

export function ProblemCategoryMapper() {
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState<ProblemCategory[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<ProblemCategory | null>(null);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    categoryName: '',
    categoryCode: '',
    description: '',
    severity: 'medium' as ProblemCategory['severity'],
    autoAssign: false,
    assignedTeam: '',
    slaHours: 24,
    isActive: true,
  });

  useEffect(() => {
    loadCategories();
  }, []);

  const loadCategories = async () => {
    try {
      setLoading(true);
      const data = await apiClient.get<any>('/admin/problem-categories');
      setCategories(data.categories || []);
    } catch (error) {
      console.error('Error loading categories:', error);
      alert('Failed to load problem categories');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (category?: ProblemCategory) => {
    if (category) {
      setEditingCategory(category);
      setFormData({
        categoryName: category.categoryName,
        categoryCode: category.categoryCode,
        description: category.description,
        severity: category.severity,
        autoAssign: category.autoAssign,
        assignedTeam: category.assignedTeam || '',
        slaHours: category.slaHours,
        isActive: category.isActive,
      });
    } else {
      setEditingCategory(null);
      setFormData({
        categoryName: '',
        categoryCode: '',
        description: '',
        severity: 'medium',
        autoAssign: false,
        assignedTeam: '',
        slaHours: 24,
        isActive: true,
      });
    }
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!formData.categoryName || !formData.categoryCode) {
      alert('Category name and code are required');
      return;
    }

    try {
      setSaving(true);
      const payload = {
        categoryName: formData.categoryName,
        categoryCode: formData.categoryCode,
        description: formData.description,
        severity: formData.severity,
        autoAssign: formData.autoAssign,
        assignedTeam: formData.autoAssign ? formData.assignedTeam : undefined,
        slaHours: formData.slaHours,
        isActive: formData.isActive,
      };

      if (editingCategory) {
        const data = await apiClient.put<any>(`/admin/problem-categories/${editingCategory.categoryId}`, payload);
        if (data.success) {
          alert('Category updated successfully');
          setShowModal(false);
          loadCategories();
        } else {
          alert(data.error || 'Failed to update category');
        }
      } else {
        const data = await apiClient.post<any>('/admin/problem-categories', payload);
        if (data.success) {
          alert('Category created successfully');
          setShowModal(false);
          loadCategories();
        } else {
          alert(data.error || 'Failed to create category');
        }
      }
    } catch (error) {
      console.error('Error saving category:', error);
      alert('An error occurred while saving');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (categoryId: string) => {
    if (!confirm('Are you sure you want to delete this category?')) return;

    try {
      const data = await apiClient.delete<any>(`/admin/problem-categories/${categoryId}`);
      if (data.success) {
        alert('Category deleted successfully');
        loadCategories();
      } else {
        alert(data.error || 'Failed to delete category');
      }
    } catch (error) {
      console.error('Error deleting category:', error);
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
        <div className="flex items-center gap-0">
          <div className="p-0 bg-pink-100 rounded-xl">
            <Tag className="w-6 h-6 text-pink-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Problem Category Mapper</h1>
            <p className="text-sm text-gray-600">Categorize and route support issues</p>
          </div>
        </div>
        <button
          onClick={() => handleOpenModal()}
          className="flex items-center gap-0 px-4 py-0 bg-orange-600 text-white rounded-lg hover:bg-orange-700"
        >
          <Plus className="w-4 h-4" />
          Add Category
        </button>
      </div>

      <div className="bg-white rounded-xl border-2 border-gray-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-0 py-0 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
              <th className="px-0 py-0 text-left text-xs font-medium text-gray-500 uppercase">Code</th>
              <th className="px-0 py-0 text-left text-xs font-medium text-gray-500 uppercase">Severity</th>
              <th className="px-0 py-0 text-left text-xs font-medium text-gray-500 uppercase">SLA</th>
              <th className="px-0 py-0 text-left text-xs font-medium text-gray-500 uppercase">Team</th>
              <th className="px-0 py-0 text-left text-xs font-medium text-gray-500 uppercase">Issues</th>
              <th className="px-0 py-0 text-left text-xs font-medium text-gray-500 uppercase">Avg Time</th>
              <th className="px-0 py-0 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="px-0 py-0 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {categories.map((category) => {
              const severityConfig = SEVERITY_LEVELS.find(s => s.id === category.severity);
              return (
                <tr key={category.categoryId} className="hover:bg-gray-50">
                  <td className="px-0 py-4">
                    <div>
                      <p className="font-medium text-gray-900">{category.categoryName}</p>
                      <p className="text-sm text-gray-600">{category.description}</p>
                    </div>
                  </td>
                  <td className="px-0 py-4">
                    <span className="font-mono text-sm text-gray-600">{category.categoryCode}</span>
                  </td>
                  <td className="px-0 py-4">
                    <span className={`px-0 py-0 text-xs font-medium rounded ${severityConfig?.color}`}>
                      {severityConfig?.name}
                    </span>
                  </td>
                  <td className="px-0 py-4 text-sm text-gray-900">{category.slaHours}h</td>
                  <td className="px-0 py-4">
                    {category.autoAssign ? (
                      <span className="text-sm text-gray-900">{category.assignedTeam}</span>
                    ) : (
                      <span className="text-sm text-gray-500">Manual</span>
                    )}
                  </td>
                  <td className="px-0 py-4 text-sm text-gray-900">{category.problemCount}</td>
                  <td className="px-0 py-4 text-sm text-gray-900">{category.avgResolutionTime}h</td>
                  <td className="px-0 py-4">
                    <span className={`px-0 py-0 text-xs font-medium rounded ${
                      category.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
                    }`}>
                      {category.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-0 py-4 text-right">
                    <div className="flex items-center justify-end gap-0">
                      <button
                        onClick={() => handleOpenModal(category)}
                        className="p-0 hover:bg-gray-200 rounded-lg"
                      >
                        <Edit2 className="w-4 h-4 text-gray-600" />
                      </button>
                      <button
                        onClick={() => handleDelete(category.categoryId)}
                        className="p-0 hover:bg-red-100 rounded-lg"
                      >
                        <Trash2 className="w-4 h-4 text-red-600" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-0 py-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">
                {editingCategory ? 'Edit Category' : 'Add Category'}
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="p-0 hover:bg-gray-100 rounded-lg"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="p-0 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-0">Category Name *</label>
                  <input
                    type="text"
                    value={formData.categoryName}
                    onChange={(e) => setFormData(prev => ({ ...prev, categoryName: e.target.value }))}
                    className="w-full px-0 py-0 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500"
                    placeholder="e.g., Payment Issues"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-0">Category Code *</label>
                  <input
                    type="text"
                    value={formData.categoryCode}
                    onChange={(e) => setFormData(prev => ({ ...prev, categoryCode: e.target.value.toUpperCase() }))}
                    className="w-full px-0 py-0 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500"
                    placeholder="e.g., PAY"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-0">Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  className="w-full px-0 py-0 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500"
                  rows={2}
                  placeholder="Describe this category..."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-0">Severity</label>
                  <select
                    value={formData.severity}
                    onChange={(e) => setFormData(prev => ({ ...prev, severity: e.target.value as any }))}
                    className="w-full px-0 py-0 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500"
                  >
                    {SEVERITY_LEVELS.map(level => (
                      <option key={level.id} value={level.id}>{level.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-0">SLA (Hours)</label>
                  <input
                    type="number"
                    min="1"
                    value={formData.slaHours}
                    onChange={(e) => setFormData(prev => ({ ...prev, slaHours: parseInt(e.target.value) }))}
                    className="w-full px-0 py-0 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500"
                  />
                </div>
              </div>

              <div>
                <label className="flex items-center gap-0">
                  <input
                    type="checkbox"
                    checked={formData.autoAssign}
                    onChange={(e) => setFormData(prev => ({ ...prev, autoAssign: e.target.checked }))}
                    className="w-4 h-4 text-orange-600 rounded focus:ring-orange-500"
                  />
                  <span className="text-sm font-medium text-gray-700">Auto-assign to team</span>
                </label>
              </div>

              {formData.autoAssign && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-0">Assigned Team</label>
                  <select
                    value={formData.assignedTeam}
                    onChange={(e) => setFormData(prev => ({ ...prev, assignedTeam: e.target.value }))}
                    className="w-full px-0 py-0 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500"
                  >
                    <option value="">Select Team</option>
                    {TEAMS.map(team => (
                      <option key={team} value={team}>{team}</option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="flex items-center gap-0">
                  <input
                    type="checkbox"
                    checked={formData.isActive}
                    onChange={(e) => setFormData(prev => ({ ...prev, isActive: e.target.checked }))}
                    className="w-4 h-4 text-orange-600 rounded focus:ring-orange-500"
                  />
                  <span className="text-sm font-medium text-gray-700">Active Category</span>
                </label>
              </div>
            </div>

            <div className="sticky bottom-0 bg-white border-t border-gray-200 px-0 py-4 flex gap-0">
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 px-4 py-0 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 px-4 py-0 bg-orange-600 text-white rounded-lg hover:bg-orange-700 font-medium flex items-center justify-center gap-0 disabled:opacity-50"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    {editingCategory ? 'Update' : 'Create'} Category
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
