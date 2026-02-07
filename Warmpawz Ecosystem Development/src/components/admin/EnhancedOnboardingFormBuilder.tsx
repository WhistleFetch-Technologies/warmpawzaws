import { useState, useEffect } from 'react';
import {
  Plus,
  Trash2,
  Save,
  Edit2,
  Eye,
  FileText,
  CheckCircle,
  XCircle,
  Settings,
  Building,
  MapPin,
  ArrowUp,
  ArrowDown,
  Copy,
  AlertCircle,
  Upload,
  X
} from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../ui/dialog';
import { Checkbox } from '../ui/checkbox';
import { Textarea } from '../ui/textarea';
import { Switch } from '../ui/switch';
import { Badge } from '../ui/badge';
import { getApiBaseUrl, getAuthHeaders } from '../../utils/api-config';
import { toast } from 'sonner@2.0.3';

interface FieldValidation {
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  min?: number;
  max?: number;
  customMessage?: string;
}

interface SelectOption {
  value: string;
  label: string;
}

interface FormField {
  id: string;
  name: string;
  label: string;
  type: 'text' | 'number' | 'email' | 'tel' | 'textarea' | 'select' | 'multiselect' | 'checkbox' | 'radio' | 'date' | 'file';
  section: 'business_information' | 'address_location' | 'documents' | 'custom';
  placeholder?: string;
  helpText?: string;
  validation?: FieldValidation;
  options?: SelectOption[];
  requiresDocument?: boolean;
  documentType?: string;
  documentLabel?: string;
  acceptedFileTypes?: string[];
  maxFileSize?: number;
  order: number;
  isActive: boolean;
}

interface FormSection {
  id: string;
  name: string;
  title: string;
  description?: string;
  icon?: string;
  order: number;
  isActive: boolean;
  fields: FormField[];
}

interface OnboardingForm {
  id: string;
  roleId: string;
  roleName: string;
  version: number;
  status: 'draft' | 'active' | 'archived';
  sections: FormSection[];
  documentSections: FormSection[];
  metadata: {
    createdBy: string;
    createdAt: string;
    lastModifiedBy?: string;
    lastModifiedAt?: string;
  };
  notes?: string;
}

interface Role {
  id: string;
  name: string;
  displayName: string;
}

export function EnhancedOnboardingFormBuilder() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [selectedRole, setSelectedRole] = useState<string>('');
  const [form, setForm] = useState<OnboardingForm | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  
  // Modal states
  const [showFieldModal, setShowFieldModal] = useState(false);
  const [showSectionModal, setShowSectionModal] = useState(false);
  const [editingField, setEditingField] = useState<FormField | null>(null);
  const [editingSection, setEditingSection] = useState<FormSection | null>(null);
  const [currentSection, setCurrentSection] = useState<string>('');
  
  // Field form state
  const [fieldForm, setFieldForm] = useState<Partial<FormField>>({
    name: '',
    label: '',
    type: 'text',
    section: 'business_information',
    placeholder: '',
    helpText: '',
    validation: { required: false },
    requiresDocument: false,
    isActive: true,
    order: 0
  });
  
  // Section form state
  const [sectionForm, setSectionForm] = useState<Partial<FormSection>>({
    name: '',
    title: '',
    description: '',
    icon: 'Building',
    order: 0,
    isActive: true,
    fields: []
  });

  const API_BASE = getApiBaseUrl();

  useEffect(() => {
    fetchRoles();
  }, []);

  useEffect(() => {
    if (selectedRole) {
      fetchForm(selectedRole);
    }
  }, [selectedRole]);

  const fetchRoles = async () => {
    try {
      console.log('[FETCH ROLES] Fetching from:', `${API_BASE}/config/roles`);
      const response = await fetch(`${API_BASE}/config/roles`, {
        headers: getAuthHeaders()
      });

      console.log('[FETCH ROLES] Response status:', response.status);

      if (response.ok) {
        const data = await response.json();
        console.log('[FETCH ROLES] ✅ Data received:', data);
        
        // Deduplicate roles by ID
        const uniqueRolesMap = new Map();
        (data.roles || []).forEach((role: Role) => {
          if (!uniqueRolesMap.has(role.id)) {
             uniqueRolesMap.set(role.id, role);
          }
        });
        const uniqueRoles = Array.from(uniqueRolesMap.values());
        
        setRoles(uniqueRoles);
        if (uniqueRoles.length > 0 && !selectedRole) {
          setSelectedRole(uniqueRoles[0].id);
        }
      } else {
        const errorText = await response.text();
        console.error('[FETCH ROLES] ❌ Error response:', errorText);
        toast.error(`Failed to load roles: ${response.status}`);
      }
    } catch (error) {
      console.error('[FETCH ROLES] ❌ Exception:', error);
      toast.error(`Failed to load roles: ${error.message}`);
    }
  };

  const fetchForm = async (roleId: string) => {
    try {
      setLoading(true);
      
      console.log('[FETCH FORM] Fetching from:', `${API_BASE}/admin/onboarding-forms/${roleId}`);
      const response = await fetch(`${API_BASE}/admin/onboarding-forms/${roleId}`, {
        headers: getAuthHeaders()
      });

      console.log('[FETCH FORM] Response status:', response.status);

      if (response.ok) {
        const data = await response.json();
        console.log('[FETCH FORM] ✅ Data received:', data);
        
        // If new form, add default sections
        if (data.isNew) {
          const defaultForm: OnboardingForm = {
            ...data.form,
            sections: [
              {
                id: 'business_information',
                name: 'business_information',
                title: 'Business Information',
                description: 'Basic business and owner details',
                icon: 'Building',
                order: 1,
                isActive: true,
                fields: []
              },
              {
                id: 'address_location',
                name: 'address_location',
                title: 'Address & Location',
                description: 'Business address and location information',
                icon: 'MapPin',
                order: 2,
                isActive: true,
                fields: []
              }
            ]
          };
          setForm(defaultForm);
        } else {
          setForm(data.form);
        }
      }
    } catch (error) {
      console.error('[FETCH FORM] Error:', error);
      toast.error('Failed to load form');
    } finally {
      setLoading(false);
    }
  };

  const saveForm = async (status?: 'draft' | 'active') => {
    if (!form) return;

    try {
      setSaving(true);
      
      const response = await fetch(`${API_BASE}/admin/onboarding-forms/${selectedRole}`, {
        method: 'POST',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          sections: form.sections,
          status: status || form.status,
          notes: form.notes,
          adminName: 'Admin' // TODO: Get from session
        })
      });

      if (response.ok) {
        const data = await response.json();
        setForm(data.form);
        toast.success(data.message || 'Form saved successfully');
        
        // Reload form to get updated document sections
        await fetchForm(selectedRole);
      } else {
        throw new Error('Failed to save form');
      }
    } catch (error) {
      console.error('[SAVE FORM] Error:', error);
      toast.error('Failed to save form');
    } finally {
      setSaving(false);
    }
  };

  const handleBulkMigration = async () => {
    if (!confirm('This will migrate all existing roles to the enhanced form system. Continue?')) {
      return;
    }

    try {
      setLoading(true);
      toast('Starting bulk migration...');
      
      const response = await fetch(`${API_BASE}/admin/onboarding-forms/migrate-all`, {
        method: 'POST',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        console.log('[BULK MIGRATE] Results:', data);
        
        toast.success(`Migration complete! ${data.summary.migrated} roles migrated, ${data.summary.skipped} skipped`);
        
        // Reload current form
        if (selectedRole) {
          await fetchForm(selectedRole);
        }
      } else {
        const errorText = await response.text();
        console.error('[BULK MIGRATE] Server error:', errorText);
        throw new Error(`Failed to migrate: ${errorText}`);
      }
    } catch (error) {
      console.error('[BULK MIGRATE] Error:', error);
      toast.error('Migration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const openAddFieldModal = (sectionId: string) => {
    setCurrentSection(sectionId);
    setEditingField(null);
    setFieldForm({
      name: '',
      label: '',
      type: 'text',
      section: sectionId as any,
      placeholder: '',
      helpText: '',
      validation: { required: false },
      requiresDocument: false,
      isActive: true,
      order: 0
    });
    setShowFieldModal(true);
  };

  const openEditFieldModal = (field: FormField, sectionId: string) => {
    setCurrentSection(sectionId);
    setEditingField(field);
    setFieldForm(field);
    setShowFieldModal(true);
  };

  const saveField = () => {
    if (!form) return;
    
    const fieldId = editingField?.id || `field_${Date.now()}`;
    const newField: FormField = {
      ...fieldForm,
      id: fieldId,
      name: fieldForm.name!,
      label: fieldForm.label!,
      type: fieldForm.type!,
      section: fieldForm.section!,
      order: fieldForm.order || 0,
      isActive: fieldForm.isActive !== false
    } as FormField;

    const updatedSections = form.sections.map(section => {
      if (section.id === currentSection) {
        if (editingField) {
          // Update existing field
          return {
            ...section,
            fields: section.fields.map(f => f.id === fieldId ? newField : f)
          };
        } else {
          // Add new field
          return {
            ...section,
            fields: [...section.fields, newField]
          };
        }
      }
      return section;
    });

    setForm({ ...form, sections: updatedSections });
    setShowFieldModal(false);
    toast.success(editingField ? 'Field updated' : 'Field added');
  };

  const deleteField = (sectionId: string, fieldId: string) => {
    if (!form) return;
    
    if (!confirm('Are you sure you want to delete this field?')) return;

    const updatedSections = form.sections.map(section => {
      if (section.id === sectionId) {
        return {
          ...section,
          fields: section.fields.filter(f => f.id !== fieldId)
        };
      }
      return section;
    });

    setForm({ ...form, sections: updatedSections });
    toast.success('Field deleted');
  };

  const moveField = (sectionId: string, fieldId: string, direction: 'up' | 'down') => {
    if (!form) return;

    const updatedSections = form.sections.map(section => {
      if (section.id === sectionId) {
        const fields = [...section.fields];
        const index = fields.findIndex(f => f.id === fieldId);
        
        if (direction === 'up' && index > 0) {
          [fields[index], fields[index - 1]] = [fields[index - 1], fields[index]];
        } else if (direction === 'down' && index < fields.length - 1) {
          [fields[index], fields[index + 1]] = [fields[index + 1], fields[index]];
        }
        
        // Update order
        fields.forEach((f, i) => f.order = i);
        
        return { ...section, fields };
      }
      return section;
    });

    setForm({ ...form, sections: updatedSections });
  };

  const addSection = () => {
    if (!form) return;
    
    const newSection: FormSection = {
      id: `section_${Date.now()}`,
      name: sectionForm.name || `section_${Date.now()}`,
      title: sectionForm.title || 'New Section',
      description: sectionForm.description,
      icon: sectionForm.icon || 'Settings',
      order: form.sections.length + 1,
      isActive: true,
      fields: []
    };

    setForm({
      ...form,
      sections: [...form.sections, newSection]
    });

    setShowSectionModal(false);
    setSectionForm({
      name: '',
      title: '',
      description: '',
      icon: 'Building',
      order: 0,
      isActive: true,
      fields: []
    });
    
    toast.success('Section added');
  };

  const deleteSection = (sectionId: string) => {
    if (!form) return;
    
    const section = form.sections.find(s => s.id === sectionId);
    if (section && section.fields.length > 0) {
      if (!confirm(`This section has ${section.fields.length} field(s). Are you sure you want to delete it?`)) {
        return;
      }
    }

    const updatedSections = form.sections.filter(s => s.id !== sectionId);
    setForm({ ...form, sections: updatedSections });
    toast.success('Section deleted');
  };

  const duplicateField = (sectionId: string, field: FormField) => {
    if (!form) return;

    const newField: FormField = {
      ...field,
      id: `field_${Date.now()}`,
      name: `${field.name}_copy`,
      label: `${field.label} (Copy)`,
      order: field.order + 1
    };

    const updatedSections = form.sections.map(section => {
      if (section.id === sectionId) {
        return {
          ...section,
          fields: [...section.fields, newField]
        };
      }
      return section;
    });

    setForm({ ...form, sections: updatedSections });
    toast.success('Field duplicated');
  };

  const getFieldTypeIcon = (type: string) => {
    switch (type) {
      case 'text': return '📝';
      case 'number': return '🔢';
      case 'email': return '📧';
      case 'tel': return '📞';
      case 'textarea': return '📄';
      case 'select': return '📋';
      case 'checkbox': return '☑️';
      case 'radio': return '🔘';
      case 'date': return '📅';
      case 'file': return '📎';
      default: return '📝';
    }
  };

  const selectedRoleData = roles.find(r => r.id === selectedRole);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FF8C42] mx-auto mb-4"></div>
          <p className="text-gray-600">Loading form builder...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-bold text-gray-900">Onboarding Form Designer</h3>
          <p className="text-sm text-gray-600">
            Design and configure vendor onboarding forms - add fields, set validation, manage documents
          </p>
        </div>
        
        <div className="flex gap-2">
          <Button
            onClick={() => saveForm('draft')}
            disabled={saving || !form}
            variant="outline"
            className="border-gray-300"
          >
            <Save className="w-4 h-4 mr-2" />
            Save Draft
          </Button>
          <Button
            onClick={() => saveForm('active')}
            disabled={saving || !form}
            className="bg-[#FF8C42] hover:bg-[#FF7A29]"
          >
            <CheckCircle className="w-4 h-4 mr-2" />
            Publish Form
          </Button>
        </div>
      </div>

      {/* Info Banner */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <h4 className="font-semibold text-blue-900 mb-1">Form Designer Instructions</h4>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• Click <strong>"Add Field"</strong> on any section to add a new field to the vendor onboarding form</li>
              <li>• Configure field type, validation rules, and whether it requires document upload</li>
              <li>• Fields marked "Requires Document" will auto-generate a document upload section</li>
              <li>• <strong>"Save Draft"</strong> saves your design without making it live</li>
              <li>• <strong>"Publish Form"</strong> makes your form design live for all new vendor applications</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Role Selection */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <Label>Select Vendor Role</Label>
            <Select value={selectedRole} onValueChange={setSelectedRole}>
              <SelectTrigger>
                <SelectValue placeholder="Select a role" />
              </SelectTrigger>
              <SelectContent>
                {roles.map(role => (
                  <SelectItem key={role.id} value={role.id}>
                    {role.displayName || role.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
              {form && (
            <div>
              <Label>Form Status</Label>
              <div className="mt-2">
                <Badge
                  className={
                    form.status === 'active'
                      ? 'bg-green-100 text-green-800'
                      : form.status === 'draft'
                      ? 'bg-yellow-100 text-yellow-800'
                      : 'bg-gray-100 text-gray-800'
                  }
                >
                  {form.status ? form.status.toUpperCase() : 'UNKNOWN'}
                </Badge>
                <span className="ml-3 text-sm text-gray-600">
                  Version {form.version}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Bulk Migration Button */}
        <div className="border-t pt-4">
          <Button
            onClick={handleBulkMigration}
            disabled={loading}
            variant="outline"
            className="w-full"
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-[#FF8C42] mr-2" />
                Migrating all roles...
              </>
            ) : (
              <>
                <Upload className="w-4 h-4 mr-2" />
                Migrate All Roles to Enhanced Forms
              </>
            )}
          </Button>
          <p className="text-xs text-gray-500 mt-2 text-center">
            This will auto-migrate all existing roles to the new enhanced form system
          </p>
        </div>
      </div>

      {form && (
        <>
          {/* Form Sections */}
          <div className="space-y-4">
            {(form.sections || []).map((section, sectionIndex) => (
              <div key={section.id} className="bg-white rounded-xl border border-gray-200">
                {/* Section Header */}
                <div className="p-4 border-b border-gray-200 bg-gray-50">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="text-2xl">{section.icon === 'Building' ? '🏢' : '📍'}</div>
                      <div>
                        <h4 className="font-semibold text-gray-900">{section.title}</h4>
                        <p className="text-sm text-gray-600">{section.description}</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <Button
                        onClick={() => openAddFieldModal(section.id)}
                        size="sm"
                        className="bg-[#FF8C42] hover:bg-[#FF7A29]"
                      >
                        <Plus className="w-4 h-4 mr-1" />
                        Add Field
                      </Button>
                      
                      {section.fields.length === 0 && (
                        <Button
                          onClick={() => deleteSection(section.id)}
                          size="sm"
                          variant="outline"
                          className="border-red-300 text-red-600 hover:bg-red-50"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Fields List */}
                <div className="p-4">
                  {section.fields.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      <FileText className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                      <p>No fields added yet</p>
                      <p className="text-sm">Click "Add Field" to start building this section</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {section.fields.map((field, fieldIndex) => (
                        <div
                          key={field.id}
                          className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                        >
                          <div className="flex items-center gap-3 flex-1">
                            <span className="text-2xl">{getFieldTypeIcon(field.type)}</span>
                            
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-gray-900">{field.label}</span>
                                {field.validation?.required && (
                                  <Badge className="bg-red-100 text-red-800 text-xs">Required</Badge>
                                )}
                                {field.requiresDocument && (
                                  <Badge className="bg-blue-100 text-blue-800 text-xs">
                                    <Upload className="w-3 h-3 mr-1" />
                                    Doc Required
                                  </Badge>
                                )}
                                {!field.isActive && (
                                  <Badge className="bg-gray-200 text-gray-600 text-xs">Inactive</Badge>
                                )}
                              </div>
                              <div className="flex items-center gap-2 mt-1">
                                <code className="text-xs text-gray-500 bg-white px-2 py-0.5 rounded">
                                  {field.name}
                                </code>
                                <span className="text-xs text-gray-400">•</span>
                                <span className="text-xs text-gray-500 capitalize">{field.type}</span>
                              </div>
                              {field.helpText && (
                                <p className="text-xs text-gray-500 mt-1">{field.helpText}</p>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-1">
                            <Button
                              onClick={() => moveField(section.id, field.id, 'up')}
                              disabled={fieldIndex === 0}
                              size="sm"
                              variant="ghost"
                            >
                              <ArrowUp className="w-4 h-4" />
                            </Button>
                            <Button
                              onClick={() => moveField(section.id, field.id, 'down')}
                              disabled={fieldIndex === section.fields.length - 1}
                              size="sm"
                              variant="ghost"
                            >
                              <ArrowDown className="w-4 h-4" />
                            </Button>
                            <Button
                              onClick={() => duplicateField(section.id, field)}
                              size="sm"
                              variant="ghost"
                            >
                              <Copy className="w-4 h-4" />
                            </Button>
                            <Button
                              onClick={() => openEditFieldModal(field, section.id)}
                              size="sm"
                              variant="ghost"
                            >
                              <Edit2 className="w-4 h-4" />
                            </Button>
                            <Button
                              onClick={() => deleteField(section.id, field.id)}
                              size="sm"
                              variant="ghost"
                              className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Document Sections (Auto-generated) */}
          {form.documentSections && form.documentSections.length > 0 && (
            <div className="bg-blue-50 rounded-xl border border-blue-200 p-4">
              <div className="flex items-start gap-3 mb-3">
                <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5" />
                <div>
                  <h4 className="font-semibold text-blue-900">Auto-Generated Document Section</h4>
                  <p className="text-sm text-blue-700">
                    This section is automatically created based on fields that require document uploads
                  </p>
                </div>
              </div>
              
              <div className="bg-white rounded-lg p-3 mt-3">
                <div className="space-y-2">
                  {form.documentSections[0]?.fields?.map(field => (
                    <div key={field.id} className="flex items-center gap-2 text-sm">
                      <FileText className="w-4 h-4 text-blue-600" />
                      <span className="font-medium">{field.label}</span>
                      {field.validation?.required && (
                        <Badge className="bg-red-100 text-red-800 text-xs">Required</Badge>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Add Custom Section Button */}
          <Button
            onClick={() => setShowSectionModal(true)}
            variant="outline"
            className="w-full border-dashed border-2 border-gray-300 h-12 hover:border-[#FF8C42] hover:bg-orange-50"
          >
            <Plus className="w-5 h-5 mr-2" />
            Add Custom Section
          </Button>
        </>
      )}

      {/* Field Modal */}
      <Dialog open={showFieldModal} onOpenChange={setShowFieldModal}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingField ? 'Edit Field' : 'Add New Field'}</DialogTitle>
            <DialogDescription>
              Configure field properties and validation rules
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Field Name */}
            <div>
              <Label>Field Name (Key) *</Label>
              <Input
                value={fieldForm.name}
                onChange={(e) => setFieldForm({ ...fieldForm, name: e.target.value })}
                placeholder="e.g., businessName, ownerPhone"
              />
              <p className="text-xs text-gray-500 mt-1">
                Use camelCase. This will be the key in form data.
              </p>
            </div>

            {/* Field Label */}
            <div>
              <Label>Field Label *</Label>
              <Input
                value={fieldForm.label}
                onChange={(e) => setFieldForm({ ...fieldForm, label: e.target.value })}
                placeholder="e.g., Business Name, Owner Phone"
              />
            </div>

            {/* Field Type */}
            <div>
              <Label>Field Type *</Label>
              <Select
                value={fieldForm.type}
                onValueChange={(value: any) => setFieldForm({ ...fieldForm, type: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="text">Text</SelectItem>
                  <SelectItem value="number">Number</SelectItem>
                  <SelectItem value="email">Email</SelectItem>
                  <SelectItem value="tel">Phone</SelectItem>
                  <SelectItem value="textarea">Textarea</SelectItem>
                  <SelectItem value="select">Select (Dropdown)</SelectItem>
                  <SelectItem value="multiselect">Multi-select</SelectItem>
                  <SelectItem value="checkbox">Checkbox</SelectItem>
                  <SelectItem value="radio">Radio</SelectItem>
                  <SelectItem value="date">Date</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Placeholder */}
            <div>
              <Label>Placeholder Text</Label>
              <Input
                value={fieldForm.placeholder}
                onChange={(e) => setFieldForm({ ...fieldForm, placeholder: e.target.value })}
                placeholder="Enter placeholder text..."
              />
            </div>

            {/* Help Text */}
            <div>
              <Label>Help Text</Label>
              <Textarea
                value={fieldForm.helpText}
                onChange={(e) => setFieldForm({ ...fieldForm, helpText: e.target.value })}
                placeholder="Additional guidance for this field..."
                rows={2}
              />
            </div>

            {/* Validation */}
            <div className="space-y-3 border-t pt-3">
              <Label className="font-semibold">Validation Rules</Label>
              
              <div className="flex items-center space-x-2">
                <Checkbox
                  checked={fieldForm.validation?.required}
                  onCheckedChange={(checked) =>
                    setFieldForm({
                      ...fieldForm,
                      validation: { ...fieldForm.validation, required: !!checked }
                    })
                  }
                />
                <label className="text-sm">This field is required</label>
              </div>

              {(fieldForm.type === 'text' || fieldForm.type === 'textarea') && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-sm">Min Length</Label>
                    <Input
                      type="number"
                      value={fieldForm.validation?.minLength || ''}
                      onChange={(e) =>
                        setFieldForm({
                          ...fieldForm,
                          validation: {
                            ...fieldForm.validation,
                            minLength: parseInt(e.target.value) || undefined
                          }
                        })
                      }
                    />
                  </div>
                  <div>
                    <Label className="text-sm">Max Length</Label>
                    <Input
                      type="number"
                      value={fieldForm.validation?.maxLength || ''}
                      onChange={(e) =>
                        setFieldForm({
                          ...fieldForm,
                          validation: {
                            ...fieldForm.validation,
                            maxLength: parseInt(e.target.value) || undefined
                          }
                        })
                      }
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Document Upload */}
            <div className="space-y-3 border-t pt-3">
              <Label className="font-semibold">Document Upload</Label>
              
              <div className="flex items-center space-x-2">
                <Switch
                  checked={fieldForm.requiresDocument}
                  onCheckedChange={(checked) =>
                    setFieldForm({ ...fieldForm, requiresDocument: checked })
                  }
                />
                <label className="text-sm">Requires supporting document</label>
              </div>

              {fieldForm.requiresDocument && (
                <div className="space-y-3 ml-6 pl-4 border-l-2 border-blue-200">
                  <div>
                    <Label className="text-sm">Document Label</Label>
                    <Input
                      value={fieldForm.documentLabel}
                      onChange={(e) =>
                        setFieldForm({ ...fieldForm, documentLabel: e.target.value })
                      }
                      placeholder="e.g., GST Certificate, License Copy"
                    />
                  </div>
                  
                  <div>
                    <Label className="text-sm">Document Type</Label>
                    <Input
                      value={fieldForm.documentType}
                      onChange={(e) =>
                        setFieldForm({ ...fieldForm, documentType: e.target.value })
                      }
                      placeholder="e.g., gst_certificate, license"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Active Status */}
            <div className="flex items-center space-x-2">
              <Switch
                checked={fieldForm.isActive}
                onCheckedChange={(checked) => setFieldForm({ ...fieldForm, isActive: checked })}
              />
              <label className="text-sm">Field is active</label>
            </div>
          </div>

          <div className="flex gap-3">
            <Button onClick={() => setShowFieldModal(false)} variant="outline" className="flex-1">
              Cancel
            </Button>
            <Button
              onClick={saveField}
              disabled={!fieldForm.name || !fieldForm.label}
              className="flex-1 bg-[#FF8C42] hover:bg-[#FF7A29]"
            >
              {editingField ? 'Update Field' : 'Add Field'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Section Modal */}
      <Dialog open={showSectionModal} onOpenChange={setShowSectionModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Custom Section</DialogTitle>
            <DialogDescription>
              Create a new section for additional form fields
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div>
              <Label>Section Name (Key) *</Label>
              <Input
                value={sectionForm.name}
                onChange={(e) => setSectionForm({ ...sectionForm, name: e.target.value })}
                placeholder="e.g., additional_info"
              />
            </div>

            <div>
              <Label>Section Title *</Label>
              <Input
                value={sectionForm.title}
                onChange={(e) => setSectionForm({ ...sectionForm, title: e.target.value })}
                placeholder="e.g., Additional Information"
              />
            </div>

            <div>
              <Label>Description</Label>
              <Textarea
                value={sectionForm.description}
                onChange={(e) => setSectionForm({ ...sectionForm, description: e.target.value })}
                placeholder="Brief description of this section..."
                rows={2}
              />
            </div>
          </div>

          <div className="flex gap-3">
            <Button onClick={() => setShowSectionModal(false)} variant="outline" className="flex-1">
              Cancel
            </Button>
            <Button
              onClick={addSection}
              disabled={!sectionForm.name || !sectionForm.title}
              className="flex-1 bg-[#FF8C42] hover:bg-[#FF7A29]"
            >
              Add Section
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}