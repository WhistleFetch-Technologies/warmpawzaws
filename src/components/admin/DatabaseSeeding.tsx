"use client";

import { useState, useEffect } from 'react';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { 
  Database, 
  Package,
  RefreshCw,
  CheckCircle,
  XCircle,
  Loader2,
  Download,
  Upload,
  Trash2
} from 'lucide-react';
import { projectId } from '../../utils/supabase/info';
import { authenticatedGet, authenticatedPost } from '../../utils/authenticatedFetch';
import { toast } from 'sonner@2.0.3';

interface SeedingTask {
  id: string;
  type: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress: number;
  message: string;
  createdAt: string;
}

export function DatabaseSeeding({ onBack }: { onBack?: () => void }) {
  const [activeTab, setActiveTab] = useState<'services' | 'categories' | 'roles' | 'history'>('services');
  const [loading, setLoading] = useState(false);
  const [seedingHistory, setSeedingHistory] = useState<SeedingTask[]>([]);
  const [selectedCategory, setSelectedCategory] = useState('all');

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    try {
      const res = await authenticatedGet(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/admin/seeding/history`
      );
      if (res.success) {
        setSeedingHistory(res.data.tasks || []);
      }
    } catch (error) {
      console.error('Error loading seeding history:', error);
    }
  };

  const handleSeedServices = async (category?: string) => {
    try {
      setLoading(true);
      const res = await authenticatedPost(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/admin/seeding/services/seed`,
        { category: category || 'all' }
      );
      
      if (res.success) {
        toast.success(`Successfully seeded ${res.data.count || 0} services`);
        await loadHistory();
      } else {
        toast.error(res.error || 'Failed to seed services');
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to seed services');
    } finally {
      setLoading(false);
    }
  };

  const handleSeedCategories = async () => {
    try {
      setLoading(true);
      const res = await authenticatedPost(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/admin/seeding/categories/seed`
      );
      
      if (res.success) {
        toast.success(`Successfully seeded ${res.data.count || 0} categories`);
        await loadHistory();
      } else {
        toast.error(res.error || 'Failed to seed categories');
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to seed categories');
    } finally {
      setLoading(false);
    }
  };

  const handleSeedRoles = async () => {
    try {
      setLoading(true);
      const res = await authenticatedPost(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/admin/seeding/roles/seed`
      );
      
      if (res.success) {
        toast.success(`Successfully seeded ${res.data.count || 0} roles`);
        await loadHistory();
      } else {
        toast.error(res.error || 'Failed to seed roles');
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to seed roles');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            {onBack && (
              <Button variant="ghost" onClick={onBack} className="text-gray-600">
                ← Back
              </Button>
            )}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center">
                <Database className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Database Seeding</h1>
                <p className="text-sm text-gray-500">Seed initial data for services, categories, and roles</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white border-b border-gray-200 px-6">
        <div className="flex gap-1">
          {[
            { id: 'services', label: 'Services', icon: Package },
            { id: 'categories', label: 'Categories', icon: Database },
            { id: 'roles', label: 'Roles', icon: Database },
            { id: 'history', label: 'History', icon: RefreshCw }
          ].map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-600 hover:text-gray-900'
                }`}
              >
                <Icon className="w-4 h-4 inline mr-2" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        {activeTab === 'services' && (
          <div className="space-y-6">
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">Seed Services</h3>
              <p className="text-sm text-gray-600 mb-6">
                Seed standard services for the platform. This will create service templates that vendors can use.
              </p>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Select Category
                  </label>
                  <select
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  >
                    <option value="all">All Categories</option>
                    <option value="healthcare">Healthcare</option>
                    <option value="grooming">Grooming</option>
                    <option value="training">Training</option>
                    <option value="boarding">Boarding</option>
                    <option value="walking">Walking</option>
                  </select>
                </div>
                
                <Button
                  onClick={() => handleSeedServices(selectedCategory === 'all' ? undefined : selectedCategory)}
                  disabled={loading}
                  className="w-full"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Seeding...
                    </>
                  ) : (
                    <>
                      <Package className="w-4 h-4 mr-2" />
                      Seed Services
                    </>
                  )}
                </Button>
              </div>
            </Card>
          </div>
        )}

        {activeTab === 'categories' && (
          <div className="space-y-6">
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">Seed Categories</h3>
              <p className="text-sm text-gray-600 mb-6">
                Seed service categories and subcategories for the platform.
              </p>
              
              <Button
                onClick={handleSeedCategories}
                disabled={loading}
                className="w-full"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Seeding...
                  </>
                ) : (
                  <>
                    <Database className="w-4 h-4 mr-2" />
                    Seed Categories
                  </>
                )}
              </Button>
            </Card>
          </div>
        )}

        {activeTab === 'roles' && (
          <div className="space-y-6">
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">Seed Roles</h3>
              <p className="text-sm text-gray-600 mb-6">
                Seed standard vendor roles (Vet, Groomer, Trainer, etc.) with default permissions.
              </p>
              
              <Button
                onClick={handleSeedRoles}
                disabled={loading}
                className="w-full"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Seeding...
                  </>
                ) : (
                  <>
                    <Database className="w-4 h-4 mr-2" />
                    Seed Roles
                  </>
                )}
              </Button>
            </Card>
          </div>
        )}

        {activeTab === 'history' && (
          <div className="space-y-6">
            <Card className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">Seeding History</h3>
                <Button variant="outline" onClick={loadHistory}>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Refresh
                </Button>
              </div>
              
              {seedingHistory.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  No seeding history found
                </div>
              ) : (
                <div className="space-y-3">
                  {seedingHistory.map((task) => (
                    <div
                      key={task.id}
                      className="flex items-center justify-between p-4 border border-gray-200 rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        {task.status === 'completed' ? (
                          <CheckCircle className="w-5 h-5 text-green-600" />
                        ) : task.status === 'failed' ? (
                          <XCircle className="w-5 h-5 text-red-600" />
                        ) : (
                          <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
                        )}
                        <div>
                          <p className="font-medium">{task.type}</p>
                          <p className="text-sm text-gray-500">{task.message}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-gray-500">
                          {new Date(task.createdAt).toLocaleString()}
                        </p>
                        {task.status === 'running' && (
                          <p className="text-sm text-blue-600">{task.progress}%</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}

