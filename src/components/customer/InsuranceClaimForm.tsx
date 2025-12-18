import React, { useState } from 'react';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { ArrowLeft, Upload, FileText, X } from 'lucide-react';
import { toast } from 'sonner@2.0.3';
import { projectId, publicAnonKey } from '../../utils/supabase/info';
// Brand color: #FF8C42

interface InsuranceClaimFormProps {
  policyId: string;
  onBack: () => void;
  onSuccess: () => void;
}

export function InsuranceClaimForm({ policyId, onBack, onSuccess }: InsuranceClaimFormProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    claimType: 'illness',
    incidentDate: new Date().toISOString().split('T')[0],
    claimAmount: '',
    description: '',
    veterinarianName: '',
    clinicName: ''
  });
  const [documents, setDocuments] = useState<File[]>([]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setDocuments([...documents, ...Array.from(e.target.files)]);
    }
  };

  const removeFile = (index: number) => {
    setDocuments(documents.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!formData.claimAmount || !formData.description || documents.length === 0) {
      toast.error('Please fill all fields and upload evidence.');
      return;
    }

    try {
      setLoading(true);

      // 1. Simulate file uploads and get URLs
      const uploadedDocs = documents.map(file => ({
        documentId: `DOC-${Math.random().toString(36).substr(2, 9)}`,
        documentType: 'medical_bill', // simplified
        fileName: file.name,
        fileUrl: `https://fake-s3.com/${file.name}`,
        uploadedAt: new Date().toISOString()
      }));

      // 2. Submit Claim
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/insurance/claim/file`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${publicAnonKey}`
          },
          body: JSON.stringify({
            policyId,
            ...formData,
            claimAmount: Number(formData.claimAmount),
            documents: uploadedDocs
          })
        }
      );

      if (response.ok) {
        toast.success('Claim submitted successfully!');
        onSuccess();
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to submit claim');
      }

    } catch (error) {
      console.error('Claim submission error:', error);
      toast.error('Error submitting claim');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <div className="bg-white p-4 border-b sticky top-0 z-10 flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft className="w-6 h-6" />
        </Button>
        <h1 className="text-lg font-bold text-gray-900">File a Claim</h1>
      </div>

      <div className="p-4 flex-1 space-y-6 pb-24">
        <Card className="p-4 space-y-4">
            <h3 className="font-semibold text-gray-900">Incident Details</h3>
            
            <div>
                <Label>Claim Type</Label>
                <select 
                    className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm mt-1"
                    value={formData.claimType}
                    onChange={(e) => setFormData({...formData, claimType: e.target.value})}
                >
                    <option value="illness">Illness</option>
                    <option value="accident">Accident</option>
                    <option value="surgery">Surgery</option>
                    <option value="dental">Dental</option>
                    <option value="vaccination">Vaccination</option>
                </select>
            </div>

            <div>
                <Label>Incident Date</Label>
                <Input 
                    type="date"
                    value={formData.incidentDate}
                    onChange={(e) => setFormData({...formData, incidentDate: e.target.value})}
                    max={new Date().toISOString().split('T')[0]}
                />
            </div>

            <div>
                <Label>Total Bill Amount (₹)</Label>
                <Input 
                    type="number"
                    placeholder="e.g. 5000"
                    value={formData.claimAmount}
                    onChange={(e) => setFormData({...formData, claimAmount: e.target.value})}
                />
            </div>

            <div>
                <Label>Description</Label>
                <Textarea 
                    placeholder="Describe diagnosis, treatment, etc."
                    value={formData.description}
                    onChange={(e) => setFormData({...formData, description: e.target.value})}
                />
            </div>
        </Card>

        <Card className="p-4 space-y-4">
            <h3 className="font-semibold text-gray-900">Provider Details</h3>
            <div>
                <Label>Veterinarian Name</Label>
                <Input 
                    value={formData.veterinarianName}
                    onChange={(e) => setFormData({...formData, veterinarianName: e.target.value})}
                />
            </div>
            <div>
                <Label>Clinic / Hospital Name</Label>
                <Input 
                    value={formData.clinicName}
                    onChange={(e) => setFormData({...formData, clinicName: e.target.value})}
                />
            </div>
        </Card>

        <Card className="p-4 space-y-4">
            <h3 className="font-semibold text-gray-900">Evidence</h3>
            <p className="text-xs text-gray-500">Upload bills, prescriptions, and reports.</p>
            
            <div className="grid grid-cols-1 gap-2">
                {documents.map((file, i) => (
                    <div key={i} className="flex justify-between items-center p-2 bg-gray-50 rounded border">
                        <span className="text-sm truncate max-w-[200px]">{file.name}</span>
                        <button onClick={() => removeFile(i)}><X className="w-4 h-4 text-red-500" /></button>
                    </div>
                ))}
            </div>

            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 flex flex-col items-center justify-center cursor-pointer hover:bg-gray-50 relative">
                <Upload className="w-8 h-8 text-gray-400 mb-2" />
                <p className="text-sm text-gray-500">Tap to upload files</p>
                <input 
                    type="file" 
                    multiple 
                    className="absolute inset-0 opacity-0 cursor-pointer"
                    onChange={handleFileChange}
                    accept="image/*,.pdf"
                />
            </div>
        </Card>
      </div>

      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t shadow-lg z-20">
        <Button 
            className="w-full bg-orange-600 hover:bg-orange-700 h-12 text-lg"
            onClick={handleSubmit}
            disabled={loading}
        >
            {loading ? 'Submitting Claim...' : 'Submit Claim'}
        </Button>
      </div>
    </div>
  );
}
