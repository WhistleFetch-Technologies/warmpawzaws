'use client';

import { useState, useEffect } from 'react';
import { ArrowLeft, Search, ChevronRight, Check, Loader2, AlertCircle } from 'lucide-react';
import Image from 'next/image';
import { apiClient } from '@/lib/api-client';

interface ProblemGridSelectorProps {
  roleId: string;
  roleName: string;
  onBack: () => void;
  onProblemSelect: (problem: any) => void;
  customerId: string;
  phone: string;
}

export function ProblemGridSelector({
  roleId,
  roleName,
  onBack,
  onProblemSelect,
  customerId,
  phone
}: ProblemGridSelectorProps) {
  const [problems, setProblems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProblemId, setSelectedProblemId] = useState<string | null>(null);
  const [processingSelection, setProcessingSelection] = useState(false);
  const [selectionSuccess, setSelectionSuccess] = useState(false);

  useEffect(() => {
    loadProblemGrid();
  }, [roleId]);

  const loadProblemGrid = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get<{ problems: any[] }>(
        `/customer/problem-grid/${roleId}`
      );
      if (response.problems) {
        setProblems(response.problems);
      }
    } catch (error) {
      console.error('Error loading problem grid:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredProblems = problems.filter(problem => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      problem.name.toLowerCase().includes(query) ||
      (problem.displayName && problem.displayName.toLowerCase().includes(query)) ||
      (problem.description && problem.description.toLowerCase().includes(query)) ||
      (problem.keywords && problem.keywords.some((keyword: string) => keyword.toLowerCase().includes(query)))
    );
  });

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-primary">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-primary max-w-[430px] mx-auto">
      {/* Header - Orange Background */}
      <div className="px-6 pt-12 pb-6">
        <div className="flex items-center gap-4 mb-2">
          <button 
            onClick={onBack}
            className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center hover:bg-white/30 transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-white" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-white">
              Find {roleName}
            </h1>
            <p className="text-white/80 text-sm">
              Select your pet's health concern
            </p>
          </div>
        </div>
      </div>

      {/* Main Content - White Card with Top Radius */}
      <div className="bg-white rounded-t-[32px] px-6 pt-6 min-h-[calc(100vh-140px)] pb-12">
        
        {/* Search Bar */}
        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search symptoms (e.g. itching, fever)..."
              value={searchQuery}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-gray-900 placeholder:text-gray-400"
            />
          </div>
        </div>

        {/* Problem Grid */}
        {filteredProblems.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <Search className="w-12 h-12 mx-auto mb-3 text-gray-200" />
            <p className="text-sm font-medium text-gray-600">No matching problems found</p>
            <p className="text-xs mt-1">Try searching with different keywords</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {filteredProblems.map((problem) => {
              const isSelected = selectedProblemId === problem.id;
              const isProcessing = isSelected && processingSelection;
              const isSuccess = isSelected && selectionSuccess;
              
              return (
                <button
                  key={problem.id}
                  onClick={() => {
                    if (navigator.vibrate) navigator.vibrate(10);
                    setSelectedProblemId(problem.id);
                    setProcessingSelection(true);
                    setSelectionSuccess(false);
                    
                    setTimeout(() => {
                      setProcessingSelection(false);
                      setSelectionSuccess(true);
                      setTimeout(() => {
                        onProblemSelect(problem);
                      }, 300);
                    }, 500);
                  }}
                  disabled={processingSelection || selectionSuccess}
                  className={`p-4 rounded-xl border-2 transition-all active:scale-[0.98] ${
                    isSelected && isSuccess
                      ? 'bg-green-50 border-green-500'
                      : isSelected && isProcessing
                      ? 'bg-blue-50 border-blue-500'
                      : 'bg-white border-gray-200 hover:border-primary'
                  }`}
                >
                  {isProcessing && (
                    <div className="flex items-center justify-center mb-2">
                      <Loader2 className="w-5 h-5 text-primary animate-spin" />
                    </div>
                  )}
                  {isSuccess && (
                    <div className="flex items-center justify-center mb-2">
                      <Check className="w-5 h-5 text-green-600" />
                    </div>
                  )}
                  {!isProcessing && !isSuccess && problem.icon && (
                    <div className="text-3xl mb-2 text-center">{problem.icon}</div>
                  )}
                  <h3 className="font-semibold text-gray-900 text-sm text-center">
                    {problem.displayName || problem.name}
                  </h3>
                  {problem.description && (
                    <p className="text-xs text-gray-500 text-center mt-1 line-clamp-2">
                      {problem.description}
                    </p>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

