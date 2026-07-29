/**
 * Compare Pay Hub vs Appointment Discovery photo for Bindu Vet Clinic.
 */
const API = 'https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com';
const BINDU_ID = 'ed6f9962-9aeb-4355-be2d-f9915f56a912';

async function main() {
  const wapptUrl = `${API}/customer/warmpawz-appointments/discovery/by-category?category=vet&serviceStyle=all&limit=10`;
  const wpayUrl = `${API}/customer/warmpawz-pay/vendors?limit=50&category=vet`;

  const [wapptRes, wpayRes] = await Promise.all([
    fetch(wapptUrl).then((r) => r.json()),
    fetch(wpayUrl).then((r) => r.json()),
  ]);

  const wapptList = wapptRes.vendors ?? wapptRes.cards ?? [];
  const wpayList = wpayRes.vendors ?? wpayRes.data?.vendors ?? [];

  const binduWappt =
    wapptList.find((v) => v.vendorId === BINDU_ID || /bindu vet clinic/i.test(String(v.name ?? ''))) ??
    wapptList[0];
  const binduWpay =
    wpayList.find((v) => v.vendorId === BINDU_ID || /bindu vet clinic/i.test(String(v.name ?? ''))) ??
    null;

  console.log(JSON.stringify({
    binduVendorId: BINDU_ID,
    appointmentDiscovery: {
      name: binduWappt?.name,
      photoUrl: binduWappt?.photoUrl ?? null,
      allImageKeys: Object.fromEntries(
        Object.entries(binduWappt ?? {}).filter(([k, v]) =>
          /photo|image|logo|avatar|thumb|profile/i.test(k) && v != null && v !== '',
        ),
      ),
    },
    payHub: binduWpay
      ? {
          name: binduWpay.name,
          photoUrl: binduWpay.photoUrl ?? null,
          allImageKeys: Object.fromEntries(
            Object.entries(binduWpay).filter(([k, v]) =>
              /photo|image|logo|avatar|thumb|profile/i.test(k) && v != null && v !== '',
            ),
          ),
        }
      : { error: 'Bindu not found in Pay Hub vet list' },
  }, null, 2));
}

main().catch(console.error);
