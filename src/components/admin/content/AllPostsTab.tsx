import React from 'react';
import { FileText, Calendar, Eye, Heart, MessageSquare, Share2, MoreVertical } from 'lucide-react';
import { Badge } from '../../ui/badge';
import { Button } from '../../ui/button';

interface Post {
  id: string;
  title: string;
  type: 'image' | 'video' | 'carousel' | 'reel';
  status: 'draft' | 'scheduled' | 'published' | 'archived';
  scheduledDate?: string;
  publishedDate?: string;
  engagement: {
    likes: number;
    comments: number;
    shares: number;
    views: number;
  };
  thumbnail?: string;
}

export function AllPostsTab() {
  // Mock data - replace with actual API call
  const posts: Post[] = [
    {
      id: '1',
      title: 'Pet Care Tips',
      type: 'image',
      status: 'published',
      publishedDate: '2024-01-15',
      engagement: {
        likes: 1250,
        comments: 89,
        shares: 45,
        views: 5600
      }
    },
    {
      id: '2',
      title: 'New Product Launch',
      type: 'video',
      status: 'scheduled',
      scheduledDate: '2024-01-20',
      engagement: {
        likes: 0,
        comments: 0,
        shares: 0,
        views: 0
      }
    }
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'published': return 'bg-green-100 text-green-700';
      case 'scheduled': return 'bg-blue-100 text-blue-700';
      case 'draft': return 'bg-gray-100 text-gray-700';
      case 'archived': return 'bg-orange-100 text-orange-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'video': return '🎥';
      case 'carousel': return '🖼️';
      case 'reel': return '🎬';
      default: return '📷';
    }
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex items-center gap-3">
        <select className="px-4 py-2 border border-gray-300 rounded-lg text-sm">
          <option>All Status</option>
          <option>Published</option>
          <option>Scheduled</option>
          <option>Draft</option>
          <option>Archived</option>
        </select>
        <select className="px-4 py-2 border border-gray-300 rounded-lg text-sm">
          <option>All Types</option>
          <option>Image</option>
          <option>Video</option>
          <option>Carousel</option>
          <option>Reel</option>
        </select>
        <Button variant="outline" size="sm">
          <FileText className="w-4 h-4 mr-2" />
          Export
        </Button>
      </div>

      {/* Posts Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {posts.map((post) => (
          <div key={post.id} className="bg-white border border-gray-200 rounded-lg overflow-hidden hover:shadow-md transition-shadow">
            {/* Thumbnail */}
            <div className="aspect-video bg-gray-100 flex items-center justify-center text-4xl">
              {post.thumbnail ? (
                <img src={post.thumbnail} alt={post.title} className="w-full h-full object-cover" />
              ) : (
                getTypeIcon(post.type)
              )}
            </div>

            {/* Content */}
            <div className="p-4">
              <div className="flex items-start justify-between mb-2">
                <h3 className="font-semibold text-gray-900 text-sm line-clamp-2">{post.title}</h3>
                <button className="text-gray-400 hover:text-gray-600">
                  <MoreVertical className="w-4 h-4" />
                </button>
              </div>

              <div className="flex items-center gap-2 mb-3">
                <Badge className={getStatusColor(post.status)}>
                  {post.status}
                </Badge>
                <span className="text-xs text-gray-500">
                  {post.publishedDate || post.scheduledDate}
                </span>
              </div>

              {/* Engagement Stats */}
              <div className="flex items-center gap-4 text-xs text-gray-600">
                <div className="flex items-center gap-1">
                  <Heart className="w-3 h-3" />
                  {post.engagement.likes}
                </div>
                <div className="flex items-center gap-1">
                  <MessageSquare className="w-3 h-3" />
                  {post.engagement.comments}
                </div>
                <div className="flex items-center gap-1">
                  <Share2 className="w-3 h-3" />
                  {post.engagement.shares}
                </div>
                <div className="flex items-center gap-1">
                  <Eye className="w-3 h-3" />
                  {post.engagement.views}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {posts.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          <FileText className="w-12 h-12 mx-auto mb-4 text-gray-300" />
          <p>No posts found</p>
        </div>
      )}
    </div>
  );
}

