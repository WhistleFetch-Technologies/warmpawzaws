'use client';

import React from 'react';
import { Phone } from 'lucide-react';
import { TeleTrackerProps } from './constants/interface';


const TeleTracker = ({ hasActiveCall, activeVideoCalls, joinCall }: TeleTrackerProps) => {
    if (!hasActiveCall || activeVideoCalls.length === 0) return null;

    const call = activeVideoCalls[0];

    return (
        <div className="fixed bottom-[72px] left-1/2 -translate-x-1/2 z-40 w-[calc(100%-2rem)] max-w-customer">
            <div className="bg-gradient-to-r from-[#FF8C42] to-[#FF6B35] rounded-2xl px-4 py-3 shadow-lg flex items-center gap-3">
                <div className="relative flex-shrink-0">
                    <Phone className="w-5 h-5 text-white" />
                    <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-white text-sm font-semibold truncate">Continue Tele Call</p>
                    <p className="text-white/80 text-xs truncate">{call.vendorName}</p>
                </div>
                <button
                    onClick={() => joinCall(call)}
                    className="flex-shrink-0 bg-white text-[#FF8C42] px-4 py-2 rounded-xl text-sm font-semibold"
                >
                    Join
                </button>
            </div>
        </div>
    );
};

export default TeleTracker;
