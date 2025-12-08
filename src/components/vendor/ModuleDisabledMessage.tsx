import { Lock, AlertCircle, Mail } from 'lucide-react';
import { Card } from '../ui/card';
import { Button } from '../ui/button';

interface ModuleDisabledMessageProps {
  moduleName: string;
  reason: string;
  actionText?: string;
  onAction?: () => void;
  icon?: React.ReactNode;
  variant?: 'card' | 'inline' | 'banner';
}

export function ModuleDisabledMessage({
  moduleName,
  reason,
  actionText = 'Contact Admin',
  onAction,
  icon,
  variant = 'card'
}: ModuleDisabledMessageProps) {
  const defaultIcon = <Lock className="w-5 h-5 text-gray-400" />;
  const displayIcon = icon || defaultIcon;

  if (variant === 'inline') {
    return (
      <div className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg border border-gray-200">
        {displayIcon}
        <div className="flex-1">
          <p className="text-xs text-gray-600">{reason}</p>
        </div>
        {onAction && (
          <Button size="sm" variant="outline" onClick={onAction} className="text-xs h-7">
            {actionText}
          </Button>
        )}
      </div>
    );
  }

  if (variant === 'banner') {
    return (
      <div className="bg-yellow-50 border-l-4 border-yellow-400 p-3">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium text-yellow-900">{moduleName} is disabled</p>
            <p className="text-xs text-yellow-700 mt-1">{reason}</p>
            {onAction && (
              <Button
                size="sm"
                variant="outline"
                onClick={onAction}
                className="mt-2 text-xs h-7 border-yellow-300 text-yellow-700 hover:bg-yellow-100"
              >
                <Mail className="w-3 h-3 mr-1" />
                {actionText}
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Default: card variant
  return (
    <Card className="p-6 text-center bg-gray-50 border-2 border-dashed border-gray-300">
      <div className="flex flex-col items-center gap-3">
        <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center">
          {displayIcon}
        </div>
        <div>
          <p className="font-semibold text-gray-900 mb-1">{moduleName} Not Available</p>
          <p className="text-sm text-gray-600">{reason}</p>
        </div>
        {onAction && (
          <Button size="sm" variant="outline" onClick={onAction} className="mt-2">
            <Mail className="w-4 h-4 mr-2" />
            {actionText}
          </Button>
        )}
      </div>
    </Card>
  );
}

// Specific pre-configured messages for common scenarios
export const ModuleMessages = {
  staffManagement: (onContactAdmin?: () => void) => (
    <ModuleDisabledMessage
      moduleName="Staff Management"
      reason="Staff management is not enabled for your role. Contact admin to enable multi-staff features."
      actionText="Request Access"
      onAction={onContactAdmin}
    />
  ),

  centreManagement: (onContactAdmin?: () => void) => (
    <ModuleDisabledMessage
      moduleName="Centre Management"
      reason="Centre management requires at least one centre to be configured. Add a centre from your profile settings."
      actionText="Setup Centre"
      onAction={onContactAdmin}
    />
  ),

  orders: (onContactAdmin?: () => void) => (
    <ModuleDisabledMessage
      moduleName="Orders & Commerce"
      reason="Order management is not available for your role. This feature is for pet stores and product vendors."
      actionText="Learn More"
      onAction={onContactAdmin}
    />
  ),

  inventory: (onContactAdmin?: () => void) => (
    <ModuleDisabledMessage
      moduleName="Inventory Management"
      reason="Inventory tracking is not enabled. Contact admin to activate inventory features."
      actionText="Contact Admin"
      onAction={onContactAdmin}
    />
  ),

  medicalRecords: (onContactAdmin?: () => void) => (
    <ModuleDisabledMessage
      moduleName="Medical Records"
      reason="Medical records management is only available for veterinary clinics and hospitals."
      actionText="Contact Support"
      onAction={onContactAdmin}
    />
  ),

  teleHealth: (onContactAdmin?: () => void) => (
    <ModuleDisabledMessage
      moduleName="Tele-health"
      reason="Tele-health consultations are not enabled for your role. Contact admin to activate video consultation features."
      actionText="Request Activation"
      onAction={onContactAdmin}
    />
  ),

  liveTracking: (onContactAdmin?: () => void) => (
    <ModuleDisabledMessage
      moduleName="Live Tracking"
      reason="GPS tracking is only available for home service providers like walkers and trainers."
      actionText="Learn More"
      onAction={onContactAdmin}
    />
  ),

  prescription: (onContactAdmin?: () => void) => (
    <ModuleDisabledMessage
      moduleName="Prescription Management"
      reason="Prescription features are only available for licensed veterinarians."
      actionText="Contact Support"
      onAction={onContactAdmin}
    />
  )
};
