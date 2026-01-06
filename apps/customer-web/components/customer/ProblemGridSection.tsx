'use client';

import React from 'react';
import { ChevronRight } from 'lucide-react';

interface ProblemGridItem {
  id: string;
  name: string;
  icon: string;
  bgColor?: string;
  iconBg?: string;
  textColor?: string;
}

interface ProblemGridSectionProps {
  roleId: string;
  roleName: string;
  title: string;
  icon: React.ComponentType<any>;
  problems: ProblemGridItem[];
  onNavigate: (screen: string, data?: any) => void;
}

export function ProblemGridSection({ 
  roleId, 
  roleName,
  title,
  icon: Icon,
  problems,
  onNavigate 
}: ProblemGridSectionProps) {
  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-orange-50 rounded-lg">
            <Icon className="w-4 h-4 text-primary" />
          </div>
          <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
        </div>
        <button 
          onClick={() => onNavigate('problem_grid')}
          className="text-sm text-primary font-medium hover:text-primary-dark transition-colors"
        >
          View All
        </button>
      </div>

      <div className="grid grid-cols-4 gap-3">
        {problems.map((problem) => {
          const isViewAll = problem.id === 'view_all';
          return (
            <button
              key={problem.id}
              onClick={() => {
                if (isViewAll) {
                  onNavigate('problem_grid');
                } else {
                  onNavigate('problem_selected', { problemId: problem.id });
                }
              }}
              className="group relative flex flex-col items-center"
            >
              <div className={`
                w-full aspect-square rounded-2xl border transition-all duration-200 flex flex-col items-center justify-center gap-2 p-2
                ${isViewAll 
                  ? 'bg-orange-50 border-orange-100 text-orange-700 hover:bg-orange-100' 
                  : 'bg-white border-gray-100 text-gray-600 hover:border-primary hover:shadow-md hover:-translate-y-0.5'
                }
              `}>
                <div className={`
                  w-10 h-10 rounded-xl flex items-center justify-center text-xl transition-transform group-hover:scale-110
                  ${isViewAll ? 'bg-white/50' : 'bg-gray-50 group-hover:bg-orange-50'}
                `}>
                  {problem.icon}
                </div>
                <p className={`
                  text-[10px] font-medium text-center leading-tight line-clamp-2
                  ${isViewAll ? 'text-orange-700' : 'text-gray-600 group-hover:text-primary'}
                `}>
                  {problem.name}
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

