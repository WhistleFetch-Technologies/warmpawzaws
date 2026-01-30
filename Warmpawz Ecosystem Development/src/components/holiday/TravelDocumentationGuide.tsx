import { useState, useEffect } from 'react';
import { FileText, CheckCircle, AlertCircle, Info, Download } from 'lucide-react';
import { Card } from '../ui/card';
import { Badge } from '../ui/badge';
import { getApiBaseUrl, getAuthHeaders } from '../../utils/api-config';

interface TravelDocumentationGuideProps {
  travelType?: 'domestic' | 'international';
}

export function TravelDocumentationGuide({ travelType = 'domestic' }: TravelDocumentationGuideProps) {
  const [checklist, setChecklist] = useState<any[]>([]);
  const [tips, setTips] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedType, setSelectedType] = useState(travelType);
  const [completedItems, setCompletedItems] = useState<Set<string>>(new Set());

  const API_BASE = getApiBaseUrl();

  useEffect(() => {
    fetchDocumentation();
  }, [selectedType]);

  const fetchDocumentation = async () => {
    try {
      const response = await fetch(
        `${API_BASE}/travel/documentation-checklist?type=${selectedType}`,
        { headers: getAuthHeaders() }
      );

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setChecklist(data.checklist);
          setTips(data.tips || []);
        }
      }
    } catch (error) {
      console.error('Failed to fetch documentation:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleItem = (itemId: string) => {
    const newCompleted = new Set(completedItems);
    if (newCompleted.has(itemId)) {
      newCompleted.delete(itemId);
    } else {
      newCompleted.add(itemId);
    }
    setCompletedItems(newCompleted);
  };

  const completionPercentage = checklist.length > 0
    ? Math.round((completedItems.size / checklist.length) * 100)
    : 0;

  if (loading) {
    return (
      <div className="py-8 text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500 mx-auto mb-2"></div>
        <p className="text-sm text-gray-500">Loading documentation guide...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <FileText className="w-5 h-5 text-orange-600" />
        <h3 className="font-bold text-gray-900">Travel Documentation Guide</h3>
      </div>

      {/* Travel Type Selector */}
      <div className="flex gap-2">
        <button
          onClick={() => setSelectedType('domestic')}
          className={`flex-1 py-2 px-4 rounded-lg font-semibold text-sm transition-all ${
            selectedType === 'domestic'
              ? 'bg-gradient-to-r from-orange-500 to-red-600 text-white shadow-md'
              : 'bg-white border border-gray-200 text-gray-700 hover:border-orange-200'
          }`}
        >
          🇮🇳 Domestic Travel
        </button>
        <button
          onClick={() => setSelectedType('international')}
          className={`flex-1 py-2 px-4 rounded-lg font-semibold text-sm transition-all ${
            selectedType === 'international'
              ? 'bg-gradient-to-r from-orange-500 to-red-600 text-white shadow-md'
              : 'bg-white border border-gray-200 text-gray-700 hover:border-orange-200'
          }`}
        >
          🌍 International Travel
        </button>
      </div>

      {/* Progress Bar */}
      <Card className="p-4 bg-gradient-to-r from-orange-50 to-red-50">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-semibold text-gray-900">Documentation Progress</span>
          <span className="text-sm font-bold text-orange-600">{completionPercentage}%</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className="bg-gradient-to-r from-orange-500 to-red-600 h-2 rounded-full transition-all"
            style={{ width: `${completionPercentage}%` }}
          ></div>
        </div>
        <p className="text-xs text-gray-600 mt-2">
          {completedItems.size} of {checklist.length} documents completed
        </p>
      </Card>

      {/* Important Notice */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
        <div className="flex items-start gap-2">
          <Info className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold text-blue-900 mb-1">
              Important: Start Early!
            </p>
            <p className="text-xs text-blue-800">
              {selectedType === 'international'
                ? 'International travel requires 2-3 months of preparation. Start the documentation process well in advance.'
                : 'Domestic travel requires at least 1-2 weeks of preparation. Ensure all documents are ready before your travel date.'}
            </p>
          </div>
        </div>
      </div>

      {/* Checklist */}
      <div className="space-y-2">
        <h4 className="font-bold text-gray-900">Required Documents</h4>
        {checklist.map((item) => (
          <Card
            key={item.id}
            className={`p-4 cursor-pointer transition-all border-2 ${
              completedItems.has(item.id)
                ? 'border-green-500 bg-green-50'
                : item.required
                ? 'border-red-200 hover:border-red-300'
                : 'border-gray-200 hover:border-gray-300'
            }`}
            onClick={() => toggleItem(item.id)}
          >
            <div className="flex items-start gap-3">
              {/* Checkbox */}
              <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 mt-0.5 ${
                completedItems.has(item.id)
                  ? 'bg-green-500 border-green-500'
                  : 'border-gray-300'
              }`}>
                {completedItems.has(item.id) && (
                  <CheckCircle className="w-4 h-4 text-white" />
                )}
              </div>

              {/* Content */}
              <div className="flex-1">
                <div className="flex items-start justify-between mb-1">
                  <h5 className="font-bold text-gray-900">{item.title}</h5>
                  <Badge
                    variant={item.required ? 'destructive' : 'secondary'}
                    className="text-xs"
                  >
                    {item.required ? 'Required' : 'Optional'}
                  </Badge>
                </div>
                
                <p className="text-sm text-gray-700 mb-2">{item.description}</p>
                
                {item.helpText && (
                  <div className="bg-white/50 rounded p-2 flex items-start gap-2">
                    <Info className="w-4 h-4 text-orange-600 mt-0.5 flex-shrink-0" />
                    <p className="text-xs text-gray-600">{item.helpText}</p>
                  </div>
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Tips */}
      {tips.length > 0 && (
        <Card className="p-4 bg-yellow-50 border-yellow-200">
          <h4 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-yellow-600" />
            Pro Tips
          </h4>
          <div className="space-y-2">
            {tips.map((tip, idx) => (
              <div key={idx} className="flex items-start gap-2">
                <span className="text-yellow-600 font-bold">•</span>
                <p className="text-sm text-gray-700">{tip}</p>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Action Button */}
      {completionPercentage === 100 && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
          <CheckCircle className="w-12 h-12 text-green-600 mx-auto mb-2" />
          <p className="font-bold text-green-900 mb-1">All documents ready!</p>
          <p className="text-sm text-green-700">You're all set for travel. Keep all original documents with you.</p>
        </div>
      )}
    </div>
  );
}
