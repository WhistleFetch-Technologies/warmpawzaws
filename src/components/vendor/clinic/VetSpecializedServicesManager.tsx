import { useState, useEffect } from 'react';
import { 
  ArrowLeft, 
  Ambulance, 
  Microscope, 
  AlertCircle, 
  Plus,
  Edit2,
  Trash2,
  Clock,
  DollarSign,
  MapPin,
  Phone,
  Check,
  X,
  Pill // ✅ NEW: Pharmacy icon
} from 'lucide-react';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Card } from '../../ui/card';
import { Badge } from '../../ui/badge';
import { toast } from 'sonner';
import { projectId, publicAnonKey } from '../../../utils/supabase/info';
import { authenticatedFetch } from '../../../utils/session-manager'; // ✅ FIX: Use authenticated fetch for write operations
import { VetPharmacyManager } from './VetPharmacyManager'; // ✅ NEW: Import pharmacy manager
import { AmbulanceEditModal } from './modals/AmbulanceEditModal'; // ✅ Import edit modals
import { DiagnosticEditModal } from './modals/DiagnosticEditModal';
import { EmergencyProtocolEditModal } from './modals/EmergencyProtocolEditModal';

interface VetSpecializedServicesManagerProps {
  vendorId: string;
  vendorData: any;
  onBack: () => void;
}

interface AmbulanceService {
  id: string;
  vehicleNumber: string;
  driverName: string;
  driverPhone: string;
  basePrice: number;
  pricePerKm: number;
  availability: 'available' | 'busy' | 'offline';
  currentLocation?: string;
  lastUpdated: string;
}

interface DiagnosticTest {
  id: string;
  testName: string;
  category: 'blood' | 'urine' | 'xray' | 'ultrasound' | 'other';
  price: number;
  duration: number; // in minutes
  requiresFasting: boolean;
  description: string;
  isActive: boolean;
}

interface EmergencyProtocol {
  id: string;
  protocolName: string;
  severity: 'critical' | 'high' | 'medium';
  responseTime: number; // in minutes
  requiredEquipment: string[];
  steps: string[];
  isActive: boolean;
}

type ActiveTab = 'ambulance' | 'diagnostics' | 'emergency' | 'pharmacy'; // ✅ NEW: Add pharmacy tab

export function VetSpecializedServicesManager({ 
  vendorId, 
  vendorData, 
  onBack 
}: VetSpecializedServicesManagerProps) {
  const [activeTab, setActiveTab] = useState<ActiveTab>('ambulance');
  const [ambulances, setAmbulances] = useState<AmbulanceService[]>([]);
  const [diagnostics, setDiagnostics] = useState<DiagnosticTest[]>([]);
  const [emergencyProtocols, setEmergencyProtocols] = useState<EmergencyProtocol[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  
  // ✅ FIX: Add state for editing
  const [editingAmbulance, setEditingAmbulance] = useState<AmbulanceService | null>(null);
  const [editingDiagnostic, setEditingDiagnostic] = useState<DiagnosticTest | null>(null);
  const [editingProtocol, setEditingProtocol] = useState<EmergencyProtocol | null>(null);

  useEffect(() => {
    loadServices();
  }, [vendorId]);

  const loadServices = async () => {
    try {
      setLoading(true);
      
      // ✅ FIXED: Load ambulance services using standardized backwards-compatible endpoint
      const ambulanceRes = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/vendor/${vendorId}/ambulance-services`,
        { headers: { 'Authorization': `Bearer ${publicAnonKey}` } }
      );
      
      if (ambulanceRes.ok) {
        const data = await ambulanceRes.json();
        // ✅ FIX: Handle standardized response format from backwards-compatible-endpoints
        // Response format: { success: true, ambulances: [...], total: ... }
        setAmbulances(data.ambulances || data.data?.ambulances || []);
      }

      // ✅ FIXED: Load diagnostic tests using standardized backwards-compatible endpoint
      const diagRes = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/vendor/${vendorId}/diagnostic-tests`,
        { headers: { 'Authorization': `Bearer ${publicAnonKey}` } }
      );
      
      if (diagRes.ok) {
        const data = await diagRes.json();
        // ✅ FIX: Handle standardized response format
        // Response format: { success: true, tests: [...], total: ... }
        setDiagnostics(data.tests || data.data?.tests || []);
      }

      // ✅ FIXED: Load emergency protocols using standardized backwards-compatible endpoint
      const emergRes = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/vendor/${vendorId}/emergency-protocols`,
        { headers: { 'Authorization': `Bearer ${publicAnonKey}` } }
      );
      
      if (emergRes.ok) {
        const data = await emergRes.json();
        // ✅ FIX: Handle standardized response format
        // Response format: { success: true, protocols: [...], total: ... }
        setEmergencyProtocols(data.protocols || data.data?.protocols || []);
      }

    } catch (error: any) {
      console.error('Error loading vet services:', error);
      const errorMessage = error?.message || 'Failed to load specialized services. Please try again.';
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // ✅ FIX: Add edit handler for ambulance
  const handleEditAmbulance = (ambulance: AmbulanceService) => {
    setEditingAmbulance(ambulance);
    setShowAddModal(true);
  };

  // ✅ FIX: Implement EDIT functionality for ambulance with comprehensive error handling
  const handleSaveAmbulance = async (ambulanceData: Partial<AmbulanceService>) => {
    try {
      const url = editingAmbulance
        ? `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/vendor/${vendorId}/ambulance-services/${editingAmbulance.id}`
        : `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/vendor/${vendorId}/ambulance-services`;

      // ✅ FIX: Use authenticatedFetch instead of manual fetch with publicAnonKey
      const response = await authenticatedFetch(url, {
        method: editingAmbulance ? 'PUT' : 'POST',
        body: JSON.stringify(ambulanceData)
      });

      if (response.ok) {
        const result = await response.json();
        toast.success(editingAmbulance ? 'Ambulance updated successfully' : 'Ambulance added successfully');
        setEditingAmbulance(null);
        setShowAddModal(false);
        await loadServices(); // ✅ Ensure services reload before closing
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error occurred' }));
        const errorMessage = errorData.error || errorData.message || `Failed to ${editingAmbulance ? 'update' : 'add'} ambulance`;
        toast.error(errorMessage);
        throw new Error(errorMessage);
      }
    } catch (error: any) {
      console.error('Error saving ambulance:', error);
      const errorMessage = error?.message || 'Network error. Please check your connection and try again.';
      toast.error(errorMessage);
      throw error; // Re-throw to let modal handle it
    }
  };

  // ✅ FIX: Add delete handler for ambulance with better confirmation and error handling
  const handleDeleteAmbulance = async (ambulanceId: string) => {
    const ambulance = ambulances.find(a => a.id === ambulanceId);
    const vehicleNumber = ambulance?.vehicleNumber || 'this ambulance';
    
    if (!confirm(`Are you sure you want to delete ${vehicleNumber}? This action cannot be undone.`)) {
      return;
    }

    try {
      // ✅ FIX: Use authenticatedFetch instead of manual fetch with publicAnonKey
      const response = await authenticatedFetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/vendor/${vendorId}/ambulance-services/${ambulanceId}`,
        {
          method: 'DELETE'
        }
      );

      if (response.ok) {
        toast.success(`Ambulance ${vehicleNumber} deleted successfully`);
        await loadServices(); // ✅ Ensure services reload
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error occurred' }));
        const errorMessage = errorData.error || errorData.message || 'Failed to delete ambulance';
        toast.error(errorMessage);
      }
    } catch (error: any) {
      console.error('Error deleting ambulance:', error);
      const errorMessage = error?.message || 'Network error. Please check your connection and try again.';
      toast.error(errorMessage);
    }
  };

  // ✅ FIX: Add edit handler for diagnostic test
  const handleEditDiagnostic = (diagnostic: DiagnosticTest) => {
    setEditingDiagnostic(diagnostic);
    setShowAddModal(true);
  };

  // ✅ ADD: Save handler for diagnostic tests with comprehensive error handling
  const handleSaveDiagnostic = async (diagnosticData: Partial<DiagnosticTest>) => {
    try {
      const url = editingDiagnostic
        ? `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/vendor/${vendorId}/diagnostic-tests/${editingDiagnostic.id}`
        : `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/vendor/${vendorId}/diagnostic-tests`;

      // ✅ FIX: Use authenticatedFetch instead of manual fetch with publicAnonKey
      const response = await authenticatedFetch(url, {
        method: editingDiagnostic ? 'PUT' : 'POST',
        body: JSON.stringify(diagnosticData)
      });

      if (response.ok) {
        const result = await response.json();
        toast.success(editingDiagnostic ? 'Diagnostic test updated successfully' : 'Diagnostic test added successfully');
        setEditingDiagnostic(null);
        setShowAddModal(false);
        await loadServices(); // ✅ Ensure services reload before closing
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error occurred' }));
        const errorMessage = errorData.error || errorData.message || `Failed to ${editingDiagnostic ? 'update' : 'add'} diagnostic test`;
        toast.error(errorMessage);
        throw new Error(errorMessage);
      }
    } catch (error: any) {
      console.error('Error saving diagnostic test:', error);
      const errorMessage = error?.message || 'Network error. Please check your connection and try again.';
      toast.error(errorMessage);
      throw error; // Re-throw to let modal handle it
    }
  };

  // ✅ FIX: Add delete handler for diagnostic test with better confirmation and error handling
  const handleDeleteDiagnostic = async (testId: string) => {
    const test = diagnostics.find(t => t.id === testId);
    const testName = test?.testName || 'this diagnostic test';
    
    if (!confirm(`Are you sure you want to delete "${testName}"? This action cannot be undone.`)) {
      return;
    }

    try {
      // ✅ FIX: Use authenticatedFetch instead of manual fetch with publicAnonKey
      const response = await authenticatedFetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/vendor/${vendorId}/diagnostic-tests/${testId}`,
        {
          method: 'DELETE'
        }
      );

      if (response.ok) {
        toast.success(`Diagnostic test "${testName}" deleted successfully`);
        await loadServices(); // ✅ Ensure services reload
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error occurred' }));
        const errorMessage = errorData.error || errorData.message || 'Failed to delete diagnostic test';
        toast.error(errorMessage);
      }
    } catch (error: any) {
      console.error('Error deleting diagnostic test:', error);
      const errorMessage = error?.message || 'Network error. Please check your connection and try again.';
      toast.error(errorMessage);
    }
  };

  // ✅ FIX: Add edit handler for emergency protocol
  const handleEditProtocol = (protocol: EmergencyProtocol) => {
    setEditingProtocol(protocol);
    setShowAddModal(true);
  };

  // ✅ ADD: Save handler for emergency protocols with comprehensive error handling
  const handleSaveProtocol = async (protocolData: Partial<EmergencyProtocol>) => {
    try {
      const url = editingProtocol
        ? `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/vendor/${vendorId}/emergency-protocols/${editingProtocol.id}`
        : `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/vendor/${vendorId}/emergency-protocols`;

      // ✅ FIX: Use authenticatedFetch instead of manual fetch with publicAnonKey
      const response = await authenticatedFetch(url, {
        method: editingProtocol ? 'PUT' : 'POST',
        body: JSON.stringify(protocolData)
      });

      if (response.ok) {
        const result = await response.json();
        toast.success(editingProtocol ? 'Emergency protocol updated successfully' : 'Emergency protocol added successfully');
        setEditingProtocol(null);
        setShowAddModal(false);
        await loadServices(); // ✅ Ensure services reload before closing
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error occurred' }));
        const errorMessage = errorData.error || errorData.message || `Failed to ${editingProtocol ? 'update' : 'add'} emergency protocol`;
        toast.error(errorMessage);
        throw new Error(errorMessage);
      }
    } catch (error: any) {
      console.error('Error saving emergency protocol:', error);
      const errorMessage = error?.message || 'Network error. Please check your connection and try again.';
      toast.error(errorMessage);
      throw error; // Re-throw to let modal handle it
    }
  };

  // ✅ FIX: Add delete handler for emergency protocol with better confirmation and error handling
  const handleDeleteProtocol = async (protocolId: string) => {
    const protocol = emergencyProtocols.find(p => p.id === protocolId);
    const protocolName = protocol?.protocolName || 'this emergency protocol';
    
    if (!confirm(`Are you sure you want to delete "${protocolName}"? This action cannot be undone.`)) {
      return;
    }

    try {
      // ✅ FIX: Use authenticatedFetch instead of manual fetch with publicAnonKey
      const response = await authenticatedFetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/vendor/${vendorId}/emergency-protocols/${protocolId}`,
        {
          method: 'DELETE'
        }
      );

      if (response.ok) {
        toast.success(`Emergency protocol "${protocolName}" deleted successfully`);
        await loadServices(); // ✅ Ensure services reload
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error occurred' }));
        const errorMessage = errorData.error || errorData.message || 'Failed to delete emergency protocol';
        toast.error(errorMessage);
      }
    } catch (error: any) {
      console.error('Error deleting emergency protocol:', error);
      const errorMessage = error?.message || 'Network error. Please check your connection and try again.';
      toast.error(errorMessage);
    }
  };

  const renderAmbulanceServices = () => (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="font-semibold text-gray-900">Ambulance Services</h2>
          <p className="text-sm text-gray-600">Manage your emergency ambulance fleet</p>
        </div>
        <Button 
          onClick={() => setShowAddModal(true)}
          className="bg-red-600 hover:bg-red-700 text-white"
        >
          <Plus className="w-4 h-4 mr-1" />
          Add Ambulance
        </Button>
      </div>

      {ambulances.length === 0 ? (
        <Card className="p-8 text-center">
          <Ambulance className="w-12 h-12 text-gray-400 mx-auto mb-3" />
          <h3 className="font-semibold text-gray-900 mb-2">No Ambulances Added</h3>
          <p className="text-sm text-gray-600 mb-4">
            Add ambulance vehicles to provide emergency services
          </p>
          <Button onClick={() => setShowAddModal(true)}>
            Add Your First Ambulance
          </Button>
        </Card>
      ) : (
        <div className="space-y-3">
          {ambulances.map((ambulance) => (
            <Card key={ambulance.id} className="p-4">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center">
                    <Ambulance className="w-6 h-6 text-red-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">{ambulance.vehicleNumber}</h3>
                    <p className="text-sm text-gray-600">{ambulance.driverName}</p>
                  </div>
                </div>
                <Badge 
                  className={
                    ambulance.availability === 'available' 
                      ? 'bg-green-100 text-green-700' 
                      : ambulance.availability === 'busy'
                      ? 'bg-yellow-100 text-yellow-700'
                      : 'bg-gray-100 text-gray-700'
                  }
                >
                  {ambulance.availability.toUpperCase()}
                </Badge>
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="flex items-center gap-2 text-gray-600">
                  <Phone className="w-4 h-4" />
                  {ambulance.driverPhone}
                </div>
                <div className="flex items-center gap-2 text-gray-600">
                  <DollarSign className="w-4 h-4" />
                  ₹{ambulance.basePrice} + ₹{ambulance.pricePerKm}/km
                </div>
                {ambulance.currentLocation && (
                  <div className="flex items-center gap-2 text-gray-600 col-span-2">
                    <MapPin className="w-4 h-4" />
                    {ambulance.currentLocation}
                  </div>
                )}
              </div>

              <div className="flex gap-2 mt-3 pt-3 border-t">
                <Button variant="outline" size="sm" className="flex-1" onClick={() => handleEditAmbulance(ambulance)}>
                  <Edit2 className="w-3 h-3 mr-1" />
                  Edit
                </Button>
                <Button variant="outline" size="sm" className="flex-1 text-red-600 hover:text-red-700" onClick={() => handleDeleteAmbulance(ambulance.id)}>
                  <Trash2 className="w-3 h-3 mr-1" />
                  Remove
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );

  const renderDiagnosticTests = () => (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="font-semibold text-gray-900">Diagnostic Tests</h2>
          <p className="text-sm text-gray-600">Manage available diagnostic services</p>
        </div>
        <Button 
          onClick={() => setShowAddModal(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white"
        >
          <Plus className="w-4 h-4 mr-1" />
          Add Test
        </Button>
      </div>

      {diagnostics.length === 0 ? (
        <Card className="p-8 text-center">
          <Microscope className="w-12 h-12 text-gray-400 mx-auto mb-3" />
          <h3 className="font-semibold text-gray-900 mb-2">No Diagnostic Tests</h3>
          <p className="text-sm text-gray-600 mb-4">
            Add diagnostic tests to offer comprehensive care
          </p>
          <Button onClick={() => setShowAddModal(true)}>
            Add Your First Test
          </Button>
        </Card>
      ) : (
        <div className="space-y-3">
          {diagnostics.map((test) => (
            <Card key={test.id} className="p-4">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3 flex-1">
                  <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Microscope className="w-6 h-6 text-blue-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-gray-900 truncate">{test.testName}</h3>
                    <p className="text-sm text-gray-600 capitalize">{test.category}</p>
                  </div>
                </div>
                <Badge className={test.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}>
                  {test.isActive ? 'Active' : 'Inactive'}
                </Badge>
              </div>

              <div className="space-y-2 text-sm text-gray-600 mb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <DollarSign className="w-4 h-4" />
                    <span>Price:</span>
                  </div>
                  <span className="font-semibold text-gray-900">₹{test.price}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    <span>Duration:</span>
                  </div>
                  <span>{test.duration} mins</span>
                </div>
                {test.requiresFasting && (
                  <div className="flex items-center gap-2 text-orange-600">
                    <AlertCircle className="w-4 h-4" />
                    <span>Requires Fasting</span>
                  </div>
                )}
              </div>

              {test.description && (
                <p className="text-xs text-gray-600 mb-3 bg-gray-50 p-2 rounded">{test.description}</p>
              )}

              <div className="flex gap-2 pt-3 border-t">
                <Button variant="outline" size="sm" className="flex-1" onClick={() => handleEditDiagnostic(test)}>
                  <Edit2 className="w-3 h-3 mr-1" />
                  Edit
                </Button>
                <Button variant="outline" size="sm" className="flex-1 text-red-600 hover:text-red-700" onClick={() => handleDeleteDiagnostic(test.id)}>
                  <Trash2 className="w-3 h-3 mr-1" />
                  Remove
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );

  const renderEmergencyProtocols = () => (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="font-semibold text-gray-900">Emergency Protocols</h2>
          <p className="text-sm text-gray-600">Define standard emergency procedures</p>
        </div>
        <Button 
          onClick={() => setShowAddModal(true)}
          className="bg-orange-600 hover:bg-orange-700 text-white"
        >
          <Plus className="w-4 h-4 mr-1" />
          Add Protocol
        </Button>
      </div>

      {emergencyProtocols.length === 0 ? (
        <Card className="p-8 text-center">
          <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-3" />
          <h3 className="font-semibold text-gray-900 mb-2">No Emergency Protocols</h3>
          <p className="text-sm text-gray-600 mb-4">
            Create emergency protocols for quick response
          </p>
          <Button onClick={() => setShowAddModal(true)}>
            Add Your First Protocol
          </Button>
        </Card>
      ) : (
        <div className="space-y-3">
          {emergencyProtocols.map((protocol) => (
            <Card key={protocol.id} className="p-4">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3 flex-1">
                  <div className={`w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0 ${
                    protocol.severity === 'critical' ? 'bg-red-100' :
                    protocol.severity === 'high' ? 'bg-orange-100' : 'bg-yellow-100'
                  }`}>
                    <AlertCircle className={`w-6 h-6 ${
                      protocol.severity === 'critical' ? 'text-red-600' :
                      protocol.severity === 'high' ? 'text-orange-600' : 'text-yellow-600'
                    }`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-gray-900 truncate">{protocol.protocolName}</h3>
                    <Badge className={
                      protocol.severity === 'critical' ? 'bg-red-100 text-red-700' :
                      protocol.severity === 'high' ? 'bg-orange-100 text-orange-700' : 'bg-yellow-100 text-yellow-700'
                    }>
                      {protocol.severity.toUpperCase()}
                    </Badge>
                  </div>
                </div>
                <Badge className={protocol.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}>
                  {protocol.isActive ? 'Active' : 'Inactive'}
                </Badge>
              </div>

              <div className="mb-3">
                <div className="flex items-center gap-2 text-sm text-gray-600 mb-2">
                  <Clock className="w-4 h-4" />
                  <span>Response Time: {protocol.responseTime} minutes</span>
                </div>
                
                {protocol.requiredEquipment.length > 0 && (
                  <div className="text-sm text-gray-600 mb-2">
                    <span className="font-medium">Required Equipment:</span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {protocol.requiredEquipment.map((eq, idx) => (
                        <Badge key={idx} variant="outline" className="text-xs">
                          {eq}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                <div className="text-sm text-gray-600">
                  <span className="font-medium">Steps:</span>
                  <ol className="mt-1 space-y-1 pl-4">
                    {protocol.steps.map((step, idx) => (
                      <li key={idx} className="text-xs list-decimal">{step}</li>
                    ))}
                  </ol>
                </div>
              </div>

              <div className="flex gap-2 pt-3 border-t">
                <Button variant="outline" size="sm" className="flex-1" onClick={() => handleEditProtocol(protocol)}>
                  <Edit2 className="w-3 h-3 mr-1" />
                  Edit
                </Button>
                <Button variant="outline" size="sm" className="flex-1 text-red-600 hover:text-red-700" onClick={() => handleDeleteProtocol(protocol.id)}>
                  <Trash2 className="w-3 h-3 mr-1" />
                  Remove
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );

  const renderPharmacy = () => (
    <VetPharmacyManager 
      vendorId={vendorId} 
      vendorData={vendorData}
      onBack={() => {}} // Empty since we're in a tab
      embedded={true} // ✅ NEW: Embedded mode - no header
    />
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="w-full max-w-[430px] mx-auto bg-white min-h-screen">
        {/* Header */}
        <div className="p-4 bg-gradient-to-r from-red-600 to-orange-600 text-white">
          <div className="flex items-center gap-3 mb-3">
            <button onClick={onBack} className="w-8 h-8 flex items-center justify-center">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex-1">
              <h1 className="font-semibold">Specialized Vet Services</h1>
              <p className="text-sm opacity-90">{vendorData?.businessName}</p>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-2 mt-4">
            <button
              onClick={() => setActiveTab('ambulance')}
              className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'ambulance'
                  ? 'bg-white text-red-600'
                  : 'bg-white/20 text-white hover:bg-white/30'
              }`}
            >
              <Ambulance className="w-4 h-4 mx-auto mb-1" />
              Ambulance
            </button>
            <button
              onClick={() => setActiveTab('diagnostics')}
              className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'diagnostics'
                  ? 'bg-white text-red-600'
                  : 'bg-white/20 text-white hover:bg-white/30'
              }`}
            >
              <Microscope className="w-4 h-4 mx-auto mb-1" />
              Diagnostics
            </button>
            <button
              onClick={() => setActiveTab('emergency')}
              className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'emergency'
                  ? 'bg-white text-red-600'
                  : 'bg-white/20 text-white hover:bg-white/30'
              }`}
            >
              <AlertCircle className="w-4 h-4 mx-auto mb-1" />
              Emergency
            </button>
            <button
              onClick={() => setActiveTab('pharmacy')}
              className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'pharmacy'
                  ? 'bg-white text-red-600'
                  : 'bg-white/20 text-white hover:bg-white/30'
              }`}
            >
              <Pill className="w-4 h-4 mx-auto mb-1" />
              Pharmacy
            </button>
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600 mx-auto mb-4"></div>
              <p className="text-gray-600">Loading specialized services...</p>
              <p className="text-xs text-gray-500 mt-2">Please wait</p>
            </div>
          </div>
        ) : (
          <>
            {activeTab === 'ambulance' && renderAmbulanceServices()}
            {activeTab === 'diagnostics' && renderDiagnosticTests()}
            {activeTab === 'emergency' && renderEmergencyProtocols()}
            {activeTab === 'pharmacy' && renderPharmacy()}
          </>
        )}
      </div>

      {/* ✅ MODALS: Render edit modals based on active tab */}
      {activeTab === 'ambulance' && (
        <AmbulanceEditModal
          ambulance={editingAmbulance}
          isOpen={showAddModal}
          onClose={() => {
            setShowAddModal(false);
            setEditingAmbulance(null);
          }}
          onSave={handleSaveAmbulance}
        />
      )}

      {activeTab === 'diagnostics' && (
        <DiagnosticEditModal
          diagnostic={editingDiagnostic}
          isOpen={showAddModal}
          onClose={() => {
            setShowAddModal(false);
            setEditingDiagnostic(null);
          }}
          onSave={handleSaveDiagnostic}
        />
      )}

      {activeTab === 'emergency' && (
        <EmergencyProtocolEditModal
          protocol={editingProtocol}
          isOpen={showAddModal}
          onClose={() => {
            setShowAddModal(false);
            setEditingProtocol(null);
          }}
          onSave={handleSaveProtocol}
        />
      )}
    </div>
  );
}