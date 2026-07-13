/** Presigned PUT is for documents (PDF, etc.) — photos use ImageService multipart APIs. */
export const PRESIGNED_IMAGE_REJECT_MESSAGE =
  'Image uploads must use multipart upload APIs (profile photo, product images, gallery). Presigned upload is for documents only.';

export function presignedImageUploadRejected(fileType: unknown): string | null {
  if (typeof fileType === 'string' && fileType.trim().toLowerCase().startsWith('image/')) {
    return PRESIGNED_IMAGE_REJECT_MESSAGE;
  }
  return null;
}
