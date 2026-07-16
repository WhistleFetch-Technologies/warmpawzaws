import type { Context } from 'hono';
import * as vendor_vendorid_adoptionapplications_applicationid_putRepo from '../repos/vendor_vendorid_adoptionapplications_applicationid_put.repo';

export async function executevendorVendoridAdoptionapplicationsApplicationidPut(c: Context) {
  try {
    const { vendorId, applicationId } = c.req.param();
    const body = await c.req.json();
    const { status, reviewerNotes } = body;

    if (!['approved', 'rejected', 'pending', 'under_review'].includes(status)) {
      return c.json({ error: 'Invalid status' }, 400);
    }

    const updated =
      await vendor_vendorid_adoptionapplications_applicationid_putRepo.dbVendorVendoridAdoptionapplicationsApplicationidPut0(
        applicationId,
        vendorId,
        status,
        reviewerNotes
      );

    // If approved, update pet status
    if (status === 'approved' && updated[0]?.pet_id) {
      await vendor_vendorid_adoptionapplications_applicationid_putRepo.dbVendorVendoridAdoptionapplicationsApplicationidPut1(updated[0].pet_id);
    }

    return c.json({
      success: true,
      application: updated[0],
      message: `Application ${status} successfully`,
    });
  } catch (error: any) {
    console.error('Error updating adoption application:', error);
    return c.json({ error: error.message }, 500);
  }
}
