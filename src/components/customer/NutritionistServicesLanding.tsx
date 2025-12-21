import { useState, useEffect } from 'react';
import { Apple, Utensils, ChartBar, ArrowLeft, Heart, Star, MapPin, ChevronRight } from 'lucide-react';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { projectId, publicAnonKey } from '../../utils/supabase/info';
import { UniversalVendorCard } from './UniversalVendorCard';

interface NutritionistServicesLandingProps {
  onBack: () => void;
  onNavigate?: (screen: string, data?: any) => void;
  customerId?: string;
  phone?: string;
}

export function NutritionistServicesLanding({ onBack, onNavigate, customerId, phone }: NutritionistServicesLandingProps) {
  const [loading, setLoading] = useState(true);
  const [nutritionists, setNutritionists] = useState<any[]>([]);

  const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475`;

  useEffect(() => {
    loadNutritionists();
  }, []);

  const loadNutritionists = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `${API_BASE}/customer/services?roleId=pet_nutritionist`,
        { headers: { Authorization: `Bearer ${publicAnonKey}` } }
      );

      if (response.ok) {
        const data = await response.json();
        setNutritionists(data.services || []);
      }
    } catch (error) {
      console.error('Error loading nutritionists:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-gradient-to-r from-green-600 to-emerald-600 text-white sticky top-0 z-50 px-4 py-4">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="p-2 hover:bg-white/10 rounded-full">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1">
            <h1 className="text-xl font-bold">Pet Nutritionists</h1>
            <p className="text-white/90 text-sm">Expert diet & wellness plans</p>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-6 pb-24">
        <Card className="bg-gradient-to-br from-green-50 to-emerald-50 border-green-200 p-6">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h2 className="text-xl font-bold text-gray-900 mb-2">Custom Diet Plans</h2>
              <p className="text-gray-700 mb-4">Personalized nutrition for your pet's health</p>
              <Button className="bg-green-600 hover:bg-green-700">Get Started</Button>
            </div>
            <div className="text-5xl">🥗</div>
          </div>
        </Card>

        <div>
          <h2 className="font-bold text-gray-900 mb-4">Our Services</h2>
          <div className="grid grid-cols-2 gap-3">
            {[
              { icon: '📊', title: 'Diet Analysis', price: '₹999' },
              { icon: '🍽️', title: 'Meal Plans', price: '₹1,499' },
              { icon: '⚖️', title: 'Weight Management', price: '₹1,299' },
              { icon: '🩺', title: 'Health Consult', price: '₹799' }
            ].map((service, idx) => (
              <Card key={idx} className="p-4 text-center">
                <div className="text-3xl mb-2">{service.icon}</div>
                <h3 className="font-semibold text-sm mb-2">{service.title}</h3>
                <p className="text-green-600 font-bold">{service.price}</p>
              </Card>
            ))}
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-gray-900">Expert Nutritionists</h2>
            <button className="text-green-600 text-sm font-medium flex items-center gap-1">
              View All <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {nutritionists.length === 0 ? (
            <Card className="p-8 text-center">
              <div className="text-4xl mb-3">🥗</div>
              <p className="text-gray-600 mb-2">No nutritionists available yet</p>
              <p className="text-gray-500 text-sm">Check back soon for expert pet nutrition consultants!</p>
            </Card>
          ) : (
            <div className="space-y-3">
              {nutritionists.map((nutritionist, index) => (
                <UniversalVendorCard
                  key={nutritionist.id || index}
                  vendor={nutritionist}
                  icon="🥗"
                  colorClass="from-green-100 to-emerald-100"
                  onViewDetails={(vendorId) => {
                    console.log('View nutritionist details:', vendorId);
                    // TODO: Navigate to nutritionist profile
                  }}
                  onBook={(vendorId) => {
                    console.log('Book nutritionist:', vendorId);
                    // Navigate to meal products catalog
                    if (onNavigate) {
                      const vendor = nutritionists.find(n => n.vendorId === vendorId || n.id === vendorId);
                      onNavigate('meal-products', {
                        vendorId: vendorId,
                        vendorName: vendor?.businessName || vendor?.vendorName || 'Nutritionist'
                      });
                    }
                  }}
                />
              ))}
            </div>
          )}
        </div>

        {/* Benefits Section */}
        <Card className="p-6 bg-gradient-to-br from-gray-50 to-gray-100">
          <h3 className="font-bold text-gray-900 mb-4">Why Choose Our Nutritionists?</h3>
          <div className="space-y-3">
            {[
              { icon: '🎓', title: 'Certified Experts', desc: 'Qualified pet nutrition specialists' },
              { icon: '📊', title: 'Custom Plans', desc: 'Personalized diet for your pet' },
              { icon: '💪', title: 'Health Focused', desc: 'Science-backed nutrition advice' },
              { icon: '📱', title: 'Online Support', desc: '24/7 consultation available' }
            ].map((item, idx) => (
              <div key={idx} className="flex items-start gap-3">
                <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-xl shadow-sm">
                  {item.icon}
                </div>
                <div className="flex-1">
                  <h4 className="font-semibold text-gray-900">{item.title}</h4>
                  <p className="text-sm text-gray-600">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
