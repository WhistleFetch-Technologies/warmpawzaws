'use client';

import React, { memo, forwardRef } from 'react';

export interface HorizontalScrollRowProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  /** Gap between items in Tailwind scale. Default gap-2.5 */
  gapClassName?: string;
  /** Inner padding-x. Default px-4 */
  paddingClassName?: string;
}

const HorizontalScrollRowInner = forwardRef<HTMLDivElement, HorizontalScrollRowProps>(
  function HorizontalScrollRow(
    { children, className = '', gapClassName = 'gap-2.5', paddingClassName = 'px-4', ...rest },
    ref
  ) {
    return (
      <div
        ref={ref}
        className={`flex min-w-0 overflow-x-auto scrollbar-hide ${paddingClassName} ${gapClassName} ${className}`}
        {...rest}
      >
        {children}
      </div>
    );
  }
);

/** Horizontally scrollable row with hidden scrollbar — matches home page conventions. */
export const HorizontalScrollRow = memo(HorizontalScrollRowInner);
