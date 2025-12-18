import { useState } from 'react';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { Input } from '../ui/input';
import { ArrowLeft, FlaskConical, Check, MapPin, User, Phone, FileText } from 'lucide-react';
import { projectId, publicAnonKey } from '../../utils/supabase/info';
import { toast } from 'sonner@2.0.3';

interface LabCollectionProps {
  onBack: () => void;
  customerId: string;
  petProfiles: any[];
}

export function LabCollection({ onBack, customerId, petProfiles }: LabCollectionProps) {
  const [step, setStep] = useState<'pets' | 'tests' | 'schedule' | 'confirm' | 'tracking' | 'report'>('pets');
  const [selectedPet, setSelectedPet] = useState<any>(null);
  const [testType, setTestType] = useState<'blood' | 'stool' | 'urine'>('blood');
  const [selectedTests, setSelectedTests] = useState<string[]>([]);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedTime, setSelectedTime] = useState('10:00 AM');
  const [address, setAddress] = useState('123 Pet Street, Koramangala, Bangalore');
  const [loading, setLoading] = useState(false);

  const testOptions = {
    blood: ['Complete Blood Count', 'Blood Glucose', 'Liver Function', 'Kidney Function'],
    stool: ['Parasite Test', 'Bacterial Culture', 'Digestive Enzymes'],
    urine: ['Urinalysis', 'Protein Test', 'Infection Screening']
  };

  const createLabTest = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/vet/lab-test`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${publicAnonKey}` },
          body: JSON.stringify({
            customerId,
            petId: selectedPet.id,
            vendorId: 'vendor1',
            testType,
            tests: selectedTests,
            collectionDate: selectedDate,
            collectionTime: selectedTime,
            address
          })
        }
      );
      if (response.ok) {
        toast.success('Lab test scheduled!');
        setStep('tracking');
      }
    } catch (error) {
      console.error('Error creating lab test:', error);
      toast.error('Failed to schedule lab test');
    } finally {
      setLoading(false);
    }
  };

  if (step === 'pets') {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col max-w-md mx-auto">
        <div className="px-6 pt-3 pb-2 flex justify-between items-center text-black bg-white">
          <span>09:41</span>
          <div className="flex gap-1 items-center">
            <div className="w-4 h-3 bg-black/30"></div>
            <div className="w-4 h-3 bg-black/30"></div>
            <div className="w-6 h-3 bg-black/30"></div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-purple-500 to-purple-600 px-6 pt-4 pb-8">
          <div className="flex items-center mb-6">
            <button onClick={onBack} className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
              <ArrowLeft className="w-5 h-5 text-white" />
            </button>
            <h1 className="text-white flex-1 ml-4">Lab Sample Collection</h1>
          </div>
        </div>

        <div className="flex-1 -mt-4 bg-white rounded-t-[32px] px-6 pt-6 pb-24">
          <h2 className="mb-4">Select Pet Profile</h2>
          <div className="space-y-3">
            {petProfiles.map((pet: any) => (
              <button key={pet.id} onClick={() => { setSelectedPet(pet); setStep('tests'); }} className="w-full">
                <Card className="p-4 border-gray-200 shadow-sm hover:shadow-md transition-all">
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 bg-purple-100 rounded-2xl flex items-center justify-center text-2xl">
                      {pet.icon}
                    </div>
                    <div className="flex-1 text-left">
                      <h3 className="mb-1">{pet.name}</h3>
                      <p className="text-sm text-gray-500">{pet.breed} • {pet.age}</p>
                    </div>
                  </div>
                </Card>
              </button>
            ))}
          </div>
        </div>

        <div className="fixed bottom-0 left-0 right-0 bg-white flex justify-center pb-2 max-w-md mx-auto">
          <div className="w-32 h-1 bg-black rounded-full"></div>
        </div>
      </div>
    );
  }

  if (step === 'tests') {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col max-w-md mx-auto">
        <div className="px-6 pt-3 pb-2 flex justify-between items-center text-black bg-white">
          <span>09:41</span>
          <div className="flex gap-1 items-center">
            <div className="w-4 h-3 bg-black/30"></div>
            <div className="w-4 h-3 bg-black/30"></div>
            <div className="w-6 h-3 bg-black/30"></div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-purple-500 to-purple-600 px-6 pt-4 pb-8">
          <div className="flex items-center mb-6">
            <button onClick={() => setStep('pets')} className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
              <ArrowLeft className="w-5 h-5 text-white" />
            </button>
            <h1 className="text-white flex-1 ml-4">Select Tests</h1>
          </div>
        </div>

        <div className="flex-1 -mt-4 bg-white rounded-t-[32px] px-6 pt-6 pb-24 overflow-y-auto">
          <div className="mb-6">
            <h3 className="mb-3">Test Type</h3>
            <div className="flex gap-3">
              {(['blood', 'stool', 'urine'] as const).map((type) => (
                <button
                  key={type}
                  onClick={() => { setTestType(type); setSelectedTests([]); }}
                  className={`flex-1 p-3 rounded-xl border-2 capitalize ${
                    testType === type ? 'border-purple-500 bg-purple-50 text-purple-600' : 'border-gray-200'
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>

          <div>
            <h3 className="mb-3">Select Tests</h3>
            <div className="space-y-2">
              {testOptions[testType].map((test) => (
                <button
                  key={test}
                  onClick={() => {
                    setSelectedTests(prev =>
                      prev.includes(test) ? prev.filter(t => t !== test) : [...prev, test]
                    );
                  }}
                  className={`w-full p-4 rounded-xl border-2 text-left transition-all ${
                    selectedTests.includes(test)
                      ? 'border-purple-500 bg-purple-50'
                      : 'border-gray-200 hover:border-purple-200'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span>{test}</span>
                    {selectedTests.includes(test) && <Check className="w-5 h-5 text-purple-600" />}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {selectedTests.length > 0 && (
          <div className="fixed bottom-0 left-0 right-0 bg-white border-t p-4 max-w-md mx-auto">
            <Button onClick={() => setStep('schedule')} className="w-full bg-purple-600 hover:bg-purple-700">
              Continue ({selectedTests.length} tests selected)
            </Button>
            <div className="flex justify-center mt-3">
              <div className="w-32 h-1 bg-black rounded-full"></div>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (step === 'schedule') {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col max-w-md mx-auto">
        <div className="px-6 pt-3 pb-2 flex justify-between items-center text-black bg-white">
          <span>09:41</span>
          <div className="flex gap-1 items-center">
            <div className="w-4 h-3 bg-black/30"></div>
            <div className="w-4 h-3 bg-black/30"></div>
            <div className="w-6 h-3 bg-black/30"></div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-purple-500 to-purple-600 px-6 pt-4 pb-8">
          <div className="flex items-center mb-6">
            <button onClick={() => setStep('tests')} className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
              <ArrowLeft className="w-5 h-5 text-white" />
            </button>
            <h1 className="text-white flex-1 ml-4">Schedule Collection</h1>
          </div>
        </div>

        <div className="flex-1 -mt-4 bg-white rounded-t-[32px] px-6 pt-6 pb-24 overflow-y-auto">
          <div className="space-y-6">
            <div>
              <label className="block mb-2">Collection Address</label>
              <Input value={address} onChange={(e) => setAddress(e.target.value)} />
            </div>

            <div>
              <label className="block mb-2">Preferred Date</label>
              <Input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} />
            </div>

            <div>
              <label className="block mb-2">Preferred Time</label>
              <div className="grid grid-cols-3 gap-2">
                {['9:00 AM', '10:00 AM', '11:00 AM', '2:00 PM', '3:00 PM', '4:00 PM'].map((time) => (
                  <button
                    key={time}
                    onClick={() => setSelectedTime(time)}
                    className={`p-3 rounded-xl border-2 ${
                      selectedTime === time ? 'border-purple-500 bg-purple-50' : 'border-gray-200'
                    }`}
                  >
                    {time}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <Button onClick={() => setStep('confirm')} className="w-full bg-purple-600 hover:bg-purple-700 mt-6">
            Continue to Payment
          </Button>
        </div>

        <div className="fixed bottom-0 left-0 right-0 bg-white flex justify-center pb-2 max-w-md mx-auto">
          <div className="w-32 h-1 bg-black rounded-full"></div>
        </div>
      </div>
    );
  }

  if (step === 'confirm') {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col max-w-md mx-auto">
        <div className="px-6 pt-3 pb-2 flex justify-between items-center text-black bg-white">
          <span>09:41</span>
          <div className="flex gap-1 items-center">
            <div className="w-4 h-3 bg-black/30"></div>
            <div className="w-4 h-3 bg-black/30"></div>
            <div className="w-6 h-3 bg-black/30"></div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-purple-500 to-purple-600 px-6 pt-4 pb-8">
          <div className="flex items-center mb-6">
            <button onClick={() => setStep('schedule')} className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
              <ArrowLeft className="w-5 h-5 text-white" />
            </button>
            <h1 className="text-white flex-1 ml-4">Confirm Booking</h1>
          </div>
        </div>

        <div className="flex-1 -mt-4 bg-white rounded-t-[32px] px-6 pt-6 pb-24 overflow-y-auto">
          <Card className="p-4 border-gray-200 mb-6">
            <h3 className="mb-3">Booking Summary</h3>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Pet</span>
                <span>{selectedPet.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Test Type</span>
                <span className="capitalize">{testType}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Tests</span>
                <span>{selectedTests.length} selected</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Collection Date</span>
                <span>{new Date(selectedDate).toLocaleDateString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Time</span>
                <span>{selectedTime}</span>
              </div>
              <div className="flex justify-between pt-3 border-t">
                <span className="text-gray-500">Total</span>
                <span className="text-2xl text-purple-600">₹{selectedTests.length * 300}</span>
              </div>
            </div>
          </Card>

          <Button onClick={createLabTest} disabled={loading} className="w-full bg-purple-600 hover:bg-purple-700">
            {loading ? 'Booking...' : 'Confirm & Pay'}
          </Button>
        </div>

        <div className="fixed bottom-0 left-0 right-0 bg-white flex justify-center pb-2 max-w-md mx-auto">
          <div className="w-32 h-1 bg-black rounded-full"></div>
        </div>
      </div>
    );
  }

  if (step === 'tracking') {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col max-w-md mx-auto">
        <div className="px-6 pt-3 pb-2 flex justify-between items-center text-black bg-white">
          <span>09:41</span>
          <div className="flex gap-1 items-center">
            <div className="w-4 h-3 bg-black/30"></div>
            <div className="w-4 h-3 bg-black/30"></div>
            <div className="w-6 h-3 bg-black/30"></div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-purple-500 to-purple-600 px-6 pt-4 pb-8">
          <div className="flex items-center mb-6">
            <button onClick={onBack} className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
              <ArrowLeft className="w-5 h-5 text-white" />
            </button>
            <h1 className="text-white flex-1 ml-4">Track Collection</h1>
          </div>
        </div>

        <div className="flex-1 -mt-4 bg-white rounded-t-[32px] px-6 pt-6 pb-24 overflow-y-auto">
          <div className="text-center mb-6">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Check className="w-10 h-10 text-green-600" />
            </div>
            <h2 className="mb-2">Collection Scheduled!</h2>
            <p className="text-gray-500">Technician will arrive at your location</p>
          </div>

          <Card className="p-4 border-gray-200 mb-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
                <User className="w-6 h-6 text-purple-600" />
              </div>
              <div className="flex-1">
                <h3 className="mb-1">Rajesh Kumar</h3>
                <p className="text-sm text-gray-500">Lab Technician</p>
              </div>
              <Button size="sm" className="bg-purple-600 hover:bg-purple-700">
                <Phone className="w-4 h-4" />
              </Button>
            </div>

            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Status</span>
                <span className="text-purple-600">On the way</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">ETA</span>
                <span>25 minutes</span>
              </div>
            </div>
          </Card>

          <Button onClick={() => setStep('report')} className="w-full bg-purple-600 hover:bg-purple-700">
            View Report (Demo)
          </Button>
        </div>

        <div className="fixed bottom-0 left-0 right-0 bg-white flex justify-center pb-2 max-w-md mx-auto">
          <div className="w-32 h-1 bg-black rounded-full"></div>
        </div>
      </div>
    );
  }

  if (step === 'report') {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col max-w-md mx-auto">
        <div className="px-6 pt-3 pb-2 flex justify-between items-center text-black bg-white">
          <span>09:41</span>
          <div className="flex gap-1 items-center">
            <div className="w-4 h-3 bg-black/30"></div>
            <div className="w-4 h-3 bg-black/30"></div>
            <div className="w-6 h-3 bg-black/30"></div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-purple-500 to-purple-600 px-6 pt-4 pb-8">
          <div className="flex items-center mb-6">
            <button onClick={() => setStep('tracking')} className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
              <ArrowLeft className="w-5 h-5 text-white" />
            </button>
            <h1 className="text-white flex-1 ml-4">Lab Report</h1>
          </div>
        </div>

        <div className="flex-1 -mt-4 bg-white rounded-t-[32px] px-6 pt-6 pb-24 overflow-y-auto">
          <Card className="p-4 border-gray-200 mb-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
                <FileText className="w-6 h-6 text-purple-600" />
              </div>
              <div>
                <h3 className="mb-1">Lab Report Ready</h3>
                <p className="text-sm text-gray-500">All tests completed</p>
              </div>
            </div>

            <div className="space-y-3">
              {selectedTests.map((test, index) => (
                <div key={index} className="p-3 bg-purple-50 rounded-xl">
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="text-sm mb-1">{test}</h4>
                      <p className="text-xs text-gray-500">Normal Range</p>
                    </div>
                    <span className="px-2 py-1 bg-green-100 text-green-600 rounded-lg text-xs">Normal</span>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <div className="space-y-3">
            <Button className="w-full bg-purple-600 hover:bg-purple-700">
              Download Report (PDF)
            </Button>
            <Button variant="outline" className="w-full">
              Share with Vet
            </Button>
          </div>
        </div>

        <div className="fixed bottom-0 left-0 right-0 bg-white flex justify-center pb-2 max-w-md mx-auto">
          <div className="w-32 h-1 bg-black rounded-full"></div>
        </div>
      </div>
    );
  }

  return null;
}
