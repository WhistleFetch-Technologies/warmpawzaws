import React, { useState } from 'react';
import { Button } from '../ui/button';
import { Video, Home, CheckCircle, Info, ArrowRight } from 'lucide-react';
import { projectId, publicAnonKey } from '../../utils/supabase/info';
import { toast } from 'sonner';

interface CombinedPackage {
  packageId: string;
  name: string;
  description: string;
  teleSessions: number;
  homeSessions: number;
  totalSessions: number;
  duration: string;
  price: number;
  discountPrice?: number;
  features: string[];
}

interface CombinedTrainingPackageProps {
  trainerId: string;
  trainerName: string;
  customerId: string;
  petId: string;
  petName: string;
  onBookingComplete?: (bookingId: string) => void;
}

const PACKAGES: CombinedPackage[] = [
  {
    packageId: 'PKG-COMBINED-BASIC',
    name: 'Basic Behavior Modification',
    description: 'Perfect for addressing mild to moderate behavior issues',
    teleSessions: 3,
    homeSessions: 3,
    totalSessions: 6,
    duration: '6 weeks',
    price: 12000,
    discountPrice: 10200,
    features: ['Initial tele evaluation', 'Customized behavior plan', '3 in-home training sessions', '2 follow-up tele sessions', 'Weekly progress reports', 'Email support']
  },
  {
    packageId: 'PKG-COMBINED-ADVANCED',
    name: 'Advanced Behavior Transformation',
    description: 'Comprehensive treatment for complex behavior issues',
    teleSessions: 4,
    homeSessions: 6,
    totalSessions: 10,
    duration: '10 weeks',
    price: 20000,
    discountPrice: 17000,
    features: ['In-depth behavioral assessment', 'Comprehensive treatment plan', '6 intensive in-home sessions', '4 tele consultation sessions', 'Progress video analysis', 'Bi-weekly progress reports', 'Priority support']
  },
  {
    packageId: 'PKG-COMBINED-PREMIUM',
    name: 'Premium Complete Care',
    description: 'The ultimate behavior and training package',
    teleSessions: 6,
    homeSessions: 10,
    totalSessions: 16,
    duration: '16 weeks',
    price: 35000,
    discountPrice: 29750,
    features: ['Comprehensive behavioral evaluation', 'Personalized treatment protocol', '10 intensive in-home sessions', '6 tele consultations', 'Video library access', 'Weekly progress reports', '24/7 support', 'Post-program support', 'Certification']
  }
];

const CONCERNS = ['Separation Anxiety', 'Aggression', 'Excessive Barking', 'Destructive Behavior', 'House Training Issues', 'Leash Reactivity', 'Fear/Phobias', 'Resource Guarding'];
const GOALS = ['Reduce anxiety', 'Improve obedience', 'Stop destructive behavior', 'Better socialization', 'Calm behavior', 'Leash walking', 'Stay alone comfortably', 'Overcome fears'];

export function CombinedTrainingPackage({
  trainerId,
  trainerName,
  customerId,
  petId,
  petName,
  onBookingComplete
}: CombinedTrainingPackageProps) {
  const [selectedPackage, setSelectedPackage] = useState<CombinedPackage | null>(null);
  const [step, setStep] = useState<'selection' | 'review'>('selection');
  const [loading, setLoading] = useState(false);
  const [concerns, setConcerns] = useState<string[]>([]);
  const [goals, setGoals] = useState<string[]>([]);

  const handleBooking = async () => {
    if (!selectedPackage) return;

    setLoading(true);
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/training/combined-package/book`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            customerId,
            petId,
            trainerId,
            packageId: selectedPackage.packageId,
            behaviorConcerns: concerns,
            trainingGoals: goals,
            totalAmount: selectedPackage.discountPrice || selectedPackage.price,
            scheduledSessions: []
          })
        }
      );

      if (response.ok) {
        const data = await response.json();
        toast.success('Package booked successfully!');
        if (onBookingComplete) {
          onBookingComplete(data.data.bookingId);
        }
      } else {
        throw new Error('Failed to book package');
      }
    } catch (error) {
      console.error('Error booking package:', error);
      toast.error('Failed to book package. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white p-6">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-3xl font-bold mb-2">Combined Training Packages</h1>
          <p className="text-purple-100">Tele Consultations + In-Home Training for {petName}</p>
          <p className="text-sm text-purple-200 mt-1">with {trainerName}</p>
        </div>
      </div>

      <div className="max-w-6xl mx-auto p-6">
        {step === 'selection' && (
          <>
            <div className="bg-blue-50 rounded-xl border-2 border-blue-200 p-4 mb-6 flex items-start gap-3">
              <Info className="w-6 h-6 text-blue-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <h3 className="font-semibold text-blue-900 mb-1">Why Choose Combined Packages?</h3>
                <p className="text-sm text-blue-800">
                  Get the best of both worlds! Tele consultations allow convenient check-ins, while in-home sessions provide hands-on training.
                </p>
              </div>
            </div>

            <div className="grid md:grid-cols-3 gap-6 mb-8">
              {PACKAGES.map((pkg) => (
                <div key={pkg.packageId} className="bg-white rounded-xl shadow-lg border-2 border-gray-200 overflow-hidden hover:border-purple-500 transition-all">
                  {pkg.discountPrice && (
                    <div className="bg-gradient-to-r from-orange-500 to-pink-500 text-white px-4 py-2 text-center font-semibold text-sm">
                      Save ₹{(pkg.price - pkg.discountPrice).toLocaleString('en-IN')}!
                    </div>
                  )}
                  
                  <div className="p-6">
                    <h3 className="font-bold text-xl text-gray-900 mb-2">{pkg.name}</h3>
                    <p className="text-sm text-gray-600 mb-4">{pkg.description}</p>

                    <div className="grid grid-cols-2 gap-2 mb-4">
                      <div className="bg-blue-50 rounded-lg p-3 text-center">
                        <div className="flex items-center justify-center gap-2 mb-1">
                          <Video className="w-4 h-4 text-blue-600" />
                          <span className="text-sm text-gray-600">Tele</span>
                        </div>
                        <p className="text-xl font-bold text-blue-700">{pkg.teleSessions}</p>
                      </div>
                      <div className="bg-green-50 rounded-lg p-3 text-center">
                        <div className="flex items-center justify-center gap-2 mb-1">
                          <Home className="w-4 h-4 text-green-600" />
                          <span className="text-sm text-gray-600">Home</span>
                        </div>
                        <p className="text-xl font-bold text-green-700">{pkg.homeSessions}</p>
                      </div>
                    </div>

                    <div className="mb-4 text-center">
                      {pkg.discountPrice ? (
                        <div>
                          <span className="text-gray-500 line-through text-lg">
                            ₹{pkg.price.toLocaleString('en-IN')}
                          </span>
                          <p className="text-3xl font-bold text-purple-600">
                            ₹{pkg.discountPrice.toLocaleString('en-IN')}
                          </p>
                        </div>
                      ) : (
                        <p className="text-3xl font-bold text-gray-900">
                          ₹{pkg.price.toLocaleString('en-IN')}
                        </p>
                      )}
                      <p className="text-sm text-gray-600">{pkg.duration} program</p>
                    </div>

                    <div className="space-y-2 mb-4">
                      <h4 className="font-semibold text-sm text-gray-900">What's Included:</h4>
                      {pkg.features.slice(0, 4).map((feature, idx) => (
                        <div key={idx} className="flex items-start gap-2 text-sm text-gray-700">
                          <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                          {feature}
                        </div>
                      ))}
                    </div>

                    <Button
                      onClick={() => {
                        setSelectedPackage(pkg);
                        setStep('review');
                      }}
                      className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700"
                    >
                      Select Package
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <div className="bg-white rounded-xl shadow-lg p-6">
                <h3 className="font-bold text-lg text-gray-900 mb-4">What concerns do you have?</h3>
                <div className="space-y-2">
                  {CONCERNS.map((concern) => (
                    <label key={concern} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100">
                      <input
                        type="checkbox"
                        checked={concerns.includes(concern)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setConcerns([...concerns, concern]);
                          } else {
                            setConcerns(concerns.filter(c => c !== concern));
                          }
                        }}
                        className="w-4 h-4 text-purple-600"
                      />
                      <span className="text-gray-700">{concern}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-lg p-6">
                <h3 className="font-bold text-lg text-gray-900 mb-4">What are your training goals?</h3>
                <div className="space-y-2">
                  {GOALS.map((goal) => (
                    <label key={goal} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100">
                      <input
                        type="checkbox"
                        checked={goals.includes(goal)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setGoals([...goals, goal]);
                          } else {
                            setGoals(goals.filter(g => g !== goal));
                          }
                        }}
                        className="w-4 h-4 text-purple-600"
                      />
                      <span className="text-gray-700">{goal}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </>
        )}

        {step === 'review' && selectedPackage && (
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h2 className="font-bold text-2xl text-gray-900 mb-6">Review Your Booking</h2>

            <div className="mb-6">
              <h3 className="font-semibold text-gray-900 mb-3">Package Details</h3>
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="font-bold text-lg text-gray-900 mb-2">{selectedPackage.name}</p>
                <div className="flex items-center gap-4 text-sm text-gray-600">
                  <span>{selectedPackage.totalSessions} total sessions</span>
                  <span>•</span>
                  <span>{selectedPackage.duration}</span>
                </div>
              </div>
            </div>

            {(concerns.length > 0 || goals.length > 0) && (
              <div className="mb-6">
                <h3 className="font-semibold text-gray-900 mb-3">Your Concerns & Goals</h3>
                <div className="grid md:grid-cols-2 gap-4">
                  {concerns.length > 0 && (
                    <div className="p-4 bg-orange-50 rounded-lg">
                      <p className="font-medium text-orange-900 mb-2">Concerns:</p>
                      <div className="flex flex-wrap gap-2">
                        {concerns.map((concern) => (
                          <span key={concern} className="px-2 py-1 bg-orange-100 text-orange-700 rounded text-sm">
                            {concern}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {goals.length > 0 && (
                    <div className="p-4 bg-green-50 rounded-lg">
                      <p className="font-medium text-green-900 mb-2">Goals:</p>
                      <div className="flex flex-wrap gap-2">
                        {goals.map((goal) => (
                          <span key={goal} className="px-2 py-1 bg-green-100 text-green-700 rounded text-sm">
                            {goal}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="border-t border-gray-200 pt-6 mb-6">
              <div className="flex items-center justify-between text-2xl font-bold">
                <span className="text-gray-900">Total Amount</span>
                <span className="text-purple-600">
                  ₹{(selectedPackage.discountPrice || selectedPackage.price).toLocaleString('en-IN')}
                </span>
              </div>
              {selectedPackage.discountPrice && (
                <p className="text-sm text-green-600 text-right mt-1">
                  You save ₹{(selectedPackage.price - selectedPackage.discountPrice).toLocaleString('en-IN')}!
                </p>
              )}
            </div>

            <div className="flex gap-3">
              <Button
                onClick={() => setStep('selection')}
                variant="outline"
                className="flex-1"
              >
                Back
              </Button>
              <Button
                onClick={handleBooking}
                disabled={loading}
                className="flex-1 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700"
              >
                {loading ? (
                  <div className="flex items-center gap-2">
                    <div className="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full"></div>
                    Processing...
                  </div>
                ) : (
                  <div className="flex items-center justify-center gap-2">
                    Confirm & Pay
                    <ArrowRight className="w-5 h-5" />
                  </div>
                )}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}