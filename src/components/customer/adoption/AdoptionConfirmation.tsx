import { CheckCircle, Heart, Home } from 'lucide-react';
// Brand color: #FF8C42

interface AdoptionConfirmationProps {
  applicationId: string;
  petData: any;
  centerName: string | null;
  onBackToHome: () => void;
}

export function AdoptionConfirmation({ applicationId, petData, centerName, onBackToHome }: AdoptionConfirmationProps) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-pink-50 to-white max-w-md mx-auto flex items-center justify-center p-6">
      <div className="w-full">
        <div className="text-center mb-6">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-12 h-12 text-green-600" />
          </div>
          <h1 className="text-2xl font-bold mb-2">Application Submitted!</h1>
          <p className="text-gray-600">Your adoption application for {petData.name} has been received</p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5 mb-4">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-16 h-16 bg-gradient-to-br from-pink-400 to-rose-500 rounded-xl flex items-center justify-center text-white text-2xl font-bold">
              {petData.name.charAt(0)}
            </div>
            <div>
              <h3 className="font-semibold">{petData.name}</h3>
              <p className="text-sm text-gray-600">{petData.breed}</p>
            </div>
          </div>

          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Application ID</span>
              <span className="font-medium">{applicationId}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Center</span>
              <span className="font-medium">{centerName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Status</span>
              <span className="text-yellow-600 font-medium">Under Review</span>
            </div>
          </div>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-4">
          <h4 className="font-semibold mb-2 text-blue-900">What's Next?</h4>
          <ul className="space-y-2 text-sm text-blue-800">
            <li className="flex items-start gap-2">
              <span className="text-blue-600">1.</span>
              <span>Center will review your application within 48 hours</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-600">2.</span>
              <span>You'll be contacted for a home visit</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-600">3.</span>
              <span>Meet {petData.name} at the center</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-600">4.</span>
              <span>Complete adoption paperwork</span>
            </li>
          </ul>
        </div>

        <button
          onClick={onBackToHome}
          className="w-full bg-gradient-to-r from-pink-500 to-rose-600 text-white py-3 rounded-lg font-semibold hover:shadow-lg transition-all flex items-center justify-center gap-2"
        >
          <Home className="w-5 h-5" />
          Back to Home
        </button>
      </div>
    </div>
  );
}
