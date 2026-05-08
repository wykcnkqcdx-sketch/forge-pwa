import { useWindowDimensions } from 'react-native';

// ── Device tiers ──────────────────────────────────────────────────────────────
// phone-sm: < 360   (iPhone SE)
// phone:    360–429 (iPhone 15, Pixel 7)
// phone-lg: 430–599 (S25 Ultra, Pro Max)
// tablet:   600–899 (iPad mini, small tablets)
// desktop:  900+    (iPad Pro, large tablets)
export type DeviceTier = 'phone-sm' | 'phone' | 'phone-lg' | 'tablet' | 'desktop';

export function getDeviceTier(w: number): DeviceTier {
  if (w < 360) return 'phone-sm';
  if (w < 430) return 'phone';
  if (w < 600) return 'phone-lg';
  if (w < 900) return 'tablet';
  return 'desktop';
}

// ── Scale factor ──────────────────────────────────────────────────────────────
// 1.0 at 390px (iPhone 15 base). Clamped 0.88–1.40.
export function scaleFor(width: number): number {
  return Math.min(1.40, Math.max(0.88, width / 390));
}

// ── Fluid font size ───────────────────────────────────────────────────────────
// rfs(16) → 16 at 390px, scales with screen width within optional bounds.
export function rfs(base: number, width: number, opts: { min?: number; max?: number } = {}): number {
  const scaled = Math.round(base * scaleFor(width));
  return Math.min(opts.max ?? 9999, Math.max(opts.min ?? 0, scaled));
}

// ── Fluid spacing ─────────────────────────────────────────────────────────────
export function rsp(base: number, width: number): number {
  return Math.round(base * Math.min(1.25, Math.max(0.85, width / 390)));
}

// ── Content layout ────────────────────────────────────────────────────────────
export function contentLayout(width: number) {
  const tier = getDeviceTier(width);
  const isTablet = width >= 600;
  const maxWidth = isTablet ? Math.min(680, width - 48) : width;
  const hPad = isTablet ? Math.round((width - maxWidth) / 2) : tier === 'phone-sm' ? 14 : 18;
  const gap = isTablet ? 18 : tier === 'phone-sm' ? 10 : 14;
  const cardPad = isTablet ? 22 : tier === 'phone-sm' ? 14 : 16;
  return { tier, isTablet, maxWidth, hPad, gap, cardPad };
}

// ── Hook ──────────────────────────────────────────────────────────────────────
export function useResponsive() {
  const { width, height } = useWindowDimensions();
  const tier = getDeviceTier(width);
  const scale = scaleFor(width);
  const isTablet = width >= 600;
  const layout = contentLayout(width);

  return {
    width,
    height,
    tier,
    scale,
    isTablet,
    isLandscape: width > height,
    ...layout,
    /** Fluid font size: rfs(16) → ~14 on SE, 16 at 390, 20 on tablet */
    fs: (base: number, opts?: { min?: number; max?: number }) => rfs(base, width, opts),
    /** Fluid spacing: rsp(12) → ~10 on SE, 12 at 390, 15 on tablet */
    sp: (base: number) => rsp(base, width),
  };
}
