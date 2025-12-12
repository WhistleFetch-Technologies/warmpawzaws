/**
 * Performance Monitoring Utility
 * Track and log performance metrics
 */

interface PerformanceMeasure {
  name: string;
  duration: number;
  startTime: number;
  endTime: number;
}

export const PerformanceMonitor = {
  // Store for tracking ongoing measurements
  marks: new Map<string, number>(),
  measures: [] as PerformanceMeasure[],

  /**
   * Mark the start of a performance measurement
   */
  markStart: (label: string): void => {
    if (typeof performance === 'undefined') return;
    
    try {
      performance.mark(`${label}-start`);
      PerformanceMonitor.marks.set(label, performance.now());
      
      if (process.env.NODE_ENV === 'development') {
        console.log(`⏱️ [PERF] Started: ${label}`);
      }
    } catch (error) {
      console.warn('Performance marking failed:', error);
    }
  },

  /**
   * Mark the end of a performance measurement and return duration
   */
  markEnd: (label: string): number => {
    if (typeof performance === 'undefined') return 0;
    
    try {
      const startTime = PerformanceMonitor.marks.get(label);
      if (!startTime) {
        console.warn(`No start mark found for: ${label}`);
        return 0;
      }

      performance.mark(`${label}-end`);
      const endTime = performance.now();
      const duration = endTime - startTime;

      // Create performance measure
      try {
        performance.measure(label, `${label}-start`, `${label}-end`);
      } catch (error) {
        // Silently fail if measure already exists
      }

      // Store measurement
      const measure: PerformanceMeasure = {
        name: label,
        duration,
        startTime,
        endTime
      };
      PerformanceMonitor.measures.push(measure);

      // Log performance
      PerformanceMonitor.logPerformance(label, duration);

      // Clean up marks
      PerformanceMonitor.marks.delete(label);
      
      // Clean up performance entries
      try {
        performance.clearMarks(`${label}-start`);
        performance.clearMarks(`${label}-end`);
        performance.clearMeasures(label);
      } catch (error) {
        // Silently fail
      }

      return duration;
    } catch (error) {
      console.warn('Performance measurement failed:', error);
      return 0;
    }
  },

  /**
   * Log performance with appropriate level
   */
  logPerformance: (label: string, duration: number): void => {
    const thresholds = {
      excellent: 500,   // < 500ms
      good: 1000,       // < 1s
      acceptable: 2000, // < 2s
      slow: 3000,       // < 3s
      // > 3s is very slow
    };

    let level: 'excellent' | 'good' | 'acceptable' | 'slow' | 'very-slow';
    let emoji: string;
    let color: string;

    if (duration < thresholds.excellent) {
      level = 'excellent';
      emoji = '⚡';
      color = 'color: green';
    } else if (duration < thresholds.good) {
      level = 'good';
      emoji = '✅';
      color = 'color: lightgreen';
    } else if (duration < thresholds.acceptable) {
      level = 'acceptable';
      emoji = '⚠️';
      color = 'color: orange';
    } else if (duration < thresholds.slow) {
      level = 'slow';
      emoji = '🐌';
      color = 'color: darkorange';
    } else {
      level = 'very-slow';
      emoji = '🔴';
      color = 'color: red';
    }

    const message = `${emoji} [PERF] ${label}: ${duration.toFixed(2)}ms (${level})`;

    if (process.env.NODE_ENV === 'development') {
      if (level === 'slow' || level === 'very-slow') {
        console.warn(message);
      } else {
        console.log(`%c${message}`, color);
      }
    }

    // Send to analytics if slow
    if (duration > thresholds.acceptable && typeof window !== 'undefined') {
      PerformanceMonitor.sendToAnalytics(label, duration, level);
    }
  },

  /**
   * Send performance data to analytics
   */
  sendToAnalytics: (label: string, duration: number, level: string): void => {
    try {
      if (typeof window !== 'undefined' && (window as any).gtag) {
        (window as any).gtag('event', 'performance_metric', {
          event_category: 'performance',
          event_label: label,
          value: Math.round(duration),
          performance_level: level
        });
      }
    } catch (error) {
      // Silently fail
    }
  },

  /**
   * Measure async function execution time
   */
  async measureAsync<T>(
    label: string, 
    fn: () => Promise<T>
  ): Promise<T> {
    PerformanceMonitor.markStart(label);
    try {
      const result = await fn();
      PerformanceMonitor.markEnd(label);
      return result;
    } catch (error) {
      PerformanceMonitor.markEnd(label);
      throw error;
    }
  },

  /**
   * Measure sync function execution time
   */
  measure<T>(
    label: string, 
    fn: () => T
  ): T {
    PerformanceMonitor.markStart(label);
    try {
      const result = fn();
      PerformanceMonitor.markEnd(label);
      return result;
    } catch (error) {
      PerformanceMonitor.markEnd(label);
      throw error;
    }
  },

  /**
   * Get all performance measures
   */
  getMeasures: (): PerformanceMeasure[] => {
    return [...PerformanceMonitor.measures];
  },

  /**
   * Get measures by name pattern
   */
  getMeasuresByPattern: (pattern: string): PerformanceMeasure[] => {
    return PerformanceMonitor.measures.filter(m => 
      m.name.includes(pattern)
    );
  },

  /**
   * Get average duration for a metric
   */
  getAverageDuration: (label: string): number => {
    const measures = PerformanceMonitor.measures.filter(m => m.name === label);
    if (measures.length === 0) return 0;
    
    const total = measures.reduce((sum, m) => sum + m.duration, 0);
    return total / measures.length;
  },

  /**
   * Get performance summary
   */
  getSummary: (): Record<string, any> => {
    const summary: Record<string, any> = {};

    PerformanceMonitor.measures.forEach(measure => {
      if (!summary[measure.name]) {
        summary[measure.name] = {
          count: 0,
          total: 0,
          min: Infinity,
          max: -Infinity,
          avg: 0
        };
      }

      const stat = summary[measure.name];
      stat.count++;
      stat.total += measure.duration;
      stat.min = Math.min(stat.min, measure.duration);
      stat.max = Math.max(stat.max, measure.duration);
      stat.avg = stat.total / stat.count;
    });

    return summary;
  },

  /**
   * Log performance summary to console
   */
  logSummary: (): void => {
    const summary = PerformanceMonitor.getSummary();
    
    console.group('📊 Performance Summary');
    Object.entries(summary).forEach(([name, stats]: [string, any]) => {
      console.log(
        `${name}:`,
        `avg=${stats.avg.toFixed(2)}ms`,
        `min=${stats.min.toFixed(2)}ms`,
        `max=${stats.max.toFixed(2)}ms`,
        `count=${stats.count}`
      );
    });
    console.groupEnd();
  },

  /**
   * Clear all stored measures
   */
  clearMeasures: (): void => {
    PerformanceMonitor.measures = [];
    PerformanceMonitor.marks.clear();
  },

  /**
   * Track Core Web Vitals
   */
  trackWebVitals: (): void => {
    if (typeof window === 'undefined' || typeof performance === 'undefined') {
      return;
    }

    // First Contentful Paint (FCP)
    try {
      const fcpEntry = performance.getEntriesByName('first-contentful-paint')[0];
      if (fcpEntry) {
        console.log(`🎨 FCP: ${fcpEntry.startTime.toFixed(2)}ms`);
        PerformanceMonitor.sendToAnalytics('FCP', fcpEntry.startTime, 
          fcpEntry.startTime < 1800 ? 'good' : 'needs-improvement'
        );
      }
    } catch (error) {
      // Not available
    }

    // Largest Contentful Paint (LCP)
    try {
      const observer = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const lastEntry = entries[entries.length - 1];
        if (lastEntry) {
          console.log(`🖼️ LCP: ${lastEntry.startTime.toFixed(2)}ms`);
          PerformanceMonitor.sendToAnalytics('LCP', lastEntry.startTime,
            lastEntry.startTime < 2500 ? 'good' : 'needs-improvement'
          );
        }
      });
      observer.observe({ entryTypes: ['largest-contentful-paint'] });
    } catch (error) {
      // Not supported
    }

    // First Input Delay (FID) - requires user interaction
    try {
      const observer = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach((entry: any) => {
          const fid = entry.processingStart - entry.startTime;
          console.log(`⌨️ FID: ${fid.toFixed(2)}ms`);
          PerformanceMonitor.sendToAnalytics('FID', fid,
            fid < 100 ? 'good' : 'needs-improvement'
          );
        });
      });
      observer.observe({ entryTypes: ['first-input'] });
    } catch (error) {
      // Not supported
    }

    // Cumulative Layout Shift (CLS)
    try {
      let clsValue = 0;
      const observer = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach((entry: any) => {
          if (!entry.hadRecentInput) {
            clsValue += entry.value;
          }
        });
        console.log(`📐 CLS: ${clsValue.toFixed(4)}`);
        PerformanceMonitor.sendToAnalytics('CLS', clsValue * 1000,
          clsValue < 0.1 ? 'good' : 'needs-improvement'
        );
      });
      observer.observe({ entryTypes: ['layout-shift'] });
    } catch (error) {
      // Not supported
    }

    // Time to Interactive (TTI)
    if (document.readyState === 'complete') {
      const navTiming = performance.getEntriesByType('navigation')[0] as any;
      if (navTiming) {
        const tti = navTiming.domInteractive - navTiming.fetchStart;
        console.log(`⚡ TTI: ${tti.toFixed(2)}ms`);
        PerformanceMonitor.sendToAnalytics('TTI', tti,
          tti < 3800 ? 'good' : 'needs-improvement'
        );
      }
    } else {
      window.addEventListener('load', () => {
        const navTiming = performance.getEntriesByType('navigation')[0] as any;
        if (navTiming) {
          const tti = navTiming.domInteractive - navTiming.fetchStart;
          console.log(`⚡ TTI: ${tti.toFixed(2)}ms`);
          PerformanceMonitor.sendToAnalytics('TTI', tti,
            tti < 3800 ? 'good' : 'needs-improvement'
          );
        }
      });
    }
  }
};

// Auto-track web vitals in development
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  if (document.readyState === 'complete') {
    PerformanceMonitor.trackWebVitals();
  } else {
    window.addEventListener('load', () => {
      setTimeout(() => PerformanceMonitor.trackWebVitals(), 1000);
    });
  }
}

export default PerformanceMonitor;
