import { useState } from 'react';
import { ArrowLeft, MapPin, Plus, X, Upload, User, Mail, Phone, Building2, CreditCard, Award, Briefcase, FileText } from 'lucide-react';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Card } from '../../ui/card';
import { Badge } from '../../ui/badge';
import { Label } from '../../ui/label';
import { Textarea } from '../../ui/textarea';

interface SoloProviderOnboardingProps {
  roleId: string;
  roleName: string;
  phone?: string;
  onSubmit: (data: any) => void;
  onBack: () => void;
  submitting: boolean;
}

export function SoloProviderOnboarding({
  roleId,
  roleName,
  phone: initialPhone,
  onSubmit,
  onBack,
  submitting
}: SoloProviderOnboardingProps) {
  // Basic Info
  const [ownerName, setOwnerName] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [phone, setPhone] = useState(initialPhone || '');
  const [email, setEmail] = useState('');

  // Documents
  const [panNumber, setPanNumber] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [ifscCode, setIfscCode] = useState('');
  const [accountHolderName, setAccountHolderName] = useState('');
  const [bankName, setBankName] = useState('');

  // Service Area
  const [serviceAreaType, setServiceAreaType] = useState<'RADIUS' | 'SPECIFIC_AREAS'>('RADIUS');
  const [radiusKm, setRadiusKm] = useState(10);
  const [specificAreas, setSpecificAreas] = useState<string[]>([]);
  const [newArea, setNewArea] = useState('');

  // Professional Info
  const [experience, setExperience] = useState(0);
  const [bio, setBio] = useState('');
  const [specializations, setSpecializations] = useState<string[]>([]);
  const [newSpecialization, setNewSpecialization] = useState('');

  // Operating Hours
  const [operatingHours, setOperatingHours] = useState({
    monday: { open: '09:00', close: '18:00', enabled: true },
    tuesday: { open: '09:00', close: '18:00', enabled: true },
    wednesday: { open: '09:00', close: '18:00', enabled: true },
    thursday: { open: '09:00', close: '18:00', enabled: true },
    friday: { open: '09:00', close: '18:00', enabled: true },
    saturday: { open: '09:00', close: '18:00', enabled: true },
    sunday: { open: '09:00', close: '18:00', enabled: false }
  });

  // Profile Photo
  const [profilePhoto, setProfilePhoto] = useState<string | null>(null);

  const handleAddArea = () => {
    if (newArea.trim() && !specificAreas.includes(newArea.trim())) {
      setSpecificAreas([...specificAreas, newArea.trim()]);
      setNewArea('');
    }
  };

  const handleRemoveArea = (area: string) => {
    setSpecificAreas(specificAreas.filter(a => a !== area));
  };

  const handleAddSpecialization = () => {
    if (newSpecialization.trim() && !specializations.includes(newSpecialization.trim())) {
      setSpecializations([...specializations, newSpecialization.trim()]);
      setNewSpecialization('');
    }
  };

  const handleRemoveSpecialization = (spec: string) => {
    setSpecializations(specializations.filter(s => s !== spec));
  };

  const handleSubmit = () => {
    // Validation
    if (!ownerName || !phone || !panNumber || !accountNumber || !ifscCode) {
      alert('Please fill in all required fields');
      return;
    }

    const serviceArea = {
      type: serviceAreaType,
      displayText: serviceAreaType === 'RADIUS' 
        ? `Within ${radiusKm} km radius`
        : `Serves ${specificAreas.join(', ')}`,
      center: { lat: 0, lng: 0 }, // Will be updated with actual location
      radiusKm: serviceAreaType === 'RADIUS' ? radiusKm : undefined,
      areas: serviceAreaType === 'SPECIFIC_AREAS' ? specificAreas : undefined
    };

    const bankAccount = {
      accountNumber,
      ifscCode,
      accountHolderName: accountHolderName || ownerName,
      bankName
    };

    onSubmit({
      ownerName,
      businessName: businessName || `${ownerName} - ${roleName}`,
      phone,
      email,
      panNumber,
      bankAccount,
      serviceArea,
      operatingHours,
      experience,
      specializations,
      bio,
      profilePhoto
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-white p-6">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <Button
            variant="ghost"
            onClick={onBack}
            className="mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <div className="flex items-center gap-3 mb-2">
            <Badge className="bg-orange-500 text-white">Solo Provider</Badge>
            <Badge variant="secondary">{roleName}</Badge>
          </div>
          <h1 className="text-3xl mb-2">Quick Onboarding</h1>
          <p className="text-gray-600">
            Simplified registration for solo practitioners. No GST or shop license required!
          </p>
        </div>

        {/* Form Sections */}
        <div className="space-y-6">
          
          {/* Basic Information */}
          <Card className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <User className="w-5 h-5 text-orange-600" />
              <h2 className="text-xl font-semibold">Basic Information</h2>
            </div>
            <div className="space-y-4">
              <div>
                <Label htmlFor="ownerName">Full Name *</Label>
                <Input
                  id="ownerName"
                  value={ownerName}
                  onChange={(e) => setOwnerName(e.target.value)}
                  placeholder="Your full name"
                  required
                />
              </div>
              <div>
                <Label htmlFor="businessName">Business Name (Optional)</Label>
                <Input
                  id="businessName"
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  placeholder={`e.g., ${ownerName ? ownerName + "'s" : 'Your'} ${roleName}`}
                />
                <p className="text-sm text-gray-500 mt-1">
                  Leave blank to use: "{ownerName ? `${ownerName} - ${roleName}` : 'Your Name - ' + roleName}"
                </p>
              </div>
              <div>
                <Label htmlFor="phone">Phone Number *</Label>
                <Input
                  id="phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+91 XXXXX XXXXX"
                  required
                  disabled={!!initialPhone}
                />
              </div>
              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@email.com"
                />
              </div>
            </div>
          </Card>

          {/* Documents (Simplified) */}
          <Card className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <FileText className="w-5 h-5 text-orange-600" />
              <h2 className="text-xl font-semibold">Documents (Simplified)</h2>
            </div>
            <div className="space-y-4">
              <div>
                <Label htmlFor="panNumber">PAN Number *</Label>
                <Input
                  id="panNumber"
                  value={panNumber}
                  onChange={(e) => setPanNumber(e.target.value.toUpperCase())}
                  placeholder="ABCDE1234F"
                  maxLength={10}
                  required
                />
                <p className="text-sm text-gray-500 mt-1">Required for payouts</p>
              </div>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-800">
                  ✅ <strong>No GST required</strong> - Only needed if your annual turnover exceeds ₹20 lakhs<br />
                  ✅ <strong>No shop license required</strong> - You work from customer locations
                </p>
              </div>
            </div>
          </Card>

          {/* Bank Account */}
          <Card className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <CreditCard className="w-5 h-5 text-orange-600" />
              <h2 className="text-xl font-semibold">Bank Account Details *</h2>
            </div>
            <div className="space-y-4">
              <div>
                <Label htmlFor="accountHolderName">Account Holder Name</Label>
                <Input
                  id="accountHolderName"
                  value={accountHolderName}
                  onChange={(e) => setAccountHolderName(e.target.value)}
                  placeholder={ownerName || "Your name as per bank"}
                />
              </div>
              <div>
                <Label htmlFor="accountNumber">Account Number *</Label>
                <Input
                  id="accountNumber"
                  value={accountNumber}
                  onChange={(e) => setAccountNumber(e.target.value)}
                  placeholder="XXXX XXXX XXXX"
                  required
                />
              </div>
              <div>
                <Label htmlFor="ifscCode">IFSC Code *</Label>
                <Input
                  id="ifscCode"
                  value={ifscCode}
                  onChange={(e) => setIfscCode(e.target.value.toUpperCase())}
                  placeholder="ABCD0123456"
                  maxLength={11}
                  required
                />
              </div>
              <div>
                <Label htmlFor="bankName">Bank Name</Label>
                <Input
                  id="bankName"
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  placeholder="e.g., HDFC Bank"
                />
              </div>
            </div>
          </Card>

          {/* Service Area (Privacy Protection) */}
          <Card className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <MapPin className="w-5 h-5 text-orange-600" />
              <h2 className="text-xl font-semibold">Service Area</h2>
            </div>
            <p className="text-sm text-gray-600 mb-4">
              Define where you provide services. Your home address will NOT be shown to customers.
            </p>
            
            {/* Type Selection */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              <Button
                variant={serviceAreaType === 'RADIUS' ? 'default' : 'outline'}
                onClick={() => setServiceAreaType('RADIUS')}
                className={serviceAreaType === 'RADIUS' ? 'bg-orange-600' : ''}
              >
                Radius Based
              </Button>
              <Button
                variant={serviceAreaType === 'SPECIFIC_AREAS' ? 'default' : 'outline'}
                onClick={() => setServiceAreaType('SPECIFIC_AREAS')}
                className={serviceAreaType === 'SPECIFIC_AREAS' ? 'bg-orange-600' : ''}
              >
                Specific Areas
              </Button>
            </div>

            {serviceAreaType === 'RADIUS' ? (
              <div>
                <Label htmlFor="radius">Service Radius (km)</Label>
                <Input
                  id="radius"
                  type="number"
                  value={radiusKm}
                  onChange={(e) => setRadiusKm(parseInt(e.target.value) || 10)}
                  min={1}
                  max={50}
                />
                <p className="text-sm text-gray-500 mt-1">
                  You'll serve customers within {radiusKm} km from your location
                </p>
              </div>
            ) : (
              <div>
                <Label>Areas You Serve</Label>
                <div className="flex flex-wrap gap-2 mb-3">
                  {specificAreas.map((area, idx) => (
                    <Badge key={idx} variant="secondary" className="gap-2">
                      {area}
                      <X
                        className="w-3 h-3 cursor-pointer"
                        onClick={() => handleRemoveArea(area)}
                      />
                    </Badge>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Input
                    value={newArea}
                    onChange={(e) => setNewArea(e.target.value)}
                    placeholder="Enter area name (e.g., Koramangala)"
                    onKeyPress={(e) => e.key === 'Enter' && handleAddArea()}
                  />
                  <Button onClick={handleAddArea} size="icon">
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}
          </Card>

          {/* Professional Information */}
          <Card className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <Award className="w-5 h-5 text-orange-600" />
              <h2 className="text-xl font-semibold">Professional Information</h2>
            </div>
            <div className="space-y-4">
              <div>
                <Label htmlFor="experience">Years of Experience</Label>
                <Input
                  id="experience"
                  type="number"
                  value={experience}
                  onChange={(e) => setExperience(parseInt(e.target.value) || 0)}
                  min={0}
                  max={50}
                />
              </div>
              <div>
                <Label htmlFor="bio">Bio / About You</Label>
                <Textarea
                  id="bio"
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="Tell customers about yourself, your experience, and what makes you special..."
                  rows={4}
                />
              </div>
              <div>
                <Label>Specializations</Label>
                <div className="flex flex-wrap gap-2 mb-3">
                  {specializations.map((spec, idx) => (
                    <Badge key={idx} variant="secondary" className="gap-2">
                      {spec}
                      <X
                        className="w-3 h-3 cursor-pointer"
                        onClick={() => handleRemoveSpecialization(spec)}
                      />
                    </Badge>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Input
                    value={newSpecialization}
                    onChange={(e) => setNewSpecialization(e.target.value)}
                    placeholder="e.g., Large Breeds, Cats, etc."
                    onKeyPress={(e) => e.key === 'Enter' && handleAddSpecialization()}
                  />
                  <Button onClick={handleAddSpecialization} size="icon">
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
          </Card>

          {/* Operating Hours */}
          <Card className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <Briefcase className="w-5 h-5 text-orange-600" />
              <h2 className="text-xl font-semibold">Operating Hours</h2>
            </div>
            <div className="space-y-3">
              {Object.entries(operatingHours).map(([day, hours]) => (
                <div key={day} className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={hours.enabled}
                    onChange={(e) => setOperatingHours({
                      ...operatingHours,
                      [day]: { ...hours, enabled: e.target.checked }
                    })}
                    className="w-4 h-4"
                  />
                  <span className="w-24 capitalize">{day}</span>
                  {hours.enabled && (
                    <>
                      <Input
                        type="time"
                        value={hours.open}
                        onChange={(e) => setOperatingHours({
                          ...operatingHours,
                          [day]: { ...hours, open: e.target.value }
                        })}
                        className="w-32"
                      />
                      <span>to</span>
                      <Input
                        type="time"
                        value={hours.close}
                        onChange={(e) => setOperatingHours({
                          ...operatingHours,
                          [day]: { ...hours, close: e.target.value }
                        })}
                        className="w-32"
                      />
                    </>
                  )}
                  {!hours.enabled && <span className="text-gray-400">Closed</span>}
                </div>
              ))}
            </div>
          </Card>

          {/* Submit Button */}
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={onBack}
              disabled={submitting}
              className="flex-1"
            >
              Back
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={submitting}
              className="flex-1 bg-orange-600 hover:bg-orange-700 text-white"
            >
              {submitting ? 'Submitting...' : 'Submit Application'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
