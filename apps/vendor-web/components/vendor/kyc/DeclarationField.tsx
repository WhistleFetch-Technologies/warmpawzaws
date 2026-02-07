'use client';

import React, { useState } from 'react';
import { CheckCircle, AlertCircle, FileText } from 'lucide-react';
import { apiClient } from '@/lib/api-client';

interface DeclarationFieldProps {
  vendorId: string;
  declarationType: string;
  declarationText: string;
  value?: boolean;
  onChange?: (accepted: boolean) => void;
  onAccepted?: (data: { declarationType: string; acceptedAt: string }) => void;
  disabled?: boolean;
  label?: string;
  required?: boolean;
  className?: string;
}

export function DeclarationField({
  vendorId,
  declarationType,
  declarationText,
  value = false,
  onChange,
  onAccepted,
  disabled = false,
  label,
  required = true,
  className = '',
}: DeclarationFieldProps) {
  const [accepted, setAccepted] = useState(value);
  const [expanded, setExpanded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleChange = async (checked: boolean) => {
    setAccepted(checked);
    onChange?.(checked);
    setError(null);

    if (checked && vendorId) {
      setSaving(true);
      try {
        const response = await apiClient.post<{
          success: boolean;
          data?: { acceptedAt: string };
          error?: string;
        }>('/kyc/declarations', {
          vendorId,
          declarationType,
          declarationText,
          accepted: true,
        });

        if (response.success) {
          onAccepted?.({
            declarationType,
            acceptedAt: response.data?.acceptedAt || new Date().toISOString(),
          });
        } else {
          setError(response.error || 'Failed to save declaration');
          setAccepted(false);
          onChange?.(false);
        }
      } catch (err: any) {
        console.error('Error saving declaration:', err);
        setError('Failed to save declaration. Please try again.');
        setAccepted(false);
        onChange?.(false);
      } finally {
        setSaving(false);
      }
    }
  };

  // Truncate text for preview
  const previewText = declarationText.length > 150 
    ? `${declarationText.slice(0, 150)}...` 
    : declarationText;

  return (
    <div className={`space-y-2 ${className}`}>
      {/* Label */}
      {label && (
        <label className="block text-sm font-medium text-gray-700">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}

      {/* Declaration box */}
      <div className={`border rounded-lg overflow-hidden ${
        accepted 
          ? 'border-green-300 bg-green-50' 
          : error 
            ? 'border-red-300 bg-red-50' 
            : 'border-gray-200 bg-gray-50'
      }`}>
        {/* Checkbox and preview */}
        <label className="flex items-start gap-3 p-4 cursor-pointer hover:bg-opacity-80 transition-colors">
          <div className="flex-shrink-0 pt-0.5">
            <input
              type="checkbox"
              checked={accepted}
              onChange={(e) => handleChange(e.target.checked)}
              disabled={disabled || saving}
              className="w-5 h-5 rounded border-gray-300 text-[#FF8C42] focus:ring-[#FF8C42] disabled:opacity-50"
            />
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-start gap-2">
              <FileText className={`w-5 h-5 flex-shrink-0 ${accepted ? 'text-green-600' : 'text-gray-400'}`} />
              <div>
                <p className={`text-sm ${accepted ? 'text-green-800' : 'text-gray-700'}`}>
                  {expanded ? declarationText : previewText}
                </p>
                
                {declarationText.length > 150 && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      setExpanded(!expanded);
                    }}
                    className="text-xs text-[#FF8C42] hover:underline mt-1"
                  >
                    {expanded ? 'Show less' : 'Read full declaration'}
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Status indicator */}
          <div className="flex-shrink-0">
            {saving ? (
              <div className="w-5 h-5 border-2 border-[#FF8C42] border-t-transparent rounded-full animate-spin" />
            ) : accepted ? (
              <CheckCircle className="w-5 h-5 text-green-600" />
            ) : null}
          </div>
        </label>

        {/* Accepted timestamp */}
        {accepted && !saving && (
          <div className="px-4 pb-3 pt-0">
            <p className="text-xs text-green-600 flex items-center gap-1">
              <CheckCircle className="w-3 h-3" />
              Declaration accepted
            </p>
          </div>
        )}
      </div>

      {/* Error message */}
      {error && (
        <div className="flex items-start gap-2 text-sm text-red-600">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Required note */}
      {required && !accepted && !error && (
        <p className="text-xs text-gray-500">
          You must accept this declaration to proceed.
        </p>
      )}
    </div>
  );
}

export default DeclarationField;
