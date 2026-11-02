import { WarmpawzPayPaymentsService } from '../services/warmpawz-pay-payments.service';
import { CatalogueErrorCode } from '../../catalogue/dto/catalogue.errors';

jest.mock('../../../repositories/wpay-payments-admin.repository', () => ({
  dbWpayAdminPaymentBillGates: jest.fn(),
  dbWpayAdminSavePaymentBillLineItems: jest.fn(),
  dbWpayAdminPaymentsPage: jest.fn(),
  dbWpayAdminPaymentsExport: jest.fn(),
  dbWpayPlatformWithholdPercentByVendorIds: jest.fn(),
  dbWpayAdminSettlePaymentsByPaymentIds: jest.fn(),
  dbWpayAdminVerifyPaymentBill: jest.fn(),
}));

jest.mock('../../../../../services/image/image-url-builder', () => ({
  urlForImageKey: jest.fn(async () => 'https://cdn.example/bill.jpg'),
}));

import {
  dbWpayAdminPaymentBillGates,
  dbWpayAdminSavePaymentBillLineItems,
} from '../../../repositories/wpay-payments-admin.repository';

const mockedGates = dbWpayAdminPaymentBillGates as jest.MockedFunction<
  typeof dbWpayAdminPaymentBillGates
>;
const mockedSave = dbWpayAdminSavePaymentBillLineItems as jest.MockedFunction<
  typeof dbWpayAdminSavePaymentBillLineItems
>;

const walkinGate = {
  paymentId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  settlementId: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  roleName: 'pet_store_walkin',
  billImageKey: 'bills/1.jpg',
  billVerifiedAt: '2026-11-02T06:00:00.000Z',
  billVerifiedBy: 'admin-1',
  billLineItems: [{ item: 'Pedigree', quantity: 2, total: 499.5 }],
  settlementStatus: 'completed',
};

describe('WarmpawzPayPaymentsService.savePaymentBillLineItems', () => {
  const service = new WarmpawzPayPaymentsService();

  beforeEach(() => {
    mockedGates.mockReset();
    mockedSave.mockReset();
  });

  it('saves items on a walk-in settlement after verify/settle', async () => {
    mockedGates
      .mockResolvedValueOnce([walkinGate])
      .mockResolvedValueOnce([{ ...walkinGate, billLineItems: [{ item: 'Collar', quantity: 1, total: 80 }] }]);
    mockedSave.mockResolvedValue({
      ...walkinGate,
      billLineItems: [{ item: 'Collar', quantity: 1, total: 80 }],
    });

    const result = await service.savePaymentBillLineItems(
      walkinGate.paymentId,
      { items: [{ item: 'Collar', quantity: 1, total: 80 }] },
      'admin-2',
    );

    expect(mockedSave).toHaveBeenCalledWith({
      paymentId: walkinGate.paymentId,
      items: [{ item: 'Collar', quantity: 1, total: 80 }],
      savedBy: 'admin-2',
    });
    expect(result.billLineItems).toEqual([{ item: 'Collar', quantity: 1, total: 80 }]);
    expect(result.billVerified).toBe(true);
  });

  it('rejects non walk-in vendors', async () => {
    mockedGates.mockResolvedValue([{ ...walkinGate, roleName: 'vet_clinic' }]);
    await expect(
      service.savePaymentBillLineItems(
        walkinGate.paymentId,
        { items: [{ item: 'Collar', quantity: 1, total: 80 }] },
        'admin-2',
      ),
    ).rejects.toMatchObject({ code: CatalogueErrorCode.VALIDATION_ERROR });
    expect(mockedSave).not.toHaveBeenCalled();
  });
});
