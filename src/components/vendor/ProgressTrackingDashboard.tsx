import { useState, useEffect } from 'react';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { Badge } from '../ui/badge';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { 
  TrendingUp, Plus, Eye, Calendar, User, Award, Target,
  Camera, FileText, BarChart3, CheckCircle, AlertCircle,
  Clock, Heart, Activity, Weight, Ruler, Brain, Bone,
  Search, Filter, Download, Upload, Video, Image as ImageIcon
} from 'lucide-react';
import { projectId, publicAnonKey } from '../../utils/supabase/info';

interface ProgressTracker {
  id: string;
  petId: string;
  petName: string;
  petImage: string;
  customerName: string;
  customerPhone: string;
  programType: 'training' | 'behavioral' | 'nutrition' | 'rehabilitation';
  programName: string;
  startDate: string;
  endDate: string;
  status: 'active' | 'completed' | 'paused' | 'cancelled';
  currentPhase: string;
  completionPercentage: number;
  sessionsCompleted: number;
  totalSessions: number;
  milestones: Milestone[];
  measurements: Measurement[];
  mediaGallery: MediaItem[];
  notes: ProgressNote[];
  goals: Goal[];
  createdAt: string;
}

interface Milestone {
  id: string;
  title: string;
  description: string;
  targetDate: string;
  completedDate?: string;
  status: 'pending' | 'in_progress' | 'completed' | 'missed';
  category: string;
}

interface Measurement {
  id: string;
  date: string;
  type: 'weight' | 'height' | 'chest' | 'waist' | 'body_score' | 'behavior_score' | 'skill_level';
  value: number;
  unit: string;
  notes?: string;
}

interface MediaItem {
  id: string;
  date: string;
  type: 'photo' | 'video';
  url: string;
  caption: string;
  tags: string[];
}

interface ProgressNote {
  id: string;
  date: string;
  sessionNumber: number;
  title: string;
  observations: string;
  improvements: string[];
  challenges: string[];
  recommendations: string;
  nextSteps: string;
  rating: number; // 1-5
}

interface Goal {
  id: string;
  title: string;
  description: string;
  targetDate: string;
  status: 'not_started' | 'in_progress' | 'achieved' | 'abandoned';
  priority: 'high' | 'medium' | 'low';
}

export function ProgressTrackingDashboard({ vendorId, roleType }: { vendorId: string; roleType: 'trainer' | 'behaviorist' | 'nutritionist' }) {
  const [trackers, setTrackers] = useState<ProgressTracker[]>([]);
  const [filteredTrackers, setFilteredTrackers] = useState<ProgressTracker[]>([]);
  const [selectedTracker, setSelectedTracker] = useState<ProgressTracker | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Modals
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showAddNoteModal, setShowAddNoteModal] = useState(false);
  const [showAddMilestoneModal, setShowAddMilestoneModal] = useState(false);
  const [showAddMeasurementModal, setShowAddMeasurementModal] = useState(false);
  const [showMediaUploadModal, setShowMediaUploadModal] = useState(false);
  
  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'completed' | 'paused'>('all');
  const [programFilter, setProgramFilter] = useState<'all' | 'training' | 'behavioral' | 'nutrition' | 'rehabilitation'>('all');

  // Form states
  const [newNote, setNewNote] = useState({
    title: '',
    observations: '',
    improvements: [] as string[],
    challenges: [] as string[],
    recommendations: '',
    nextSteps: '',
    rating: 3
  });

  const [newMilestone, setNewMilestone] = useState({
    title: '',
    description: '',
    targetDate: '',
    category: ''
  });

  const [newMeasurement, setNewMeasurement] = useState({
    type: 'weight' as any,
    value: 0,
    unit: 'kg',
    notes: ''
  });

  useEffect(() => {
    loadTrackers();
  }, [vendorId]);

  useEffect(() => {
    filterTrackers();
  }, [trackers, searchQuery, statusFilter, programFilter]);

  const loadTrackers = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/vendor/${vendorId}/progress-trackers`,
        {
          headers: { 'Authorization': `Bearer ${publicAnonKey}` }
        }
      );

      if (response.ok) {
        const data = await response.json();
        setTrackers(data.trackers || []);
      }
    } catch (error) {
      console.error('Error loading trackers:', error);
    } finally {
      setLoading(false);
    }
  };

  const filterTrackers = () => {
    let filtered = [...trackers];

    if (statusFilter !== 'all') {
      filtered = filtered.filter(t => t.status === statusFilter);
    }

    if (programFilter !== 'all') {
      filtered = filtered.filter(t => t.programType === programFilter);
    }

    if (searchQuery) {
      filtered = filtered.filter(t =>
        t.petName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.programName.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    setFilteredTrackers(filtered);
  };

  const addProgressNote = async () => {
    if (!selectedTracker) return;

    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/vendor/${vendorId}/progress-trackers/${selectedTracker.id}/notes`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            ...newNote,
            sessionNumber: selectedTracker.sessionsCompleted + 1,
            date: new Date().toISOString()
          })
        }
      );

      if (response.ok) {
        await loadTrackers();
        setShowAddNoteModal(false);
        setNewNote({
          title: '',
          observations: '',
          improvements: [],
          challenges: [],
          recommendations: '',
          nextSteps: '',
          rating: 3
        });
        alert('✅ Progress note added successfully!');
      }
    } catch (error) {
      console.error('Error adding note:', error);
      alert('Failed to add progress note');
    }
  };

  const addMilestone = async () => {
    if (!selectedTracker) return;

    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/vendor/${vendorId}/progress-trackers/${selectedTracker.id}/milestones`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            ...newMilestone,
            status: 'pending'
          })
        }
      );

      if (response.ok) {
        await loadTrackers();
        setShowAddMilestoneModal(false);
        alert('✅ Milestone added successfully!');
      }
    } catch (error) {
      console.error('Error adding milestone:', error);
    }
  };

  const addMeasurement = async () => {
    if (!selectedTracker) return;

    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/vendor/${vendorId}/progress-trackers/${selectedTracker.id}/measurements`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            ...newMeasurement,
            date: new Date().toISOString()
          })
        }
      );

      if (response.ok) {
        await loadTrackers();
        setShowAddMeasurementModal(false);
        alert('✅ Measurement recorded successfully!');
      }
    } catch (error) {
      console.error('Error adding measurement:', error);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-green-100 text-green-700"><Activity className="w-3 h-3 mr-1" />Active</Badge>;
      case 'completed':
        return <Badge className="bg-blue-100 text-blue-700"><CheckCircle className="w-3 h-3 mr-1" />Completed</Badge>;
      case 'paused':
        return <Badge className="bg-yellow-100 text-yellow-700"><Clock className="w-3 h-3 mr-1" />Paused</Badge>;
      case 'cancelled':
        return <Badge className="bg-red-100 text-red-700">Cancelled</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  const getProgramTypeLabel = (type: string) => {
    switch (type) {
      case 'training': return 'Training Program';
      case 'behavioral': return 'Behavioral Program';
      case 'nutrition': return 'Nutrition Program';
      case 'rehabilitation': return 'Rehabilitation';
      default: return type;
    }
  };

  const stats = {
    total: trackers.length,
    active: trackers.filter(t => t.status === 'active').length,
    completed: trackers.filter(t => t.status === 'completed').length,
    avgCompletion: trackers.length > 0 
      ? Math.round(trackers.reduce((sum, t) => sum + t.completionPercentage, 0) / trackers.length)
      : 0
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FF8C42] mx-auto mb-4"></div>
          <p className="text-gray-600">Loading progress trackers...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <TrendingUp className="w-7 h-7 text-[#FF8C42]" />
            Progress Tracking
          </h2>
          <p className="text-gray-600 mt-1">Monitor client progress and achievements</p>
        </div>
        <Button variant="outline" onClick={loadTrackers}>
          <Download className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
          <div className="text-sm text-gray-600 mt-1">Total Programs</div>
        </Card>
        <Card className="p-4 border-green-200 bg-green-50">
          <div className="text-2xl font-bold text-green-700">{stats.active}</div>
          <div className="text-sm text-green-600 mt-1">Active</div>
        </Card>
        <Card className="p-4 border-blue-200 bg-blue-50">
          <div className="text-2xl font-bold text-blue-700">{stats.completed}</div>
          <div className="text-sm text-blue-600 mt-1">Completed</div>
        </Card>
        <Card className="p-4 border-purple-200 bg-purple-50">
          <div className="text-2xl font-bold text-purple-700">{stats.avgCompletion}%</div>
          <div className="text-sm text-purple-600 mt-1">Avg Completion</div>
        </Card>
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="grid grid-cols-4 gap-4">
          <div>
            <Label className="text-xs text-gray-600 mb-2">Search</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Pet name, owner..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
          <div>
            <Label className="text-xs text-gray-600 mb-2">Status</Label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="completed">Completed</option>
              <option value="paused">Paused</option>
            </select>
          </div>
          <div>
            <Label className="text-xs text-gray-600 mb-2">Program Type</Label>
            <select
              value={programFilter}
              onChange={(e) => setProgramFilter(e.target.value as any)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            >
              <option value="all">All Programs</option>
              <option value="training">Training</option>
              <option value="behavioral">Behavioral</option>
              <option value="nutrition">Nutrition</option>
              <option value="rehabilitation">Rehabilitation</option>
            </select>
          </div>
          <div className="flex items-end">
            <Button
              variant="outline"
              onClick={() => {
                setSearchQuery('');
                setStatusFilter('all');
                setProgramFilter('all');
              }}
              className="w-full"
            >
              <Filter className="w-4 h-4 mr-2" />
              Clear
            </Button>
          </div>
        </div>
      </Card>

      {/* Trackers List */}
      <div className="grid grid-cols-2 gap-4">
        {filteredTrackers.map((tracker) => (
          <Card key={tracker.id} className="p-5 hover:shadow-lg transition-shadow">
            <div className="flex items-start gap-4">
              <img
                src={tracker.petImage || 'https://images.unsplash.com/photo-1543466835-00a7907e9de1?w=100'}
                alt={tracker.petName}
                className="w-20 h-20 rounded-lg object-cover"
              />
              <div className="flex-1">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <div className="text-lg font-semibold text-gray-900">{tracker.petName}</div>
                    <div className="text-sm text-gray-600">{tracker.customerName}</div>
                  </div>
                  {getStatusBadge(tracker.status)}
                </div>

                <div className="mb-3">
                  <div className="text-sm font-medium text-gray-700 mb-1">{tracker.programName}</div>
                  <div className="text-xs text-gray-600">{getProgramTypeLabel(tracker.programType)}</div>
                </div>

                {/* Progress Bar */}
                <div className="mb-3">
                  <div className="flex items-center justify-between text-xs text-gray-600 mb-1">
                    <span>Progress</span>
                    <span className="font-semibold">{tracker.completionPercentage}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-[#FF8C42] h-2 rounded-full transition-all"
                      style={{ width: `${tracker.completionPercentage}%` }}
                    />
                  </div>
                </div>

                {/* Stats */}
                <div className="flex items-center gap-4 mb-3 text-xs text-gray-600">
                  <div className="flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    <span>{tracker.sessionsCompleted}/{tracker.totalSessions} sessions</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Target className="w-3 h-3" />
                    <span>{tracker.milestones.filter(m => m.status === 'completed').length}/{tracker.milestones.length} milestones</span>
                  </div>
                </div>

                {/* Phase */}
                {tracker.currentPhase && (
                  <Badge variant="outline" className="text-xs mb-3">
                    Phase: {tracker.currentPhase}
                  </Badge>
                )}

                {/* Actions */}
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSelectedTracker(tracker);
                      setShowDetailModal(true);
                    }}
                    className="flex-1"
                  >
                    <Eye className="w-4 h-4 mr-2" />
                    View Details
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => {
                      setSelectedTracker(tracker);
                      setShowAddNoteModal(true);
                    }}
                    className="flex-1 bg-[#FF8C42] hover:bg-[#ff7a2e]"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add Note
                  </Button>
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Detail Modal */}
      <Dialog open={showDetailModal} onOpenChange={setShowDetailModal}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Progress Details - {selectedTracker?.petName}</DialogTitle>
          </DialogHeader>
          {selectedTracker && (
            <div className="space-y-6">
              {/* Header Info */}
              <div className="flex items-start gap-4">
                <img
                  src={selectedTracker.petImage || 'https://images.unsplash.com/photo-1543466835-00a7907e9de1?w=120'}
                  alt={selectedTracker.petName}
                  className="w-24 h-24 rounded-lg object-cover"
                />
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <div className="text-2xl font-bold text-gray-900">{selectedTracker.petName}</div>
                      <div className="text-gray-600">{selectedTracker.customerName}</div>
                    </div>
                    {getStatusBadge(selectedTracker.status)}
                  </div>
                  <div className="text-sm text-gray-700 mb-2">{selectedTracker.programName}</div>
                  <div className="flex items-center gap-4 text-xs text-gray-600">
                    <div>Start: {new Date(selectedTracker.startDate).toLocaleDateString()}</div>
                    <div>End: {new Date(selectedTracker.endDate).toLocaleDateString()}</div>
                    <div>{selectedTracker.sessionsCompleted}/{selectedTracker.totalSessions} sessions</div>
                  </div>
                </div>
              </div>

              {/* Progress Bar */}
              <Card className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-semibold">Overall Progress</span>
                  <span className="text-2xl font-bold text-[#FF8C42]">{selectedTracker.completionPercentage}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div 
                    className="bg-[#FF8C42] h-3 rounded-full transition-all"
                    style={{ width: `${selectedTracker.completionPercentage}%` }}
                  />
                </div>
              </Card>

              {/* Tabs */}
              <div className="border-b border-gray-200">
                <div className="flex gap-4">
                  {['Milestones', 'Measurements', 'Notes', 'Media', 'Goals'].map(tab => (
                    <Button key={tab} className="px-4 py-2 border-b-2 border-[#FF8C42] text-[#FF8C42] font-semibold">
                      {tab}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Milestones */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-lg">Milestones</h3>
                  <Button
                    size="sm"
                    onClick={() => setShowAddMilestoneModal(true)}
                    variant="outline"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add Milestone
                  </Button>
                </div>
                <div className="space-y-3">
                  {selectedTracker.milestones.map((milestone) => (
                    <Card key={milestone.id} className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            {milestone.status === 'completed' ? (
                              <CheckCircle className="w-5 h-5 text-green-600" />
                            ) : (
                              <Clock className="w-5 h-5 text-gray-400" />
                            )}
                            <span className="font-semibold">{milestone.title}</span>
                          </div>
                          <div className="text-sm text-gray-600 mb-2">{milestone.description}</div>
                          <div className="flex items-center gap-3 text-xs text-gray-500">
                            <span>Target: {new Date(milestone.targetDate).toLocaleDateString()}</span>
                            {milestone.completedDate && (
                              <span className="text-green-600">Completed: {new Date(milestone.completedDate).toLocaleDateString()}</span>
                            )}
                          </div>
                        </div>
                        <Badge
                          variant="outline"
                          className={
                            milestone.status === 'completed'
                              ? 'bg-green-50 text-green-700'
                              : milestone.status === 'in_progress'
                              ? 'bg-blue-50 text-blue-700'
                              : milestone.status === 'missed'
                              ? 'bg-red-50 text-red-700'
                              : 'bg-gray-50 text-gray-700'
                          }
                        >
                          {milestone.status.replace('_', ' ')}
                        </Badge>
                      </div>
                    </Card>
                  ))}
                </div>
              </div>

              {/* Measurements Chart Placeholder */}
              <Card className="p-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-lg">Measurements</h3>
                  <Button
                    size="sm"
                    onClick={() => setShowAddMeasurementModal(true)}
                    variant="outline"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Record Measurement
                  </Button>
                </div>
                <div className="h-48 bg-gray-100 rounded-lg flex items-center justify-center">
                  <div className="text-center text-gray-500">
                    <BarChart3 className="w-12 h-12 mx-auto mb-2" />
                    <div>Measurement chart visualization</div>
                  </div>
                </div>
              </Card>

              {/* Recent Notes */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-lg">Progress Notes</h3>
                  <Button
                    size="sm"
                    onClick={() => setShowAddNoteModal(true)}
                    className="bg-[#FF8C42] hover:bg-[#ff7a2e]"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add Note
                  </Button>
                </div>
                <div className="space-y-3">
                  {selectedTracker.notes.slice(0, 3).map((note) => (
                    <Card key={note.id} className="p-4">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <div className="font-semibold">Session {note.sessionNumber}: {note.title}</div>
                          <div className="text-xs text-gray-600">{new Date(note.date).toLocaleDateString()}</div>
                        </div>
                        <div className="flex items-center gap-1">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <Heart
                              key={i}
                              className={`w-4 h-4 ${i < note.rating ? 'fill-[#FF8C42] text-[#FF8C42]' : 'text-gray-300'}`}
                            />
                          ))}
                        </div>
                      </div>
                      <div className="text-sm text-gray-700 mb-2">{note.observations}</div>
                      {note.improvements.length > 0 && (
                        <div className="mb-2">
                          <div className="text-xs font-semibold text-green-700 mb-1">Improvements:</div>
                          <div className="flex flex-wrap gap-1">
                            {note.improvements.map((imp, idx) => (
                              <Badge key={idx} variant="outline" className="bg-green-50 text-green-700 text-xs">
                                {imp}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                      {note.challenges.length > 0 && (
                        <div>
                          <div className="text-xs font-semibold text-orange-700 mb-1">Challenges:</div>
                          <div className="flex flex-wrap gap-1">
                            {note.challenges.map((ch, idx) => (
                              <Badge key={idx} variant="outline" className="bg-orange-50 text-orange-700 text-xs">
                                {ch}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                    </Card>
                  ))}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Add Note Modal */}
      <Dialog open={showAddNoteModal} onOpenChange={setShowAddNoteModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Add Progress Note - Session {(selectedTracker?.sessionsCompleted || 0) + 1}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Session Title *</Label>
              <Input
                value={newNote.title}
                onChange={(e) => setNewNote({...newNote, title: e.target.value})}
                placeholder="e.g., Basic obedience training"
              />
            </div>

            <div>
              <Label>Observations *</Label>
              <Textarea
                value={newNote.observations}
                onChange={(e) => setNewNote({...newNote, observations: e.target.value})}
                placeholder="Describe what happened during this session..."
                rows={4}
              />
            </div>

            <div>
              <Label>Recommendations</Label>
              <Textarea
                value={newNote.recommendations}
                onChange={(e) => setNewNote({...newNote, recommendations: e.target.value})}
                placeholder="Recommendations for next session..."
                rows={3}
              />
            </div>

            <div>
              <Label>Session Rating</Label>
              <div className="flex gap-2 mt-2">
                {[1, 2, 3, 4, 5].map((rating) => (
                  <Button
                    key={rating}
                    onClick={() => setNewNote({...newNote, rating})}
                    className="p-2"
                  >
                    <Heart
                      className={`w-6 h-6 ${rating <= newNote.rating ? 'fill-[#FF8C42] text-[#FF8C42]' : 'text-gray-300'}`}
                    />
                  </Button>
                ))}
              </div>
            </div>

            <div className="flex gap-3">
              <Button onClick={addProgressNote} className="flex-1 bg-[#FF8C42] hover:bg-[#ff7a2e]">
                <Plus className="w-4 h-4 mr-2" />
                Add Note
              </Button>
              <Button variant="outline" onClick={() => setShowAddNoteModal(false)} className="flex-1">
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Milestone Modal */}
      <Dialog open={showAddMilestoneModal} onOpenChange={setShowAddMilestoneModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Milestone</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Milestone Title *</Label>
              <Input
                value={newMilestone.title}
                onChange={(e) => setNewMilestone({...newMilestone, title: e.target.value})}
                placeholder="e.g., Master sit command"
              />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea
                value={newMilestone.description}
                onChange={(e) => setNewMilestone({...newMilestone, description: e.target.value})}
                rows={3}
              />
            </div>
            <div>
              <Label>Target Date</Label>
              <Input
                type="date"
                value={newMilestone.targetDate}
                onChange={(e) => setNewMilestone({...newMilestone, targetDate: e.target.value})}
              />
            </div>
            <div className="flex gap-3">
              <Button onClick={addMilestone} className="flex-1 bg-[#FF8C42] hover:bg-[#ff7a2e]">
                Add Milestone
              </Button>
              <Button variant="outline" onClick={() => setShowAddMilestoneModal(false)} className="flex-1">
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Measurement Modal */}
      <Dialog open={showAddMeasurementModal} onOpenChange={setShowAddMeasurementModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record Measurement</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Measurement Type</Label>
              <select
                value={newMeasurement.type}
                onChange={(e) => setNewMeasurement({...newMeasurement, type: e.target.value as any})}
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
              >
                <option value="weight">Weight</option>
                <option value="height">Height</option>
                <option value="body_score">Body Condition Score</option>
                <option value="behavior_score">Behavior Score</option>
                <option value="skill_level">Skill Level</option>
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Value *</Label>
                <Input
                  type="number"
                  value={newMeasurement.value}
                  onChange={(e) => setNewMeasurement({...newMeasurement, value: parseFloat(e.target.value)})}
                />
              </div>
              <div>
                <Label>Unit</Label>
                <Input
                  value={newMeasurement.unit}
                  onChange={(e) => setNewMeasurement({...newMeasurement, unit: e.target.value})}
                  placeholder="kg, cm, score..."
                />
              </div>
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea
                value={newMeasurement.notes}
                onChange={(e) => setNewMeasurement({...newMeasurement, notes: e.target.value})}
                rows={2}
              />
            </div>
            <div className="flex gap-3">
              <Button onClick={addMeasurement} className="flex-1 bg-[#FF8C42] hover:bg-[#ff7a2e]">
                Record
              </Button>
              <Button variant="outline" onClick={() => setShowAddMeasurementModal(false)} className="flex-1">
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
