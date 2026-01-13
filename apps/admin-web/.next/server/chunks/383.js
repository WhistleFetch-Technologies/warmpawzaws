exports.id=383,exports.ids=[383],exports.modules={66679:(e,t,r)=>{Promise.resolve().then(r.bind(r,67733))},26284:(e,t,r)=>{Promise.resolve().then(r.bind(r,37))},83817:(e,t,r)=>{Promise.resolve().then(r.bind(r,78143))},60850:(e,t,r)=>{Promise.resolve().then(r.t.bind(r,12994,23)),Promise.resolve().then(r.t.bind(r,96114,23)),Promise.resolve().then(r.t.bind(r,9727,23)),Promise.resolve().then(r.t.bind(r,79671,23)),Promise.resolve().then(r.t.bind(r,41868,23)),Promise.resolve().then(r.t.bind(r,84759,23))},67733:(e,t,r)=>{"use strict";r.r(t),r.d(t,{default:()=>i,dynamic:()=>o});var n=r(10326);r(17577);var s=r(90434);let o="force-dynamic";function i({error:e,reset:t}){return(0,n.jsxs)("div",{style:{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",minHeight:"100vh",fontFamily:"system-ui, sans-serif",padding:"2rem",textAlign:"center"},children:[n.jsx("h1",{style:{fontSize:"4rem",margin:"0 0 1rem",color:"#dc2626"},children:"500"}),n.jsx("h2",{style:{fontSize:"1.5rem",margin:"0 0 1rem",color:"#666"},children:"Something went wrong"}),n.jsx("p",{style:{margin:"0 0 2rem",color:"#999"},children:e?.message||"An unexpected error occurred"}),(0,n.jsxs)("div",{style:{display:"flex",gap:"1rem"},children:[n.jsx("button",{onClick:t,style:{padding:"0.75rem 1.5rem",backgroundColor:"#f97316",color:"white",border:"none",borderRadius:"0.5rem",fontWeight:"500",cursor:"pointer"},children:"Try Again"}),n.jsx(s.default,{href:"/",style:{padding:"0.75rem 1.5rem",backgroundColor:"#6b7280",color:"white",textDecoration:"none",borderRadius:"0.5rem",fontWeight:"500"},children:"Go Home"})]})]})}},37:(e,t,r)=>{"use strict";r.r(t),r.d(t,{default:()=>i,dynamic:()=>o});var n=r(10326);r(17577);var s=r(90434);let o="force-dynamic";function i(){return(0,n.jsxs)("div",{style:{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",minHeight:"100vh",fontFamily:"system-ui, sans-serif",padding:"2rem",textAlign:"center"},children:[n.jsx("h1",{style:{fontSize:"4rem",margin:"0 0 1rem",color:"#333"},children:"404"}),n.jsx("h2",{style:{fontSize:"1.5rem",margin:"0 0 1rem",color:"#666"},children:"Page Not Found"}),n.jsx("p",{style:{margin:"0 0 2rem",color:"#999"},children:"The page you are looking for does not exist."}),n.jsx(s.default,{href:"/",style:{padding:"0.75rem 1.5rem",backgroundColor:"#f97316",color:"white",textDecoration:"none",borderRadius:"0.5rem",fontWeight:"500"},children:"Go Home"})]})}},78143:(e,t,r)=>{"use strict";r.d(t,{Providers:()=>c});var n=r(10326),s=r(74951),o=r(44976),i=r(85999),a=r(17577),l=r(51339);function c({children:e}){let[t]=(0,a.useState)(()=>new s.S({defaultOptions:{queries:{staleTime:6e4,refetchOnWindowFocus:!1,refetchOnMount:!1,refetchOnReconnect:!1}}}));return(0,n.jsxs)(o.aH,{client:t,children:[e,n.jsx(l.r,{children:n.jsx(i.x7,{position:"top-right"})})]})}},51339:(e,t,r)=>{"use strict";r.d(t,{r:()=>o});var n=r(10326),s=r(17577);function o({children:e}){let[t,r]=(0,s.useState)(!1);return t?n.jsx(n.Fragment,{children:e}):null}},8528:(e,t,r)=>{"use strict";function n(){return({}).apiBaseUrl||process.env.NEXT_PUBLIC_API_BASE_URL||""}r.d(t,{Aw:()=>o,x1:()=>a}),process.env.NEXT_PUBLIC_UAT_MODE;let s=new Map;class o extends Error{constructor(e,t,r){super(e),this.retryAfter=t,this.endpoint=r,this.name="RateLimitError"}}class i{constructor(e){let t=e||n();this.baseUrl=t||""}refreshBaseUrl(){let e=n();e&&e!==this.baseUrl&&(this.baseUrl=e)}getAuthToken(){return null}async request(e,t={},r=0){let i=this.baseUrl||n();if(!i){let t="API_BASE_URL is not configured. Please check runtime-config.js or NEXT_PUBLIC_API_BASE_URL environment variable.";throw console.error("❌ [API Client]",t),console.error("   Runtime Config:",{}),console.error("   Window Config:","N/A"),console.error("   Endpoint:",e),Error(t)}!this.baseUrl&&i&&(this.baseUrl=i);let a=`${t.method||"GET"}:${e}`,l=s.get(a),c=Date.now();if(l){if(l.retryAfter&&c<l.lastRequest+l.retryAfter){let t=Math.ceil((l.lastRequest+l.retryAfter-c)/1e3);throw new o(`Rate limit exceeded. Please wait ${t} second(s) before retrying.`,l.retryAfter,e)}if(c-l.lastRequest<5e3&&void 0===l.retryAfter)throw new o("Too many requests. Please wait a moment before retrying.",5e3,e)}let d=i.replace(/\/+$/,""),u=e.replace(/^\/+/,"/"),m=`${d}${u}`,f=this.getAuthToken(),h={"Content-Type":"application/json",...t.headers};f&&(h.Authorization=`Bearer ${f}`);let p=await fetch(m,{...t,headers:h});if(!p.ok){let t={},n="";try{if(n=await p.text())try{t=JSON.parse(n)}catch{t={error:n||`HTTP ${p.status}: ${p.statusText}`}}else t={error:`HTTP ${p.status}: ${p.statusText}`,message:`Request failed with status ${p.status}`}}catch(e){t={error:`HTTP ${p.status}: ${p.statusText}`,message:`Request failed with status ${p.status}`}}let i=(e=>{if("string"==typeof e)return e;if(e?.error&&"string"==typeof e.error)return e.error;if(e?.message&&"string"==typeof e.message)return e.message;if(e&&"object"==typeof e)try{let t=JSON.stringify(e);return t.length>200?t.substring(0,200)+"...":t}catch{}return`HTTP ${p.status}: ${p.statusText}`})(t);if(404===p.status)throw Error(`Endpoint not found: ${e}. Please check if the API route is configured.`);if(429===p.status){let t=p.headers.get("Retry-After"),n=t?1e3*parseInt(t,10):Math.min(5e3*Math.pow(2,r),3e4);throw s.set(a,{lastRequest:Date.now(),retryAfter:n}),setTimeout(()=>{s.delete(a)},n),new o(i,n,e)}if(p.status,p.status>=500)throw Error(`Server error: ${i}`);throw Error(i)}return s.delete(a),p.json()}async get(e){return this.request(e,{method:"GET"})}async post(e,t){return this.request(e,{method:"POST",body:t?JSON.stringify(t):void 0})}async put(e,t){return this.request(e,{method:"PUT",body:t?JSON.stringify(t):void 0})}async delete(e){return this.request(e,{method:"DELETE"})}async patch(e,t){return this.request(e,{method:"PATCH",body:t?JSON.stringify(t):void 0})}setAuthToken(e){}clearAuth(){}}let a=new i},26083:(e,t,r)=>{"use strict";r.r(t),r.d(t,{default:()=>o,dynamic:()=>s});var n=r(68570);let s=(0,n.createProxy)(String.raw`/Users/ketan/Documents/warmpawzecodev/apps/admin-web/app/error.tsx#dynamic`),o=(0,n.createProxy)(String.raw`/Users/ketan/Documents/warmpawzecodev/apps/admin-web/app/error.tsx#default`)},84752:(e,t,r)=>{"use strict";r.r(t),r.d(t,{default:()=>l,metadata:()=>a});var n=r(19510),s=r(57128),o=r.n(s);r(67272);let i=(0,r(68570).createProxy)(String.raw`/Users/ketan/Documents/warmpawzecodev/apps/admin-web/app/providers.tsx#Providers`),a={title:"Warmpawz Admin Portal",description:"Platform administration and governance"};function l({children:e}){return n.jsx("html",{lang:"en",suppressHydrationWarning:!0,children:(0,n.jsxs)("body",{className:o().className,suppressHydrationWarning:!0,children:[n.jsx("script",{dangerouslySetInnerHTML:{__html:`
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
            `}}),n.jsx(i,{children:e})]})})}},96560:(e,t,r)=>{"use strict";r.r(t),r.d(t,{default:()=>o,dynamic:()=>s});var n=r(68570);let s=(0,n.createProxy)(String.raw`/Users/ketan/Documents/warmpawzecodev/apps/admin-web/app/not-found.tsx#dynamic`),o=(0,n.createProxy)(String.raw`/Users/ketan/Documents/warmpawzecodev/apps/admin-web/app/not-found.tsx#default`)},67272:()=>{}};