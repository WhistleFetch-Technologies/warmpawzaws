'use client';

/**
 * UNIVERSAL PROBLEM GRID SELECTOR
 * 
 * Reusable component that displays problem categories for any vendor type
 * Dynamically loads problem grid based on roleId (vet, groomer, trainer, etc.)
 * 
 * DESIGN UPDATE:
 * - Enforced Warmpawz Design Philosophy (Orange Header / White Card)
 */

import { useState, useEffect } from 'react';
import { ArrowLeft, Search, ChevronRight, Check, Loader2, AlertCircle } from 'lucide-react';
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
      const data = await apiClient.get<{ problems?: any[] }>(`/customer/problems?roleId=${roleId}`);
      setProblems(data.problems || []);
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
      <div className="min-h-screen flex items-center justify-center bg-[#FF8C42]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FF8C42] max-w-md mx-auto">
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
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              placeholder="Search symptoms (e.g. itching, fever)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#FF8C42] focus:border-transparent text-slate-900 placeholder:text-slate-400"
            />
          </div>
        </div>

        {/* Problem Grid */}
        {filteredProblems.length === 0 ? (
          <div className="text-center py-16 text-slate-400">
            <Search className="w-12 h-12 mx-auto mb-3 text-slate-200" />
            <p className="text-sm font-medium text-slate-600">No matching problems found</p>
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
                disabled={processingSelection}
                className="relative group text-left h-full"
              >
                <div className={`
                  relative overflow-hidden rounded-2xl p-4 h-full flex flex-col justify-between transition-all duration-200
                  ${isSelected 
                    ? 'bg-orange-50 border-2 border-orange-500 shadow-md scale-[0.98]' 
                    : 'bg-white border border-slate-100 shadow-sm hover:border-orange-200 hover:shadow-md hover:-translate-y-0.5'
                  }
                `}>
                  
                  {/* Success Overlay */}
                  {isSuccess && (
                    <div className="absolute inset-0 bg-green-500 flex items-center justify-center z-20 animate-in fade-in duration-200">
                      <Check className="w-10 h-10 text-white animate-bounce" />
                    </div>
                  )}
                  
                  {/* Loading Overlay */}
                  {isProcessing && (
                    <div className="absolute inset-0 bg-white/80 flex items-center justify-center z-20">
                      <Loader2 className="w-8 h-8 text-[#FF8C42] animate-spin" />
                    </div>
                  )}
                  
                  <div className="relative z-10">
                    {/* Icon */}
                    <div className={`
                      w-12 h-12 rounded-xl flex items-center justify-center text-2xl mb-3 transition-colors
                      ${isSelected ? 'bg-white' : 'bg-slate-50 group-hover:bg-orange-50'}
                    `}>
                      {problem.icon}
                    </div>
                    
                    {/* Text */}
                    <div>
                      <h3 className={`font-bold text-sm mb-1 leading-tight ${isSelected ? 'text-orange-900' : 'text-slate-900'}`}>
                        {problem.displayName || problem.name}
                      </h3>
                      <p className={`text-xs line-clamp-2 ${isSelected ? 'text-orange-700/80' : 'text-slate-500'}`}>
                        {problem.description || 'Select to find specialists'}
                      </p>
                    </div>
                  </div>

                  {/* Arrow Indicator (Only visible on hover or select) */}
                  <div className={`
                    absolute bottom-4 right-4 transition-all duration-300
                    ${isSelected ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-2 group-hover:opacity-100 group-hover:translate-x-0'}
                  `}>
                    <ChevronRight className={`w-4 h-4 ${isSelected ? 'text-orange-500' : 'text-slate-300'}`} />
                  </div>
                </div>
              </button>
              );
            })}
          </div>
        )}

        {/* Help Box */}
        <div className="mt-8 p-4 bg-blue-50 rounded-xl border border-blue-100 flex gap-3">
          <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
             <AlertCircle className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-blue-900 mb-1">
              Not sure what to choose?
            </h3>
            <p className="text-xs text-blue-700 leading-relaxed">
              Select "General Consultation" or use the search bar. Our AI will help match you with the right specialist.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
