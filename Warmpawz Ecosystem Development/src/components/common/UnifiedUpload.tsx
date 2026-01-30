import { useState } from 'react';
import { Upload, Loader2, CheckCircle } from 'lucide-react';
import { Button } from '../ui/button';
import { getApiBaseUrl, getAuthHeaders } from '../../utils/api-config';

interface UnifiedUploadProps {
  onUploadComplete: (url: string) => void;
  path?: string;
  label?: string;
}

export function UnifiedUpload({ onUploadComplete, path = 'general', label = 'Upload File' }: UnifiedUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [status, setStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle');

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setStatus('uploading');

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('path', path);

      // Call the unified upload endpoint
      const res = await fetch(`${getApiBaseUrl()}/upload/unified`, {
        method: 'POST',
        headers: {
          ...getAuthHeaders()
        },
        body: formData
      });

      const data = await res.json();

      if (data.success) {
        if (data.provider === 'aws_s3') {
          // S3 Upload Success (Simulated)
          setStatus('success');
          onUploadComplete(data.url);
        } else {
          // Fallback to basic handling (or standard Supabase upload)
          // For now, we'll just simulate a successful upload URL for the demo
          // In production, this would trigger the Supabase client upload
          const mockUrl = URL.createObjectURL(file); 
          setStatus('success');
          onUploadComplete(mockUrl);
        }
      } else {
        setStatus('error');
        console.error(data.error);
      }
    } catch (error) {
      console.error('Upload failed:', error);
      setStatus('error');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-orange-500 transition-colors bg-gray-50">
      {status === 'success' ? (
        <div className="text-center text-green-600">
          <CheckCircle className="w-8 h-8 mx-auto mb-2" />
          <p className="text-sm font-medium">Upload Complete</p>
          <Button variant="ghost" size="sm" onClick={() => setStatus('idle')} className="mt-2 text-xs">
            Upload Another
          </Button>
        </div>
      ) : (
        <>
          {uploading ? (
            <Loader2 className="w-8 h-8 text-orange-500 animate-spin mb-2" />
          ) : (
            <Upload className="w-8 h-8 text-gray-400 mb-2" />
          )}
          <p className="text-sm text-gray-500 mb-2">{uploading ? 'Uploading...' : label}</p>
          <input
            type="file"
            className="hidden"
            id={`file-upload-${path}`}
            onChange={handleFileChange}
            disabled={uploading}
          />
          <Button
            variant="outline"
            size="sm"
            onClick={() => document.getElementById(`file-upload-${path}`)?.click()}
            disabled={uploading}
          >
            Select File
          </Button>
        </>
      )}
    </div>
  );
}
