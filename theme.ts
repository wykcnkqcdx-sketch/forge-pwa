// ── FORGE Military Design Tokens ────────────────────────────

import { StyleSheet } from 'react-native';

export const colours = {
  // Backgrounds
  background:   '#121212',
  surface:      '#1B1F1A',
  panel:        'rgba(27, 31, 26, 0.94)',
  glass:        'rgba(255, 255, 255, 0.055)',
  glassWarm:    'rgba(255, 255, 255, 0.035)',

  // Accents
  cyan:         '#8FA63B',
  cyanGlow:     'rgba(143, 166, 59, 0.20)',
  cyanDim:      'rgba(143, 166, 59, 0.12)',
  green:        '#A7C957',
  greenGlow:    'rgba(167, 201, 87, 0.18)',
  greenDim:     'rgba(167, 201, 87, 0.10)',
  amber:        '#D7A84B',
  amberGlow:    'rgba(255, 176, 32, 0.16)',
  amberDim:     'rgba(255, 176, 32, 0.08)',
  red:          '#E05F4F',
  redGlow:      'rgba(255, 61, 61, 0.16)',
  redDim:       'rgba(255, 61, 61, 0.08)',
  violet:       '#8E9F7A',
  violetDim:    'rgba(142, 159, 122, 0.12)',
  sand:         '#C2B280',
  sandDim:      'rgba(200, 169, 106, 0.10)',

  // Text
  text:         '#F0F2E8',
  textSoft:     'rgba(240, 242, 232, 0.84)',
  muted:        'rgba(213, 218, 196, 0.62)',
  soft:         'rgba(213, 218, 196, 0.40)',

  // Borders
  border:       'rgba(143, 166, 59, 0.16)',
  borderSoft:   'rgba(240, 242, 232, 0.09)',
  borderHot:    'rgba(143, 166, 59, 0.36)',
  borderGlass:  'rgba(255, 255, 255, 0.10)',

  // Legacy aliases kept so existing screens compile
  panelSoft:    '#1B1F1A',
  panelHot:     'rgba(143, 166, 59, 0.08)',
} as const;

export const typography = StyleSheet.create({
  h1: {
    fontSize: 56,
    fontWeight: '900' as const,
  },
  h2: {
    fontSize: 46,
    fontWeight: '900' as const,
  },
  h3: {
    fontSize: 32,
    fontWeight: '900' as const,
  },
  h4: {
    fontSize: 24,
    fontWeight: '900' as const,
  },
  body: {
    fontSize: 18,
    lineHeight: 27,
    color: colours.textSoft,
  },
  caption: {
    fontSize: 12,
    color: colours.muted,
    fontWeight: '900' as const,
    letterSpacing: 1.2,
  },
  label: {
    fontSize: 10,
    fontWeight: '900' as const,
    letterSpacing: 1.5,
    color: colours.muted,
  },
});

export const spacing = {
  xs:   4,
  sm:   8,
  md:   12,
  lg:   16,
  xl:   20,
  xxl:  28,
  xxxl: 40,
} as const;

export const touchTarget = 52;

export const radius = {
  sm:   10,
  md:   16,
  lg:   22,
  xl:   28,
  pill: 999,
} as const;

export const fontSize = {
  xs:   10,
  sm:   12,
  md:   14,
  lg:   16,
  xl:   20,
  '2xl': 24,
  '3xl': 32,
  '4xl': 46,
  '5xl': 56,
} as const;

export const shadows = {
  cyan: {
    shadowColor: '#8FA63B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.28,
    shadowRadius: 12,
    elevation: 8,
  },
  card: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.40,
    shadowRadius: 20,
    elevation: 12,
  },
  subtle: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.24,
    shadowRadius: 8,
    elevation: 4,
  },
  elevated: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.45,
    shadowRadius: 24,
    elevation: 16,
  },
} as const;
export const shadow = shadows;
