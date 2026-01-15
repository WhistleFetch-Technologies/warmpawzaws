'use client';

/**
 * TrainingSkillMatrix - Visual skill progress tracking for pet training
 * 
 * Features:
 * - Skill categories with progress levels
 * - Visual proficiency indicators
 * - Session history per skill
 * - Progress comparison
 * 
 * Date: 2026-01-15
 */

import React, { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api-client';
import {
  CheckCircle, Circle, Clock, TrendingUp, Award,
  ChevronDown, ChevronUp, Star, BookOpen, Target
} from 'lucide-react';

interface Skill {
  id: string;
  skillName: string;
  skillCode: string;
  skillCategory: 'basic' | 'intermediate' | 'advanced' | 'behavior' | 'specialty';
  description: string;
  currentLevel: 'not_started' | 'learning' | 'developing' | 'proficient' | 'mastered';
  proficiencyScore: number;
  sessionsPracticed: number;
  lastPracticedAt: string | null;
  notes: string | null;
}

interface SkillCategory {
  name: string;
  skills: Skill[];
  color: string;
  icon: string;
}

interface TrainingSkillMatrixProps {
  petId: string;
  packageId?: string;
  onSkillClick?: (skill: Skill) => void;
  showDetails?: boolean;
}

const LEVEL_CONFIG = {
  not_started: { label: 'Not Started', color: 'gray', progress: 0, icon: Circle },
  learning: { label: 'Learning', color: 'blue', progress: 25, icon: BookOpen },
  developing: { label: 'Developing', color: 'yellow', progress: 50, icon: TrendingUp },
  proficient: { label: 'Proficient', color: 'green', progress: 75, icon: Target },
  mastered: { label: 'Mastered', color: 'purple', progress: 100, icon: Award }
};

const CATEGORY_CONFIG = {
  basic: { name: 'Basic Commands', color: 'blue', icon: '🎯' },
  intermediate: { name: 'Intermediate', color: 'green', icon: '📈' },
  advanced: { name: 'Advanced', color: 'purple', icon: '🏆' },
  behavior: { name: 'Behavior', color: 'orange', icon: '🧠' },
  specialty: { name: 'Specialty/Fun', color: 'pink', icon: '✨' }
};

export function TrainingSkillMatrix({
  petId,
  packageId,
  onSkillClick,
  showDetails = true
}: TrainingSkillMatrixProps) {
  const [loading, setLoading] = useState(true);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [expandedCategory, setExpandedCategory] = useState<string | null>('basic');
  const [summary, setSummary] = useState({
    totalSkills: 0,
    mastered: 0,
    inProgress: 0,
    notStarted: 0
  });

  useEffect(() => {
    fetchSkillProgress();
  }, [petId, packageId]);

  const fetchSkillProgress = async () => {
    try {
      setLoading(true);
      const url = packageId 
        ? `/training/${packageId}/skills?petId=${petId}`
        : `/pet/${petId}/training-progress`;
      
      const response = await apiClient.get<any>(url);
      
      if (response?.skills) {
        setSkills(response.skills);
        calculateSummary(response.skills);
      } else {
        // Load default skills if no progress exists
        loadDefaultSkills();
      }
    } catch (error) {
      console.error('Error fetching skill progress:', error);
      loadDefaultSkills();
    } finally {
      setLoading(false);
    }
  };

  const loadDefaultSkills = async () => {
    // Fetch all available skills and show as not_started
    try {
      const response = await apiClient.get<any>('/training/skills/all');
      if (response?.skills) {
        const defaultSkills = response.skills.map((skill: any) => ({
          ...skill,
          currentLevel: 'not_started',
          proficiencyScore: 0,
          sessionsPracticed: 0,
          lastPracticedAt: null,
          notes: null
        }));
        setSkills(defaultSkills);
        calculateSummary(defaultSkills);
      }
    } catch (error) {
      console.error('Error loading default skills:', error);
      setSkills([]);
    }
  };

  const calculateSummary = (skillList: Skill[]) => {
    const mastered = skillList.filter(s => s.currentLevel === 'mastered').length;
    const inProgress = skillList.filter(s => 
      ['learning', 'developing', 'proficient'].includes(s.currentLevel)
    ).length;
    const notStarted = skillList.filter(s => s.currentLevel === 'not_started').length;
    
    setSummary({
      totalSkills: skillList.length,
      mastered,
      inProgress,
      notStarted
    });
  };

  const groupedSkills = skills.reduce((acc, skill) => {
    const category = skill.skillCategory || 'basic';
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(skill);
    return acc;
  }, {} as Record<string, Skill[]>);

  const getOverallProgress = () => {
    if (skills.length === 0) return 0;
    const totalPoints = skills.reduce((sum, skill) => {
      return sum + LEVEL_CONFIG[skill.currentLevel].progress;
    }, 0);
    return Math.round(totalPoints / skills.length);
  };

  const renderSkillLevel = (level: keyof typeof LEVEL_CONFIG, size: 'sm' | 'md' = 'sm') => {
    const config = LEVEL_CONFIG[level];
    const sizeClass = size === 'sm' ? 'w-4 h-4' : 'w-5 h-5';
    const Icon = config.icon;
    
    const colorClass = {
      gray: 'text-gray-400',
      blue: 'text-blue-500',
      yellow: 'text-yellow-500',
      green: 'text-green-500',
      purple: 'text-purple-500'
    }[config.color];

    return <Icon className={`${sizeClass} ${colorClass}`} />;
  };

  if (loading) {
    return (
      <div className="bg-white rounded-2xl p-6 shadow-sm">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-gray-200 rounded w-1/3" />
          <div className="h-24 bg-gray-200 rounded" />
          <div className="space-y-2">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-12 bg-gray-200 rounded" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-pink-600 text-white p-6">
        <h2 className="text-xl font-bold mb-2 flex items-center gap-2">
          <Award className="w-6 h-6" />
          Training Progress
        </h2>
        <p className="text-white/80 text-sm mb-4">
          Track skills learned across training sessions
        </p>

        {/* Overall Progress */}
        <div className="bg-white/20 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm">Overall Progress</span>
            <span className="text-lg font-bold">{getOverallProgress()}%</span>
          </div>
          <div className="h-3 bg-white/30 rounded-full overflow-hidden">
            <div 
              className="h-full bg-white rounded-full transition-all duration-500"
              style={{ width: `${getOverallProgress()}%` }}
            />
          </div>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-3 gap-2 p-4 bg-gray-50">
        <div className="text-center">
          <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-1">
            <Award className="w-5 h-5 text-purple-600" />
          </div>
          <p className="text-lg font-bold text-gray-900">{summary.mastered}</p>
          <p className="text-xs text-gray-500">Mastered</p>
        </div>
        <div className="text-center">
          <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-1">
            <TrendingUp className="w-5 h-5 text-blue-600" />
          </div>
          <p className="text-lg font-bold text-gray-900">{summary.inProgress}</p>
          <p className="text-xs text-gray-500">In Progress</p>
        </div>
        <div className="text-center">
          <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-1">
            <Circle className="w-5 h-5 text-gray-400" />
          </div>
          <p className="text-lg font-bold text-gray-900">{summary.notStarted}</p>
          <p className="text-xs text-gray-500">Not Started</p>
        </div>
      </div>

      {/* Skill Categories */}
      <div className="divide-y">
        {Object.entries(CATEGORY_CONFIG).map(([categoryKey, categoryConfig]) => {
          const categorySkills = groupedSkills[categoryKey] || [];
          if (categorySkills.length === 0) return null;
          
          const isExpanded = expandedCategory === categoryKey;
          const masteredCount = categorySkills.filter(s => s.currentLevel === 'mastered').length;
          const categoryProgress = Math.round(
            categorySkills.reduce((sum, s) => sum + LEVEL_CONFIG[s.currentLevel].progress, 0) / categorySkills.length
          );

          return (
            <div key={categoryKey}>
              {/* Category Header */}
              <button
                onClick={() => setExpandedCategory(isExpanded ? null : categoryKey)}
                className="w-full p-4 flex items-center justify-between hover:bg-gray-50 transition"
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{categoryConfig.icon}</span>
                  <div className="text-left">
                    <h3 className="font-semibold text-gray-900">{categoryConfig.name}</h3>
                    <p className="text-sm text-gray-500">
                      {masteredCount}/{categorySkills.length} mastered
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-16 h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div 
                      className={`h-full rounded-full bg-${categoryConfig.color}-500`}
                      style={{ width: `${categoryProgress}%` }}
                    />
                  </div>
                  {isExpanded ? (
                    <ChevronUp className="w-5 h-5 text-gray-400" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-gray-400" />
                  )}
                </div>
              </button>

              {/* Skills List */}
              {isExpanded && (
                <div className="px-4 pb-4 space-y-2">
                  {categorySkills.map(skill => (
                    <button
                      key={skill.id}
                      onClick={() => onSkillClick?.(skill)}
                      className="w-full p-3 bg-gray-50 rounded-lg flex items-center justify-between hover:bg-gray-100 transition text-left"
                    >
                      <div className="flex items-center gap-3">
                        {renderSkillLevel(skill.currentLevel)}
                        <div>
                          <p className="font-medium text-gray-900">{skill.skillName}</p>
                          {showDetails && skill.sessionsPracticed > 0 && (
                            <p className="text-xs text-gray-500">
                              {skill.sessionsPracticed} sessions • {LEVEL_CONFIG[skill.currentLevel].label}
                            </p>
                          )}
                        </div>
                      </div>
                      
                      {/* Progress Dots */}
                      <div className="flex items-center gap-1">
                        {(['learning', 'developing', 'proficient', 'mastered'] as const).map((level, i) => {
                          const levelIndex = ['learning', 'developing', 'proficient', 'mastered'].indexOf(skill.currentLevel);
                          const isCompleted = i <= levelIndex && skill.currentLevel !== 'not_started';
                          return (
                            <div
                              key={level}
                              className={`w-2 h-2 rounded-full ${
                                isCompleted ? 'bg-purple-500' : 'bg-gray-200'
                              }`}
                            />
                          );
                        })}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="p-4 bg-gray-50 border-t">
        <p className="text-xs text-gray-500 mb-2">Proficiency Levels:</p>
        <div className="flex flex-wrap gap-3">
          {Object.entries(LEVEL_CONFIG).map(([key, config]) => (
            <div key={key} className="flex items-center gap-1 text-xs text-gray-600">
              {renderSkillLevel(key as keyof typeof LEVEL_CONFIG)}
              <span>{config.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default TrainingSkillMatrix;
