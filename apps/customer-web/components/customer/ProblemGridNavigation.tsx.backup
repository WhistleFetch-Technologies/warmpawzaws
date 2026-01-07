'use client';

import React, { useState, useEffect } from 'react';
import { 
  Stethoscope, Scissors, GraduationCap, Home as HomeIcon, 
  Bone, Heart, Pill, Users, TrendingUp, ChevronRight 
} from 'lucide-react';
import { apiClient } from '@/lib/api-client';

interface Problem {
  problemId: string;
  title: string;
  description: string;
  icon: string;
  category: string;
  severity?: string;
  tags?: string[];
  vendorTypes?: string[];
}

interface ProblemGridNavigationProps {
  onProblemSelect: (problemId: string, problem: Problem) => void;
  vendorType?: string;
  showTrending?: boolean;
  className?: string;
}

const ICON_MAP: Record<string, React.ComponentType<any>> = {
  'stethoscope': Stethoscope,
  'scissors': Scissors,
  'graduation-cap': GraduationCap,
  'home': HomeIcon,
  'bone': Bone,
  'heart': Heart,
  'pill': Pill,
  'users': Users,
};

export function ProblemGridNavigation({ 
  onProblemSelect, 
  vendorType,
  showTrending = true,
  className = '' 
}: ProblemGridNavigationProps) {
  const [problems, setProblems] = useState<Problem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProblems();
  }, [vendorType]);

  const fetchProblems = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (vendorType) params.append('vendorType', vendorType);

      const response = await apiClient.get<{ problems: Problem[] }>(
        `/customer/problems?${params}`
      );
      
      if (response.problems) {
        setProblems(response.problems);
      }
    } catch (error) {
      console.error('Error fetching problems:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className={className}>
        <div className="grid grid-cols-2 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-24 bg-gray-100 rounded-xl animate-pulse"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={className}>
      <div className="grid grid-cols-2 gap-3">
        {problems.map((problem) => {
          const IconComponent = ICON_MAP[problem.icon] || Heart;
          return (
            <button
              key={problem.problemId}
              onClick={() => onProblemSelect(problem.problemId, problem)}
              className="bg-white rounded-xl border-2 border-gray-200 p-4 hover:border-primary hover:shadow-md transition-all text-left active:scale-[0.98]"
            >
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                  <IconComponent className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900 text-sm">{problem.title}</h3>
                  {problem.severity && (
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      problem.severity === 'high' ? 'bg-red-100 text-red-700' :
                      problem.severity === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                      'bg-green-100 text-green-700'
                    }`}>
                      {problem.severity}
                    </span>
                  )}
                </div>
              </div>
              {problem.description && (
                <p className="text-xs text-gray-600 line-clamp-2">{problem.description}</p>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

