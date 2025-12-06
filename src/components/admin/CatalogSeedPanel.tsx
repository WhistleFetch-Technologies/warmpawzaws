import { useState } from 'react';
import { Button } from '../ui/button';
import { projectId, publicAnonKey } from '../../utils/supabase/info';
import { Database, AlertTriangle, CheckCircle2 } from 'lucide-react';

export function CatalogSeedPanel() {
  const [seeding, setSeeding] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const handleSeedVeterinaryServices = async () => {
    if (!confirm('This will seed 101 comprehensive veterinary services across 10 subcategories. Continue?')) return;
    
    try {
      setSeeding(true);
      setResult(null);
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/admin/catalog/seed-veterinary-services`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`
          }
        }
      );
      
      if (response.ok) {
        const data = await response.json();
        setResult(`Success! Seeded ${data.stats.totalServices} veterinary services across ${data.stats.totalSubCategories} subcategories`);
      } else {
        setResult('Failed to seed veterinary services');
      }
    } catch (error) {
      console.error('Error seeding veterinary services:', error);
      setResult('Error seeding veterinary services');
    } finally {
      setSeeding(false);
    }
  };

  const handleSeedAllServices = async () => {
    if (!confirm('This will seed 150+ services across ALL categories (Veterinary, Grooming, Training, Walking). This may replace existing services. Continue?')) return;
    
    try {
      setSeeding(true);
      setResult(null);
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/admin/catalog/seed-all-services`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`
          }
        }
      );
      
      if (response.ok) {
        const data = await response.json();
        const breakdown = data.stats.breakdown.map((b: any) => 
          `${b.category}: ${b.services} services`
        ).join('\n');
        setResult(`Success! Seeded ${data.stats.totalServices} services across ${data.stats.categoriesSeeded} categories\n\n${breakdown}`);
      } else {
        setResult('Failed to seed all services');
      }
    } catch (error) {
      console.error('Error seeding all services:', error);
      setResult('Error seeding all services');
    } finally {
      setSeeding(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">Catalog Seeding</h3>
        <p className="text-sm text-gray-500">Use these tools to populate the database with initial data.</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
              <Database className="w-5 h-5" />
            </div>
            <h4 className="font-medium">Veterinary Services</h4>
          </div>
          <p className="text-sm text-gray-600 mb-4">
            Seeds 101 comprehensive veterinary services organized into 10 subcategories.
          </p>
          <Button 
            onClick={handleSeedVeterinaryServices}
            disabled={seeding}
            className="w-full bg-blue-600 hover:bg-blue-700"
          >
            {seeding ? 'Seeding...' : 'Seed Vet Services'}
          </Button>
        </div>

        <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-purple-50 text-purple-600 rounded-lg">
              <Database className="w-5 h-5" />
            </div>
            <h4 className="font-medium">All Services</h4>
          </div>
          <p className="text-sm text-gray-600 mb-4">
            Seeds 150+ services across all major categories including Grooming, Training, etc.
          </p>
          <Button 
            onClick={handleSeedAllServices}
            disabled={seeding}
            className="w-full bg-purple-600 hover:bg-purple-700"
          >
            {seeding ? 'Seeding...' : 'Seed All Services'}
          </Button>
        </div>
      </div>

      {result && (
        <div className={`p-4 rounded-lg border ${result.includes('Success') ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
          <div className="flex items-start gap-3">
            {result.includes('Success') ? (
              <CheckCircle2 className="w-5 h-5 mt-0.5" />
            ) : (
              <AlertTriangle className="w-5 h-5 mt-0.5" />
            )}
            <div className="whitespace-pre-line">{result}</div>
          </div>
        </div>
      )}
      
      <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
        <div className="flex gap-3">
          <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0" />
          <div>
            <h5 className="font-medium text-yellow-800">Warning</h5>
            <p className="text-sm text-yellow-700 mt-1">
              Seeding operations may overwrite existing data or create duplicates if not handled carefully. 
              Only use these tools during development or initial setup.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
