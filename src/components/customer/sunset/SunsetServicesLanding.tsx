import { ArrowLeft, Heart, Home, Building2, Moon, Sun as Sunrise } from 'lucide-react';
// Brand color: #FF8C42

interface SunsetServicesLandingProps {
  onBack: () => void;
  onNavigate: (screen: string, data?: any) => void;
  phone: string;
}

export function SunsetServicesLanding({ onBack, onNavigate, phone }: SunsetServicesLandingProps) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-50 to-white max-w-md mx-auto">
      <div className="bg-gradient-to-br from-purple-600 via-purple-700 to-indigo-800 text-white px-6 pt-8 pb-16 relative">
        <button onClick={onBack} className="mb-4 flex items-center gap-2 text-white/90 hover:text-white">
          <ArrowLeft className="w-5 h-5" />
          <span>Back</span>
        </button>
        
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center">
            <Moon className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Sunset Services</h1>
            <p className="text-white/80 text-sm">Compassionate end-of-life care</p>
          </div>
        </div>

        <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/20">
          <p className="text-sm text-white/90 leading-relaxed">
            We understand this is a difficult time. Our compassionate team provides dignified,
            peaceful end-of-life care for your beloved pet in the comfort of your home or at our peaceful facility.
          </p>
        </div>
        
        <div className="absolute bottom-0 left-0 right-0 h-8 bg-white" 
             style={{
               borderTopLeftRadius: '50% 100%',
               borderTopRightRadius: '50% 100%',
             }}
        />
      </div>

      <div className="px-6 py-6 space-y-4">
        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
          <h3 className="font-semibold mb-3">Our Services Include:</h3>
          <ul className="space-y-2 text-sm text-gray-600">
            <li className="flex items-start gap-2">
              <Heart className="w-4 h-4 text-purple-500 mt-0.5 flex-shrink-0" />
              <span>Gentle, painless euthanasia procedures</span>
            </li>
            <li className="flex items-start gap-2">
              <Heart className="w-4 h-4 text-purple-500 mt-0.5 flex-shrink-0" />
              <span>Grief counseling & support</span>
            </li>
            <li className="flex items-start gap-2">
              <Heart className="w-4 h-4 text-purple-500 mt-0.5 flex-shrink-0" />
              <span>Cremation & memorial services</span>
            </li>
            <li className="flex items-start gap-2">
              <Heart className="w-4 h-4 text-purple-500 mt-0.5 flex-shrink-0" />
              <span>Paw print keepsakes</span>
            </li>
            <li className="flex items-start gap-2">
              <Heart className="w-4 h-4 text-purple-500 mt-0.5 flex-shrink-0" />
              <span>24/7 emergency support</span>
            </li>
          </ul>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => onNavigate('at_home')}
            className="bg-white rounded-xl border-2 border-purple-200 p-4 hover:border-purple-500 hover:shadow-md transition-all text-left"
          >
            <div className="flex flex-col h-full">
              <div className="w-12 h-12 bg-purple-50 rounded-xl flex items-center justify-center mb-3">
                <Home className="w-6 h-6 text-purple-600" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold mb-1">At Home</h3>
                <p className="text-xs text-gray-500">In familiar surroundings</p>
              </div>
              <div className="mt-3 text-xs text-purple-600 font-medium">
                Most peaceful →
              </div>
            </div>
          </button>

          <button
            onClick={() => onNavigate('at_center')}
            className="bg-white rounded-xl border-2 border-purple-200 p-4 hover:border-purple-500 hover:shadow-md transition-all text-left"
          >
            <div className="flex flex-col h-full">
              <div className="w-12 h-12 bg-purple-50 rounded-xl flex items-center justify-center mb-3">
                <Building2 className="w-6 h-6 text-purple-600" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold mb-1">At Facility</h3>
                <p className="text-xs text-gray-500">Peaceful environment</p>
              </div>
              <div className="mt-3 text-xs text-purple-600 font-medium">
                Visit us →
              </div>
            </div>
          </button>
        </div>

        <div className="bg-purple-50 border border-purple-200 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center flex-shrink-0">
              <Heart className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <h4 className="font-semibold mb-1 text-purple-900">We're Here For You</h4>
              <p className="text-sm text-purple-800">
                Available 24/7 for emergencies. Our compassionate team will guide you through
                every step with dignity and respect.
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
          <h4 className="font-semibold mb-2">Memorial Options</h4>
          <div className="space-y-2 text-sm text-gray-600">
            <div className="flex justify-between">
              <span>Private Cremation</span>
              <span className="font-medium">Available</span>
            </div>
            <div className="flex justify-between">
              <span>Communal Cremation</span>
              <span className="font-medium">Available</span>
            </div>
            <div className="flex justify-between">
              <span>Burial Services</span>
              <span className="font-medium">Available</span>
            </div>
            <div className="flex justify-between">
              <span>Memorial Keepsakes</span>
              <span className="font-medium">Included</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
