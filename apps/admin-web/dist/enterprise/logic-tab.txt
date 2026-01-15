2:I[29222,["119","static/chunks/119-e29979324a66a3c5.js","5516","static/chunks/5516-f27d249f02f43699.js","4438","static/chunks/4438-0e8dc65c983aaff8.js","7648","static/chunks/7648-1aee0b3c375994ab.js","6606","static/chunks/6606-f1bf3a631e94d3a1.js","9895","static/chunks/9895-88c00cbc28540200.js","7512","static/chunks/app/enterprise/logic-tab/page-088b7de046d28653.js"],"EnterpriseLogicTab"]
3:I[4707,[],""]
4:I[36423,[],""]
6:I[49294,["4438","static/chunks/4438-0e8dc65c983aaff8.js","9220","static/chunks/9220-0be12aa100a8fdba.js","3185","static/chunks/app/layout-53087172d2bf7e26.js"],"Providers"]
7:I[13490,["7648","static/chunks/7648-1aee0b3c375994ab.js","7601","static/chunks/app/error-abcf4c29ab6eeff0.js"],"default"]
8:I[85447,["7648","static/chunks/7648-1aee0b3c375994ab.js","9160","static/chunks/app/not-found-c2b2570f3d55d27f.js"],"default"]
5:Ta6f,
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
            0:["5QORzzP61syzUYbBwqQk2",[[["",{"children":["enterprise",{"children":["logic-tab",{"children":["__PAGE__",{}]}]}]},"$undefined","$undefined",true],["",{"children":["enterprise",{"children":["logic-tab",{"children":["__PAGE__",{},[["$L1",["$","$L2",null,{}],null],null],null]},[null,["$","$L3",null,{"parallelRouterKey":"children","segmentPath":["children","enterprise","children","logic-tab","children"],"error":"$undefined","errorStyles":"$undefined","errorScripts":"$undefined","template":["$","$L4",null,{}],"templateStyles":"$undefined","templateScripts":"$undefined","notFound":"$undefined","notFoundStyles":"$undefined"}]],null]},[null,["$","$L3",null,{"parallelRouterKey":"children","segmentPath":["children","enterprise","children"],"error":"$undefined","errorStyles":"$undefined","errorScripts":"$undefined","template":["$","$L4",null,{}],"templateStyles":"$undefined","templateScripts":"$undefined","notFound":"$undefined","notFoundStyles":"$undefined"}]],null]},[[[["$","link","0",{"rel":"stylesheet","href":"/_next/static/css/7cca8e2c5137bd71.css","precedence":"next","crossOrigin":"$undefined"}],["$","link","1",{"rel":"stylesheet","href":"/_next/static/css/739346ec554f8a54.css","precedence":"next","crossOrigin":"$undefined"}]],["$","html",null,{"lang":"en","suppressHydrationWarning":true,"children":["$","body",null,{"className":"__className_f367f3","suppressHydrationWarning":true,"children":[["$","script",null,{"dangerouslySetInnerHTML":{"__html":"$5"}}],["$","$L6",null,{"children":["$","$L3",null,{"parallelRouterKey":"children","segmentPath":["children"],"error":"$7","errorStyles":[],"errorScripts":[],"template":["$","$L4",null,{}],"templateStyles":"$undefined","templateScripts":"$undefined","notFound":["$","$L8",null,{}],"notFoundStyles":[]}]}]]}]}]],null],null],["$L9",null]]]]
9:[["$","meta","0",{"name":"viewport","content":"width=device-width, initial-scale=1"}],["$","meta","1",{"charSet":"utf-8"}],["$","title","2",{"children":"Warmpawz Admin Portal"}],["$","meta","3",{"name":"description","content":"Platform administration and governance"}],["$","meta","4",{"name":"next-size-adjust"}]]
1:null
