import type { CSSProperties } from 'react';

const DEFAULT_GRADIENT_FROM = '#FF8C42';
const DEFAULT_GRADIENT_TO = '#FF6B35';

export function parseBannerMetadataRecord(raw: unknown): Record<string, unknown> {
  if (raw == null) return {};
  if (typeof raw === 'object' && !Array.isArray(raw)) return raw as Record<string, unknown>;
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw) as unknown;
      return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : {};
    } catch {
      return {};
    }
  }
  return {};
}

export function normalizeBannerHexColor(value: unknown, fallback: string): string {
  const raw = String(value ?? '').trim();
  if (!raw) return fallback;
  if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(raw)) return raw;
  if (/^([0-9a-f]{3}|[0-9a-f]{6})$/i.test(raw)) return `#${raw}`;
  return fallback;
}

export function resolveBannerGradients(
  b: Record<string, unknown>,
  defaults?: { from?: string; to?: string }
): { gradientFrom: string; gradientTo: string } {
  const meta = parseBannerMetadataRecord(b.metadata);
  return {
    gradientFrom: normalizeBannerHexColor(
      b.gradientFrom ?? b.gradient_from ?? meta.gradient_from,
      defaults?.from ?? DEFAULT_GRADIENT_FROM
    ),
    gradientTo: normalizeBannerHexColor(
      b.gradientTo ?? b.gradient_to ?? meta.gradient_to,
      defaults?.to ?? DEFAULT_GRADIENT_TO
    ),
  };
}

function hexToRgba(hex: string, alpha: number): string {
  const normalized = normalizeBannerHexColor(hex, '#000000');
  let h = normalized.slice(1);
  if (h.length === 3) {
    h = h
      .split('')
      .map((c) => c + c)
      .join('');
  }
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** CSS `background-image` value: CMS gradient, or gradient tint over photo. */
export function buildBannerBackgroundImageCss(opts: {
  imageUrl?: string | null;
  gradientFrom: string;
  gradientTo: string;
  angle?: string;
}): string {
  const from = normalizeBannerHexColor(opts.gradientFrom, DEFAULT_GRADIENT_FROM);
  const to = normalizeBannerHexColor(opts.gradientTo, DEFAULT_GRADIENT_TO);
  const angle = opts.angle ?? '135deg';
  const image = String(opts.imageUrl ?? '').trim();

  if (!image) {
    return `linear-gradient(${angle}, ${from} 0%, ${to} 100%)`;
  }

  const fromTint = hexToRgba(from, 0.85);
  const toTint = hexToRgba(to, 0.75);
  const safeUrl = image.replace(/"/g, '\\"');
  return `linear-gradient(${angle}, ${fromTint} 0%, ${toTint} 100%), url("${safeUrl}")`;
}

/** Full CSS background props for banner shells using background-image. */
export function buildBannerBackgroundStyle(opts: {
  imageUrl?: string | null;
  gradientFrom: string;
  gradientTo: string;
  angle?: string;
}): CSSProperties {
  return {
    backgroundImage: buildBannerBackgroundImageCss(opts),
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    backgroundRepeat: 'no-repeat',
  };
}

/**
 * Gradient overlay for banners that render the photo as a child (e.g. PresignableImage).
 * Uses admin CMS colors instead of a fixed black fade.
 */
export function buildBannerGradientOverlayBackground(opts: {
  gradientFrom: string;
  gradientTo: string;
  angle?: string;
}): string {
  const from = normalizeBannerHexColor(opts.gradientFrom, DEFAULT_GRADIENT_FROM);
  const to = normalizeBannerHexColor(opts.gradientTo, DEFAULT_GRADIENT_TO);
  const angle = opts.angle ?? 'to right';
  return `linear-gradient(${angle}, ${hexToRgba(from, 0.85)} 0%, ${hexToRgba(to, 0.55)} 45%, ${hexToRgba(to, 0.25)} 100%)`;
}
