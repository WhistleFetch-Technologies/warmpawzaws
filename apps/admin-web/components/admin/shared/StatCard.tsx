'use client';

import { ReactNode } from 'react';
import { LucideIcon } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string | number;
  icon?: LucideIcon;
  iconColor?: 'blue' | 'green' | 'orange' | 'red' | 'purple';
  change?: {
    value: number;
    label: string;
    trend: 'up' | 'down';
  };
  className?: string;
}

const iconColorClasses = {
  blue: 'bg-blue-50 text-blue-600',
  green: 'bg-green-50 text-green-600',
  orange: 'bg-orange-50 text-orange-600',
  red: 'bg-red-50 text-red-600',
  purple: 'bg-purple-50 text-purple-600',
};

export function StatCard({
  title,
  value,
  icon: Icon,
  iconColor = 'blue',
  change,
  className = '',
}: StatCardProps) {
  return (
    <div className={`bg-white border border-gray-200 rounded-xl p-5 hover:shadow-md transition-all duration-200 ${className}`}>
      <div className="flex items-start justify-between mb-3">
        {Icon && (
          <div className={`p-2.5 ${iconColorClasses[iconColor]} rounded-lg`}>
            <Icon className="w-5 h-5" />
          </div>
        )}
        {change && (
          <div className={`flex items-center gap-1 text-xs font-medium ${
            change.trend === 'up' ? 'text-green-600' : 'text-red-600'
          }`}>
            <span>{change.trend === 'up' ? '+' : '-'}{Math.abs(change.value)}</span>
            <span className="text-gray-500">{change.label}</span>
          </div>
        )}
      </div>
      <p className="text-sm text-gray-600 mb-1 font-medium">{title}</p>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
    </div>
  );
}
