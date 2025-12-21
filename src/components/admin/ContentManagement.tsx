import { useState, useEffect } from 'react';
import { 
  Search, Bell, MessageSquare, User, Plus, Download, 
  Filter, SortAsc, Grid3x3, Megaphone, HeadphonesIcon, 
  ClipboardList, Newspaper, PawPrint, Wallet, Users, 
  BarChart3, Calendar, Package, Settings, FileText,
  Video, Eye, Sparkles, TrendingUp, ChevronDown
} from 'lucide-react';
import { Button } from '../ui/button';
import { projectId, publicAnonKey } from '../../utils/supabase/info';
const logoImage = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KICA8cmVjdCB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHJ4PSI4IiBmaWxsPSIjRkY4QzQyIi8+CiAgPHBhdGggZD0iTTIwIDEyQzE2LjY4NjMgMTIgMTQgMTQuNjg2MyAxNCAxOEMxNCAxOS41OTEzIDE0LjYzMjEgMjEuMDI2MSAxNS42NTY5IDIyLjA1MTRDMTY4MjE3IDIzLjA3NjcgMTguMTE2NSAyMy43MDg4IDE5LjcwNzcgMjMuNzA4OEMyMS4yOTg5IDIzLjcwODggMjIuNzMzNyAyMy4wNzY3IDIzLjc1ODUgMjIuMDUxNEMyNC43ODMzIDIxLjAyNjEgMjUuNDE1NCAxOS41OTEzIDI1LjQxNTQgMThDMjUuNDE1NCAxNC42ODYzIDIyLjcyOTEgMTIgMTkuNDE1NCAxMkgyMFpNMjAgMTRDMjEuNjU2OSAxNCAyMyAxNS4zNDMxIDIzIDE3QzIzIDE4LjY1NjkgMjEuNjU2OSAyMCAyMCAyMEMxOC4zNDMxIDIwIDE3IDE4LjY1NjkgMTcgMTdDMTcgMTUuMzQzMSAxOC4zNDMxIDE0IDIwIDE0WiIgZmlsbD0id2hpdGUiLz4KICA8cGF0aCBkPSJNMTIgMjRDMTIgMjQuNTUyMyAxMi40NDc3IDI1IDEzIDI1SDI3QzI3LjU1MjMgMjUgMjggMjQuNTUyMyAyOCAyNEMyOCAyMi4zNDMxIDI2LjY1NjkgMjEgMjUgMjFIMTVDMTMuMzQzMSAyMSAxMiAyMi4zNDMxIDEyIDI0WiIgZmlsbD0id2hpdGUiLz4KPC9zdmc+';
import { AssetLibraryTab } from './content/AssetLibraryTab';
import { AllPostsTab } from './content/AllPostsTab';
import { UGCReviewTab } from './content/UGCReviewTab';
import { EngagementInsightsTab } from './content/EngagementInsightsTab';
import { CampaignsTab } from './content/CampaignsTab';
import { CreateContentModal } from './content/CreateContentModal';

interface ContentStats {
  scheduledPosts: { count: number; status: string };
  totalAssets: { count: string; type: string };
  engagementRate: { rate: string; period: string };
  ugcSubmissions: { count: number; status: string };
}

export function ContentManagement() {
  const [activeTab, setActiveTab] = useState<'all-posts' | 'asset-library' | 'ugc-review' | 'engagement' | 'campaigns'>('asset-library');
  const [stats, setStats] = useState<ContentStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCreateContent, setShowCreateContent] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  useEffect(() => {
    loadStats();
  }, [refreshTrigger]);

  const loadStats = async () => {
    try {
      setLoading(true);
      
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/admin/content/stats`,
        {
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`
          }
        }
      );
      
      if (response.ok) {
        const data = await response.json();
        setStats(data.stats);
      }
    } catch (error) {
      console.error('Error loading content stats:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <div className="w-64 bg-white border-r border-gray-200 flex flex-col">
        {/* Logo */}
        <div className="p-4 border-b border-gray-200 flex items-center gap-3">
          <img src={logoImage} alt="WarmPawz" className="w-10 h-10" />
          <div>
            <h2 className="text-[#FF8C42]">Warmpawz</h2>
            <span className="text-xs text-gray-500">Admin Portal</span>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-1">
          <NavItem icon={<Grid3x3 className="w-4 h-4" />} label="Dashboard" />
          <NavItem icon={<Package className="w-4 h-4" />} label="Vendor Administration" />
          <NavItem icon={<Megaphone className="w-4 h-4" />} label="Marketing & Promotions" />
          <NavItem icon={<HeadphonesIcon className="w-4 h-4" />} label="Support & CRM" />
          <NavItem icon={<ClipboardList className="w-4 h-4" />} label="Catalog & Services" />
          <NavItem icon={<Calendar className="w-4 h-4" />} label="Event Management" />
          <NavItem icon={<Newspaper className="w-4 h-4" />} label="Content Management" active />
          <NavItem icon={<PawPrint className="w-4 h-4" />} label="Pet Info Management" />
          <NavItem icon={<Wallet className="w-4 h-4" />} label="Finance & Logistics" />
          <NavItem icon={<Users className="w-4 h-4" />} label="Role & User Management" />
        </nav>

        {/* Bottom Section */}
        <div className="p-4 border-t border-gray-200 space-y-1">
          <NavItem icon={<BarChart3 className="w-4 h-4" />} label="Reports" />
          <NavItem icon={<Settings className="w-4 h-4" />} label="Platform Settings" />
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Bar */}
        <div className="bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <h1 className="text-xl text-gray-900">Content Management</h1>
                <select className="text-sm border border-gray-200 rounded-lg px-3 py-1 bg-white">
                  <option>/Social Media & Content Operations</option>
                  <option>/Asset Library</option>
                  <option>/Content Calendar</option>
                </select>
              </div>
              <p className="text-sm text-gray-500">
                Manage social media posts, content assets, user-generated and campaign Performance across all channels
              </p>
            </div>
            
            <div className="flex items-center gap-3">
              <div className="relative">
                <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search"
                  className="pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm w-64"
                />
              </div>
              <button className="p-2 hover:bg-gray-100 rounded-lg relative">
                <Bell className="w-5 h-5 text-gray-600" />
                <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
              </button>
              <button className="p-2 hover:bg-gray-100 rounded-lg">
                <MessageSquare className="w-5 h-5 text-gray-600" />
              </button>
              <button className="p-2 hover:bg-gray-100 rounded-lg">
                <User className="w-5 h-5 text-gray-600" />
              </button>
            </div>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Stats Cards */}
          <div className="grid grid-cols-4 gap-4 mb-6">
            <StatCard
              icon={<FileText className="w-5 h-5 text-red-600" />}
              iconBg="bg-red-50"
              title="Scheduled Posts"
              value={stats?.scheduledPosts?.count?.toString() || '42'}
              subtitle={stats?.scheduledPosts?.status || 'Ready to Publish'}
            />
            <StatCard
              icon={<Video className="w-5 h-5 text-blue-600" />}
              iconBg="bg-blue-50"
              title="Total Assests"
              value={stats?.totalAssets?.count || '1.2K'}
              subtitle={stats?.totalAssets?.type || 'Images & Videos'}
            />
            <StatCard
              icon={<Sparkles className="w-5 h-5 text-green-600" />}
              iconBg="bg-green-50"
              title="Engagement Rate"
              value={stats?.engagementRate?.rate || '89%'}
              subtitle={stats?.engagementRate?.period || "this month's avg"}
            />
            <StatCard
              icon={<Eye className="w-5 h-5 text-orange-600" />}
              iconBg="bg-orange-50"
              title="UGC Submissions"
              value={stats?.ugcSubmissions?.count?.toString() || '156'}
              subtitle={stats?.ugcSubmissions?.status || 'Pending Review'}
            />
          </div>

          {/* Tabs */}
          <div className="bg-white rounded-xl border border-gray-200">
            <div className="border-b border-gray-200 px-6 py-3 flex items-center justify-between">
              <div className="flex gap-6">
                <TabButton 
                  label="All Posts" 
                  active={activeTab === 'all-posts'}
                  onClick={() => setActiveTab('all-posts')}
                />
                <TabButton 
                  label="Asset Library" 
                  active={activeTab === 'asset-library'}
                  onClick={() => setActiveTab('asset-library')}
                />
                <TabButton 
                  label="UGC Review" 
                  active={activeTab === 'ugc-review'}
                  onClick={() => setActiveTab('ugc-review')}
                />
                <TabButton 
                  label="Engagement Insights" 
                  active={activeTab === 'engagement'}
                  onClick={() => setActiveTab('engagement')}
                />
                <TabButton 
                  label="Campaigns" 
                  active={activeTab === 'campaigns'}
                  onClick={() => setActiveTab('campaigns')}
                />
              </div>

              <Button 
                className="bg-[#FF8C42] hover:bg-[#FF7A2E] gap-2"
                onClick={() => setShowCreateContent(true)}
              >
                <Plus className="w-4 h-4" />
                Create Content
              </Button>
            </div>

            {/* Tab Content */}
            <div className="p-6">
              {activeTab === 'all-posts' && <AllPostsTab />}
              {activeTab === 'asset-library' && <AssetLibraryTab onRefresh={() => setRefreshTrigger(refreshTrigger + 1)} />}
              {activeTab === 'ugc-review' && <UGCReviewTab />}
              {activeTab === 'engagement' && <EngagementInsightsTab />}
              {activeTab === 'campaigns' && <CampaignsTab />}
            </div>
          </div>
        </div>
      </div>

      {/* Modals */}
      <CreateContentModal
        isOpen={showCreateContent}
        onClose={() => setShowCreateContent(false)}
        onSuccess={() => {
          console.log('Content created - triggering refresh');
          setShowCreateContent(false);
          setRefreshTrigger(prev => prev + 1);
          loadStats();
        }}
      />
    </div>
  );
}

function NavItem({ icon, label, active = false }: { icon: React.ReactNode; label: string; active?: boolean }) {
  return (
    <button
      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
        active
          ? 'bg-[#FF8C42] text-white'
          : 'text-gray-700 hover:bg-gray-100'
      }`}
    >
      {icon}
      <span className="text-left">{label}</span>
    </button>
  );
}

function StatCard({ icon, iconBg, title, value, subtitle }: any) {
  return (
    <div className="bg-white rounded-xl p-4 border border-gray-200">
      <div className="flex items-center gap-3 mb-3">
        <div className={`w-10 h-10 ${iconBg} rounded-lg flex items-center justify-center`}>
          {icon}
        </div>
        <span className="text-sm text-gray-600">{title}</span>
      </div>
      <div className="text-3xl mb-1">{value}</div>
      <div className="text-xs text-gray-500">{subtitle}</div>
    </div>
  );
}

function TabButton({ label, active = false, onClick }: { label: string; active?: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 text-sm border-b-2 transition-colors ${
        active
          ? 'border-blue-600 text-blue-600'
          : 'border-transparent text-gray-600 hover:text-gray-900'
      }`}
    >
      {label}
    </button>
  );
}
