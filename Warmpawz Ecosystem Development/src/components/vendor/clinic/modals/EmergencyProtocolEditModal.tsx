import { useState, useEffect } from 'react';
import { X, AlertCircle, Save, Plus, Trash2 } from 'lucide-react';
import { Button } from '../../../ui/button';
import { Input } from '../../../ui/input';
import { toast } from 'sonner@2.0.3';

interface EmergencyProtocol {
  id: string;
  protocolName: string;
  severity: 'critical' | 'high' | 'medium';
  responseTime: number;
  requiredEquipment: string[];
  steps: string[];
  isActive: boolean;
}

interface EmergencyProtocolEditModalProps {
  protocol: EmergencyProtocol | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: Partial<EmergencyProtocol>) => Promise<void>;
}

export function EmergencyProtocolEditModal({ 
  protocol, 
  isOpen, 
  onClose, 
  onSave 
}: EmergencyProtocolEditModalProps) {
  const [formData, setFormData] = useState({
    protocolName: '',
    severity: 'high' as 'critical' | 'high' | 'medium',
    responseTime: 15,
    requiredEquipment: [] as string[],
    steps: [] as string[],
    isActive: true
  });
  
  const [newEquipment, setNewEquipment] = useState('');
  const [newStep, setNewStep] = useState('');
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (isOpen) {
      if (protocol) {
        setFormData({
          protocolName: protocol.protocolName,
          severity: protocol.severity,
          responseTime: protocol.responseTime,
          requiredEquipment: [...protocol.requiredEquipment],
          steps: [...protocol.steps],
          isActive: protocol.isActive
        });
      } else {
        // Reset for new protocol
        setFormData({
          protocolName: '',
          severity: 'high',
          responseTime: 15,
          requiredEquipment: [],
          steps: [],
          isActive: true
        });
      }
      setNewEquipment('');
      setNewStep('');
      setErrors({});
    }
  }, [isOpen, protocol]);

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.protocolName.trim()) {
      newErrors.protocolName = 'Protocol name is required';
    }

    if (formData.responseTime <= 0) {
      newErrors.responseTime = 'Response time must be greater than 0';
    }

    if (formData.steps.length === 0) {
      newErrors.steps = 'At least one step is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleAddEquipment = () => {
    if (newEquipment.trim()) {
      setFormData({
        ...formData,
        requiredEquipment: [...formData.requiredEquipment, newEquipment.trim()]
      });
      setNewEquipment('');
    }
  };

  const handleRemoveEquipment = (index: number) => {
    setFormData({
      ...formData,
      requiredEquipment: formData.requiredEquipment.filter((_, i) => i !== index)
    });
  };

  const handleAddStep = () => {
    if (newStep.trim()) {
      setFormData({
        ...formData,
        steps: [...formData.steps, newStep.trim()]
      });
      setNewStep('');
    }
  };

  const handleRemoveStep = (index: number) => {
    setFormData({
      ...formData,
      steps: formData.steps.filter((_, i) => i !== index)
    });
  };

  const handleMoveStep = (index: number, direction: 'up' | 'down') => {
    const newSteps = [...formData.steps];
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    
    if (newIndex >= 0 && newIndex < newSteps.length) {
      [newSteps[index], newSteps[newIndex]] = [newSteps[newIndex], newSteps[index]];
      setFormData({...formData, steps: newSteps});
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      toast.error('Please fix the errors before saving');
      return;
    }

    setSaving(true);
    try {
      await onSave(formData);
      onClose();
    } catch (error) {
      console.error('Error saving emergency protocol:', error);
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'from-red-600 to-red-700';
      case 'high': return 'from-orange-600 to-orange-700';
      case 'medium': return 'from-yellow-600 to-yellow-700';
      default: return 'from-gray-600 to-gray-700';
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full max-w-md max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className={`sticky top-0 bg-gradient-to-r ${getSeverityColor(formData.severity)} text-white p-4 flex items-center justify-between rounded-t-lg`}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
              <AlertCircle className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-semibold">
                {protocol ? 'Edit Protocol' : 'Add Protocol'}
              </h2>
              <p className="text-xs opacity-90">Emergency response protocol</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center hover:bg-white/20 rounded-lg transition-colors"
            disabled={saving}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {/* Protocol Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Protocol Name <span className="text-red-500">*</span>
            </label>
            <Input
              value={formData.protocolName}
              onChange={(e) => setFormData({...formData, protocolName: e.target.value})}
              placeholder="e.g., Cardiac Arrest Response"
              className={errors.protocolName ? 'border-red-500' : ''}
              disabled={saving}
            />
            {errors.protocolName && (
              <p className="text-xs text-red-500 mt-1">{errors.protocolName}</p>
            )}
          </div>

          {/* Severity and Response Time */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Severity Level <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.severity}
                onChange={(e) => setFormData({...formData, severity: e.target.value as any})}
                className="w-full border border-gray-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                disabled={saving}
              >
                <option value="critical">Critical</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Response (mins) <span className="text-red-500">*</span>
              </label>
              <Input
                type="number"
                value={formData.responseTime}
                onChange={(e) => setFormData({...formData, responseTime: parseInt(e.target.value) || 0})}
                min="0"
                step="1"
                className={errors.responseTime ? 'border-red-500' : ''}
                disabled={saving}
              />
              {errors.responseTime && (
                <p className="text-xs text-red-500 mt-1">{errors.responseTime}</p>
              )}
            </div>
          </div>

          {/* Required Equipment */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Required Equipment <span className="text-gray-400 text-xs">(Optional)</span>
            </label>
            <div className="flex gap-2 mb-2">
              <Input
                value={newEquipment}
                onChange={(e) => setNewEquipment(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddEquipment())}
                placeholder="e.g., Oxygen tank, Defibrillator"
                disabled={saving}
              />
              <Button
                type="button"
                onClick={handleAddEquipment}
                className="bg-gray-600 hover:bg-gray-700"
                disabled={saving || !newEquipment.trim()}
              >
                <Plus className="w-4 h-4" />
              </Button>
            </div>
            {formData.requiredEquipment.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {formData.requiredEquipment.map((equipment, index) => (
                  <div
                    key={index}
                    className="bg-gray-100 text-gray-700 text-xs px-2 py-1 rounded-lg flex items-center gap-1"
                  >
                    {equipment}
                    <button
                      type="button"
                      onClick={() => handleRemoveEquipment(index)}
                      className="hover:text-red-600"
                      disabled={saving}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Protocol Steps */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Protocol Steps <span className="text-red-500">*</span>
            </label>
            <div className="flex gap-2 mb-2">
              <Input
                value={newStep}
                onChange={(e) => setNewStep(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddStep())}
                placeholder="e.g., Check vital signs immediately"
                disabled={saving}
              />
              <Button
                type="button"
                onClick={handleAddStep}
                className="bg-orange-600 hover:bg-orange-700"
                disabled={saving || !newStep.trim()}
              >
                <Plus className="w-4 h-4" />
              </Button>
            </div>
            {errors.steps && formData.steps.length === 0 && (
              <p className="text-xs text-red-500 mb-2">{errors.steps}</p>
            )}
            {formData.steps.length > 0 && (
              <div className="space-y-2 bg-gray-50 p-3 rounded-lg">
                {formData.steps.map((step, index) => (
                  <div
                    key={index}
                    className="bg-white p-2 rounded border border-gray-200 flex items-start gap-2"
                  >
                    <span className="text-xs font-semibold text-gray-500 mt-1 min-w-[20px]">
                      {index + 1}.
                    </span>
                    <p className="text-sm text-gray-700 flex-1">{step}</p>
                    <div className="flex gap-1">
                      <button
                        type="button"
                        onClick={() => handleMoveStep(index, 'up')}
                        disabled={index === 0 || saving}
                        className="text-gray-400 hover:text-gray-600 disabled:opacity-30"
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        onClick={() => handleMoveStep(index, 'down')}
                        disabled={index === formData.steps.length - 1 || saving}
                        className="text-gray-400 hover:text-gray-600 disabled:opacity-30"
                      >
                        ↓
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRemoveStep(index)}
                        className="text-red-400 hover:text-red-600"
                        disabled={saving}
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Active Status */}
          <div className="bg-gray-50 p-3 rounded-lg">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.isActive}
                onChange={(e) => setFormData({...formData, isActive: e.target.checked})}
                className="w-4 h-4 text-orange-600 border-gray-300 rounded focus:ring-orange-500"
                disabled={saving}
              />
              <div>
                <span className="text-sm font-medium text-gray-700">Active Protocol</span>
                <p className="text-xs text-gray-500">Protocol is ready to use in emergencies</p>
              </div>
            </label>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4 border-t sticky bottom-0 bg-white">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="flex-1"
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="flex-1 bg-orange-600 hover:bg-orange-700"
              disabled={saving}
            >
              {saving ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  {protocol ? 'Update' : 'Add'} Protocol
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
