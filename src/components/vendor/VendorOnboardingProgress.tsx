import { CheckCircle2, Circle } from 'lucide-react';

interface VendorOnboardingProgressProps {
  currentStep: number;
  totalSteps: number;
  steps: {
    label: string;
    description?: string;
  }[];
}

export function VendorOnboardingProgress({ currentStep, totalSteps, steps }: VendorOnboardingProgressProps) {
  const progressPercentage = (currentStep / totalSteps) * 100;

  return (
    <div className="w-full mb-8">
      {/* Progress Bar */}
      <div className="relative mb-6">
        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-[#FF8C42] to-[#FF6B35] transition-all duration-500 ease-out"
            style={{ width: `${progressPercentage}%` }}
          />
        </div>
        <div className="text-center mt-2">
          <span className="text-sm font-semibold text-[#FF8C42]">
            Step {currentStep} of {totalSteps}
          </span>
        </div>
      </div>

      {/* Step Indicators */}
      <div className="flex justify-between items-start">
        {steps.map((step, index) => {
          const stepNumber = index + 1;
          const isCompleted = stepNumber < currentStep;
          const isCurrent = stepNumber === currentStep;
          const isPending = stepNumber > currentStep;

          return (
            <div key={index} className="flex-1 flex flex-col items-center">
              {/* Step Circle */}
              <div className="relative">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 ${
                    isCompleted
                      ? 'bg-green-500 text-white'
                      : isCurrent
                      ? 'bg-[#FF8C42] text-white ring-4 ring-orange-100'
                      : 'bg-gray-200 text-gray-400'
                  }`}
                >
                  {isCompleted ? (
                    <CheckCircle2 className="w-6 h-6" />
                  ) : (
                    <span className="text-sm font-semibold">{stepNumber}</span>
                  )}
                </div>
                
                {/* Connector Line */}
                {index < steps.length - 1 && (
                  <div
                    className={`absolute top-5 left-10 w-full h-0.5 ${
                      isCompleted ? 'bg-green-500' : 'bg-gray-200'
                    }`}
                    style={{ width: 'calc(100% - 2.5rem)' }}
                  />
                )}
              </div>

              {/* Step Label */}
              <div className="mt-3 text-center max-w-[80px]">
                <p
                  className={`text-xs font-medium ${
                    isCurrent
                      ? 'text-[#FF8C42]'
                      : isCompleted
                      ? 'text-green-600'
                      : 'text-gray-400'
                  }`}
                >
                  {step.label}
                </p>
                {step.description && isCurrent && (
                  <p className="text-xs text-gray-500 mt-1">{step.description}</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

