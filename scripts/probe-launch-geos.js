#!/usr/bin/env node
const API = 'https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com';

async function probe(label, path) {
  const r = await fetch(API + path);
  const j = await r.json();
  if (path.includes('customer')) {
    const v = j.services?.visible?.length || 0;
    const c = j.services?.comingSoon?.length || 0;
    const h = j.services?.hidden?.length || 0;
    console.log(`${label}: visible=${v} comingSoon=${c} hidden=${h} total=${v + c + h}`);
    if (v + c === 19) {
      console.log('  *** MATCHES USER 19 ***');
      console.log(
        '  ids:',
        [...(j.services.visible || []), ...(j.services.comingSoon || [])].map((s) => s.serviceId).join(', ')
      );
    }
  } else {
    console.log(`${label}: admin count=${j.services?.length || 0}`);
  }
}

(async () => {
  const cases = [
    ['no-geo-customer', '/config/service-launch/customer'],
    ['no-geo-admin', '/config/service-launch'],
    ['MH-Mumbai-c', '/config/service-launch/customer?state=Maharashtra&city=Mumbai'],
    ['MH-Mumbai-a', '/config/service-launch?stateCode=MH&city=Mumbai'],
    ['DL-c', '/config/service-launch/customer?state=Delhi&city=New%20Delhi'],
    ['DL-a', '/config/service-launch?stateCode=DL&city=New%20Delhi'],
    ['KA-Bengaluru-c', '/config/service-launch/customer?state=Karnataka&city=Bengaluru'],
    ['KA-Bangalore-c', '/config/service-launch/customer?state=Karnataka&city=Bangalore'],
  ];
  for (const [label, path] of cases) await probe(label, path);
})();
