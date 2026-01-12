import React, { useState, useEffect } from 'react';
import { Button } from '../ui/button';
import { 
  RefreshCw, 
  Database, 
  TrendingUp, 
  Search, 
  Activity,
  AlertCircle,
  CheckCircle,
  Clock,
  BarChart3
} from 'lucide-react';
import { toast } from 'sonner';
import { projectId, publicAnonKey } from '../../utils/supabase/info';

const BASE_URL = `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475`;

interface IndexStatus {
  exists: boolean;
  documentCount: number;
  size: string;
  health: 'green' | 'yellow' | 'red' | 'N/A';
}

interface SearchAnalytics {
  topSearches: { query: string; count: number }[];
  zeroResultSearches: { query: string; count: number }[];
  searchesByCategory: { category: string; count: number }[];
  totalSearches: number;
  averageSearchTime: number;
}

export function ElasticsearchManager() {
  const [indices, setIndices] = useState<Record<string, IndexStatus>>({});
  const [analytics, setAnalytics] = useState<SearchAnalytics | null>(null);
  const [clusterHealth, setClusterHealth] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [reindexing, setReindexing] = useState(false);
  const [initializing, setInitializing] = useState(false);

  useEffect(() => {
    fetchAll();
  }, []);

  const fetchAll = async () => {
    await Promise.all([
      fetchIndicesStatus(),
      fetchSearchAnalytics(),
      fetchClusterHealth()
    ]);
  };

  const fetchClusterHealth = async () => {
    try {
      const response = await fetch(
        `${BASE_URL}/elasticsearch/health`,
        {
          headers: { 'Authorization': `Bearer ${publicAnonKey}` }
        }
      );

      if (response.ok) {
        const data = await response.json();
        setClusterHealth(data.health);
      }
    } catch (error) {
      console.error('Error fetching cluster health:', error);
    }
  };

  const fetchIndicesStatus = async () => {
    try {
      const response = await fetch(
        `${BASE_URL}/elasticsearch/indices/status`,
        {
          headers: { 'Authorization': `Bearer ${publicAnonKey}` }
        }
      );

      if (response.ok) {
        const data = await response.json();
        setIndices(data.indices || {});
      }
    } catch (error) {
      console.error('Error fetching indices status:', error);
      toast.error('Failed to fetch indices status');
    }
  };

  const fetchSearchAnalytics = async () => {
    try {
      const response = await fetch(
        `${BASE_URL}/elasticsearch/analytics`,
        {
          headers: { 'Authorization': `Bearer ${publicAnonKey}` }
        }
      );

      if (response.ok) {
        const data = await response.json();
        setAnalytics(data.analytics);
      }
    } catch (error) {
      console.error('Error fetching analytics:', error);
      toast.error('Failed to fetch search analytics');
    }
  };

  const handleInitializeIndices = async () => {
    setInitializing(true);
    try {
      const response = await fetch(
        `${BASE_URL}/elasticsearch/init`,
        {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${publicAnonKey}` }
        }
      );

      if (response.ok) {
        toast.success('Indices initialized successfully');
        await fetchIndicesStatus();
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to initialize indices');
      }
    } catch (error) {
      console.error('Error initializing indices:', error);
      toast.error('Error initializing indices');
    } finally {
      setInitializing(false);
    }
  };

  const handleReindexAll = async () => {
    if (!confirm('This will reindex all data. This may take several minutes. Continue?')) {
      return;
    }

    setReindexing(true);
    try {
      const response = await fetch(
        `${BASE_URL}/elasticsearch/reindex/all`,
        {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${publicAnonKey}` }
        }
      );

      if (response.ok) {
        const data = await response.json();
        toast.success(`Reindexing completed: ${JSON.stringify(data.results)}`);
        await fetchIndicesStatus();
      } else {
        toast.error('Reindexing failed');
      }
    } catch (error) {
      console.error('Error during reindex:', error);
      toast.error('Error during reindex');
    } finally {
      setReindexing(false);
    }
  };

  const handleReindexSingle = async (indexType: string) => {
    if (!confirm(`Reindex ${indexType}? This may take a few minutes.`)) {
      return;
    }

    setLoading(true);
    try {
      // In production, you'd have a single-index reindex endpoint
      toast.info('Single index reindex not yet implemented. Use "Reindex All" for now.');
    } catch (error) {
      console.error('Error reindexing:', error);
      toast.error('Error reindexing');
    } finally {
      setLoading(false);
    }
  };

  const getHealthColor = (health: string) => {
    switch (health) {
      case 'green': return 'bg-green-100 text-green-700';
      case 'yellow': return 'bg-yellow-100 text-yellow-700';
      case 'red': return 'bg-red-100 text-red-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const getHealthIcon = (health: string) => {
    switch (health) {
      case 'green': return <CheckCircle className="w-4 h-4" />;
      case 'yellow': return <AlertCircle className="w-4 h-4" />;
      case 'red': return <AlertCircle className="w-4 h-4" />;
      default: return <Activity className="w-4 h-4" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Elasticsearch Management</h1>
          <p className="text-gray-600 mt-1">Manage search indices and view analytics</p>
        </div>
        <Button
          onClick={fetchAll}
          disabled={loading}
          variant="outline"
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Cluster Health */}
      {clusterHealth && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="font-bold text-lg text-gray-900 mb-4 flex items-center gap-2">
            <Activity className="w-5 h-5 text-orange-600" />
            Cluster Health
          </h2>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 bg-blue-50 rounded-lg">
              <p className="text-sm text-gray-600 mb-1">Cluster Name</p>
              <p className="font-semibold text-gray-900">{clusterHealth.cluster_name}</p>
            </div>
            <div className="p-4 bg-green-50 rounded-lg">
              <p className="text-sm text-gray-600 mb-1">Status</p>
              <div className="flex items-center gap-2">
                <span className={`px-2 py-1 rounded-full text-sm ${getHealthColor(clusterHealth.status)}`}>
                  {clusterHealth.status}
                </span>
              </div>
            </div>
            <div className="p-4 bg-purple-50 rounded-lg">
              <p className="text-sm text-gray-600 mb-1">Nodes</p>
              <p className="text-2xl font-bold text-gray-900">{clusterHealth.number_of_nodes}</p>
            </div>
            <div className="p-4 bg-orange-50 rounded-lg">
              <p className="text-sm text-gray-600 mb-1">Active Shards</p>
              <p className="text-2xl font-bold text-gray-900">{clusterHealth.active_shards}</p>
            </div>
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="font-bold text-lg text-gray-900 mb-4">Quick Actions</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Button
            onClick={handleInitializeIndices}
            disabled={initializing}
            className="bg-blue-600 hover:bg-blue-700"
          >
            <Database className="w-4 h-4 mr-2" />
            {initializing ? 'Initializing...' : 'Initialize Indices'}
          </Button>

          <Button
            onClick={handleReindexAll}
            disabled={reindexing}
            className="bg-orange-600 hover:bg-orange-700"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${reindexing ? 'animate-spin' : ''}`} />
            {reindexing ? 'Reindexing...' : 'Reindex All Data'}
          </Button>
        </div>

        {reindexing && (
          <div className="mt-4 p-4 bg-orange-50 border border-orange-200 rounded-lg">
            <p className="text-sm text-orange-700">
              ⏳ Reindexing in progress... This may take several minutes. Please do not close this page.
            </p>
          </div>
        )}
      </div>

      {/* Index Status */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="font-bold text-lg text-gray-900 mb-4 flex items-center gap-2">
          <Database className="w-5 h-5 text-orange-600" />
          Index Status
        </h2>

        <div className="space-y-3">
          {Object.entries(indices).map(([indexType, status]) => (
            <div
              key={indexType}
              className="p-4 bg-gray-50 rounded-lg border border-gray-200"
            >
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="font-medium text-gray-900 capitalize mb-1">
                    {indexType.replace('_', ' ')}
                  </h3>
                  <p className="text-sm text-gray-600">
                    {status.exists ? (
                      <>
                        {status.documentCount.toLocaleString()} documents • {status.size}
                      </>
                    ) : (
                      'Not created'
                    )}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  {status.exists && (
                    <span className={`px-3 py-1 rounded-full text-sm flex items-center gap-1 ${getHealthColor(status.health)}`}>
                      {getHealthIcon(status.health)}
                      {status.health}
                    </span>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleReindexSingle(indexType)}
                    disabled={!status.exists || loading}
                  >
                    Reindex
                  </Button>
                </div>
              </div>

              {!status.exists && (
                <div className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2">
                  ⚠️ Index not created. Click "Initialize Indices" to create.
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Search Analytics */}
      {analytics && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="font-bold text-lg text-gray-900 mb-4 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-orange-600" />
            Search Analytics
          </h2>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="p-4 bg-blue-50 rounded-lg">
              <p className="text-sm text-gray-600 mb-1">Total Searches</p>
              <p className="text-2xl font-bold text-gray-900">
                {analytics.totalSearches.toLocaleString()}
              </p>
            </div>
            <div className="p-4 bg-green-50 rounded-lg">
              <p className="text-sm text-gray-600 mb-1">Avg Response Time</p>
              <p className="text-2xl font-bold text-gray-900">
                {analytics.averageSearchTime}ms
              </p>
            </div>
            <div className="p-4 bg-orange-50 rounded-lg">
              <p className="text-sm text-gray-600 mb-1">Zero Results</p>
              <p className="text-2xl font-bold text-gray-900">
                {analytics.zeroResultSearches.length}
              </p>
            </div>
            <div className="p-4 bg-purple-50 rounded-lg">
              <p className="text-sm text-gray-600 mb-1">Top Searches</p>
              <p className="text-2xl font-bold text-gray-900">
                {analytics.topSearches.length}
              </p>
            </div>
          </div>

          {/* Top Searches */}
          {analytics.topSearches.length > 0 && (
            <div className="mb-6">
              <h3 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
                <TrendingUp className="w-4 h-4" />
                Top Searches
              </h3>
              <div className="space-y-2">
                {analytics.topSearches.slice(0, 5).map((search, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <span className="w-6 h-6 bg-orange-100 text-orange-600 rounded-full flex items-center justify-center text-sm font-medium">
                        {idx + 1}
                      </span>
                      <span className="text-gray-900">{search.query}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-600">{search.count} searches</span>
                      <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-orange-500"
                          style={{
                            width: `${(search.count / analytics.topSearches[0].count) * 100}%`
                          }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Zero Result Searches */}
          {analytics.zeroResultSearches.length > 0 && (
            <div className="mb-6">
              <h3 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
                <Search className="w-4 h-4" />
                Zero Result Searches
              </h3>
              <div className="space-y-2">
                {analytics.zeroResultSearches.slice(0, 5).map((search, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-3 bg-red-50 rounded-lg border border-red-100"
                  >
                    <span className="text-gray-900">{search.query}</span>
                    <span className="text-sm text-red-600">{search.count} attempts</span>
                  </div>
                ))}
              </div>
              <p className="text-sm text-gray-600 mt-3">
                💡 Consider adding content for these searches or improving search relevance
              </p>
            </div>
          )}

          {/* Searches by Category */}
          {analytics.searchesByCategory.length > 0 && (
            <div>
              <h3 className="font-medium text-gray-900 mb-3">Searches by Category</h3>
              <div className="space-y-2">
                {analytics.searchesByCategory.slice(0, 5).map((category, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                  >
                    <span className="text-gray-900 capitalize">{category.category}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-600">{category.count} searches</span>
                      <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-blue-500"
                          style={{
                            width: `${(category.count / analytics.totalSearches) * 100}%`
                          }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
