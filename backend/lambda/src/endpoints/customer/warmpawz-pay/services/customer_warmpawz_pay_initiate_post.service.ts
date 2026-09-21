import type { Context } from 'hono';
import {
  createWpayRazorpayOrder,
  createWpayWalletOnlyPayment,
  WpayPaymentAlreadyCompletedError,
} from '../../../../utils/wpay-razorpay-order';
import { resolveWpayAuthenticatedCustomer } from '../shared/wpay-authenticated-customer';
import { dbWpayVendorById } from '../repos/wpay-vendor-detail.repo';
import {
  dbFindOpenWapptBookingForPay,
  dbLoadWapptBookingForPayCredit,
} from '../repos/wpay-appointment-context.repo';
import { WpayCommercialValidationError } from '../shared/wpay-discount';
import { resolveWpayPayQuote } from '../shared/wpay-quote-resolver';
import { resolveWpayPromoCategory } from '../shared/resolve-wpay-promo-category';
import { applyEngineDiscountToWpayPayable } from '../shared/apply-engine-discount-to-wpay';
import { loadOwnedWpayEvaluation } from '../shared/load-wpay-stored-evaluation';
import { normalizePromoCategory } from '../../../../discount-engine/promo-engine/dsl/category-aliases';
import { capWpayWalletAmount } from '../shared/wpay-wallet';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function executeCustomerWarmpawzPayInitiatePost(c: Context) {
  try {
    const body = (await c.req.json().catch(() => ({}))) as {
      vendorId?: string;
      originalAmount?: number;
      phone?: string;
      bookingId?: string;
      clientRequestId?: string;
      evaluationId?: string;
      serviceCategory?: string;
      walletAmount?: number;
    };

    const vendorId = String(body.vendorId ?? '').trim();
    const phone = String(body.phone ?? c.req.query('phone') ?? '').trim();
    const originalAmount = Number(body.originalAmount);
    const clientRequestId = String(body.clientRequestId ?? '').trim();
    const requestedBookingId = String(body.bookingId ?? '').trim();
    const requestedEvaluationId = String(body.evaluationId ?? '').trim();

    if (!UUID_RE.test(vendorId)) {
      return c.json({ success: false, error: 'Invalid vendor id' }, 400);
    }
    if (!phone) {
      return c.json({ success: false, error: 'Phone is required' }, 400);
    }
    if (!Number.isFinite(originalAmount) || originalAmount <= 0) {
      return c.json({ success: false, error: 'Invalid bill amount' }, 400);
    }

    const identity = await resolveWpayAuthenticatedCustomer(c, phone);
    if (!identity.ok) {
      return c.json({ success: false, error: identity.error }, identity.status);
    }
    const customerId = identity.customerId;

    const vendorRow = await dbWpayVendorById(vendorId);
    if (!vendorRow) {
      return c.json({ success: false, error: 'Vendor not found or not available' }, 404);
    }

    const openBooking = UUID_RE.test(requestedBookingId)
      ? await dbLoadWapptBookingForPayCredit(requestedBookingId, customerId, vendorId)
      : await dbFindOpenWapptBookingForPay(customerId, vendorId);
    const bookingId = openBooking?.id ? String(openBooking.id) : null;
    const serviceCategory =
      resolveWpayPromoCategory({
        bookingCategory: openBooking?.service_category,
        vendorRoleCategory: vendorRow.role_category,
        vendorLegacyCategory: vendorRow.legacy_category,
      }) || normalizePromoCategory(body.serviceCategory);

    const { loadServerPaymentContext } = await import('../../../../discount-engine/promo-engine');
    const payCtx = await loadServerPaymentContext({
      surface: 'paybill',
      vendorId,
      bookingCategoryId: openBooking?.service_category || serviceCategory,
    });

    const resolved = await resolveWpayPayQuote({
      vendorRow,
      quotedAmount: originalAmount,
    });

    let promoEngine: Record<string, unknown> | null = null;
    let engineDiscount = 0;
    try {
      const stored = await loadOwnedWpayEvaluation(requestedEvaluationId, customerId);
      if (stored) {
        engineDiscount = stored.engineDiscount;
        promoEngine = {
          evaluationId: stored.evaluationId,
          pendingCashback: stored.pendingCashback,
          engineDiscount: stored.engineDiscount,
          eligible: stored.engineDiscount > 0 || stored.pendingCashback > 0,
          serviceCategory,
          stackingNote:
            'Promo-engine discount reduces Razorpay payable; cashback credits on commit',
        };
      }
      if (!stored) {
        const { safeEvaluatePromotions } = await import(
          '../../../../discount-engine/promo-engine'
        );
        const ev = await safeEvaluatePromotions({
          user_id: customerId,
          persist: true,
          transaction: {
            type: 'WPAY',
            channel: 'paybill',
            service_category: serviceCategory || undefined,
            vendor_id: vendorId,
            vendorId,
            categoryId: payCtx.categoryId || undefined,
            booking_id: bookingId || undefined,
            amount: originalAmount,
          },
        });
        if (ev?.evaluation_id) {
          engineDiscount = Math.max(0, Number(ev.summary.discount) || 0);
          const cashbackBenefit = (ev.benefits || []).find((b) => b.benefit_type === 'CASHBACK');
          promoEngine = {
            evaluationId: ev.evaluation_id,
            pendingCashback: ev.summary.cashback,
            engineDiscount: ev.summary.discount,
            eligible: ev.eligible,
            serviceCategory,
            redeemScope: cashbackBenefit?.redeem_scope || [],
            expiryDays: cashbackBenefit?.expiry_days ?? null,
            stackingNote:
              'Promo-engine discount reduces Razorpay payable; cashback credits on commit',
          };
        }
      }
    } catch (peErr) {
      console.warn(
        '[customer/warmpawz-pay/initiate] promo-engine evaluate skipped:',
        peErr instanceof Error ? peErr.message : peErr
      );
    }

    const applied = applyEngineDiscountToWpayPayable({
      quotedAmount: originalAmount,
      cataloguePayable: resolved.payableAmount,
      engineDiscount,
      metadata: resolved.metadata,
    });

    const requestedWallet = Number(body.walletAmount);
    let walletAmount = 0;
    let razorpayCharge = applied.payableAmount;
    let walletOnly = false;
    if (Number.isFinite(requestedWallet) && requestedWallet > 0.009) {
      const { computeSpendableWalletBalance } = await import(
        '../../../../discount-engine/promo-engine'
      );
      const scoped = await computeSpendableWalletBalance(customerId, serviceCategory, {
        serviceCategory,
        vendorId,
        categoryId: payCtx.categoryId,
        channel: 'paybill',
      });
      const capped = capWpayWalletAmount({
        payable: applied.payableAmount,
        requested: requestedWallet,
        spendable: scoped.spendable,
      });
      walletAmount = capped.walletAmount;
      razorpayCharge = capped.razorpayAmount;
      walletOnly = capped.walletOnly;
    }

    const quoteMetadata = {
      ...applied.metadata,
      serviceCategory,
      categoryId: payCtx.categoryId,
      bookingId,
      walletAmount,
      quotedPayableAmount: applied.payableAmount,
      razorpayChargeAmount: razorpayCharge,
      ...(promoEngine?.evaluationId
        ? { evaluationId: String(promoEngine.evaluationId), promoEngine }
        : {}),
    };

    if (walletOnly) {
      const walletPay = await createWpayWalletOnlyPayment({
        customerId,
        vendorId,
        payableAmount: applied.payableAmount,
        bookingId,
        clientRequestId: clientRequestId || null,
        quoteMetadata,
      });
      const { debitScopedWallet } = await import(
        '../../../../discount-engine/promo-engine'
      );
      const debit = await debitScopedWallet({
        customerId,
        amount: walletAmount,
        serviceCategory,
        vendorId,
        categoryId: payCtx.categoryId,
        channel: 'paybill',
        referenceType: 'wpay',
        referenceId: walletPay.paymentId,
        description: `Warmpawz Pay ${walletPay.paymentId}`,
      });
      if (!debit.ok) {
        return c.json({ success: false, error: debit.error }, 400);
      }
      const { dbWpayAtomicCompleteVerify } = await import(
        '../repos/wpay-verify-transaction.repo'
      );
      const completed = await dbWpayAtomicCompleteVerify({
        paymentId: walletPay.paymentId,
        customerId,
        razorpayPaymentId: `wallet_${walletPay.paymentId}`,
        razorpaySignature: 'wallet',
        originalAmount,
        discountAmount: applied.discountAmount,
        bookingId,
        creditAmount: 0,
      });
      if (completed) {
        try {
          const { accrueWpaySettlement } = await import('../shared/accrue-wpay-settlement');
          await accrueWpaySettlement(completed);
        } catch (settleErr) {
          console.error('[customer/warmpawz-pay/initiate] wallet-only settlement failed', settleErr);
        }
        try {
          const { commitWpayPromoEngine } = await import('../shared/commit-wpay-promo-engine');
          await commitWpayPromoEngine({
            paymentId: walletPay.paymentId,
            customerId,
            vendorId,
            razorpayPaymentId: `wallet_${walletPay.paymentId}`,
            originalAmount,
            metadata: quoteMetadata,
          });
        } catch (peErr) {
          console.warn(
            '[customer/warmpawz-pay/initiate] promo-engine commit skipped:',
            peErr instanceof Error ? peErr.message : peErr,
          );
        }
      }
      return c.json({
        success: true,
        walletOnly: true,
        paymentId: walletPay.paymentId,
        originalAmount,
        discountAmount: applied.discountAmount,
        payableAmount: applied.payableAmount,
        walletAmount,
        razorpayAmount: 0,
        bookingId,
        promoEngine,
      });
    }

    const order = await createWpayRazorpayOrder({
      customerId,
      vendorId,
      payableAmount: applied.payableAmount,
      chargeAmount: razorpayCharge,
      bookingId,
      clientRequestId: clientRequestId || null,
      quoteMetadata,
    });

    if (resolved.commercialModel === 'tier_commission') {
      const q = resolved.quote;
      return c.json({
        success: true,
        paymentId: order.paymentId,
        razorpayOrderId: order.orderId,
        razorpayKeyId: order.keyId,
        amount: order.amount,
        amountPaise: order.amountPaise,
        currency: order.currency,
        commercialModel: 'tier_commission',
        originalAmount: q.quotedAmount,
        discountPercent: applied.metadata.quotedDiscountPercent,
        discountAmount: applied.discountAmount,
        servicePayableAmount: q.servicePayableAmount,
        appointmentFeeCredit: 0,
        platformFee: q.platformFee,
        platformFeeGstAmount: q.platformFeeGstAmount,
        convenienceFee: q.convenienceFee,
        convenienceGstAmount: q.convenienceGstAmount,
        payableAmount: applied.payableAmount,
        walletAmount,
        razorpayAmount: order.amount,
        bookingId,
        promoEngine,
      });
    }

    const q = resolved.quote;
    return c.json({
      success: true,
      paymentId: order.paymentId,
      razorpayOrderId: order.orderId,
      razorpayKeyId: order.keyId,
      amount: order.amount,
      amountPaise: order.amountPaise,
      currency: order.currency,
      commercialModel: 'withhold',
      originalAmount: q.originalAmount,
      appointmentFeeCredit: 0,
      billBase: q.billBase,
      discountAmount: applied.discountAmount,
      payableAmount: applied.payableAmount,
      walletAmount,
      razorpayAmount: order.amount,
      bookingId,
      promoEngine,
    });
  } catch (error: unknown) {
    if (error instanceof WpayCommercialValidationError) {
      return c.json({ success: false, error: error.message }, 400);
    }
    if (error instanceof WpayPaymentAlreadyCompletedError) {
      return c.json(
        {
          success: false,
          error: error.message,
          paymentId: error.paymentId,
          code: 'WPAY_PAYMENT_ALREADY_COMPLETED',
        },
        409,
      );
    }
    const message = error instanceof Error ? error.message : 'Failed to initiate payment';
    console.error('[customer/warmpawz-pay/initiate]', error);
    return c.json({ success: false, error: message }, 500);
  }
}
