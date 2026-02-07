import React, { useState, useEffect } from 'react';
import { Button } from '../ui/button';
import {
  Video,
  Star,
  Award,
  Clock,
  Globe,
  CheckCircle,
  Users,
  Loader2
} from 'lucide-react';
import { toast } from 'sonner';
import { getApiBaseUrl, getAuthHeaders } from '../../utils/api-config';

const BASE_URL = `${getApiBaseUrl()}`;

interface StaffMember {
  staffId: string;
  name: string;
  qualifications: string[];
  experience: number;
  specializations: string[];
  languages: string[];
  rating: number;
  totalConsultations: number;
  profilePhoto?: string;
  consultationFee: number;
  availability: string;
}

interface InstantStaffListProps {
  roleId: string;
  onStaffView: (staff: StaffMember) => void;
  onProceedToPayment: (consultationFee: number) => void;
}

export function InstantStaffList({
  roleId,
  onStaffView,
  onProceedToPayment
}: InstantStaffListProps) {
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [roleName, setRoleName] = useState('');
  const [selectedStaff, setSelectedStaff] = useState<StaffMember | null>(null);

  useEffect(() => {
    fetchAvailableStaff();
  }, [roleId]);

  const fetchAvailableStaff = async () => {
    setLoading(true);
    try {
      const response = await fetch(
        `${BASE_URL}/tele-services/instant/available-staff?roleId=${roleId}`,
        {
          headers: getAuthHeaders()
        }
      );

      if (response.ok) {
        const data = await response.json();
        setStaff(data.staff || []);
        setRoleName(data.roleName || roleId);
      } else {
        toast.error('Failed to load available staff');
      }
    } catch (error) {
      console.error('Error fetching staff:', error);
      toast.error('Error loading staff');
    } finally {
      setLoading(false);
    }
  };

  const handleProceed = () => {
    if (staff.length > 0) {
      // Use the fee from the highest rated staff (first in list)
      onProceedToPayment(staff[0].consultationFee);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-xl border-2 border-gray-200 p-8">
        <div className="flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-orange-600 animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl border-2 border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-2xl font-bold text-gray-900 mb-1">
              Available {roleName}s
            </h3>
            <p className="text-gray-600">
              {staff.length > 0 
                ? `${staff.length} expert${staff.length > 1 ? 's' : ''} available now`
                : 'No staff available at the moment'}
            </p>
          </div>
          
          <div className="flex items-center gap-2 px-4 py-2 bg-green-50 rounded-lg border border-green-200">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            <span className="text-sm font-medium text-green-700">Live</span>
          </div>
        </div>

        {staff.length > 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm text-blue-800">
              💡 <strong>Instant Assignment:</strong> Once you complete payment, we'll assign you to the best available {roleName.toLowerCase()} based on ratings and specialization.
            </p>
          </div>
        )}
      </div>

      {/* Staff List */}
      {staff.length === 0 ? (
        <div className="bg-white rounded-xl border-2 border-gray-200 p-12 text-center">
          <Video className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="font-bold text-gray-900 mb-2">No Staff Available</h3>
          <p className="text-gray-600 mb-4">
            All {roleName.toLowerCase()}s are currently busy. You can join the queue and we'll notify you when someone becomes available.
          </p>
          <Button
            onClick={() => onProceedToPayment(500)}
            className="bg-orange-600 hover:bg-orange-700"
          >
            Join Queue
          </Button>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-6">
          {staff.map((member) => (
            <div
              key={member.staffId}
              className={`bg-white rounded-xl border-2 overflow-hidden transition-all ${
                selectedStaff?.staffId === member.staffId
                  ? 'border-orange-600 shadow-lg'
                  : 'border-gray-200 hover:border-orange-300'
              }`}
            >
              {/* Staff Header */}
              <div className="p-6 bg-gradient-to-br from-orange-500 to-orange-600 text-white">
                <div className="flex items-start gap-4">
                  <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center flex-shrink-0 overflow-hidden">
                    {member.profilePhoto ? (
                      <img 
                        src={member.profilePhoto} 
                        alt={member.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-orange-100 flex items-center justify-center">
                        <span className="text-2xl font-bold text-orange-600">
                          {member.name.charAt(0)}
                        </span>
                      </div>
                    )}
                  </div>
                  
                  <div className="flex-1">
                    <h3 className="font-bold text-xl mb-1">{member.name}</h3>
                    <div className="flex items-center gap-2 mb-2">
                      <div className="flex items-center gap-1">
                        <Star className="w-4 h-4 fill-yellow-300 text-yellow-300" />
                        <span className="font-medium">{member.rating.toFixed(1)}</span>
                      </div>
                      <span className="text-orange-100">•</span>
                      <div className="flex items-center gap-1">
                        <Users className="w-4 h-4" />
                        <span className="text-sm">{member.totalConsultations} consultations</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Clock className="w-4 h-4" />
                      <span className="text-sm">{member.experience} years experience</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Staff Details */}
              <div className="p-6 space-y-4">
                {/* Qualifications */}
                {member.qualifications.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <Award className="w-4 h-4 text-blue-600" />
                      <h4 className="font-medium text-gray-900">Qualifications</h4>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {member.qualifications.map((qual, idx) => (
                        <span
                          key={idx}
                          className="px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-sm"
                        >
                          {qual}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Specializations */}
                {member.specializations.length > 0 && (
                  <div>
                    <h4 className="font-medium text-gray-900 mb-2">Specializations</h4>
                    <div className="flex flex-wrap gap-2">
                      {member.specializations.map((spec, idx) => (
                        <span
                          key={idx}
                          className="px-3 py-1 bg-green-50 text-green-700 rounded-full text-sm"
                        >
                          {spec}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Languages */}
                {member.languages.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2">
                      <Globe className="w-4 h-4 text-gray-500" />
                      <span className="text-sm text-gray-600">
                        Languages: {member.languages.join(', ')}
                      </span>
                    </div>
                  </div>
                )}

                {/* Availability & Fee */}
                <div className="pt-4 border-t border-gray-200">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-green-500 rounded-full" />
                      <span className="text-sm font-medium text-green-700">
                        Available Now
                      </span>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-gray-900">
                        ₹{member.consultationFee}
                      </p>
                      <p className="text-xs text-gray-500">per consultation</p>
                    </div>
                  </div>

                  <Button
                    onClick={() => {
                      setSelectedStaff(member);
                      onStaffView(member);
                    }}
                    className="w-full bg-orange-600 hover:bg-orange-700"
                  >
                    <Video className="w-4 h-4 mr-2" />
                    Select & Continue
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Proceed to Payment */}
      {staff.length > 0 && (
        <div className="bg-white rounded-xl border-2 border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-gray-900 mb-1">
                Ready to Consult?
              </h3>
              <p className="text-sm text-gray-600">
                {selectedStaff 
                  ? `You've selected ${selectedStaff.name}` 
                  : 'We\'ll assign the best available expert'}
              </p>
            </div>
            
            <Button
              onClick={handleProceed}
              className="bg-green-600 hover:bg-green-700"
              size="lg"
            >
              <CheckCircle className="w-5 h-5 mr-2" />
              Proceed to Payment
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
