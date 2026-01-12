/**
 * Services Directory - Shows all 20 service categories
 */

import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '../ui/card';
import { Badge } from '../ui/badge';
import { 
  Stethoscope, Scissors, GraduationCap, Home, Footprints, 
  Apple, Pill, Heart, Shield, Sun, Camera, Car, 
  Baby, Flower, UtensilsCrossed, Activity, Users, AlertCircle
} from 'lucide-react';

const SERVICE_CATEGORIES = [
  {
    id: 'veterinary',
    name: 'Veterinary',
    icon: Stethoscope,
    description: '24/7 vet care, checkups, vaccinations, surgery & emergency services',
    color: 'from-teal-500 to-cyan-500',
    bg: 'bg-teal-50',
    count: '20+',
    popular: true
  },
  {
    id: 'grooming',
    name: 'Grooming',
    icon: Scissors,
    description: 'Full grooming, bath, haircut, nail trimming & spa treatments',
    color: 'from-pink-500 to-rose-500',
    bg: 'bg-pink-50',
    count: '15+',
    popular: true
  },
  {
    id: 'training',
    name: 'Training',
    icon: GraduationCap,
    description: 'Obedience, behavioral, puppy training & agility courses',
    color: 'from-purple-500 to-indigo-500',
    bg: 'bg-purple-50',
    count: '10+',
    popular: true
  },
  {
    id: 'boarding',
    name: 'Boarding',
    icon: Home,
    description: 'Safe overnight care, luxury suites & medical boarding',
    color: 'from-orange-500 to-amber-500',
    bg: 'bg-orange-50',
    count: '10+',
    popular: true
  },
  {
    id: 'walking',
    name: 'Walking',
    icon: Footprints,
    description: 'Daily walks, adventure hikes & jogging partners',
    color: 'from-green-500 to-emerald-500',
    bg: 'bg-green-50',
    count: '8+',
    popular: true
  },
  {
    id: 'daycare',
    name: 'Daycare',
    icon: Sun,
    description: 'Full-day supervised playcare & socialization',
    color: 'from-yellow-500 to-orange-500',
    bg: 'bg-yellow-50',
    count: '8+'
  },
  {
    id: 'nutrition',
    name: 'Nutrition',
    icon: Apple,
    description: 'Diet plans, weight management & nutrition consultations',
    color: 'from-lime-500 to-green-500',
    bg: 'bg-green-50',
    count: '8+'
  },
  {
    id: 'pharmacy',
    name: 'Pharmacy',
    icon: Pill,
    description: 'Medicines, supplements & prescription fulfillment',
    color: 'from-blue-500 to-cyan-500',
    bg: 'bg-blue-50',
    count: '10+'
  },
  {
    id: 'spa',
    name: 'Spa',
    icon: Activity,
    description: 'Luxury spa, massage, aromatherapy & hydrotherapy',
    color: 'from-pink-500 to-purple-500',
    bg: 'bg-pink-50',
    count: '8+'
  },
  {
    id: 'photography',
    name: 'Photography',
    icon: Camera,
    description: 'Professional pet photoshoots & portraits',
    color: 'from-violet-500 to-purple-500',
    bg: 'bg-purple-50',
    count: '5+'
  },
  {
    id: 'taxi',
    name: 'Pet Transport',
    icon: Car,
    description: 'Safe pet taxi, airport transfers & intercity transport',
    color: 'from-blue-500 to-indigo-500',
    bg: 'bg-blue-50',
    count: '5+'
  },
  {
    id: 'adoption',
    name: 'Adoption',
    icon: Heart,
    description: 'Find your perfect pet companion & adoption support',
    color: 'from-red-500 to-pink-500',
    bg: 'bg-pink-50',
    count: '3+'
  },
  {
    id: 'breeding',
    name: 'Breeding',
    icon: Baby,
    description: 'Stud services, pregnancy care & whelping assistance',
    color: 'from-pink-500 to-rose-500',
    bg: 'bg-pink-50',
    count: '5+'
  },
  {
    id: 'insurance',
    name: 'Insurance',
    icon: Shield,
    description: 'Pet insurance plans & health coverage',
    color: 'from-purple-500 to-violet-500',
    bg: 'bg-purple-50',
    count: 'Plans'
  },
  {
    id: 'pet-cafe',
    name: 'Pet Cafe',
    icon: UtensilsCrossed,
    description: 'Pet-friendly cafes & dining experiences',
    color: 'from-amber-500 to-orange-500',
    bg: 'bg-orange-50',
    count: 'Venues'
  },
  {
    id: 'cremation',
    name: 'Cremation',
    icon: Flower,
    description: 'Compassionate end-of-life services & memorials',
    color: 'from-gray-500 to-slate-500',
    bg: 'bg-gray-50',
    count: '3+'
  },
  {
    id: 'ambulance',
    name: 'Pet Ambulance',
    icon: AlertCircle,
    description: '24/7 emergency pet ambulance services',
    color: 'from-red-500 to-orange-500',
    bg: 'bg-red-50',
    count: '24/7'
  }
];

export function ServicesDirectory() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero Section */}
      <div className="bg-gradient-to-r from-orange-500 to-pink-500 text-white">
        <div className="max-w-7xl mx-auto px-4 py-16">
          <div className="text-center max-w-3xl mx-auto">
            <h1 className="text-5xl font-bold mb-4">
              Complete Pet Care Services
            </h1>
            <p className="text-xl opacity-90 mb-8">
              Everything your pet needs, all in one place. Trusted by thousands of pet parents.
            </p>
            <div className="flex justify-center gap-8">
              <div>
                <div className="text-4xl font-bold">20+</div>
                <div className="text-sm opacity-80">Service Categories</div>
              </div>
              <div>
                <div className="text-4xl font-bold">100+</div>
                <div className="text-sm opacity-80">Services Available</div>
              </div>
              <div>
                <div className="text-4xl font-bold">50K+</div>
                <div className="text-sm opacity-80">Happy Customers</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Services Grid */}
      <div className="max-w-7xl mx-auto px-4 py-12">
        {/* Popular Services */}
        <div className="mb-12">
          <div className="flex items-center gap-2 mb-6">
            <h2 className="text-2xl font-bold">Popular Services</h2>
            <Badge className="bg-orange-500">Most Booked</Badge>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
            {SERVICE_CATEGORIES.filter(cat => cat.popular).map(category => {
              const Icon = category.icon;
              return (
                <Card
                  key={category.id}
                  className="overflow-hidden hover:shadow-xl transition-all cursor-pointer group"
                  onClick={() => navigate(`/services/${category.name}`)}
                >
                  <div className={`bg-gradient-to-r ${category.color} p-6 text-white`}>
                    <div className="flex items-start justify-between mb-4">
                      <Icon className="w-12 h-12" />
                      <Badge className="bg-white/20 text-white border-white/30">
                        {category.count} services
                      </Badge>
                    </div>
                    <h3 className="text-2xl font-bold mb-2">{category.name}</h3>
                  </div>
                  <CardContent className="p-6">
                    <p className="text-gray-600 mb-4">{category.description}</p>
                    <div className="text-orange-600 font-medium group-hover:translate-x-2 transition-transform inline-block">
                      Explore →
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>

        {/* All Services */}
        <div>
          <h2 className="text-2xl font-bold mb-6">All Services</h2>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
            {SERVICE_CATEGORIES.filter(cat => !cat.popular).map(category => {
              const Icon = category.icon;
              return (
                <Card
                  key={category.id}
                  className={`${category.bg} hover:shadow-lg transition-all cursor-pointer group`}
                  onClick={() => navigate(`/services/${category.name}`)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3 mb-3">
                      <div className={`p-2 rounded-lg bg-gradient-to-r ${category.color}`}>
                        <Icon className="w-6 h-6 text-white" />
                      </div>
                      <div className="flex-1">
                        <h3 className="font-bold group-hover:text-orange-600 transition-colors">
                          {category.name}
                        </h3>
                        <p className="text-xs text-gray-500">{category.count} services</p>
                      </div>
                    </div>
                    <p className="text-xs text-gray-600 line-clamp-2">
                      {category.description}
                    </p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </div>

      {/* CTA Section */}
      <div className="bg-gradient-to-r from-orange-500 to-pink-500 text-white py-16">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold mb-4">
            Can't Find What You're Looking For?
          </h2>
          <p className="text-xl opacity-90 mb-8">
            Our customer support team is here to help you find the perfect service for your pet
          </p>
          <div className="flex gap-4 justify-center flex-wrap">
            <button className="bg-white text-orange-600 px-8 py-3 rounded-lg font-semibold hover:bg-gray-100 transition-colors">
              Contact Support
            </button>
            <button className="border-2 border-white px-8 py-3 rounded-lg font-semibold hover:bg-white/10 transition-colors">
              Browse All Services
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
