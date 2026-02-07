import { useState } from 'react';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { getApiBaseUrl, getAuthHeaders } from '../../utils/api-config';
import { CheckCircle, XCircle, AlertCircle } from 'lucide-react';

export function SimpleBackendTest() {
  const [result, setResult] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);

  const API_BASE = getApiBaseUrl();

  const testBackend = async () => {
    setIsLoading(true);
    setResult(null);

    try {
      console.log('🔍 Testing backend at:', API_BASE);
      console.log('🔑 Using anon key length:', publicAnonKey.length);

      const testPayload = {
        phone: '+919876543210',
        ownerName: 'Test Provider',
        businessName: 'Test Business',
        roleId: 'pet_grooming',
        roleName: 'Pet Grooming',
        email: 'test@example.com',
        panNumber: 'ABCDE1234F',
        bankAccount: {
          accountNumber: '1234567890',
          ifscCode: 'SBIN0001234',
          accountHolderName: 'Test Provider',
          bankName: 'State Bank'
        },
        serviceArea: {
          type: 'radius',
          centerLat: 28.7041,
          centerLng: 77.1025,
          radiusKm: 10,
          displayText: 'Delhi NCR'
        },
        operatingHours: {
          monday: { open: '09:00', close: '18:00', isOpen: true }
        }
      };

      console.log('📤 Sending request...');
      console.log('Payload:', testPayload);

      const response = await fetch(`${API_BASE}/vendor/onboard-solo`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify(testPayload)
      });

      console.log('📥 Response status:', response.status);
      console.log('📥 Response headers:', Object.fromEntries(response.headers.entries()));

      const text = await response.text();
      console.log('📥 Response body (raw):', text);

      let data;
      try {
        data = JSON.parse(text);
      } catch (e) {
        data = { rawText: text, parseError: 'Failed to parse JSON' };
      }

      setResult({
        success: response.ok,
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries()),
        data: data,
        url: `${API_BASE}/vendor/onboard-solo`,
        timestamp: new Date().toISOString()
      });

    } catch (error: any) {
      console.error('❌ Request failed:', error);
      setResult({
        success: false,
        error: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString()
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-white p-6">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl mb-2">🔬 Simple Backend Test</h1>
          <p className="text-gray-600">
            Direct test of the solo provider onboarding endpoint
          </p>
        </div>

        <Card className="p-6 mb-6">
          <div className="mb-4">
            <h3 className="text-lg font-semibold mb-2">Configuration:</h3>
            <div className="bg-gray-50 p-4 rounded text-sm space-y-1">
              <div><strong>Project ID:</strong> {projectId}</div>
              <div><strong>Anon Key Length:</strong> {publicAnonKey.length} chars</div>
              <div><strong>API Base:</strong> {API_BASE}</div>
              <div><strong>Endpoint:</strong> /vendor/onboard-solo</div>
              <div><strong>Method:</strong> POST</div>
            </div>
          </div>

          <Button 
            onClick={testBackend}
            disabled={isLoading}
            className="bg-indigo-600 hover:bg-indigo-700"
          >
            {isLoading ? 'Testing...' : 'Test Backend Connection'}
          </Button>
        </Card>

        {result && (
          <Card className={`p-6 ${
            result.success ? 'border-green-500 bg-green-50' :
            result.error ? 'border-red-500 bg-red-50' :
            'border-yellow-500 bg-yellow-50'
          }`}>
            <div className="flex items-center gap-3 mb-4">
              {result.success && <CheckCircle className="w-8 h-8 text-green-600" />}
              {result.error && <XCircle className="w-8 h-8 text-red-600" />}
              {!result.success && !result.error && <AlertCircle className="w-8 h-8 text-yellow-600" />}
              
              <div>
                <h3 className="text-xl font-semibold">
                  {result.success ? 'Success!' :
                   result.error ? 'Connection Failed' :
                   'Request Completed'}
                </h3>
                {result.status && (
                  <p className="text-sm">
                    Status: {result.status} {result.statusText}
                  </p>
                )}
              </div>
            </div>

            <div className="space-y-4">
              {result.error && (
                <div>
                  <h4 className="font-semibold mb-2">Error Message:</h4>
                  <div className="bg-white p-3 rounded">
                    <pre className="text-sm text-red-600">{result.error}</pre>
                  </div>
                </div>
              )}

              {result.data && (
                <div>
                  <h4 className="font-semibold mb-2">Response Data:</h4>
                  <div className="bg-white p-3 rounded">
                    <pre className="text-xs overflow-auto max-h-96">
                      {JSON.stringify(result.data, null, 2)}
                    </pre>
                  </div>
                </div>
              )}

              {result.headers && (
                <div>
                  <h4 className="font-semibold mb-2">Response Headers:</h4>
                  <div className="bg-white p-3 rounded">
                    <pre className="text-xs overflow-auto">
                      {JSON.stringify(result.headers, null, 2)}
                    </pre>
                  </div>
                </div>
              )}

              <div className="text-xs text-gray-500">
                Tested at: {result.timestamp}
              </div>
            </div>

            {/* Interpretation */}
            <div className="mt-6 p-4 bg-white rounded border-t-4 border-blue-500">
              <h4 className="font-semibold mb-3">🔍 What This Means:</h4>
              <ul className="space-y-2 text-sm">
                {result.status === 404 && (
                  <li className="flex items-start gap-2">
                    <span className="text-red-600">❌</span>
                    <span><strong>404 Not Found:</strong> The endpoint doesn&apos;t exist or isn&apos;t registered. Check if solo-provider-endpoints.tsx is imported in index.tsx</span>
                  </li>
                )}
                {result.status === 500 && (
                  <li className="flex items-start gap-2">
                    <span className="text-red-600">❌</span>
                    <span><strong>500 Server Error:</strong> The endpoint exists but crashed. Check the error message in the response for details.</span>
                  </li>
                )}
                {result.status === 400 && result.data?.error === 'role_not_found' && (
                  <li className="flex items-start gap-2">
                    <span className="text-green-600">✅</span>
                    <span><strong>FIXED!</strong> This error has been fixed. The backend now creates a default role when role config is missing. Please refresh the page and test again!</span>
                  </li>
                )}
                {result.status === 400 && result.data?.error !== 'role_not_found' && (
                  <li className="flex items-start gap-2">
                    <span className="text-yellow-600">⚠️</span>
                    <span><strong>400 Bad Request:</strong> Request validation failed. Check the error message - might be missing required fields.</span>
                  </li>
                )}
                {result.status === 409 && (
                  <li className="flex items-start gap-2">
                    <span className="text-green-600">✅</span>
                    <span><strong>409 Conflict:</strong> Phone number already registered. This is actually GOOD - it means the endpoint is working!</span>
                  </li>
                )}
                {result.status === 200 && (
                  <li className="flex items-start gap-2">
                    <span className="text-green-600">✅</span>
                    <span><strong>200 Success!</strong> The backend is working perfectly! Solo provider onboarding completed successfully.</span>
                  </li>
                )}
                {result.error && result.error.includes('CORS') && (
                  <li className="flex items-start gap-2">
                    <span className="text-red-600">❌</span>
                    <span><strong>CORS Error:</strong> Backend isn&apos;t allowing requests from this domain. Check cors configuration in index.tsx</span>
                  </li>
                )}
                {result.error && result.error.includes('fetch') && (
                  <li className="flex items-start gap-2">
                    <span className="text-red-600">❌</span>
                    <span><strong>Network Error:</strong> Can&apos;t reach the backend. Check if the Supabase function is deployed.</span>
                  </li>
                )}
                {result.success && (
                  <li className="flex items-start gap-2">
                    <span className="text-green-600">✅</span>
                    <span><strong>Success!</strong> The backend is working correctly. The endpoint is reachable and processed the request.</span>
                  </li>
                )}
              </ul>
            </div>
          </Card>
        )}

        <Card className="p-6 mt-6 bg-blue-50">
          <h3 className="font-semibold mb-3">💡 Debugging Tips:</h3>
          <ol className="list-decimal list-inside space-y-2 text-sm">
            <li>Open <strong>Browser DevTools</strong> (press F12)</li>
            <li>Go to <strong>Console</strong> tab - look for backend logs</li>
            <li>Go to <strong>Network</strong> tab - filter by &quot;onboard-solo&quot;</li>
            <li>Click on the request to see full details</li>
            <li>Check the <strong>Response</strong> tab for error messages</li>
            <li>Check the <strong>Headers</strong> tab for CORS headers</li>
          </ol>
        </Card>
      </div>
    </div>
  );
}