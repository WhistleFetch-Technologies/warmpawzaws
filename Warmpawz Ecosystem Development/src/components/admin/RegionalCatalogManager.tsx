import { useState } from 'react';
import { Button } from '../ui/button';
import { ArrowLeft, Package, Settings, BarChart3 } from 'lucide-react';
import { RegionalPackageList } from './catalog/RegionalPackageList';

interface RegionalCatalogManagerProps {
  onBack?: () => void;
}

export function RegionalCatalogManager({ onBack }: RegionalCatalogManagerProps = {}) {
  const [activeTab, setActiveTab] = useState<'packages' | 'settings' | 'analytics'>('packages');

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              {onBack && (
                <button
                  onClick={onBack}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
              )}
              <div className="flex items-center gap-3">
                <div className="p-2 bg-orange-100 rounded-lg">
                  <Package className="w-6 h-6 text-orange-600" />
                </div>
                <div>
                  <h1 className="text-xl">Regional Catalog Manager</h1>
                  <p className="text-sm text-gray-600">
                    Manage packages with multi-region pricing
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 mt-2">
            <button
              onClick={() => setActiveTab('packages')}
              className={`px-4 py-2 rounded-t-lg transition-colors ${
                activeTab === 'packages'
                  ? 'bg-orange-600 text-white'
                  : 'bg-white text-gray-600 hover:bg-gray-100'
              }`}
            >
              <Package className="w-4 h-4 inline mr-2" />
              Packages
            </button>
            <button
              onClick={() => setActiveTab('settings')}
              className={`px-4 py-2 rounded-t-lg transition-colors ${
                activeTab === 'settings'
                  ? 'bg-orange-600 text-white'
                  : 'bg-white text-gray-600 hover:bg-gray-100'
              }`}
            >
              <Settings className="w-4 h-4 inline mr-2" />
              Settings
            </button>
            <button
              onClick={() => setActiveTab('analytics')}
              className={`px-4 py-2 rounded-t-lg transition-colors ${
                activeTab === 'analytics'
                  ? 'bg-orange-600 text-white'
                  : 'bg-white text-gray-600 hover:bg-gray-100'
              }`}
            >
              <BarChart3 className="w-4 h-4 inline mr-2" />
              Analytics
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'packages' && <RegionalPackageList />}
        
        {activeTab === 'settings' && (
          <div className="bg-white rounded-lg border-2 border-gray-200 p-8 text-center">
            <Settings className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg mb-2">Settings Coming Soon</h3>
            <p className="text-gray-600">
              Configure default pricing rules, auto-conversion rates, and more
            </p>
          </div>
        )}

        {activeTab === 'analytics' && (
          <div className="bg-white rounded-lg border-2 border-gray-200 p-8 text-center">
            <BarChart3 className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg mb-2">Analytics Coming Soon</h3>
            <p className="text-gray-600">
              View regional performance, popular packages, and revenue insights
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
