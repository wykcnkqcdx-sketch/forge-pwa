import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colours, shadows } from '../theme';
import { statusColors } from '../utils/styling';
import { useResponsive } from '../utils/responsive';

type Props = {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  sub: string;
  tone?: string;
};

export function MetricCard({ icon, label, value, sub, tone = colours.cyan }: Props) {
  const { fs, sp, isTablet } = useResponsive();
  const iconStyles = statusColors(tone);

  return (
    <View style={[styles.card, shadows.subtle]}>
      <View style={styles.topRow}>
        <Text style={[styles.labelText, { fontSize: fs(9, { min: 8, max: 11 }), letterSpacing: isTablet ? 1.8 : 1.4 }]}>
          {label.toUpperCase()}
        </Text>
        <View style={[styles.iconWrap, { backgroundColor: iconStyles.bgMed, borderColor: iconStyles.borderMed, width: isTablet ? 36 : 30, height: isTablet ? 36 : 30 }]}>
          <Ionicons name={icon} size={isTablet ? 18 : 15} color={tone} />
        </View>
      </View>
      <Text style={[styles.valueText, { color: tone, fontSize: fs(22, { min: 18, max: 32 }) }]}>
        {value}
      </Text>
      <Text style={[styles.subText, { fontSize: fs(10, { min: 9, max: 13 }) }]}>
        {sub}
      </Text>
      <View style={[styles.bottomLine, { backgroundColor: tone }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    minWidth: 140,
    backgroundColor: colours.panel,
    borderWidth: 1,
    borderColor: colours.border,
    borderRadius: 14,
    padding: 14,
    overflow: 'hidden',
    gap: 3,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  labelText: {
    color: colours.muted,
    fontWeight: '900',
    letterSpacing: 1.4,
  },
  iconWrap: {
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  valueText: {
    fontWeight: '900',
    lineHeight: 28,
  },
  subText: {
    color: colours.muted,
    fontWeight: '900',
    letterSpacing: 1.2,
    marginTop: 2,
  },
  bottomLine: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 2,
    opacity: 0.45,
  },
});
