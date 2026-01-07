'use client';

import React, { useState, useEffect } from 'react';
import { TrendingUp, ChevronRight } from 'lucide-react';
import { apiClient } from '@/lib/api-client';

interface TrendingProblem {
  problemId: string;
  title: string;
  description: string;
  searchCount: number;
  trend: 'up' | 'down' | 'stable';
  category?: string;
}

interface TrendingProblemsProps {
  onProblemSelect: (problemId: string, title: string) => void;
  limit?: number;
  className?: string;
}

export function TrendingProblems({ 
  onProblemSelect, 
  limit = 5,
  className = '' 
}: TrendingProblemsProps) {
  const [trending, setTrending] = useState<TrendingProblem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTrendingProblems();
  }, [limit]);

  const fetchTrendingProblems = async () => {
    setLoading(true);
    try {
      const response = await apiClient.get<{ trending: TrendingProblem[] }>(
        `/customer/trending-problems?limit=${limit}`
      );
      
      if (response.trending) {
        setTrending(response.trending);
      }
    } catch (error) {
      console.error('Error fetching trending problems:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className={className}>
        <div className="flex items-center gap-0 mb-4">
          <TrendingUp className="w-5 h-5 text-primary" />
          <h3 className="text-gray-900 font-semibold">Trending Now</h3>
        </div>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse"></div>
          ))}
        </div>
      </div>
    );
  }

  if (trending.length === 0) {
    return null;
  }

  return (
    <div className={className}>
      <div className="flex items-center gap-0 mb-4">
        <TrendingUp className="w-5 h-5 text-primary" />
        <h3 className="text-gray-900 font-semibold">Trending Now</h3>
        <span className="px-0 py-0.5 bg-orange-100 text-orange-700 rounded-full text-xs font-semibold ml-auto">
          Popular
        </span>
      </div>

      <div className="space-y-3">
        {trending.map((problem, index) => (
          <button
            key={problem.problemId}
            onClick={() => onProblemSelect(problem.problemId, problem.title)}
            className="w-full flex items-center gap-0 p-0 bg-white border border-gray-200 rounded-xl hover:shadow-md hover:border-primary transition-all group active:scale-[0.98]"
          >
            {/* Rank */}
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${
              index === 0 
                ? 'bg-gradient-to-r from-primary to-pink-500 text-white'
                : 'bg-gray-100 text-gray-600'
            }`}>
              {index + 1}
            </div>

            {/* Problem Info */}
            <div className="flex-1 text-left">
              <h4 className="font-semibold text-gray-900 mb-0">{problem.title}</h4>
              {problem.description && (
                <p className="text-xs text-gray-600 line-clamp-0">{problem.description}</p>
              )}
              {problem.searchCount > 0 && (
                <p className="text-xs text-gray-500 mt-0">{problem.searchCount} searches</p>
              )}
            </div>

            <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-primary transition-colors" />
          </button>
        ))}
      </div>
    </div>
  );
}

