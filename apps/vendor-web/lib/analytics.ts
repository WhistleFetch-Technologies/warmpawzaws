// Placeholder analytics
export default {
  track: (event: string, properties?: any) => {
    if (typeof window !== 'undefined') {
      console.log('[Analytics]', event, properties);
    }
  },
  page: (name: string, properties?: any) => {
    if (typeof window !== 'undefined') {
      console.log('[Analytics] Page:', name, properties);
    }
  },
};

