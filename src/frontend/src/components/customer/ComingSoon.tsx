import { Button } from '../../../../components/ui/button';
import { ArrowLeft, Clock } from 'lucide-react';

export function ComingSoon({ onBack }: { onBack: () => void }) {
  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6 text-center">
      <div className="bg-orange-100 p-4 rounded-full mb-6">
        <Clock className="w-12 h-12 text-[#FF8C42]" />
      </div>
      <h1 className="text-2xl font-bold mb-2">Coming Soon</h1>
      <p className="text-gray-500 mb-8 max-w-xs">
        We're working hard to bring this feature to you. Stay tuned!
      </p>
      <Button onClick={onBack} className="bg-[#FF8C42] hover:bg-[#FF7A2E]">
        <ArrowLeft className="w-4 h-4 mr-2" /> Go Back
      </Button>
    </div>
  );
}
