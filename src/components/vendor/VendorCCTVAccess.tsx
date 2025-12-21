import { useState, useEffect } from 'react';
import { Camera, Play, Pause, Download, RefreshCw, X, Video, Clock, MapPin, Settings, Trash2 } from 'lucide-react';
import { projectId, publicAnonKey } from '../../utils/supabase/info';
import { toast } from 'sonner@2.0.3';

interface CCTVCamera {
  id: string;
  vendorId: string;
  name: string;
  location: string;
  streamUrl: string;
  snapshotUrl?: string;
  isOnline: boolean;
  cameraType: 'indoor' | 'outdoor' | 'entrance' | 'play_area' | 'kennel';
  resolution: string;
  hasRecording: boolean;
  lastSnapshot?: string;
  createdAt: string;
}

interface SharedAccess {
  id: string;
  cameraId: string;
  customerId: string;
  customerName: string;
  petName: string;
  bookingId: string;
  validFrom: string;
  validUntil: string;
  isActive: boolean;
}

interface VendorCCTVAccessProps {
  vendorId: string;
  vendorData?: any;
  onBack?: () => void;
}

export function VendorCCTVAccess({ vendorId, vendorData, onBack }: VendorCCTVAccessProps) {
  const [cameras, setCameras] = useState<CCTVCamera[]>([]);
  const [sharedAccess, setSharedAccess] = useState<SharedAccess[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCamera, setSelectedCamera] = useState<CCTVCamera | null>(null);
  const [activeTab, setActiveTab] = useState<'cameras' | 'shared'>('cameras');
  const [addCameraModal, setAddCameraModal] = useState(false);
  const [shareModal, setShareModal] = useState(false);
  const [selectedCameraForShare, setSelectedCameraForShare] = useState<CCTVCamera | null>(null);
  const [editingCamera, setEditingCamera] = useState<CCTVCamera | null>(null); // ✅ LIFECYCLE FIX: Track editing state
  // ✅ FIX Bug 4: Use React state for edit form instead of uncontrolled inputs
  const [editFormData, setEditFormData] = useState({ name: '', location: '', streamUrl: '' });

  const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475`;

  useEffect(() => {
    fetchCameras();
    fetchSharedAccess();
  }, [vendorId]);

  const fetchCameras = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE}/vendor/cctv/${vendorId}/cameras`, {
        headers: { 'Authorization': `Bearer ${publicAnonKey}` }
      });

      if (response.ok) {
        const data = await response.json();
        // ✅ FIX: Handle standardized response format
        // Response format: { success: true, cameras: [...], total: ... }
        setCameras(data.cameras || data.data?.cameras || []);
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        console.error('Failed to fetch cameras:', errorData);
        toast.error(errorData.error || 'Failed to load cameras');
        setCameras([]);
      }
    } catch (error: any) {
      console.error('Error fetching cameras:', error);
      const errorMessage = error?.message || 'Failed to load cameras. Please try again.';
      toast.error(errorMessage);
      setCameras([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchSharedAccess = async () => {
    try {
      const response = await fetch(`${API_BASE}/vendor/cctv/${vendorId}/shared`, {
        headers: { 'Authorization': `Bearer ${publicAnonKey}` }
      });

      if (response.ok) {
        const data = await response.json();
        // ✅ FIX: Handle standardized response format
        // Response format: { success: true, shared: [...], total: ... }
        setSharedAccess(data.shared || data.data?.shared || []);
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        console.error('Failed to fetch shared access:', errorData);
        // Don't show toast for shared access - it's not critical
        setSharedAccess([]);
      }
    } catch (error: any) {
      console.error('Error fetching shared access:', error);
      // Don't show toast for shared access - it's not critical
      setSharedAccess([]);
    }
  };

  const refreshSnapshot = async (cameraId: string) => {
    try {
      const response = await fetch(`${API_BASE}/vendor/cctv/${vendorId}/cameras/${cameraId}/snapshot`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${publicAnonKey}` }
      });

      if (response.ok) {
        toast.success('Snapshot refreshed successfully');
        await fetchCameras(); // ✅ Ensure cameras reload
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error occurred' }));
        const errorMessage = errorData.error || errorData.message || 'Failed to refresh snapshot';
        toast.error(errorMessage);
      }
    } catch (error: any) {
      console.error('Error refreshing snapshot:', error);
      const errorMessage = error?.message || 'Network error. Please check your connection and try again.';
      toast.error(errorMessage);
    }
  };

  // ✅ LIFECYCLE FIX: Add delete camera handler
  const handleDeleteCamera = async (cameraId: string, cameraName: string) => {
    if (!confirm(`Are you sure you want to delete "${cameraName}"? This action cannot be undone.`)) {
      return;
    }

    try {
      const response = await fetch(`${API_BASE}/vendor/cctv/${vendorId}/${cameraId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${publicAnonKey}` }
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          toast.success(`Camera "${cameraName}" deleted successfully`);
          await fetchCameras(); // ✅ Ensure cameras reload
        } else {
          const errorMessage = data.error || data.message || 'Failed to delete camera';
          toast.error(errorMessage);
        }
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error occurred' }));
        const errorMessage = errorData.error || errorData.message || 'Failed to delete camera';
        toast.error(errorMessage);
      }
    } catch (error: any) {
      console.error('Error deleting camera:', error);
      const errorMessage = error?.message || 'Network error. Please check your connection and try again.';
      toast.error(errorMessage);
    }
  };

  // ✅ LIFECYCLE FIX: Add update camera handler
  const handleUpdateCamera = async (cameraId: string, updates: Partial<CCTVCamera>) => {
    try {
      const response = await fetch(`${API_BASE}/vendor/cctv/${vendorId}/${cameraId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${publicAnonKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updates)
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          toast.success('Camera updated successfully');
          await fetchCameras(); // ✅ Ensure cameras reload
          setAddCameraModal(false);
          setSelectedCamera(null);
          setEditingCamera(null); // ✅ FIX Bug 4: Reset editing state
          setEditFormData({ name: '', location: '', streamUrl: '' }); // ✅ FIX Bug 4: Reset form data
        } else {
          const errorMessage = data.error || data.message || 'Failed to update camera';
          toast.error(errorMessage);
        }
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error occurred' }));
        const errorMessage = errorData.error || errorData.message || 'Failed to update camera';
        toast.error(errorMessage);
      }
    } catch (error: any) {
      console.error('Error updating camera:', error);
      const errorMessage = error?.message || 'Network error. Please check your connection and try again.';
      toast.error(errorMessage);
    }
  };

  const getCameraIcon = (type: CCTVCamera['cameraType']) => {
    const icons = {
      indoor: '🏠',
      outdoor: '🌳',
      entrance: '🚪',
      play_area: '⚽',
      kennel: '🏚️'
    };
    return icons[type] || '📹';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Camera className="w-12 h-12 text-orange-500 animate-pulse mx-auto mb-3" />
          <p className="text-gray-600">Loading cameras...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="w-full max-w-[430px] mx-auto bg-white min-h-screen">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 z-10">
          <div className="p-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                {onBack && (
                  <button onClick={onBack} className="text-gray-600">
                    <X className="w-6 h-6" />
                  </button>
                )}
                <div>
                  <h1 className="text-xl font-bold text-gray-900">CCTV Monitoring</h1>
                  <p className="text-sm text-gray-500">
                    {cameras.filter(c => c.isOnline).length} of {cameras.length} cameras online
                  </p>
                </div>
              </div>
              <button
                onClick={() => setAddCameraModal(true)}
                className="bg-orange-500 text-white px-4 py-2 rounded-lg text-sm hover:bg-orange-600"
              >
                Add Camera
              </button>
            </div>

            {/* Tabs */}
            <div className="flex gap-2">
              <button
                onClick={() => setActiveTab('cameras')}
                className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  activeTab === 'cameras'
                    ? 'bg-orange-500 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                My Cameras ({cameras.length})
              </button>
              <button
                onClick={() => setActiveTab('shared')}
                className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  activeTab === 'shared'
                    ? 'bg-orange-500 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                Shared Access ({sharedAccess.length})
              </button>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-4">
          {activeTab === 'cameras' ? (
            <>
              {cameras.length === 0 ? (
                <div className="text-center py-12">
                  <Camera className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">No Cameras Added</h3>
                  <p className="text-gray-500 mb-4">Add CCTV cameras to monitor your facility</p>
                  <button
                    onClick={() => setAddCameraModal(true)}
                    className="bg-orange-500 text-white px-6 py-2 rounded-lg hover:bg-orange-600"
                  >
                    Add First Camera
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {cameras.map(camera => (
                    <div key={camera.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                      {/* Camera Preview */}
                      <div className="relative aspect-video bg-gray-900">
                        {camera.snapshotUrl || camera.lastSnapshot ? (
                          <img
                            src={camera.snapshotUrl || camera.lastSnapshot}
                            alt={camera.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Video className="w-16 h-16 text-gray-600" />
                          </div>
                        )}
                        
                        {/* Status Badge */}
                        <div className={`absolute top-3 left-3 px-2 py-1 rounded-full text-xs font-medium flex items-center gap-1 ${
                          camera.isOnline
                            ? 'bg-green-500 text-white'
                            : 'bg-red-500 text-white'
                        }`}>
                          <div className={`w-2 h-2 rounded-full ${camera.isOnline ? 'bg-white' : 'bg-white'} animate-pulse`} />
                          {camera.isOnline ? 'Online' : 'Offline'}
                        </div>

                        {/* Camera Type */}
                        <div className="absolute top-3 right-3 bg-black bg-opacity-60 text-white px-2 py-1 rounded-full text-xs">
                          {getCameraIcon(camera.cameraType)} {camera.cameraType.replace('_', ' ')}
                        </div>

                        {/* Controls */}
                        <div className="absolute bottom-3 right-3 flex gap-2">
                          <button
                            onClick={() => refreshSnapshot(camera.id)}
                            className="p-2 bg-black bg-opacity-60 text-white rounded-full hover:bg-opacity-80"
                            title="Refresh snapshot"
                          >
                            <RefreshCw className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setSelectedCamera(camera)}
                            className="p-2 bg-orange-500 text-white rounded-full hover:bg-orange-600"
                            title="Watch live"
                          >
                            <Play className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {/* Camera Info */}
                      <div className="p-4">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1">
                            <h3 className="font-semibold text-gray-900">{camera.name}</h3>
                            <div className="flex items-center gap-1 text-sm text-gray-500 mt-1">
                              <MapPin className="w-3 h-3" />
                              {camera.location}
                            </div>
                          </div>
                          <button
                            onClick={() => {
                              setSelectedCameraForShare(camera);
                              setShareModal(true);
                            }}
                            className="text-sm text-orange-500 hover:text-orange-600 font-medium"
                          >
                            Share
                          </button>
                        </div>

                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4 text-xs text-gray-500">
                            <span>{camera.resolution}</span>
                            {camera.hasRecording && (
                              <span className="flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                Recording
                              </span>
                            )}
                          </div>
                          {/* ✅ LIFECYCLE FIX: Add Edit and Delete buttons */}
                          <div className="flex gap-2">
                            <button
                              onClick={() => {
                                setEditingCamera(camera);
                                // ✅ FIX Bug 4: Initialize form data when editing starts
                                setEditFormData({
                                  name: camera.name,
                                  location: camera.location,
                                  streamUrl: camera.streamUrl
                                });
                                setAddCameraModal(true); // Reuse add modal for editing
                              }}
                              className="px-3 py-1.5 text-sm text-orange-600 hover:text-orange-700 hover:bg-orange-50 rounded-lg border border-orange-200"
                              title="Edit camera"
                            >
                              <Settings className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteCamera(camera.id, camera.name)}
                              className="px-3 py-1.5 text-sm text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg border border-red-200"
                              title="Delete camera"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <>
              {sharedAccess.length === 0 ? (
                <div className="text-center py-12">
                  <Camera className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">No Shared Access</h3>
                  <p className="text-gray-500">Share camera access with customers for their bookings</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {sharedAccess.map(access => (
                    <div key={access.id} className="bg-white border border-gray-200 rounded-lg p-4">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <h4 className="font-semibold text-gray-900">{access.customerName}</h4>
                          <p className="text-sm text-gray-600">Pet: {access.petName}</p>
                        </div>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          access.isActive
                            ? 'bg-green-100 text-green-700'
                            : 'bg-gray-100 text-gray-600'
                        }`}>
                          {access.isActive ? 'Active' : 'Expired'}
                        </span>
                      </div>
                      <div className="text-xs text-gray-500">
                        Valid: {new Date(access.validFrom).toLocaleDateString()} - {new Date(access.validUntil).toLocaleDateString()}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* Live View Modal */}
        {selectedCamera && (
          <div className="fixed inset-0 bg-black z-50">
            <div className="relative w-full h-full">
              {/* Header */}
              <div className="absolute top-0 left-0 right-0 bg-gradient-to-b from-black to-transparent p-4 z-10">
                <div className="flex items-center justify-between text-white">
                  <div>
                    <h2 className="font-semibold">{selectedCamera.name}</h2>
                    <p className="text-sm text-gray-300">{selectedCamera.location}</p>
                  </div>
                  <button onClick={() => setSelectedCamera(null)}>
                    <X className="w-6 h-6" />
                  </button>
                </div>
              </div>

              {/* Video Stream */}
              <div className="w-full h-full flex items-center justify-center">
                {selectedCamera.streamUrl ? (
                  <video
                    src={selectedCamera.streamUrl}
                    autoPlay
                    controls
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <div className="text-center text-white">
                    <Video className="w-16 h-16 mx-auto mb-4 opacity-50" />
                    <p>Live stream not available</p>
                    <p className="text-sm text-gray-400 mt-2">Showing last snapshot</p>
                    {selectedCamera.lastSnapshot && (
                      <img
                        src={selectedCamera.lastSnapshot}
                        alt="Last snapshot"
                        className="max-w-full max-h-[70vh] mt-4 mx-auto rounded"
                      />
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Add/Edit Camera Modal */}
        {addCameraModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl max-w-md w-full p-6 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-gray-900">
                  {editingCamera ? 'Edit Camera' : 'Add Camera'}
                </h2>
                <button onClick={() => {
                  setAddCameraModal(false);
                  setEditingCamera(null);
                  setEditFormData({ name: '', location: '', streamUrl: '' }); // ✅ FIX Bug 4: Reset form on close
                }}>
                  <X className="w-6 h-6 text-gray-400" />
                </button>
              </div>
              
              {editingCamera ? (
                // ✅ FIX Bug 4: Edit camera form with controlled components
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Camera Name</label>
                    <input
                      type="text"
                      value={editFormData.name}
                      onChange={(e) => setEditFormData(prev => ({ ...prev, name: e.target.value }))}
                      className="w-full border border-gray-300 rounded-lg p-2"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Location</label>
                    <input
                      type="text"
                      value={editFormData.location}
                      onChange={(e) => setEditFormData(prev => ({ ...prev, location: e.target.value }))}
                      className="w-full border border-gray-300 rounded-lg p-2"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Stream URL</label>
                    <input
                      type="text"
                      value={editFormData.streamUrl}
                      onChange={(e) => setEditFormData(prev => ({ ...prev, streamUrl: e.target.value }))}
                      className="w-full border border-gray-300 rounded-lg p-2"
                    />
                  </div>
                  <div className="flex gap-3 pt-4 border-t">
                    <button
                      type="button"
                      onClick={() => {
                        setAddCameraModal(false);
                        setEditingCamera(null);
                        setEditFormData({ name: '', location: '', streamUrl: '' }); // ✅ FIX Bug 4: Reset form on cancel
                      }}
                      className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => {
                        // ✅ FIX Bug 4: Use React state instead of document.getElementById
                        handleUpdateCamera(editingCamera.id, { 
                          name: editFormData.name || editingCamera.name,
                          location: editFormData.location || editingCamera.location,
                          streamUrl: editFormData.streamUrl || editingCamera.streamUrl
                        });
                      }}
                      className="flex-1 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600"
                    >
                      Save Changes
                    </button>
                  </div>
                </div>
              ) : (
                // Add camera (contact support)
                <>
                  <p className="text-sm text-gray-600 mb-4">
                    Contact support to configure CCTV cameras for your facility. We'll help you set up the streaming and storage.
                  </p>
                  <button
                    onClick={() => {
                      toast.info('Please contact support for CCTV setup');
                      setAddCameraModal(false);
                    }}
                    className="w-full bg-orange-500 text-white px-4 py-2 rounded-lg hover:bg-orange-600"
                  >
                    Contact Support
                  </button>
                </>
              )}
            </div>
          </div>
        )}

        {/* Share Modal */}
        {shareModal && selectedCameraForShare && (
          <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl max-w-md w-full p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-gray-900">Share Camera Access</h2>
                <button onClick={() => setShareModal(false)}>
                  <X className="w-6 h-6 text-gray-400" />
                </button>
              </div>
              <p className="text-sm text-gray-600 mb-4">
                Share access to "{selectedCameraForShare.name}" with a customer for their booking.
              </p>
              <div className="space-y-3">
                <input
                  type="text"
                  placeholder="Customer name or booking ID"
                  className="w-full border border-gray-300 rounded-lg p-2"
                />
                <button
                  onClick={() => {
                    toast.success('Camera access shared');
                    setShareModal(false);
                  }}
                  className="w-full bg-orange-500 text-white px-4 py-2 rounded-lg hover:bg-orange-600"
                >
                  Share Access
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
