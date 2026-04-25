import { StyleSheet } from 'react-native';
import { colours, fontSize } from '../theme';

export const typography = StyleSheet.create({
  screenTitle: {
    color: colours.text,
    fontSize: fontSize['3xl'],
    fontWeight: '900',
    marginBottom: 16,
    lineHeight: 36,
  },
  screenSub: {
    color: colours.muted,
    fontSize: fontSize.sm,
    lineHeight: 18,
    marginBottom: 4,
  },
  cardTitle: {
    color: colours.text,
    fontSize: fontSize.xl,
    fontWeight: '900',
  },
  label: {
    color: colours.muted,
    fontSize: fontSize.xs,
    fontWeight: '800',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  value: {
    color: colours.text,
    fontSize: fontSize['4xl'],
    fontWeight: '900',
    lineHeight: 46,
  },
  valueSmall: {
    color: colours.text,
    fontSize: fontSize['2xl'],
    fontWeight: '900',
  },
  valueCyan: {
    color: colours.cyan,
    fontSize: fontSize['4xl'],
    fontWeight: '900',
    lineHeight: 46,
  },
  valueLarge: {
    color: colours.cyan,
    fontSize: fontSize['5xl'],
    fontWeight: '900',
    lineHeight: 56,
  },
  unit: {
    color: colours.muted,
    fontSize: fontSize.md,
    fontWeight: '700',
  },
  muted: {
    color: colours.muted,
    fontSize: fontSize.sm,
  },
  tiny: {
    color: colours.soft ?? colours.muted,
    fontSize: fontSize.xs,
    lineHeight: 15,
  },
  body: {
    color: colours.text,
    fontSize: fontSize.md,
    lineHeight: 21,
  },
  strong: {
    color: colours.text,
    fontWeight: '800',
    fontSize: fontSize.md,
  },
  controlLabel: {
    color: colours.text,
    fontWeight: '800',
    fontSize: fontSize.md,
  },
  controlValue: {
    color: colours.text,
    fontWeight: '900',
    width: 55,
    textAlign: 'center' as const,
    fontSize: fontSize.lg,
  },
});
