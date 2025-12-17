import { useState, useEffect } from 'react';
import { Button } from '../ui/button';
import { ArrowLeft, Save, AlertCircle } from 'lucide-react';
import { DynamicVendorOnboardingForm } from './DynamicVendorOnboardingForm';
import { projectId, publicAnonKey } from '../../utils/supabase/info';
import { toast } from 'sonner@2.0.3';

interface VendorApplicationEditProps {
  vendorId: string;
  onSave: () => void;
  onCancel: () => void;
}

export function VendorApplicationEdit({ vendorId, onSave, onCancel }: VendorApplicationEditProps) {
  const [loading, setLoading] = useState(true);
  const [vendorData, setVendorData] = useState<any>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadVendorData();
  }, [vendorId]);

  const loadVendorData = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/vendor/status/${vendorId}`,
        {
          headers: { 'Authorization': `Bearer ${publicAnonKey}` }
        }
      );

      if (response.ok) {
        const data = await response.json();
        // Fetch full vendor data
        const vendorResponse = await fetch(
          `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/vendor/find-by-phone/${data.phone}`,
          {
            headers: { 'Authorization': `Bearer ${publicAnonKey}` }
          }
        );

        if (vendorResponse.ok) {
          const vendorDataResponse = await vendorResponse.json();
          setVendorData(vendorDataResponse.vendor);
        }
      }
    } catch (error) {
      console.error('Error loading vendor data:', error);
      toast.error('Failed to load application data');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (formData: any) => {
    try {
      setSubmitting(true);
      
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/vendor/application/${vendorId}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${publicAnonKey}`
          },
          body: JSON.stringify({
            formData: formData.formData,
            documents: formData.documents,
            location: formData.location
          })
        }
      );

      if (response.ok) {
        toast.success('Application updated successfully!');
        onSave();
      } else {
        const error = await response.json();
        toast.error(error.message || 'Failed to update application');
      }
    } catch (error) {
      console.error('Error updating application:', error);
      toast.error('An error occurred while updating');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white w-full max-w-[430px] mx-auto flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FF8C42]"></div>
      </div>
    );
  }

  if (!vendorData) {
    return (
      <div className="min-h-screen bg-white w-full max-w-[430px] mx-auto p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertCircle className="w-5 h-5 text-red-600" />
            <h3 className="font-semibold text-red-900">Application Not Found</h3>
          </div>
          <p className="text-sm text-red-700 mb-4">
            Unable to load application data. Please try again.
          </p>
          <Button onClick={onCancel} variant="outline" className="w-full">
            Go Back
          </Button>
        </div>
      </div>
    );
  }

  // Check if editing is allowed
  if (vendorData.status !== 'pending_approval' && vendorData.status !== 'more_info_required') {
    return (
      <div className="min-h-screen bg-white w-full max-w-[430px] mx-auto p-6">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertCircle className="w-5 h-5 text-yellow-600" />
            <h3 className="font-semibold text-yellow-900">Cannot Edit Application</h3>
          </div>
          <p className="text-sm text-yellow-700 mb-4">
            Your application is currently {vendorData.status}. Editing is only allowed for pending applications.
          </p>
          <Button onClick={onCancel} variant="outline" className="w-full">
            Go Back
          </Button>
        </div>
      </div>
    );
  }

  // Prepare initial data for form
  const initialData = {
    formData: {
      businessName: vendorData.businessName,
      fullName: vendorData.fullName,
      email: vendorData.email,
      phone: vendorData.phone,
      address: vendorData.address,
      city: vendorData.city,
      state: vendorData.state,
      pincode: vendorData.pincode,
      gstNumber: vendorData.gstNumber,
      yearsOfExperience: vendorData.yearsOfExperience,
      accountHolderName: vendorData.bankDetails?.accountHolderName,
      accountNumber: vendorData.bankDetails?.accountNumber,
      ifscCode: vendorData.bankDetails?.ifscCode,
      bankName: vendorData.bankDetails?.bankName,
      branchName: vendorData.bankDetails?.branchName,
      ...vendorData.customFields
    },
    documents: vendorData.documentsRaw || {},
    location: vendorData.location
  };

  return (
    <div className="min-h-screen bg-[#FFF5F1] w-full max-w-[430px] mx-auto">
      {/* Header */}
      <div className="pt-8 pb-4 px-6 bg-white border-b">
        <div className="flex items-center gap-4 mb-4">
          <button
            onClick={onCancel}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-gray-800" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Edit Application</h1>
            <p className="text-sm text-gray-500">Update your application details</p>
          </div>
        </div>
        
        {vendorData.status === 'more_info_required' && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <p className="text-sm text-blue-800 font-medium mb-1">
              Additional Information Required
            </p>
            {vendorData.infoRequestMessage && (
              <p className="text-xs text-blue-700">{vendorData.infoRequestMessage}</p>
            )}
            {vendorData.infoRequiredFields && vendorData.infoRequiredFields.length > 0 && (
              <div className="mt-2">
                <p className="text-xs text-blue-700 font-medium">Required fields:</p>
                <ul className="text-xs text-blue-600 list-disc list-inside mt-1">
                  {vendorData.infoRequiredFields.map((field: string, index: number) => (
                    <li key={index}>{field}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Form */}
      <DynamicVendorOnboardingForm
        roleId={vendorData.roleId}
        onSubmit={handleSubmit}
        onBack={onCancel}
        initialData={initialData}
        serviceStyles={[]}
      />
    </div>
  );
}

