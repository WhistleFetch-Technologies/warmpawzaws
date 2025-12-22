import React, { useState } from 'react';
import { X, Upload, Image, Video, FileText, Calendar, Globe } from 'lucide-react';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Textarea } from '../../ui/textarea';
import { Label } from '../../ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../../ui/dialog';

interface CreateContentModalProps {
  isOpen?: boolean;
  open?: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function CreateContentModal({ isOpen, open, onClose, onSuccess }: CreateContentModalProps) {
  const isModalOpen = isOpen ?? open ?? false;
  const [contentType, setContentType] = useState<'image' | 'video' | 'carousel' | 'reel'>('image');
  const [title, setTitle] = useState('');
  const [caption, setCaption] = useState('');
  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduledTime, setScheduledTime] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFiles(Array.from(e.target.files));
    }
  };

  const handleSubmit = async () => {
    if (!title || files.length === 0) {
      return;
    }

    setLoading(true);
    try {
      // TODO: Implement actual API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      if (onSuccess) {
        onSuccess();
      }
      handleClose();
    } catch (error) {
      console.error('Error creating content:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setTitle('');
    setCaption('');
    setScheduledDate('');
    setScheduledTime('');
    setFiles([]);
    onClose();
  };

  return (
    <Dialog open={isModalOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New Content</DialogTitle>
          <DialogDescription>
            Create and schedule social media content
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Content Type Selection */}
          <div>
            <Label className="mb-3 block">Content Type</Label>
            <div className="grid grid-cols-4 gap-3">
              {[
                { value: 'image', label: 'Image', icon: Image },
                { value: 'video', label: 'Video', icon: Video },
                { value: 'carousel', label: 'Carousel', icon: FileText },
                { value: 'reel', label: 'Reel', icon: Video }
              ].map((type) => {
                const Icon = type.icon;
                return (
                  <button
                    key={type.value}
                    onClick={() => setContentType(type.value as any)}
                    className={`p-4 border-2 rounded-lg transition-all ${
                      contentType === type.value
                        ? 'border-blue-600 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <Icon className="w-6 h-6 mx-auto mb-2 text-gray-600" />
                    <p className="text-sm font-medium">{type.label}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Title */}
          <div>
            <Label htmlFor="title">Title *</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter content title"
              className="mt-1"
            />
          </div>

          {/* Caption */}
          <div>
            <Label htmlFor="caption">Caption</Label>
            <Textarea
              id="caption"
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="Write your caption here..."
              rows={4}
              className="mt-1"
            />
          </div>

          {/* File Upload */}
          <div>
            <Label>Upload {contentType === 'image' ? 'Images' : contentType === 'video' ? 'Video' : 'Files'} *</Label>
            <div className="mt-2 border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
              <Upload className="w-12 h-12 mx-auto mb-4 text-gray-400" />
              <p className="text-sm text-gray-600 mb-2">
                Click to upload or drag and drop
              </p>
              <p className="text-xs text-gray-500 mb-4">
                {contentType === 'image' && 'PNG, JPG, GIF up to 10MB'}
                {contentType === 'video' && 'MP4, MOV up to 100MB'}
                {contentType === 'carousel' && 'Multiple images'}
                {contentType === 'reel' && 'MP4, MOV up to 100MB'}
              </p>
              <Input
                type="file"
                multiple={contentType === 'carousel'}
                accept={contentType === 'image' || contentType === 'carousel' ? 'image/*' : 'video/*'}
                onChange={handleFileUpload}
                className="hidden"
                id="file-upload"
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => document.getElementById('file-upload')?.click()}
              >
                Select Files
              </Button>
              {files.length > 0 && (
                <p className="text-sm text-gray-600 mt-2">
                  {files.length} file(s) selected
                </p>
              )}
            </div>
          </div>

          {/* Schedule */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="date">Schedule Date</Label>
              <Input
                id="date"
                type="date"
                value={scheduledDate}
                onChange={(e) => setScheduledDate(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="time">Schedule Time</Label>
              <Input
                id="time"
                type="time"
                value={scheduledTime}
                onChange={(e) => setScheduledTime(e.target.value)}
                className="mt-1"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t">
            <Button variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={loading || !title || files.length === 0}
            >
              {scheduledDate && scheduledTime ? 'Schedule' : 'Publish Now'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

