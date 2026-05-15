'use client';

/**
 * ============================================================================
 * MEDICINE SELECTION SCREEN
 * ============================================================================
 * 
 * Two options:
 * 1. Upload Prescription - For prescribed medicines
 * 2. Browse Catalog - For counter medicines (OTC, Ayurvedic, Homeopathy)
 * 
 * ============================================================================
 */

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Upload, ShoppingCart, FileText, Pill, ArrowLeft, AlertCircle, CheckCircle2, X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

interface MedicineSelectionScreenProps {
  phone: string;
  onBack?: () => void;
  onSelectPrescription?: (prescriptionFile: File) => void;
  onBrowseCatalog?: () => void;
  prescriptionId?: string; // If coming from My Booking → Prescription
}

export function MedicineSelectionScreen({
  phone,
  onBack,
  onSelectPrescription,
  onBrowseCatalog,
  prescriptionId
}: MedicineSelectionScreenProps) {
  const [prescriptionFile, setPrescriptionFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      const validTypes = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf'];
      if (!validTypes.includes(file.type)) {
        toast.error('Please upload a valid image (JPG, PNG) or PDF file');
        return;
      }
      
      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        toast.error('File size should be less than 5MB');
        return;
      }
      
      setPrescriptionFile(file);
    }
  };

  const handleUploadPrescription = async () => {
    if (!prescriptionFile) {
      toast.error('Please select a prescription file');
      return;
    }

    setUploading(true);
    try {
      // Upload prescription to backend
      const formData = new FormData();
      formData.append('prescription', prescriptionFile);
      formData.append('phone', phone);
      if (prescriptionId) {
        formData.append('prescriptionId', prescriptionId);
      }

      // TODO: Call API to upload prescription
      // const response = await apiClient.post('/pharmacy/prescriptions/upload', formData);
      
      // For now, proceed with file
      if (onSelectPrescription) {
        onSelectPrescription(prescriptionFile);
      }
    } catch (error: any) {
      console.error('Error uploading prescription:', error);
      toast.error(error.message || 'Failed to upload prescription');
    } finally {
      setUploading(false);
    }
  };

  // If prescriptionId is provided, skip selection and go directly to prescription flow
  if (prescriptionId) {
    // This means user came from My Booking → Prescription
    // We'll handle this in the parent component
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 max-w-md mx-auto">
      {/* Header */}
      <div className="bg-gradient-to-br from-orange-500 to-orange-600 pb-6 pl-[max(1.5rem,env(safe-area-inset-left,0px))] pr-[max(1.5rem,env(safe-area-inset-right,0px))] text-white cw-header-safe-top">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="mb-4 flex min-h-[44px] items-center gap-2 text-white/90 hover:text-white touch-manipulation"
            aria-label="Go back"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>Back</span>
          </button>
        )}
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
            <Pill className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Order Medicine</h1>
            <p className="text-white/90 text-sm">Choose how you want to order</p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="px-6 py-6 space-y-4">
        {/* Prescription Upload Option */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card className="p-6 cursor-pointer hover:shadow-lg transition-shadow border-2 border-orange-100">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center flex-shrink-0">
                <FileText className="w-6 h-6 text-orange-600" />
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-lg text-gray-900 mb-1">Prescribed Medicines</h3>
                <p className="text-sm text-gray-600 mb-4">
                  Upload your prescription to order prescribed medicines
                </p>
                
                {!prescriptionFile ? (
                  <div>
                    <label className="block">
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/jpg,application/pdf"
                        onChange={handleFileSelect}
                        className="hidden"
                      />
                      <Button
                        variant="outline"
                        className="w-full border-orange-300 text-orange-600 hover:bg-orange-50"
                        asChild
                      >
                        <span>
                          <Upload className="w-4 h-4 mr-2" />
                          Choose Prescription File
                        </span>
                      </Button>
                    </label>
                    <p className="text-xs text-gray-500 mt-2 text-center">
                      JPG, PNG or PDF (Max 5MB)
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg">
                      <CheckCircle2 className="w-5 h-5 text-green-600" />
                      <span className="text-sm font-medium text-green-800 flex-1">
                        {prescriptionFile.name}
                      </span>
                      <button
                        onClick={() => setPrescriptionFile(null)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    <Button
                      onClick={handleUploadPrescription}
                      disabled={uploading}
                      className="w-full bg-orange-600 hover:bg-orange-700"
                    >
                      {uploading ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Uploading...
                        </>
                      ) : (
                        <>
                          <Upload className="w-4 h-4 mr-2" />
                          Upload & Continue
                        </>
                      )}
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </Card>
        </motion.div>

        {/* Divider */}
        <div className="flex items-center gap-4 my-6">
          <div className="flex-1 h-px bg-gray-200"></div>
          <span className="text-sm text-gray-500 font-medium">OR</span>
          <div className="flex-1 h-px bg-gray-200"></div>
        </div>

        {/* Catalog Browse Option */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card className="p-6 cursor-pointer hover:shadow-lg transition-shadow border-2 border-blue-100">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center flex-shrink-0">
                <ShoppingCart className="w-6 h-6 text-blue-600" />
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-lg text-gray-900 mb-1">Counter Medicines</h3>
                <p className="text-sm text-gray-600 mb-2">
                  Browse and buy OTC medicines, Ayurvedic, Homeopathy directly
                </p>
                <div className="flex flex-wrap gap-2 mb-4">
                  <Badge variant="secondary" className="text-xs">OTC</Badge>
                  <Badge variant="secondary" className="text-xs">Ayurvedic</Badge>
                  <Badge variant="secondary" className="text-xs">Homeopathy</Badge>
                </div>
                <Button
                  onClick={onBrowseCatalog}
                  className="w-full bg-blue-600 hover:bg-blue-700"
                >
                  <ShoppingCart className="w-4 h-4 mr-2" />
                  Browse Medicine Catalog
                </Button>
              </div>
            </div>
          </Card>
        </motion.div>

        {/* Info Alert */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
        >
          <Card className="p-4 bg-blue-50 border border-blue-200">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm text-blue-900">
                  <strong>Prescribed medicines</strong> require a valid prescription from a licensed veterinarian.
                  <br />
                  <strong>Counter medicines</strong> can be purchased directly without a prescription.
                </p>
              </div>
            </div>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
