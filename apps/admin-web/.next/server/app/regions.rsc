2:I[19107,[],"ClientPageRoot"]
3:I[82917,["119","static/chunks/119-f17b29d46b02c79c.js","5516","static/chunks/5516-f27d249f02f43699.js","4438","static/chunks/4438-0e8dc65c983aaff8.js","6606","static/chunks/6606-1bbe3691b846485e.js","7550","static/chunks/7550-bb7bdc2e81ff3938.js","3660","static/chunks/app/regions/page-3c70ea48c2c7aeb1.js"],"default",1]
4:I[4707,[],""]
5:I[36423,[],""]
7:I[49294,["4438","static/chunks/4438-0e8dc65c983aaff8.js","9220","static/chunks/9220-0be12aa100a8fdba.js","3185","static/chunks/app/layout-ce1e4edc4e23f9fa.js"],"Providers"]
8:I[13490,["7648","static/chunks/7648-1aee0b3c375994ab.js","7601","static/chunks/app/error-abcf4c29ab6eeff0.js"],"default"]
9:I[85447,["7648","static/chunks/7648-1aee0b3c375994ab.js","9160","static/chunks/app/not-found-c2b2570f3d55d27f.js"],"default"]
6:Ta6f,
              // Inline fallback config (ensures API URL is always available)
              if (!window.__WARMPAWZ_RUNTIME_CONFIG__) {
                window.__WARMPAWZ_RUNTIME_CONFIG__ = {
                  apiBaseUrl: 'https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com',
                  uatMode: true
                };
                console.log('🔧 Runtime config loaded (inline fallback):', window.__WARMPAWZ_RUNTIME_CONFIG__);
              }
              // Load external runtime-config.js to override if needed (deploy-time)
              // Load synchronously to ensure it's available before components mount
              (function() {
                try {
                  var script = document.createElement('script');
                  script.src = '/runtime-config.js?v=' + Date.now(); // Cache bust
                  script.async = false;
                  script.defer = false;
                  script.onload = function() {
                    console.log('🔧 External runtime-config.js loaded:', window.__WARMPAWZ_RUNTIME_CONFIG__);
                  };
                  script.onerror = function() {
                    console.warn('⚠️ Failed to load runtime-config.js, using fallback');
                    // Ensure fallback is set if external load fails
                    if (!window.__WARMPAWZ_RUNTIME_CONFIG__) {
                      window.__WARMPAWZ_RUNTIME_CONFIG__ = {
                        apiBaseUrl: 'https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com',
                        uatMode: true
                      };
                    }
                  };
                  // Insert at the beginning to ensure it loads first
                  document.head.insertBefore(script, document.head.firstChild);
                } catch (e) {
                  console.error('Error loading runtime-config.js:', e);
                }
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
            0:["Rib_jwUlORe8w-AGVP_3p",[[["",{"children":["regions",{"children":["__PAGE__",{}]}]},"$undefined","$undefined",true],["",{"children":["regions",{"children":["__PAGE__",{},[["$L1",["$","$L2",null,{"props":{"params":{},"searchParams":{}},"Component":"$3"}],null],null],null]},[null,["$","$L4",null,{"parallelRouterKey":"children","segmentPath":["children","regions","children"],"error":"$undefined","errorStyles":"$undefined","errorScripts":"$undefined","template":["$","$L5",null,{}],"templateStyles":"$undefined","templateScripts":"$undefined","notFound":"$undefined","notFoundStyles":"$undefined"}]],null]},[[[["$","link","0",{"rel":"stylesheet","href":"/_next/static/css/43b7aabe4032cf8b.css","precedence":"next","crossOrigin":"$undefined"}]],["$","html",null,{"lang":"en","suppressHydrationWarning":true,"children":["$","body",null,{"className":"__className_f367f3","suppressHydrationWarning":true,"children":[["$","script",null,{"dangerouslySetInnerHTML":{"__html":"$6"}}],["$","$L7",null,{"children":["$","$L4",null,{"parallelRouterKey":"children","segmentPath":["children"],"error":"$8","errorStyles":[],"errorScripts":[],"template":["$","$L5",null,{}],"templateStyles":"$undefined","templateScripts":"$undefined","notFound":["$","$L9",null,{}],"notFoundStyles":[]}]}]]}]}]],null],null],["$La",null]]]]
a:[["$","meta","0",{"name":"viewport","content":"width=device-width, initial-scale=1"}],["$","meta","1",{"charSet":"utf-8"}],["$","title","2",{"children":"Warmpawz Admin Portal"}],["$","meta","3",{"name":"description","content":"Platform administration and governance"}],["$","meta","4",{"name":"next-size-adjust"}]]
1:null
