'use client';

import React, { useState, useEffect } from 'react';
import { FileText, Plus, Save, Loader2, Trash2, GripVertical, Type, Hash, Mail, Phone, Calendar, ToggleLeft, List, Upload, ArrowLeft } from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { toast } from 'sonner';

interface FormField {
  id: string;
  type: 'text' | 'number' | 'email' | 'phone' | 'date' | 'select' | 'checkbox' | 'file' | 'textarea';
  label: string;
  placeholder?: string;
  required: boolean;
  options?: string[];
}

interface EnhancedOnboardingFormBuilderProps {
  formId?: string;
  roleId?: string;
  onBack?: () => void;
}

const FIELD_TYPES = [
  { type: 'text', label: 'Text', icon: Type },
  { type: 'number', label: 'Number', icon: Hash },
  { type: 'email', label: 'Email', icon: Mail },
  { type: 'phone', label: 'Phone', icon: Phone },
  { type: 'date', label: 'Date', icon: Calendar },
  { type: 'select', label: 'Dropdown', icon: List },
  { type: 'checkbox', label: 'Checkbox', icon: ToggleLeft },
  { type: 'file', label: 'File Upload', icon: Upload },
  { type: 'textarea', label: 'Long Text', icon: FileText },
];

export function EnhancedOnboardingFormBuilder({ formId, roleId, onBack }: EnhancedOnboardingFormBuilderProps) {
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formName, setFormName] = useState('');
  const [fields, setFields] = useState<FormField[]>([]);
  const [editingField, setEditingField] = useState<FormField | null>(null);
  const [showAddField, setShowAddField] = useState(false);

  useEffect(() => {
    if (formId) {
      loadForm();
    }
  }, [formId]);

  const loadForm = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get<any>(`/onboarding-form/${formId}`);
      if (response.form) {
        setFormName(response.form.name);
        setFields(response.form.fields || []);
      }
    } catch (error) {
      console.error('Error loading form:', error);
    } finally {
      setLoading(false);
    }
  };

  const addField = (type: string) => {
    const newField: FormField = {
      id: `field_${Date.now()}`,
      type: type as FormField['type'],
      label: `New ${type} field`,
      placeholder: '',
      required: false,
      options: type === 'select' ? ['Option 1', 'Option 2'] : undefined,
    };
    setFields([...fields, newField]);
    setEditingField(newField);
    setShowAddField(false);
  };

  const updateField = (id: string, updates: Partial<FormField>) => {
    setFields(fields.map(f => f.id === id ? { ...f, ...updates } : f));
    if (editingField?.id === id) {
      setEditingField({ ...editingField, ...updates });
    }
  };

  const removeField = (id: string) => {
    setFields(fields.filter(f => f.id !== id));
    if (editingField?.id === id) {
      setEditingField(null);
    }
  };

  const saveForm = async () => {
    if (!formName) {
      toast.error('Please enter a form name');
      return;
    }

    try {
      setSaving(true);
      await apiClient.post('/admin/forms', {
        id: formId,
        name: formName,
        roleId,
        fields,
      });
      toast.success('Form saved successfully!');
    } catch (error) {
      toast.error('Failed to save form');
    } finally {
      setSaving(false);
    }
  };

  const getFieldIcon = (type: string) => {
    const fieldType = FIELD_TYPES.find(f => f.type === type);
    return fieldType?.icon || Type;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4">
          {onBack && (
            <button onClick={onBack} className="mb-2 text-gray-600 hover:text-gray-900 flex items-center gap-2 text-sm">
              <ArrowLeft className="w-4 h-4" />
              Back
            </button>
          )}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-100 rounded-lg">
                <FileText className="w-6 h-6 text-orange-600" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">Form Builder</h1>
                <p className="text-sm text-gray-500">Drag and drop to reorder fields</p>
              </div>
            </div>
            <button
              onClick={saveForm}
              disabled={saving}
              className="px-4 py-2 bg-orange-500 text-white rounded-lg font-medium flex items-center gap-2 hover:bg-orange-600 disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save Form
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-4">
        {loading ? (
          <div className="text-center py-12">
            <Loader2 className="w-8 h-8 animate-spin mx-auto text-orange-500" />
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Form Preview */}
            <div className="lg:col-span-2 space-y-4">
              <div className="bg-white rounded-xl p-4 border border-gray-200">
                <label className="block text-sm font-medium text-gray-700 mb-1">Form Name</label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormName(e.target.value)}
                  placeholder="e.g., Vet Onboarding Form"
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-200 focus:border-orange-500"
                />
              </div>

              <div className="bg-white rounded-xl border border-gray-200 p-4">
                <h3 className="font-semibold text-gray-900 mb-4">Form Fields</h3>
                
                {fields.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <FileText className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                    <p>No fields added yet</p>
                    <p className="text-sm">Click "Add Field" to start building</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {fields.map((field, index) => {
                      const Icon = getFieldIcon(field.type);
                      return (
                        <div
                          key={field.id}
                          onClick={() => setEditingField(field)}
                          className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                            editingField?.id === field.id 
                              ? 'border-orange-500 bg-orange-50' 
                              : 'border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <GripVertical className="w-4 h-4 text-gray-400 cursor-grab" />
                            <Icon className="w-4 h-4 text-gray-500" />
                            <div className="flex-1">
                              <p className="font-medium text-gray-900 text-sm">{field.label}</p>
                              <p className="text-xs text-gray-500">{field.type} {field.required && '• Required'}</p>
                            </div>
                            <button
                              onClick={(e) => { e.stopPropagation(); removeField(field.id); }}
                              className="p-1 text-gray-400 hover:text-red-500"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                <button
                  onClick={() => setShowAddField(!showAddField)}
                  className="mt-4 w-full py-2 border-2 border-dashed border-gray-300 rounded-lg text-gray-600 hover:border-orange-400 hover:text-orange-600 flex items-center justify-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Add Field
                </button>

                {showAddField && (
                  <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                    <p className="text-sm font-medium text-gray-700 mb-2">Select Field Type</p>
                    <div className="grid grid-cols-3 gap-2">
                      {FIELD_TYPES.map(fieldType => (
                        <button
                          key={fieldType.type}
                          onClick={() => addField(fieldType.type)}
                          className="p-2 bg-white border border-gray-200 rounded-lg hover:border-orange-400 hover:bg-orange-50 text-left"
                        >
                          <fieldType.icon className="w-4 h-4 text-gray-500 mb-1" />
                          <p className="text-xs font-medium text-gray-700">{fieldType.label}</p>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Field Properties */}
            <div className="lg:col-span-1">
              <div className="bg-white rounded-xl border border-gray-200 p-4 sticky top-24">
                <h3 className="font-semibold text-gray-900 mb-4">Field Properties</h3>
                
                {editingField ? (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Label</label>
                      <input
                        type="text"
                        value={editingField.label}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateField(editingField.id, { label: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Placeholder</label>
                      <input
                        type="text"
                        value={editingField.placeholder || ''}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateField(editingField.id, { placeholder: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-medium text-gray-700">Required</label>
                      <button
                        onClick={() => updateField(editingField.id, { required: !editingField.required })}
                        className={`w-10 h-5 rounded-full transition-colors ${editingField.required ? 'bg-orange-500' : 'bg-gray-200'}`}
                      >
                        <div className={`w-4 h-4 bg-white rounded-full shadow transition-transform ${editingField.required ? 'translate-x-5' : 'translate-x-0.5'}`} />
                      </button>
                    </div>

                    {editingField.type === 'select' && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Options (one per line)</label>
                        <textarea
                          value={(editingField.options || []).join('\n')}
                          onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => updateField(editingField.id, { options: e.target.value.split('\n').filter(Boolean) })}
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm min-h-[100px]"
                          placeholder="Option 1&#10;Option 2&#10;Option 3"
                        />
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">Select a field to edit its properties</p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
