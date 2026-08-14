import {
  applyVendorServicePublishEnableSync,
  buildVendorServiceUpdateData,
  isVendorServicePublishedStatus,
} from '../vendor-service-publish-sync';

describe('isVendorServicePublishedStatus', () => {
  it('accepts published and auto_published', () => {
    expect(isVendorServicePublishedStatus('published')).toBe(true);
    expect(isVendorServicePublishedStatus('auto_published')).toBe(true);
    expect(isVendorServicePublishedStatus('Published')).toBe(true);
  });

  it('rejects draft and pending', () => {
    expect(isVendorServicePublishedStatus('draft')).toBe(false);
    expect(isVendorServicePublishedStatus('pending_approval')).toBe(false);
  });
});

describe('applyVendorServicePublishEnableSync', () => {
  it('enables service when publish_status is set to published', () => {
    const data: Record<string, unknown> = { publish_status: 'published', is_enabled: false };
    applyVendorServicePublishEnableSync(data);
    expect(data.is_enabled).toBe(true);
    expect(data.publish_status).toBe('published');
  });

  it('published wins when both publish and disable are sent together', () => {
    const data = buildVendorServiceUpdateData({
      publish_status: 'published',
      is_enabled: false,
    });
    expect(data.is_enabled).toBe(true);
    expect(data.publish_status).toBe('published');
  });

  it('unpublishes to draft when is_enabled is set false', () => {
    const data: Record<string, unknown> = { is_enabled: false };
    applyVendorServicePublishEnableSync(data);
    expect(data.is_enabled).toBe(false);
    expect(data.publish_status).toBe('draft');
  });

  it('does not change publish_status when enabling without publish update', () => {
    const data: Record<string, unknown> = { is_enabled: true, price: 500 };
    applyVendorServicePublishEnableSync(data);
    expect(data.publish_status).toBeUndefined();
  });
});
