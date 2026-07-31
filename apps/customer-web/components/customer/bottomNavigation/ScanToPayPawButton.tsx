'use client';

import { cn } from '@/components/ui/utils';

/** Provided PAY BILL paw asset — do not redraw; scale only. */
const PAY_BILL_PAW_ASSET = '/icons/pay-bill-paw-button.png';

export type ScanToPayPawButtonProps = {
  active: boolean;
  onClick: () => void;
};

/**
 * Center FAB — zero layout height; floats above the tab bar via absolute positioning.
 * Asset unchanged; only CSS placement.
 */
export function ScanToPayPawButton({ active, onClick }: ScanToPayPawButtonProps) {
  return (
    <div className="relative h-0 w-full overflow-visible">
      <button
        type="button"
        onClick={onClick}
        aria-label="Pay Bill"
        aria-current={active ? 'page' : undefined}
        className={cn(
          'absolute bottom-0 left-1/2 z-20 flex min-h-[72px] min-w-[72px] -translate-x-1/2 -translate-y-2.5 cursor-pointer items-center justify-center overflow-visible',
          'transition-transform duration-200 ease-out',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF8C42] focus-visible:ring-offset-2',
          active && 'scale-105',
        )}
      >
        <span
          className={cn(
            'overflow-hidden rounded-[20px]',
            'transition-[filter] duration-200 ease-out',
            active
              ? 'drop-shadow-[0_10px_30px_rgba(255,107,0,0.38)]'
              : 'drop-shadow-[0_10px_30px_rgba(255,107,0,0.20)]',
          )}
        >
          <img
            src={PAY_BILL_PAW_ASSET}
            alt=""
            aria-hidden
            draggable={false}
            className="pointer-events-none block h-auto w-[70px] max-w-none select-none"
          />
        </span>
      </button>
    </div>
  );
}
