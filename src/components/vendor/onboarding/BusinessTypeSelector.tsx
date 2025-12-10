import { ArrowLeft, Building2, User, CheckCircle, MapPin, Home as HomeIcon } from 'lucide-react';
import { Button } from '../../ui/button';
import { Card } from '../../ui/card';
import { Badge } from '../../ui/badge';

interface BusinessTypeSelectorProps {
  selectedRole: string;
  onSelect: (isSolo: boolean) => void;
  onBack: () => void;
}

export function BusinessTypeSelector({ selectedRole, onSelect, onBack }: BusinessTypeSelectorProps) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-white p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <Button
          variant="ghost"
          onClick={onBack}
          className="mb-6"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>

        <div className="text-center mb-8">
          <h1 className="text-3xl mb-2">Select Your Business Type</h1>
          <p className="text-gray-600">
            Choose the option that best describes your {selectedRole} business
          </p>
        </div>

        {/* Business Type Cards */}
        <div className="grid md:grid-cols-2 gap-6 mb-8">
          
          {/* Solo Provider Card */}
          <Card
            className="p-6 cursor-pointer hover:shadow-xl transition-all border-2 hover:border-orange-500 relative overflow-hidden group"
            onClick={() => onSelect(true)}
          >
            <div className="absolute top-4 right-4">
              <Badge className="bg-orange-500 text-white">⭐ Recommended</Badge>
            </div>
            
            <div className="flex flex-col items-center text-center mb-4 mt-4">
              <div className="w-20 h-20 bg-orange-100 rounded-full flex items-center justify-center mb-4 group-hover:bg-orange-200 transition-colors">
                <User className="w-10 h-10 text-orange-600" />
              </div>
              <h2 className="text-2xl font-semibold mb-2">Solo Provider</h2>
              <p className="text-sm text-gray-600">
                I work independently and provide services myself
              </p>
            </div>

            <div className="space-y-3 mb-6">
              <div className="flex items-start gap-2">
                <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm">
                  <strong>One phone number</strong> - Use same number for business & operations
                </div>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm">
                  <strong>Simplified registration</strong> - No GST or shop license required
                </div>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm">
                  <strong>Privacy protected</strong> - Home address not shown to customers
                </div>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm">
                  <strong>Quick setup</strong> - Get started in 5 minutes
                </div>
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
              <p className="text-sm text-blue-800">
                <strong>Perfect for:</strong> Mobile groomers, freelance trainers, home-based pet sitters, independent vets
              </p>
            </div>

            <Button className="w-full bg-orange-600 hover:bg-orange-700 text-white">
              Continue as Solo Provider →
            </Button>
          </Card>

          {/* Business/Center Card */}
          <Card
            className="p-6 cursor-pointer hover:shadow-xl transition-all border-2 hover:border-blue-500 relative overflow-hidden group"
            onClick={() => onSelect(false)}
          >
            <div className="flex flex-col items-center text-center mb-4">
              <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mb-4 group-hover:bg-blue-200 transition-colors">
                <Building2 className="w-10 h-10 text-blue-600" />
              </div>
              <h2 className="text-2xl font-semibold mb-2">Business / Center</h2>
              <p className="text-sm text-gray-600">
                I have a physical location with staff members
              </p>
            </div>

            <div className="space-y-3 mb-6">
              <div className="flex items-start gap-2">
                <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm">
                  <strong>Multiple staff</strong> - Add and manage team members
                </div>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm">
                  <strong>Physical location</strong> - Customers visit your center
                </div>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm">
                  <strong>Business documents</strong> - GST, shop license, registrations
                </div>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm">
                  <strong>Advanced features</strong> - Inventory, multiple services, scheduling
                </div>
              </div>
            </div>

            <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 mb-4">
              <p className="text-sm text-purple-800">
                <strong>Perfect for:</strong> Pet clinics, grooming salons, training centers, pet hotels, retail stores
              </p>
            </div>

            <Button variant="outline" className="w-full border-blue-600 text-blue-600 hover:bg-blue-50">
              Continue as Business →
            </Button>
          </Card>
        </div>

        {/* Comparison Table */}
        <Card className="p-6">
          <h3 className="text-xl font-semibold mb-4 text-center">Quick Comparison</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-2">Feature</th>
                  <th className="text-center py-3 px-2 text-orange-600">Solo Provider</th>
                  <th className="text-center py-3 px-2 text-blue-600">Business/Center</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b">
                  <td className="py-3 px-2">Phone Numbers Required</td>
                  <td className="text-center py-3 px-2">1</td>
                  <td className="text-center py-3 px-2">2+</td>
                </tr>
                <tr className="border-b">
                  <td className="py-3 px-2">GST Required</td>
                  <td className="text-center py-3 px-2">No</td>
                  <td className="text-center py-3 px-2">Yes</td>
                </tr>
                <tr className="border-b">
                  <td className="py-3 px-2">Shop License</td>
                  <td className="text-center py-3 px-2">No</td>
                  <td className="text-center py-3 px-2">Yes</td>
                </tr>
                <tr className="border-b">
                  <td className="py-3 px-2">Physical Address</td>
                  <td className="text-center py-3 px-2">Hidden (Service Area)</td>
                  <td className="text-center py-3 px-2">Public</td>
                </tr>
                <tr className="border-b">
                  <td className="py-3 px-2">Staff Management</td>
                  <td className="text-center py-3 px-2">Just You</td>
                  <td className="text-center py-3 px-2">Multiple Staff</td>
                </tr>
                <tr className="border-b">
                  <td className="py-3 px-2">Setup Time</td>
                  <td className="text-center py-3 px-2">5 mins</td>
                  <td className="text-center py-3 px-2">20+ mins</td>
                </tr>
                <tr>
                  <td className="py-3 px-2">Can Upgrade Later?</td>
                  <td className="text-center py-3 px-2">✅ Yes</td>
                  <td className="text-center py-3 px-2">-</td>
                </tr>
              </tbody>
            </table>
          </div>
        </Card>

        {/* Upgrade Note */}
        <div className="mt-6 bg-green-50 border border-green-200 rounded-lg p-4 text-center">
          <p className="text-sm text-green-800">
            <strong>💡 Pro Tip:</strong> Start as a Solo Provider and upgrade to Business/Center later when you're ready to hire staff. It's easy and your data stays intact!
          </p>
        </div>
      </div>
    </div>
  );
}
