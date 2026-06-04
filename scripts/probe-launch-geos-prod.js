#!/usr/bin/env node
const API = 'https://mss9sa4y01.execute-api.ap-south-1.amazonaws.com';

async function probe(label, path) {
  const r = await fetch(API + path);
  const j = await r.json();
  if (path.includes('customer')) {
    const v = j.services?.visible?.length || 0;
    const c = j.services?.comingSoon?.length || 0;
    const h = j.services?.hidden?.length || 0;
    console.log(`${label}: visible=${v} comingSoon=${c} hidden=${h} total=${v + c + h}`);
    if (v + c >= 15) {
      console.log(
        '  visible:',
        (j.services.visible || []).map((s) => s.serviceId).join(', ')
      );
      console.log(
        '  comingSoon:',
        (j.services.comingSoon || []).map((s) => s.serviceId).join(', ')
      );
    }
  } else {
    console.log(`${label}: admin count=${j.services?.length || 0}`);
  }
}

(async () => {
  await probe('prod-KA-Bangalore-c', '/config/service-launch/customer?state=Karnataka&city=Bangalore');
  await probe('prod-KA-Bangalore-a', '/config/service-launch?stateCode=KA&city=Bangalore');
  await probe('prod-no-geo-c', '/config/service-launch/customer');
})();
