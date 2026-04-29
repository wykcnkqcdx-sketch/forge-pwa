// ── FORGE Military Design Tokens ────────────────────────────

import { StyleSheet } from 'react-native';

export const colours = {
  // Backgrounds
  background:   '#04080F',
  surface:      '#070D18',
  panel:        'rgba(10, 18, 30, 0.88)',
  glass:        'rgba(255, 255, 255, 0.055)',
  glassWarm:    'rgba(255, 255, 255, 0.035)',

  // Accents
  cyan:         '#00E5FF',
  cyanGlow:     'rgba(0, 229, 255, 0.18)',
  cyanDim:      'rgba(0, 229, 255, 0.10)',
  green:        '#00FF87',
  greenGlow:    'rgba(0, 255, 135, 0.16)',
  greenDim:     'rgba(0, 255, 135, 0.08)',
  amber:        '#FFB020',
  amberGlow:    'rgba(255, 176, 32, 0.16)',
  amberDim:     'rgba(255, 176, 32, 0.08)',
  red:          '#FF3D3D',
  redGlow:      'rgba(255, 61, 61, 0.16)',
  redDim:       'rgba(255, 61, 61, 0.08)',
  violet:       '#B48EFF',
  violetDim:    'rgba(180, 142, 255, 0.10)',
  sand:         '#C8A96A',
  sandDim:      'rgba(200, 169, 106, 0.10)',

  // Text
  text:         '#E8F4FF',
  textSoft:     'rgba(220, 238, 255, 0.85)',
  muted:        'rgba(160, 200, 240, 0.60)',
  soft:         'rgba(120, 160, 210, 0.40)',

  // Borders
  border:       'rgba(0, 229, 255, 0.10)',
  borderSoft:   'rgba(255, 255, 255, 0.07)',
  borderHot:    'rgba(0, 229, 255, 0.32)',
  borderGlass:  'rgba(255, 255, 255, 0.10)',

  // Legacy aliases kept so existing screens compile
  panelSoft:    '#070D18',
  panelHot:     'rgba(0, 229, 255, 0.06)',
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
    fontSize: 16,
    lineHeight: 24,
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
    shadowColor: '#00E5FF',
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
