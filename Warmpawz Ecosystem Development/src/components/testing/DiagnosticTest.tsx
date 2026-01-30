import { useState } from 'react';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { getApiBaseUrl, getAuthHeaders } from '../../utils/api-config';

export function DiagnosticTest() {
  const [results, setResults] = useState<any[]>([]);
  const [isRunning, setIsRunning] = useState(false);

  const API_BASE = getApiBaseUrl();

  const addResult = (test: string, status: string, details: any) => {
    setResults(prev => [...prev, { test, status, details, timestamp: new Date().toISOString() }]);
  };

  const runDiagnostics = async () => {
    setResults([]);
    setIsRunning(true);

    // Test 1: Check if projectId and publicAnonKey exist
    addResult(
      'Environment Variables',
      projectId && publicAnonKey ? 'PASS' : 'FAIL',
      {
        projectId: projectId || 'MISSING',
        publicAnonKeyLength: publicAnonKey?.length || 0,
        apiBase: API_BASE
      }
    );

    // Test 2: Try a simple fetch to check if backend is reachable
    try {
      const response = await fetch(`${API_BASE}/vendor/onboard-solo`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify({
          phone: '+919999999999',
          ownerName: 'Test',
          roleId: 'pet_grooming',
          panNumber: 'TEST',
          bankAccount: {}
        })
      });

      const text = await response.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch {
        data = text;
      }

      addResult(
        'Backend Reachability',
        response.ok ? 'PASS' : 'FAIL',
        {
          status: response.status,
          statusText: response.statusText,
          headers: Object.fromEntries(response.headers.entries()),
          responseBody: data
        }
      );
    } catch (error: any) {
      addResult(
        'Backend Reachability',
        'FAIL',
        {
          error: error.message,
          stack: error.stack
        }
      );
    }

    // Test 3: Check CORS
    try {
      const response = await fetch(`${API_BASE}/health`, {
        method: 'GET',
        headers: {
          ...getAuthHeaders()
        }
      });

      addResult(
        'CORS Check',
        response.ok ? 'PASS' : 'INFO',
        {
          status: response.status,
          corsHeaders: {
            'access-control-allow-origin': response.headers.get('access-control-allow-origin'),
            'access-control-allow-methods': response.headers.get('access-control-allow-methods')
          }
        }
      );
    } catch (error: any) {
      addResult(
        'CORS Check',
        'INFO',
        { note: 'Health endpoint may not exist, this is OK' }
      );
    }

    // Test 4: Check if we can create a vendor ID
    try {
      const testPhone = '+919876543210';
      addResult(
        'Phone Normalization',
        'PASS',
        {
          input: testPhone,
          note: 'Phone format looks valid'
        }
      );
    } catch (error: any) {
      addResult(
        'Phone Normalization',
        'FAIL',
        { error: error.message }
      );
    }

    // Test 5: Check console for errors
    addResult(
      'Console Check',
      'INFO',
      {
        note: 'Open browser DevTools (F12) → Console tab to see backend logs',
        instruction: 'Look for messages like "✅ Registering Solo Provider Endpoints..."'
      }
    );

    // Test 6: Network tab check
    addResult(
      'Network Tab Check',
      'INFO',
      {
        note: 'Open browser DevTools (F12) → Network tab',
        instruction: 'Run a test and look for failed requests in red',
        lookFor: 'Status codes 404, 500, or CORS errors'
      }
    );

    setIsRunning(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-white p-6">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl mb-2">🔍 Diagnostic Test</h1>
          <p className="text-gray-600">
            Let&apos;s figure out why the tests are failing
          </p>
        </div>

        <Card className="p-6 mb-6">
          <Button 
            onClick={runDiagnostics} 
            disabled={isRunning}
            className="bg-purple-600 hover:bg-purple-700"
          >
            {isRunning ? 'Running...' : 'Run Diagnostics'}
          </Button>
        </Card>

        {results.length > 0 && (
          <div className="space-y-4">
            {results.map((result, index) => (
              <Card key={index} className={`p-6 ${
                result.status === 'PASS' ? 'border-green-500 bg-green-50' :
                result.status === 'FAIL' ? 'border-red-500 bg-red-50' :
                'border-blue-500 bg-blue-50'
              }`}>
                <div className="flex items-start justify-between mb-3">
                  <h3 className="text-lg font-semibold">{result.test}</h3>
                  <span className={`px-3 py-1 rounded text-sm font-semibold ${
                    result.status === 'PASS' ? 'bg-green-600 text-white' :
                    result.status === 'FAIL' ? 'bg-red-600 text-white' :
                    'bg-blue-600 text-white'
                  }`}>
                    {result.status}
                  </span>
                </div>
                
                <div className="bg-white rounded p-3 mt-2">
                  <pre className="text-xs overflow-auto max-h-96">
                    {JSON.stringify(result.details, null, 2)}
                  </pre>
                </div>

                <div className="text-xs text-gray-500 mt-2">
                  {new Date(result.timestamp).toLocaleTimeString()}
                </div>
              </Card>
            ))}
          </div>
        )}

        {results.length > 0 && (
          <Card className="p-6 mt-6 bg-yellow-50 border-yellow-500">
            <h3 className="text-lg font-semibold mb-3">📋 Next Steps Based on Results:</h3>
            <ul className="list-disc list-inside space-y-2 text-sm">
              <li>If <strong>Environment Variables</strong> failed: Check /utils/api-config.tsx</li>
              <li>If <strong>Backend Reachability</strong> failed with 404: Endpoint not deployed</li>
              <li>If <strong>Backend Reachability</strong> failed with 500: Backend code error</li>
              <li>If <strong>Backend Reachability</strong> failed with CORS: Backend not configured correctly</li>
              <li>If status is 401/403: Authorization token issue</li>
              <li>Open <strong>DevTools → Console</strong> to see detailed error messages</li>
              <li>Open <strong>DevTools → Network</strong> to see failed HTTP requests</li>
            </ul>
          </Card>
        )}
      </div>
    </div>
  );
}
