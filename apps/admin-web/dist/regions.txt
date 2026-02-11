2:I[19107,[],"ClientPageRoot"]
3:I[77001,["7855","static/chunks/7855-24f7ab5683629a81.js","413","static/chunks/413-4c2999ef9be4653e.js","9895","static/chunks/9895-4ef37ef4fa634842.js","3660","static/chunks/app/regions/page-16b8e3213376df68.js"],"default",1]
4:I[4707,[],""]
5:I[36423,[],""]
7:I[49294,["3185","static/chunks/app/layout-d9ab9edc64ec8d4a.js"],"Providers"]
8:I[88735,["9895","static/chunks/9895-4ef37ef4fa634842.js","7601","static/chunks/app/error-cf198cbb5d3ba0e1.js"],"default"]
9:I[85447,["9160","static/chunks/app/not-found-06e9724babf3c716.js"],"default"]
6:T6bc,
              // Inline fallback config (ensures API URL is always available)
              if (!window.__WARMPAWZ_RUNTIME_CONFIG__) {
                window.__WARMPAWZ_RUNTIME_CONFIG__ = { apiBaseUrl: '', uatMode: true };
              }
              (function() {
                try {
                  var script = document.createElement('script');
                  script.src = '/runtime-config.js?v=' + Date.now();
                  script.async = false;
                  script.defer = false;
                  script.onload = function() { console.log('🔧 runtime-config.js loaded'); };
                  script.onerror = function() {
                    console.warn('⚠️ runtime-config.js failed; set NEXT_PUBLIC_API_BASE_URL for local dev');
                  };
                  document.head.insertBefore(script, document.head.firstChild);
                } catch (e) { console.error('Error loading runtime-config.js', e); }
              })();
              // UAT Mode: Auto-login for direct page access (e.g., /ecommerce, /vendors, etc.)
              (function() {
                var config = window.__WARMPAWZ_RUNTIME_CONFIG__ || {};
                var isUatMode = config.uatMode === true;
                if (isUatMode && typeof localStorage !== 'undefined') {
                  var token = localStorage.getItem('adminAuthToken');
                  if (!token) {
                    localStorage.setItem('adminAuthToken', 'uat-token-admin-' + Date.now());
                    localStorage.setItem('adminEmail', 'admin@warmpawz.com');
                    console.log('🔧 [UAT Mode] Auto-logged in for direct page access');
                  }
                }
              })();
            0:["P4Br6hGu1-bYfOuK5bUW_",[[["",{"children":["regions",{"children":["__PAGE__",{}]}]},"$undefined","$undefined",true],["",{"children":["regions",{"children":["__PAGE__",{},[["$L1",["$","$L2",null,{"props":{"params":{},"searchParams":{}},"Component":"$3"}],null],null],null]},[null,["$","$L4",null,{"parallelRouterKey":"children","segmentPath":["children","regions","children"],"error":"$undefined","errorStyles":"$undefined","errorScripts":"$undefined","template":["$","$L5",null,{}],"templateStyles":"$undefined","templateScripts":"$undefined","notFound":"$undefined","notFoundStyles":"$undefined"}]],null]},[[[["$","link","0",{"rel":"stylesheet","href":"/_next/static/css/7e63a3e27e94924b.css","precedence":"next","crossOrigin":"$undefined"}],["$","link","1",{"rel":"stylesheet","href":"/_next/static/css/b1746c6859893045.css","precedence":"next","crossOrigin":"$undefined"}]],["$","html",null,{"lang":"en","suppressHydrationWarning":true,"children":["$","body",null,{"className":"__className_8a0ba0","suppressHydrationWarning":true,"style":{"backgroundColor":"var(--background, #f9fafb)","color":"var(--foreground, #030213)","fontFamily":"var(--font-sans, Inter, system-ui, sans-serif)"},"children":[["$","script",null,{"dangerouslySetInnerHTML":{"__html":"$6"}}],["$","$L7",null,{"children":["$","$L4",null,{"parallelRouterKey":"children","segmentPath":["children"],"error":"$8","errorStyles":[],"errorScripts":[],"template":["$","$L5",null,{}],"templateStyles":"$undefined","templateScripts":"$undefined","notFound":["$","$L9",null,{}],"notFoundStyles":[]}]}]]}]}]],null],null],["$La",null]]]]
a:[["$","meta","0",{"name":"viewport","content":"width=device-width, initial-scale=1"}],["$","meta","1",{"charSet":"utf-8"}],["$","title","2",{"children":"Warmpawz Admin Portal"}],["$","meta","3",{"name":"description","content":"Platform administration and governance"}],["$","meta","4",{"name":"next-size-adjust"}]]
1:null
