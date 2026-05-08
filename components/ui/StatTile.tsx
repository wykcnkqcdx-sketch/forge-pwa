import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colours, radius, shadows } from '../../theme';
import { statusColors } from '../../utils/styling';
import { useResponsive } from '../../utils/responsive';

type Props = {
  label: string;
  value: string;
  sub?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  tone?: string;
  onPress?: () => void;
  flex?: number;
};

export function StatTile({ label, value, sub, icon, tone = colours.cyan, onPress, flex }: Props) {
  const { fs, isTablet } = useResponsive();
  const ic = statusColors(tone);

  const Inner = (
    <View style={[styles.tile, shadows.subtle, flex !== undefined && { flex }]}>
      {/* Top accent line */}
      <View style={[styles.topAccent, { backgroundColor: tone }]} />

      <View style={styles.topRow}>
        <Text style={[styles.label, { fontSize: fs(9, { min: 8, max: 11 }) }]}>{label.toUpperCase()}</Text>
        {icon && (
          <View style={[styles.iconBox, { backgroundColor: ic.bgMed, borderColor: ic.borderMed, width: isTablet ? 30 : 26, height: isTablet ? 30 : 26 }]}>
            <Ionicons name={icon} size={isTablet ? 15 : 13} color={tone} />
          </View>
        )}
      </View>

      <Text style={[styles.value, { color: tone, fontSize: fs(20, { min: 16, max: 28 }) }]}>{value}</Text>
      {sub ? <Text style={[styles.sub, { fontSize: fs(10, { min: 9, max: 12 }) }]}>{sub}</Text> : null}

      {onPress && (
        <Text style={[styles.tapHint, { color: tone, fontSize: fs(9, { min: 8, max: 10 }) }]}>Tap ›</Text>
      )}
    </View>
  );

  if (onPress) {
    return (
      <Pressable
        style={({ pressed }) => [pressed && { opacity: 0.75 }, flex !== undefined && { flex }]}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${value}`}
      >
        {Inner}
      </Pressable>
    );
  }

  return Inner;
}

const styles = StyleSheet.create({
  tile: {
    flex: 1,
    minWidth: 120,
    backgroundColor: colours.surface,
    borderWidth: 1,
    borderColor: colours.borderSoft,
    borderRadius: radius.md,
    padding: 12,
    overflow: 'hidden',
    gap: 2,
  },
  topAccent: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 2,
    opacity: 0.55,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
    marginTop: 4,
  },
  label: {
    color: colours.muted,
    fontWeight: '900',
    letterSpacing: 1.4,
    flex: 1,
  },
  iconBox: {
    borderRadius: radius.xs,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  value: {
    fontWeight: '900',
    lineHeight: 26,
  },
  sub: {
    color: colours.muted,
    fontWeight: '700',
    marginTop: 1,
  },
  tapHint: {
    fontWeight: '900',
    marginTop: 4,
    letterSpacing: 0.5,
  },
});
