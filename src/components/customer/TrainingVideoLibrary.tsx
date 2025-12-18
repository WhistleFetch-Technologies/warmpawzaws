import { useState, useEffect } from 'react';
// Brand color: #FF8C42
import { Play, Eye, Heart, Clock, Filter } from 'lucide-react';
import { Card } from '../ui/card';
import { Badge } from '../ui/badge';
import { projectId, publicAnonKey } from '../../utils/supabase/info';

interface TrainingVideoLibraryProps {
  vendorId?: string;
  onVideoSelect?: (video: any) => void;
}

export function TrainingVideoLibrary({ vendorId, onVideoSelect }: TrainingVideoLibraryProps) {
  const [videos, setVideos] = useState<any[]>([]);
  const [filteredVideos, setFilteredVideos] = useState<any[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [loading, setLoading] = useState(true);

  const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475`;

  const categories = [
    { value: 'all', label: 'All Videos', icon: '📚' },
    { value: 'obedience', label: 'Obedience', icon: '🎓' },
    { value: 'tricks', label: 'Tricks', icon: '✨' },
    { value: 'behavior', label: 'Behavior', icon: '🧠' }
  ];

  useEffect(() => {
    fetchVideos();
  }, [vendorId]);

  useEffect(() => {
    if (selectedCategory === 'all') {
      setFilteredVideos(videos);
    } else {
      setFilteredVideos(videos.filter(v => v.category === selectedCategory));
    }
  }, [selectedCategory, videos]);

  const fetchVideos = async () => {
    try {
      const url = vendorId
        ? `${API_BASE}/trainer/video-library?vendorId=${vendorId}`
        : `${API_BASE}/trainer/video-library`;

      const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${publicAnonKey}` }
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setVideos(data.videos);
          setFilteredVideos(data.videos);
        }
      }
    } catch (error) {
      console.error('Failed to fetch videos:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="py-8 text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500 mx-auto mb-2"></div>
        <p className="text-sm text-gray-500">Loading video library...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Play className="w-5 h-5 text-purple-600" />
          <h3 className="font-bold text-gray-900">Training Videos</h3>
          <span className="text-sm text-gray-500">({filteredVideos.length})</span>
        </div>
      </div>

      {/* Category Filter */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {categories.map(category => (
          <button
            key={category.value}
            onClick={() => setSelectedCategory(category.value)}
            className={`px-4 py-2 rounded-full text-sm whitespace-nowrap transition-all flex items-center gap-2 ${
              selectedCategory === category.value
                ? 'bg-gradient-to-r from-purple-500 to-pink-600 text-white shadow-md'
                : 'bg-white border border-gray-200 text-gray-700 hover:border-purple-200'
            }`}
          >
            <span>{category.icon}</span>
            <span className="font-medium">{category.label}</span>
          </button>
        ))}
      </div>

      {/* Videos Grid */}
      {filteredVideos.length === 0 ? (
        <Card className="p-8 text-center bg-gray-50">
          <Play className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-600 mb-1">No videos found</p>
          <p className="text-sm text-gray-500">Check back later for new training content</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredVideos.map((video) => (
            <Card
              key={video.id}
              onClick={() => onVideoSelect && onVideoSelect(video)}
              className="overflow-hidden cursor-pointer hover:shadow-lg transition-all group"
            >
              {/* Thumbnail */}
              <div className="relative aspect-video bg-gray-200">
                <img
                  src={video.thumbnail}
                  alt={video.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                />
                
                {/* Play Overlay */}
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center">
                    <Play className="w-8 h-8 text-purple-600 ml-1" />
                  </div>
                </div>

                {/* Duration Badge */}
                <div className="absolute bottom-2 right-2 bg-black/80 text-white px-2 py-1 rounded text-xs font-semibold flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {video.duration}
                </div>
              </div>

              {/* Content */}
              <div className="p-4">
                {/* Category Badge */}
                <Badge variant="outline" className="mb-2 text-xs capitalize">
                  {video.category}
                </Badge>

                {/* Title */}
                <h4 className="font-bold text-gray-900 mb-2 line-clamp-2">
                  {video.title}
                </h4>

                {/* Description */}
                <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                  {video.description}
                </p>

                {/* Stats */}
                <div className="flex items-center gap-4 text-xs text-gray-500">
                  <div className="flex items-center gap-1">
                    <Eye className="w-3.5 h-3.5" />
                    <span>{video.views.toLocaleString()} views</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Heart className="w-3.5 h-3.5" />
                    <span>{video.likes}</span>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
