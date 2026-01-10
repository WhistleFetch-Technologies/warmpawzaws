2:I[29222,["119","static/chunks/119-f17b29d46b02c79c.js","8925","static/chunks/8925-4228265312978357.js","4438","static/chunks/4438-0e8dc65c983aaff8.js","7648","static/chunks/7648-1aee0b3c375994ab.js","6606","static/chunks/6606-4ec9eb84680d8ff4.js","7550","static/chunks/7550-8481515fbe91b592.js","7512","static/chunks/app/enterprise/logic-tab/page-10831ac63b01e968.js"],"EnterpriseLogicTab"]
3:I[4707,[],""]
4:I[36423,[],""]
6:I[49294,["4438","static/chunks/4438-0e8dc65c983aaff8.js","9220","static/chunks/9220-0be12aa100a8fdba.js","3185","static/chunks/app/layout-3ac9f3540e612bed.js"],"Providers"]
7:I[13490,["7648","static/chunks/7648-1aee0b3c375994ab.js","7601","static/chunks/app/error-abcf4c29ab6eeff0.js"],"default"]
8:I[85447,["7648","static/chunks/7648-1aee0b3c375994ab.js","9160","static/chunks/app/not-found-c2b2570f3d55d27f.js"],"default"]
5:T75d,
              // Inline fallback config (ensures API URL is always available)
              if (!window.__WARMPAWZ_RUNTIME_CONFIG__) {
                window.__WARMPAWZ_RUNTIME_CONFIG__ = {
                  apiBaseUrl: 'https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com',
                  uatMode: true
                };
                console.log('🔧 Runtime config loaded (inline fallback):', window.__WARMPAWZ_RUNTIME_CONFIG__);
              }
              // Load external runtime-config.js to override if needed (deploy-time)
              (function() {
                var script = document.createElement('script');
                script.src = '/runtime-config.js';
                script.async = false;
                script.defer = false;
                script.onload = function() {
                  console.log('🔧 External runtime-config.js loaded');
                };
                script.onerror = function() {
                  console.warn('⚠️ Failed to load runtime-config.js, using fallback');
                };
                document.head.appendChild(script);
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
            0:["Yg1oSohFbVWQP9acMegP1",[[["",{"children":["enterprise",{"children":["logic-tab",{"children":["__PAGE__",{}]}]}]},"$undefined","$undefined",true],["",{"children":["enterprise",{"children":["logic-tab",{"children":["__PAGE__",{},[["$L1",["$","$L2",null,{}],null],null],null]},[null,["$","$L3",null,{"parallelRouterKey":"children","segmentPath":["children","enterprise","children","logic-tab","children"],"error":"$undefined","errorStyles":"$undefined","errorScripts":"$undefined","template":["$","$L4",null,{}],"templateStyles":"$undefined","templateScripts":"$undefined","notFound":"$undefined","notFoundStyles":"$undefined"}]],null]},[null,["$","$L3",null,{"parallelRouterKey":"children","segmentPath":["children","enterprise","children"],"error":"$undefined","errorStyles":"$undefined","errorScripts":"$undefined","template":["$","$L4",null,{}],"templateStyles":"$undefined","templateScripts":"$undefined","notFound":"$undefined","notFoundStyles":"$undefined"}]],null]},[[[["$","link","0",{"rel":"stylesheet","href":"/_next/static/css/d35c0a4bed4b95fd.css","precedence":"next","crossOrigin":"$undefined"}]],["$","html",null,{"lang":"en","suppressHydrationWarning":true,"children":["$","body",null,{"className":"__className_f367f3","suppressHydrationWarning":true,"children":[["$","script",null,{"dangerouslySetInnerHTML":{"__html":"$5"}}],["$","$L6",null,{"children":["$","$L3",null,{"parallelRouterKey":"children","segmentPath":["children"],"error":"$7","errorStyles":[],"errorScripts":[],"template":["$","$L4",null,{}],"templateStyles":"$undefined","templateScripts":"$undefined","notFound":["$","$L8",null,{}],"notFoundStyles":[]}]}]]}]}]],null],null],["$L9",null]]]]
9:[["$","meta","0",{"name":"viewport","content":"width=device-width, initial-scale=1"}],["$","meta","1",{"charSet":"utf-8"}],["$","title","2",{"children":"Warmpawz Admin Portal"}],["$","meta","3",{"name":"description","content":"Platform administration and governance"}],["$","meta","4",{"name":"next-size-adjust"}]]
1:null
