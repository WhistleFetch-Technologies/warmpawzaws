2:I[29222,["7855","static/chunks/7855-af4cf64a86d57b1c.js","9895","static/chunks/9895-bb8627f85c26e3a5.js","7512","static/chunks/app/enterprise/logic-tab/page-9fced17a0174162b.js"],"EnterpriseLogicTab"]
3:I[4707,[],""]
4:I[36423,[],""]
6:I[49294,["3185","static/chunks/app/layout-62ec5a8953c783d6.js"],"Providers"]
7:I[88735,["9895","static/chunks/9895-bb8627f85c26e3a5.js","7601","static/chunks/app/error-fc5090c015f1c157.js"],"default"]
8:I[85447,["9160","static/chunks/app/not-found-f7d0c7ee6f0af1da.js"],"default"]
5:T6bc,
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
            0:["Rpj3YjQOhg-tpW7WdnXli",[[["",{"children":["enterprise",{"children":["logic-tab",{"children":["__PAGE__",{}]}]}]},"$undefined","$undefined",true],["",{"children":["enterprise",{"children":["logic-tab",{"children":["__PAGE__",{},[["$L1",["$","$L2",null,{}],null],null],null]},[null,["$","$L3",null,{"parallelRouterKey":"children","segmentPath":["children","enterprise","children","logic-tab","children"],"error":"$undefined","errorStyles":"$undefined","errorScripts":"$undefined","template":["$","$L4",null,{}],"templateStyles":"$undefined","templateScripts":"$undefined","notFound":"$undefined","notFoundStyles":"$undefined"}]],null]},[null,["$","$L3",null,{"parallelRouterKey":"children","segmentPath":["children","enterprise","children"],"error":"$undefined","errorStyles":"$undefined","errorScripts":"$undefined","template":["$","$L4",null,{}],"templateStyles":"$undefined","templateScripts":"$undefined","notFound":"$undefined","notFoundStyles":"$undefined"}]],null]},[[[["$","link","0",{"rel":"stylesheet","href":"/_next/static/css/7e63a3e27e94924b.css","precedence":"next","crossOrigin":"$undefined"}],["$","link","1",{"rel":"stylesheet","href":"/_next/static/css/b1746c6859893045.css","precedence":"next","crossOrigin":"$undefined"}]],["$","html",null,{"lang":"en","suppressHydrationWarning":true,"children":["$","body",null,{"className":"__className_8a0ba0","suppressHydrationWarning":true,"children":[["$","script",null,{"dangerouslySetInnerHTML":{"__html":"$5"}}],["$","$L6",null,{"children":["$","$L3",null,{"parallelRouterKey":"children","segmentPath":["children"],"error":"$7","errorStyles":[],"errorScripts":[],"template":["$","$L4",null,{}],"templateStyles":"$undefined","templateScripts":"$undefined","notFound":["$","$L8",null,{}],"notFoundStyles":[]}]}]]}]}]],null],null],["$L9",null]]]]
9:[["$","meta","0",{"name":"viewport","content":"width=device-width, initial-scale=1"}],["$","meta","1",{"charSet":"utf-8"}],["$","title","2",{"children":"Warmpawz Admin Portal"}],["$","meta","3",{"name":"description","content":"Platform administration and governance"}]]
1:null
