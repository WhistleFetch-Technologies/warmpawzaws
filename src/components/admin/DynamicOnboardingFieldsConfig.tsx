import { useState, useEffect } from 'react';
import { Plus, Trash2, Save, Edit2, Eye, FileText, CheckCircle, XCircle } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../ui/dialog';
import { Checkbox } from '../ui/checkbox';
import { projectId, publicAnonKey } from '../../utils/supabase/info';
import { toast } from 'sonner@2.0.3';

interface CustomField {
  id: string;
  fieldName: string;
  fieldLabel: string;
  fieldType: 'text' | 'number' | 'email' | 'tel' | 'textarea' | 'select' | 'document';
  isMandatory: boolean;
  requiresDocument: boolean;
  documentLabel?: string;
  selectOptions?: string[]; // For select type
  placeholder?: string;
  validationRules?: {
    minLength?: number;
    maxLength?: number;
    pattern?: string;
  };
  order: number;
  roleId: string;
}

interface Role {
  id: string;
  name: string;
  displayName: string;
  description: string;
}

interface DynamicOnboardingFieldsConfigProps {
  roleId?: string;
}

export function DynamicOnboardingFieldsConfig({ roleId: initialRoleId }: DynamicOnboardingFieldsConfigProps) {
  const [roles, setRoles] = useState<Role[]>([]);
  const [selectedRole, setSelectedRole] = useState<string>(initialRoleId || '');
  const [customFields, setCustomFields] = useState<CustomField[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showAddFieldModal, setShowAddFieldModal] = useState(false);
  const [editingField, setEditingField] = useState<CustomField | null>(null);
  
  // Form state for new/edit field
  const [fieldName, setFieldName] = useState('');
  const [fieldLabel, setFieldLabel] = useState('');
  const [fieldType, setFieldType] = useState<CustomField['fieldType']>('text');
  const [isMandatory, setIsMandatory] = useState(false);
  const [requiresDocument, setRequiresDocument] = useState(false);
  const [documentLabel, setDocumentLabel] = useState('');
  const [selectOptions, setSelectOptions] = useState('');
  const [placeholder, setPlaceholder] = useState('');

  useEffect(() => {
    fetchRoles();
  }, []);

  useEffect(() => {
    if (selectedRole) {
      fetchCustomFields(selectedRole);
    }
  }, [selectedRole]);

  const fetchRoles = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/config/roles`,
        {
          headers: { 'Authorization': `Bearer ${publicAnonKey}` }
        }
      );

      if (response.ok) {
        const data = await response.json();
        setRoles(data.roles || []);
        if (!selectedRole && data.roles && data.roles.length > 0) {
          setSelectedRole(data.roles[0].id);
        }
      }
    } catch (error) {
      console.error('Error fetching roles:', error);
      toast.error('Failed to load roles');
    } finally {
      setLoading(false);
    }
  };

  const fetchCustomFields = async (roleId: string) => {
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/admin/onboarding-fields/${roleId}`,
        {
          headers: { 'Authorization': `Bearer ${publicAnonKey}` }
        }
      );

      if (response.ok) {
        const data = await response.json();
        setCustomFields(data.fields || []);
      }
    } catch (error) {
      console.error('Error fetching custom fields:', error);
      toast.error('Failed to load custom fields');
    }
  };

  const resetFieldForm = () => {
    setFieldName('');
    setFieldLabel('');
    setFieldType('text');
    setIsMandatory(false);
    setRequiresDocument(false);
    setDocumentLabel('');
    setSelectOptions('');
    setPlaceholder('');
    setEditingField(null);
  };

  const openAddFieldModal = () => {
    resetFieldForm();
    setShowAddFieldModal(true);
  };

  const openEditFieldModal = (field: CustomField) => {
    setEditingField(field);
    setFieldName(field.fieldName);
    setFieldLabel(field.fieldLabel);
    setFieldType(field.fieldType);
    setIsMandatory(field.isMandatory);
    setRequiresDocument(field.requiresDocument);
    setDocumentLabel(field.documentLabel || '');
    setSelectOptions(field.selectOptions?.join(', ') || '');
    setPlaceholder(field.placeholder || '');
    setShowAddFieldModal(true);
  };

  const saveField = async () => {
    if (!fieldName || !fieldLabel) {
      toast.error('Field name and label are required');
      return;
    }

    // Convert fieldName to snake_case for DB compatibility
    const dbFieldName = fieldName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');

    const newField: CustomField = {
      id: editingField?.id || `custom_${Date.now()}`,
      fieldName: dbFieldName,
      fieldLabel,
      fieldType,
      isMandatory,
      requiresDocument,
      documentLabel: requiresDocument ? documentLabel : undefined,
      selectOptions: fieldType === 'select' ? selectOptions.split(',').map(o => o.trim()).filter(o => o) : undefined,
      placeholder,
      order: editingField?.order || customFields.length,
      roleId: selectedRole
    };

    try {
      setSaving(true);
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/admin/onboarding-fields/${selectedRole}`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            field: newField,
            action: editingField ? 'update' : 'create'
          })
        }
      );

      if (response.ok) {
        toast.success(editingField ? 'Field updated successfully' : 'Field created successfully');
        setShowAddFieldModal(false);
        resetFieldForm();
        fetchCustomFields(selectedRole);
      } else {
        const error = await response.json();
        toast.error(error.message || 'Failed to save field');
      }
    } catch (error) {
      console.error('Error saving field:', error);
      toast.error('Failed to save field');
    } finally {
      setSaving(false);
    }
  };

  const deleteField = async (fieldId: string) => {
    if (!confirm('Are you sure you want to delete this field? This cannot be undone.')) {
      return;
    }

    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/admin/onboarding-fields/${selectedRole}/${fieldId}`,
        {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${publicAnonKey}` }
        }
      );

      if (response.ok) {
        toast.success('Field deleted successfully');
        fetchCustomFields(selectedRole);
      } else {
        toast.error('Failed to delete field');
      }
    } catch (error) {
      console.error('Error deleting field:', error);
      toast.error('Failed to delete field');
    }
  };

  const reorderFields = async (fromIndex: number, toIndex: number) => {
    const reorderedFields = [...customFields];
    const [movedField] = reorderedFields.splice(fromIndex, 1);
    reorderedFields.splice(toIndex, 0, movedField);
    
    // Update order property
    const updatedFields = reorderedFields.map((field, index) => ({
      ...field,
      order: index
    }));

    setCustomFields(updatedFields);

    try {
      await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/admin/onboarding-fields/${selectedRole}/reorder`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ fields: updatedFields })
        }
      );
    } catch (error) {
      console.error('Error reordering fields:', error);
      toast.error('Failed to save field order');
    }
  };

  const selectedRoleData = roles.find(r => r.id === selectedRole);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-[#FF8C42] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading configuration...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Dynamic Onboarding Fields</h3>
          <p className="text-sm text-gray-600">Configure custom fields for vendor onboarding forms</p>
        </div>
      </div>

      {/* Role Selector */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <Label>Select Vendor Role</Label>
        <Select value={selectedRole} onValueChange={setSelectedRole}>
          <SelectTrigger className="mt-2">
            <SelectValue placeholder="Choose a role" />
          </SelectTrigger>
          <SelectContent>
            {roles.map((role) => (
              <SelectItem key={role.id} value={role.id}>
                {role.displayName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {selectedRoleData && (
          <p className="text-sm text-gray-500 mt-2">{selectedRoleData.description}</p>
        )}
      </div>

      {/* Custom Fields List */}
      {selectedRole && (
        <div className="bg-white rounded-xl border border-gray-200">
          <div className="p-6 border-b border-gray-200 flex items-center justify-between">
            <div>
              <h4 className="font-semibold text-gray-900">Custom Fields for {selectedRoleData?.displayName}</h4>
              <p className="text-sm text-gray-600">Add or modify custom fields for this role's onboarding form</p>
            </div>
            <Button onClick={openAddFieldModal} className="bg-[#FF8C42] hover:bg-[#FF8C42]/90">
              <Plus className="w-4 h-4 mr-2" />
              Add Field
            </Button>
          </div>

          <div className="p-6">
            {customFields.length === 0 ? (
              <div className="text-center py-12">
                <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500 mb-4">No custom fields configured yet</p>
                <Button onClick={openAddFieldModal} variant="outline">
                  <Plus className="w-4 h-4 mr-2" />
                  Add First Field
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {customFields.sort((a, b) => a.order - b.order).map((field, index) => (
                  <div
                    key={field.id}
                    className="border border-gray-200 rounded-lg p-4 hover:border-[#FF8C42] transition-all"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <span className="font-semibold text-gray-900">{field.fieldLabel}</span>
                          <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">
                            {field.fieldType}
                          </span>
                          {field.isMandatory && (
                            <span className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded flex items-center gap-1">
                              <CheckCircle className="w-3 h-3" />
                              Mandatory
                            </span>
                          )}
                          {field.requiresDocument && (
                            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded flex items-center gap-1">
                              <FileText className="w-3 h-3" />
                              Document Required
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-600">
                          Field name: <code className="bg-gray-100 px-2 py-0.5 rounded text-xs">{field.fieldName}</code>
                        </p>
                        {field.placeholder && (
                          <p className="text-sm text-gray-500 mt-1">
                            Placeholder: "{field.placeholder}"
                          </p>
                        )}
                        {field.selectOptions && (
                          <p className="text-sm text-gray-500 mt-1">
                            Options: {field.selectOptions.join(', ')}
                          </p>
                        )}
                        {field.requiresDocument && field.documentLabel && (
                          <p className="text-sm text-blue-600 mt-1">
                            Document: {field.documentLabel}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEditFieldModal(field)}
                        >
                          <Edit2 className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteField(field.id)}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Add/Edit Field Modal */}
      <Dialog open={showAddFieldModal} onOpenChange={setShowAddFieldModal}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingField ? 'Edit Field' : 'Add Custom Field'}</DialogTitle>
            <DialogDescription>
              Configure a custom field for the {selectedRoleData?.displayName} onboarding form
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 mt-4">
            {/* Field Label */}
            <div>
              <Label>Field Label *</Label>
              <Input
                value={fieldLabel}
                onChange={(e) => setFieldLabel(e.target.value)}
                placeholder="e.g., Certification Number"
                className="mt-2"
              />
              <p className="text-xs text-gray-500 mt-1">This is what users will see on the form</p>
            </div>

            {/* Field Name (DB) */}
            <div>
              <Label>Field Name (Database) *</Label>
              <Input
                value={fieldName}
                onChange={(e) => setFieldName(e.target.value)}
                placeholder="e.g., certification_number"
                className="mt-2"
              />
              <p className="text-xs text-gray-500 mt-1">
                Auto-converted to snake_case. Will be stored as: {fieldName ? fieldName.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') : 'field_name'}
              </p>
            </div>

            {/* Field Type */}
            <div>
              <Label>Field Type *</Label>
              <Select value={fieldType} onValueChange={(val) => setFieldType(val as CustomField['fieldType'])}>
                <SelectTrigger className="mt-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="text">Text</SelectItem>
                  <SelectItem value="number">Number</SelectItem>
                  <SelectItem value="email">Email</SelectItem>
                  <SelectItem value="tel">Phone</SelectItem>
                  <SelectItem value="textarea">Textarea</SelectItem>
                  <SelectItem value="select">Dropdown Select</SelectItem>
                  <SelectItem value="document">Document Upload Only</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Select Options (only for select type) */}
            {fieldType === 'select' && (
              <div>
                <Label>Dropdown Options *</Label>
                <Input
                  value={selectOptions}
                  onChange={(e) => setSelectOptions(e.target.value)}
                  placeholder="Option 1, Option 2, Option 3"
                  className="mt-2"
                />
                <p className="text-xs text-gray-500 mt-1">Separate options with commas</p>
              </div>
            )}

            {/* Placeholder */}
            {fieldType !== 'document' && (
              <div>
                <Label>Placeholder Text</Label>
                <Input
                  value={placeholder}
                  onChange={(e) => setPlaceholder(e.target.value)}
                  placeholder="Enter placeholder text..."
                  className="mt-2"
                />
              </div>
            )}

            {/* Mandatory Checkbox */}
            <div className="flex items-center space-x-2 p-4 bg-gray-50 rounded-lg">
              <Checkbox
                id="mandatory"
                checked={isMandatory}
                onCheckedChange={(checked) => setIsMandatory(checked as boolean)}
              />
              <div className="flex-1">
                <Label htmlFor="mandatory" className="cursor-pointer">
                  This field is mandatory
                </Label>
                <p className="text-xs text-gray-500">Users must fill this field to submit the form</p>
              </div>
            </div>

            {/* Document Upload Checkbox */}
            <div className="flex items-center space-x-2 p-4 bg-blue-50 rounded-lg border border-blue-200">
              <Checkbox
                id="document"
                checked={requiresDocument}
                onCheckedChange={(checked) => setRequiresDocument(checked as boolean)}
              />
              <div className="flex-1">
                <Label htmlFor="document" className="cursor-pointer">
                  Requires document upload
                </Label>
                <p className="text-xs text-gray-500">Add a document upload field for this data</p>
              </div>
            </div>

            {/* Document Label (if document required) */}
            {requiresDocument && (
              <div className="ml-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
                <Label>Document Upload Label *</Label>
                <Input
                  value={documentLabel}
                  onChange={(e) => setDocumentLabel(e.target.value)}
                  placeholder="e.g., Upload Certification Document"
                  className="mt-2"
                />
                <p className="text-xs text-gray-500 mt-1">Label for the document upload section</p>
              </div>
            )}
          </div>

          {/* Modal Actions */}
          <div className="flex justify-end gap-3 mt-6 pt-6 border-t">
            <Button variant="outline" onClick={() => setShowAddFieldModal(false)}>
              Cancel
            </Button>
            <Button 
              onClick={saveField} 
              disabled={saving || !fieldName || !fieldLabel}
              className="bg-[#FF8C42] hover:bg-[#FF8C42]/90"
            >
              {saving ? 'Saving...' : editingField ? 'Update Field' : 'Add Field'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
