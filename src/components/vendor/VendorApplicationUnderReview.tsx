import { Clock, CheckCircle, FileText, Mail, Phone } from 'lucide-react';
import { Button } from '../ui/button';
import { useEffect, useState } from 'react';

interface VendorApplicationUnderReviewProps {
  submittedAt: string;
  isReapproval?: boolean;
  reapprovalReason?: string;
}

export function VendorApplicationUnderReview({ submittedAt, isReapproval, reapprovalReason }: VendorApplicationUnderReviewProps) {
  const [timeAgo, setTimeAgo] = useState('');

  useEffect(() => {
    const calculateTimeAgo = () => {
      const now = new Date().getTime();
      const submitted = new Date(submittedAt).getTime();
      const diff = now - submitted;

      const minutes = Math.floor(diff / 60000);
      const hours = Math.floor(minutes / 60);
      const days = Math.floor(hours / 24);

      if (days > 0) {
        return `${days}d ${hours % 24}h ago`;
      } else if (hours > 0) {
        return `${hours}h ${minutes % 60}m ago`;
      } else {
        return `${minutes}m ago`;
      }
    };

    setTimeAgo(calculateTimeAgo());
    const interval = setInterval(() => {
      setTimeAgo(calculateTimeAgo());
    }, 60000); // Update every minute

    return () => clearInterval(interval);
  }, [submittedAt]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-orange-50 to-white flex items-center justify-center p-4">
      <div className="w-full max-w-[430px] space-y-6">
        {/* Clock Icon */}
        <div className="flex justify-center pt-8">
          <div className="w-24 h-24 rounded-full bg-[#FF8C42] flex items-center justify-center">
            <Clock className="w-12 h-12 text-white" strokeWidth={2.5} />
          </div>
        </div>

        {/* Title */}
        <div className="text-center space-y-2">
          <h1 className="text-2xl">
            <span className="font-bold">Application</span>
            <br />
            <span className="font-bold">Under Review</span>
          </h1>
        </div>

        {/* Main Content */}
        <div className="space-y-4">
          {/* Status Message */}
          <div className="text-center">
            <p className="text-gray-700">
              We're reviewing your WARMPAWS
              <br />
              provider application
            </p>
          </div>

          {/* Submission Time */}
          <div className="bg-white rounded-xl border border-orange-200 p-4">
            <p className="text-sm text-[#FF8C42] flex items-center justify-center gap-2">
              <Clock className="w-4 h-4" />
              Your application was submitted {timeAgo}
            </p>
          </div>

          {/* Re-approval Notice */}
          {isReapproval && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
              <h4 className="font-semibold text-sm text-blue-900 mb-2">Profile Update - Re-approval Required</h4>
              <p className="text-xs text-blue-700">
                {reapprovalReason || 'You updated your profile information. Your changes are being reviewed for approval.'}
              </p>
              <p className="text-xs text-blue-600 mt-2">
                This review is typically faster than initial applications (12-24 hours).
              </p>
            </div>
          )}

          {/* Review Process */}
          <div className="bg-white rounded-2xl p-5 shadow-sm space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-orange-100 flex items-center justify-center">
                <FileText className="w-5 h-5 text-[#FF8C42]" />
              </div>
              <h3 className="font-semibold">Review Process</h3>
            </div>

            <div className="space-y-4">
              {/* Step 1 - Completed */}
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0">
                  <CheckCircle className="w-6 h-6 text-white" />
                </div>
                <div className="flex-1 pt-1">
                  <h4 className="font-semibold text-sm">Application Submitted</h4>
                  <p className="text-xs text-gray-500">Document and profile received</p>
                </div>
              </div>

              {/* Step 2 - In Progress */}
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-gray-300 flex items-center justify-center flex-shrink-0">
                  <div className="w-6 h-6 rounded-full border-4 border-white" />
                </div>
                <div className="flex-1 pt-1">
                  <h4 className="font-semibold text-sm">Document Verification</h4>
                  <p className="text-xs text-gray-500">Checking credentials and certificates</p>
                </div>
              </div>

              {/* Step 3 - Pending */}
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0">
                  <div className="w-6 h-6 rounded-full border-4 border-white" />
                </div>
                <div className="flex-1 pt-1">
                  <h4 className="font-semibold text-sm text-gray-400">Final Approval</h4>
                  <p className="text-xs text-gray-400">Account activation and setup</p>
                </div>
              </div>
            </div>
          </div>

          {/* Expected Timeline */}
          <div className="bg-orange-50 rounded-2xl p-5 space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-white flex items-center justify-center">
                <FileText className="w-5 h-5 text-[#FF8C42]" />
              </div>
              <h3 className="font-semibold">Expected Timeline</h3>
            </div>

            <div className="space-y-2 text-sm">
              <p className="text-[#FF8C42]">
                • Most applications are reviewed within 24-48 hours
              </p>
              
              <div className="flex justify-between pt-2">
                <span className="text-gray-600">Peak hours:</span>
                <span className="font-medium">9 AM - 6 PM (Mon-Fri)</span>
              </div>
              
              <div className="flex justify-between">
                <span className="text-gray-600">Current status:</span>
                <span className="font-medium text-[#FF8C42]">Under Review</span>
              </div>
            </div>
          </div>

          {/* Support Section */}
          <div className="text-center pt-4">
            <p className="text-sm text-gray-500 mb-4">
              Need Help?
              <br />
              Have questions about your application status?
            </p>

            <div className="space-y-3">
              <Button
                variant="outline"
                className="w-full h-12 rounded-xl border-[#FF8C42] text-[#FF8C42] hover:bg-orange-50"
              >
                <Mail className="w-5 h-5 mr-2" />
                Email Support
              </Button>

              <Button
                variant="outline"
                className="w-full h-12 rounded-xl border-[#FF8C42] text-[#FF8C42] hover:bg-orange-50"
              >
                <Phone className="w-5 h-5 mr-2" />
                Call Support
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}