'use client';

/**
 * TrainerProgressForm - Session progress input for trainers
 * 
 * Features:
 * - Skill checkboxes with proficiency sliders
 * - Behavior notes
 * - Homework assignments for owners
 * - Photo/video upload
 * - Next session recommendations
 * 
 * Date: 2026-01-15
 */

import React, { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api-client';
import {
  CheckCircle, Circle, Clock, Camera, FileText, Home,
  ChevronDown, ChevronUp, Star, Send, X, Plus, Save,
  BookOpen, Target, Award, TrendingUp, AlertCircle
} from 'lucide-react';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { toast } from 'sonner';

interface Skill {
  id: string;
  skillName: string;
  skillCode: string;
  skillCategory: string;
  currentLevel: string;
  proficiencyScore: number;
}

interface SkillProgress {
  skillId: string;
  practiced: boolean;
  beforeLevel: string;
  afterLevel: string;
  improvement: number;
  notes: string;
}

interface SessionData {
  bookingId: string;
  sessionId?: string;
  packageId?: string;
  sessionNumber: number;
  petId: string;
  petName: string;
  customerName: string;
}

interface TrainerProgressFormProps {
  session: SessionData;
  vendorId: string;
  onSubmit?: (progress: any) => void;
  onCancel?: () => void;
}

const PROFICIENCY_LEVELS = [
  { value: 'not_started', label: 'Not Started', score: 0, color: 'gray' },
  { value: 'learning', label: 'Learning', score: 25, color: 'blue' },
  { value: 'developing', label: 'Developing', score: 50, color: 'yellow' },
  { value: 'proficient', label: 'Proficient', score: 75, color: 'green' },
  { value: 'mastered', label: 'Mastered', score: 100, color: 'purple' }
];

export function TrainerProgressForm({
  session,
  vendorId,
  onSubmit,
  onCancel
}: TrainerProgressFormProps) {
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [skillProgress, setSkillProgress] = useState<Record<string, SkillProgress>>({});
  const [expandedCategories, setExpandedCategories] = useState<string[]>(['basic']);
  
  // Session notes
  const [generalNotes, setGeneralNotes] = useState('');
  const [behaviorObservations, setBehaviorObservations] = useState('');
  const [homework, setHomework] = useState('');
  const [nextSessionFocus, setNextSessionFocus] = useState('');
  const [overallRating, setOverallRating] = useState(4);
  const [photos, setPhotos] = useState<string[]>([]);

  useEffect(() => {
    fetchSkills();
  }, [session.petId]);

  const fetchSkills = async () => {
    try {
      setLoading(true);
      
      // Fetch available skills and pet's current progress
      const [skillsResponse, progressResponse] = await Promise.all([
        apiClient.get<any>('/training/skills/all'),
        apiClient.get<any>(`/pet/${session.petId}/training-progress`)
      ]);

      const allSkills = skillsResponse?.skills || [];
      const petProgress = progressResponse?.skills || [];

      // Merge skills with pet's progress
      const mergedSkills = allSkills.map((skill: any) => {
        const progress = petProgress.find((p: any) => p.skill_id === skill.id);
        return {
          ...skill,
          currentLevel: progress?.current_level || 'not_started',
          proficiencyScore: progress?.proficiency_score || 0
        };
      });

      setSkills(mergedSkills);

      // Initialize progress state for each skill
      const initialProgress: Record<string, SkillProgress> = {};
      mergedSkills.forEach((skill: Skill) => {
        initialProgress[skill.id] = {
          skillId: skill.id,
          practiced: false,
          beforeLevel: skill.currentLevel,
          afterLevel: skill.currentLevel,
          improvement: 0,
          notes: ''
        };
      });
      setSkillProgress(initialProgress);
    } catch (error) {
      console.error('Error fetching skills:', error);
      toast.error('Failed to load skills');
    } finally {
      setLoading(false);
    }
  };

  const toggleSkillPracticed = (skillId: string) => {
    setSkillProgress(prev => ({
      ...prev,
      [skillId]: {
        ...prev[skillId],
        practiced: !prev[skillId].practiced
      }
    }));
  };

  const updateSkillLevel = (skillId: string, level: string) => {
    const levelIndex = PROFICIENCY_LEVELS.findIndex(l => l.value === level);
    const beforeIndex = PROFICIENCY_LEVELS.findIndex(l => l.value === skillProgress[skillId].beforeLevel);
    const improvement = levelIndex - beforeIndex;

    setSkillProgress(prev => ({
      ...prev,
      [skillId]: {
        ...prev[skillId],
        afterLevel: level,
        improvement
      }
    }));
  };

  const updateSkillNotes = (skillId: string, notes: string) => {
    setSkillProgress(prev => ({
      ...prev,
      [skillId]: {
        ...prev[skillId],
        notes
      }
    }));
  };

  const toggleCategory = (category: string) => {
    setExpandedCategories(prev => 
      prev.includes(category) 
        ? prev.filter(c => c !== category)
        : [...prev, category]
    );
  };

  const handleSubmit = async () => {
    try {
      setSubmitting(true);

      const practicedSkills = Object.values(skillProgress).filter(sp => sp.practiced);
      
      if (practicedSkills.length === 0) {
        toast.error('Please select at least one skill that was practiced');
        return;
      }

      const progressData = {
        bookingId: session.bookingId,
        sessionId: session.sessionId,
        packageId: session.packageId,
        petId: session.petId,
        trainerId: vendorId,
        sessionNumber: session.sessionNumber,
        
        skillsProgress: practicedSkills.map(sp => ({
          skillId: sp.skillId,
          beforeLevel: sp.beforeLevel,
          afterLevel: sp.afterLevel,
          notes: sp.notes
        })),
        
        generalNotes,
        behaviorObservations,
        homework,
        nextSessionFocus,
        overallRating,
        photos,
        
        completedAt: new Date().toISOString()
      };

      const response = await apiClient.post<any>(
        `/training/session/${session.bookingId}/progress`,
        progressData
      );

      if (response?.success) {
        toast.success('Session progress saved!');
        if (onSubmit) onSubmit(response);
      } else {
        toast.error(response?.error || 'Failed to save progress');
      }
    } catch (error: any) {
      console.error('Error saving progress:', error);
      toast.error(error.message || 'Failed to save progress');
    } finally {
      setSubmitting(false);
    }
  };

  const groupedSkills = skills.reduce((acc, skill) => {
    if (!acc[skill.skillCategory]) {
      acc[skill.skillCategory] = [];
    }
    acc[skill.skillCategory].push(skill);
    return acc;
  }, {} as Record<string, Skill[]>);

  const categoryLabels: Record<string, string> = {
    basic: '🎯 Basic Commands',
    intermediate: '📈 Intermediate',
    advanced: '🏆 Advanced',
    behavior: '🧠 Behavior',
    specialty: '✨ Specialty'
  };

  const practicedCount = Object.values(skillProgress).filter(sp => sp.practiced).length;
  const improvedCount = Object.values(skillProgress).filter(sp => sp.practiced && sp.improvement > 0).length;

  if (loading) {
    return (
      <div className="bg-white rounded-xl p-6 shadow-sm">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/2" />
          <div className="h-32 bg-gray-200 rounded" />
          <div className="h-32 bg-gray-200 rounded" />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-lg overflow-hidden max-w-2xl mx-auto">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-pink-600 text-white p-6">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-xl font-bold">Session Progress</h2>
          {onCancel && (
            <button onClick={onCancel} className="p-2 hover:bg-white/20 rounded-full">
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
        <p className="text-white/80">
          Session {session.sessionNumber} • {session.petName} ({session.customerName})
        </p>
      </div>

      <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
        {/* Quick Stats */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-purple-50 rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-purple-600">{practicedCount}</p>
            <p className="text-sm text-purple-700">Skills Practiced</p>
          </div>
          <div className="bg-green-50 rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-green-600">{improvedCount}</p>
            <p className="text-sm text-green-700">Skills Improved</p>
          </div>
        </div>

        {/* Skills Practiced */}
        <div>
          <h3 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
            <Target className="w-5 h-5 text-purple-600" />
            Skills Practiced
          </h3>
          
          {Object.entries(groupedSkills).map(([category, categorySkills]) => (
            <div key={category} className="mb-3">
              <button
                onClick={() => toggleCategory(category)}
                className="w-full flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition"
              >
                <span className="font-medium text-gray-900">
                  {categoryLabels[category] || category}
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-500">
                    {categorySkills.filter(s => skillProgress[s.id]?.practiced).length}/{categorySkills.length}
                  </span>
                  {expandedCategories.includes(category) ? (
                    <ChevronUp className="w-4 h-4 text-gray-400" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-gray-400" />
                  )}
                </div>
              </button>

              {expandedCategories.includes(category) && (
                <div className="mt-2 space-y-2">
                  {categorySkills.map(skill => {
                    const progress = skillProgress[skill.id];
                    const isImproved = progress?.practiced && progress.improvement > 0;

                    return (
                      <div 
                        key={skill.id}
                        className={`border rounded-lg p-3 transition ${
                          progress?.practiced 
                            ? 'border-purple-300 bg-purple-50' 
                            : 'border-gray-200'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={progress?.practiced || false}
                              onChange={() => toggleSkillPracticed(skill.id)}
                              className="w-5 h-5 rounded border-gray-300 text-purple-500 focus:ring-purple-500"
                            />
                            <span className="font-medium text-gray-900">{skill.skillName}</span>
                            {isImproved && (
                              <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                                +{progress.improvement} level
                              </span>
                            )}
                          </label>
                          <span className="text-xs text-gray-500">
                            Current: {PROFICIENCY_LEVELS.find(l => l.value === skill.currentLevel)?.label}
                          </span>
                        </div>

                        {progress?.practiced && (
                          <div className="mt-3 space-y-3">
                            {/* Level Selector */}
                            <div>
                              <label className="text-xs text-gray-600 mb-1 block">New Level</label>
                              <div className="flex gap-1">
                                {PROFICIENCY_LEVELS.map(level => (
                                  <button
                                    key={level.value}
                                    onClick={() => updateSkillLevel(skill.id, level.value)}
                                    className={`flex-1 py-2 text-xs rounded transition ${
                                      progress.afterLevel === level.value
                                        ? `bg-${level.color}-500 text-white`
                                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                    }`}
                                  >
                                    {level.label.split(' ')[0]}
                                  </button>
                                ))}
                              </div>
                            </div>

                            {/* Skill Notes */}
                            <Input
                              placeholder="Notes for this skill..."
                              value={progress.notes}
                              onChange={(e) => updateSkillNotes(skill.id, e.target.value)}
                              className="text-sm"
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Behavior Observations */}
        <div>
          <label className="block font-bold text-gray-900 mb-2 flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-purple-600" />
            Behavior Observations
          </label>
          <textarea
            value={behaviorObservations}
            onChange={(e) => setBehaviorObservations(e.target.value)}
            placeholder="Notable behaviors, reactions to stimuli, energy level..."
            className="w-full p-3 border rounded-lg h-24 resize-none text-sm"
          />
        </div>

        {/* Session Notes */}
        <div>
          <label className="block font-bold text-gray-900 mb-2 flex items-center gap-2">
            <FileText className="w-5 h-5 text-purple-600" />
            Session Notes
          </label>
          <textarea
            value={generalNotes}
            onChange={(e) => setGeneralNotes(e.target.value)}
            placeholder="General observations about the session..."
            className="w-full p-3 border rounded-lg h-24 resize-none text-sm"
          />
        </div>

        {/* Homework */}
        <div>
          <label className="block font-bold text-gray-900 mb-2 flex items-center gap-2">
            <Home className="w-5 h-5 text-purple-600" />
            Homework for Owner
          </label>
          <textarea
            value={homework}
            onChange={(e) => setHomework(e.target.value)}
            placeholder="Practice exercises for the owner to do before next session..."
            className="w-full p-3 border rounded-lg h-20 resize-none text-sm"
          />
        </div>

        {/* Next Session Focus */}
        <div>
          <label className="block font-bold text-gray-900 mb-2 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-purple-600" />
            Next Session Focus
          </label>
          <Input
            value={nextSessionFocus}
            onChange={(e) => setNextSessionFocus(e.target.value)}
            placeholder="What to focus on in the next session..."
          />
        </div>

        {/* Overall Rating */}
        <div>
          <label className="block font-bold text-gray-900 mb-2">
            Session Rating
          </label>
          <div className="flex items-center gap-2">
            {[1, 2, 3, 4, 5].map(rating => (
              <button
                key={rating}
                onClick={() => setOverallRating(rating)}
                className="p-1"
              >
                <Star
                  className={`w-8 h-8 ${
                    rating <= overallRating
                      ? 'fill-yellow-400 text-yellow-400'
                      : 'text-gray-300'
                  }`}
                />
              </button>
            ))}
            <span className="text-sm text-gray-500 ml-2">
              {overallRating === 5 && 'Excellent!'}
              {overallRating === 4 && 'Good progress'}
              {overallRating === 3 && 'Average'}
              {overallRating === 2 && 'Needs work'}
              {overallRating === 1 && 'Challenging session'}
            </span>
          </div>
        </div>

        {/* Photos */}
        <div>
          <label className="block font-bold text-gray-900 mb-2 flex items-center gap-2">
            <Camera className="w-5 h-5 text-purple-600" />
            Session Photos
          </label>
          <Button
            variant="outline"
            onClick={() => {
              const url = prompt('Enter photo URL:');
              if (url) setPhotos(prev => [...prev, url]);
            }}
            className="w-full"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Photo ({photos.length})
          </Button>
          {photos.length > 0 && (
            <div className="flex gap-2 mt-2 overflow-x-auto">
              {photos.map((url, i) => (
                <div key={i} className="relative flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden bg-gray-100">
                  <img src={url} alt={`Session photo ${i + 1}`} className="w-full h-full object-cover" />
                  <button
                    onClick={() => setPhotos(prev => prev.filter((_, idx) => idx !== i))}
                    className="absolute top-0 right-0 p-1 bg-red-500 text-white rounded-bl-lg"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Submit Footer */}
      <div className="p-4 bg-gray-50 border-t flex gap-3">
        {onCancel && (
          <Button variant="outline" onClick={onCancel} className="flex-1">
            Cancel
          </Button>
        )}
        <Button
          onClick={handleSubmit}
          disabled={submitting || practicedCount === 0}
          className="flex-1 bg-purple-600 hover:bg-purple-700"
        >
          {submitting ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
              Saving...
            </>
          ) : (
            <>
              <Save className="w-4 h-4 mr-2" />
              Save Progress
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

export default TrainerProgressForm;
