import { useState, useEffect } from 'react';
import { Image as ImageIcon, Plus } from 'lucide-react';
import { projectId, publicAnonKey } from '../../../utils/supabase/info';
import { Button } from '../../ui/button';

interface BannerManagementProps {
  sellerId: string;
}

export function BannerManagement({ sellerId }: BannerManagementProps) {
  const [banners, setBanners] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadBanners();
  }, [sellerId]);

  const loadBanners = async () => {
    try {
      setLoading(true);
      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/ecommerce/banners?sellerId=${sellerId}`,
        { headers: { 'Authorization': `Bearer ${publicAnonKey}` } }
      );
      
      if (res.ok) {
        const data = await res.json();
        setBanners(data.banners);
      }
    } catch (error) {
      console.error('Error loading banners:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full p-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FF8C42]"></div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-black">Banner Management</h1>
          <p className="text-gray-500 mt-1">Upload and manage promotional banners</p>
        </div>
        <Button className="bg-[#FF8C42] text-white px-4 py-2 rounded-lg hover:bg-[#E67A32] flex items-center gap-2">
          <Plus className="w-5 h-5" />
          Upload Banner
        </Button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
        <ImageIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
        <p className="text-gray-500">Banner management coming soon</p>
        <p className="text-sm text-gray-400 mt-1">Upload promotional banners to feature your products on the homepage</p>
      </div>
    </div>
  );
}
