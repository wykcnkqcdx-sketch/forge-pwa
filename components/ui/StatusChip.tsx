import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colours, radius } from '../../theme';

export type ChipVariant = 'go' | 'caution' | 'nogo' | 'offline' | 'sync' | 'stale' | 'info';

const CONFIG: Record<ChipVariant, {
  label: string;
  bg: string;
  border: string;
  text: string;
  icon: keyof typeof Ionicons.glyphMap;
}> = {
  go:      { label: 'GO',      bg: colours.goGreenDim,   border: `${colours.goGreen}45`,    text: colours.goGreen,      icon: 'checkmark-circle' },
  caution: { label: 'CAUTION', bg: colours.cautionDim,   border: `${colours.cautionAmber}45`, text: colours.cautionAmber, icon: 'warning' },
  nogo:    { label: 'NO-GO',   bg: colours.noGoDim,      border: `${colours.noGoRed}45`,    text: colours.noGoRed,      icon: 'close-circle' },
  offline: { label: 'OFFLINE', bg: colours.layer1,       border: colours.borderSoft,        text: colours.muted,        icon: 'cloud-offline-outline' },
  sync:    { label: 'SYNCED',  bg: colours.goGreenDim,   border: `${colours.goGreen}35`,    text: colours.goGreen,      icon: 'sync' },
  stale:   { label: 'STALE',   bg: colours.cautionDim,   border: `${colours.cautionAmber}35`, text: colours.cautionAmber, icon: 'time-outline' },
  info:    { label: 'INFO',    bg: colours.cyanDim,      border: `${colours.cyan}35`,       text: colours.cyan,         icon: 'information-circle-outline' },
};

type Props = {
  variant: ChipVariant;
  label?: string;
  size?: 'sm' | 'md';
  showIcon?: boolean;
};

export function StatusChip({ variant, label, size = 'md', showIcon = true }: Props) {
  const cfg = CONFIG[variant];
  const displayLabel = label ?? cfg.label;
  const iconSize = size === 'sm' ? 10 : 12;
  const textSize = size === 'sm' ? 9 : 10;
  const padH = size === 'sm' ? 6 : 9;
  const padV = size === 'sm' ? 3 : 5;

  return (
    <View style={[
      styles.chip,
      {
        backgroundColor: cfg.bg,
        borderColor: cfg.border,
        paddingHorizontal: padH,
        paddingVertical: padV,
      },
    ]}>
      {showIcon && <Ionicons name={cfg.icon} size={iconSize} color={cfg.text} />}
      <Text style={[styles.label, { color: cfg.text, fontSize: textSize }]}>{displayLabel}</Text>
    </View>
  );
}

/** Readiness band chip - maps GREEN/AMBER/RED to chip variants */
export function ReadinessChip({ band, size = 'md' }: { band: 'GREEN' | 'AMBER' | 'RED'; size?: 'sm' | 'md' }) {
  const variant: ChipVariant = band === 'GREEN' ? 'go' : band === 'AMBER' ? 'caution' : 'nogo';
  return <StatusChip variant={variant} label={band} size={size} />;
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderRadius: radius.pill,
    alignSelf: 'flex-start',
  },
  label: {
    fontWeight: '900',
    letterSpacing: 1.2,
  },
});
