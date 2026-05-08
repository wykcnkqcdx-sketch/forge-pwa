// ── FORGE Tactical Design System ─────────────────────────────
// Military-grade, dark, disciplined, premium.
// All existing exports preserved for backward compatibility.

import { StyleSheet } from 'react-native';

export const colours = {
  // ── Core Backgrounds ──────────────────────────────────────────
  background:   '#0B0F0C',
  surface:      '#111711',
  panel:        'rgba(17, 23, 17, 0.96)',
  panelSoft:    '#111711',
  panelHot:     'rgba(143, 166, 59, 0.07)',
  glass:        'rgba(255, 255, 255, 0.045)',
  glassWarm:    'rgba(255, 255, 255, 0.028)',

  // ── Primary Accent — Armoury Green ────────────────────────────
  cyan:         '#8FA63B',   // legacy name kept; actually armoury olive-green
  cyanGlow:     'rgba(143, 166, 59, 0.22)',
  cyanDim:      'rgba(143, 166, 59, 0.10)',

  // ── Status: Readiness Green ────────────────────────────────────
  green:        '#A7C957',
  greenGlow:    'rgba(167, 201, 87, 0.20)',
  greenDim:     'rgba(167, 201, 87, 0.09)',

  // ── Status: Warning Amber ──────────────────────────────────────
  amber:        '#D7A84B',
  amberGlow:    'rgba(215, 168, 75, 0.18)',
  amberDim:     'rgba(215, 168, 75, 0.08)',

  // ── Status: Critical Red ───────────────────────────────────────
  red:          '#E05F4F',
  redGlow:      'rgba(224, 95, 79, 0.18)',
  redDim:       'rgba(224, 95, 79, 0.08)',

  // ── Accent: Sage/Violet ────────────────────────────────────────
  violet:       '#8E9F7A',
  violetDim:    'rgba(142, 159, 122, 0.10)',

  // ── Accent: Sand ──────────────────────────────────────────────
  sand:         '#C2B280',
  sandDim:      'rgba(194, 178, 128, 0.10)',

  // ── Text ──────────────────────────────────────────────────────
  text:         '#F0F2E8',
  textSoft:     'rgba(240, 242, 232, 0.82)',
  muted:        'rgba(213, 218, 196, 0.58)',
  soft:         'rgba(213, 218, 196, 0.36)',

  // ── Borders ───────────────────────────────────────────────────
  border:       'rgba(143, 166, 59, 0.18)',
  borderSoft:   'rgba(240, 242, 232, 0.08)',
  borderHot:    'rgba(143, 166, 59, 0.38)',
  borderGlass:  'rgba(255, 255, 255, 0.09)',

  // ── Tactical Surface Layers ───────────────────────────────────
  layer1:       'rgba(255, 255, 255, 0.030)',  // barely lifted
  layer2:       'rgba(255, 255, 255, 0.055)',  // card interior
  layer3:       'rgba(255, 255, 255, 0.085)',  // focus/hover

  // ── Tactical Status Chips ─────────────────────────────────────
  goGreen:      '#A7C957',
  goGreenDim:   'rgba(167, 201, 87, 0.12)',
  cautionAmber: '#D7A84B',
  cautionDim:   'rgba(215, 168, 75, 0.12)',
  noGoRed:      '#E05F4F',
  noGoDim:      'rgba(224, 95, 79, 0.12)',

  // ── Load Risk ─────────────────────────────────────────────────
  loadLow:      '#A7C957',
  loadMod:      '#D7A84B',
  loadHigh:     '#E05F4F',

  // ── Chart Palette ─────────────────────────────────────────────
  chartRuck:    '#D7A84B',
  chartStr:     '#A7C957',
  chartRun:     '#8FA63B',
  chartCardio:  '#8E9F7A',
  chartMob:     '#C2B280',
  chartWork:    '#BEC5A8',

  // ── Input States ──────────────────────────────────────────────
  inputBg:      'rgba(0, 0, 0, 0.28)',
  inputBorder:  'rgba(240, 242, 232, 0.12)',
  inputFocus:   'rgba(143, 166, 59, 0.45)',
  inputError:   'rgba(224, 95, 79, 0.45)',
  inputDisabled:'rgba(213, 218, 196, 0.14)',

  // ── Disabled ──────────────────────────────────────────────────
  disabled:     'rgba(213, 218, 196, 0.22)',
  disabledText: 'rgba(213, 218, 196, 0.36)',
} as const;

// ── Typography ─────────────────────────────────────────────────
export const typography = StyleSheet.create({
  h1: { fontSize: 56, fontWeight: '900' as const, letterSpacing: -1.0, color: colours.text },
  h2: { fontSize: 46, fontWeight: '900' as const, letterSpacing: -0.8, color: colours.text },
  h3: { fontSize: 32, fontWeight: '900' as const, letterSpacing: -0.5, color: colours.text },
  h4: { fontSize: 22, fontWeight: '900' as const, letterSpacing: -0.2, color: colours.text },
  body: { fontSize: 15, lineHeight: 22, color: colours.textSoft },
  caption: { fontSize: 12, fontWeight: '700' as const, letterSpacing: 0.8, color: colours.muted },
  label: { fontSize: 10, fontWeight: '900' as const, letterSpacing: 1.8, color: colours.muted, textTransform: 'uppercase' as const },
  mono: { fontSize: 13, fontWeight: '700' as const, letterSpacing: 0.5, fontVariant: ['tabular-nums'] as const },
});

// ── Spacing ────────────────────────────────────────────────────
export const spacing = {
  xs:   4,
  sm:   8,
  md:   12,
  lg:   16,
  xl:   20,
  xxl:  28,
  xxxl: 40,
} as const;

// ── Touch Target ───────────────────────────────────────────────
export const touchTarget = 52;

// ── Border Radius ──────────────────────────────────────────────
export const radius = {
  xs:   6,
  sm:   10,
  md:   16,
  lg:   22,
  xl:   28,
  pill: 999,
} as const;

// ── Font Size Scale ────────────────────────────────────────────
export const fontSize = {
  xs:    10,
  sm:    12,
  md:    14,
  lg:    16,
  xl:    20,
  '2xl': 24,
  '3xl': 32,
  '4xl': 46,
  '5xl': 56,
} as const;

// ── Shadows ────────────────────────────────────────────────────
export const shadows = {
  cyan: {
    shadowColor: '#8FA63B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.30,
    shadowRadius: 14,
    elevation: 10,
  },
  card: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.42,
    shadowRadius: 18,
    elevation: 12,
  },
  subtle: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.22,
    shadowRadius: 6,
    elevation: 4,
  },
  elevated: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.48,
    shadowRadius: 26,
    elevation: 18,
  },
  glow: {
    shadowColor: '#8FA63B',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.45,
    shadowRadius: 20,
    elevation: 14,
  },
} as const;

// ── Shadow alias (legacy) ──────────────────────────────────────
export const shadow = shadows;

// ── Gradient Token Descriptors (use with expo-linear-gradient) ─
export const gradients = {
  hero:    { colors: ['#151A15', '#0B0F0C'] as const, start: { x: 0, y: 0 }, end: { x: 0, y: 1 } },
  card:    { colors: ['rgba(255,255,255,0.055)', 'rgba(255,255,255,0.022)'] as const, start: { x: 0, y: 0 }, end: { x: 0, y: 1 } },
  greenUp: { colors: ['rgba(167,201,87,0.18)', 'rgba(167,201,87,0.03)'] as const, start: { x: 0, y: 0 }, end: { x: 0, y: 1 } },
  amberUp: { colors: ['rgba(215,168,75,0.16)', 'rgba(215,168,75,0.02)'] as const, start: { x: 0, y: 0 }, end: { x: 0, y: 1 } },
  redUp:   { colors: ['rgba(224,95,79,0.16)', 'rgba(224,95,79,0.02)'] as const, start: { x: 0, y: 0 }, end: { x: 0, y: 1 } },
} as const;
