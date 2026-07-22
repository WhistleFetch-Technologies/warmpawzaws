'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { apiClient } from '@/lib/api-client';
import {
  buildVendorServicesPageUrl,
  vendorServicesNextCursor,
  vendorServicesRowsFromResponse,
} from '@/lib/vendor-services-page';

export function useProviderServicesLazyLoad<T>(opts: {
  vendorId: string;
  serviceStyle: string;
  category: string;
  phone?: string;
  mapRows: (rows: unknown[]) => T[];
  enabled?: boolean;
}) {
  const { vendorId, serviceStyle, category, phone, mapRows, enabled = true } = opts;
  const [services, setServices] = useState<T[]>([]);
  const [loading, setLoading] = useState(enabled);
  const [loadingMore, setLoadingMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const cursorRef = useRef<string | null>(null);

  const fetchPage = useCallback(
    async (append: boolean) => {
      const vid = String(vendorId || '').trim();
      if (!enabled || !vid) {
        setLoading(false);
        return;
      }
      if (append && !cursorRef.current) return;

      try {
        if (append) setLoadingMore(true);
        else setLoading(true);

        const url = buildVendorServicesPageUrl({
          vendorId: vid,
          serviceStyle,
          category,
          customerPhone: phone || undefined,
          cursor: append ? cursorRef.current : undefined,
        });

        // #region agent log
        fetch('http://127.0.0.1:7284/ingest/8a051ee5-5764-433a-b7be-541c81de6d03',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'2643f5'},body:JSON.stringify({sessionId:'2643f5',hypothesisId:'E',location:'useProviderServicesLazyLoad.ts:fetch',message:'PFP vendor services fetch',data:{vid,serviceStyle,category,append,url},timestamp:Date.now()})}).catch(()=>{});
        // #endregion

        const res = await apiClient.get(url);
        const rows = vendorServicesRowsFromResponse(
          res as { services?: unknown[]; packages?: unknown[] }
        );
        const mapped = mapRows(rows);
        const nc = vendorServicesNextCursor(res);
        cursorRef.current = nc;
        setNextCursor(nc);

        setServices((prev) => {
          if (!append) return mapped;
          const seen = new Set(prev.map((s) => (s as { id?: string }).id));
          const merged = [...prev];
          for (const s of mapped) {
            const id = (s as { id?: string }).id;
            if (id && seen.has(id)) continue;
            if (id) seen.add(id);
            merged.push(s);
          }
          return merged;
        });
        setHydrated(true);

        // #region agent log
        fetch('http://127.0.0.1:7284/ingest/8a051ee5-5764-433a-b7be-541c81de6d03',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'2643f5'},body:JSON.stringify({sessionId:'2643f5',hypothesisId:'E',location:'useProviderServicesLazyLoad.ts:done',message:'PFP vendor services loaded',data:{vid,serviceStyle,count:mapped.length,nextCursor:!!nc},timestamp:Date.now()})}).catch(()=>{});
        // #endregion
      } catch (e) {
        // #region agent log
        fetch('http://127.0.0.1:7284/ingest/8a051ee5-5764-433a-b7be-541c81de6d03',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'2643f5'},body:JSON.stringify({sessionId:'2643f5',hypothesisId:'F',location:'useProviderServicesLazyLoad.ts:error',message:'PFP vendor services failed',data:{vendorId:vid,serviceStyle,error:String(e)},timestamp:Date.now()})}).catch(()=>{});
        // #endregion
        if (!append) setServices([]);
        setHydrated(true);
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [enabled, vendorId, serviceStyle, category, phone, mapRows]
  );

  useEffect(() => {
    cursorRef.current = null;
    setNextCursor(null);
    setHydrated(false);
    setServices([]);
    void fetchPage(false);
  }, [fetchPage]);

  const loadMore = useCallback(() => {
    void fetchPage(true);
  }, [fetchPage]);

  return {
    services,
    loading,
    loadingMore,
    nextCursor,
    hydrated,
    loadMore,
    hasMore: !!nextCursor,
  };
}
