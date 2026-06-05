'use client';

import React, { useState, useEffect, useRef } from 'react';
import { 
  X, Camera, Upload, ChevronRight, ChevronLeft, Check, AlertCircle,
  Calendar, Syringe, Heart, Shield, Dog, Cat, Sparkles, Image as ImageIcon,
  Info, Plus, Trash2, Clock, Bell, FileText, Star, Zap, CircleDot, HelpCircle, Baby, PawPrint
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { apiClient } from '@/lib/api-client';
import { addPetErrorMessage, resolveCustomerIdForPetMutation } from '@/lib/pet-create-helpers';
import { toast } from 'sonner';

// ============================================================================
// TYPES
// ============================================================================

interface VaccinationRecord {
  id: string;
  /** Stable id for wizard rows, e.g. `dog:rabies` — used when pet type changes. */
  vaccineKey?: string;
  name: string;
  lastDate: string;
  nextDueDate: string;
  veterinarian?: string;
  batchNumber?: string;
  notes?: string;
}

interface PetData {
  id: string;
  name: string;
  type: 'Dog' | 'Cat';
  breed: string;
  dateOfBirth: string;
  gender: 'Male' | 'Female';
  weight: string;
  color: string;
  photo: string;
  
  // Identity
  microchipId?: string;
  registrationNumber?: string;
  
  // Physical Characteristics
  size: 'Small' | 'Medium' | 'Large' | 'Giant';
  coatType?: string;
  eyeColor?: string;
  distinguishingMarks?: string;
  
  // Health Status
  isSpayedNeutered: boolean;
  bloodType?: string;
  allergies: string[];
  currentMedications: string[];
  chronicConditions: string[];
  dietaryRestrictions?: string;
  
  // Vaccination Records
  vaccinations: VaccinationRecord[];
  
  // Behavior
  temperament?: string;
  activityLevel: 'Low' | 'Medium' | 'High';
  isGoodWithKids?: boolean;
  isGoodWithOtherPets?: boolean;
  specialNeeds?: string;
  
  // Insurance
  hasInsurance: boolean;
  insuranceProvider?: string;
  insurancePolicyNumber?: string;
  
  // Emergency Contact
  emergencyVetName?: string;
  emergencyVetPhone?: string;
}

interface EnhancedAddPetModalProps {
  phone: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  editPet?: PetData; // For edit mode
  /** `modal` = bottom sheet over dimmed backdrop (default). `fullscreen` = embedded full viewport (e.g. home `add-pet` screen). */
  variant?: 'modal' | 'fullscreen';
  /** Fullscreen header back; defaults to `onClose` when omitted. */
  onBack?: () => void;
}

type Step = 'photo' | 'basic' | 'physical' | 'health' | 'vaccinations' | 'behavior' | 'review';

// ============================================================================
// BREED DATA
// ============================================================================

const DOG_BREEDS = [
  'Labrador Retriever', 'German Shepherd', 'Golden Retriever', 'Bulldog', 'Beagle',
  'Poodle', 'Rottweiler', 'Yorkshire Terrier', 'Boxer', 'Dachshund', 'Siberian Husky',
  'Great Dane', 'Doberman Pinscher', 'Shih Tzu', 'Pomeranian', 'Chihuahua',
  'French Bulldog', 'Pug', 'Cocker Spaniel', 'Border Collie', 'Indian Pariah',
  'Indie/Mixed Breed', 'Other'
];

const CAT_BREEDS = [
  'Persian', 'Maine Coon', 'Ragdoll', 'British Shorthair', 'Siamese',
  'Bengal', 'Abyssinian', 'Russian Blue', 'Sphynx', 'Scottish Fold',
  'American Shorthair', 'Birman', 'Himalayan', 'Indie/Mixed', 'Other'
];

type PetSpecies = 'Dog' | 'Cat';

interface VaccinationTemplate {
  key: string;
  displayName: string;
  /** Sent as `name` / `type` on POST /pets — stable for analytics & backend. */
  payloadName: string;
  description: string;
  intervalDays: number;
}

const VACCINATION_TEMPLATES: Record<PetSpecies, VaccinationTemplate[]> = {
  Dog: [
    {
      key: 'dog:rabies',
      displayName: 'Rabies Vaccine',
      payloadName: 'Rabies Vaccine',
      description:
        'Protects dogs from the deadly rabies virus, prevents transmission to humans, and is usually given once yearly or as advised by the vet.',
      intervalDays: 365,
    },
    {
      key: 'dog:dhpp',
      displayName: 'DHPP Vaccine',
      payloadName: 'DHPP Vaccine',
      description:
        'Protects against Distemper, Hepatitis, Parvovirus, and Parainfluenza, helping prevent severe contagious diseases, with booster doses generally recommended yearly or every 3 years.',
      intervalDays: 365,
    },
    {
      key: 'dog:bordetella',
      displayName: 'Bordetella (Kennel Cough) Vaccine',
      payloadName: 'Bordetella (Kennel Cough) Vaccine',
      description:
        'Helps protect dogs from highly contagious kennel cough infections common in boarding, grooming, and daycare environments, usually taken annually or every 6–12 months for high-risk dogs.',
      intervalDays: 180,
    },
    {
      key: 'dog:leptospirosis',
      displayName: 'Leptospirosis Vaccine',
      payloadName: 'Leptospirosis Vaccine',
      description:
        'Protects against bacterial infections spread through contaminated water or urine that can affect both pets and humans, commonly administered once yearly.',
      intervalDays: 365,
    },
    {
      key: 'dog:canine-influenza',
      displayName: 'Canine Influenza Vaccine',
      payloadName: 'Canine Influenza Vaccine',
      description:
        'Helps prevent dog flu infections that spread easily in social environments, reducing severity of respiratory illness, with annual booster recommendations.',
      intervalDays: 365,
    },
    {
      key: 'dog:lyme',
      displayName: 'Lyme Disease Vaccine',
      payloadName: 'Lyme Disease Vaccine',
      description:
        'Protects dogs from Lyme disease caused by tick bites, helping reduce joint, kidney, and fever-related complications, typically recommended yearly in tick-prone areas.',
      intervalDays: 365,
    },
  ],
  Cat: [
    {
      key: 'cat:rabies',
      displayName: 'Rabies Vaccine',
      payloadName: 'Rabies Vaccine',
      description:
        'Protects cats from the deadly rabies virus, prevents transmission to humans, and is usually given once yearly or as advised by the vet.',
      intervalDays: 365,
    },
    {
      key: 'cat:fvrcp',
      displayName: 'FVRCP Vaccine',
      payloadName: 'FVRCP Vaccine',
      description:
        'Protects against common feline respiratory and viral diseases like rhinotracheitis, calicivirus, and panleukopenia, typically taken annually or every 3 years after boosters.',
      intervalDays: 365,
    },
    {
      key: 'cat:felv',
      displayName: 'FeLV Vaccine',
      payloadName: 'FeLV Vaccine',
      description:
        'Helps protect cats from feline leukemia virus that weakens the immune system, especially important for outdoor or multi-cat households, with yearly booster doses recommended.',
      intervalDays: 365,
    },
    {
      key: 'cat:fiv',
      displayName: 'FIV Vaccine',
      payloadName: 'FIV Vaccine',
      description:
        'Helps reduce the risk of feline immunodeficiency virus infection that affects immunity, mainly recommended for high-risk outdoor cats, with boosters as advised by veterinarians.',
      intervalDays: 365,
    },
    {
      key: 'cat:bordetella',
      displayName: 'Bordetella Vaccine',
      payloadName: 'Bordetella Vaccine',
      description:
        'Protects cats from Bordetella respiratory infections commonly spread in boarding or grooming environments, generally recommended annually for social or frequently traveling cats.',
      intervalDays: 365,
    },
  ],
};

// ============================================================================
// COMPONENT
// ============================================================================

export function EnhancedAddPetModal({ 
  phone, 
  isOpen, 
  onClose, 
  onSuccess,
  editPet,
  variant = 'modal',
  onBack,
}: EnhancedAddPetModalProps) {
  const isModal = variant === 'modal';
  const handleHeaderDismiss = () => (onBack ?? onClose)();

  const [step, setStep] = useState<Step>('photo');
  const [loading, setLoading] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  /** Staged vaccine dates — commit only on explicit confirm (avoids iOS WKWebView auto-select). */
  const [pendingVaxDates, setPendingVaxDates] = useState<Record<string, string>>({});
  
  // Pet data state
  const [petData, setPetData] = useState<PetData>({
    id: editPet?.id || `pet_${Date.now()}`,
    name: editPet?.name || '',
    type: editPet?.type || 'Dog',
    breed: editPet?.breed || '',
    dateOfBirth: editPet?.dateOfBirth || '',
    gender: editPet?.gender || 'Male',
    weight: editPet?.weight || '',
    color: editPet?.color || '',
    photo: editPet?.photo || '',
    microchipId: editPet?.microchipId || '',
    registrationNumber: editPet?.registrationNumber || '',
    size: editPet?.size || 'Medium',
    coatType: editPet?.coatType || '',
    eyeColor: editPet?.eyeColor || '',
    distinguishingMarks: editPet?.distinguishingMarks || '',
    isSpayedNeutered: editPet?.isSpayedNeutered || false,
    bloodType: editPet?.bloodType || '',
    allergies: editPet?.allergies || [],
    currentMedications: editPet?.currentMedications || [],
    chronicConditions: editPet?.chronicConditions || [],
    dietaryRestrictions: editPet?.dietaryRestrictions || '',
    vaccinations: editPet?.vaccinations || [],
    temperament: editPet?.temperament || '',
    activityLevel: editPet?.activityLevel || 'Medium',
    isGoodWithKids: editPet?.isGoodWithKids,
    isGoodWithOtherPets: editPet?.isGoodWithOtherPets,
    specialNeeds: editPet?.specialNeeds || '',
    hasInsurance: editPet?.hasInsurance || false,
    insuranceProvider: editPet?.insuranceProvider || '',
    insurancePolicyNumber: editPet?.insurancePolicyNumber || '',
    emergencyVetName: editPet?.emergencyVetName || '',
    emergencyVetPhone: editPet?.emergencyVetPhone || '',
  });
  
  const [photoPreview, setPhotoPreview] = useState<string>(editPet?.photo || '');
  const [newAllergy, setNewAllergy] = useState('');
  const [newMedication, setNewMedication] = useState('');
  const [newCondition, setNewCondition] = useState('');
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  const prevPetTypeRef = useRef(petData.type);
  useEffect(() => {
    if (prevPetTypeRef.current === petData.type) return;
    prevPetTypeRef.current = petData.type;
    const prefix = petData.type === 'Dog' ? 'dog:' : 'cat:';
    setPetData((prev) => ({
      ...prev,
      vaccinations: prev.vaccinations.filter(
        (v) => !v.vaccineKey || v.vaccineKey.startsWith(prefix)
      ),
    }));
  }, [petData.type]);

  // Calculate age from date of birth
  const calculateAge = (dob: string): string => {
    if (!dob) return '';
    const birthDate = new Date(dob);
    const today = new Date();
    const years = today.getFullYear() - birthDate.getFullYear();
    const months = today.getMonth() - birthDate.getMonth();
    
    if (years < 1) {
      const totalMonths = years * 12 + months;
      return `${Math.max(1, totalMonths)} month${totalMonths !== 1 ? 's' : ''}`;
    }
    return `${years} year${years !== 1 ? 's' : ''}`;
  };

  // Calculate next due date for vaccination
  const calculateNextDueDate = (lastDate: string, intervalDays: number): string => {
    if (!lastDate) return '';
    const date = new Date(lastDate);
    date.setDate(date.getDate() + intervalDays);
    return date.toISOString().split('T')[0];
  };

  // Photo upload handler
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // Validate file
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image size should be less than 5MB');
      return;
    }
    
    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file');
      return;
    }
    
    // Show preview immediately
    const reader = new FileReader();
    reader.onloadend = () => {
      setPhotoPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
    
    // Upload to S3 with progress tracking
    setUploadingPhoto(true);
    setUploadProgress(0);
    try {
      const { uploadPetPhotoWithProgress } = await import('@/lib/photo-upload-enhanced');
      const result = await uploadPetPhotoWithProgress(file, petData.id, phone, {
        onProgress: (progress) => {
          setUploadProgress(progress);
        },
        verifyUpload: true,
        maxRetries: 3,
      });
      
      if (result.success && result.publicUrl) {
        setPetData(prev => ({ ...prev, photo: result.publicUrl as string }));
        toast.success('Photo uploaded successfully!');
      } else {
        toast.error(result.error || 'Failed to upload photo. Please try again.');
        // Reset preview on error
        setPhotoPreview(editPet?.photo || '');
      }
    } catch (error: any) {
      console.error('Photo upload error:', error);
      toast.error(error.message || 'Failed to upload photo. Please try again.');
      setPhotoPreview(editPet?.photo || '');
    } finally {
      setUploadingPhoto(false);
      setUploadProgress(0);
    }
  };

  // Add vaccination record (replaces same vaccineKey if present)
  const addVaccination = (
    vaccineKey: string,
    payloadName: string,
    lastDate: string,
    intervalDays: number = 365
  ) => {
    const newVax: VaccinationRecord = {
      id: `vax_${Date.now()}`,
      vaccineKey,
      name: payloadName,
      lastDate,
      nextDueDate: calculateNextDueDate(lastDate, intervalDays),
    };
    setPetData((prev) => ({
      ...prev,
      vaccinations: [...prev.vaccinations.filter((v) => v.vaccineKey !== vaccineKey), newVax],
    }));
  };

  // Remove vaccination
  const removeVaccination = (id: string) => {
    setPetData(prev => ({
      ...prev,
      vaccinations: prev.vaccinations.filter(v => v.id !== id),
    }));
  };

  const confirmVaccinationDate = (
    tmpl: VaccinationTemplate,
    dateValue: string
  ) => {
    if (!dateValue) return;
    addVaccination(tmpl.key, tmpl.payloadName, dateValue, tmpl.intervalDays);
    setPendingVaxDates((prev) => {
      const next = { ...prev };
      delete next[tmpl.key];
      return next;
    });
  };

  // Validate current step
  const validateStep = (): boolean => {
    const errors: Record<string, string> = {};
    
    switch (step) {
      case 'photo':
        if (!petData.photo && !photoPreview) {
          errors.photo = 'Photo is required';
        }
        break;
      case 'basic':
        if (!petData.name.trim()) errors.name = 'Name is required';
        if (!petData.breed) errors.breed = 'Breed is required';
        if (!petData.dateOfBirth) errors.dateOfBirth = 'Date of birth is required';
        if (!petData.gender) errors.gender = 'Gender is required';
        break;
      case 'physical':
        if (!petData.weight) errors.weight = 'Weight is required';
        if (!petData.color) errors.color = 'Color is required';
        break;
    }
    
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Navigate to next step
  const nextStep = () => {
    if (!validateStep()) {
      toast.error('Please fill in all required fields');
      return;
    }
    
    const steps: Step[] = ['photo', 'basic', 'physical', 'health', 'vaccinations', 'behavior', 'review'];
    const currentIndex = steps.indexOf(step);
    if (currentIndex < steps.length - 1) {
      setStep(steps[currentIndex + 1]);
    }
  };

  // Navigate to previous step
  const prevStep = () => {
    const steps: Step[] = ['photo', 'basic', 'physical', 'health', 'vaccinations', 'behavior', 'review'];
    const currentIndex = steps.indexOf(step);
    if (currentIndex > 0) {
      setStep(steps[currentIndex - 1]);
    }
  };

  // Save pet
  const handleSavePet = async () => {
    setLoading(true);
    try {
      const customerId = await resolveCustomerIdForPetMutation();
      if (!customerId) {
        toast.error('Customer not found. Try signing out and back in.');
        return;
      }

      const ageFromDob = (() => {
        if (!petData.dateOfBirth) return undefined;
        const birthDate = new Date(petData.dateOfBirth);
        if (Number.isNaN(birthDate.getTime())) return undefined;
        const now = new Date();
        const ageInMonths =
          (now.getFullYear() - birthDate.getFullYear()) * 12 +
          (now.getMonth() - birthDate.getMonth());
        return Math.max(0, Math.floor(ageInMonths / 12));
      })();

      const payload: Record<string, unknown> = {
        customerId,
        name: petData.name.trim(),
        petType: petData.type,
        species: petData.type,
        breed: petData.breed || undefined,
        age: ageFromDob,
        ageUnit: 'years',
        gender: petData.gender?.toLowerCase(),
        weight: petData.weight ? Number(petData.weight) : undefined,
        color: petData.color || undefined,
        size: petData.size || undefined,
        photo: petData.photo || undefined,
        dob: petData.dateOfBirth || undefined,
        microchipId: petData.microchipId || undefined,
        allergies: petData.allergies || [],
        chronicConditions: petData.chronicConditions || [],
        vaccinations: petData.vaccinations.map((v) => ({
          type: v.name,
          name: v.name,
          date: v.lastDate,
          lastDate: v.lastDate,
          nextDue: v.nextDueDate,
          nextDueDate: v.nextDueDate,
        })),
        behaviorNotes: petData.specialNeeds || petData.temperament || undefined,
        specialNeeds: petData.specialNeeds || undefined,
        dietaryRestrictions: petData.dietaryRestrictions || undefined,
        spayedNeutered: petData.isSpayedNeutered,
        medicalHistory: {
          allergies: petData.allergies || [],
          chronicConditions: petData.chronicConditions || [],
          currentMedications: petData.currentMedications || [],
          temperament: petData.temperament || undefined,
          activityLevel: petData.activityLevel || undefined,
          isGoodWithKids: petData.isGoodWithKids,
          isGoodWithOtherPets: petData.isGoodWithOtherPets,
          coatType: petData.coatType || undefined,
          eyeColor: petData.eyeColor || undefined,
          distinguishingMarks: petData.distinguishingMarks || undefined,
          bloodType: petData.bloodType || undefined,
          hasInsurance: petData.hasInsurance,
          insuranceProvider: petData.insuranceProvider || undefined,
          insurancePolicyNumber: petData.insurancePolicyNumber || undefined,
          emergencyVetName: petData.emergencyVetName || undefined,
          emergencyVetPhone: petData.emergencyVetPhone || undefined,
        },
      };

      if (editPet) {
        await apiClient.put(`/pets/${editPet.id}`, payload);
      } else {
        await apiClient.post('/pets', payload);
      }

      toast.success(`${petData.name} ${editPet ? 'updated' : 'added'} successfully!`);
      onSuccess();
      onClose();
    } catch (error: unknown) {
      console.error('Error saving pet:', error);
      toast.error(addPetErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  // Step indicator
  const steps: { key: Step; label: string; icon: React.ReactNode }[] = [
    { key: 'photo', label: 'Photo', icon: <Camera className="w-4 h-4" /> },
    { key: 'basic', label: 'Basic', icon: <Dog className="w-4 h-4" /> },
    { key: 'physical', label: 'Physical', icon: <Heart className="w-4 h-4" /> },
    { key: 'health', label: 'Health', icon: <Shield className="w-4 h-4" /> },
    { key: 'vaccinations', label: 'Vaccines', icon: <Syringe className="w-4 h-4" /> },
    { key: 'behavior', label: 'Behavior', icon: <Star className="w-4 h-4" /> },
    { key: 'review', label: 'Review', icon: <Check className="w-4 h-4" /> },
  ];

  const currentStepIndex = steps.findIndex(s => s.key === step);

  if (!isOpen) return null;

  return (
    <div
      className={
        isModal
          ? 'fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-end justify-center'
          : 'fixed inset-0 z-[100] flex flex-col bg-white min-h-[100dvh]'
      }
    >
      <div 
        className={
          isModal
            ? 'bg-white w-full max-w-lg rounded-t-3xl flex flex-col'
            : 'bg-white w-full max-w-customer mx-auto flex flex-col flex-1 min-h-0'
        }
        style={
          isModal
            ? { height: '95vh', maxHeight: '95vh' }
            : { height: '100%', maxHeight: '100dvh', minHeight: '100dvh' }
        }
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className={`bg-gradient-to-r from-orange-500 via-amber-500 to-orange-400 p-5 flex-shrink-0 ${isModal ? 'rounded-t-3xl' : ''}`}>
          <div className="flex items-center justify-between mb-4 gap-2">
            <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
              {!isModal && (
                <button
                  type="button"
                  onClick={handleHeaderDismiss}
                  className="w-10 h-10 shrink-0 bg-white/20 backdrop-blur rounded-full flex items-center justify-center hover:bg-white/30 transition"
                  aria-label="Back"
                >
                  <ChevronLeft className="w-5 h-5 text-white" />
                </button>
              )}
              <div className="w-12 h-12 shrink-0 bg-white/20 backdrop-blur rounded-xl flex items-center justify-center">
                {petData.type === 'Dog' ? <Dog className="w-7 h-7 text-white" /> : <Cat className="w-7 h-7 text-white" />}
              </div>
              <div className="min-w-0">
                <h2 className="text-xl font-bold text-white truncate">
                  {editPet ? 'Edit Pet' : 'Add New Pet'}
                </h2>
                <p className="text-white/80 text-sm truncate">
                  {petData.name || 'Your furry friend'}
                </p>
              </div>
            </div>
            {isModal ? (
              <button
                type="button"
                onClick={onClose}
                className="w-10 h-10 shrink-0 bg-white/20 backdrop-blur rounded-full flex items-center justify-center hover:bg-white/30 transition"
                aria-label="Close"
              >
                <X className="w-5 h-5 text-white" />
              </button>
            ) : null}
          </div>
          
          {/* Step Progress */}
          <div className="flex items-center justify-between">
            {steps.map((s, index) => (
              <div key={s.key} className="flex items-center flex-1">
                <button
                  onClick={() => index < currentStepIndex && setStep(s.key)}
                  disabled={index > currentStepIndex}
                  className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                    step === s.key
                      ? 'bg-white text-orange-500 shadow-lg scale-110'
                      : index < currentStepIndex
                      ? 'bg-green-400 text-white'
                      : 'bg-white/30 text-white/70'
                  }`}
                >
                  {index < currentStepIndex ? <Check className="w-4 h-4" /> : s.icon}
                </button>
                {index < steps.length - 1 && (
                  <div className={`h-1 flex-1 mx-1 rounded-full ${
                    index < currentStepIndex ? 'bg-green-400' : 'bg-white/30'
                  }`} />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Content - pb-32 ensures Coat Type and bottom fields scroll above any fixed UI */}
        <div className="flex-1 overflow-y-auto p-5 pb-32">
          {/* Step 1: Photo */}
          {step === 'photo' && (
            <div className="space-y-6">
              <div className="text-center">
                <h3 className="text-xl font-bold text-gray-900 mb-2">Upload Pet Photo</h3>
                <p className="text-gray-600 text-sm">
                  A clear photo helps us identify your pet and provide better service
                </p>
              </div>
              
              <div className="flex flex-col items-center">
                <label
                  htmlFor="enhanced-add-pet-photo-input"
                  className={`relative flex w-48 h-48 rounded-3xl overflow-hidden border-4 transition-all ${
                    uploadingPhoto ? 'pointer-events-none cursor-default' : 'cursor-pointer'
                  } ${
                    validationErrors.photo 
                      ? 'border-red-400 bg-red-50' 
                      : photoPreview 
                      ? 'border-green-400 bg-green-50' 
                      : 'border-dashed border-orange-300 bg-orange-50 hover:border-orange-400'
                  }`}
                >
                  {photoPreview ? (
                    <>
                      <img src={photoPreview} alt="Pet" className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center">
                        <Camera className="w-8 h-8 text-white" />
                        <span className="text-white text-sm ml-2">Change</span>
                      </div>
                    </>
                  ) : uploadingPhoto ? (
                    <div className="flex flex-col items-center justify-center h-full w-full">
                      <div className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
                      <p className="mt-3 text-sm text-gray-600">Uploading... {uploadProgress}%</p>
                      <div className="mt-2 w-40 bg-gray-200 rounded-full h-1.5">
                        <div
                          className="bg-orange-500 h-1.5 rounded-full transition-all duration-300"
                          style={{ width: `${uploadProgress}%` }}
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full w-full">
                      <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mb-3">
                        <Camera className="w-8 h-8 text-orange-500" />
                      </div>
                      <p className="text-sm font-medium text-gray-700">Tap to upload</p>
                      <p className="text-xs text-gray-500 mt-1">JPG, PNG up to 5MB</p>
                    </div>
                  )}
                </label>
                
                <input
                  id="enhanced-add-pet-photo-input"
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoUpload}
                  disabled={uploadingPhoto}
                  className="sr-only"
                />
                
                {validationErrors.photo && (
                  <p className="text-red-500 text-sm mt-2 flex items-center gap-1">
                    <AlertCircle className="w-4 h-4" />
                    {validationErrors.photo}
                  </p>
                )}
                
                {photoPreview && (
                  <Badge className="mt-4 bg-green-100 text-green-700">
                    <Check className="w-3 h-3 mr-1" />
                    Photo uploaded
                  </Badge>
                )}
              </div>
              
              {/* Pet Type Selection */}
              <div className="pt-4">
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  What type of pet? <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-2 gap-4">
                  {(['Dog', 'Cat'] as const).map((type) => (
                    <button
                      key={type}
                      onClick={() => setPetData(prev => ({ ...prev, type, breed: '' }))}
                      className={`p-4 rounded-2xl border-2 transition-all ${
                        petData.type === type
                          ? 'border-orange-500 bg-orange-50'
                          : 'border-gray-200 hover:border-orange-300'
                      }`}
                    >
                      <span className="block mb-2">{type === 'Dog' ? <Dog className="w-10 h-10 text-orange-500 mx-auto" /> : <Cat className="w-10 h-10 text-orange-500 mx-auto" />}</span>
                      <span className="font-medium text-gray-900">{type}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Basic Info */}
          {step === 'basic' && (
            <div className="space-y-5">
              <div className="text-center mb-6">
                <h3 className="text-xl font-bold text-gray-900">Basic Information</h3>
                <p className="text-gray-600 text-sm">Tell us about your {petData.type.toLowerCase()}</p>
              </div>
              
              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Pet Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={petData.name}
                  onChange={(e) => setPetData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g., Buddy, Max, Luna"
                  className={`w-full px-4 py-3 border-2 rounded-xl focus:outline-none transition ${
                    validationErrors.name ? 'border-red-400' : 'border-gray-200 focus:border-orange-400'
                  }`}
                />
                {validationErrors.name && (
                  <p className="text-red-500 text-xs mt-1">{validationErrors.name}</p>
                )}
              </div>
              
              {/* Breed */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Breed <span className="text-red-500">*</span>
                </label>
                <select
                  value={petData.breed}
                  onChange={(e) => setPetData(prev => ({ ...prev, breed: e.target.value }))}
                  className={`w-full px-4 py-3 border-2 rounded-xl focus:outline-none transition ${
                    validationErrors.breed ? 'border-red-400' : 'border-gray-200 focus:border-orange-400'
                  }`}
                >
                  <option value="">Select breed</option>
                  {(petData.type === 'Dog' ? DOG_BREEDS : CAT_BREEDS).map(breed => (
                    <option key={breed} value={breed}>{breed}</option>
                  ))}
                </select>
              </div>
              
              {/* Date of Birth */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Date of Birth <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={petData.dateOfBirth}
                  max={new Date().toISOString().split('T')[0]}
                  onChange={(e) => setPetData(prev => ({ ...prev, dateOfBirth: e.target.value }))}
                  className={`w-full px-4 py-3 border-2 rounded-xl focus:outline-none transition ${
                    validationErrors.dateOfBirth ? 'border-red-400' : 'border-gray-200 focus:border-orange-400'
                  }`}
                />
                {petData.dateOfBirth && (
                  <p className="text-sm text-green-600 mt-1">
                    Age: {calculateAge(petData.dateOfBirth)}
                  </p>
                )}
              </div>
              
              {/* Gender */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Gender <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-2 gap-3">
                  {(['Male', 'Female'] as const).map((gender) => (
                    <button
                      key={gender}
                      onClick={() => setPetData(prev => ({ ...prev, gender }))}
                      className={`py-3 px-4 rounded-xl border-2 font-medium transition ${
                        petData.gender === gender
                          ? 'border-orange-500 bg-orange-50 text-orange-700'
                          : 'border-gray-200 text-gray-700 hover:border-orange-300'
                      }`}
                    >
                      {gender}
                    </button>
                  ))}
                </div>
              </div>
              
              {/* Microchip ID */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Microchip ID <span className="text-gray-400 text-xs">(Optional)</span>
                </label>
                <input
                  type="text"
                  value={petData.microchipId}
                  onChange={(e) => setPetData(prev => ({ ...prev, microchipId: e.target.value }))}
                  placeholder="15-digit microchip number"
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-orange-400 focus:outline-none"
                />
              </div>
            </div>
          )}

          {/* Step 3: Physical Characteristics */}
          {step === 'physical' && (
            <div className="space-y-5">
              <div className="text-center mb-6">
                <h3 className="text-xl font-bold text-gray-900">Physical Details</h3>
                <p className="text-gray-600 text-sm">Help us know {petData.name || 'your pet'} better</p>
              </div>
              
              {/* Weight */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Weight (kg) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={petData.weight}
                  onChange={(e) => setPetData(prev => ({ ...prev, weight: e.target.value }))}
                  placeholder="e.g., 12.5"
                  className={`w-full px-4 py-3 border-2 rounded-xl focus:outline-none transition ${
                    validationErrors.weight ? 'border-red-400' : 'border-gray-200 focus:border-orange-400'
                  }`}
                />
              </div>
              
              {/* Size */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Size
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {(['Small', 'Medium', 'Large', 'Giant'] as const).map((size) => (
                    <button
                      key={size}
                      onClick={() => setPetData(prev => ({ ...prev, size }))}
                      className={`py-3 rounded-xl border-2 text-sm font-medium transition ${
                        petData.size === size
                          ? 'border-orange-500 bg-orange-50 text-orange-700'
                          : 'border-gray-200 text-gray-600 hover:border-orange-300'
                      }`}
                    >
                      {size}
                    </button>
                  ))}
                </div>
              </div>
              
              {/* Color */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Color/Coat <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={petData.color}
                  onChange={(e) => setPetData(prev => ({ ...prev, color: e.target.value }))}
                  placeholder="e.g., Golden, Black & White, Tabby"
                  className={`w-full px-4 py-3 border-2 rounded-xl focus:outline-none transition ${
                    validationErrors.color ? 'border-red-400' : 'border-gray-200 focus:border-orange-400'
                  }`}
                />
              </div>
              
              {/* Coat Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Coat Type
                </label>
                <select
                  value={petData.coatType}
                  onChange={(e) => setPetData(prev => ({ ...prev, coatType: e.target.value }))}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-orange-400 focus:outline-none"
                >
                  <option value="">Select coat type</option>
                  <option value="Short">Short</option>
                  <option value="Medium">Medium</option>
                  <option value="Long">Long</option>
                  <option value="Double">Double Coat</option>
                  <option value="Curly">Curly</option>
                  <option value="Wire">Wire/Rough</option>
                  <option value="Hairless">Hairless</option>
                </select>
              </div>
              
              {/* Distinguishing Marks */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Distinguishing Marks
                </label>
                <textarea
                  value={petData.distinguishingMarks}
                  onChange={(e) => setPetData(prev => ({ ...prev, distinguishingMarks: e.target.value }))}
                  placeholder="e.g., White patch on chest, scar on left ear"
                  rows={2}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-orange-400 focus:outline-none resize-none"
                />
              </div>
            </div>
          )}

          {/* Step 4: Health */}
          {step === 'health' && (
            <div className="space-y-5">
              <div className="text-center mb-6">
                <h3 className="text-xl font-bold text-gray-900">Health Information</h3>
                <p className="text-gray-600 text-sm">Important for veterinary care</p>
              </div>
              
              {/* Spayed/Neutered */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Spayed/Neutered
                </label>
                <div className="grid grid-cols-2 gap-3">
                  {[true, false].map((value) => (
                    <button
                      key={String(value)}
                      onClick={() => setPetData(prev => ({ ...prev, isSpayedNeutered: value }))}
                      className={`py-3 rounded-xl border-2 font-medium transition ${
                        petData.isSpayedNeutered === value
                          ? 'border-orange-500 bg-orange-50 text-orange-700'
                          : 'border-gray-200 text-gray-600 hover:border-orange-300'
                      }`}
                    >
                      {value ? 'Yes' : 'No'}
                    </button>
                  ))}
                </div>
              </div>
              
              {/* Allergies */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Known Allergies
                </label>
                <div className="flex gap-2 mb-2">
                  <input
                    type="text"
                    value={newAllergy}
                    onChange={(e) => setNewAllergy(e.target.value)}
                    placeholder="e.g., Chicken, Pollen"
                    className="flex-1 px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-orange-400 focus:outline-none"
                  />
                  <Button
                    onClick={() => {
                      if (newAllergy.trim()) {
                        setPetData(prev => ({ ...prev, allergies: [...prev.allergies, newAllergy.trim()] }));
                        setNewAllergy('');
                      }
                    }}
                    className="bg-orange-500 hover:bg-orange-600 rounded-xl"
                  >
                    <Plus className="w-5 h-5" />
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {petData.allergies.map((allergy, i) => (
                    <Badge key={i} className="bg-red-100 text-red-700 px-3 py-1">
                      {allergy}
                      <button onClick={() => setPetData(prev => ({
                        ...prev,
                        allergies: prev.allergies.filter((_, idx) => idx !== i)
                      }))}>
                        <X className="w-3 h-3 ml-2" />
                      </button>
                    </Badge>
                  ))}
                </div>
              </div>
              
              {/* Current Medications */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Current Medications
                </label>
                <div className="flex gap-2 mb-2">
                  <input
                    type="text"
                    value={newMedication}
                    onChange={(e) => setNewMedication(e.target.value)}
                    placeholder="e.g., Apoquel 16mg"
                    className="flex-1 px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-orange-400 focus:outline-none"
                  />
                  <Button
                    onClick={() => {
                      if (newMedication.trim()) {
                        setPetData(prev => ({ ...prev, currentMedications: [...prev.currentMedications, newMedication.trim()] }));
                        setNewMedication('');
                      }
                    }}
                    className="bg-orange-500 hover:bg-orange-600 rounded-xl"
                  >
                    <Plus className="w-5 h-5" />
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {petData.currentMedications.map((med, i) => (
                    <Badge key={i} className="bg-blue-100 text-blue-700 px-3 py-1">
                      {med}
                      <button onClick={() => setPetData(prev => ({
                        ...prev,
                        currentMedications: prev.currentMedications.filter((_, idx) => idx !== i)
                      }))}>
                        <X className="w-3 h-3 ml-2" />
                      </button>
                    </Badge>
                  ))}
                </div>
              </div>
              
              {/* Chronic Conditions */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Chronic Conditions
                </label>
                <div className="flex gap-2 mb-2">
                  <input
                    type="text"
                    value={newCondition}
                    onChange={(e) => setNewCondition(e.target.value)}
                    placeholder="e.g., Diabetes, Hip Dysplasia"
                    className="flex-1 px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-orange-400 focus:outline-none"
                  />
                  <Button
                    onClick={() => {
                      if (newCondition.trim()) {
                        setPetData(prev => ({ ...prev, chronicConditions: [...prev.chronicConditions, newCondition.trim()] }));
                        setNewCondition('');
                      }
                    }}
                    className="bg-orange-500 hover:bg-orange-600 rounded-xl"
                  >
                    <Plus className="w-5 h-5" />
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {petData.chronicConditions.map((cond, i) => (
                    <Badge key={i} className="bg-purple-100 text-purple-700 px-3 py-1">
                      {cond}
                      <button onClick={() => setPetData(prev => ({
                        ...prev,
                        chronicConditions: prev.chronicConditions.filter((_, idx) => idx !== i)
                      }))}>
                        <X className="w-3 h-3 ml-2" />
                      </button>
                    </Badge>
                  ))}
                </div>
              </div>
              
              {/* Insurance */}
              <div className="bg-blue-50 rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Shield className="w-5 h-5 text-blue-600" />
                    <span className="font-medium text-blue-900">Pet Insurance</span>
                  </div>
                  <button
                    onClick={() => setPetData(prev => ({ ...prev, hasInsurance: !prev.hasInsurance }))}
                    className={`w-12 h-6 rounded-full transition-colors ${
                      petData.hasInsurance ? 'bg-blue-500' : 'bg-gray-300'
                    }`}
                  >
                    <div className={`w-5 h-5 bg-white rounded-full shadow transition-transform ${
                      petData.hasInsurance ? 'translate-x-6' : 'translate-x-0.5'
                    }`} />
                  </button>
                </div>
                
                {petData.hasInsurance && (
                  <div className="space-y-3 pt-2">
                    <input
                      type="text"
                      value={petData.insuranceProvider}
                      onChange={(e) => setPetData(prev => ({ ...prev, insuranceProvider: e.target.value }))}
                      placeholder="Insurance provider name"
                      className="w-full px-3 py-2 border border-blue-200 rounded-lg focus:border-blue-400 focus:outline-none bg-white"
                    />
                    <input
                      type="text"
                      value={petData.insurancePolicyNumber}
                      onChange={(e) => setPetData(prev => ({ ...prev, insurancePolicyNumber: e.target.value }))}
                      placeholder="Policy number"
                      className="w-full px-3 py-2 border border-blue-200 rounded-lg focus:border-blue-400 focus:outline-none bg-white"
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Step 5: Vaccinations */}
          {step === 'vaccinations' && (
            <div className="space-y-5">
              <div className="text-center mb-6">
                <h3 className="text-xl font-bold text-gray-900">Vaccination records</h3>
                <p className="text-gray-600 text-sm mt-1 px-1">
                  Add each vaccine your pet has received. Pick a <span className="font-medium text-gray-800">date last given</span>{' '}
                  so we can estimate the next due date and send reminders.
                </p>
              </div>

              <div>
                <span className="block text-sm font-medium text-gray-700 mb-3">Vaccines for {petData.type}s</span>
                <div className="space-y-3">
                  {VACCINATION_TEMPLATES[petData.type].map((tmpl) => {
                    const isAdded = petData.vaccinations.some((v) => v.vaccineKey === tmpl.key);
                    const record = petData.vaccinations.find((v) => v.vaccineKey === tmpl.key);
                    const dateInputId = `vax-date-${tmpl.key}`;
                    return (
                      <div
                        key={tmpl.key}
                        className={`p-4 rounded-xl border-2 transition ${
                          isAdded ? 'border-green-300 bg-green-50' : 'border-gray-200 bg-white'
                        }`}
                      >
                        <h4 className="font-semibold text-gray-900 text-base mb-1">{tmpl.displayName}</h4>
                        <p className="text-sm text-gray-600 leading-relaxed mb-3">{tmpl.description}</p>

                        {!isAdded && (
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:gap-3">
                            <div className="flex flex-col gap-1.5 flex-1 min-w-0">
                              <label htmlFor={dateInputId} className="text-sm font-medium text-gray-700 shrink-0">
                                Date last given
                              </label>
                              <div className="warmpawz-date-field-wrap">
                                <input
                                  id={dateInputId}
                                  type="date"
                                  max={new Date().toISOString().split('T')[0]}
                                  value={pendingVaxDates[tmpl.key] ?? ''}
                                  onChange={(e) => {
                                    setPendingVaxDates((prev) => ({
                                      ...prev,
                                      [tmpl.key]: e.target.value,
                                    }));
                                  }}
                                  className="w-full sm:max-w-xs px-3 py-2 border border-gray-200 rounded-lg text-sm focus:border-orange-400 focus:outline-none focus:ring-1 focus:ring-orange-300 bg-white"
                                />
                              </div>
                            </div>
                            <button
                              type="button"
                              disabled={!pendingVaxDates[tmpl.key]}
                              onClick={() => confirmVaccinationDate(tmpl, pendingVaxDates[tmpl.key])}
                              className="shrink-0 px-4 py-2 rounded-lg text-sm font-medium bg-orange-500 text-white disabled:opacity-40 disabled:cursor-not-allowed hover:bg-orange-600 focus:outline-none focus:ring-2 focus:ring-orange-300"
                            >
                              Add record
                            </button>
                          </div>
                        )}

                        {isAdded && record && (
                          <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-gray-700">
                            <span>
                              <span className="text-gray-500">Last given:</span>{' '}
                              <span className="font-medium text-gray-900">{record.lastDate}</span>
                            </span>
                            <span className="text-orange-600 font-medium">
                              Next due: {record.nextDueDate}
                            </span>
                            <button
                              type="button"
                              onClick={() => removeVaccination(record.id)}
                              className="text-red-500 hover:text-red-600 p-1 rounded-md focus:outline-none focus:ring-2 focus:ring-red-300"
                              aria-label={`Remove ${tmpl.displayName}`}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                <div className="flex items-start gap-3">
                  <Bell className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-amber-900">Vaccination reminders</p>
                    <p className="text-xs text-amber-700 mt-1">
                      We&apos;ll send you reminders when vaccinations are due. Keep dates accurate so timing stays
                      helpful for your vet and sitters.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 6: Behavior */}
          {step === 'behavior' && (
            <div className="space-y-5">
              <div className="text-center mb-6">
                <h3 className="text-xl font-bold text-gray-900">Behavior & Personality</h3>
                <p className="text-gray-600 text-sm">Helps service providers prepare</p>
              </div>
              
              {/* Activity Level */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Activity Level
                </label>
                <div className="grid grid-cols-3 gap-3">
                  {(['Low', 'Medium', 'High'] as const).map((level) => (
                    <button
                      key={level}
                      onClick={() => setPetData(prev => ({ ...prev, activityLevel: level }))}
                      className={`py-3 rounded-xl border-2 font-medium transition ${
                        petData.activityLevel === level
                          ? 'border-orange-500 bg-orange-50 text-orange-700'
                          : 'border-gray-200 text-gray-600 hover:border-orange-300'
                      }`}
                    >
                      {level}
                    </button>
                  ))}
                </div>
              </div>
              
              {/* Temperament */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Temperament
                </label>
                <select
                  value={petData.temperament}
                  onChange={(e) => setPetData(prev => ({ ...prev, temperament: e.target.value }))}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-orange-400 focus:outline-none"
                >
                  <option value="">Select temperament</option>
                  <option value="Calm">Calm & Relaxed</option>
                  <option value="Playful">Playful & Energetic</option>
                  <option value="Friendly">Friendly & Social</option>
                  <option value="Shy">Shy & Reserved</option>
                  <option value="Protective">Protective & Alert</option>
                  <option value="Independent">Independent</option>
                  <option value="Anxious">Anxious & Nervous</option>
                </select>
              </div>
              
              {/* Good with Kids */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Good with Children?
                </label>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { value: true, label: 'Yes' },
                    { value: false, label: 'No' },
                    { value: undefined, label: 'Unknown' },
                  ].map((opt) => (
                    <button
                      key={String(opt.value)}
                      onClick={() => setPetData(prev => ({ ...prev, isGoodWithKids: opt.value }))}
                      className={`py-3 rounded-xl border-2 text-sm font-medium transition ${
                        petData.isGoodWithKids === opt.value
                          ? 'border-orange-500 bg-orange-50 text-orange-700'
                          : 'border-gray-200 text-gray-600 hover:border-orange-300'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
              
              {/* Good with Other Pets */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Good with Other Pets?
                </label>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { value: true, label: 'Yes' },
                    { value: false, label: 'No' },
                    { value: undefined, label: 'Unknown' },
                  ].map((opt) => (
                    <button
                      key={String(opt.value)}
                      onClick={() => setPetData(prev => ({ ...prev, isGoodWithOtherPets: opt.value }))}
                      className={`py-3 rounded-xl border-2 text-sm font-medium transition ${
                        petData.isGoodWithOtherPets === opt.value
                          ? 'border-orange-500 bg-orange-50 text-orange-700'
                          : 'border-gray-200 text-gray-600 hover:border-orange-300'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
              
              {/* Special Needs */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Special Needs / Notes
                </label>
                <textarea
                  value={petData.specialNeeds}
                  onChange={(e) => setPetData(prev => ({ ...prev, specialNeeds: e.target.value }))}
                  placeholder="e.g., Needs slow introduction, scared of loud noises"
                  rows={3}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-orange-400 focus:outline-none resize-none"
                />
              </div>
            </div>
          )}

          {/* Step 7: Review */}
          {step === 'review' && (
            <div className="space-y-4">
              <div className="text-center mb-6">
                <h3 className="text-xl font-bold text-gray-900">Review & Confirm</h3>
                <p className="text-gray-600 text-sm">Make sure everything looks good</p>
              </div>
              
              {/* Pet Card Preview */}
              <div className="bg-gradient-to-br from-orange-50 to-amber-50 rounded-2xl p-5 border border-orange-200">
                <div className="flex items-start gap-4">
                  <div className="w-20 h-20 rounded-xl overflow-hidden border-2 border-white shadow-lg flex-shrink-0">
                    {photoPreview ? (
                      <img src={photoPreview} alt={petData.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full bg-gray-200 flex items-center justify-center">
                        {petData.type === 'Dog' ? <Dog className="w-8 h-8 text-gray-500" /> : <Cat className="w-8 h-8 text-gray-500" />}
                      </div>
                    )}
                  </div>
                  <div className="flex-1">
                    <h4 className="text-xl font-bold text-gray-900">{petData.name || 'Unnamed Pet'}</h4>
                    <p className="text-gray-600">{petData.breed} • {petData.gender}</p>
                    <p className="text-sm text-gray-500">
                      {calculateAge(petData.dateOfBirth)} old • {petData.weight}kg
                    </p>
                  </div>
                </div>
              </div>
              
              {/* Quick Stats */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-white rounded-xl p-3 border">
                  <p className="text-xs text-gray-500">Vaccinations</p>
                  <p className="font-bold text-gray-900">{petData.vaccinations.length} recorded</p>
                </div>
                <div className="bg-white rounded-xl p-3 border">
                  <p className="text-xs text-gray-500">Status</p>
                  <p className="font-bold text-gray-900">
                    {petData.isSpayedNeutered ? 'Spayed/Neutered' : 'Intact'}
                  </p>
                </div>
                <div className="bg-white rounded-xl p-3 border">
                  <p className="text-xs text-gray-500">Activity</p>
                  <p className="font-bold text-gray-900">{petData.activityLevel}</p>
                </div>
                <div className="bg-white rounded-xl p-3 border">
                  <p className="text-xs text-gray-500">Insurance</p>
                  <p className="font-bold text-gray-900">
                    {petData.hasInsurance ? petData.insuranceProvider || 'Yes' : 'No'}
                  </p>
                </div>
              </div>
              
              {/* Health Alerts */}
              {(petData.allergies.length > 0 || petData.chronicConditions.length > 0) && (
                <div className="bg-red-50 rounded-xl p-4 border border-red-200">
                  <p className="text-sm font-medium text-red-800 mb-2 flex items-center gap-1"><AlertCircle className="w-4 h-4" /> Health Alerts</p>
                  {petData.allergies.length > 0 && (
                    <p className="text-sm text-red-700">
                      <span className="font-medium">Allergies:</span> {petData.allergies.join(', ')}
                    </p>
                  )}
                  {petData.chronicConditions.length > 0 && (
                    <p className="text-sm text-red-700">
                      <span className="font-medium">Conditions:</span> {petData.chronicConditions.join(', ')}
                    </p>
                  )}
                </div>
              )}
              
              {/* Upcoming Vaccinations */}
              {petData.vaccinations.length > 0 && (
                <div className="bg-blue-50 rounded-xl p-4 border border-blue-200">
                  <p className="text-sm font-medium text-blue-800 mb-2">📅 Upcoming Vaccinations</p>
                  {petData.vaccinations.slice(0, 3).map((vax) => (
                    <p key={vax.id} className="text-sm text-blue-700">
                      <span className="font-medium">{vax.name}:</span> Due {vax.nextDueDate}
                    </p>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Navigation */}
        <div className="flex-shrink-0 p-5 bg-white border-t border-gray-100">
          <div className="flex gap-3">
            {step !== 'photo' && (
              <Button
                onClick={prevStep}
                variant="outline"
                className="flex-1 h-12 rounded-xl border-2"
                disabled={loading}
              >
                <ChevronLeft className="w-5 h-5 mr-1" />
                Back
              </Button>
            )}
            
            {step === 'review' ? (
              <Button
                onClick={handleSavePet}
                disabled={loading}
                className="flex-1 h-12 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 rounded-xl text-white font-bold"
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Saving...
                  </span>
                ) : (
                  <>
                    <Check className="w-5 h-5 mr-2" />
                    {editPet ? 'Update Pet' : 'Add Pet'}
                  </>
                )}
              </Button>
            ) : (
              <Button
                onClick={nextStep}
                className="flex-1 h-12 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 rounded-xl text-white font-bold"
              >
                Next
                <ChevronRight className="w-5 h-5 ml-1" />
              </Button>
            )}
          </div>
          
          {step !== 'photo' && step !== 'review' && (
            <button
              onClick={handleSavePet}
              disabled={loading}
              className="w-full mt-3 text-sm text-gray-500 hover:text-orange-600 font-medium"
            >
              Skip remaining & Save
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default EnhancedAddPetModal;
