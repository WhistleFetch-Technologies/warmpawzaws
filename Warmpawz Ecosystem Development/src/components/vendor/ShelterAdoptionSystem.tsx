import { useState, useEffect } from 'react';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { Badge } from '../ui/badge';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { 
  Heart, Search, Filter, Plus, Eye, Edit, CheckCircle, XCircle,
  Clock, Home, Calendar, User, Phone, Mail, MapPin, FileText,
  AlertCircle, Shield, Camera, Trash2, DollarSign, Award
} from 'lucide-react';
import { getApiBaseUrl, getAuthHeaders } from '../../utils/api-config';

interface AdoptablePet {
  id: string;
  name: string;
  species: 'dog' | 'cat' | 'bird' | 'rabbit' | 'other';
  breed: string;
  age: string;
  gender: 'male' | 'female';
  size: 'small' | 'medium' | 'large';
  color: string;
  images: string[];
  description: string;
  personality: string[];
  medicalHistory: string;
  vaccinated: boolean;
  neutered: boolean;
  healthStatus: string;
  adoptionFee: number;
  status: 'available' | 'pending' | 'adopted' | 'on_hold';
  arrivalDate: string;
  createdAt: string;
}

interface AdoptionApplication {
  id: string;
  petId: string;
  petName: string;
  petImage: string;
  applicantName: string;
  applicantPhone: string;
  applicantEmail: string;
  address: string;
  city: string;
  state: string;
  occupation: string;
  housingType: 'house' | 'apartment' | 'condo' | 'other';
  hasYard: boolean;
  hasPets: boolean;
  existingPets: string;
  experience: string;
  reason: string;
  references: Reference[];
  homeVisitScheduled: boolean;
  homeVisitDate?: string;
  status: 'pending' | 'approved' | 'rejected' | 'home_visit_required';
  submittedAt: string;
  reviewedBy?: string;
  reviewedAt?: string;
  rejectionReason?: string;
}

interface Reference {
  name: string;
  phone: string;
  relationship: string;
}

export function ShelterAdoptionSystem({ vendorId }: { vendorId: string }) {
  const [activeTab, setActiveTab] = useState<'pets' | 'applications'>('pets');
  const [pets, setPets] = useState<AdoptablePet[]>([]);
  const [applications, setApplications] = useState<AdoptionApplication[]>([]);
  const [filteredPets, setFilteredPets] = useState<AdoptablePet[]>([]);
  const [filteredApplications, setFilteredApplications] = useState<AdoptionApplication[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Modals
  const [showAddPetModal, setShowAddPetModal] = useState(false);
  const [showEditPetModal, setShowEditPetModal] = useState(false);
  const [showPetDetailModal, setShowPetDetailModal] = useState(false);
  const [showApplicationModal, setShowApplicationModal] = useState(false);
  const [selectedPet, setSelectedPet] = useState<AdoptablePet | null>(null);
  const [selectedApplication, setSelectedApplication] = useState<AdoptionApplication | null>(null);

  // Filters
  const [petSearchQuery, setPetSearchQuery] = useState('');
  const [petStatusFilter, setPetStatusFilter] = useState<'all' | 'available' | 'pending' | 'adopted'>('all');
  const [speciesFilter, setSpeciesFilter] = useState<'all' | 'dog' | 'cat' | 'bird' | 'rabbit' | 'other'>('all');
  
  const [appSearchQuery, setAppSearchQuery] = useState('');
  const [appStatusFilter, setAppStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');

  // Form data for new pet
  const [newPet, setNewPet] = useState<Partial<AdoptablePet>>({
    name: '',
    species: 'dog',
    breed: '',
    age: '',
    gender: 'male',
    size: 'medium',
    color: '',
    description: '',
    personality: [],
    medicalHistory: '',
    vaccinated: false,
    neutered: false,
    healthStatus: 'healthy',
    adoptionFee: 0,
    status: 'available',
    images: []
  });

  useEffect(() => {
    loadData();
  }, [vendorId]);

  useEffect(() => {
    filterPets();
  }, [pets, petSearchQuery, petStatusFilter, speciesFilter]);

  useEffect(() => {
    filterApplications();
  }, [applications, appSearchQuery, appStatusFilter]);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Load pets
      const petsResponse = await fetch(
        `${getApiBaseUrl()}/vendor/${vendorId}/adoption/pets`,
        {
          headers: getAuthHeaders()
        }
      );

      if (petsResponse.ok) {
        const petsData = await petsResponse.json();
        setPets(petsData.pets || []);
      }

      // Load applications
      const appsResponse = await fetch(
        `${getApiBaseUrl()}/vendor/${vendorId}/adoption/applications`,
        {
          headers: getAuthHeaders()
        }
      );

      if (appsResponse.ok) {
        const appsData = await appsResponse.json();
        setApplications(appsData.applications || []);
      }
    } catch (error) {
      console.error('Error loading adoption data:', error);
    } finally {
      setLoading(false);
    }
  };

  const filterPets = () => {
    let filtered = [...pets];

    if (petStatusFilter !== 'all') {
      filtered = filtered.filter(p => p.status === petStatusFilter);
    }

    if (speciesFilter !== 'all') {
      filtered = filtered.filter(p => p.species === speciesFilter);
    }

    if (petSearchQuery) {
      filtered = filtered.filter(p =>
        p.name.toLowerCase().includes(petSearchQuery.toLowerCase()) ||
        p.breed.toLowerCase().includes(petSearchQuery.toLowerCase())
      );
    }

    setFilteredPets(filtered);
  };

  const filterApplications = () => {
    let filtered = [...applications];

    if (appStatusFilter !== 'all') {
      filtered = filtered.filter(a => a.status === appStatusFilter);
    }

    if (appSearchQuery) {
      filtered = filtered.filter(a =>
        a.applicantName.toLowerCase().includes(appSearchQuery.toLowerCase()) ||
        a.petName.toLowerCase().includes(appSearchQuery.toLowerCase())
      );
    }

    setFilteredApplications(filtered);
  };

  const addPet = async () => {
    try {
      const response = await fetch(
        `${getApiBaseUrl()}/vendor/${vendorId}/adoption/pets`,
        {
          method: 'POST',
          headers: {
            ...getAuthHeaders(),
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(newPet)
        }
      );

      if (response.ok) {
        await loadData();
        setShowAddPetModal(false);
        alert('✅ Pet added successfully!');
      }
    } catch (error) {
      console.error('Error adding pet:', error);
      alert('Failed to add pet');
    }
  };

  const updatePetStatus = async (petId: string, status: string) => {
    try {
      const response = await fetch(
        `${getApiBaseUrl()}/vendor/${vendorId}/adoption/pets/${petId}/status`,
        {
          method: 'PUT',
          headers: {
            ...getAuthHeaders(),
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ status })
        }
      );

      if (response.ok) {
        await loadData();
      }
    } catch (error) {
      console.error('Error updating pet status:', error);
    }
  };

  const reviewApplication = async (applicationId: string, approved: boolean, notes?: string) => {
    try {
      const response = await fetch(
        `${getApiBaseUrl()}/vendor/${vendorId}/adoption/applications/${applicationId}/review`,
        {
          method: 'POST',
          headers: {
            ...getAuthHeaders(),
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ approved, notes })
        }
      );

      if (response.ok) {
        await loadData();
        setShowApplicationModal(false);
        alert(approved ? '✅ Application approved!' : '❌ Application rejected');
      }
    } catch (error) {
      console.error('Error reviewing application:', error);
      alert('Failed to review application');
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'available':
        return <Badge className="bg-green-100 text-green-700"><Heart className="w-3 h-3 mr-1" />Available</Badge>;
      case 'pending':
        return <Badge className="bg-yellow-100 text-yellow-700"><Clock className="w-3 h-3 mr-1" />Pending</Badge>;
      case 'adopted':
        return <Badge className="bg-blue-100 text-blue-700"><Home className="w-3 h-3 mr-1" />Adopted</Badge>;
      case 'on_hold':
        return <Badge className="bg-gray-100 text-gray-700">On Hold</Badge>;
      case 'approved':
        return <Badge className="bg-green-100 text-green-700"><CheckCircle className="w-3 h-3 mr-1" />Approved</Badge>;
      case 'rejected':
        return <Badge className="bg-red-100 text-red-700"><XCircle className="w-3 h-3 mr-1" />Rejected</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  const stats = {
    totalPets: pets.length,
    available: pets.filter(p => p.status === 'available').length,
    pending: pets.filter(p => p.status === 'pending').length,
    adopted: pets.filter(p => p.status === 'adopted').length,
    totalApplications: applications.length,
    pendingApps: applications.filter(a => a.status === 'pending').length,
    approvedApps: applications.filter(a => a.status === 'approved').length
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FF8C42] mx-auto mb-4"></div>
          <p className="text-gray-600">Loading adoption system...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Heart className="w-7 h-7 text-[#FF8C42]" />
            Adoption Management
          </h2>
          <p className="text-gray-600 mt-1">Manage adoptable pets and applications</p>
        </div>
        {activeTab === 'pets' && (
          <Button onClick={() => setShowAddPetModal(true)} className="bg-[#FF8C42] hover:bg-[#ff7a2e]">
            <Plus className="w-4 h-4 mr-2" />
            Add Pet
          </Button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="text-2xl font-bold text-gray-900">{stats.totalPets}</div>
          <div className="text-sm text-gray-600 mt-1">Total Pets</div>
        </Card>
        <Card className="p-4 border-green-200 bg-green-50">
          <div className="text-2xl font-bold text-green-700">{stats.available}</div>
          <div className="text-sm text-green-600 mt-1">Available</div>
        </Card>
        <Card className="p-4 border-blue-200 bg-blue-50">
          <div className="text-2xl font-bold text-blue-700">{stats.adopted}</div>
          <div className="text-sm text-blue-600 mt-1">Adopted</div>
        </Card>
        <Card className="p-4 border-yellow-200 bg-yellow-50">
          <div className="text-2xl font-bold text-yellow-700">{stats.pendingApps}</div>
          <div className="text-sm text-yellow-600 mt-1">Pending Apps</div>
        </Card>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <div className="flex gap-4">
          <button
            onClick={() => setActiveTab('pets')}
            className={`px-4 py-2 border-b-2 transition-colors ${
              activeTab === 'pets'
                ? 'border-[#FF8C42] text-[#FF8C42] font-semibold'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            Pets ({stats.totalPets})
          </button>
          <button
            onClick={() => setActiveTab('applications')}
            className={`px-4 py-2 border-b-2 transition-colors ${
              activeTab === 'applications'
                ? 'border-[#FF8C42] text-[#FF8C42] font-semibold'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            Applications ({stats.pendingApps} pending)
          </button>
        </div>
      </div>

      {/* Pets Tab */}
      {activeTab === 'pets' && (
        <div className="space-y-4">
          {/* Filters */}
          <Card className="p-4">
            <div className="grid grid-cols-4 gap-4">
              <div>
                <Label className="text-xs text-gray-600 mb-2">Search</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    placeholder="Name, breed..."
                    value={petSearchQuery}
                    onChange={(e) => setPetSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>
              <div>
                <Label className="text-xs text-gray-600 mb-2">Status</Label>
                <select
                  value={petStatusFilter}
                  onChange={(e) => setPetStatusFilter(e.target.value as any)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                >
                  <option value="all">All Status</option>
                  <option value="available">Available</option>
                  <option value="pending">Pending</option>
                  <option value="adopted">Adopted</option>
                </select>
              </div>
              <div>
                <Label className="text-xs text-gray-600 mb-2">Species</Label>
                <select
                  value={speciesFilter}
                  onChange={(e) => setSpeciesFilter(e.target.value as any)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                >
                  <option value="all">All Species</option>
                  <option value="dog">Dogs</option>
                  <option value="cat">Cats</option>
                  <option value="bird">Birds</option>
                  <option value="rabbit">Rabbits</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div className="flex items-end">
                <Button
                  variant="outline"
                  onClick={() => {
                    setPetSearchQuery('');
                    setPetStatusFilter('all');
                    setSpeciesFilter('all');
                  }}
                  className="w-full"
                >
                  <Filter className="w-4 h-4 mr-2" />
                  Clear
                </Button>
              </div>
            </div>
          </Card>

          {/* Pets Grid */}
          <div className="grid grid-cols-3 gap-4">
            {filteredPets.map((pet) => (
              <Card key={pet.id} className="overflow-hidden hover:shadow-lg transition-shadow">
                <div className="relative h-48 bg-gray-200">
                  {pet.images[0] ? (
                    <img src={pet.images[0]} alt={pet.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="flex items-center justify-center h-full">
                      <Camera className="w-12 h-12 text-gray-400" />
                    </div>
                  )}
                  <div className="absolute top-2 right-2">
                    {getStatusBadge(pet.status)}
                  </div>
                </div>
                <div className="p-4">
                  <div className="text-xl font-bold text-gray-900 mb-1">{pet.name}</div>
                  <div className="text-sm text-gray-600 mb-3">{pet.breed} • {pet.age} • {pet.gender}</div>
                  
                  <div className="flex gap-2 mb-3 text-xs">
                    {pet.vaccinated && (
                      <Badge variant="outline" className="bg-green-50 text-green-700">
                        <Shield className="w-3 h-3 mr-1" />
                        Vaccinated
                      </Badge>
                    )}
                    {pet.neutered && (
                      <Badge variant="outline" className="bg-blue-50 text-blue-700">Neutered</Badge>
                    )}
                  </div>

                  <div className="text-sm text-gray-700 mb-4 line-clamp-2">{pet.description}</div>

                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <DollarSign className="w-4 h-4 text-gray-600" />
                      <span className="font-semibold text-lg">₹{pet.adoptionFee}</span>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSelectedPet(pet);
                        setShowPetDetailModal(true);
                      }}
                      className="flex-1"
                    >
                      <Eye className="w-4 h-4 mr-2" />
                      View
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSelectedPet(pet);
                        setNewPet(pet);
                        setShowEditPetModal(true);
                      }}
                      className="flex-1"
                    >
                      <Edit className="w-4 h-4 mr-2" />
                      Edit
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Applications Tab */}
      {activeTab === 'applications' && (
        <div className="space-y-4">
          {/* Filters */}
          <Card className="p-4">
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label className="text-xs text-gray-600 mb-2">Search</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    placeholder="Applicant, pet..."
                    value={appSearchQuery}
                    onChange={(e) => setAppSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>
              <div>
                <Label className="text-xs text-gray-600 mb-2">Status</Label>
                <select
                  value={appStatusFilter}
                  onChange={(e) => setAppStatusFilter(e.target.value as any)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                >
                  <option value="all">All Status</option>
                  <option value="pending">Pending</option>
                  <option value="approved">Approved</option>
                  <option value="rejected">Rejected</option>
                </select>
              </div>
              <div className="flex items-end">
                <Button
                  variant="outline"
                  onClick={() => {
                    setAppSearchQuery('');
                    setAppStatusFilter('all');
                  }}
                  className="w-full"
                >
                  <Filter className="w-4 h-4 mr-2" />
                  Clear
                </Button>
              </div>
            </div>
          </Card>

          {/* Applications List */}
          <div className="space-y-3">
            {filteredApplications.map((app) => (
              <Card key={app.id} className="p-4 hover:shadow-md transition-shadow">
                <div className="flex items-start gap-4">
                  <img
                    src={app.petImage || 'https://images.unsplash.com/photo-1543466835-00a7907e9de1?w=100'}
                    alt={app.petName}
                    className="w-20 h-20 rounded-lg object-cover"
                  />
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <div className="text-lg font-semibold text-gray-900">{app.applicantName}</div>
                        <div className="text-sm text-gray-600">Applying for: <span className="font-medium">{app.petName}</span></div>
                      </div>
                      {getStatusBadge(app.status)}
                    </div>

                    <div className="grid grid-cols-3 gap-4 text-sm mb-3">
                      <div className="flex items-center gap-2">
                        <Phone className="w-4 h-4 text-gray-400" />
                        <span>{app.applicantPhone}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Mail className="w-4 h-4 text-gray-400" />
                        <span className="truncate">{app.applicantEmail}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-gray-400" />
                        <span>{app.city}, {app.state}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 text-xs text-gray-600 mb-3">
                      <div className="flex items-center gap-1">
                        <Home className="w-3 h-3" />
                        {app.housingType}
                      </div>
                      {app.hasYard && (
                        <Badge variant="outline" className="text-xs">Has Yard</Badge>
                      )}
                      {app.hasPets && (
                        <Badge variant="outline" className="text-xs">Has Other Pets</Badge>
                      )}
                    </div>

                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedApplication(app);
                          setShowApplicationModal(true);
                        }}
                      >
                        <Eye className="w-4 h-4 mr-2" />
                        Review Application
                      </Button>
                      {app.status === 'pending' && (
                        <>
                          <Button
                            size="sm"
                            onClick={() => reviewApplication(app.id, true)}
                            className="bg-green-600 hover:bg-green-700"
                          >
                            <CheckCircle className="w-4 h-4 mr-2" />
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              const reason = prompt('Rejection reason:');
                              if (reason) reviewApplication(app.id, false, reason);
                            }}
                            className="border-red-300 text-red-700"
                          >
                            <XCircle className="w-4 h-4 mr-2" />
                            Reject
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Add Pet Modal */}
      <Dialog open={showAddPetModal} onOpenChange={setShowAddPetModal}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add Adoptable Pet</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Pet Name *</Label>
                <Input
                  value={newPet.name}
                  onChange={(e) => setNewPet({...newPet, name: e.target.value})}
                  placeholder="e.g., Max"
                />
              </div>
              <div>
                <Label>Species *</Label>
                <select
                  value={newPet.species}
                  onChange={(e) => setNewPet({...newPet, species: e.target.value as any})}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                >
                  <option value="dog">Dog</option>
                  <option value="cat">Cat</option>
                  <option value="bird">Bird</option>
                  <option value="rabbit">Rabbit</option>
                  <option value="other">Other</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>Breed</Label>
                <Input
                  value={newPet.breed}
                  onChange={(e) => setNewPet({...newPet, breed: e.target.value})}
                  placeholder="e.g., Labrador"
                />
              </div>
              <div>
                <Label>Age</Label>
                <Input
                  value={newPet.age}
                  onChange={(e) => setNewPet({...newPet, age: e.target.value})}
                  placeholder="e.g., 2 years"
                />
              </div>
              <div>
                <Label>Gender</Label>
                <select
                  value={newPet.gender}
                  onChange={(e) => setNewPet({...newPet, gender: e.target.value as any})}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                >
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                </select>
              </div>
            </div>

            <div>
              <Label>Description</Label>
              <Textarea
                value={newPet.description}
                onChange={(e) => setNewPet({...newPet, description: e.target.value})}
                placeholder="Describe the pet's characteristics..."
                rows={4}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={newPet.vaccinated}
                  onChange={(e) => setNewPet({...newPet, vaccinated: e.target.checked})}
                  id="vaccinated"
                />
                <Label htmlFor="vaccinated">Vaccinated</Label>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={newPet.neutered}
                  onChange={(e) => setNewPet({...newPet, neutered: e.target.checked})}
                  id="neutered"
                />
                <Label htmlFor="neutered">Neutered/Spayed</Label>
              </div>
            </div>

            <div>
              <Label>Adoption Fee (₹)</Label>
              <Input
                type="number"
                value={newPet.adoptionFee}
                onChange={(e) => setNewPet({...newPet, adoptionFee: parseFloat(e.target.value)})}
              />
            </div>

            <div className="flex gap-3">
              <Button onClick={addPet} className="flex-1 bg-[#FF8C42] hover:bg-[#ff7a2e]">
                <Plus className="w-4 h-4 mr-2" />
                Add Pet
              </Button>
              <Button variant="outline" onClick={() => setShowAddPetModal(false)} className="flex-1">
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Application Detail Modal */}
      <Dialog open={showApplicationModal} onOpenChange={setShowApplicationModal}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Adoption Application Review</DialogTitle>
          </DialogHeader>
          {selectedApplication && (
            <div className="space-y-6">
              {/* Status */}
              <div className="flex items-center justify-between">
                {getStatusBadge(selectedApplication.status)}
                <div className="text-sm text-gray-600">
                  Submitted {new Date(selectedApplication.submittedAt).toLocaleDateString()}
                </div>
              </div>

              {/* Pet Info */}
              <Card className="p-4">
                <div className="flex items-center gap-4">
                  <img
                    src={selectedApplication.petImage || 'https://images.unsplash.com/photo-1543466835-00a7907e9de1?w=100'}
                    alt={selectedApplication.petName}
                    className="w-24 h-24 rounded-lg object-cover"
                  />
                  <div>
                    <div className="text-lg font-semibold text-gray-900">Applying for: {selectedApplication.petName}</div>
                  </div>
                </div>
              </Card>

              {/* Applicant Info */}
              <Card className="p-4">
                <div className="font-semibold mb-3">Applicant Information</div>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <div className="text-gray-500 text-xs">Name</div>
                    <div className="font-medium">{selectedApplication.applicantName}</div>
                  </div>
                  <div>
                    <div className="text-gray-500 text-xs">Phone</div>
                    <div className="font-medium">{selectedApplication.applicantPhone}</div>
                  </div>
                  <div>
                    <div className="text-gray-500 text-xs">Email</div>
                    <div className="font-medium">{selectedApplication.applicantEmail}</div>
                  </div>
                  <div>
                    <div className="text-gray-500 text-xs">Occupation</div>
                    <div className="font-medium">{selectedApplication.occupation}</div>
                  </div>
                </div>
              </Card>

              {/* Housing Info */}
              <Card className="p-4">
                <div className="font-semibold mb-3">Housing Information</div>
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <div className="text-gray-500 text-xs">Housing Type</div>
                    <div className="font-medium capitalize">{selectedApplication.housingType}</div>
                  </div>
                  <div>
                    <div className="text-gray-500 text-xs">Has Yard</div>
                    <div className="font-medium">{selectedApplication.hasYard ? 'Yes' : 'No'}</div>
                  </div>
                  <div>
                    <div className="text-gray-500 text-xs">Has Other Pets</div>
                    <div className="font-medium">{selectedApplication.hasPets ? 'Yes' : 'No'}</div>
                  </div>
                </div>
                {selectedApplication.hasPets && selectedApplication.existingPets && (
                  <div className="mt-3">
                    <div className="text-gray-500 text-xs mb-1">Existing Pets</div>
                    <div className="text-sm">{selectedApplication.existingPets}</div>
                  </div>
                )}
              </Card>

              {/* Application Details */}
              <Card className="p-4">
                <div className="font-semibold mb-3">Application Details</div>
                <div className="space-y-3 text-sm">
                  <div>
                    <div className="text-gray-500 text-xs mb-1">Experience with Pets</div>
                    <div>{selectedApplication.experience}</div>
                  </div>
                  <div>
                    <div className="text-gray-500 text-xs mb-1">Reason for Adoption</div>
                    <div>{selectedApplication.reason}</div>
                  </div>
                </div>
              </Card>

              {/* References */}
              {selectedApplication.references && selectedApplication.references.length > 0 && (
                <Card className="p-4">
                  <div className="font-semibold mb-3">References</div>
                  <div className="space-y-2">
                    {selectedApplication.references.map((ref, idx) => (
                      <div key={idx} className="flex items-center justify-between text-sm">
                        <div>
                          <div className="font-medium">{ref.name}</div>
                          <div className="text-gray-600 text-xs">{ref.relationship}</div>
                        </div>
                        <div className="text-gray-600">{ref.phone}</div>
                      </div>
                    ))}
                  </div>
                </Card>
              )}

              {/* Actions */}
              {selectedApplication.status === 'pending' && (
                <div className="flex gap-3">
                  <Button
                    onClick={() => reviewApplication(selectedApplication.id, true)}
                    className="flex-1 bg-green-600 hover:bg-green-700"
                  >
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Approve Application
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      const reason = prompt('Enter rejection reason:');
                      if (reason) reviewApplication(selectedApplication.id, false, reason);
                    }}
                    className="flex-1 border-red-300 text-red-700"
                  >
                    <XCircle className="w-4 h-4 mr-2" />
                    Reject Application
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
