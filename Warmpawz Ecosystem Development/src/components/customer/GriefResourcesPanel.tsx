import { useState, useEffect } from 'react';
import { Heart, Book, Users, Phone, TreePine, Award, ExternalLink } from 'lucide-react';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { getApiBaseUrl, getAuthHeaders } from '../../utils/api-config';

interface GriefResourcesPanelProps {
  petId?: string;
  petName?: string;
}

export function GriefResourcesPanel({ petId, petName }: GriefResourcesPanelProps) {
  const [resources, setResources] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('articles');

  const API_BASE = getApiBaseUrl();

  useEffect(() => {
    fetchResources();
  }, []);

  const fetchResources = async () => {
    try {
      const response = await fetch(`${API_BASE}/sunset/grief-resources`, {
        headers: getAuthHeaders()
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setResources(data.resources);
        }
      }
    } catch (error) {
      console.error('Failed to fetch grief resources:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="py-8 text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500 mx-auto mb-2"></div>
        <p className="text-sm text-gray-500">Loading support resources...</p>
      </div>
    );
  }

  if (!resources) {
    return null;
  }

  const tabs = [
    { id: 'articles', label: 'Articles', icon: Book },
    { id: 'support', label: 'Support Groups', icon: Users },
    { id: 'memorials', label: 'Memorials', icon: TreePine },
    { id: 'counseling', label: 'Counseling', icon: Phone }
  ];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Heart className="w-5 h-5 text-purple-600" />
        <h3 className="font-bold text-gray-900">Grief Support & Resources</h3>
      </div>

      {/* Compassionate Message */}
      <Card className="p-4 bg-gradient-to-r from-purple-50 to-pink-50 border-purple-200">
        <p className="text-sm text-gray-700">
          💜 We understand how difficult it is to lose a beloved pet. You're not alone in this journey. 
          These resources are here to support you through your grief.
        </p>
      </Card>

      {/* Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {tabs.map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all flex items-center gap-2 ${
                activeTab === tab.id
                  ? 'bg-gradient-to-r from-purple-500 to-pink-600 text-white shadow-md'
                  : 'bg-white border border-gray-200 text-gray-700 hover:border-purple-200'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Content */}
      <div className="space-y-3">
        {/* Articles Tab */}
        {activeTab === 'articles' && (
          <div className="space-y-3">
            {resources.articles.map((article: any) => (
              <Card key={article.id} className="p-4 hover:shadow-md transition-all cursor-pointer">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Book className="w-5 h-5 text-purple-600" />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-bold text-gray-900 mb-1">{article.title}</h4>
                    <p className="text-sm text-gray-600 mb-2">{article.description}</p>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-500">📖 {article.readTime}</span>
                      <a
                        href={article.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-purple-600 hover:text-purple-700 font-medium flex items-center gap-1"
                      >
                        Read Article <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}

        {/* Support Groups Tab */}
        {activeTab === 'support' && (
          <div className="space-y-3">
            {resources.supportGroups.map((group: any) => (
              <Card key={group.id} className="p-4">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Users className="w-5 h-5 text-blue-600" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-bold text-gray-900">{group.name}</h4>
                      <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                        {group.type}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 mb-2">{group.description}</p>
                    {group.schedule && (
                      <p className="text-xs text-gray-500 mb-2">📅 {group.schedule}</p>
                    )}
                    {group.contactEmail && (
                      <a
                        href={`mailto:${group.contactEmail}`}
                        className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                      >
                        Contact: {group.contactEmail}
                      </a>
                    )}
                    {group.url && (
                      <a
                        href={group.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
                      >
                        Visit Community <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}

        {/* Memorials Tab */}
        {activeTab === 'memorials' && (
          <div className="space-y-3">
            {resources.memorialOptions.map((memorial: any) => (
              <Card key={memorial.id} className="p-4">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <TreePine className="w-5 h-5 text-green-600" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-bold text-gray-900">{memorial.title}</h4>
                      <span className="font-bold text-gray-900">
                        {memorial.price === 0 ? 'Free' : `₹${memorial.price}`}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 mb-3">{memorial.description}</p>
                    <div className="space-y-1 mb-3">
                      {memorial.features.map((feature: string, idx: number) => (
                        <div key={idx} className="flex items-center gap-2 text-xs text-gray-600">
                          <Award className="w-3 h-3 text-green-600" />
                          <span>{feature}</span>
                        </div>
                      ))}
                    </div>
                    <Button
                      size="sm"
                      className="w-full bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white"
                    >
                      Create Memorial
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}

        {/* Counseling Tab */}
        {activeTab === 'counseling' && (
          <div className="space-y-3">
            {/* Helplines */}
            <Card className="p-4 bg-red-50 border-red-200">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Phone className="w-5 h-5 text-red-600" />
                </div>
                <div className="flex-1">
                  <h4 className="font-bold text-gray-900 mb-1">Crisis Support Helpline</h4>
                  {resources.helplines.map((helpline: any, idx: number) => (
                    <div key={idx}>
                      <p className="text-sm text-gray-600 mb-2">{helpline.name}</p>
                      <a
                        href={`tel:${helpline.phone}`}
                        className="text-2xl font-bold text-red-600 hover:text-red-700"
                      >
                        {helpline.phone}
                      </a>
                      <p className="text-xs text-gray-500 mt-1">Available {helpline.hours}</p>
                    </div>
                  ))}
                </div>
              </div>
            </Card>

            {/* Professional Counseling */}
            {resources.counseling.map((counselor: any) => (
              <Card key={counselor.id} className="p-4">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Users className="w-5 h-5 text-purple-600" />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-bold text-gray-900 mb-1">{counselor.name}</h4>
                    <p className="text-sm text-gray-600 mb-2">{counselor.specialization}</p>
                    <div className="space-y-1 mb-3 text-sm text-gray-600">
                      <p>📅 {counselor.availability}</p>
                      <p>📞 {counselor.phone}</p>
                    </div>
                    <Button
                      size="sm"
                      className="w-full bg-purple-600 hover:bg-purple-700 text-white"
                      onClick={() => window.open(counselor.bookingUrl, '_blank')}
                    >
                      Book Counseling Session
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
