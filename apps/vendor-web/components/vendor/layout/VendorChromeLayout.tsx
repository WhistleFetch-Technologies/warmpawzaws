'use client';

import {
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { cn } from '@/components/ui/utils';

export type VendorChromeLayoutProps = {
  /** Renders in a fixed top bar; height is measured for main padding */
  header?: ReactNode;
  /** Renders in a fixed bottom bar; height is measured for main padding */
  footer?: ReactNode;
  children: ReactNode;
  className?: string;
  mainClassName?: string;
};

/**
 * Full-viewport shell: fixed header + fixed footer (optional), single scrollable main.
 * Header/footer heights are measured with ResizeObserver so main padding stays accurate.
 */
export function VendorChromeLayout({
  header,
  footer,
  children,
  className,
  mainClassName,
}: VendorChromeLayoutProps) {
  const headerRef = useRef<HTMLDivElement | null>(null);
  const footerRef = useRef<HTMLDivElement | null>(null);
  const [headerH, setHeaderH] = useState(0);
  const [footerH, setFooterH] = useState(0);

  useLayoutEffect(() => {
    const measure = () => {
      setHeaderH(headerRef.current?.offsetHeight ?? 0);
      setFooterH(footerRef.current?.offsetHeight ?? 0);
    };

    measure();

    const ro = new ResizeObserver(() => {
      measure();
    });

    const hEl = headerRef.current;
    const fEl = footerRef.current;
    if (hEl) ro.observe(hEl);
    if (fEl) ro.observe(fEl);

    window.addEventListener('orientationchange', measure);
    window.addEventListener('resize', measure);

    return () => {
      ro.disconnect();
      window.removeEventListener('orientationchange', measure);
      window.removeEventListener('resize', measure);
    };
  }, [header, footer]);

  return (
    <div
      className={cn(
        'flex h-[100dvh] max-h-[100dvh] min-h-0 w-full flex-col overflow-hidden bg-gray-50',
        className,
      )}
    >
      {header != null ? (
        <div
          ref={headerRef}
          className="fixed left-0 right-0 top-0 z-[var(--vendor-z-chrome)] w-full"
        >
          {header}
        </div>
      ) : null}

      {footer != null ? (
        <div
          ref={footerRef}
          className="fixed bottom-0 left-0 right-0 z-[var(--vendor-z-chrome)] w-full"
        >
          {footer}
        </div>
      ) : null}

      <main
        data-vendor-chrome-main
        className={cn(
          'min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-y-contain',
          mainClassName,
        )}
        style={{
          paddingTop: header != null ? headerH : 0,
          paddingBottom: footer != null ? footerH : 0,
        }}
      >
        {children}
      </main>
    </div>
  );
}
