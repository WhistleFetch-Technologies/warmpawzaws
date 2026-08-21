/**
 * @jest-environment node
 */

import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '../..');
function readSrc(rel: string): string {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

describe('guest hardening P1 source contracts', () => {
  it('Nutritionist Tele does not load pets/profile before auth', () => {
    const src = readSrc('components/customer/nutrition/NutritionistTeleRouter.tsx');
    expect(src).toMatch(/hasAuthenticatedCustomerSession\(\)/);
    expect(src).toMatch(/if \(!hasAuthenticatedCustomerSession\(\) \|\| !phone\) return;/);
  });

  it('Guest Home runs public bootstrap without customer pets/profile', () => {
    const src = readSrc('components/customer/homepage/CustomerHomeComplete.tsx');
    expect(src).toMatch(/bootstrapGuestHome/);
    expect(src).toMatch(/refreshHomeDynamicContent\('', location\)/);
    expect(src).not.toMatch(/ensureCustomerProfileAndPets\(phone.*isGuest/);
    expect(src).toMatch(/!hideHeaderFooter && !isGuest/);
  });

  it('marketplace boarding Book is wired to requestGuestAuthForBooking', () => {
    const src = readSrc('components/customer/boarding/BoardingBookingRouter.tsx');
    expect(src).toMatch(/!appointmentsMode &&/);
    expect(src).toMatch(/requestGuestAuthForBooking\(/);
    expect(src).toMatch(/isSelectedSlotStillAvailable/);
  });

  it('uncovered services restore to existing shell screens', () => {
    expect(readSrc('components/customer/relocation/RelocationBookingRouter.tsx')).toMatch(
      /requestGuestAuthForServiceResume\(\{ resumeScreen: 'relocation'/
    );
    expect(readSrc('components/customer/photography/PhotographyBookingRouter.tsx')).toMatch(
      /requestGuestAuthForServiceResume\(\{ resumeScreen: 'photography'/
    );
    expect(readSrc('components/customer/sunset/SunsetBookingRouter.tsx')).toMatch(
      /requestGuestAuthForServiceResume\(\{ resumeScreen: 'sunset'/
    );
    expect(readSrc('components/customer/holidays/HolidayBookingRouter.tsx')).toMatch(
      /requestGuestAuthForServiceResume\(\{ resumeScreen: 'holiday'/
    );
    expect(readSrc('components/customer/CafeReservationFlow.tsx')).toMatch(
      /resumeScreen: 'cafe_reservation'/
    );
    expect(readSrc('components/customer/EmergencyBookingPage.tsx')).toMatch(
      /resumeScreen: 'emergency-booking'/
    );
    expect(readSrc('components/customer/insurance/InsuranceProvider.tsx')).toMatch(
      /resumeScreen: 'insurance'/
    );
  });

  it('production Guest flags are explicitly enabled in deploy and runtime config', () => {
    const deploy = fs.readFileSync(
      path.resolve(ROOT, '../../scripts/deploy-customer-web.sh'),
      'utf8'
    );
    expect(deploy).toMatch(/GB_RAW="\$\{GUEST_BROWSING_ENABLED:-true\}"/);
    expect(deploy).toMatch(/GL_RAW="\$\{GUEST_LOCATION_ENABLED:-true\}"/);
    const runtime = readSrc('public/runtime-config.js');
    expect(runtime).toMatch(/guestBrowsingEnabled: true/);
    expect(runtime).toMatch(/guestLocationEnabled: true/);
    expect(runtime).toMatch(/guestBookingEnabled: false/);
  });
});
