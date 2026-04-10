'use client';

/**
 * Diagnostics Services Landing Page
 * Lab discovery, test packages, and diagnostic center search
 */

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  ArrowLeft,
  FlaskConical,
  Sparkles,
  Star,
  TrendingUp,
  ChevronRight,
  MapPin,
  Home as HomeIcon,
  Building2,
  Clock,
  Search,
  Filter,
  TestTube,
  FileText,
  Microscope,
  Activity,
  Heart,
  ShieldCheck,
  Package,
  ChevronDown,
  Stethoscope
} from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { ServiceDashboardHeader } from './shared/ServiceDashboardHeader';
import { toast } from 'sonner';

interface DiagnosticsServicesLandingProps {
  phone: string;
  onBack: () => void;
  onNavigate?: (screen: string, data?: any) => void;
}

interface DiagnosticCenter {
  id: string;
  businessName: string;
  rating: number;
  reviewCount: number;
  distance: number;
  address?: string;
  homeCollectionAvailable: boolean;
  testCount: number;
  packages: any[];
  tests: any[];
}

interface TestPackage {
  id: string;
  name: string;
  description: string;
  tests: string[];
  price: number;
  originalPrice?: number;
  homeCollection: boolean;
  turnaroundHours: number;
}

export function DiagnosticsServicesLanding({ phone, onBack, onNavigate }: DiagnosticsServicesLandingProps) {
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'home' | 'center'>('all');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [distanceFilter, setDistanceFilter] = useState<number>(10); // km
  const [sortBy, setSortBy] = useState<'distance' | 'rating' | 'relevance'>('relevance');
  const [featuredCenters, setFeaturedCenters] = useState<DiagnosticCenter[]>([]);
  const [popularPackages, setPopularPackages] = useState<TestPackage[]>([]);
  const [expandedCenter, setExpandedCenter] = useState<string | null>(null);
  const [stats, setStats] = useState<any>(null);
  const [testCategories, setTestCategories] = useState<{ id: string; name: string; icon: any; color: string; count: number }[]>([]);
  /** Lab used for Health Package “Book” — required when multiple labs match filters (never guess `filteredCenters[0]`). */
  const [healthPackageLabId, setHealthPackageLabId] = useState('');

  useEffect(() => {
    loadDiagnosticsData();
  }, [distanceFilter, selectedFilter, selectedCategory]);

  const loadDiagnosticsData = async () => {
    try {
      setLoading(true);
      let latitude: string | undefined;
      let longitude: string | undefined;
      try {
        const profileRes = await apiClient.get(`/customer/profile?phone=${encodeURIComponent(phone)}`) as any;
        const profile = profileRes?.profile || profileRes;
        if (profile?.latitude != null && profile?.longitude != null) {
          latitude = String(profile.latitude);
          longitude = String(profile.longitude);
        }
      } catch (_) { /* ignore */ }
      if (latitude == null && typeof navigator !== 'undefined' && navigator.geolocation) {
        try {
          const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000, maximumAge: 300000 });
          });
          latitude = String(pos.coords.latitude);
          longitude = String(pos.coords.longitude);
        } catch (_) { /* ignore */ }
      }
      const params = new URLSearchParams({ maxDistance: distanceFilter.toString() });
      if (selectedFilter === 'home') params.set('serviceStyle', 'at_home');
      if (selectedFilter === 'center') params.set('serviceStyle', 'at_center');
      if (selectedCategory) params.set('category', selectedCategory);
      if (latitude && longitude) {
        params.set('lat', latitude);
        params.set('lng', longitude);
      }
      const [vendorsRes, categoriesRes, packagesRes] = await Promise.allSettled([
        apiClient.get<any>(`/customer/diagnostics/vendors-with-tests?${params.toString()}`),
        apiClient.get<any>('/public/diagnostics/categories'),
        apiClient.get<any>('/customer/diagnostic-packages')
      ]);

      const vendorsData = vendorsRes.status === 'fulfilled' ? vendorsRes.value : null;
      const vendorsList = vendorsData?.vendors ?? [];
      if (Array.isArray(vendorsList) && vendorsList.length > 0) {
        const centers: DiagnosticCenter[] = vendorsList.map((v: any) => ({
          id: v.id,
          businessName: v.businessName || 'Diagnostic Center',
          rating: v.rating ?? 4.5,
          reviewCount: 0,
          distance: v.distance ?? parseFloat((Math.random() * distanceFilter).toFixed(1)),
          address: v.address || [v.city, v.state].filter(Boolean).join(', '),
          homeCollectionAvailable: v.homeCollectionAvailable === true,
          testCount: (v.tests || []).length,
          packages: [],
          tests: (v.tests || []).map((t: any) => ({
            id: t.id,
            name: t.test_name,
            price: t.price,
            category: t.category,
            service_style: t.service_style,
          })),
        }));
        setFeaturedCenters(centers);
        setStats({
          activeCenters: centers.length,
          tests: centers.reduce((acc, c) => acc + c.testCount, 0).toString(),
          rating: centers.length ? (centers.reduce((acc, c) => acc + c.rating, 0) / centers.length).toFixed(1) : '4.6',
        });
      } else {
        const fallbackParams = new URLSearchParams({ roleId: 'diagnostics_center', maxDistance: distanceFilter.toString() });
        const fallbackRes = await apiClient.get<any>(`/customer/services?${fallbackParams.toString()}`);
        const servicesPayload = fallbackRes?.services ?? fallbackRes?.data?.services;
        if (Array.isArray(servicesPayload) && servicesPayload.length > 0) {
          const vendorMap = new Map<string, DiagnosticCenter>();
          servicesPayload.forEach((service: any) => {
            const vendorId = service.vendorId;
            if (!vendorMap.has(vendorId)) {
              vendorMap.set(vendorId, {
                id: vendorId,
                businessName: service.vendorName || 'Diagnostic Center',
                rating: 4.5,
                reviewCount: 0,
                distance: parseFloat((Math.random() * distanceFilter).toFixed(1)),
                address: '',
                homeCollectionAvailable: service.serviceStyle === 'at_home',
                testCount: 0,
                packages: [],
                tests: [],
              });
            }
            const vendor = vendorMap.get(vendorId)!;
            vendor.testCount++;
            vendor.tests.push({
              id: service.id,
              name: service.serviceName,
              price: service.price,
              category: service.category,
              service_style: service.serviceStyle,
            });
          });
          setFeaturedCenters(Array.from(vendorMap.values()));
          setStats({
            activeCenters: vendorMap.size,
            tests: servicesPayload.length.toString(),
            rating: '4.6',
          });
        } else {
          setFeaturedCenters([
          {
            id: 'center-1',
            businessName: 'PetPath Diagnostics',
            rating: 4.8,
            reviewCount: 256,
            distance: 2.3,
            address: 'MG Road, Bangalore',
            homeCollectionAvailable: true,
            testCount: 45,
            packages: [],
            tests: [
              { id: 't1', name: 'Complete Blood Count', price: 500, category: 'Blood' },
              { id: 't2', name: 'Liver Function Test', price: 800, category: 'Blood' },
              { id: 't3', name: 'Kidney Function Test', price: 750, category: 'Blood' },
            ]
          },
          {
            id: 'center-2',
            businessName: 'VetLab Plus',
            rating: 4.6,
            reviewCount: 189,
            distance: 3.5,
            address: 'Koramangala, Bangalore',
            homeCollectionAvailable: true,
            testCount: 38,
            packages: [],
            tests: [
              { id: 't4', name: 'X-Ray', price: 1200, category: 'Imaging' },
              { id: 't5', name: 'Ultrasound', price: 1500, category: 'Imaging' },
            ]
          },
          {
            id: 'center-3',
            businessName: 'PawCare Labs',
            rating: 4.7,
            reviewCount: 312,
            distance: 1.8,
            address: 'Indiranagar, Bangalore',
            homeCollectionAvailable: false,
            testCount: 52,
            packages: [],
            tests: [
              { id: 't6', name: 'Thyroid Panel', price: 900, category: 'Hormone' },
              { id: 't7', name: 'Allergy Test', price: 2500, category: 'Allergy' },
            ]
          }
        ]);
        
        setStats({
          activeCenters: 15,
          tests: '500+',
          rating: '4.6'
        });
        }
      }

      if (categoriesRes.status === 'fulfilled' && categoriesRes.value?.categories?.length) {
        const cats = categoriesRes.value.categories as { id: string; name: string }[];
        const iconMap: Record<string, any> = {
          blood: TestTube, imaging: Activity, allergy: Heart, hormone: Microscope,
          urine: TestTube, stool: TestTube, biopsy: Microscope, other: FlaskConical,
        };
        const allTests = vendorsList.flatMap((v: any) => v.tests || []);
        const countFor = (catId: string, catName: string) =>
          allTests.filter((t: any) => {
            const c = (t.category || '').toLowerCase();
            return c.includes(catId) || c.includes(catName.toLowerCase().replace(/\s+/g, '_'));
          }).length;
        setTestCategories(cats.map(c => ({
          id: c.id,
          name: c.name,
          icon: iconMap[c.id] || FlaskConical,
          color: c.id === 'blood' ? 'bg-red-100 text-red-600' : c.id === 'imaging' ? 'bg-blue-100 text-blue-600' : c.id === 'allergy' ? 'bg-pink-100 text-pink-600' : c.id === 'hormone' ? 'bg-purple-100 text-purple-600' : 'bg-gray-100 text-gray-600',
          count: countFor(c.id, c.name) || 0,
        })));
      } else {
        setTestCategories([
          { id: 'blood', name: 'Blood Tests', icon: TestTube, color: 'bg-red-100 text-red-600', count: 0 },
          { id: 'imaging', name: 'Imaging', icon: Activity, color: 'bg-blue-100 text-blue-600', count: 0 },
          { id: 'allergy', name: 'Allergy Tests', icon: Heart, color: 'bg-pink-100 text-pink-600', count: 0 },
          { id: 'hormone', name: 'Hormone Tests', icon: Microscope, color: 'bg-purple-100 text-purple-600', count: 0 },
        ]);
      }

      // Process packages
      if (packagesRes.status === 'fulfilled' && packagesRes.value?.packages) {
        setPopularPackages(packagesRes.value.packages);
      } else {
        // Fallback mock packages
        setPopularPackages([
          {
            id: 'pkg-1',
            name: 'Full Body Health Checkup',
            description: 'Comprehensive pet health screening',
            tests: ['CBC', 'LFT', 'KFT', 'Thyroid', 'Urine Analysis'],
            price: 2499,
            originalPrice: 3500,
            homeCollection: true,
            turnaroundHours: 24
          },
          {
            id: 'pkg-2',
            name: 'Senior Pet Package',
            description: 'For pets above 7 years',
            tests: ['CBC', 'LFT', 'KFT', 'X-Ray', 'ECG', 'Thyroid'],
            price: 3999,
            originalPrice: 5500,
            homeCollection: true,
            turnaroundHours: 48
          },
          {
            id: 'pkg-3',
            name: 'Basic Blood Panel',
            description: 'Essential blood tests',
            tests: ['CBC', 'Blood Glucose', 'Hemoglobin'],
            price: 799,
            originalPrice: 1200,
            homeCollection: true,
            turnaroundHours: 12
          }
        ]);
      }
    } catch (error) {
      console.error('Error loading diagnostics data:', error);
      setStats({
        activeCenters: 15,
        tests: '500+',
        rating: '4.6'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSelectCenter = (center: DiagnosticCenter) => {
    onNavigate?.('lab-booking', { vendorId: center.id, centerName: center.businessName });
  };

  const handleBookTest = (test: any, centerId: string) => {
    onNavigate?.('lab-booking', { vendorId: centerId, testId: test.id });
  };

  const filteredCenters = featuredCenters
    .filter(center => {
      const matchesSearch = center.businessName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           center.tests.some((t: any) => t.name.toLowerCase().includes(searchQuery.toLowerCase())) ||
                           (center.packages?.length && center.packages.some((p: any) => (p.name || '').toLowerCase().includes(searchQuery.toLowerCase())));
      const matchesFilter = selectedFilter === 'all' ||
                           (selectedFilter === 'home' && center.homeCollectionAvailable) ||
                           (selectedFilter === 'center' && !center.homeCollectionAvailable);
      const matchesDistance = center.distance <= distanceFilter;
      return matchesSearch && matchesFilter && matchesDistance;
    })
    .sort((a, b) => {
      if (sortBy === 'distance') return a.distance - b.distance;
      if (sortBy === 'rating') return (b.rating || 0) - (a.rating || 0);
      // relevance: rating * 0.6 - distance * 0.1 (higher score first)
      const scoreA = (a.rating || 0) * 0.6 - (a.distance || 0) * 0.1 + (a.homeCollectionAvailable ? 0.2 : 0);
      const scoreB = (b.rating || 0) * 0.6 - (b.distance || 0) * 0.1 + (b.homeCollectionAvailable ? 0.2 : 0);
      return scoreB - scoreA;
    });

  const labsForPackageBooking = filteredCenters;
  const autoSingleLabForPackages = labsForPackageBooking.length === 1 ? labsForPackageBooking[0].id : '';
  const resolvedPackageLabId = healthPackageLabId || autoSingleLabForPackages;

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center max-w-md mx-auto">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600"></div>
      </div>
    );
  }

  // Prepare stats for ServiceDashboardHeader
  const dashboardStats = stats ? [
    { value: `${stats.activeCenters}+`, label: 'Labs' },
    { value: stats.tests, label: 'Tests' },
    { value: `*${stats.rating}`, label: 'Rating' }
  ] : [
    { value: '15+', label: 'Labs' },
    { value: '500+', label: 'Tests' },
    { value: '*4.6', label: 'Rating' }
  ];

  const categoriesToShow = testCategories.length > 0 ? testCategories : [
    { id: 'blood', name: 'Blood Tests', icon: TestTube, color: 'bg-red-100 text-red-600', count: 45 },
    { id: 'imaging', name: 'Imaging', icon: Activity, color: 'bg-blue-100 text-blue-600', count: 12 },
    { id: 'allergy', name: 'Allergy Tests', icon: Heart, color: 'bg-pink-100 text-pink-600', count: 8 },
    { id: 'hormone', name: 'Hormone Tests', icon: Microscope, color: 'bg-purple-100 text-purple-600', count: 15 },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <ServiceDashboardHeader
        serviceName="Diagnostic Labs"
        serviceSubtitle="Lab tests & health checkups"
        serviceIcon={FlaskConical}
        iconColor="text-white"
        stats={dashboardStats}
        onBack={onBack}
        showBackButton={true}
        headerColor="bg-[#FF8C42]"
      />

      {/* Main Content */}
      <div className="max-w-md mx-auto px-4 pb-24 bg-white">
        {/* Search Bar */}
        <div className="py-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <Input
              type="text"
              placeholder="Search tests, packages, labs..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
            />
          </div>
          
          {/* Filter Pills */}
          <div className="flex gap-2 mt-3 overflow-x-auto pb-2 scrollbar-hide">
            <button
              onClick={() => setSelectedFilter('all')}
              className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
                selectedFilter === 'all' 
                  ? 'bg-teal-600 text-white' 
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              All Labs
            </button>
            <button
              onClick={() => setSelectedFilter('home')}
              className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all flex items-center gap-1 ${
                selectedFilter === 'home' 
                  ? 'bg-teal-600 text-white' 
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <HomeIcon className="w-4 h-4" />
              Home Collection
            </button>
            <button
              onClick={() => setSelectedFilter('center')}
              className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all flex items-center gap-1 ${
                selectedFilter === 'center' 
                  ? 'bg-teal-600 text-white' 
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <Building2 className="w-4 h-4" />
              Visit Center
            </button>
            
            {/* Distance Filter */}
            <select
              value={distanceFilter}
              onChange={(e) => setDistanceFilter(Number(e.target.value))}
              className="px-4 py-2 rounded-full text-sm font-medium bg-gray-100 text-gray-700 border-none focus:ring-2 focus:ring-teal-500"
            >
              <option value={5}>Within 5 km</option>
              <option value={10}>Within 10 km</option>
              <option value={20}>Within 20 km</option>
              <option value={50}>Within 50 km</option>
            </select>
            {/* Sort: Distance, Rating, Relevance */}
            <div className="flex gap-1 shrink-0">
              {(['distance', 'rating', 'relevance'] as const).map((key) => (
                <button
                  key={key}
                  onClick={() => setSortBy(key)}
                  className={`px-3 py-2 rounded-full text-xs font-medium whitespace-nowrap ${
                    sortBy === key ? 'bg-teal-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {key === 'distance' ? 'Distance' : key === 'rating' ? 'Rating' : 'Relevance'}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Popular Packages */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <Package className="w-5 h-5 text-teal-600" />
            <h2 className="text-lg font-semibold">Health Packages</h2>
          </div>

          {labsForPackageBooking.length > 1 && (
            <div className="mb-3 p-3 bg-amber-50 border border-amber-100 rounded-xl">
              <label className="block text-xs font-medium text-amber-900 mb-1">Book packages at which lab?</label>
              <select
                value={healthPackageLabId}
                onChange={(e) => setHealthPackageLabId(e.target.value)}
                className="w-full px-3 py-2 border border-amber-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
              >
                <option value="">Select a lab…</option>
                {labsForPackageBooking.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.businessName}
                  </option>
                ))}
              </select>
            </div>
          )}
          {labsForPackageBooking.length === 1 && (
            <p className="text-xs text-gray-500 mb-3">
              Packages book at <span className="font-medium text-gray-700">{labsForPackageBooking[0].businessName}</span>.
            </p>
          )}
          {labsForPackageBooking.length === 0 && popularPackages.length > 0 && (
            <p className="text-xs text-amber-800 mb-3 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
              No labs match your filters. Adjust search or filters to book a package.
            </p>
          )}
          
          <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide -mx-4 px-4">
            {popularPackages.map((pkg) => (
              <Card 
                key={pkg.id}
                className="min-w-[280px] flex-shrink-0 bg-white border border-gray-100 p-4 shadow-sm hover:shadow-md transition-all"
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <Badge className="bg-teal-100 text-teal-600 border-none mb-2">Popular</Badge>
                    <h3 className="font-semibold text-gray-900">{pkg.name}</h3>
                    <p className="text-xs text-gray-500 mt-1">{pkg.description}</p>
                  </div>
                </div>
                
                <div className="flex flex-wrap gap-1 mb-3">
                  {pkg.tests.slice(0, 3).map((test, i) => (
                    <span key={i} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                      {test}
                    </span>
                  ))}
                  {pkg.tests.length > 3 && (
                    <span className="text-xs text-teal-600 font-medium">+{pkg.tests.length - 3} more</span>
                  )}
                </div>
                
                <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xl font-bold text-teal-600">₹{pkg.price}</span>
                      {pkg.originalPrice && (
                        <span className="text-sm text-gray-400 line-through">₹{pkg.originalPrice}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-gray-500 mt-1">
                      {pkg.homeCollection && (
                        <span className="flex items-center gap-1">
                          <HomeIcon className="w-3 h-3" />
                          Home Collection
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {pkg.turnaroundHours}h
                      </span>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    className="bg-teal-600 text-white hover:bg-teal-700 disabled:opacity-50"
                    disabled={!resolvedPackageLabId || !labsForPackageBooking.some((c) => c.id === resolvedPackageLabId)}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      const vendorId = resolvedPackageLabId;
                      if (!vendorId || !labsForPackageBooking.some((c) => c.id === vendorId)) {
                        toast.error('Choose a lab from the dropdown above (or adjust filters so at least one lab appears).');
                        return;
                      }
                      onNavigate?.('lab-booking', {
                        vendorId,
                        packageId: pkg.id,
                        packageName: pkg.name,
                        packageTestLabels: Array.isArray(pkg.tests) ? pkg.tests : [],
                      });
                    }}
                  >
                    Book
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </div>

        {/* Test Categories */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold">Test Categories</h2>
          </div>
          
          <div className="grid grid-cols-2 gap-3">
            {categoriesToShow.map((category) => {
              const Icon = category.icon;
              return (
                <Card
                  key={category.id}
                  className={`p-4 cursor-pointer hover:shadow-md transition-all border bg-white shadow-sm ${
                    selectedCategory === category.id ? 'border-teal-500 ring-2 ring-teal-200' : 'border-gray-100'
                  }`}
                  onClick={() => setSelectedCategory(selectedCategory === category.id ? null : category.id)}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 ${category.color} rounded-lg flex items-center justify-center`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-sm">{category.name}</h3>
                      <p className="text-xs text-gray-500">{category.count} tests</p>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>

        {/* Diagnostic Centers */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold">Nearby Labs</h2>
            <span className="text-sm text-gray-500">{filteredCenters.length} found</span>
          </div>
          
          <div className="space-y-3">
            {filteredCenters.length > 0 ? (
              filteredCenters.map((center) => (
                <Card 
                  key={center.id}
                  className="bg-white border border-gray-100 shadow-sm overflow-hidden"
                >
                  {/* Center Header */}
                  <div 
                    className="p-4 cursor-pointer hover:bg-gray-50 transition-colors"
                    onClick={() => setExpandedCenter(expandedCenter === center.id ? null : center.id)}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-14 h-14 bg-gradient-to-br from-teal-600 to-teal-700 rounded-xl flex items-center justify-center text-white text-xl font-bold flex-shrink-0">
                        {center.businessName.charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-semibold truncate">{center.businessName}</h3>
                          {center.homeCollectionAvailable && (
                            <Badge className="bg-green-100 text-green-600 border-none text-xs">
                              <HomeIcon className="w-3 h-3 mr-1" />
                              Home
                            </Badge>
                          )}
                          {center.tests.some((t: any) => t.service_style === 'at_center') && (
                            <Badge className="bg-blue-100 text-blue-600 border-none text-xs">
                              <Building2 className="w-3 h-3 mr-1" />
                              Visit Center
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 truncate mt-1">{center.address}</p>
                        <div className="flex items-center gap-3 text-xs mt-1">
                          <div className="flex items-center gap-1 text-amber-500">
                            <Star className="w-3 h-3 fill-current" />
                            <span className="font-semibold">{center.rating}</span>
                            <span className="text-gray-400">({center.reviewCount})</span>
                          </div>
                          <div className="flex items-center gap-1 text-gray-500">
                            <MapPin className="w-3 h-3" />
                            <span>{center.distance} km</span>
                          </div>
                          <div className="flex items-center gap-1 text-gray-500">
                            <TestTube className="w-3 h-3" />
                            <span>{center.testCount} tests</span>
                          </div>
                        </div>
                      </div>
                      <ChevronDown 
                        className={`w-5 h-5 text-gray-400 transition-transform ${
                          expandedCenter === center.id ? 'rotate-180' : ''
                        }`}
                      />
                    </div>
                  </div>
                  
                  {/* Expanded Tests List */}
                  {expandedCenter === center.id && (
                    <div className="border-t border-gray-100">
                      <div className="p-3 bg-gray-50">
                        <p className="text-xs text-gray-500 mb-2">Available Tests</p>
                        <div className="space-y-2 max-h-48 overflow-y-auto">
                          {center.tests.map((test: any) => (
                            <div 
                              key={test.id}
                              className="flex items-center justify-between bg-white p-3 rounded-lg border border-gray-100"
                            >
                              <div>
                                <p className="font-medium text-sm">{test.name}</p>
                                <p className="text-xs text-gray-500">{test.category}</p>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-teal-600">₹{test.price}</span>
                                <Button 
                                  size="sm" 
                                  variant="outline"
                                  className="h-7 text-xs border-teal-600 text-teal-600 hover:bg-teal-50"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleBookTest(test, center.id);
                                  }}
                                >
                                  Book
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                      
                      {/* View All Button */}
                      <div className="p-3 border-t border-gray-100">
                        <Button 
                          className="w-full bg-teal-600 text-white hover:bg-teal-700"
                          onClick={() => handleSelectCenter(center)}
                        >
                          View All Tests & Book
                        </Button>
                      </div>
                    </div>
                  )}
                </Card>
              ))
            ) : (
              <Card className="p-8 text-center bg-white border border-gray-100">
                <FlaskConical className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <h3 className="font-semibold text-gray-700 mb-1">No labs found</h3>
                <p className="text-sm text-gray-500">Try adjusting your search or filters</p>
              </Card>
            )}
          </div>
        </div>

        {/* Why Choose Us */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="w-5 h-5 text-teal-600" />
            <h2 className="text-lg font-semibold">Why Choose Us</h2>
          </div>
          
          <div className="space-y-3">
            <Card className="p-4 bg-white border border-gray-100 shadow-sm">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-teal-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <ShieldCheck className="w-5 h-5 text-teal-600" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold mb-1">NABL Accredited Labs</h3>
                  <p className="text-sm text-gray-600">All partner labs are certified and quality assured</p>
                </div>
              </div>
            </Card>

            <Card className="p-4 bg-white border border-gray-100 shadow-sm">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <HomeIcon className="w-5 h-5 text-blue-600" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold mb-1">Free Home Collection</h3>
                  <p className="text-sm text-gray-600">Trained phlebotomists for stress-free sample collection</p>
                </div>
              </div>
            </Card>

            <Card className="p-4 bg-white border border-gray-100 shadow-sm">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <FileText className="w-5 h-5 text-green-600" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold mb-1">Digital Reports</h3>
                  <p className="text-sm text-gray-600">Get reports online and share with your vet instantly</p>
                </div>
              </div>
            </Card>

            <Card className="p-4 bg-white border border-gray-100 shadow-sm">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Stethoscope className="w-5 h-5 text-purple-600" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold mb-1">Vet Consultation</h3>
                  <p className="text-sm text-gray-600">Free report interpretation by expert vets</p>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
