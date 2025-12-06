/**
 * PROBLEM CATEGORY MAPPER - ADMIN UI
 * 
 * Allows testing and configuration of problem grid mappings
 * Maps customer problems/needs to service subcategories
 */

import { useState, useEffect } from 'react';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { Badge } from '../ui/badge';
import { 
  ArrowLeft, 
  CheckCircle, 
  XCircle, 
  Settings, 
  Search,
  RefreshCw,
  AlertCircle,
  Stethoscope,
  Scissors,
  GraduationCap,
  Dog,
  Brain,
  Home
} from 'lucide-react';
import { projectId, publicAnonKey } from '../../utils/supabase/info';

interface ProblemCategoryMapperProps {
  onBack: () => void;
}

export function ProblemCategoryMapper({ onBack }: ProblemCategoryMapperProps) {
  const [selectedVendorType, setSelectedVendorType] = useState<string>('veterinarian');
  const [problems, setProblems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [testResults, setTestResults] = useState<any>(null);
  const [selectedProblem, setSelectedProblem] = useState<any>(null);

  const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475`;

  const vendorTypes = [
    {
      id: 'veterinarian',
      name: 'Veterinarian',
      icon: Stethoscope,
      color: 'bg-blue-500',
      count: 9
    },
    {
      id: 'pet_groomer',
      name: 'Groomer',
      icon: Scissors,
      color: 'bg-orange-500',
      count: 6
    },
    {
      id: 'pet_trainer',
      name: 'Trainer',
      icon: GraduationCap,
      color: 'bg-green-500',
      count: 6
    },
    {
      id: 'dog_walker',
      name: 'Walker',
      icon: Dog,
      color: 'bg-purple-500',
      count: 5
    },
    {
      id: 'pet_behaviorist',
      name: 'Behaviorist',
      icon: Brain,
      color: 'bg-pink-500',
      count: 5
    },
    {
      id: 'pet_boarding',
      name: 'Boarding',
      icon: Home,
      color: 'bg-teal-500',
      count: 5
    }
  ];

  useEffect(() => {
    loadProblemGrid();
  }, [selectedVendorType]);

  const loadProblemGrid = async () => {
    try {
      setLoading(true);
      setTestResults(null);
      setSelectedProblem(null);
      
      const response = await fetch(
        `${API_BASE}/customer/problem-grid/${selectedVendorType}`,
        { headers: { Authorization: `Bearer ${publicAnonKey}` } }
      );

      if (response.ok) {
        const data = await response.json();
        setProblems(data.problems || []);
        console.log('✅ Loaded problem grid:', data);
      } else {
        console.error('❌ Failed to load problem grid:', response.status);
      }
    } catch (error) {
      console.error('❌ Error loading problem grid:', error);
    } finally {
      setLoading(false);
    }
  };

  const testProblemMapping = async (problem: any) => {
    try {
      setSelectedProblem(problem);
      setTestResults({ loading: true });
      
      console.log('🧪 Testing problem mapping:', problem.id);
      
      // ✅ Use the WORKING endpoint (same as VetServiceRouter uses)
      const response = await fetch(
        `${API_BASE}/customer/discover-by-problem/${selectedVendorType}/${problem.id}`,
        { headers: { Authorization: `Bearer ${publicAnonKey}` } }
      );

      if (response.ok) {
        const data = await response.json();
        console.log('✅ Test results:', data);
        
        // Parse vendors - the endpoint returns vendors with specialists embedded
        const allVendors = data.vendors || [];
        
        // For each vendor, check if it has specialists
        const staffResults: any[] = [];
        const centerResults: any[] = [];
        
        allVendors.forEach((vendor: any) => {
          // Check if this vendor has specialists (individual staff to show)
          if (vendor.specialists && vendor.specialists.length > 0) {
            // Add each specialist as a staff result
            vendor.specialists.forEach((staff: any) => {
              staffResults.push({
                entityType: 'staff',
                name: staff.fullName || staff.name,
                specialization: staff.specialization,
                specializations: staff.specializations || [],
                centerName: vendor.businessName,
                consultationFee: staff.consultationFee || vendor.consultationFee,
                serviceStyles: vendor.availableServiceStyles || []
              });
            });
          }
          
          // Add the vendor/center itself
          centerResults.push({
            entityType: 'center',
            name: vendor.businessName,
            specialization: vendor.specialization,
            serviceStyles: vendor.availableServiceStyles || [],
            staffCount: vendor.specialistCount || vendor.specialists?.length || 0
          });
        });
        
        // Determine role config based on selectedVendorType
        const getRoleConfig = (roleId: string) => {
          if (roleId === 'veterinarian' || roleId.includes('vet') || roleId.includes('clinic')) {
            return {
              showIndividualStaff: true,
              showCenters: true,
              staffLabel: 'Doctors',
              centerLabel: 'Clinics'
            };
          } else if (roleId === 'pet_groomer' || roleId.includes('groomer')) {
            return {
              showIndividualStaff: true,
              showCenters: true,
              staffLabel: 'Groomers',
              centerLabel: 'Centers'
            };
          } else if (roleId === 'pet_trainer' || roleId.includes('trainer')) {
            return {
              showIndividualStaff: true,
              showCenters: true,
              staffLabel: 'Trainers',
              centerLabel: 'Centers'
            };
          } else if (roleId === 'dog_walker' || roleId.includes('walker')) {
            return {
              showIndividualStaff: true,
              showCenters: false,
              staffLabel: 'Walkers',
              centerLabel: 'Centers'
            };
          } else if (roleId === 'pet_behaviorist' || roleId.includes('behavior')) {
            return {
              showIndividualStaff: true,
              showCenters: true,
              staffLabel: 'Behaviorists',
              centerLabel: 'Centers'
            };
          } else if (roleId === 'pet_boarding' || roleId.includes('boarding')) {
            return {
              showIndividualStaff: false,
              showCenters: true,
              staffLabel: 'Staff',
              centerLabel: 'Centers'
            };
          }
          return {
            showIndividualStaff: true,
            showCenters: true,
            staffLabel: 'Staff',
            centerLabel: 'Centers'
          };
        };
        
        const roleConfig = getRoleConfig(selectedVendorType);
        
        // 🔬 DETAILED BREAKDOWN
        console.log('\n📊 DETAILED TEST BREAKDOWN:');
        console.log(`   Problem: "${problem.name}" (id: ${problem.id})`);
        console.log(`   Role: ${selectedVendorType}`);
        console.log(`   Total Vendors: ${allVendors.length}`);
        console.log(`   - ${roleConfig.staffLabel}: ${staffResults.length}`);
        console.log(`   - ${roleConfig.centerLabel}: ${centerResults.length}`);
        console.log(`   Matched Subcategories: ${data.matchedSubcategories?.length || 0}`, data.matchedSubcategories);
        console.log(`   Total Services Found: ${data.totalServices || 0}`);
        
        // Combine staff and center results
        const combinedResults = [
          ...staffResults.map(s => ({ ...s, entityType: 'staff' })),
          ...centerResults.map(c => ({ ...c, entityType: 'center' }))
        ];
        
        setTestResults({
          loading: false,
          success: true,
          problem: problem,
          roleConfig: roleConfig,
          matchedSubcategories: data.matchedSubcategories || [],
          matchedServices: (data.services || []).map((s: any) => ({
            serviceName: s.name,
            subCategoryName: s.subcategory,
            vendorName: 'Catalog Service',
            price: 0
          })),
          totalServices: data.totalServices || 0,
          vendors: combinedResults,
          totalVendors: allVendors.length,
          staffCount: staffResults.length,
          centerCount: centerResults.length
        });
      } else {
        console.error('❌ Test failed:', response.status);
        setTestResults({
          loading: false,
          success: false,
          error: 'Failed to fetch test results'
        });
      }
    } catch (error) {
      console.error('❌ Error testing mapping:', error);
      setTestResults({
        loading: false,
        success: false,
        error: error.message
      });
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 max-w-6xl mx-auto">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 sticky top-0 z-10 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button 
              onClick={onBack}
              className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Problem Category Mapper</h1>
              <p className="text-sm text-gray-500">Test and configure problem-to-subcategory mappings</p>
            </div>
          </div>
          <Button
            onClick={loadProblemGrid}
            variant="outline"
            className="flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-6 p-6">
        {/* Left Sidebar - Vendor Type Selection */}
        <div className="col-span-3">
          <Card className="p-4 sticky top-24">
            <h2 className="font-semibold mb-3 flex items-center gap-2">
              <Settings className="w-4 h-4" />
              Vendor Types
            </h2>
            <div className="space-y-2">
              {vendorTypes.map((type) => (
                <button
                  key={type.id}
                  onClick={() => setSelectedVendorType(type.id)}
                  className={`w-full flex items-center justify-between p-3 rounded-lg transition-all ${
                    selectedVendorType === type.id
                      ? 'bg-[#FF8C42] text-white shadow-md'
                      : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <type.icon className="w-4 h-4" />
                    <span className="font-medium text-sm">{type.name}</span>
                  </div>
                  <Badge 
                    variant="secondary" 
                    className={`${selectedVendorType === type.id ? 'bg-white/20 text-white' : ''}`}
                  >
                    {type.count}
                  </Badge>
                </button>
              ))}
            </div>

            {/* Legend */}
            <div className="mt-6 pt-4 border-t border-gray-200">
              <h3 className="text-xs font-semibold text-gray-500 mb-2">LEGEND</h3>
              <div className="space-y-2 text-xs">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-500" />
                  <span>Has mappings</span>
                </div>
                <div className="flex items-center gap-2">
                  <XCircle className="w-4 h-4 text-red-500" />
                  <span>No mappings</span>
                </div>
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-500" />
                  <span>Needs review</span>
                </div>
              </div>
            </div>
          </Card>
        </div>

        {/* Main Content - Problem Grid */}
        <div className="col-span-9">
          {/* Problem Cards */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">
                Problem Categories for {vendorTypes.find(v => v.id === selectedVendorType)?.name}
              </h2>
              <Badge variant="outline">{problems.length} Problems</Badge>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FF8C42]"></div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                {problems.map((problem) => (
                  <Card 
                    key={problem.id}
                    className={`p-4 hover:shadow-lg transition-all cursor-pointer border-2 ${
                      selectedProblem?.id === problem.id 
                        ? 'border-[#FF8C42] bg-orange-50' 
                        : 'border-gray-200 hover:border-[#FF8C42]/50'
                    }`}
                    onClick={() => testProblemMapping(problem)}
                  >
                    <div className="flex items-start gap-3">
                      {/* Icon */}
                      <div 
                        className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm"
                        style={{ 
                          backgroundColor: `${problem.color}15`,
                        }}
                      >
                        <span className="text-2xl">{problem.icon}</span>
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <h3 className="font-semibold text-sm">{problem.displayName || problem.name}</h3>
                          {problem.mappedSubCategories?.length > 0 ? (
                            <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                          ) : (
                            <XCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                          )}
                        </div>
                        <p className="text-xs text-gray-600 mb-3 line-clamp-2">
                          {problem.description}
                        </p>

                        {/* Mapped Subcategories */}
                        {problem.mappedSubCategories && problem.mappedSubCategories.length > 0 && (
                          <div className="mb-2">
                            <p className="text-xs text-gray-500 mb-1">Mapped to:</p>
                            <div className="flex flex-wrap gap-1">
                              {problem.mappedSubCategories.slice(0, 3).map((subcat: string, idx: number) => (
                                <Badge 
                                  key={idx} 
                                  variant="secondary" 
                                  className="text-xs bg-blue-50 text-blue-700"
                                >
                                  {subcat.replace('sub_', '').replace(/_/g, ' ')}
                                </Badge>
                              ))}
                              {problem.mappedSubCategories.length > 3 && (
                                <Badge variant="secondary" className="text-xs">
                                  +{problem.mappedSubCategories.length - 3}
                                </Badge>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Keywords */}
                        {problem.keywords && problem.keywords.length > 0 && (
                          <div>
                            <p className="text-xs text-gray-500 mb-1">Keywords:</p>
                            <p className="text-xs text-gray-600 line-clamp-1">
                              {problem.keywords.slice(0, 4).join(', ')}
                              {problem.keywords.length > 4 && '...'}
                            </p>
                          </div>
                        )}

                        {/* Test Button */}
                        <Button
                          size="sm"
                          className="w-full mt-3 bg-[#FF8C42] hover:bg-[#FF7029] text-white"
                          onClick={(e) => {
                            e.stopPropagation();
                            testProblemMapping(problem);
                          }}
                        >
                          <Search className="w-3 h-3 mr-1" />
                          Test Mapping
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>

          {/* Test Results Panel */}
          {testResults && (
            <Card className="p-6 border-2 border-[#FF8C42] bg-white sticky bottom-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h2 className="text-lg font-semibold mb-1">Test Results</h2>
                  {selectedProblem && (
                    <p className="text-sm text-gray-600">
                      Testing: <span className="font-semibold">{selectedProblem.displayName}</span>
                    </p>
                  )}
                </div>
                <button
                  onClick={() => setTestResults(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              </div>

              {testResults.loading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#FF8C42]"></div>
                </div>
              ) : testResults.success ? (
                <div className="space-y-4">
                  {/* Summary Stats */}
                  <div className="grid grid-cols-4 gap-4">
                    <div className="bg-blue-50 rounded-lg p-4">
                      <div className="text-2xl font-bold text-blue-600">
                        {testResults.matchedSubcategories?.length || 0}
                      </div>
                      <div className="text-xs text-blue-700">Matched Subcategories</div>
                    </div>
                    <div className="bg-green-50 rounded-lg p-4">
                      <div className="text-2xl font-bold text-green-600">
                        {testResults.totalServices}
                      </div>
                      <div className="text-xs text-green-700">Matching Services</div>
                    </div>
                    {testResults.staffCount !== undefined && testResults.roleConfig?.showIndividualStaff && (
                      <div className="bg-purple-50 rounded-lg p-4">
                        <div className="text-2xl font-bold text-purple-600">
                          {testResults.staffCount}
                        </div>
                        <div className="text-xs text-purple-700">{testResults.roleConfig?.staffLabel || 'Staff'}</div>
                      </div>
                    )}
                    {testResults.roleConfig?.showCenters && (
                      <div className="bg-orange-50 rounded-lg p-4">
                        <div className="text-2xl font-bold text-orange-600">
                          {testResults.centerCount || 0}
                        </div>
                        <div className="text-xs text-orange-700">{testResults.roleConfig?.centerLabel || 'Centers'}</div>
                      </div>
                    )}
                  </div>

                  {/* Matched Subcategories */}
                  {testResults.matchedSubcategories?.length > 0 && (
                    <div>
                      <h3 className="font-semibold text-sm mb-2">Matched Subcategories:</h3>
                      <div className="flex flex-wrap gap-2">
                        {testResults.matchedSubcategories.map((subcat: string, idx: number) => (
                          <Badge key={idx} className="bg-blue-100 text-blue-800">
                            {subcat.replace('sub_', '').replace(/_/g, ' ')}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Sample Services */}
                  {testResults.matchedServices?.length > 0 && (
                    <div>
                      <h3 className="font-semibold text-sm mb-2">
                        Sample Services ({testResults.matchedServices.length} total):
                      </h3>
                      <div className="space-y-2 max-h-40 overflow-y-auto">
                        {testResults.matchedServices.slice(0, 5).map((service: any, idx: number) => (
                          <div key={idx} className="bg-gray-50 rounded p-2 text-xs">
                            <div className="font-semibold">{service.serviceName}</div>
                            <div className="text-gray-600">
                              {service.vendorName} • ₹{service.price}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Sample Vendors */}
                  {testResults.vendors?.length > 0 && (
                    <div>
                      <h3 className="font-semibold text-sm mb-2">
                        Sample Results ({testResults.vendors.length} total):
                      </h3>
                      <div className="space-y-2 max-h-48 overflow-y-auto">
                        {testResults.vendors.slice(0, 10).map((result: any, idx: number) => (
                          <div key={idx} className="bg-gray-50 rounded p-3 text-xs border border-gray-200">
                            <div className="flex items-start justify-between gap-2 mb-1">
                              <div className="flex items-center gap-2">
                                {result.entityType === 'staff' ? (
                                  <span className="text-purple-600 font-semibold">👤 {testResults.roleConfig?.staffLabel?.slice(0, -1) || 'Staff'}</span>
                                ) : (
                                  <span className="text-orange-600 font-semibold">🏢 {testResults.roleConfig?.centerLabel?.slice(0, -1) || 'Center'}</span>
                                )}
                                <span className="font-semibold text-gray-900">
                                  {result.name || result.businessName || result.centerName}
                                </span>
                              </div>
                            </div>
                            {result.entityType === 'staff' && result.centerName && (
                              <div className="text-gray-600 mb-1">
                                at {result.centerName}
                              </div>
                            )}
                            <div className="text-gray-600">
                              {result.specialization && (
                                <span className="mr-2">🎓 {result.specialization}</span>
                              )}
                              {result.consultationFee && (
                                <span className="mr-2">₹{result.consultationFee}</span>
                              )}
                              {result.serviceStyles && result.serviceStyles.length > 0 && (
                                <span>{result.serviceStyles.join(', ')}</span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Status Badge */}
                  <div className="pt-4 border-t border-gray-200">
                    {testResults.totalVendors > 0 ? (
                      <div className="flex items-center gap-2 text-green-600">
                        <CheckCircle className="w-5 h-5" />
                        <span className="font-semibold">✅ Mapping is working correctly!</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-red-600">
                        <XCircle className="w-5 h-5" />
                        <span className="font-semibold">⚠️ No vendors found for this problem</span>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-red-600">
                  <XCircle className="w-12 h-12 mx-auto mb-2" />
                  <p className="font-semibold">Test Failed</p>
                  <p className="text-sm">{testResults.error}</p>
                </div>
              )}
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}