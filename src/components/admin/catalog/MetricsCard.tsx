import { TrendingUp, TrendingDown } from 'lucide-react';

interface MetricsCardProps {
  icon: React.ReactNode;
  iconBg: string;
  title: string;
  value: string | number;
  change?: string;
  changePositive?: boolean;
  subtitle?: string;
  onClick?: () => void;
}

export function MetricsCard({ 
  icon, 
  iconBg, 
  title, 
  value, 
  change, 
  changePositive = true,
  subtitle,
  onClick 
}: MetricsCardProps) {
  return (
    <div 
      className={`
        bg-white rounded-xl p-4 border border-gray-200 transition-all
        ${onClick ? 'cursor-pointer hover:shadow-md hover:border-[#FF8C42]' : ''}
      `}
      onClick={onClick}
    >
      <div className="flex items-center gap-3 mb-3">
        <div className={`w-10 h-10 ${iconBg} rounded-lg flex items-center justify-center`}>
          {icon}
        </div>
        <span className="text-sm text-gray-600">{title}</span>
      </div>
      
      <div className="flex items-end justify-between">
        <div>
          <div className="text-3xl mb-1">{value}</div>
          {subtitle && (
            <div className="text-xs text-gray-500">{subtitle}</div>
          )}
        </div>
        
        {change && (
          <div className={`flex items-center gap-1 text-xs ${changePositive ? 'text-green-600' : 'text-red-600'}`}>
            {changePositive ? (
              <TrendingUp className="w-3.5 h-3.5" />
            ) : (
              <TrendingDown className="w-3.5 h-3.5" />
            )}
            <span>{change}</span>
          </div>
        )}
      </div>
    </div>
  );
}
