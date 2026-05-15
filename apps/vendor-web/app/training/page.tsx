'use client';

/**
 * Training Programs Management Page
 * Manages training programs and progress tracking
 * Capability: training_programs, progress_tracking
 */

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api-client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { 
  GraduationCap, 
  Plus, 
  Calendar,
  Clock,
  Users,
  TrendingUp,
  Target,
  Award
} from 'lucide-react';

interface TrainingProgram {
  id: string;
  name: string;
  description?: string;
  category: string;
  duration_weeks: number;
  sessions_per_week: number;
  price: number;
  max_pets: number;
  skill_level: 'beginner' | 'intermediate' | 'advanced';
  is_active: boolean;
  enrolled_count?: number;
  created_at: string;
}

export default function TrainingPage() {
  const router = useRouter();
  const [vendorId, setVendorId] = useState<string | null>(null);
  const [programs, setPrograms] = useState<TrainingProgram[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newProgram, setNewProgram] = useState({
    name: '',
    description: '',
    category: 'obedience',
    durationWeeks: 4,
    sessionsPerWeek: 2,
    price: 0,
    maxPets: 5,
    skillLevel: 'beginner' as 'beginner' | 'intermediate' | 'advanced',
  });

  useEffect(() => {
    const storedVendorId = localStorage.getItem('vendorId');
    if (!storedVendorId) {
      router.push('/onboarding');
      return;
    }
    setVendorId(storedVendorId);
    fetchPrograms(storedVendorId);
  }, [router]);

  const fetchPrograms = async (vId?: string) => {
    const id = vId || vendorId;
    if (!id) return;
    
    setLoading(true);
    try {
      const data = await apiClient.get<{ success: boolean; programs: TrainingProgram[] }>(`/vendor/${id}/training/programs`);
      setPrograms(data.programs || []);
    } catch (error: any) {
      console.error('Error fetching programs:', error);
      if (error.message?.includes('403')) {
        toast.error('You do not have access to training management');
      }
    } finally {
      setLoading(false);
    }
  };

  const addProgram = async () => {
    if (!vendorId || !newProgram.name || !newProgram.price) {
      toast.error('Please fill in required fields');
      return;
    }

    try {
      await apiClient.post(`/vendor/${vendorId}/training/programs`, newProgram);
      toast.success('Training program created successfully');
      setShowAddModal(false);
      setNewProgram({
        name: '',
        description: '',
        category: 'obedience',
        durationWeeks: 4,
        sessionsPerWeek: 2,
        price: 0,
        maxPets: 5,
        skillLevel: 'beginner',
      });
      fetchPrograms();
    } catch (error: any) {
      console.error('Error creating program:', error);
      toast.error(error.message || 'Failed to create program');
    }
  };

  const stats = {
    total: programs.length,
    active: programs.filter(p => p.is_active).length,
    enrolled: programs.reduce((sum, p) => sum + (p.enrolled_count || 0), 0),
  };

  const getSkillColor = (level: string) => {
    switch (level) {
      case 'advanced': return 'bg-red-100 text-red-800';
      case 'intermediate': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-green-100 text-green-800';
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-center">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <GraduationCap className="h-8 w-8 text-indigo-500" />
            Training Programs
          </h1>
          <p className="text-muted-foreground">Manage training programs and track progress</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => router.push('/training/progress')}>
            <TrendingUp className="h-4 w-4 mr-2" />
            Enrollment progress
          </Button>
          <Button onClick={() => setShowAddModal(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Create Program
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <Target className="h-10 w-10 text-indigo-500" />
            <div>
              <p className="text-sm text-muted-foreground">Total Programs</p>
              <p className="text-2xl font-bold">{stats.total}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <TrendingUp className="h-10 w-10 text-green-500" />
            <div>
              <p className="text-sm text-muted-foreground">Active Programs</p>
              <p className="text-2xl font-bold">{stats.active}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <Users className="h-10 w-10 text-blue-500" />
            <div>
              <p className="text-sm text-muted-foreground">Total Enrolled</p>
              <p className="text-2xl font-bold">{stats.enrolled}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Programs Grid */}
      {loading ? (
        <div className="text-center py-12">Loading programs...</div>
      ) : programs.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            <GraduationCap className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold">No training programs yet</h3>
            <p className="text-muted-foreground mb-4">Create your first training program to get started</p>
            <Button onClick={() => setShowAddModal(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Create Program
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {programs.map((program) => (
            <Card key={program.id}>
              <CardHeader className="pb-2">
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Award className="h-5 w-5" />
                      {program.name}
                    </CardTitle>
                    <Badge className={getSkillColor(program.skill_level)}>
                      {program.skill_level}
                    </Badge>
                  </div>
                  <Badge variant={program.is_active ? 'default' : 'secondary'}>
                    {program.is_active ? 'Active' : 'Inactive'}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span>{program.duration_weeks} weeks • {program.sessions_per_week} sessions/week</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <span>Max {program.max_pets} pets • {program.enrolled_count || 0} enrolled</span>
                </div>
                <div className="text-lg font-semibold">₹{program.price.toLocaleString()}</div>
                {program.description && (
                  <p className="text-sm text-muted-foreground line-clamp-2">{program.description}</p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Add Program Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md mx-4">
            <CardHeader>
              <CardTitle>Create Training Program</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium">Program Name *</label>
                <Input
                  value={newProgram.name}
                  onChange={(e) => setNewProgram(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g., Basic Obedience Training"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Description</label>
                <textarea
                  className="w-full border rounded-md p-2 min-h-[60px]"
                  value={newProgram.description}
                  onChange={(e) => setNewProgram(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Describe the program"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Duration (weeks)</label>
                  <Input
                    type="number"
                    value={newProgram.durationWeeks}
                    onChange={(e) => setNewProgram(prev => ({ ...prev, durationWeeks: parseInt(e.target.value) || 1 }))}
                    min={1}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Sessions/Week</label>
                  <Input
                    type="number"
                    value={newProgram.sessionsPerWeek}
                    onChange={(e) => setNewProgram(prev => ({ ...prev, sessionsPerWeek: parseInt(e.target.value) || 1 }))}
                    min={1}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Price (₹) *</label>
                  <Input
                    type="number"
                    value={newProgram.price}
                    onChange={(e) => setNewProgram(prev => ({ ...prev, price: parseFloat(e.target.value) || 0 }))}
                    min={0}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Skill Level</label>
                  <select
                    className="w-full border rounded-md p-2"
                    value={newProgram.skillLevel}
                    onChange={(e) => setNewProgram(prev => ({ ...prev, skillLevel: e.target.value as any }))}
                  >
                    <option value="beginner">Beginner</option>
                    <option value="intermediate">Intermediate</option>
                    <option value="advanced">Advanced</option>
                  </select>
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setShowAddModal(false)} className="flex-1">
                  Cancel
                </Button>
                <Button onClick={addProgram} className="flex-1">
                  Create Program
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
