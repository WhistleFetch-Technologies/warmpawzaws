import { useState } from 'react';
import { ArrowLeft } from 'lucide-react';

interface AdoptionApplicationFormProps {
  phone: string;
  petData: any;
  onBack: () => void;
  onSubmit: (data: any) => void;
}

export function AdoptionApplicationForm({ phone, petData, onBack, onSubmit }: AdoptionApplicationFormProps) {
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    address: '',
    homeType: 'apartment',
    hasExperience: false,
    experienceDetails: '',
    whyAdopt: ''
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <div className="min-h-screen bg-gray-50 max-w-md mx-auto">
      <div className="bg-white sticky top-0 z-10 border-b border-gray-200">
        <div className="px-4 py-3 flex items-center gap-3">
          <button onClick={onBack} className="p-2 -ml-2 hover:bg-gray-100 rounded-full">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="font-semibold">Adoption Application</h1>
            <p className="text-sm text-gray-600">For {petData.name}</p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="p-4 space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Full Name</label>
          <input
            type="text"
            required
            value={formData.fullName}
            onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
            className="w-full p-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Email</label>
          <input
            type="email"
            required
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            className="w-full p-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Address</label>
          <textarea
            required
            value={formData.address}
            onChange={(e) => setFormData({ ...formData, address: e.target.value })}
            className="w-full p-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500"
            rows={3}
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Home Type</label>
          <select
            value={formData.homeType}
            onChange={(e) => setFormData({ ...formData, homeType: e.target.value })}
            className="w-full p-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500"
          >
            <option value="apartment">Apartment</option>
            <option value="house">House</option>
            <option value="villa">Villa</option>
          </select>
        </div>

        <div>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={formData.hasExperience}
              onChange={(e) => setFormData({ ...formData, hasExperience: e.target.checked })}
              className="w-4 h-4 text-pink-500 rounded focus:ring-pink-500"
            />
            <span className="text-sm">I have experience with pets</span>
          </label>
        </div>

        {formData.hasExperience && (
          <div>
            <label className="block text-sm font-medium mb-1">Experience Details</label>
            <textarea
              value={formData.experienceDetails}
              onChange={(e) => setFormData({ ...formData, experienceDetails: e.target.value })}
              className="w-full p-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500"
              rows={3}
            />
          </div>
        )}

        <div>
          <label className="block text-sm font-medium mb-1">Why do you want to adopt?</label>
          <textarea
            required
            value={formData.whyAdopt}
            onChange={(e) => setFormData({ ...formData, whyAdopt: e.target.value })}
            className="w-full p-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500"
            rows={4}
          />
        </div>

        <button
          type="submit"
          className="w-full bg-gradient-to-r from-pink-500 to-rose-600 text-white py-3 rounded-lg font-semibold hover:shadow-lg transition-all"
        >
          Submit Application
        </button>
      </form>
    </div>
  );
}
