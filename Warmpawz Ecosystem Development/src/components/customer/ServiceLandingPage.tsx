/**
 * Universal Service Landing Page - Works for ALL 20 Service Categories
 * Dynamically displays services based on category parameter
 */

import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, MapPin, Star, Filter, ChevronDown, Calendar, Clock, IndianRupee } from 'lucide-react';
import { Button } from '../ui/button';
import { Card, CardContent } from '../ui/card';
import { Badge } from '../ui/badge';
import { Input } from '../ui/input';
import { EXPANDED_SERVICES } from '../../lib/mockDataExpanded';
import { mockSearchAPI } from '../../lib/mockAPI';
import { toast } from 'sonner';

// Service category color mapping (from guidelines)
const SERVICE_COLORS: Record<string, { bg: string; text: string; badge: string }> = {
  'Veterinary': { bg: 'bg-teal-50', text: 'text-teal-700', badge: 'bg-teal-100' },
  'Grooming': { bg: 'bg-pink-50', text: 'text-pink-700', badge: 'bg-pink-100' },
  'Training': { bg: 'bg-purple-50', text: 'text-purple-700', badge: 'bg-purple-100' },
  'Boarding': { bg: 'bg-orange-50', text: 'text-orange-700', badge: 'bg-orange-100' },
  'Walking': { bg: 'bg-green-50', text: 'text-green-700', badge: 'bg-green-100' },
  'Nutrition': { bg: 'bg-yellow-50', text: 'text-yellow-700', badge: 'bg-yellow-100' },
  'Pharmacy': { bg: 'bg-blue-50', text: 'text-blue-700', badge: 'bg-blue-100' },
  'Adoption': { bg: 'bg-pink-50', text: 'text-pink-700', badge: 'bg-pink-100' },
  'Insurance': { bg: 'bg-purple-50', text: 'text-purple-700', badge: 'bg-purple-100' },
  'Daycare': { bg: 'bg-orange-50', text: 'text-orange-700', badge: 'bg-orange-100' },
  'Spa': { bg: 'bg-pink-50', text: 'text-pink-700', badge: 'bg-pink-100' },
  'Photography': { bg: 'bg-purple-50', text: 'text-purple-700', badge: 'bg-purple-100' },
  'Taxi': { bg: 'bg-blue-50', text: 'text-blue-700', badge: 'bg-blue-100' },
  'Breeding': { bg: 'bg-pink-50', text: 'text-pink-700', badge: 'bg-pink-100' },
  'Cremation': { bg: 'bg-gray-50', text: 'text-gray-700', badge: 'bg-gray-100' }
};

export function ServiceLandingPage() {
  const { category } = useParams<{ category: string }>();
  const navigate = useNavigate();
  
  const [services, setServices] = useState<any[]>([]);
  const [filteredServices, setFilteredServices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStyle, setSelectedStyle] = useState<string>('');
  const [priceRange, setPriceRange] = useState({ min: 0, max: 50000 });
  const [sortBy, setSortBy] = useState('popular');
  
  const categoryName = category ? decodeURIComponent(category) : '';
  const colors = SERVICE_COLORS[categoryName] || { bg: 'bg-gray-50', text: 'text-gray-700', badge: 'bg-gray-100' };

  useEffect(() => {
    loadServices();
  }, [category]);

  useEffect(() => {
    applyFilters();
  }, [services, searchQuery, selectedStyle, priceRange, sortBy]);

  const loadServices = async () => {
    try {
      setLoading(true);
      const categoryServices = EXPANDED_SERVICES.filter(
        s => s.category === categoryName && s.is_active
      );
      setServices(categoryServices);
    } catch (error) {
      console.error('Failed to load services:', error);
      toast.error('Failed to load services');
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...services];

    // Search
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(s =>
        s.name.toLowerCase().includes(query) ||
        s.description.toLowerCase().includes(query) ||
        s.problem_tags?.some((tag: string) => tag.toLowerCase().includes(query))
      );
    }

    // Service style
    if (selectedStyle) {
      filtered = filtered.filter(s => s.service_styles.includes(selectedStyle));
    }

    // Price range
    filtered = filtered.filter(s => s.price >= priceRange.min && s.price <= priceRange.max);

    // Sort
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'price-low':
          return a.price - b.price;
        case 'price-high':
          return b.price - a.price;
        case 'duration':
          return (a.duration || 0) - (b.duration || 0);
        default:
          return 0;
      }
    });

    setFilteredServices(filtered);
  };

  const bookService = (serviceId: string) => {
    navigate(`/booking/${serviceId}`);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero Section */}
      <div className={`${colors.bg} border-b`}>
        <div className="max-w-7xl mx-auto px-4 py-12">
          <Button
            variant="ghost"
            onClick={() => navigate('/services')}
            className="mb-6 gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Services
          </Button>

          <div className="max-w-3xl">
            <h1 className="text-4xl font-bold mb-4">{categoryName} Services</h1>
            <p className="text-lg text-gray-600 mb-6">
              Find the best {categoryName.toLowerCase()} services for your beloved pets
            </p>
            
            {/* Quick Stats */}
            <div className="flex gap-6">
              <div>
                <div className="text-3xl font-bold ${colors.text}">{services.length}+</div>
                <div className="text-sm text-gray-600">Services Available</div>
              </div>
              <div>
                <div className="text-3xl font-bold ${colors.text}">4.8★</div>
                <div className="text-sm text-gray-600">Average Rating</div>
              </div>
              <div>
                <div className="text-3xl font-bold ${colors.text}">24/7</div>
                <div className="text-sm text-gray-600">Support Available</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="bg-white border-b sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex gap-4 flex-wrap items-center">
            {/* Search */}
            <Input
              placeholder={`Search ${categoryName.toLowerCase()} services...`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="max-w-xs"
            />

            {/* Service Style Filter */}
            <select
              value={selectedStyle}
              onChange={(e) => setSelectedStyle(e.target.value)}
              className="border rounded-lg px-4 py-2"
            >
              <option value="">All Styles</option>
              <option value="centre">At Centre</option>
              <option value="home">At Home</option>
              <option value="tele">Tele Consultation</option>
            </select>

            {/* Sort */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="border rounded-lg px-4 py-2"
            >
              <option value="popular">Most Popular</option>
              <option value="price-low">Price: Low to High</option>
              <option value="price-high">Price: High to Low</option>
              <option value="duration">Duration</option>
            </select>

            <div className="ml-auto text-sm text-gray-600">
              {filteredServices.length} services found
            </div>
          </div>
        </div>
      </div>

      {/* Services Grid */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        {filteredServices.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <p className="text-gray-500 mb-4">No services found</p>
              <Button onClick={() => {
                setSearchQuery('');
                setSelectedStyle('');
              }}>
                Clear Filters
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredServices.map(service => (
              <Card
                key={service.id}
                className="overflow-hidden hover:shadow-lg transition-all cursor-pointer group"
              >
                {/* Service Header */}
                <div className={`${colors.bg} p-4 border-b`}>
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <h3 className="font-bold text-lg mb-1 group-hover:text-orange-600 transition-colors">
                        {service.name}
                      </h3>
                      {service.subcategory && (
                        <Badge variant="outline" className="text-xs">
                          {service.subcategory}
                        </Badge>
                      )}
                    </div>
                  </div>
                  
                  {/* Service Styles */}
                  <div className="flex gap-1 flex-wrap">
                    {service.service_styles.map((style: string) => (
                      <Badge key={style} className={`${colors.badge} text-xs`}>
                        {style === 'centre' ? '🏢 Centre' : style === 'home' ? '🏠 Home' : '📞 Tele'}
                      </Badge>
                    ))}
                  </div>
                </div>

                <CardContent className="p-4">
                  <p className="text-sm text-gray-600 mb-4 line-clamp-2">
                    {service.description}
                  </p>

                  {/* Service Info */}
                  <div className="space-y-2 mb-4">
                    <div className="flex items-center gap-2 text-sm">
                      <Clock className="w-4 h-4 text-gray-400" />
                      <span>{service.duration} minutes</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm font-bold ${colors.text}">
                      <IndianRupee className="w-4 h-4" />
                      <span className="text-2xl">₹{service.price}</span>
                    </div>
                  </div>

                  {/* Tags */}
                  {service.problem_tags && service.problem_tags.length > 0 && (
                    <div className="flex gap-1 flex-wrap mb-4">
                      {service.problem_tags.slice(0, 3).map((tag: string) => (
                        <Badge key={tag} variant="secondary" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  )}

                  <Button
                    onClick={() => bookService(service.id)}
                    className="w-full bg-gradient-to-r from-orange-500 to-pink-500 gap-2"
                  >
                    <Calendar className="w-4 h-4" />
                    Book Now
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Why Choose Us Section */}
      <div className="bg-white border-t py-12">
        <div className="max-w-7xl mx-auto px-4">
          <h2 className="text-2xl font-bold text-center mb-8">
            Why Choose Warmpawz for {categoryName}?
          </h2>
          
          <div className="grid md:grid-cols-4 gap-6">
            <Card>
              <CardContent className="p-6 text-center">
                <div className="text-4xl mb-3">✅</div>
                <h3 className="font-semibold mb-2">Verified Professionals</h3>
                <p className="text-sm text-gray-600">
                  All service providers are verified and certified
                </p>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-6 text-center">
                <div className="text-4xl mb-3">💰</div>
                <h3 className="font-semibold mb-2">Best Prices</h3>
                <p className="text-sm text-gray-600">
                  Competitive pricing with no hidden charges
                </p>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-6 text-center">
                <div className="text-4xl mb-3">⭐</div>
                <h3 className="font-semibold mb-2">Quality Assured</h3>
                <p className="text-sm text-gray-600">
                  Highest quality standards and customer satisfaction
                </p>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-6 text-center">
                <div className="text-4xl mb-3">🛡️</div>
                <h3 className="font-semibold mb-2">Safe & Secure</h3>
                <p className="text-sm text-gray-600">
                  Your pet's safety is our top priority
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
