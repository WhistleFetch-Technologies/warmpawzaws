import { useState, useEffect } from 'react';
// Brand color: #FF8C42
import { Camera, Heart, Clock, X } from 'lucide-react';
import { Card } from '../ui/card';
import { projectId, publicAnonKey } from '../../utils/supabase/info';

interface WalkPhotosGalleryProps {
  walkId: string;
  showUpload?: boolean;
  onUpload?: (photo: File) => void;
}

export function WalkPhotosGallery({ walkId, showUpload = false, onUpload }: WalkPhotosGalleryProps) {
  const [photos, setPhotos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPhoto, setSelectedPhoto] = useState<any | null>(null);

  const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475`;

  useEffect(() => {
    fetchPhotos();
  }, [walkId]);

  const fetchPhotos = async () => {
    try {
      const response = await fetch(`${API_BASE}/walker/walk-photos/${walkId}`, {
        headers: { 'Authorization': `Bearer ${publicAnonKey}` }
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setPhotos(data.photos);
        }
      }
    } catch (error) {
      console.error('Failed to fetch walk photos:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="py-8 text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-500 mx-auto mb-2"></div>
        <p className="text-sm text-gray-500">Loading photos...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Camera className="w-5 h-5 text-green-600" />
          <h3 className="font-bold text-gray-900">Walk Photos</h3>
          <span className="text-sm text-gray-500">({photos.length})</span>
        </div>
      </div>

      {/* Photos Grid */}
      {photos.length === 0 ? (
        <Card className="p-8 text-center bg-gray-50">
          <Camera className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-600 mb-1">No photos yet</p>
          <p className="text-sm text-gray-500">Photos from the walk will appear here</p>
        </Card>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {photos.map((photo, index) => (
            <div
              key={photo.id}
              onClick={() => setSelectedPhoto(photo)}
              className="relative aspect-square rounded-lg overflow-hidden cursor-pointer group"
            >
              <img
                src={photo.photoUrl}
                alt={photo.caption || `Walk photo ${index + 1}`}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform"
              />
              
              {/* Overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                <div className="absolute bottom-2 left-2 right-2">
                  {photo.caption && (
                    <p className="text-white text-xs line-clamp-2 mb-1">{photo.caption}</p>
                  )}
                  <div className="flex items-center gap-1 text-white/80 text-xs">
                    <Clock className="w-3 h-3" />
                    <span>{new Date(photo.timestamp).toLocaleTimeString()}</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Photo Modal */}
      {selectedPhoto && (
        <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4">
          <button
            onClick={() => setSelectedPhoto(null)}
            className="absolute top-4 right-4 p-2 bg-white/10 rounded-full hover:bg-white/20 transition-colors"
          >
            <X className="w-6 h-6 text-white" />
          </button>

          <div className="max-w-4xl w-full">
            <img
              src={selectedPhoto.photoUrl}
              alt={selectedPhoto.caption}
              className="w-full h-auto max-h-[80vh] object-contain rounded-lg"
            />
            
            {selectedPhoto.caption && (
              <div className="mt-4 bg-white/10 backdrop-blur-sm rounded-lg p-4">
                <p className="text-white text-center">{selectedPhoto.caption}</p>
                <p className="text-white/60 text-sm text-center mt-2">
                  {new Date(selectedPhoto.timestamp).toLocaleString()}
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
