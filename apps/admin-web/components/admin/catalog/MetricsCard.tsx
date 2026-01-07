'use client';

import { ReactNode } from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface MetricsCardProps {
  icon: ReactNode;
  iconBg?: string;
  title: string;
  value: string | number;
  change?: string;
  changePositive?: boolean;
  subtitle?: string;
}

export function MetricsCard({
  icon,
  iconBg = 'bg-blue-50',
  title,
  value,
  change,
  changePositive = true,
  subtitle
}: MetricsCardProps) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-0">
        <div className={`p-0 ${iconBg} rounded-lg`}>
          {icon}
        </div>
        {change && (
          <div className={`flex items-center gap-0 text-xs ${
            changePositive ? 'text-green-600' : 'text-red-600'
          }`}>
            {changePositive ? (
              <TrendingUp className="w-3 h-3" />
            ) : (
              <TrendingDown className="w-3 h-3" />
            )}
            <span>{change}</span>
          </div>
        )}
      </div>
      
      <div>
        <p className="text-gray-600 text-sm mb-0">{title}</p>
        <p className="text-2xl font-bold text-gray-900">{value}</p>
        {subtitle && (
          <p className="text-xs text-gray-500 mt-0">{subtitle}</p>
        )}
      </div>
    </div>
  );
}

