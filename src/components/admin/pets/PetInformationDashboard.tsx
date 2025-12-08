import { useState, useEffect } from 'react';
import { Card } from '../../ui/card';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../ui/table';
import { Badge } from '../../ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../ui/tabs';
import { Search, Filter, Download, PawPrint, Heart, Activity, TrendingUp, ArrowLeft } from 'lucide-react';
import { projectId, publicAnonKey } from '../../../utils/supabase/info';

interface PetInformationDashboardProps {
  onBack: () => void;
}

export function PetInformationDashboard({ onBack }: PetInformationDashboardProps) {
  const [pets, setPets] = useState<any[]>([]);
  const [filteredPets, setFilteredPets] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all');
  const [breedInsights, setBreedInsights] = useState<any[]>([]);
  const [speciesDistribution, setSpeciesDistribution] = useState<any[]>([]);

  const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475`;

  useEffect(() => {
    loadPets();
    loadBreedInsights();
    loadSpeciesDistribution();
  }, []);

  useEffect(() => {
    filterPets();
  }, [pets, searchQuery]);

  const loadPets = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/admin/pets/all?limit=100`, {
        headers: {
          'Authorization': `Bearer ${publicAnonKey}`
        }
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          setPets(result.pets);
        }
      }
    } catch (error) {
      console.error('Error loading pets:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadBreedInsights = async () => {
    try {
      const response = await fetch(`${API_BASE}/admin/pets/analytics/breed-insights`, {
        headers: {
          'Authorization': `Bearer ${publicAnonKey}`
        }
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          setBreedInsights(result.breedInsights.slice(0, 10));
        }
      }
    } catch (error) {
      console.error('Error loading breed insights:', error);
    }
  };

  const loadSpeciesDistribution = async () => {
    try {
      const response = await fetch(`${API_BASE}/admin/pets/analytics/species-distribution`, {
        headers: {
          'Authorization': `Bearer ${publicAnonKey}`
        }
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          setSpeciesDistribution(result.distribution);
        }
      }
    } catch (error) {
      console.error('Error loading species distribution:', error);
    }
  };

  const filterPets = () => {
    let filtered = pets;

    if (searchQuery) {
      filtered = filtered.filter(pet =>
        pet.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        pet.breed?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        pet.species?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        pet.ownerPhone?.includes(searchQuery)
      );
    }

    setFilteredPets(filtered);
  };

  const exportData = () => {
    console.log('Exporting pet data...');
  };

  const getHealthStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'healthy':
        return 'bg-green-100 text-green-800';
      case 'at risk':
        return 'bg-yellow-100 text-yellow-800';
      case 'sick':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FF8C42] mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading pet data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="sm" onClick={onBack}>
                <ArrowLeft className="w-4 h-4" />
              </Button>
              <div>
                <h1 className="text-xl font-semibold">Pet Information System</h1>
                <p className="text-sm text-gray-500">Comprehensive pet database and insights</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Button onClick={exportData} className="bg-[#FF8C42] hover:bg-[#ff7a28]">
                <Download className="w-4 h-4 mr-2" />
                Export
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="bg-blue-500 text-white p-3 rounded-lg">
                <PawPrint className="w-5 h-5" />
              </div>
            </div>
            <h3 className="text-2xl font-bold mb-1">{pets.length}</h3>
            <p className="text-sm text-gray-500">Total Pets</p>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="bg-green-500 text-white p-3 rounded-lg">
                <Heart className="w-5 h-5" />
              </div>
            </div>
            <h3 className="text-2xl font-bold mb-1">
              {pets.filter(p => p.healthStatus === 'Healthy').length}
            </h3>
            <p className="text-sm text-gray-500">Healthy Pets</p>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="bg-[#FF8C42] text-white p-3 rounded-lg">
                <Activity className="w-5 h-5" />
              </div>
            </div>
            <h3 className="text-2xl font-bold mb-1">
              {speciesDistribution.length}
            </h3>
            <p className="text-sm text-gray-500">Species Types</p>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="bg-purple-500 text-white p-3 rounded-lg">
                <TrendingUp className="w-5 h-5" />
              </div>
            </div>
            <h3 className="text-2xl font-bold mb-1">{breedInsights.length}</h3>
            <p className="text-sm text-gray-500">Unique Breeds</p>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-6">
            <TabsTrigger value="all">All Pets</TabsTrigger>
            <TabsTrigger value="breeds">Breed Insights</TabsTrigger>
            <TabsTrigger value="species">Species Distribution</TabsTrigger>
          </TabsList>

          {/* All Pets Tab */}
          <TabsContent value="all">
            <Card className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">Pet Database</h2>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <Input
                      placeholder="Search pets..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10 w-64"
                    />
                  </div>
                  <Button variant="outline">
                    <Filter className="w-4 h-4 mr-2" />
                    Filters
                  </Button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Pet Name</TableHead>
                      <TableHead>Species</TableHead>
                      <TableHead>Breed</TableHead>
                      <TableHead>Age</TableHead>
                      <TableHead>Owner</TableHead>
                      <TableHead>Contact</TableHead>
                      <TableHead>Health Status</TableHead>
                      <TableHead>Total Visits</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredPets.map((pet) => (
                      <TableRow key={pet.id}>
                        <TableCell className="font-medium">{pet.name}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{pet.species}</Badge>
                        </TableCell>
                        <TableCell>{pet.breed || 'Unknown'}</TableCell>
                        <TableCell>
                          {pet.age || 'N/A'} {pet.ageUnit || ''}
                        </TableCell>
                        <TableCell>{pet.ownerName || 'Unknown'}</TableCell>
                        <TableCell>{pet.ownerPhone || 'N/A'}</TableCell>
                        <TableCell>
                          <Badge className={getHealthStatusColor(pet.healthStatus)}>
                            {pet.healthStatus || 'Unknown'}
                          </Badge>
                        </TableCell>
                        <TableCell>{pet.totalBookings || 0}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {filteredPets.length === 0 && (
                <div className="text-center py-12">
                  <PawPrint className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500">No pets found</p>
                </div>
              )}
            </Card>
          </TabsContent>

          {/* Breed Insights Tab */}
          <TabsContent value="breeds">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {breedInsights.map((breed, index) => (
                <Card key={index} className="p-6">
                  <h3 className="text-lg font-semibold mb-4">{breed.breed}</h3>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Total Count:</span>
                      <span className="font-semibold">{breed.count}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Average Age:</span>
                      <span className="font-semibold">{breed.avgAge} years</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Avg Bookings:</span>
                      <span className="font-semibold">{breed.avgBookings}</span>
                    </div>
                    
                    {breed.commonIssues && breed.commonIssues.length > 0 && (
                      <div className="mt-4 pt-4 border-t">
                        <p className="text-sm font-medium mb-2">Common Health Issues:</p>
                        <div className="space-y-1">
                          {breed.commonIssues.slice(0, 3).map((issue: any, idx: number) => (
                            <div key={idx} className="flex justify-between text-sm">
                              <span className="text-gray-600">{issue.issue}</span>
                              <span className="text-gray-900">{issue.count}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {breed.popularServices && breed.popularServices.length > 0 && (
                      <div className="mt-4 pt-4 border-t">
                        <p className="text-sm font-medium mb-2">Popular Services:</p>
                        <div className="space-y-1">
                          {breed.popularServices.slice(0, 3).map((service: any, idx: number) => (
                            <div key={idx} className="flex justify-between text-sm">
                              <span className="text-gray-600">{service.service}</span>
                              <span className="text-gray-900">{service.count}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* Species Distribution Tab */}
          <TabsContent value="species">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {speciesDistribution.map((species, index) => (
                <Card key={index} className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold">{species.species}</h3>
                    <Badge className="bg-[#FF8C42] text-white">{species.percentage}%</Badge>
                  </div>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Total Count:</span>
                      <span className="font-semibold">{species.count}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Avg Age:</span>
                      <span className="font-semibold">{species.avgAge} years</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Avg Bookings:</span>
                      <span className="font-semibold">{species.avgBookings}</span>
                    </div>
                    
                    {species.topBreeds && species.topBreeds.length > 0 && (
                      <div className="mt-4 pt-4 border-t">
                        <p className="text-sm font-medium mb-2">Top Breeds:</p>
                        <div className="space-y-1">
                          {species.topBreeds.slice(0, 5).map((breed: any, idx: number) => (
                            <div key={idx} className="flex justify-between text-sm">
                              <span className="text-gray-600">{breed.breed}</span>
                              <span className="text-gray-900">{breed.count}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
