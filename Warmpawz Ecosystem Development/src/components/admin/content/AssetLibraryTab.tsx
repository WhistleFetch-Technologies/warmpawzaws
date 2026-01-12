import { useState, useEffect } from 'react';
import { Search, SortAsc, Filter, ChevronDown, Eye, Edit, MoreVertical, Download, Trash2, FileImage, FileVideo, FileText } from 'lucide-react';
import { Button } from '../../ui/button';
import { projectId, publicAnonKey } from '../../../utils/supabase/info';
import { EditAssetModal } from './EditAssetModal';
import { BulkActionsModal } from './BulkActionsModal';

interface Asset {
  id: string;
  name: string;
  type: 'image' | 'video' | 'document';
  url: string;
  thumbnail?: string;
  size: string;
  usageCount: number;
  tags: string[];
  category: string;
  uploadedAt: string;
}

interface AssetLibraryTabProps {
  onRefresh: () => void;
}

export function AssetLibraryTab({ onRefresh }: AssetLibraryTabProps) {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAssets, setSelectedAssets] = useState<string[]>([]);
  const [editingAsset, setEditingAsset] = useState<Asset | null>(null);
  const [showBulkActions, setShowBulkActions] = useState(false);
  const [sortBy, setSortBy] = useState('recent');

  useEffect(() => {
    loadAssets();
  }, []);

  const loadAssets = async () => {
    try {
      setLoading(true);
      
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/admin/content/assets`,
        {
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`
          }
        }
      );
      
      if (response.ok) {
        const data = await response.json();
        setAssets(data.assets || []);
      }
    } catch (error) {
      console.error('Error loading assets:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAsset = async (assetId: string) => {
    if (!confirm('Are you sure you want to delete this asset?')) return;

    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/admin/content/assets/${assetId}`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`
          }
        }
      );

      if (response.ok) {
        loadAssets();
        onRefresh();
      }
    } catch (error) {
      console.error('Error deleting asset:', error);
      alert('Failed to delete asset. Please try again.');
    }
  };

  const filteredAssets = assets.filter(asset => {
    if (typeFilter !== 'all' && asset.type !== typeFilter) return false;
    if (categoryFilter !== 'all' && asset.category !== categoryFilter) return false;
    if (searchQuery && !asset.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  const getFileIcon = (type: string) => {
    switch (type) {
      case 'image': return <FileImage className="w-12 h-12 text-gray-400" />;
      case 'video': return <FileVideo className="w-12 h-12 text-gray-400" />;
      case 'document': return <FileText className="w-12 h-12 text-gray-400" />;
      default: return <FileImage className="w-12 h-12 text-gray-400" />;
    }
  };

  return (
    <div className="space-y-4">
      {/* Filters Bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {/* Type Filter */}
          <div>
            <label className="text-sm text-gray-600 mb-1 block">Types</label>
            <select
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white min-w-[150px]"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
            >
              <option value="all">All Types</option>
              <option value="image">Images</option>
              <option value="video">Videos</option>
              <option value="document">Documents</option>
            </select>
          </div>

          {/* Category Filter */}
          <div>
            <label className="text-sm text-gray-600 mb-1 block">Category</label>
            <select
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white min-w-[150px]"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
            >
              <option value="all">All Categories</option>
              <option value="pet-care">Pet Care</option>
              <option value="grooming">Grooming</option>
              <option value="health">Health</option>
              <option value="nutrition">Nutrition</option>
              <option value="training">Training</option>
              <option value="lifestyle">Lifestyle</option>
            </select>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Search */}
          <div className="relative">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm w-64"
            />
          </div>

          {/* Sort */}
          <Button variant="outline" className="gap-2">
            <SortAsc className="w-4 h-4" />
            Sort-by
          </Button>

          {/* Bulk Actions */}
          <Button 
            variant="outline" 
            className="gap-2"
            onClick={() => setShowBulkActions(true)}
            disabled={selectedAssets.length === 0}
          >
            Bulk Actions
            <ChevronDown className="w-4 h-4" />
          </Button>

          {/* Filters */}
          <Button variant="outline" className="gap-2">
            <Filter className="w-4 h-4" />
            Filters
          </Button>
        </div>
      </div>

      {/* Assets Grid */}
      {loading ? (
        <div className="text-center py-12 text-gray-500">Loading assets...</div>
      ) : filteredAssets.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <FileImage className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p>No assets found</p>
          <p className="text-sm">Upload your first asset to get started</p>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-4">
          {filteredAssets.map((asset) => (
            <AssetCard
              key={asset.id}
              asset={asset}
              onEdit={() => setEditingAsset(asset)}
              onDelete={() => handleDeleteAsset(asset.id)}
              isSelected={selectedAssets.includes(asset.id)}
              onSelect={() => {
                if (selectedAssets.includes(asset.id)) {
                  setSelectedAssets(selectedAssets.filter(id => id !== asset.id));
                } else {
                  setSelectedAssets([...selectedAssets, asset.id]);
                }
              }}
              getFileIcon={getFileIcon}
            />
          ))}
        </div>
      )}

      {/* Edit Asset Modal */}
      {editingAsset && (
        <EditAssetModal
          isOpen={true}
          onClose={() => setEditingAsset(null)}
          asset={editingAsset}
          onSuccess={() => {
            loadAssets();
            onRefresh();
            setEditingAsset(null);
          }}
        />
      )}

      {/* Bulk Actions Modal */}
      <BulkActionsModal
        isOpen={showBulkActions}
        onClose={() => setShowBulkActions(false)}
        selectedAssets={selectedAssets}
        onSuccess={() => {
          loadAssets();
          onRefresh();
          setSelectedAssets([]);
        }}
      />
    </div>
  );
}

function AssetCard({ 
  asset, 
  onEdit, 
  onDelete, 
  isSelected, 
  onSelect,
  getFileIcon 
}: { 
  asset: Asset; 
  onEdit: () => void; 
  onDelete: () => void;
  isSelected: boolean;
  onSelect: () => void;
  getFileIcon: (type: string) => React.ReactNode;
}) {
  const [showActions, setShowActions] = useState(false);

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden hover:shadow-md transition-shadow">
      {/* Thumbnail */}
      <div className="aspect-video bg-gray-100 flex items-center justify-center relative group">
        {asset.thumbnail ? (
          <img src={asset.thumbnail} alt={asset.name} className="w-full h-full object-cover" />
        ) : (
          getFileIcon(asset.type)
        )}
        
        {/* Checkbox overlay */}
        <div className="absolute top-2 left-2">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={onSelect}
            className="w-4 h-4 text-[#FF8C42] rounded border-gray-300"
          />
        </div>
      </div>

      {/* Details */}
      <div className="p-4">
        <div className="flex items-start justify-between mb-2">
          <div className="flex-1">
            <h3 className="text-sm mb-1 truncate">{asset.name}</h3>
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <FileImage className="w-3 h-3" />
              <span>{asset.size}</span>
              <span>|</span>
              <span>{asset.usageCount} uses</span>
            </div>
          </div>
          
          {/* Actions */}
          <div className="flex items-center gap-1">
            <button
              onClick={onEdit}
              className="p-1.5 hover:bg-blue-50 rounded-lg text-blue-600"
              title="View"
            >
              <Eye className="w-4 h-4" />
            </button>
            <button
              onClick={onEdit}
              className="p-1.5 hover:bg-green-50 rounded-lg text-green-600"
              title="Edit"
            >
              <Edit className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Tags */}
        <div className="flex flex-wrap gap-1">
          {asset.tags.map((tag, index) => (
            <span
              key={index}
              className="px-2 py-0.5 bg-gray-100 text-gray-700 text-xs rounded"
            >
              {tag}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
