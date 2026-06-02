'use client';

import React from 'react';

export type PreviewPlatform = 'android' | 'ios' | 'customer' | 'vendor';

interface CampaignPreviewProps {
  title: string;
  message: string;
  ctaText: string;
  imageUrl?: string;
  targetApp: 'CUSTOMER' | 'VENDOR';
  platform: PreviewPlatform;
}

function PhoneFrame({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-2">
      <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</span>
      <div className="w-[220px] h-[420px] rounded-[28px] border-4 border-gray-800 bg-gray-900 p-2 shadow-xl">
        <div className="w-full h-full rounded-[20px] bg-gray-100 overflow-hidden relative">
          {children}
        </div>
      </div>
    </div>
  );
}

export function CampaignPreview({
  title,
  message,
  ctaText,
  imageUrl,
  targetApp,
  platform,
}: CampaignPreviewProps) {
  const appLabel = targetApp === 'VENDOR' ? 'Warmpawz Vendor' : 'Warmpawz';

  const notificationCard = (
    <div className="mx-3 mt-3 rounded-xl bg-white shadow-md border border-gray-200 overflow-hidden">
      {imageUrl && (
        <div
          className="h-20 bg-cover bg-center"
          style={{ backgroundImage: `url(${imageUrl})` }}
        />
      )}
      <div className="p-3">
        <div className="flex items-start gap-2">
          <div className="w-8 h-8 rounded-lg bg-orange-500 flex items-center justify-center text-white text-xs font-bold shrink-0">
            WP
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] text-gray-500">{appLabel}</p>
            <p className="text-sm font-semibold text-gray-900 truncate">{title || 'Notification title'}</p>
            <p className="text-xs text-gray-600 mt-0.5 line-clamp-3">{message || 'Message preview…'}</p>
            {ctaText && (
              <p className="text-xs font-medium text-orange-600 mt-2">{ctaText}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  if (platform === 'android') {
    return (
      <PhoneFrame label="Android">
        <div className="bg-gradient-to-b from-blue-100 to-gray-200 h-full pt-8">
          <p className="text-center text-[10px] text-gray-500 mb-2">Status bar</p>
          {notificationCard}
        </div>
      </PhoneFrame>
    );
  }

  if (platform === 'ios') {
    return (
      <PhoneFrame label="iOS">
        <div className="bg-gradient-to-b from-slate-200 to-slate-300 h-full">
          <div className="pt-10 px-3">
            <p className="text-[10px] text-center text-gray-500 mb-3">Notification Center</p>
            <div className="rounded-2xl bg-white/90 backdrop-blur shadow-lg overflow-hidden">
              {notificationCard}
            </div>
          </div>
        </div>
      </PhoneFrame>
    );
  }

  if (platform === 'vendor') {
    return (
      <PhoneFrame label="Vendor App">
        <div className="bg-white h-full">
          <div className="bg-orange-500 text-white px-3 py-3 text-sm font-semibold">Vendor Dashboard</div>
          <div className="p-2">{notificationCard}</div>
        </div>
      </PhoneFrame>
    );
  }

  return (
    <PhoneFrame label="Customer App">
      <div className="bg-white h-full">
        <div className="bg-orange-500 text-white px-3 py-3 text-sm font-semibold">Home</div>
        <div className="p-2">{notificationCard}</div>
      </div>
    </PhoneFrame>
  );
}
