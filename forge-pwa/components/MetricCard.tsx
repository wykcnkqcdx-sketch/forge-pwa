import React from 'react';
import { View, Text, StyleSheet, TextStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colours, shadows, typography } from '../theme';
import { statusColors, responsiveSpacing } from '../utils/styling';

type Props = {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  sub: string;
  tone?: string;
};

export function MetricCard({ icon, label, value, sub, tone = colours.cyan }: Props) {
  const iconStyles = statusColors(tone || colours.cyan);

  return (
    <View style={[styles.card, shadows.subtle]}>
      <View style={styles.topRow}>
        <Text style={typography.label}>{label.toUpperCase()}</Text>
        <View style={[styles.iconWrap, { backgroundColor: iconStyles.bgMed, borderColor: iconStyles.borderMed }]}>
          <Ionicons name={icon} size={16} color={tone} />
        </View>
      </View>
      <Text style={[typography.h4, styles.value, { color: tone }]}>{value}</Text>
      <Text style={[typography.caption, styles.sub]}>{sub}</Text>
      {/* Bottom accent line */}
      <View style={[styles.bottomLine, { backgroundColor: tone }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: 'rgba(10, 20, 35, 0.80)',
    borderWidth: 1,
    borderColor: colours.borderSoft,
    borderRadius: 12,
    padding: responsiveSpacing('md'),
    overflow: 'hidden',
    gap: responsiveSpacing('xs'),
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: responsiveSpacing('md'),
  },
  iconWrap: {
    width: 30,
    height: 30,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  value: {
    lineHeight: 28,
  } as TextStyle,
  sub: {
    marginTop: responsiveSpacing('xs'),
  } as TextStyle,
  bottomLine: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 2,
    opacity: 0.45,
  },
});

