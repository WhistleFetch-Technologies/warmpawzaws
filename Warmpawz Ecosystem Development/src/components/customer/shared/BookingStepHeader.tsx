import { ArrowLeft } from 'lucide-react';

interface Step {
  id: string;
  label: string;
}

interface BookingStepHeaderProps {
  currentStep: string;
  steps: Step[];
  title: string;
  subtitle?: string;
  onBack: () => void;
  showProgress?: boolean;
  variant?: 'default' | 'orange-gradient';
}

/**
 * Shared BookingStepHeader Component
 * 
 * Provides consistent step navigation UI across all booking flows.
 * Includes:
 * - Back button with proper navigation
 * - Title and optional subtitle
 * - Visual progress indicator bar
 * 
 * Usage:
 * <BookingStepHeader
 *   currentStep={step}
 *   steps={[{ id: 'select', label: 'Select' }, { id: 'confirm', label: 'Confirm' }]}
 *   title="Book Service"
 *   onBack={handleBack}
 * />
 */
export function BookingStepHeader({ 
  currentStep, 
  steps, 
  title, 
  subtitle,
  onBack,
  showProgress = true,
  variant = 'default'
}: BookingStepHeaderProps) {
  const currentIndex = steps.findIndex(s => s.id === currentStep);
  
  if (variant === 'orange-gradient') {
    return (
      <div className="bg-gradient-to-r from-[#FF8C42] to-[#FF6B35] px-6 pt-12 pb-6 sticky top-0 z-10 relative">
        <div className="flex items-center gap-4 mb-4">
          <button 
            onClick={onBack}
            className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm hover:bg-white/30 transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-white" />
          </button>
          <div className="flex-1">
            <h1 className="text-xl font-bold text-white">{title}</h1>
            {subtitle && <p className="text-white/90 text-sm">{subtitle}</p>}
          </div>
        </div>
        
        {/* Progress indicator */}
        {showProgress && steps.length > 1 && (
          <div className="flex gap-1.5 mt-2">
            {steps.map((step, i) => (
              <div 
                key={step.id} 
                className={`h-1 flex-1 rounded-full transition-all ${
                  i <= currentIndex ? 'bg-white' : 'bg-white/30'
                }`}
              />
            ))}
          </div>
        )}
        
        {/* Concave curve bottom */}
        <div 
          className="absolute bottom-0 left-0 right-0 h-6 bg-white" 
          style={{
            borderTopLeftRadius: '50% 100%',
            borderTopRightRadius: '50% 100%',
          }}
        />
      </div>
    );
  }
  
  // Default variant - white header
  return (
    <div className="bg-white sticky top-0 z-10 border-b border-gray-200 px-4 py-4">
      <div className="flex items-center gap-3">
        <button 
          onClick={onBack}
          className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center hover:bg-gray-200 transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-gray-700" />
        </button>
        <div className="flex-1">
          <h1 className="text-lg font-semibold text-gray-900">{title}</h1>
          {subtitle && <p className="text-sm text-gray-500">{subtitle}</p>}
          
          {/* Progress indicator */}
          {showProgress && steps.length > 1 && (
            <div className="flex gap-1 mt-2">
              {steps.map((step, i) => (
                <div 
                  key={step.id} 
                  className={`h-1 flex-1 rounded-full transition-all ${
                    i <= currentIndex ? 'bg-[#FF8C42]' : 'bg-gray-200'
                  }`}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default BookingStepHeader;
