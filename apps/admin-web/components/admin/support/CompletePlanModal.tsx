'use client';

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Button,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Label,
  Textarea,
  Badge,
} from '@warmpawz/ui';
import { apiClient } from '@/lib/api-client';
import { toast } from 'sonner';
import { Loader2, Sparkles, FileText, CheckCircle } from 'lucide-react';

interface CompletePlanModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ticketId?: string;
  customerId?: string;
  petId?: string;
  onPlanCreated?: (planId: string) => void;
}

interface Pet {
  id: string;
  name: string;
  species: string;
  breed: string;
  age_years?: number;
}

interface Template {
  id: string;
  name: string;
  planType: string;
  petType: string;
  description: string;
}

export function CompletePlanModal({
  open,
  onOpenChange,
  ticketId,
  customerId,
  petId,
  onPlanCreated,
}: CompletePlanModalProps) {
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [pets, setPets] = useState<Pet[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  
  const [selectedPetId, setSelectedPetId] = useState(petId || '');
  const [planType, setPlanType] = useState<'wellness' | 'treatment' | 'nutrition' | 'training' | 'general'>('wellness');
  const [generationMethod, setGenerationMethod] = useState<'ai' | 'template' | 'manual'>('ai');
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [context, setContext] = useState('');

  useEffect(() => {
    if (open && customerId) {
      loadPets();
      loadTemplates();
    }
  }, [open, customerId]);

  useEffect(() => {
    if (petId) {
      setSelectedPetId(petId);
    }
  }, [petId]);

  const loadPets = async () => {
    if (!customerId) return;
    
    try {
      const response = await apiClient.get<any>(`/customer/${customerId}/pets`);
      if (response.success && response.pets) {
        setPets(response.pets);
        if (response.pets.length === 1 && !selectedPetId) {
          setSelectedPetId(response.pets[0].id);
        }
      }
    } catch (error) {
      console.error('Error loading pets:', error);
      toast.error('Failed to load pets');
    }
  };

  const loadTemplates = async () => {
    try {
      const response = await apiClient.get<any>(`/crm/plans/templates?planType=${planType}`);
      if (response.success && response.templates) {
        setTemplates(response.templates);
      }
    } catch (error) {
      console.error('Error loading templates:', error);
    }
  };

  useEffect(() => {
    if (open && planType) {
      loadTemplates();
    }
  }, [planType, open]);

  const handleGenerate = async () => {
    if (!selectedPetId || !customerId) {
      toast.error('Please select a pet');
      return;
    }

    if (generationMethod === 'template' && !selectedTemplateId) {
      toast.error('Please select a template');
      return;
    }

    setGenerating(true);
    try {
      const response = await apiClient.post<any>('/crm/plans/generate', {
        ticketId,
        customerId,
        petId: selectedPetId,
        planType,
        generationMethod,
        templateId: generationMethod === 'template' ? selectedTemplateId : undefined,
        context: context.trim() || undefined,
      });

      if (response.success && response.plan) {
        toast.success('Care plan generated successfully!');
        if (onPlanCreated) {
          onPlanCreated(response.plan.id);
        }
        onOpenChange(false);
        // Reset form
        setContext('');
        setSelectedTemplateId('');
      } else {
        toast.error(response.error || 'Failed to generate plan');
      }
    } catch (error: any) {
      console.error('Error generating plan:', error);
      toast.error(error.message || 'Failed to generate care plan');
    } finally {
      setGenerating(false);
    }
  };

  const selectedPet = pets.find(p => p.id === selectedPetId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-orange-600" />
            Generate Complete Care Plan
          </DialogTitle>
          <DialogDescription>
            Create a comprehensive care plan for the customer's pet using AI, templates, or manual creation.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Pet Selection */}
          <div>
            <Label>Select Pet *</Label>
            <Select value={selectedPetId} onValueChange={setSelectedPetId}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a pet..." />
              </SelectTrigger>
              <SelectContent>
                {pets.map((pet) => (
                  <SelectItem key={pet.id} value={pet.id}>
                    {pet.name} ({pet.species} - {pet.breed})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedPet && (
              <p className="text-xs text-gray-500 mt-1">
                {selectedPet.name}, {selectedPet.age_years || 'Unknown'} years old
              </p>
            )}
          </div>

          {/* Plan Type */}
          <div>
            <Label>Plan Type *</Label>
            <Select value={planType} onValueChange={(v: any) => setPlanType(v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="wellness">Wellness Plan</SelectItem>
                <SelectItem value="treatment">Treatment Plan</SelectItem>
                <SelectItem value="nutrition">Nutrition Plan</SelectItem>
                <SelectItem value="training">Training Plan</SelectItem>
                <SelectItem value="general">General Care Plan</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Generation Method */}
          <div>
            <Label>Generation Method *</Label>
            <Select value={generationMethod} onValueChange={(v: any) => setGenerationMethod(v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ai">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4" />
                    AI Generated (Recommended)
                  </div>
                </SelectItem>
                <SelectItem value="template">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4" />
                    Use Template
                  </div>
                </SelectItem>
                <SelectItem value="manual">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4" />
                    Manual Creation
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-gray-500 mt-1">
              {generationMethod === 'ai' && 'AI will generate a personalized plan based on pet information'}
              {generationMethod === 'template' && 'Select from pre-made plan templates'}
              {generationMethod === 'manual' && 'Create plan manually step by step'}
            </p>
          </div>

          {/* Template Selection (if using template) */}
          {generationMethod === 'template' && (
            <div>
              <Label>Select Template *</Label>
              <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a template..." />
                </SelectTrigger>
                <SelectContent>
                  {templates.length === 0 ? (
                    <SelectItem value="" disabled>
                      No templates available for this plan type
                    </SelectItem>
                  ) : (
                    templates.map((template) => (
                      <SelectItem key={template.id} value={template.id}>
                        <div>
                          <div className="font-medium">{template.name}</div>
                          <div className="text-xs text-gray-500">{template.description}</div>
                        </div>
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Additional Context */}
          <div>
            <Label>Additional Context</Label>
            <Textarea
              value={context}
              onChange={(e) => setContext(e.target.value)}
              placeholder="Add any additional information about the pet's condition, requirements, or special needs..."
              rows={4}
              className="resize-none"
            />
            <p className="text-xs text-gray-500 mt-1">
              This context will help AI generate a more personalized plan
            </p>
          </div>

          {/* Info Box */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start gap-2">
              <Sparkles className="w-5 h-5 text-blue-600 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-blue-900 mb-1">
                  {generationMethod === 'ai' && 'AI-Powered Generation'}
                  {generationMethod === 'template' && 'Template-Based Plan'}
                  {generationMethod === 'manual' && 'Manual Plan Creation'}
                </p>
                <p className="text-xs text-blue-700">
                  {generationMethod === 'ai' && 
                    'The AI will analyze the pet\'s information and generate a comprehensive, personalized care plan with specific recommendations and schedules.'}
                  {generationMethod === 'template' && 
                    'A pre-configured plan template will be used as a starting point. You can customize it after generation.'}
                  {generationMethod === 'manual' && 
                    'You\'ll create the plan step by step. This gives you full control over every detail.'}
                </p>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={generating}>
            Cancel
          </Button>
          <Button
            onClick={handleGenerate}
            disabled={generating || !selectedPetId}
            className="bg-orange-600 hover:bg-orange-700"
          >
            {generating ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 mr-2" />
                Generate Plan
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
