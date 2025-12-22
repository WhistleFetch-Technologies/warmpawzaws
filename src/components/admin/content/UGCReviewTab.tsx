import React, { useState } from 'react';
import { CheckCircle, XCircle, Eye, Download, User, Calendar, Heart, MessageSquare } from 'lucide-react';
import { Badge } from '../../ui/badge';
import { Button } from '../../ui/button';

interface UGCSubmission {
  id: string;
  userName: string;
  userAvatar?: string;
  content: {
    type: 'image' | 'video';
    url: string;
    thumbnail?: string;
  };
  caption: string;
  submittedDate: string;
  status: 'pending' | 'approved' | 'rejected';
  engagement: {
    likes: number;
    comments: number;
  };
}

export function UGCReviewTab() {
  const [submissions, setSubmissions] = useState<UGCSubmission[]>([
    {
      id: '1',
      userName: 'PetLover123',
      content: {
        type: 'image',
        url: '/ugc/image1.jpg'
      },
      caption: 'My dog loves this product! 🐕',
      submittedDate: '2024-01-15',
      status: 'pending',
      engagement: {
        likes: 245,
        comments: 12
      }
    },
    {
      id: '2',
      userName: 'CatMom2024',
      content: {
        type: 'video',
        url: '/ugc/video1.mp4',
        thumbnail: '/ugc/video1-thumb.jpg'
      },
      caption: 'Unboxing our new purchase',
      submittedDate: '2024-01-14',
      status: 'approved',
      engagement: {
        likes: 890,
        comments: 45
      }
    }
  ]);

  const handleApprove = (id: string) => {
    setSubmissions(submissions.map(s => 
      s.id === id ? { ...s, status: 'approved' as const } : s
    ));
  };

  const handleReject = (id: string) => {
    setSubmissions(submissions.map(s => 
      s.id === id ? { ...s, status: 'rejected' as const } : s
    ));
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved': return 'bg-green-100 text-green-700';
      case 'rejected': return 'bg-red-100 text-red-700';
      case 'pending': return 'bg-yellow-100 text-yellow-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex items-center gap-3">
        <select className="px-4 py-2 border border-gray-300 rounded-lg text-sm">
          <option>All Status</option>
          <option>Pending</option>
          <option>Approved</option>
          <option>Rejected</option>
        </select>
        <select className="px-4 py-2 border border-gray-300 rounded-lg text-sm">
          <option>All Types</option>
          <option>Image</option>
          <option>Video</option>
        </select>
      </div>

      {/* Submissions List */}
      <div className="space-y-4">
        {submissions.map((submission) => (
          <div key={submission.id} className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="flex gap-4">
              {/* Content Preview */}
              <div className="w-32 h-32 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
                {submission.content.thumbnail ? (
                  <img 
                    src={submission.content.thumbnail} 
                    alt="UGC content" 
                    className="w-full h-full object-cover rounded-lg"
                  />
                ) : (
                  <span className="text-2xl">
                    {submission.content.type === 'video' ? '🎥' : '📷'}
                  </span>
                )}
              </div>

              {/* Details */}
              <div className="flex-1">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center">
                      <User className="w-4 h-4 text-gray-600" />
                    </div>
                    <div>
                      <p className="font-semibold text-sm">{submission.userName}</p>
                      <p className="text-xs text-gray-500 flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {submission.submittedDate}
                      </p>
                    </div>
                  </div>
                  <Badge className={getStatusColor(submission.status)}>
                    {submission.status}
                  </Badge>
                </div>

                <p className="text-sm text-gray-700 mb-3">{submission.caption}</p>

                {/* Engagement */}
                <div className="flex items-center gap-4 text-xs text-gray-600 mb-3">
                  <div className="flex items-center gap-1">
                    <Heart className="w-3 h-3" />
                    {submission.engagement.likes}
                  </div>
                  <div className="flex items-center gap-1">
                    <MessageSquare className="w-3 h-3" />
                    {submission.engagement.comments}
                  </div>
                </div>

                {/* Actions */}
                {submission.status === 'pending' && (
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-green-600 border-green-600 hover:bg-green-50"
                      onClick={() => handleApprove(submission.id)}
                    >
                      <CheckCircle className="w-4 h-4 mr-1" />
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-red-600 border-red-600 hover:bg-red-50"
                      onClick={() => handleReject(submission.id)}
                    >
                      <XCircle className="w-4 h-4 mr-1" />
                      Reject
                    </Button>
                    <Button size="sm" variant="outline">
                      <Eye className="w-4 h-4 mr-1" />
                      View
                    </Button>
                    <Button size="sm" variant="outline">
                      <Download className="w-4 h-4 mr-1" />
                      Download
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {submissions.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          <User className="w-12 h-12 mx-auto mb-4 text-gray-300" />
          <p>No UGC submissions found</p>
        </div>
      )}
    </div>
  );
}

