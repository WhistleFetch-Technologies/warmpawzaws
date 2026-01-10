// Placeholder performance monitor
const marks: Record<string, number> = {};

export default {
  track: (event: string, data?: any) => {
    if (typeof window !== 'undefined') {
      console.log('[Performance]', event, data);
    }
  },
  measure: (name: string, fn: () => void) => {
    const start = performance.now();
    fn();
    const end = performance.now();
    console.log(`[Performance] ${name}: ${end - start}ms`);
  },
  markStart: (name: string) => {
    if (typeof window !== 'undefined') {
      marks[name] = performance.now();
    }
  },
  markEnd: (name: string) => {
    if (typeof window !== 'undefined' && marks[name]) {
      const duration = performance.now() - marks[name];
      console.log(`[Performance] ${name}: ${duration}ms`);
      delete marks[name];
    }
  },
};

