'use client';

/**
 * Shared Dashboard Stats Component
 * 
 * Reusable stats cards for both solo providers and staff dashboards
 */

import React from 'react';
import { Calendar, Clock, TrendingUp, Star, DollarSign, CheckCircle2, Package, Video, Home } from 'lucide-react';
import { LucideIcon } from 'lucide-react';

interface StatCard {
  label: string;
  value: string | number;
  icon: LucideIcon;
  color: string;
  onClick?: () => void;
}

interface DashboardStatsProps {
  stats: {
    appointments?: number;
    consultations?: number;
    earnings?: number;
    pendingEarnings?: number;
    completedServices?: number;
    rating?: number;
    totalReviews?: number;
    activeOrders?: number;
  };
  onStatClick?: (statType: string) => void;
  className?: string;
}

export function DashboardStats({ stats, onStatClick, className = '' }: DashboardStatsProps) {
  const statCards: StatCard[] = [
    {
      label: 'Appointments',
      value: stats.appointments || 0,
      icon: Calendar,
      color: 'bg-blue-500',
      onClick: () => onStatClick?.('appointments'),
    },
    {
      label: 'Tele Sessions',
      value: stats.consultations || 0,
      icon: Video,
      color: 'bg-purple-500',
      onClick: () => onStatClick?.('consultations'),
    },
    {
      label: 'Earnings',
      value: `₹${(stats.earnings || 0).toLocaleString()}`,
      icon: TrendingUp,
      color: 'bg-green-500',
      onClick: () => onStatClick?.('earnings'),
    },
    {
      label: 'Completed',
      value: stats.completedServices || 0,
      icon: CheckCircle2,
      color: 'bg-green-600',
      onClick: () => onStatClick?.('completed'),
    },
  ];

  // Filter out zero-value stats if needed
  const visibleStats = statCards.filter(card => {
    if (typeof card.value === 'number') {
      return card.value > 0 || card.label === 'Earnings'; // Always show earnings
    }
    return true;
  });

  return (
    <div className={`grid grid-cols-2 md:grid-cols-4 gap-3 ${className}`}>
      {visibleStats.map((card, index) => {
        const Icon = card.icon;
        return (
          <div
            key={index}
            onClick={card.onClick}
            className={`text-center p-4 rounded-lg hover:shadow-md transition-all ${
              card.onClick ? 'cursor-pointer border-2 border-transparent hover:border-[#FF8C42]' : ''
            } ${
              card.color.includes('green')
                ? 'bg-green-50'
                : card.color.includes('blue')
                ? 'bg-blue-50'
                : card.color.includes('purple')
                ? 'bg-purple-50'
                : 'bg-gray-50'
            }`}
          >
            <Icon className={`w-5 h-5 ${card.color.replace('bg-', 'text-')} mx-auto mb-2`} />
            <div className="text-2xl font-bold text-gray-900">{card.value}</div>
            <div className="text-xs text-gray-500">{card.label}</div>
          </div>
        );
      })}
    </div>
  );
}
