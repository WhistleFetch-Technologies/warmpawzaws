import { useState } from 'react';
import { ArrowLeft, Heart, CheckCircle, PawPrint, Home, Users, Info } from 'lucide-react';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { RadioGroup, RadioGroupItem } from '../ui/radio-group';
import { Textarea } from '../ui/textarea';
import { toast } from 'sonner@2.0.3';

interface AdoptionQuestionnaireProps {
  onBack: () => void;
  onComplete: () => void;
}

export function AdoptionQuestionnaire({ onBack, onComplete }: AdoptionQuestionnaireProps) {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState<any>({
      livingSituation: '',
      hasChildren: '',
      hasOtherPets: '',
      activityLevel: '',
      experience: '',
      reason: ''
  });

  const totalSteps = 3;

  const handleNext = () => {
      if (step < totalSteps) setStep(step + 1);
      else handleSubmit();
  };

  const handleSubmit = () => {
      // Here we would save the questionnaire to the user profile
      toast.success('Profile created! Showing matched pets.');
      onComplete();
  };

  const renderStep1 = () => (
      <div className="space-y-6">
          <div className="space-y-3">
              <Label className="text-base">What is your living situation?</Label>
              <RadioGroup onValueChange={(v) => setFormData({...formData, livingSituation: v})} value={formData.livingSituation}>
                  <div className="flex items-center space-x-2 border p-3 rounded-lg">
                      <RadioGroupItem value="apartment" id="apt" />
                      <Label htmlFor="apt" className="flex-1 cursor-pointer">Apartment / Flat</Label>
                  </div>
                  <div className="flex items-center space-x-2 border p-3 rounded-lg">
                      <RadioGroupItem value="house_yard" id="house_yard" />
                      <Label htmlFor="house_yard" className="flex-1 cursor-pointer">House with Yard</Label>
                  </div>
                  <div className="flex items-center space-x-2 border p-3 rounded-lg">
                      <RadioGroupItem value="house_no_yard" id="house_no_yard" />
                      <Label htmlFor="house_no_yard" className="flex-1 cursor-pointer">House without Yard</Label>
                  </div>
              </RadioGroup>
          </div>

           <div className="space-y-3">
              <Label className="text-base">Do you have children at home?</Label>
              <RadioGroup onValueChange={(v) => setFormData({...formData, hasChildren: v})} value={formData.hasChildren}>
                  <div className="flex items-center space-x-2 border p-3 rounded-lg">
                      <RadioGroupItem value="yes_under_5" id="child_u5" />
                      <Label htmlFor="child_u5" className="flex-1 cursor-pointer">Yes, under 5 years</Label>
                  </div>
                  <div className="flex items-center space-x-2 border p-3 rounded-lg">
                      <RadioGroupItem value="yes_over_5" id="child_o5" />
                      <Label htmlFor="child_o5" className="flex-1 cursor-pointer">Yes, over 5 years</Label>
                  </div>
                  <div className="flex items-center space-x-2 border p-3 rounded-lg">
                      <RadioGroupItem value="no" id="child_no" />
                      <Label htmlFor="child_no" className="flex-1 cursor-pointer">No children</Label>
                  </div>
              </RadioGroup>
          </div>
      </div>
  );

  const renderStep2 = () => (
    <div className="space-y-6">
        <div className="space-y-3">
            <Label className="text-base">Do you have other pets?</Label>
             <RadioGroup onValueChange={(v) => setFormData({...formData, hasOtherPets: v})} value={formData.hasOtherPets}>
                  <div className="flex items-center space-x-2 border p-3 rounded-lg">
                      <RadioGroupItem value="yes_dogs" id="pet_dogs" />
                      <Label htmlFor="pet_dogs" className="flex-1 cursor-pointer">Yes, Dogs</Label>
                  </div>
                  <div className="flex items-center space-x-2 border p-3 rounded-lg">
                      <RadioGroupItem value="yes_cats" id="pet_cats" />
                      <Label htmlFor="pet_cats" className="flex-1 cursor-pointer">Yes, Cats</Label>
                  </div>
                  <div className="flex items-center space-x-2 border p-3 rounded-lg">
                      <RadioGroupItem value="no" id="pet_no" />
                      <Label htmlFor="pet_no" className="flex-1 cursor-pointer">No other pets</Label>
                  </div>
              </RadioGroup>
        </div>

         <div className="space-y-3">
            <Label className="text-base">Your Activity Level</Label>
             <RadioGroup onValueChange={(v) => setFormData({...formData, activityLevel: v})} value={formData.activityLevel}>
                  <div className="flex items-center space-x-2 border p-3 rounded-lg">
                      <RadioGroupItem value="very_active" id="act_very" />
                      <Label htmlFor="act_very" className="flex-1 cursor-pointer">Very Active (Daily runs/hikes)</Label>
                  </div>
                  <div className="flex items-center space-x-2 border p-3 rounded-lg">
                      <RadioGroupItem value="moderate" id="act_mod" />
                      <Label htmlFor="act_mod" className="flex-1 cursor-pointer">Moderate (Daily walks)</Label>
                  </div>
                  <div className="flex items-center space-x-2 border p-3 rounded-lg">
                      <RadioGroupItem value="low" id="act_low" />
                      <Label htmlFor="act_low" className="flex-1 cursor-pointer">Low (Short walks/Indoor)</Label>
                  </div>
              </RadioGroup>
        </div>
    </div>
  );

  const renderStep3 = () => (
      <div className="space-y-6">
          <div className="space-y-3">
              <Label className="text-base">Previous Pet Experience</Label>
              <RadioGroup onValueChange={(v) => setFormData({...formData, experience: v})} value={formData.experience}>
                  <div className="flex items-center space-x-2 border p-3 rounded-lg">
                      <RadioGroupItem value="first_time" id="exp_first" />
                      <Label htmlFor="exp_first" className="flex-1 cursor-pointer">First-time owner</Label>
                  </div>
                  <div className="flex items-center space-x-2 border p-3 rounded-lg">
                      <RadioGroupItem value="had_before" id="exp_had" />
                      <Label htmlFor="exp_had" className="flex-1 cursor-pointer">Had pets before</Label>
                  </div>
                  <div className="flex items-center space-x-2 border p-3 rounded-lg">
                      <RadioGroupItem value="experienced" id="exp_exp" />
                      <Label htmlFor="exp_exp" className="flex-1 cursor-pointer">Experienced / Trainer</Label>
                  </div>
              </RadioGroup>
          </div>

          <div className="space-y-3">
              <Label className="text-base">Why do you want to adopt?</Label>
              <Textarea 
                placeholder="Tell us a bit about why you're looking for a pet..."
                value={formData.reason}
                onChange={(e) => setFormData({...formData, reason: e.target.value})}
                rows={3}
              />
          </div>
      </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <div className="bg-white p-4 border-b sticky top-0 z-10 flex items-center gap-3">
        <button onClick={onBack}><ArrowLeft className="w-6 h-6 text-gray-600" /></button>
        <div className="flex-1">
           <h1 className="text-lg font-bold text-gray-900">Adoption Match</h1>
           <p className="text-xs text-gray-500">Step {step} of {totalSteps}</p>
        </div>
      </div>

      <div className="p-4 flex-1">
          <div className="bg-purple-50 p-4 rounded-xl mb-6 flex gap-3 items-start">
              <Heart className="w-6 h-6 text-purple-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-purple-900">
                  Answer a few questions to help us match you with the perfect furry companion for your lifestyle.
              </p>
          </div>

          <Card className="p-6">
              {step === 1 && renderStep1()}
              {step === 2 && renderStep2()}
              {step === 3 && renderStep3()}
          </Card>
      </div>

      <div className="bg-white p-4 border-t shadow-lg">
          <Button 
              className="w-full bg-purple-600 hover:bg-purple-700 text-white h-12 text-lg"
              onClick={handleNext}
          >
              {step === totalSteps ? 'Find My Match' : 'Next Step'}
          </Button>
      </div>
    </div>
  );
}
