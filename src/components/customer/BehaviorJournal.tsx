import { useState, useEffect } from 'react';
import { BookOpen, Plus, TrendingUp, AlertCircle, Calendar, Tag } from 'lucide-react';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { projectId, publicAnonKey } from '../../utils/supabase/info';
import { toast } from 'sonner@2.0.3';

interface BehaviorJournalProps {
  petId: string;
  customerId: string;
}

export function BehaviorJournal({ petId, customerId }: BehaviorJournalProps) {
  const [journal, setJournal] = useState<any[]>([]);
  const [trends, setTrends] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [formData, setFormData] = useState({
    behavior: '',
    triggers: '',
    duration: '',
    severity: 'medium',
    notes: ''
  });

  const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475`;

  useEffect(() => {
    fetchJournal();
  }, [petId]);

  const fetchJournal = async () => {
    try {
      const response = await fetch(`${API_BASE}/behaviorist/journal/${petId}`, {
        headers: { 'Authorization': `Bearer ${publicAnonKey}` }
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setJournal(data.journal);
          setTrends(data.trends);
        }
      }
    } catch (error) {
      console.error('Failed to fetch journal:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const response = await fetch(`${API_BASE}/behaviorist/journal-entry`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${publicAnonKey}`
        },
        body: JSON.stringify({
          petId,
          customerId,
          behavior: formData.behavior,
          triggers: formData.triggers.split(',').map(t => t.trim()).filter(Boolean),
          duration: formData.duration,
          severity: formData.severity,
          notes: formData.notes
        })
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          toast.success('Journal entry added successfully');
          setFormData({
            behavior: '',
            triggers: '',
            duration: '',
            severity: 'medium',
            notes: ''
          });
          setShowAddForm(false);
          fetchJournal();
        }
      }
    } catch (error) {
      console.error('Failed to add journal entry:', error);
      toast.error('Failed to add entry. Please try again.');
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'low': return 'bg-green-100 text-green-700 border-green-200';
      case 'medium': return 'bg-yellow-100 text-yellow-700 border-yellow-200';
      case 'high': return 'bg-red-100 text-red-700 border-red-200';
      default: return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  if (loading) {
    return (
      <div className="py-8 text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-2"></div>
        <p className="text-sm text-gray-500">Loading behavior journal...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-blue-600" />
          <h3 className="font-bold text-gray-900">Behavior Journal</h3>
        </div>
        <Button
          onClick={() => setShowAddForm(!showAddForm)}
          size="sm"
          className="bg-blue-600 hover:bg-[#FF8C42] blue-700 text-white"
        >
          <Plus className="w-4 h-4 mr-1" />
          Add Entry
        </Button>
      </div>

      {/* Trends Summary */}
      {trends && trends.totalEntries > 0 && (
        <Card className="p-4 bg-[#FF8C42] gradient-to-r from-blue-50 to-purple-50 border-blue-200">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="w-5 h-5 text-blue-600" />
            <h4 className="font-bold text-gray-900">Behavior Trends</h4>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-xs text-gray-600 mb-1">Total Entries</p>
              <p className="text-2xl font-bold text-gray-900">{trends.totalEntries}</p>
            </div>
            
            {trends.mostCommonBehavior && (
              <div>
                <p className="text-xs text-gray-600 mb-1">Most Common</p>
                <p className="font-bold text-gray-900 capitalize">{trends.mostCommonBehavior}</p>
              </div>
            )}
            
            {trends.mostCommonTrigger && (
              <div>
                <p className="text-xs text-gray-600 mb-1">Main Trigger</p>
                <p className="font-bold text-gray-900 capitalize">{trends.mostCommonTrigger}</p>
              </div>
            )}
            
            <div>
              <p className="text-xs text-gray-600 mb-1">Severity</p>
              <div className="flex gap-1">
                <span className="text-xs font-semibold text-green-600">
                  {trends.severityDistribution.low}L
                </span>
                <span className="text-xs font-semibold text-yellow-600">
                  {trends.severityDistribution.medium}M
                </span>
                <span className="text-xs font-semibold text-red-600">
                  {trends.severityDistribution.high}H
                </span>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Add Entry Form */}
      {showAddForm && (
        <Card className="p-4">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Behavior Description *
              </label>
              <input
                type="text"
                value={formData.behavior}
                onChange={(e) => setFormData({ ...formData, behavior: e.target.value })}
                placeholder="e.g., Excessive barking, Jumping on guests"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Triggers (comma-separated)
              </label>
              <input
                type="text"
                value={formData.triggers}
                onChange={(e) => setFormData({ ...formData, triggers: e.target.value })}
                placeholder="e.g., Doorbell, Strangers, Other dogs"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Duration
                </label>
                <input
                  type="text"
                  value={formData.duration}
                  onChange={(e) => setFormData({ ...formData, duration: e.target.value })}
                  placeholder="e.g., 5 minutes"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Severity *
                </label>
                <select
                  value={formData.severity}
                  onChange={(e) => setFormData({ ...formData, severity: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  required
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Notes
              </label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Additional observations or context..."
                rows={3}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              />
            </div>

            <div className="flex gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowAddForm(false)}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="flex-1 bg-blue-600 hover:bg-[#FF8C42] blue-700 text-white"
              >
                Add Entry
              </Button>
            </div>
          </form>
        </Card>
      )}

      {/* Journal Entries */}
      {journal.length === 0 ? (
        <Card className="p-8 text-center bg-[#FF8C42] gray-50">
          <BookOpen className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-600 mb-1">No journal entries yet</p>
          <p className="text-sm text-gray-500">Start tracking your pet's behavior patterns</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {journal.map((entry) => (
            <Card key={entry.id} className="p-4">
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <h4 className="font-bold text-gray-900 mb-1 capitalize">
                    {entry.behavior}
                  </h4>
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <Calendar className="w-3.5 h-3.5" />
                    <span>{new Date(entry.date).toLocaleDateString()}</span>
                  </div>
                </div>
                <div className={`px-2 py-1 rounded-full text-xs font-semibold border ${getSeverityColor(entry.severity)}`}>
                  {entry.severity.toUpperCase()}
                </div>
              </div>

              {entry.triggers && entry.triggers.length > 0 && (
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  <Tag className="w-3.5 h-3.5 text-gray-400" />
                  {entry.triggers.map((trigger: string, idx: number) => (
                    <span key={idx} className="text-xs bg-[#FF8C42] gray-100 text-gray-700 px-2 py-1 rounded-full">
                      {trigger}
                    </span>
                  ))}
                </div>
              )}

              {entry.duration && (
                <p className="text-sm text-gray-600 mb-2">
                  <strong>Duration:</strong> {entry.duration}
                </p>
              )}

              {entry.notes && (
                <p className="text-sm text-gray-700 bg-[#FF8C42] gray-50 p-2 rounded">
                  {entry.notes}
                </p>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
