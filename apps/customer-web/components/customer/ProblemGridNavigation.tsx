'use client';

import React, { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api-client';
import { 
  Stethoscope, Scissors, GraduationCap, Home as HomeIcon, 
  Bone, Heart, Pill, Users, TrendingUp, ChevronRight 
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { projectId, publicAnonKey } from '@/lib/supabase/info';

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

const SERVICE_TYPE_CONFIG = {
  veterinary: {
    color: 'teal',
    bgColor: 'bg-teal-100',
    textColor: 'text-teal-700',
    borderColor: 'border-teal-500',
    icon: Stethoscope
  },
  grooming: {
    color: 'pink',
    bgColor: 'bg-pink-100',
    textColor: 'text-pink-700',
    borderColor: 'border-pink-500',
    icon: Scissors
  },
  training: {
    color: 'purple',
    bgColor: 'bg-purple-100',
    textColor: 'text-purple-700',
    borderColor: 'border-purple-500',
    icon: GraduationCap
  },
  walking: {
    color: 'green',
    bgColor: 'bg-green-100',
    textColor: 'text-green-700',
    borderColor: 'border-green-500',
    icon: HomeIcon
  },
  behavioral: {
    color: 'blue',
    bgColor: 'bg-blue-100',
    textColor: 'text-blue-700',
    borderColor: 'border-blue-500',
    icon: Heart
  },
  boarding: {
    color: 'orange',
    bgColor: 'bg-orange-100',
    textColor: 'text-orange-700',
    borderColor: 'border-orange-500',
    icon: HomeIcon
  },
  nutrition: {
    color: 'yellow',
    bgColor: 'bg-yellow-100',
    textColor: 'text-yellow-700',
    borderColor: 'border-yellow-500',
    icon: Bone
  },
  pharmacy: {
    color: 'blue',
    bgColor: 'bg-blue-100',
    textColor: 'text-blue-700',
    borderColor: 'border-blue-500',
    icon: Pill
  },
  adoption: {
    color: 'rose',
    bgColor: 'bg-rose-100',
    textColor: 'text-rose-700',
    borderColor: 'border-rose-500',
    icon: Users
  }
};

export function ProblemGridNavigation({ 
  onProblemSelect, 
  vendorType,
  showTrending = true,
  className = '' 
}: ProblemGridNavigationProps) {
  const [problems, setProblems] = useState<Problem[]>([]);
  const [trendingProblems, setTrendingProblems] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  useEffect(() => {
    fetchProblems();
    if (showTrending) {
      fetchTrendingProblems();
    }
  }, [vendorType, showTrending]);

  const fetchProblems = async () => {
    setLoading(true);
    try {
      const url = vendorType
        ? `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/problem-grid/${vendorType}`
        : `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/problem-grid/all`;

      const response = await apiClient.get('/vendor/endpoint');

      if (response.ok) {
        const data = await response.json();
        setProblems(data.data?.problems || data.problems || []);
      }
    } catch (error) {
      console.error('Error fetching problems:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchTrendingProblems = async () => {
    try {
      // AWS Serverless compatible - use apiClient
      const data = await apiClient.get('/customer/problems/trending');
      setTrendingProblems(data.data?.trending || data.trending || []);
    } catch (error) {
      console.error('Error fetching trending problems:', error);
    }
  };

  const handleProblemClick = (problem: Problem) => {
    // Track search
    trackSearch(problem.title);
    onProblemSelect(problem.problemId, problem);
  };

  const trackSearch = async (query: string) => {
    try {
      // AWS Serverless compatible - use apiClient
      await apiClient.post('/customer/search/track', {
        customerId: 'guest', // Replace with actual customer ID
        query,
        type: 'problem'
      });
    } catch (error) {
      // Silently fail - tracking is not critical
    }
  };

  const categories = [...new Set(problems.map(p => p.category))];
  const filteredProblems = selectedCategory 
    ? problems.filter(p => p.category === selectedCategory)
    : problems;

  const isTrending = (problemId: string) => trendingProblems.includes(problemId);

  if (loading) {
    return (
      <div className={`${className}`}>
        <div className="grid grid-cols-2 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-24 bg-gray-100 rounded-xl animate-pulse"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={`${className}`}>
      {/* Category Filters */}
      {categories.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-3 mb-4 scrollbar-hide">
          <button
            onClick={() => setSelectedCategory(null)}
            className={`px-4 py-2 rounded-full text-sm whitespace-nowrap transition-all ${
              !selectedCategory
                ? 'bg-gradient-to-r from-orange-500 to-pink-500 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            All Problems
          </button>
          {categories.map((category) => (
            <button
              key={category}
              onClick={() => setSelectedCategory(category)}
              className={`px-4 py-2 rounded-full text-sm whitespace-nowrap capitalize transition-all ${
                selectedCategory === category
                  ? 'bg-gradient-to-r from-orange-500 to-pink-500 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {category}
            </button>
          ))}
        </div>
      )}

      {/* Problem Grid */}
      <div className="grid grid-cols-2 gap-3">
        {filteredProblems.map((problem) => {
          const IconComponent = ICON_MAP[problem.icon] || Stethoscope;
          const vendorTypeKey = problem.vendorTypes?.[0] || 'veterinary';
          const config = SERVICE_TYPE_CONFIG[vendorTypeKey as keyof typeof SERVICE_TYPE_CONFIG] || SERVICE_TYPE_CONFIG.veterinary;
          const trending = isTrending(problem.problemId);

          return (
            <button
              key={problem.problemId}
              onClick={() => handleProblemClick(problem)}
              className={`relative p-4 rounded-xl border-2 ${config.borderColor} ${config.bgColor} hover:shadow-lg transition-all duration-300 text-left group`}
            >
              {/* Trending Badge */}
              {trending && (
                <div className="absolute top-2 right-2">
                  <Badge className="bg-orange-500 text-white text-xs px-2 py-0.5 flex items-center gap-1">
                    <TrendingUp className="w-3 h-3" />
                    Trending
                  </Badge>
                </div>
              )}

              {/* Icon */}
              <div className={`w-12 h-12 rounded-lg ${config.bgColor} flex items-center justify-center mb-3`}>
                <IconComponent className={`w-6 h-6 ${config.textColor}`} />
              </div>

              {/* Title */}
              <h3 className={`text-sm ${config.textColor} mb-1 pr-8`}>
                {problem.title}
              </h3>

              {/* Description */}
              <p className="text-xs text-gray-600 line-clamp-2 mb-2">
                {problem.description}
              </p>

              {/* Tags */}
              {problem.tags && problem.tags.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-2">
                  {problem.tags.slice(0, 2).map((tag, idx) => (
                    <span key={idx} className="text-xs bg-white bg-opacity-50 px-2 py-0.5 rounded-full">
                      {tag}
                    </span>
                  ))}
                </div>
              )}

              {/* Arrow */}
              <ChevronRight className={`absolute bottom-2 right-2 w-4 h-4 ${config.textColor} opacity-50 group-hover:opacity-100 group-hover:translate-x-1 transition-all`} />
            </button>
          );
        })}
      </div>

      {/* Empty State */}
      {filteredProblems.length === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-500">No problems found</p>
          <p className="text-sm text-gray-400 mt-1">Try selecting a different category</p>
        </div>
      )}
    </div>
  );
}
