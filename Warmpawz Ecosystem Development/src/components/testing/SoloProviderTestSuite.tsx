import { useState } from 'react';
import { CheckCircle, XCircle, Clock, Play, RefreshCw, AlertCircle } from 'lucide-react';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { Badge } from '../ui/badge';
import { projectId, publicAnonKey } from '../../utils/supabase/info';
import { toast } from 'sonner@2.0.3';

interface TestResult {
  name: string;
  status: 'pending' | 'running' | 'passed' | 'failed';
  message?: string;
  duration?: number;
  data?: any;
}

export function SoloProviderTestSuite() {
  const [testResults, setTestResults] = useState<TestResult[]>([
    { name: 'Solo Provider Onboarding', status: 'pending' },
    { name: 'Vendor/Center/Staff Creation', status: 'pending' },
    { name: 'Phone Index Creation', status: 'pending' },
    { name: 'Solo Provider Login', status: 'pending' },
    { name: 'Dashboard Mode Detection', status: 'pending' },
    { name: 'Service Auto-Sync (Add)', status: 'pending' },
    { name: 'Service Auto-Sync (Update)', status: 'pending' },
    { name: 'Service Auto-Sync (Delete)', status: 'pending' },
    { name: 'Booking Auto-Assignment', status: 'pending' },
    { name: 'Staff Mode Booking View', status: 'pending' },
  ]);

  const [testData, setTestData] = useState({
    vendorId: '',
    centerId: '',
    staffId: '',
    phone: '',
    serviceId: '',
    bookingId: '',
  });

  const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475`;

  const updateTest = (index: number, updates: Partial<TestResult>) => {
    setTestResults(prev => {
      const newResults = [...prev];
      newResults[index] = { ...newResults[index], ...updates };
      return newResults;
    });
  };

  // TEST 1: Solo Provider Onboarding
  const testOnboarding = async () => {
    const testIndex = 0;
    updateTest(testIndex, { status: 'running' });
    const startTime = Date.now();

    try {
      const phone = `+91${Math.floor(9000000000 + Math.random() * 1000000000)}`;
      
      const response = await fetch(`${API_BASE}/vendor/onboard-solo`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${publicAnonKey}`
        },
        body: JSON.stringify({
          ownerName: 'Test Solo Provider',
          businessName: 'Test Mobile Grooming',
          phone: phone,
          email: 'test@solo.com',
          roleId: 'pet_grooming',
          roleName: 'Pet Grooming',
          panNumber: 'ABCDE1234F',
          bankAccount: {
            accountNumber: '1234567890',
            ifscCode: 'SBIN0001234',
            accountHolderName: 'Test Solo Provider',
            bankName: 'State Bank of India'
          },
          serviceArea: {
            type: 'radius',
            centerLat: 28.7041,
            centerLng: 77.1025,
            radiusKm: 10,
            displayText: 'Delhi NCR (10 km radius)'
          },
          operatingHours: {
            monday: { open: '09:00', close: '18:00', isOpen: true },
            tuesday: { open: '09:00', close: '18:00', isOpen: true },
            wednesday: { open: '09:00', close: '18:00', isOpen: true },
            thursday: { open: '09:00', close: '18:00', isOpen: true },
            friday: { open: '09:00', close: '18:00', isOpen: true },
            saturday: { open: '10:00', close: '16:00', isOpen: true },
            sunday: { open: false, close: false, isOpen: false }
          }
        })
      });

      const data = await response.json();
      const duration = Date.now() - startTime;

      if (data.success) {
        setTestData(({
          vendorId: data.vendorId,
          centerId: data.centerId,
          staffId: data.staffId,
          phone: phone,
          serviceId: '',
          bookingId: ''
        }));

        updateTest(testIndex, {
          status: 'passed',
          message: `Created vendor, center, and staff successfully`,
          duration,
          data: { vendorId: data.vendorId, centerId: data.centerId, staffId: data.staffId }
        });
        toast.success('✅ Onboarding test passed!');
      } else {
        throw new Error(data.error || 'Onboarding failed');
      }
    } catch (error: any) {
      updateTest(testIndex, {
        status: 'failed',
        message: error.message,
        duration: Date.now() - startTime
      });
      toast.error('❌ Onboarding test failed');
    }
  };

  // TEST 2: Verify Vendor/Center/Staff Creation
  const testEntityCreation = async () => {
    const testIndex = 1;
    updateTest(testIndex, { status: 'running' });
    const startTime = Date.now();

    try {
      if (!testData.vendorId) {
        throw new Error('Run onboarding test first');
      }

      // Fetch vendor
      const vendorRes = await fetch(`${API_BASE}/vendor/${testData.vendorId}`, {
        headers: { 'Authorization': `Bearer ${publicAnonKey}` }
      });
      const vendorData = await vendorRes.json();

      // Fetch center
      const centerRes = await fetch(`${API_BASE}/center/${testData.centerId}`, {
        headers: { 'Authorization': `Bearer ${publicAnonKey}` }
      });
      const centerData = await centerRes.json();

      // Fetch staff
      const staffRes = await fetch(`${API_BASE}/center/${testData.centerId}/staff/${testData.staffId}`, {
        headers: { 'Authorization': `Bearer ${publicAnonKey}` }
      });
      const staffData = await staffRes.json();

      const duration = Date.now() - startTime;

      // Verify flags
      const checks = [
        { name: 'Vendor has isSoloProvider: true', result: vendorData.vendor?.isSoloProvider === true },
        { name: 'Center has isVirtualCenter: true', result: centerData.center?.isVirtualCenter === true },
        { name: 'Staff has isAutoCreated: true', result: staffData.staff?.isAutoCreated === true },
        { name: 'All use same phone', result: vendorData.vendor?.phone === centerData.center?.phone && centerData.center?.phone === staffData.staff?.phone },
        { name: 'Center linked to vendor', result: centerData.center?.vendorId === testData.vendorId },
        { name: 'Staff linked to center', result: staffData.staff?.centerId === testData.centerId }
      ];

      const allPassed = checks.every(c => c.result);

      if (allPassed) {
        updateTest(testIndex, {
          status: 'passed',
          message: 'All entities created correctly with proper flags',
          duration,
          data: checks
        });
        toast.success('✅ Entity creation test passed!');
      } else {
        const failed = checks.filter(c => !c.result).map(c => c.name).join(', ');
        throw new Error(`Failed checks: ${failed}`);
      }
    } catch (error: any) {
      updateTest(testIndex, {
        status: 'failed',
        message: error.message,
        duration: Date.now() - startTime
      });
      toast.error('❌ Entity creation test failed');
    }
  };

  // TEST 3: Phone Index Creation
  const testPhoneIndex = async () => {
    const testIndex = 2;
    updateTest(testIndex, { status: 'running' });
    const startTime = Date.now();

    try {
      if (!testData.phone) {
        throw new Error('Run onboarding test first');
      }

      console.log(`[TEST 3] Looking up phone: ${testData.phone}`);
      console.log(`[TEST 3] Expected vendorId: ${testData.vendorId}`);

      const response = await fetch(`${API_BASE}/vendor/phone/${encodeURIComponent(testData.phone)}`, {
        headers: { 'Authorization': `Bearer ${publicAnonKey}` }
      });

      const data = await response.json();
      const duration = Date.now() - startTime;

      console.log(`[TEST 3] Response:`, data);
      console.log(`[TEST 3] Match check:`, {
        vendorMatch: data.vendorId === testData.vendorId,
        centerMatch: data.centerId === testData.centerId,
        staffMatch: data.staffId === testData.staffId
      });

      if (data.success && data.vendorId === testData.vendorId && data.centerId === testData.centerId && data.staffId === testData.staffId) {
        updateTest(testIndex, {
          status: 'passed',
          message: 'Phone index lookup successful',
          duration,
          data: data
        });
        toast.success('✅ Phone index test passed!');
      } else {
        throw new Error('Phone index data mismatch');
      }
    } catch (error: any) {
      updateTest(testIndex, {
        status: 'failed',
        message: error.message,
        duration: Date.now() - startTime
      });
      toast.error('❌ Phone index test failed');
    }
  };

  // TEST 4: Solo Provider Login
  const testLogin = async () => {
    const testIndex = 3;
    updateTest(testIndex, { status: 'running' });
    const startTime = Date.now();

    try {
      if (!testData.phone) {
        throw new Error('Run onboarding test first');
      }

      const response = await fetch(`${API_BASE}/vendor/solo-login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${publicAnonKey}`
        },
        body: JSON.stringify({ phone: testData.phone })
      });

      const data = await response.json();
      const duration = Date.now() - startTime;

      if (data.success && data.session?.isSoloProvider === true) {
        updateTest(testIndex, {
          status: 'passed',
          message: 'Solo provider login successful',
          duration,
          data: data.session
        });
        toast.success('✅ Login test passed!');
      } else {
        throw new Error('Login failed or not recognized as solo provider');
      }
    } catch (error: any) {
      updateTest(testIndex, {
        status: 'failed',
        message: error.message,
        duration: Date.now() - startTime
      });
      toast.error('❌ Login test failed');
    }
  };

  // TEST 5: Dashboard Mode Detection
  const testDashboardMode = async () => {
    const testIndex = 4;
    updateTest(testIndex, { status: 'running' });
    const startTime = Date.now();

    try {
      if (!testData.vendorId) {
        throw new Error('Run onboarding test first');
      }

      const response = await fetch(`${API_BASE}/vendor/${testData.vendorId}/solo-info`, {
        headers: { 'Authorization': `Bearer ${publicAnonKey}` }
      });

      const data = await response.json();
      const duration = Date.now() - startTime;

      const checks = [
        { name: 'Has vendor data', result: !!data.vendor },
        { name: 'Has center data', result: !!data.center },
        { name: 'Has staff data', result: !!data.staff },
        { name: 'isSoloProvider flag set', result: data.vendor?.isSoloProvider === true }
      ];

      const allPassed = checks.every(c => c.result);

      if (allPassed) {
        updateTest(testIndex, {
          status: 'passed',
          message: 'Solo provider info retrieved correctly',
          duration,
          data: checks
        });
        toast.success('✅ Dashboard mode test passed!');
      } else {
        const failed = checks.filter(c => !c.result).map(c => c.name).join(', ');
        throw new Error(`Failed checks: ${failed}`);
      }
    } catch (error: any) {
      updateTest(testIndex, {
        status: 'failed',
        message: error.message,
        duration: Date.now() - startTime
      });
      toast.error('❌ Dashboard mode test failed');
    }
  };

  // TEST 6: Service Auto-Sync (Add)
  const testServiceAdd = async () => {
    const testIndex = 5;
    updateTest(testIndex, { status: 'running' });
    const startTime = Date.now();

    try {
      if (!testData.vendorId) {
        throw new Error('Run onboarding test first');
      }

      // Add service
      const addResponse = await fetch(`${API_BASE}/vendor/services/add`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${publicAnonKey}`
        },
        body: JSON.stringify({
          vendorId: testData.vendorId,
          serviceData: {
            name: 'Test Grooming Service',
            description: 'Test service for auto-sync',
            price: 500,
            duration: 60,
            type: 'at_home',
            category: 'grooming'
          }
        })
      });

      const addData = await addResponse.json();

      if (!addData.success || !addData.autoSynced) {
        throw new Error('Service not auto-synced');
      }

      setTestData(prev => ({ ...prev, serviceId: addData.service.id }));

      // Verify staff has service
      const staffRes = await fetch(`${API_BASE}/center/${testData.centerId}/staff/${testData.staffId}`, {
        headers: { 'Authorization': `Bearer ${publicAnonKey}` }
      });
      const staffData = await staffRes.json();

      const duration = Date.now() - startTime;
      const hasService = staffData.staff?.services?.some((s: any) => s.id === addData.service.id);

      if (hasService) {
        updateTest(testIndex, {
          status: 'passed',
          message: 'Service added and auto-synced to staff',
          duration,
          data: { serviceId: addData.service.id, autoSynced: true }
        });
        toast.success('✅ Service add/sync test passed!');
      } else {
        throw new Error('Service not found in staff record');
      }
    } catch (error: any) {
      updateTest(testIndex, {
        status: 'failed',
        message: error.message,
        duration: Date.now() - startTime
      });
      toast.error('❌ Service add/sync test failed');
    }
  };

  // TEST 7: Service Auto-Sync (Update)
  const testServiceUpdate = async () => {
    const testIndex = 6;
    updateTest(testIndex, { status: 'running' });
    const startTime = Date.now();

    try {
      console.log(`[TEST 7] Starting service update test...`);
      console.log(`[TEST 7] testData.serviceId: "${testData.serviceId}"`);
      console.log(`[TEST 7] Full testData:`, testData);
      
      if (!testData.serviceId) {
        throw new Error('Run service add test first');
      }

      // Update service
      const updateResponse = await fetch(`${API_BASE}/vendor/services/${testData.serviceId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${publicAnonKey}`
        },
        body: JSON.stringify({
          price: 750,
          description: 'Updated test service'
        })
      });

      const updateData = await updateResponse.json();

      if (!updateData.success || !updateData.autoSynced) {
        throw new Error('Service update not auto-synced');
      }

      // Verify staff has updated service
      const staffRes = await fetch(`${API_BASE}/center/${testData.centerId}/staff/${testData.staffId}`, {
        headers: { 'Authorization': `Bearer ${publicAnonKey}` }
      });
      const staffData = await staffRes.json();

      const duration = Date.now() - startTime;
      const updatedService = staffData.staff?.services?.find((s: any) => s.id === testData.serviceId);

      if (updatedService && updatedService.price === 750) {
        updateTest(testIndex, {
          status: 'passed',
          message: 'Service updated and auto-synced to staff',
          duration,
          data: { serviceId: testData.serviceId, newPrice: 750 }
        });
        toast.success('✅ Service update/sync test passed!');
      } else {
        throw new Error('Service update not reflected in staff record');
      }
    } catch (error: any) {
      updateTest(testIndex, {
        status: 'failed',
        message: error.message,
        duration: Date.now() - startTime
      });
      toast.error('❌ Service update/sync test failed');
    }
  };

  // TEST 8: Service Auto-Sync (Delete)
  const testServiceDelete = async () => {
    const testIndex = 7;
    updateTest(testIndex, { status: 'running' });
    const startTime = Date.now();

    try {
      if (!testData.serviceId) {
        throw new Error('Run service add test first');
      }

      // Delete service
      const deleteResponse = await fetch(
        `${API_BASE}/vendor/services/${testData.serviceId}?vendorId=${testData.vendorId}&force=true`,
        {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${publicAnonKey}` }
        }
      );

      const deleteData = await deleteResponse.json();

      if (!deleteData.success) {
        throw new Error('Service delete failed');
      }

      // Wait a moment for cascade
      await new Promise(resolve => setTimeout(resolve, 500));

      // Verify staff no longer has service
      const staffRes = await fetch(`${API_BASE}/center/${testData.centerId}/staff/${testData.staffId}`, {
        headers: { 'Authorization': `Bearer ${publicAnonKey}` }
      });
      const staffData = await staffRes.json();

      const duration = Date.now() - startTime;
      const hasService = staffData.staff?.services?.some((s: any) => s.id === testData.serviceId && s.isActive !== false);

      if (!hasService) {
        updateTest(testIndex, {
          status: 'passed',
          message: 'Service deleted and removed from staff',
          duration
        });
        toast.success('✅ Service delete/sync test passed!');
      } else {
        throw new Error('Service still present in staff record');
      }
    } catch (error: any) {
      updateTest(testIndex, {
        status: 'failed',
        message: error.message,
        duration: Date.now() - startTime
      });
      toast.error('❌ Service delete/sync test failed');
    }
  };

  // TEST 9: Booking Auto-Assignment
  const testBookingAutoAssignment = async () => {
    const testIndex = 8;
    updateTest(testIndex, { status: 'running' });
    const startTime = Date.now();

    try {
      if (!testData.vendorId || !testData.serviceId) {
        throw new Error('Run previous tests first');
      }

      // Re-add a service for booking
      const serviceResponse = await fetch(`${API_BASE}/vendor/services/add`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${publicAnonKey}`
        },
        body: JSON.stringify({
          vendorId: testData.vendorId,
          serviceData: {
            name: 'Test Booking Service',
            price: 500,
            duration: 60,
            type: 'at_home',
            category: 'grooming'
          }
        })
      });

      const serviceData = await serviceResponse.json();
      const newServiceId = serviceData.service.id;

      // Create booking
      const bookingResponse = await fetch(`${API_BASE}/bookings/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${publicAnonKey}`
        },
        body: JSON.stringify({
          customerId: 'test_customer_123',
          vendorId: testData.vendorId,
          serviceId: newServiceId,
          serviceName: 'Test Booking Service',
          serviceType: 'at_home',
          bookingDate: '2025-12-15',
          bookingTime: '10:00',
          duration: 60,
          price: 500,
          customerName: 'Test Customer',
          customerPhone: '+919999999999',
          petName: 'Test Pet'
        })
      });

      const bookingData = await bookingResponse.json();
      const duration = Date.now() - startTime;

      if (bookingData.success && bookingData.booking?.staffId === testData.staffId && bookingData.booking?.autoAssigned === true) {
        setTestData(prev => ({ ...prev, bookingId: bookingData.bookingId }));
        
        updateTest(testIndex, {
          status: 'passed',
          message: 'Booking auto-assigned to solo provider staff',
          duration,
          data: { bookingId: bookingData.bookingId, staffId: testData.staffId, autoAssigned: true }
        });
        toast.success('✅ Booking auto-assignment test passed!');
      } else {
        throw new Error('Booking not auto-assigned correctly');
      }
    } catch (error: any) {
      updateTest(testIndex, {
        status: 'failed',
        message: error.message,
        duration: Date.now() - startTime
      });
      toast.error('❌ Booking auto-assignment test failed');
    }
  };

  // TEST 10: Staff Mode Booking View
  const testStaffBookingView = async () => {
    const testIndex = 9;
    updateTest(testIndex, { status: 'running' });
    const startTime = Date.now();

    try {
      if (!testData.bookingId) {
        throw new Error('Run booking test first');
      }

      const response = await fetch(`${API_BASE}/bookings/${testData.bookingId}`, {
        headers: { 'Authorization': `Bearer ${publicAnonKey}` }
      });

      const data = await response.json();
      const duration = Date.now() - startTime;

      if (data.booking && data.booking.staffId === testData.staffId) {
        updateTest(testIndex, {
          status: 'passed',
          message: 'Booking visible in staff mode',
          duration,
          data: data.booking
        });
        toast.success('✅ Staff booking view test passed!');
      } else {
        throw new Error('Booking not found or staff mismatch');
      }
    } catch (error: any) {
      updateTest(testIndex, {
        status: 'failed',
        message: error.message,
        duration: Date.now() - startTime
      });
      toast.error('❌ Staff booking view test failed');
    }
  };

  const runAllTests = async () => {
    // Test 1: Onboarding
    await testOnboarding();
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Capture IDs from state for subsequent tests
    const data = { ...testData };
    
    // Test 2: Entity Creation
    await testEntityCreation();
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Test 3: Phone Index
    await testPhoneIndex();
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Test 4: Login
    await testLogin();
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Test 5: Dashboard Mode
    await testDashboardMode();
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Test 6: Service Add - Returns serviceId
    await testServiceAdd();
    
    // CRITICAL: Wait longer for React state to update
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Test 7: Service Update - Reads serviceId from state
    await testServiceUpdate();
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Test 8: Service Delete
    await testServiceDelete();
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Test 9: Booking Auto-Assignment
    await testBookingAutoAssignment();
    
    // Wait for booking state update
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    // Test 10: Staff Booking View
    await testStaffBookingView();
  };

  const resetTests = () => {
    setTestResults(prev => prev.map(test => ({ ...test, status: 'pending', message: undefined, duration: undefined, data: undefined })));
    setTestData({
      vendorId: '',
      centerId: '',
      staffId: '',
      phone: '',
      serviceId: '',
      bookingId: ''
    });
  };

  const passedCount = testResults.filter(t => t.status === 'passed').length;
  const failedCount = testResults.filter(t => t.status === 'failed').length;
  const totalCount = testResults.length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-white p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl mb-2">🧪 Solo Provider Test Suite</h1>
          <p className="text-gray-600">
            Automated end-to-end testing for solo provider functionality
          </p>
        </div>

        {/* Test Controls */}
        <Card className="p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-2xl mb-1">Test Progress</h2>
              <p className="text-sm text-gray-600">
                {passedCount} passed • {failedCount} failed • {totalCount - passedCount - failedCount} pending
              </p>
            </div>
            <div className="flex gap-3">
              <Button onClick={runAllTests} className="bg-blue-600 hover:bg-blue-700">
                <Play className="w-4 h-4 mr-2" />
                Run All Tests
              </Button>
              <Button onClick={resetTests} variant="outline">
                <RefreshCw className="w-4 h-4 mr-2" />
                Reset
              </Button>
            </div>
          </div>

          {/* Instructions */}
          <div className="bg-yellow-50 border border-yellow-200 rounded p-4 mb-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5" />
              <div className="text-sm">
                <p className="font-semibold text-yellow-900 mb-1">⚠️ Important: Click "Run All Tests" Button</p>
                <p className="text-yellow-800">
                  Tests must run in sequence. The "Run" buttons on individual tests are for re-running specific tests AFTER running all tests once.
                </p>
              </div>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="w-full bg-gray-200 rounded-full h-3 mb-2">
            <div
              className="bg-blue-600 h-3 rounded-full transition-all duration-500"
              style={{ width: `${(passedCount / totalCount) * 100}%` }}
            />
          </div>
        </Card>

        {/* Test Data */}
        {testData.vendorId && (
          <Card className="p-6 mb-6 bg-blue-50 border-blue-200">
            <h3 className="text-lg font-semibold mb-3">📊 Test Data</h3>
            <div className="grid md:grid-cols-2 gap-4 text-sm">
              <div>
                <span className="font-semibold">Vendor ID:</span> {testData.vendorId}
              </div>
              <div>
                <span className="font-semibold">Center ID:</span> {testData.centerId}
              </div>
              <div>
                <span className="font-semibold">Staff ID:</span> {testData.staffId}
              </div>
              <div>
                <span className="font-semibold">Phone:</span> {testData.phone}
              </div>
              {testData.serviceId && (
                <div>
                  <span className="font-semibold">Service ID:</span> {testData.serviceId}
                </div>
              )}
              {testData.bookingId && (
                <div>
                  <span className="font-semibold">Booking ID:</span> {testData.bookingId}
                </div>
              )}
            </div>
          </Card>
        )}

        {/* Test Results */}
        <div className="space-y-4">
          {testResults.map((test, index) => (
            <Card key={index} className="p-6">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-4 flex-1">
                  {/* Status Icon */}
                  <div className="mt-1">
                    {test.status === 'pending' && <Clock className="w-6 h-6 text-gray-400" />}
                    {test.status === 'running' && <RefreshCw className="w-6 h-6 text-blue-600 animate-spin" />}
                    {test.status === 'passed' && <CheckCircle className="w-6 h-6 text-green-600" />}
                    {test.status === 'failed' && <XCircle className="w-6 h-6 text-red-600" />}
                  </div>

                  {/* Test Info */}
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-semibold">{test.name}</h3>
                      <Badge
                        className={
                          test.status === 'pending' ? 'bg-gray-500' :
                          test.status === 'running' ? 'bg-blue-500' :
                          test.status === 'passed' ? 'bg-green-500' :
                          'bg-red-500'
                        }
                      >
                        {test.status}
                      </Badge>
                      {test.duration && (
                        <span className="text-sm text-gray-600">
                          {test.duration}ms
                        </span>
                      )}
                    </div>

                    {test.message && (
                      <p className={`text-sm mb-2 ${test.status === 'failed' ? 'text-red-600' : 'text-gray-600'}`}>
                        {test.message}
                      </p>
                    )}

                    {test.data && (
                      <div className="bg-gray-50 rounded p-3 mt-2">
                        <pre className="text-xs overflow-auto">
                          {JSON.stringify(test.data, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                </div>

                {/* Individual Test Run Button */}
                {test.status === 'pending' && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const testFunctions = [
                        testOnboarding,
                        testEntityCreation,
                        testPhoneIndex,
                        testLogin,
                        testDashboardMode,
                        testServiceAdd,
                        testServiceUpdate,
                        testServiceDelete,
                        testBookingAutoAssignment,
                        testStaffBookingView
                      ];
                      testFunctions[index]();
                    }}
                  >
                    <Play className="w-4 h-4 mr-1" />
                    Run
                  </Button>
                )}
              </div>
            </Card>
          ))}
        </div>

        {/* Summary */}
        {passedCount + failedCount === totalCount && (
          <Card className={`p-6 mt-6 ${failedCount === 0 ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
            <div className="flex items-center gap-3">
              {failedCount === 0 ? (
                <>
                  <CheckCircle className="w-8 h-8 text-green-600" />
                  <div>
                    <h3 className="text-xl font-semibold text-green-900">
                      🎉 All Tests Passed!
                    </h3>
                    <p className="text-green-800">
                      Solo provider system is working perfectly. Ready for production!
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <AlertCircle className="w-8 h-8 text-red-600" />
                  <div>
                    <h3 className="text-xl font-semibold text-red-900">
                      Tests Completed with Errors
                    </h3>
                    <p className="text-red-800">
                      {failedCount} test{failedCount > 1 ? 's' : ''} failed. Review the errors above.
                    </p>
                  </div>
                </>
              )}
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}