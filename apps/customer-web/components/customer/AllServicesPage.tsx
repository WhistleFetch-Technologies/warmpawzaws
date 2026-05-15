'use client';

/**
 * ALL SERVICES PAGE
 * 
 * Displays all available service categories in a grid layout
 * This is the page shown when user clicks "Find All Services" or "View All" from home
 * 
 * Design: Orange header with white card body (Warmpawz design system)
 * Features:
 * - Scrollable content with proper overflow handling
 * - Smart search with symptom-to-service mapping
 * - Polished rounded tile UI
 */

import { ArrowLeft, Search, Stethoscope, Scissors, ShoppingBag, GraduationCap, 
  Dog, Home as HomeIcon, Heart, Coffee, Users, Shield, Phone, Wheat, MapPin, 
  Sparkles, Palmtree, ChevronRight, PawPrint, Camera, Truck, Sun, X } from 'lucide-react';
import { useState, useMemo } from 'react';
import { ServiceDescriptionInline } from './shared/ServiceDescriptionInline';

interface AllServicesPageProps {
  onBack: () => void;
  onServiceSelect: (screen: string, data?: any) => void;
}

// Symptom to service mapping for smart search
const SYMPTOM_KEYWORDS: Record<string, string[]> = {
  // Vet Care symptoms
  vet: [
    'vomiting', 'vomit', 'sick', 'fever', 'temperature', 'cough', 'coughing',
    'diarrhea', 'constipation', 'blood', 'bleeding', 'wound', 'injury', 'injured',
    'not eating', 'loss of appetite', 'lethargy', 'tired', 'weak', 'weakness',
    'breathing', 'panting', 'limping', 'pain', 'swelling', 'lump', 'bump',
    'eye', 'ear', 'nose', 'teeth', 'dental', 'mouth', 'gum', 'infection',
    'allergy', 'allergic', 'itching', 'scratching', 'rash', 'skin', 'fur loss',
    'weight loss', 'weight gain', 'drinking', 'urination', 'pee', 'poop',
    'heart', 'cardio', 'cardiac', 'heartbeat', 'murmur', 'chest',
    'stomach', 'belly', 'abdomen', 'digestion', 'digestive',
    'vaccination', 'vaccine', 'shots', 'checkup', 'health check', 'general health',
    'emergency', 'urgent', 'critical', 'accident', 'hit by car',
  ],
  // Grooming related
  grooming: [
    'bath', 'bathing', 'dirty', 'smell', 'smelly', 'odor', 'stink',
    'hair', 'haircut', 'trim', 'trimming', 'shave', 'matted', 'tangled',
    'nail', 'nails', 'claw', 'claws', 'paw', 'paws', 'pad',
    'flea', 'fleas', 'tick', 'ticks', 'parasite', 'mite', 'mites',
    'shedding', 'shed', 'brush', 'brushing', 'coat', 'fur',
    'spa', 'massage', 'relaxation', 'pamper', 'beauty',
  ],
  // Training related
  training: [
    'bark', 'barking', 'bite', 'biting', 'aggressive', 'aggression',
    'obedience', 'command', 'commands', 'sit', 'stay', 'come', 'heel',
    'potty', 'toilet', 'house training', 'housebreaking', 'pee inside',
    'pull', 'pulling', 'leash', 'walk', 'walking behavior',
    'jump', 'jumping', 'chew', 'chewing', 'destructive', 'destroy',
    'anxiety', 'anxious', 'fear', 'scared', 'nervous', 'stress', 'stressed',
    'separation', 'alone', 'lonely', 'behavior', 'behavioural', 'misbehave',
    'puppy training', 'socialization', 'socialize',
  ],
  // Walker related
  walker: [
    'walk', 'walking', 'exercise', 'run', 'running', 'jog', 'jogging',
    'outdoor', 'outside', 'park', 'play', 'active', 'energy', 'energetic',
    'lazy', 'inactive', 'overweight', 'fat', 'obese', 'fitness',
  ],
  // Boarding related
  boarding: [
    'travel', 'traveling', 'vacation', 'holiday', 'trip', 'away',
    'stay', 'overnight', 'daycare', 'day care', 'hostel', 'hotel',
    'pet sitting', 'pet sitter', 'leave', 'leaving', 'going out',
  ],
  // Nutritionist related
  nutritionist: [
    'food', 'diet', 'nutrition', 'eating', 'meal', 'feed', 'feeding',
    'weight', 'obese', 'thin', 'skinny', 'underweight', 'overweight',
    'allergy food', 'sensitive stomach', 'digestive', 'protein',
    'vitamins', 'supplements', 'healthy diet',
  ],
  // Ambulance/Emergency
  ambulance: [
    'emergency', 'urgent', 'critical', 'accident', 'injured', 'hit',
    'unconscious', 'not moving', 'collapsed', 'seizure', 'choking',
    'poison', 'poisoned', 'toxic', 'ate something', 'transport',
  ],
  // Insurance
  insurance: [
    'insurance', 'coverage', 'policy', 'claim', 'medical bills', 'cost',
    'protection', 'health plan', 'accident coverage',
  ],
};

// Service categories matching the home page quickServices
const SERVICE_CATEGORIES = [
  // PRIMARY SERVICES
  { 
    id: 'vet', 
    icon: Stethoscope, 
    label: 'Vet Care', 
    description: 'Consultations, checkups & treatments',
    color: 'from-blue-50 to-blue-100/50',
    iconBg: 'bg-white',
    iconColor: 'text-blue-600',
    screen: 'vet'
  },
  { 
    id: 'grooming', 
    icon: Scissors, 
    label: 'Grooming', 
    description: 'Salon, spa & at-home grooming',
    color: 'from-orange-50 to-amber-100/50',
    iconBg: 'bg-white',
    iconColor: 'text-orange-500',
    screen: 'grooming'
  },
  { 
    id: 'shop', 
    icon: ShoppingBag, 
    label: 'Pet Products', 
    description: 'Food, accessories & medicines',
    color: 'from-pink-50 to-rose-100/50',
    iconBg: 'bg-white',
    iconColor: 'text-pink-500',
    screen: 'shop'
  },
  { 
    id: 'training', 
    icon: GraduationCap, 
    label: 'Training', 
    description: 'Obedience, behavior & skills',
    color: 'from-purple-50 to-violet-100/50',
    iconBg: 'bg-white',
    iconColor: 'text-purple-600',
    screen: 'training'
  },
  
  // CARE SERVICES
  { 
    id: 'walker', 
    icon: Dog, 
    label: 'Dog Walker', 
    description: 'Daily walks & exercise',
    color: 'from-green-50 to-emerald-100/50',
    iconBg: 'bg-white',
    iconColor: 'text-green-600',
    screen: 'walker'
  },
  { 
    id: 'boarding', 
    icon: HomeIcon, 
    label: 'Boarding', 
    description: 'Safe stay while you\'re away',
    color: 'from-indigo-50 to-blue-100/50',
    iconBg: 'bg-white',
    iconColor: 'text-indigo-600',
    screen: 'boarding'
  },
  { 
    id: 'adoption', 
    icon: Heart, 
    label: 'Adoption', 
    description: 'Find your new best friend',
    color: 'from-red-50 to-rose-100/50',
    iconBg: 'bg-white',
    iconColor: 'text-red-500',
    screen: 'adoption'
  },
  { 
    id: 'mating', 
    icon: Heart, 
    label: 'Peer to Peer', 
    description: 'Find the perfect match',
    color: 'from-pink-50 to-fuchsia-100/50',
    iconBg: 'bg-white',
    iconColor: 'text-pink-500',
    screen: 'mating-dating-hub',
    comingSoon: true,
  },
  { 
    id: 'cafes', 
    icon: Coffee, 
    label: 'Pet Cafes', 
    description: 'Pet-friendly dining spots',
    color: 'from-amber-50 to-yellow-100/50',
    iconBg: 'bg-white',
    iconColor: 'text-amber-600',
    screen: 'cafes',
    comingSoon: true,
  },
  
  // SPECIALIZED SERVICES
  { 
    id: 'photography', 
    icon: Camera, 
    label: 'Photography', 
    description: 'Professional pet photography',
    color: 'from-violet-50 to-purple-100/50',
    iconBg: 'bg-white',
    iconColor: 'text-violet-600',
    screen: 'photography'
  },
  { 
    id: 'insurance', 
    icon: Shield, 
    label: 'Insurance', 
    description: 'Health & accident coverage',
    color: 'from-cyan-50 to-sky-100/50',
    iconBg: 'bg-white',
    iconColor: 'text-cyan-600',
    screen: 'insurance',
    comingSoon: true,
  },
  { 
    id: 'breeder', 
    icon: PawPrint, 
    label: 'Breeder', 
    description: 'Certified breeders & puppies',
    color: 'from-amber-50 to-orange-100/50',
    iconBg: 'bg-white',
    iconColor: 'text-amber-600',
    screen: 'breeder'
  },
  { 
    id: 'ambulance', 
    icon: Phone, 
    label: 'Ambulance', 
    description: 'Emergency pet transport',
    color: 'from-red-50 to-red-100/50',
    iconBg: 'bg-white',
    iconColor: 'text-red-600',
    screen: 'ambulance'
  },
  
  // WELLNESS SERVICES
  { 
    id: 'nutritionist', 
    icon: Wheat, 
    label: 'Nutritionist', 
    description: 'Diet plans & nutrition advice',
    color: 'from-lime-50 to-green-100/50',
    iconBg: 'bg-white',
    iconColor: 'text-lime-600',
    screen: 'nutritionist'
  },
  { 
    id: 'relocation', 
    icon: Truck, 
    label: 'Relocation', 
    description: 'Pet transport & moving services',
    color: 'from-sky-50 to-blue-100/50',
    iconBg: 'bg-white',
    iconColor: 'text-sky-600',
    screen: 'relocation'
  },
  { 
    id: 'resort', 
    icon: Sparkles, 
    label: 'Pet Resort', 
    description: 'Luxury boarding & spa',
    color: 'from-teal-50 to-emerald-100/50',
    iconBg: 'bg-white',
    iconColor: 'text-teal-600',
    screen: 'resort'
  },
  { 
    id: 'holiday', 
    icon: Palmtree, 
    label: 'Pet Holiday', 
    description: 'Travel packages with your pet',
    color: 'from-cyan-50 to-teal-100/50',
    iconBg: 'bg-white',
    iconColor: 'text-cyan-600',
    screen: 'holiday'
  },
  { 
    id: 'sunset', 
    icon: Sun, 
    label: 'Sunset Care', 
    description: 'End-of-life support & memorial',
    color: 'from-purple-50 to-indigo-100/50',
    iconBg: 'bg-white',
    iconColor: 'text-purple-600',
    screen: 'sunset'
  },
];

export function AllServicesPage({ onBack, onServiceSelect }: AllServicesPageProps) {
  const [searchQuery, setSearchQuery] = useState('');

  // Smart search with symptom matching
  const filteredServices = useMemo(() => {
    if (!searchQuery) return SERVICE_CATEGORIES;
    
    const query = searchQuery.toLowerCase().trim();
    
    // Direct match on service name/description
    const directMatches = SERVICE_CATEGORIES.filter(service => 
      service.label.toLowerCase().includes(query) ||
      service.description.toLowerCase().includes(query)
    );
    
    // Symptom-based matches
    const symptomMatches: typeof SERVICE_CATEGORIES = [];
    for (const [serviceId, keywords] of Object.entries(SYMPTOM_KEYWORDS)) {
      const matchesKeyword = keywords.some(keyword => 
        keyword.includes(query) || query.includes(keyword)
      );
      
      if (matchesKeyword) {
        const service = SERVICE_CATEGORIES.find(s => s.id === serviceId);
        if (service && !directMatches.includes(service) && !symptomMatches.includes(service)) {
          symptomMatches.push(service);
        }
      }
    }
    
    // Combine and deduplicate
    const allMatches = [...directMatches, ...symptomMatches];
    return allMatches.length > 0 ? allMatches : [];
  }, [searchQuery]);

  return (
    <div className="h-screen flex flex-col bg-[#FF8C42] max-w-md mx-auto overflow-hidden">
      {/* Header - Orange Background (Fixed) */}
      <div className="flex-shrink-0 px-6 pt-12 pb-6">
        <div className="flex items-center gap-4">
          <button 
            onClick={onBack}
            className="w-11 h-11 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center hover:bg-white/30 transition-all active:scale-95"
          >
            <ArrowLeft className="w-5 h-5 text-white" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-white">All Services</h1>
            <p className="text-white/80 text-sm">Choose a service for your pet</p>
          </div>
        </div>
      </div>

      {/* Main Content - White Card with Scroll */}
      <div className="flex-1 bg-white rounded-t-[32px] flex flex-col overflow-hidden">
        {/* Search Bar (Fixed in white area) */}
        <div className="flex-shrink-0 px-5 pt-5 pb-3">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              placeholder="Search services or symptoms..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-10 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#FF8C42] focus:border-transparent text-slate-900 placeholder:text-slate-400 text-sm"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 w-6 h-6 bg-slate-200 rounded-full flex items-center justify-center hover:bg-slate-300 transition-colors"
              >
                <X className="w-3.5 h-3.5 text-slate-500" />
              </button>
            )}
          </div>
          
          {/* Search hint */}
          {searchQuery && (
            <p className="text-xs text-slate-400 mt-2 px-1">
              💡 Try: vomiting, heart, fever, grooming, training...
            </p>
          )}
        </div>

        {/* Scrollable Services Grid */}
        <div className="flex-1 overflow-y-auto px-5 pb-8 scrollbar-hide">
          {filteredServices.length === 0 ? (
            <div className="text-center py-16">
              <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Search className="w-8 h-8 text-slate-300" />
              </div>
              <p className="font-medium text-slate-600">No services found</p>
              <p className="text-sm text-slate-400 mt-1">Try different keywords like "vet" or "grooming"</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {filteredServices.map((service, index) => {
                const IconComponent = service.icon;
                const isComingSoon = Boolean((service as { comingSoon?: boolean }).comingSoon);

                const tileInner = (
                  <div className={`
                      relative overflow-hidden rounded-2xl p-4 h-full min-h-[130px]
                      bg-gradient-to-br ${service.color}
                      border border-white/50 shadow-sm
                      transition-all duration-300 ease-out
                      ${isComingSoon ? 'opacity-80 cursor-not-allowed' : 'group-hover:shadow-md group-hover:-translate-y-0.5 group-hover:scale-[1.01] active:scale-[0.98]'}
                    `}>
                      <div className="absolute -right-3 -bottom-3 w-16 h-16 rounded-full bg-white/20 blur-lg" />

                      <div className="relative z-10 flex flex-col h-full">
                        {isComingSoon && (
                          <span className="absolute top-2 right-2 text-[9px] font-bold uppercase tracking-wide bg-amber-500 text-white px-2 py-0.5 rounded-full z-20">
                            Soon
                          </span>
                        )}
                        <div className={`
                          w-11 h-11 rounded-xl flex items-center justify-center mb-3
                          ${service.iconBg} shadow-sm
                          ${isComingSoon ? '' : 'transition-transform duration-300 group-hover:scale-105'}
                        `}>
                          <IconComponent className={`w-5 h-5 ${service.iconColor}`} />
                        </div>

                        <div className="flex-1">
                          <h3 className="font-semibold text-[13px] mb-1 text-slate-800 leading-tight">
                            {service.label}
                          </h3>
                          {isComingSoon ? (
                            <p className="text-[11px] leading-snug text-slate-500 m-0">Coming soon</p>
                          ) : (
                            <div onClick={(e) => e.stopPropagation()} className="text-[11px] leading-snug">
                              <ServiceDescriptionInline
                                description={service.description}
                                title={service.label}
                                className="m-0 text-[11px] leading-snug text-slate-500"
                                linkClassName="inline cursor-pointer align-baseline text-[10px] font-semibold text-orange-600 hover:underline"
                              />
                            </div>
                          )}
                        </div>

                        {!isComingSoon && (
                          <div className="absolute bottom-3 right-3 opacity-0 translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-200">
                            <ChevronRight className="w-4 h-4 text-slate-400" />
                          </div>
                        )}
                      </div>
                    </div>
                );

                if (isComingSoon) {
                  return (
                    <div
                      key={service.id}
                      className="text-left animate-in fade-in slide-in-from-bottom-2 pointer-events-none select-none"
                      style={{ animationDelay: `${index * 25}ms`, animationFillMode: 'both' }}
                      aria-label={`${service.label} — coming soon`}
                    >
                      {tileInner}
                    </div>
                  );
                }

                return (
                  <button
                    key={service.id}
                    type="button"
                    onClick={() => {
                      if (navigator.vibrate) navigator.vibrate(10);
                      onServiceSelect(service.screen);
                    }}
                    className="group text-left animate-in fade-in slide-in-from-bottom-2"
                    style={{ animationDelay: `${index * 25}ms`, animationFillMode: 'both' }}
                  >
                    {tileInner}
                  </button>
                );
              })}
            </div>
          )}

          {/* Quick Tip - Only show when not searching */}
          {!searchQuery && (
            <div className="mt-6 p-4 bg-gradient-to-r from-orange-50 to-amber-50 rounded-2xl border border-orange-100/50 flex gap-3">
              <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm">
                <PawPrint className="w-5 h-5 text-orange-500" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-orange-900 mb-1">
                  Search by symptoms
                </h3>
                <p className="text-xs text-orange-700/80 leading-relaxed">
                  Try "vomiting", "heart problem", or "itching" to find the right specialist.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
