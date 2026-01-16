'use client';

import React, { useState, useEffect } from 'react';
import { TrendingUp, ChevronRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
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
  }, []);

  const fetchTrendingProblems = async () => {
    setLoading(true);
    try {
      // AWS Serverless compatible - use apiClient
      const data = await apiClient.get<{ trending?: TrendingProblem[]; data?: { trending?: TrendingProblem[] } }>('/customer/problems/trending');
      setTrending(data.data?.trending || data.trending || []);
    } catch (error) {
      console.error('Error fetching trending problems:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className={`${className}`}>
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="w-5 h-5 text-orange-500" />
          <h3 className="text-gray-900">Trending Now</h3>
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
    <div className={`${className}`}>
      <div className="flex items-center gap-2 mb-4">
        <TrendingUp className="w-5 h-5 text-orange-500" />
        <h3 className="text-gray-900">Trending Now</h3>
        <Badge className="bg-orange-100 text-orange-700 text-xs ml-auto">
          Popular
        </Badge>
      </div>

      <div className="space-y-3">
        {trending.map((problem, index) => (
          <button
            key={problem.problemId}
            onClick={() => onProblemSelect(problem.problemId, problem.title)}
            className="w-full flex items-center gap-3 p-3 bg-white border border-gray-200 rounded-xl hover:shadow-md hover:border-orange-300 transition-all group"
          >
            {/* Rank */}
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm ${
              index === 0 
                ? 'bg-gradient-to-r from-orange-500 to-pink-500 text-white'
                : 'bg-gray-100 text-gray-600'
            }`}>
              {index + 1}
            </div>

            {/* Problem Info */}
            <div className="flex-1 text-left min-w-0">
              <h4 className="text-sm text-gray-900 mb-1 line-clamp-1">
                {String(problem.title || '')}
              </h4>
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <span>{Number(problem.searchCount || 0)} searches</span>
                {problem.category && (
                  <>
                    <span>•</span>
                    <span className="capitalize">{String(problem.category || '')}</span>
                  </>
                )}
              </div>
            </div>

            {/* Trend Indicator */}
            <div className={`flex items-center gap-1 text-xs ${
              problem.trend === 'up' ? 'text-green-600' : 
              problem.trend === 'down' ? 'text-red-600' : 
              'text-gray-400'
            }`}>
              <TrendingUp className={`w-4 h-4 ${
                problem.trend === 'down' ? 'rotate-180' : ''
              }`} />
            </div>

            <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-orange-500 group-hover:translate-x-1 transition-all" />
          </button>
        ))}
      </div>
    </div>
  );
}
