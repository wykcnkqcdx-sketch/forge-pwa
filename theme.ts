// ── FORGE Field Glass Design System ───────────────────────────
// Tactical field dashboard: dark, rugged, precise, disciplined.
// Primary accent: sand/gold. Secondary: olive. Red = risk only.

import { StyleSheet } from 'react-native';

export const colours = {
  // ── Core Backgrounds ──────────────────────────────────────────
  background:   '#0B0F0E',  // almost black-green
  surface:      '#121A18',  // deep tactical slate
  panel:        '#18211E',  // dark field card
  panelSoft:    '#18211E',
  panelHot:     'rgba(198, 161, 91, 0.07)',
  glass:        'rgba(255, 255, 255, 0.045)',
  glassWarm:    'rgba(255, 255, 255, 0.028)',

  // ── Primary Accent — Sand/Gold ────────────────────────────────
  cyan:         '#C6A15B',  // legacy name kept; Field Glass primary = sand/gold
  cyanGlow:     'rgba(198, 161, 91, 0.22)',
  cyanDim:      'rgba(198, 161, 91, 0.10)',

  // ── Secondary Accent — Olive ──────────────────────────────────
  violet:       '#6F7F52',  // tactical olive secondary
  violetDim:    'rgba(111, 127, 82, 0.10)',

  // ── Sand (same as primary, preserved as named token) ─────────
  sand:         '#C6A15B',
  sandDim:      'rgba(198, 161, 91, 0.10)',

  // ── Status: Readiness Green ────────────────────────────────────
  green:        '#4CAF50',  // completion / safe / GO
  greenGlow:    'rgba(76, 175, 80, 0.20)',
  greenDim:     'rgba(76, 175, 80, 0.09)',

  // ── Status: Warning Amber ──────────────────────────────────────
  amber:        '#D89B3D',
  amberGlow:    'rgba(216, 155, 61, 0.18)',
  amberDim:     'rgba(216, 155, 61, 0.08)',

  // ── Status: Risk Red ───────────────────────────────────────────
  red:          '#D9534F',  // injury / overload / missed check-in only
  redGlow:      'rgba(217, 83, 79, 0.18)',
  redDim:       'rgba(217, 83, 79, 0.08)',

  // ── Text ──────────────────────────────────────────────────────
  text:         '#F2F0E8',  // warm off-white
  textSoft:     'rgba(242, 240, 232, 0.82)',
  muted:        'rgba(169, 176, 168, 0.85)',
  soft:         'rgba(169, 176, 168, 0.45)',

  // ── Borders ───────────────────────────────────────────────────
  border:       '#2B3A34',  // muted green-grey solid
  borderSoft:   'rgba(242, 240, 232, 0.08)',
  borderHot:    'rgba(198, 161, 91, 0.38)',
  borderGlass:  'rgba(255, 255, 255, 0.09)',

  // ── Tactical Surface Layers ───────────────────────────────────
  layer1:       'rgba(255, 255, 255, 0.030)',
  layer2:       'rgba(255, 255, 255, 0.055)',
  layer3:       'rgba(255, 255, 255, 0.085)',

  // ── Tactical Status Chips ─────────────────────────────────────
  goGreen:      '#4CAF50',
  goGreenDim:   'rgba(76, 175, 80, 0.12)',
  cautionAmber: '#D89B3D',
  cautionDim:   'rgba(216, 155, 61, 0.12)',
  noGoRed:      '#D9534F',
  noGoDim:      'rgba(217, 83, 79, 0.12)',

  // ── Load Risk ─────────────────────────────────────────────────
  loadLow:      '#4CAF50',
  loadMod:      '#D89B3D',
  loadHigh:     '#D9534F',

  // ── Chart Palette ─────────────────────────────────────────────
  chartRuck:    '#C6A15B',  // sand/gold — ruck sessions
  chartStr:     '#4CAF50',  // green — strength
  chartRun:     '#6F7F52',  // olive — run
  chartCardio:  '#D89B3D',  // amber — cardio
  chartMob:     '#A9B0A8',  // muted — mobility
  chartWork:    '#BEC5A8',  // soft — general

  // ── Input States ──────────────────────────────────────────────
  inputBg:      'rgba(0, 0, 0, 0.28)',
  inputBorder:  'rgba(242, 240, 232, 0.12)',
  inputFocus:   'rgba(198, 161, 91, 0.45)',
  inputError:   'rgba(217, 83, 79, 0.45)',
  inputDisabled:'rgba(169, 176, 168, 0.14)',

  // ── Disabled ──────────────────────────────────────────────────
  disabled:     'rgba(169, 176, 168, 0.22)',
  disabledText: 'rgba(169, 176, 168, 0.36)',
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
    shadowColor: '#C6A15B',
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
    shadowColor: '#C6A15B',
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
  hero:    { colors: ['#18211E', '#0B0F0E'] as const, start: { x: 0, y: 0 }, end: { x: 0, y: 1 } },
  card:    { colors: ['rgba(255,255,255,0.055)', 'rgba(255,255,255,0.022)'] as const, start: { x: 0, y: 0 }, end: { x: 0, y: 1 } },
  sand:    { colors: ['rgba(198,161,91,0.18)', 'rgba(198,161,91,0.03)'] as const, start: { x: 0, y: 0 }, end: { x: 0, y: 1 } },
  greenUp: { colors: ['rgba(76,175,80,0.18)', 'rgba(76,175,80,0.03)'] as const, start: { x: 0, y: 0 }, end: { x: 0, y: 1 } },
  amberUp: { colors: ['rgba(216,155,61,0.16)', 'rgba(216,155,61,0.02)'] as const, start: { x: 0, y: 0 }, end: { x: 0, y: 1 } },
  redUp:   { colors: ['rgba(217,83,79,0.16)', 'rgba(217,83,79,0.02)'] as const, start: { x: 0, y: 0 }, end: { x: 0, y: 1 } },
} as const;
