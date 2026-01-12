import { Check, X, Clock } from 'lucide-react';

interface StatusBadgeProps {
  status: 'active' | 'inactive' | 'pending' | 'scheduled' | string;
  size?: 'sm' | 'md' | 'lg';
}

export function StatusBadge({ status, size = 'md' }: StatusBadgeProps) {
  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-sm px-2.5 py-1',
    lg: 'text-base px-3 py-1.5'
  };

  const iconSize = {
    sm: 'w-3 h-3',
    md: 'w-3.5 h-3.5',
    lg: 'w-4 h-4'
  };

  const getStatusConfig = () => {
    switch (status.toLowerCase()) {
      case 'active':
        return {
          bg: 'bg-green-100',
          text: 'text-green-700',
          border: 'border-green-200',
          icon: <Check className={iconSize[size]} />
        };
      case 'inactive':
        return {
          bg: 'bg-red-100',
          text: 'text-red-700',
          border: 'border-red-200',
          icon: <X className={iconSize[size]} />
        };
      case 'pending':
        return {
          bg: 'bg-yellow-100',
          text: 'text-yellow-700',
          border: 'border-yellow-200',
          icon: <Clock className={iconSize[size]} />
        };
      case 'scheduled':
        return {
          bg: 'bg-blue-100',
          text: 'text-blue-700',
          border: 'border-blue-200',
          icon: <Clock className={iconSize[size]} />
        };
      default:
        return {
          bg: 'bg-gray-100',
          text: 'text-gray-700',
          border: 'border-gray-200',
          icon: null
        };
    }
  };

  const config = getStatusConfig();

  return (
    <span 
      className={`
        inline-flex items-center gap-1.5 rounded-full border
        ${sizeClasses[size]} ${config.bg} ${config.text} ${config.border}
      `}
    >
      {config.icon}
      <span className="capitalize">{status}</span>
    </span>
  );
}
