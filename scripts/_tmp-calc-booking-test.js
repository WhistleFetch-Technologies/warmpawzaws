const API = 'https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com';
const vendorId = 'c8b26bb8-73a5-41ea-ad34-e42b195bc20c';
const serviceId = '3c6801e4-dd44-4d86-8a2e-06218368c5ff';

async function post(path, body) {
  const res = await fetch(`${API}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return res.json();
}

(async () => {
  console.log('calculate-booking', await post('/promotions/calculate-booking', {
    vendorId,
    serviceIds: [serviceId],
    serviceStyle: 'at_center',
    amount: 899,
  }));
  console.log('with catalog id', await post('/promotions/calculate-booking', {
    vendorId,
    serviceIds: ['7205b0d1-69a6-417b-9053-a149631c02b6'],
    serviceStyle: 'at_center',
    amount: 899,
  }));
})();
