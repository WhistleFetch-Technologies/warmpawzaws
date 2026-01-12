'use client';

interface StatusBadgeProps {
  status: 'active' | 'inactive' | 'pending' | 'draft' | 'archived';
  size?: 'sm' | 'md' | 'lg';
}

export function StatusBadge({ status, size = 'md' }: StatusBadgeProps) {
  const sizeClasses = {
    sm: 'px-0 py-0.5 text-xs',
    md: 'px-0.5 py-0 text-xs',
    lg: 'px-0 py-0.5 text-sm'
  };

  const statusColors: Record<string, string> = {
    active: 'bg-green-100 text-green-700 border-green-200',
    inactive: 'bg-gray-100 text-gray-700 border-gray-200',
    pending: 'bg-yellow-100 text-yellow-700 border-yellow-200',
    draft: 'bg-blue-100 text-blue-700 border-blue-200',
    archived: 'bg-red-100 text-red-700 border-red-200'
  };

  return (
    <span className={`inline-flex items-center rounded-full border font-medium ${sizeClasses[size]} ${statusColors[status]}`}>
      {status ? (status.charAt(0).toUpperCase() + status.slice(1)) : ''}
    </span>
  );
}

