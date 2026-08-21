/**
 * @jest-environment node
 *
 * Architecture lock: specialization detail is informational only.
 * Continue must enter the existing vendor discovery + vendor-card path.
 */

import * as fs from 'fs';
import * as path from 'path';
import {
  initialProblemGridFlowStep,
  shouldSkipSpecializationDetailForWappt,
} from '../problem-grid-flow-steps';
import { buildWapptDiscoveryVendorCardProps } from '../wappt-discovery-vendor-card';
import type { DiscoveryProviderCardSource } from '../warmpawz-pay/discovery-provider-card-source';

const root = path.resolve(__dirname, '../..');

function read(rel: string): string {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

const mockRouter = {
  push: jest.fn(),
  replace: jest.fn(),
  prefetch: jest.fn(),
  back: jest.fn(),
  forward: jest.fn(),
  refresh: jest.fn(),
};

describe('specialization detail → existing vendor discovery', () => {
  const routerSource = read('components/customer/ProblemGridFlowRouter.tsx');
  const vetDetail = read(
    'components/customer/specialization-detail/vet/VetSpecializationDetailPage.tsx',
  );
  const serviceMode = read(
    'components/customer/specialization-detail/ServiceModeSelection.tsx',
  );
  const wapptList = read(
    'components/customer/warmpawz-appointments/WarmpawzAppointmentsVendorList.tsx',
  );
  const clinicList = read('components/customer/vet/ClinicListView.tsx');
  const hubCard = read('components/customer/shared/ServiceHubVendorCard.tsx');
  const payCard = read(
    'components/warmpawz-pay/vendor-card/WarmpawzPayVendorCard.tsx',
  );
  const discoveryCard = read('lib/wappt-discovery-vendor-card.tsx');
  const payScreen = read(
    'app/warmpawz-pay/vendors/[vendorId]/WarmpawzPayVendorClient.tsx',
  );
  const vetBooking = read('components/customer/vet/VetBookingRouter.tsx');
  const cardSource = read('lib/warmpawz-pay/discovery-provider-card-source.ts');
  const byCategoryFeed = read('hooks/useWarmpawzAppointmentsByCategoryFeed.ts');

  it('renders specialization detail before vendor discovery', () => {
    expect(initialProblemGridFlowStep()).toBe('service-style');
    expect(shouldSkipSpecializationDetailForWappt()).toBe(false);
    expect(routerSource).toMatch(/initialProblemGridFlowStep\(\)/);
    expect(routerSource).toMatch(/VetSpecializationDetailPage/);
    expect(routerSource).not.toMatch(/shouldSkipServiceStyleStepForWappt/);
    expect(routerSource).not.toMatch(/wapptSkipStyleStep/);
    expect(routerSource).not.toMatch(/skipServiceStyleStep && initialWapptStyle/);
  });

  it('Continue from the article reaches existing vendor discovery components', () => {
    expect(routerSource).toMatch(/onServiceStyleSelect: handleServiceStyleSelect/);
    expect(routerSource).toMatch(/setCurrentStep\('discovery'\)/);
    expect(routerSource).toMatch(/WarmpawzAppointmentsVendorList/);
    expect(routerSource).toMatch(/ClinicListView/);
    expect(routerSource).toMatch(/VetServicesByStyle/);
    expect(wapptList).toMatch(/useWarmpawzAppointmentsByCategoryFeed/);
    expect(byCategoryFeed).toMatch(
      /\/customer\/warmpawz-appointments\/discovery\/by-category/,
    );
    expect(clinicList).toMatch(/\/customer\/discover-services/);
    expect(clinicList).toMatch(/\/customer\/services\/by-style/);
  });

  it('does not invent a specialization vendor API or educational vendor DTO fields', () => {
    expect(routerSource).not.toMatch(/\/customer\/warmpawz-pay\/initiate/);
    expect(routerSource).not.toMatch(/\/customer\/warmpawz-pay\/verify/);
    expect(vetDetail).not.toMatch(/\/customer\/warmpawz-pay\/initiate/);
    expect(byCategoryFeed).not.toMatch(/educationalContent|highlightChips|problemGridArticle/);
    expect(cardSource).not.toMatch(/educationalContent|highlightChips|problemGridArticle|sections/);
    const dtoKeys: (keyof DiscoveryProviderCardSource)[] = [
      'name',
      'photo',
      'isVerified',
      'rating',
      'reviewCount',
    ];
    expect(dtoKeys.length).toBeGreaterThan(0);
  });

  it('existing vendor cards remain the only Book / Pay surface', () => {
    expect(wapptList).toMatch(/WarmpawzPayVendorCard/);
    expect(wapptList).toMatch(/buildWapptDiscoveryVendorCardProps/);
    expect(clinicList).toMatch(/WarmpawzPayVendorCard/);
    expect(hubCard).toMatch(/shouldUseWapptPayVendorCardUi/);
    expect(hubCard).toMatch(/ServiceHubMarketplaceVendorCard/);
    expect(hubCard).toMatch(/WarmpawzPayVendorCard|mapBoardingListVendorToVendorCardProps/);

    expect(vetDetail).not.toMatch(/Book Appointment|Pay Bill|Pay with Warmpawz/);
    expect(serviceMode).not.toMatch(/Book Appointment|Pay Bill/);
    expect(vetDetail).not.toMatch(/launchWarmpawzPayServiceBooking/);
    expect(vetDetail).not.toMatch(/requestGuestAuth/);
    expect(vetDetail).not.toMatch(/\/customer\/pets/);
  });

  it('one vendor card exposes both appointment and Pay Bill actions', () => {
    const props = buildWapptDiscoveryVendorCardProps({
      provider: {
        name: 'Lab Clinic',
        vendorId: 'vendor-lab',
        rating: 4.8,
        reviewCount: 20,
      },
      subtitle: 'Veterinary',
      address: 'Bengaluru',
      category: 'vet',
      serviceKey: 'vet',
      onPrimary: jest.fn(),
      router: mockRouter as never,
    });

    expect(props.primaryAction?.label).toBe('Select Slot for Appointment');
    expect(props.secondaryAction?.label).toBe('Pay with Warmpawz');
    expect(props.primaryAction).toBeTruthy();
    expect(props.secondaryAction).toBeTruthy();
  });

  it('Book Appointment and Pay Bill stay on existing helpers', () => {
    expect(discoveryCard).toMatch(/launchWarmpawzPayServiceBooking/);
    expect(discoveryCard).not.toMatch(/requestGuestAuth/);
    expect(payCard).not.toMatch(/\/customer\/warmpawz-pay\/initiate/);
    expect(vetBooking).toMatch(/requestGuestAuthForBooking/);
    expect(clinicList).toMatch(/requestGuestAuthForMarketplaceBook/);
  });

  it('guest Pay Bill still authenticates only at Proceed to Pay', () => {
    expect(discoveryCard).not.toMatch(/requestGuestAuthForWpayPay/);
    expect(vetDetail).not.toMatch(/requestGuestAuth/);
    expect(payScreen).toMatch(
      /requestGuestAuthForWpayPay\(\{ vendorId: resolvedVendorId, amount: billAmount \}\)/,
    );
    expect(payScreen).toMatch(/consumeRestoredWpayPayBillAmount/);
  });

  it('specialization detail itself requires no login and no pet', () => {
    expect(vetDetail).not.toMatch(/isGuestApplicationState|requestGuestAuth|customerPhone/);
    expect(vetDetail).not.toMatch(/pets|petId|My Pets/);
    expect(routerSource).not.toMatch(/requestGuestAuth/);
  });
});
