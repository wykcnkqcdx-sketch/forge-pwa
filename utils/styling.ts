import { StyleSheet, ViewStyle, TextStyle } from 'react-native';
import { colours, spacing, radius, fontSize, shadow } from '../theme';
import { Dimensions } from 'react-native';

const { width: screenWidth } = Dimensions.get('window');

// ── Responsive Spacing ─────────────────────────────────────
export const responsiveSpacing = (size: keyof typeof spacing) => {
  const base = spacing[size];
  return Math.min(base, Math.max(4, base * (screenWidth / 375)));
};

// ── Glass Backgrounds ──────────────────────────────────────
export const glassBg = (opacity: number = 0.05): string => 
  `rgba(255, 255, 255, ${opacity.toFixed(3)})`;

// ── Status Colors (pre-mixed variants) ─────────────────────
export const statusColors = (baseColor: string) => ({
  bgLight: `${baseColor}12`,
  bgMed: `${baseColor}16`,
  borderLight: `${baseColor}30`,
  borderMed: `${baseColor}40`,
  borderHeavy: `${baseColor}55`,
  textHeavy: `${baseColor}CC`,
});

// ── Common Components ──────────────────────────────────────
export const pillStyle: ViewStyle = {
  borderRadius: radius.pill,
  paddingHorizontal: spacing.md,
  paddingVertical: spacing.xs,
  flexDirection: 'row',
  alignItems: 'center',
  gap: spacing.xs,
};

export const tagStyle: ViewStyle = {
  ...pillStyle,
  borderWidth: 1,
  minHeight: 20,
};

export const buttonPrimary: ViewStyle = {
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'center',
  gap: spacing.sm,
  backgroundColor: colours.cyan,
  borderRadius: radius.md,
  paddingVertical: 13,
  ...shadow.cyan,
};

export const buttonSecondary: ViewStyle = {
  borderWidth: 1,
  borderColor: colours.borderSoft,
  borderRadius: radius.md,
  paddingVertical: 12,
  paddingHorizontal: spacing.lg,
  backgroundColor: glassBg(0.04),
};

export const textHeading: TextStyle = {
  fontWeight: '900',
  letterSpacing: -0.3,
};

export const textBody: TextStyle = {
  lineHeight: 19,
  color: colours.textSoft,
};

export const textMuted: TextStyle = {
  color: colours.muted,
  fontSize: fontSize.sm,
  fontWeight: '900',
  letterSpacing: 1.2,
};

// ── Card Helpers ───────────────────────────────────────────
export const makeCardStyle = (accent?: string, hot?: boolean): ViewStyle => ({
  backgroundColor: hot ? `${colours.cyan}06` : 'rgba(10, 20, 35, 0.80)',
  borderWidth: 1,
  borderColor: hot ? colours.border : colours.borderSoft,
  ...(hot && { borderLeftWidth: 2, borderLeftColor: colours.cyan }),
  borderRadius: radius.lg,
  overflow: 'hidden',
  marginBottom: spacing.lg,
  ...shadow.card,
  ...(accent && {
    position: 'relative',
    '&::before': { /* Web accent bar */ content: '""', position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, backgroundColor: accent, borderTopLeftRadius: radius.lg, borderBottomLeftRadius: radius.lg, opacity: 0.85 },
  }),
});

// ── Typography Presets ─────────────────────────────────────
export const typography = {
  h1: { fontSize: fontSize['5xl'], fontWeight: '900' as const },
  h2: { fontSize: fontSize['4xl'], fontWeight: '900' as const },
  h3: { fontSize: fontSize['3xl'], fontWeight: '900' as const },
  h4: { fontSize: fontSize['2xl'], fontWeight: '900' as const },
  body: { fontSize: fontSize.lg, ...textBody },
  caption: { fontSize: fontSize.sm, ...textMuted },
  label: { fontSize: fontSize.xs, fontWeight: '900' as const, letterSpacing: 1.5, color: colours.muted },
} as const;

// ── Shadow Presets ─────────────────────────────────────────
export const shadows = {
  card: shadow.card,
  cyan: shadow.cyan,
  subtle: shadow.subtle,
  elevated: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.45,
    shadowRadius: 24,
    elevation: 16,
  },
};

