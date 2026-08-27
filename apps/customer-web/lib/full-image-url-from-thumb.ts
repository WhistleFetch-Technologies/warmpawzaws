/** Derived list thumbs use `{name}.thumb.webp`. The sibling full object is `{name}.webp`. */
export function isDerivedThumbImageSrc(src: string | null | undefined): boolean {
  return Boolean(src && src.includes('.thumb.'));
}

export function fullImageUrlFromThumbSrc(src: string): string | null {
  const trimmed = src.trim();
  if (!isDerivedThumbImageSrc(trimmed)) return null;
  const next = trimmed.replace(/\.thumb\.(webp|jpe?g|png|gif)\b/i, '.$1');
  return next !== trimmed ? next : null;
}
