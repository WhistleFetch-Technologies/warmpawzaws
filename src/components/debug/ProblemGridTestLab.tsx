import { useState, useEffect } from 'react';
import { Button } from '../ui/button';
import { CheckCircle, AlertCircle, RotateCcw, Play } from 'lucide-react';
import { ProblemGridSelector } from '../customer/ProblemGridSelector';
import { VendorDiscoveryByProblem } from '../customer/VendorDiscoveryByProblem';

// ------------------------------------------------------------------
// MOCK DATA & TYPES
// ------------------------------------------------------------------

const MOCK_PROBLEMS = [
  {
    id: 'problem-skin',
    name: 'Skin & Coat Issues',
    displayName: 'Skin & Coat',
    description: 'Itching, hair loss, rashes, or lumps.',
    icon: '🦠',
    keywords: ['itch', 'rash', 'allergy']
  },
  {
    id: 'problem-dental',
    name: 'Dental Care',
    displayName: 'Dental',
    description: 'Bad breath, tartar, or bleeding gums.',
    icon: '🦷',
    keywords: ['teeth', 'breath', 'gum']
  },
  {
    id: 'problem-urgent',
    name: 'Urgent Care',
    displayName: 'Emergency',
    description: 'Trauma, poisoning, or severe pain.',
    icon: '🚑',
    keywords: ['emergency', 'accident', 'poison']
  }
];

const MOCK_VENDORS = [
  {
    vendorId: 'clinic-1',
    businessName: 'City Vet Clinic',
    vendorType: 'center',
    rating: 4.8,
    distance: 2.5,
    location: { address: '123 Main St' },
    availableServiceStyles: ['at_center', 'tele'],
    vendorServices: [
      { name: 'Consultation', price: 500 },
      { name: 'Dermatology Check', price: 800 }
    ],
    specialistCount: 2,
    specialists: [
      {
        id: 'staff-1',
        fullName: 'Dr. Alice Smith',
        specializationDetails: [{ displayName: 'Dermatologist', icon: '🦠' }],
        services: [{ name: 'Skin Check', price: 800 }]
      },
      {
        id: 'staff-2',
        fullName: 'Dr. Bob Jones',
        specializationDetails: [{ displayName: 'General Vet', icon: '⚕️' }]
      }
    ]
  }
];

// ------------------------------------------------------------------
// TEST LAB COMPONENT
// ------------------------------------------------------------------

export function ProblemGridTestLab() {
  const [currentStep, setCurrentStep] = useState<'intro' | 'grid' | 'discovery' | 'complete'>('intro');
  const [selectedProblem, setSelectedProblem] = useState<any>(null);
  const [selectedVendor, setSelectedVendor] = useState<any>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [mockEnabled, setMockEnabled] = useState(false);

  // Original fetch backup
  const originalFetch = window.fetch;

  const log = (msg: string) => setLogs(prev => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev]);

  // Setup Mocks
  const enableMocks = () => {
    setMockEnabled(true);
    window.fetch = async (url: RequestInfo | URL, options?: RequestInit) => {
      const urlString = url.toString();
      log(`Intercepted: ${urlString}`);

      // 1. Mock Problem Grid Fetch
      if (urlString.includes('/customer/problem-grid/')) {
        log('Returning MOCK problem grid');
        return {
          ok: true,
          json: async () => ({ problems: MOCK_PROBLEMS })
        } as Response;
      }

      // 2. Mock Universal Discovery Fetch
      if (urlString.includes('/customer/universal-problem-discovery')) {
        log('Returning MOCK vendor discovery results');
        // Simulate slight delay
        await new Promise(r => setTimeout(r, 800));
        return {
          ok: true,
          json: async () => ({ 
            vendors: MOCK_VENDORS,
            specialists: MOCK_VENDORS[0].specialists.map(s => ({
              ...s,
              clinicId: 'clinic-1',
              clinicName: 'City Vet Clinic',
              clinicAddress: '123 Main St'
            }))
          })
        } as Response;
      }

      return originalFetch(url, options);
    };
  };

  const disableMocks = () => {
    setMockEnabled(false);
    window.fetch = originalFetch;
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      window.fetch = originalFetch;
    };
  }, []);

  const startTest = () => {
    enableMocks();
    setLogs([]);
    setSelectedProblem(null);
    setSelectedVendor(null);
    setCurrentStep('grid');
    log('Starting Problem Grid Functional Test');
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8 font-mono">
      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Control Panel */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-gray-800 p-6 rounded-xl border border-gray-700">
            <h1 className="text-2xl font-bold text-[#FF8C42] mb-2">Problem Grid Lab</h1>
            <p className="text-gray-400 text-sm mb-4">Functional verification of the Universal Problem Discovery flow.</p>
            
            <div className="space-y-3">
              <div className="flex items-center justify-between bg-gray-900 p-3 rounded-lg">
                <span className="text-sm">Status</span>
                <span className={`text-xs font-bold px-2 py-1 rounded ${mockEnabled ? 'bg-green-900 text-green-400' : 'bg-gray-700'}`}>
                  {mockEnabled ? 'MOCK ACTIVE' : 'IDLE'}
                </span>
              </div>

              <Button 
                onClick={startTest} 
                className="w-full bg-green-600 hover:bg-green-700 text-white"
                disabled={mockEnabled && currentStep !== 'complete'}
              >
                <Play className="w-4 h-4 mr-2" />
                Run Test Scenario
              </Button>

              <Button 
                onClick={() => {
                  disableMocks();
                  setCurrentStep('intro');
                }} 
                variant="outline" 
                className="w-full border-gray-600 text-gray-400 hover:text-white"
              >
                <RotateCcw className="w-4 h-4 mr-2" />
                Reset
              </Button>
            </div>
          </div>

          {/* Logs */}
          <div className="bg-gray-800 p-4 rounded-xl border border-gray-700 h-[400px] overflow-y-auto">
            <h3 className="text-xs font-bold text-gray-500 uppercase mb-3">System Logs</h3>
            <div className="space-y-2">
              {logs.map((l, i) => (
                <div key={i} className="text-xs text-green-400 font-mono border-l-2 border-gray-700 pl-2">
                  {l}
                </div>
              ))}
              {logs.length === 0 && <span className="text-gray-600 text-xs italic">Waiting for execution...</span>}
            </div>
          </div>
        </div>

        {/* Viewport */}
        <div className="lg:col-span-2 bg-white rounded-[32px] overflow-hidden shadow-2xl border-4 border-gray-800 relative h-[800px]">
          
          {currentStep === 'intro' && (
            <div className="h-full flex flex-col items-center justify-center text-gray-800 p-8 text-center">
              <AlertCircle className="w-16 h-16 text-gray-300 mb-4" />
              <h2 className="text-xl font-bold mb-2">Ready to Test</h2>
              <p className="text-gray-500 max-w-md">
                Click "Run Test Scenario" to simulate a customer searching for a vet via the Problem Grid.
              </p>
            </div>
          )}

          {currentStep === 'grid' && (
            <ProblemGridSelector
              roleId="veterinarian"
              roleName="Veterinarian"
              customerId="test-user"
              phone="9999999999"
              onBack={() => {
                log('User clicked Back');
                setCurrentStep('intro');
                disableMocks();
              }}
              onProblemSelect={(problem) => {
                log(`User selected problem: ${problem.name}`);
                setSelectedProblem(problem);
                setCurrentStep('discovery');
              }}
            />
          )}

          {currentStep === 'discovery' && selectedProblem && (
            <VendorDiscoveryByProblem
              roleId="veterinarian"
              roleName="Veterinarian"
              customerId="test-user"
              phone="9999999999"
              problem={selectedProblem}
              onBack={() => {
                log('User clicked Back from Discovery');
                setCurrentStep('grid');
              }}
              onVendorSelect={(vendor) => {
                log(`User selected vendor: ${vendor.businessName || vendor.fullName}`);
                setSelectedVendor(vendor);
                setCurrentStep('complete');
              }}
            />
          )}

          {currentStep === 'complete' && (
            <div className="h-full flex flex-col items-center justify-center bg-green-50 text-green-900 p-8 text-center">
              <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mb-6 animate-bounce">
                <CheckCircle className="w-10 h-10 text-green-600" />
              </div>
              <h2 className="text-2xl font-bold mb-2">Test Passed!</h2>
              <p className="text-green-700 mb-6">
                Full flow verified successfully.<br/>
                Grid -> Selection -> Discovery -> Vendor Booking
              </p>
              
              <div className="bg-white p-6 rounded-xl shadow-sm text-left w-full max-w-md space-y-3">
                <div>
                  <span className="text-xs text-gray-500 uppercase">Selected Problem</span>
                  <p className="font-semibold">{selectedProblem?.name}</p>
                </div>
                <div>
                  <span className="text-xs text-gray-500 uppercase">Selected Vendor</span>
                  <p className="font-semibold">{selectedVendor?.businessName || selectedVendor?.fullName}</p>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}