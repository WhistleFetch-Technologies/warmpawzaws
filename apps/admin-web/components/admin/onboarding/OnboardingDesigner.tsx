'use client';

import React, { useState, useEffect } from 'react';
import { Layers, Plus, Save, Loader2, Edit, Trash2, GripVertical, X, Check, Shield, Download } from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { Button, Card, CardContent, Input, Label, Textarea, Switch, Badge } from '@warmpawz/ui';

interface FormField {
  id: string;
  label: string;
  type: 'text' | 'email' | 'tel' | 'textarea' | 'select' | 'checkbox' | 'file' | 'aadhaar-otp' | 'pan-verify' | 'gst-verify' | 'declaration';
  placeholder?: string;
  helpText?: string;
  required: boolean;
  options?: string[]; // For select fields
  order: number;
  // KYC-specific fields
  requiresVerification?: boolean;
  verificationEndpoint?: string;
  declarationText?: string;
  declarationType?: string;
  softBlock?: boolean;
}

interface FormSection {
  id: string;
  title: string;
  fields: FormField[];
  order: number;
}

export function OnboardingDesigner() {
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [roles, setRoles] = useState<any[]>([]);
  const [selectedRole, setSelectedRole] = useState<string>('veterinarian');
  const [formEnabled, setFormEnabled] = useState(true);
  const [sections, setSections] = useState<FormSection[]>([
    {
      id: 'profile',
      title: 'Profile & Business Details',
      order: 1,
      fields: [
        { id: 'business_name', label: 'Business Name', type: 'text', required: true, order: 1 },
        { id: 'business_type', label: 'Business Type', type: 'select', required: true, options: ['Solo Practitioner', 'Clinic', 'Home Service', 'Mobile Unit'], order: 2 },
        { id: 'role', label: 'Role', type: 'select', required: true, options: ['Veterinarian', 'Groomer', 'Trainer'], order: 3 },
        { id: 'address', label: 'Address', type: 'textarea', required: true, order: 4 },
        { id: 'city', label: 'City', type: 'text', required: true, order: 5 },
        { id: 'pin', label: 'PIN', type: 'text', required: true, order: 6 },
        { id: 'state', label: 'State', type: 'text', required: true, order: 7 },
        { id: 'phone', label: 'Phone', type: 'tel', required: true, order: 8 },
        { id: 'gst_number', label: 'GST Number', type: 'text', required: false, order: 9 },
      ],
    },
  ]);
  const [editingField, setEditingField] = useState<FormField | null>(null);
  const [editingSection, setEditingSection] = useState<FormSection | null>(null);
  const [migratingKYC, setMigratingKYC] = useState(false);
  const [kycMigrationResult, setKycMigrationResult] = useState<any>(null);

  useEffect(() => {
    loadData();
  }, []);

  // KYC Migration - adds KYC fields to all active roles
  const handleKYCMigration = async () => {
    if (!confirm('This will add KYC verification fields to all active roles. Existing fields will be preserved. Continue?')) {
      return;
    }

    setMigratingKYC(true);
    setKycMigrationResult(null);

    try {
      const response = await apiClient.post<any>('/admin/onboarding-fields/migrate-kyc', {});
      
      if (response.success) {
        setKycMigrationResult({
          success: true,
          message: response.message,
          summary: response.summary,
          results: response.results,
        });
        
        // Reload current form
        if (selectedRole) {
          await loadFormForRole(selectedRole);
        }
        
        alert(`KYC Migration Complete!\n${response.message}`);
      } else {
        setKycMigrationResult({
          success: false,
          error: response.error || 'Migration failed',
        });
        alert(`Migration failed: ${response.error || 'Unknown error'}`);
      }
    } catch (error: any) {
      console.error('KYC migration error:', error);
      setKycMigrationResult({
        success: false,
        error: error.message || 'Migration failed',
      });
      alert(`Migration failed: ${error.message || 'Unknown error'}`);
    } finally {
      setMigratingKYC(false);
    }
  };

  const loadData = async () => {
    try {
      setLoading(true);
      const rolesRes = await apiClient.get<any>('/admin/roles');
      if (rolesRes.success) {
        const roleOptions = (rolesRes.roles || []).map((r: any) => ({
          id: r.id || r.name || r.roleCode,
          name: r.display_name || r.roleName || r.name,
          code: r.name || r.roleCode,
        }));
        setRoles(roleOptions);
        
        // If a role is selected, load its form
        if (selectedRole) {
          await loadFormForRole(selectedRole);
        }
      }
    } catch (error) {
      console.error('Error loading roles:', error);
      alert('Failed to load roles. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const loadFormForRole = async (roleId: string) => {
    try {
      const formRes = await apiClient.get<any>(`/admin/onboarding-fields/${roleId}`);
      if (formRes.success) {
        // Map fields to sections format expected by component
        if (formRes.fields && formRes.fields.length > 0) {
          const fieldsBySection = formRes.fields.reduce((acc: Record<string, any[]>, field: any) => {
            const section = field.section || 'business_information';
            if (!acc[section]) acc[section] = [];
            acc[section].push(field);
            return acc;
          }, {});

          const mappedSections = Object.entries(fieldsBySection).map(([sectionId, fields]) => {
            const fieldsArray = Array.isArray(fields) ? fields : [];
            return {
              id: sectionId,
              title: sectionId.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
              order: fieldsArray[0]?.displayOrder || 0,
              fields: fieldsArray.sort((a: any, b: any) => (a.displayOrder || 0) - (b.displayOrder || 0)),
            };
          });

          setSections(mappedSections);
        } else {
          // If no fields, use default sections
          setSections([{
            id: 'business_information',
            title: 'Business Information',
            order: 1,
            fields: [],
          }]);
        }
      }
    } catch (error: any) {
      console.error('Error loading form for role:', error);
      // If form doesn't exist, use empty sections
      setSections([{
        id: 'business_information',
        title: 'Business Information',
        order: 1,
        fields: [],
      }]);
    }
  };

  const handleSave = async () => {
    if (!selectedRole) {
      alert('Please select a role first');
      return;
    }

    try {
      setSaving(true);
      // Forms are saved automatically when fields are added/updated/deleted
      // This save button can be used to update form status or metadata if needed
      alert('Form changes are saved automatically. All fields have been persisted.');
    } catch (error) {
      console.error('Error saving onboarding form:', error);
      alert('An error occurred while saving');
    } finally {
      setSaving(false);
    }
  };

  const addField = async (sectionId: string) => {
    if (!selectedRole) {
      alert('Please select a role first');
      return;
    }

    const newField: FormField = {
      id: `field_${Date.now()}`,
      label: 'New Field',
      type: 'text',
      required: false,
      order: sections.find(s => s.id === sectionId)?.fields.length || 0,
    };

    try {
      // Create field via API
      const response = await apiClient.post<any>(`/admin/onboarding-fields/${selectedRole}`, {
        ...newField,
        section: sectionId,
        fieldName: newField.label.toLowerCase().replace(/\s+/g, '_'),
      });

      if (response.success) {
        // Reload form for this role
        await loadFormForRole(selectedRole);
        setEditingField(newField);
      } else {
        alert('Failed to create field. Please try again.');
      }
    } catch (error: any) {
      console.error('Error creating field:', error);
      alert(`Failed to create field: ${error.message || 'Unknown error'}`);
    }
  };

  const updateField = async (sectionId: string, fieldId: string, updates: Partial<FormField>) => {
    if (!selectedRole) {
      alert('Please select a role first');
      return;
    }

    try {
      // Update field via API
      const response = await apiClient.put<any>(`/admin/onboarding-fields/${selectedRole}/${fieldId}`, updates);

      if (response.success) {
        // Reload form for this role
        await loadFormForRole(selectedRole);
        setEditingField(null);
      } else {
        alert('Failed to update field. Please try again.');
      }
    } catch (error: any) {
      console.error('Error updating field:', error);
      alert(`Failed to update field: ${error.message || 'Unknown error'}`);
    }
  };

  const deleteField = async (sectionId: string, fieldId: string) => {
    if (!confirm('Are you sure you want to delete this field?')) return;
    if (!selectedRole) {
      alert('Please select a role first');
      return;
    }

    try {
      // Delete field via API
      const response = await apiClient.delete<any>(`/admin/onboarding-fields/${selectedRole}/${fieldId}`);

      if (response.success) {
        // Reload form for this role
        await loadFormForRole(selectedRole);
      } else {
        alert('Failed to delete field. Please try again.');
      }
    } catch (error: any) {
      console.error('Error deleting field:', error);
      alert(`Failed to delete field: ${error.message || 'Unknown error'}`);
    }
  };

  const moveField = async (sectionId: string, fieldId: string, direction: 'up' | 'down') => {
    if (!selectedRole) {
      alert('Please select a role first');
      return;
    }

    // Find current section and field
    const section = sections.find(s => s.id === sectionId);
    if (!section) return;

    const fieldIndex = section.fields.findIndex(f => f.id === fieldId);
    if (fieldIndex === -1) return;

    const newIndex = direction === 'up' ? fieldIndex - 1 : fieldIndex + 1;
    if (newIndex < 0 || newIndex >= section.fields.length) return;

    // Calculate new display orders for all fields in the section
    const allFields = section.fields.map((f, idx) => ({
      fieldId: f.id,
      displayOrder: idx === newIndex ? fieldIndex : (idx === fieldIndex ? newIndex : idx),
    }));

    try {
      // Reorder fields via API
      const response = await apiClient.put<any>(`/admin/onboarding-fields/${selectedRole}/reorder`, {
        fieldOrders: allFields,
      });

      if (response.success) {
        // Reload form for this role
        await loadFormForRole(selectedRole);
      } else {
        alert('Failed to reorder fields. Please try again.');
      }
    } catch (error: any) {
      console.error('Error reordering fields:', error);
      alert(`Failed to reorder fields: ${error.message || 'Unknown error'}`);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
        <p className="ml-2 text-gray-600">Loading form designer...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 bg-white p-6 rounded-lg">
      {/* Header */}
      <div className="flex items-center justify-between bg-white pb-4 border-b border-gray-200">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-100 rounded-xl">
            <Layers className="w-6 h-6 text-indigo-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Onboarding Form Designer</h1>
            <p className="text-sm text-gray-600">Design custom vendor onboarding forms</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Label>Form Status:</Label>
            <Switch
              checked={formEnabled}
              onCheckedChange={setFormEnabled}
            />
            <Badge variant={formEnabled ? "default" : "secondary"}>
              {formEnabled ? 'Enabled' : 'Disabled'}
            </Badge>
          </div>
          <Button
            onClick={handleSave}
            disabled={saving}
            className="bg-primary hover:bg-primary-dark"
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                Save Form
              </>
            )}
          </Button>
          <Button
            onClick={handleKYCMigration}
            disabled={migratingKYC}
            variant="outline"
            className="border-indigo-500 text-indigo-600 hover:bg-indigo-50"
          >
            {migratingKYC ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Migrating...
              </>
            ) : (
              <>
                <Shield className="w-4 h-4 mr-2" />
                Add KYC Fields
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Role Selector */}
      <Card className="bg-white border border-gray-300">
        <CardContent className="p-4 bg-white">
          <div className="flex items-center gap-4">
            <Label className="font-medium text-gray-900">Currently:</Label>
            <select
              value={selectedRole}
              onChange={async (e: React.ChangeEvent<HTMLSelectElement>) => {
                const newRole = e.target.value;
                setSelectedRole(newRole);
                if (newRole) {
                  await loadFormForRole(newRole);
                }
              }}
              className="w-64 h-9 px-3 py-2 text-sm border border-gray-300 rounded-md bg-white text-gray-900"
            >
              <option value="">Select Role</option>
              {roles.map(role => (
                <option key={role.id} value={role.code}>
                  {role.name} (ID: {role.code})
                </option>
              ))}
            </select>
            {selectedRole && (
              <Badge variant="outline">
                {roles.find(r => r.code === selectedRole)?.name || selectedRole}
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Form Sections */}
      <div className="space-y-4">
        {sections.map((section) => (
          <Card key={section.id} className="border-2">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900">{section.title}</h2>
                <Button
                  onClick={() => addField(section.id)}
                  variant="outline"
                  size="sm"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Field
                </Button>
              </div>

              <div className="space-y-3">
                {section.fields.sort((a, b) => a.order - b.order).map((field, idx) => (
                  <div
                    key={field.id}
                    className="flex items-center gap-3 p-3 border border-gray-300 rounded-lg bg-white hover:bg-gray-50 transition text-gray-900"
                  >
                    <GripVertical className="w-5 h-5 text-gray-400 cursor-move" />
                    <div className="flex-1 grid grid-cols-12 gap-3 items-center">
                      <div className="col-span-3">
                        <span className="font-medium text-gray-900">{field.label}</span>
                        {field.required && (
                          <Badge variant="outline" className="ml-2 text-xs">Required</Badge>
                        )}
                      </div>
                      <div className="col-span-2">
                        <Badge variant="outline">{field.type}</Badge>
                      </div>
                      <div className="col-span-5 text-sm text-gray-600">
                        {field.placeholder || 'No placeholder'}
                      </div>
                      <div className="col-span-2 flex items-center justify-end gap-2">
                        {idx > 0 && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => moveField(section.id, field.id, 'up')}
                          >
                            ↑
                          </Button>
                        )}
                        {idx < section.fields.length - 1 && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => moveField(section.id, field.id, 'down')}
                          >
                            ↓
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setEditingField(field)}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteField(section.id, field.id)}
                        >
                          <Trash2 className="w-4 h-4 text-red-600" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Field Edit Modal */}
      {editingField && (
        <FieldEditModal
          field={editingField}
          onSave={(updates) => {
            const section = sections.find(s => s.fields.some(f => f.id === editingField.id));
            if (section) {
              updateField(section.id, editingField.id, updates);
            }
          }}
          onClose={() => setEditingField(null)}
        />
      )}
    </div>
  );
}

function FieldEditModal({
  field,
  onSave,
  onClose,
}: {
  field: FormField;
  onSave: (updates: Partial<FormField>) => void;
  onClose: () => void;
}) {
  const [formData, setFormData] = useState(field);
  // Sync when field prop changes (e.g. after reload so placeholder/label reflect saved values)
  useEffect(() => {
    setFormData(field);
  }, [field.id, field.placeholder, field.label, field.helpText]);

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <Card className="max-w-2xl w-full max-h-[90vh] overflow-y-auto bg-white border border-gray-300">
        <CardContent className="p-6 space-y-4 bg-white">
          <div className="flex items-center justify-between mb-4 border-b border-gray-200 pb-4">
            <h3 className="text-lg font-semibold text-gray-900">Edit Field</h3>
            <Button variant="ghost" size="sm" onClick={onClose} className="text-gray-900 hover:bg-gray-100">
              <X className="w-4 h-4" />
            </Button>
          </div>

          <div>
            <Label className="text-gray-900 font-medium">Field Label *</Label>
            <Input
              value={formData.label}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, label: e.target.value })}
              placeholder="e.g., Business Name"
              className="bg-white border-gray-300 text-gray-900"
            />
          </div>

          <div>
            <Label className="text-gray-900 font-medium">Field Type *</Label>
            <select
              value={formData.type}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setFormData({ ...formData, type: e.target.value as any })}
              className="w-full h-9 px-3 py-2 text-sm border border-gray-300 rounded-md bg-white text-gray-900"
            >
              <option value="text">Text</option>
              <option value="email">Email</option>
              <option value="tel">Phone</option>
              <option value="textarea">Textarea</option>
              <option value="select">Select</option>
              <option value="checkbox">Checkbox</option>
              <option value="file">File Upload</option>
              <optgroup label="KYC Verification">
                <option value="aadhaar-otp">Aadhaar (OTP Verification)</option>
                <option value="pan-verify">PAN (Auto-Verify)</option>
                <option value="gst-verify">GST (Auto-Verify)</option>
                <option value="declaration">Declaration/Consent</option>
              </optgroup>
            </select>
          </div>

          <div>
            <Label className="text-gray-900 font-medium">Placeholder</Label>
            <Input
              value={formData.placeholder || ''}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, placeholder: e.target.value })}
              placeholder="Enter placeholder text"
              className="bg-white border-gray-300 text-gray-900"
            />
          </div>

          {formData.type === 'select' && (
            <div>
              <Label>Options (comma-separated)</Label>
              <Textarea
                value={formData.options?.join(', ') || ''}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setFormData({
                  ...formData,
                  options: e.target.value.split(',').map(o => o.trim()).filter(Boolean),
                })}
                placeholder="Option 1, Option 2, Option 3"
                rows={3}
              />
            </div>
          )}

          {formData.type === 'declaration' && (
            <div>
              <Label className="text-gray-900 font-medium">Declaration Text *</Label>
              <Textarea
                value={formData.declarationText || ''}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setFormData({ ...formData, declarationText: e.target.value })}
                placeholder="Enter the declaration text that vendors must agree to..."
                rows={4}
                className="bg-white border-gray-300 text-gray-900"
              />
              <p className="text-xs text-gray-500 mt-1">
                This text will be displayed as a consent checkbox. Vendors must check it to proceed.
              </p>
            </div>
          )}

          {['aadhaar-otp', 'pan-verify', 'gst-verify'].includes(formData.type) && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm">
              <p className="font-medium text-blue-800">KYC Verification Field</p>
              <p className="text-blue-700 mt-1">
                {formData.type === 'aadhaar-otp' && 'Vendors will enter Aadhaar and verify via OTP sent to their registered mobile.'}
                {formData.type === 'pan-verify' && 'PAN number will be automatically verified against government database.'}
                {formData.type === 'gst-verify' && 'GST number will be automatically verified and business details fetched.'}
              </p>
            </div>
          )}

          <div className="flex items-center gap-2">
            <Switch
              checked={formData.required}
              onCheckedChange={(checked: boolean) => setFormData({ ...formData, required: checked })}
            />
            <Label className="text-gray-900">Required Field</Label>
          </div>

          <div className="flex gap-2 pt-4 border-t border-gray-200">
            <Button onClick={onClose} variant="outline" className="flex-1 border-gray-300 text-gray-900 hover:bg-gray-100">
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (!formData.label) {
                  alert('Field label is required');
                  return;
                }
                onSave(formData);
              }}
              className="flex-1 bg-primary hover:bg-primary-dark text-white"
            >
              <Check className="w-4 h-4 mr-2" />
              Save Field
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
