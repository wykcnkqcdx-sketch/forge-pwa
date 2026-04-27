import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colours, shadow } from '../theme';

type Props = {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  sub: string;
  tone?: string;
};

export function MetricCard({ icon, label, value, sub, tone = colours.cyan }: Props) {
  const iconBg = `${tone}18`;
  const iconBorder = `${tone}30`;

  return (
    <View style={[styles.card, shadow.subtle]}>
      <View style={styles.topRow}>
        <Text style={styles.label}>{label.toUpperCase()}</Text>
        <View style={[styles.iconWrap, { backgroundColor: iconBg, borderColor: iconBorder }]}>
          <Ionicons name={icon} size={16} color={tone} />
        </View>
      </View>
      <Text style={[styles.value, { color: tone }]}>{value}</Text>
      <Text style={styles.sub}>{sub}</Text>
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
    padding: 13,
    marginBottom: 12,
    overflow: 'hidden',
    gap: 2,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  iconWrap: {
    width: 30,
    height: 30,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    color: colours.muted,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.1,
  },
  value: {
    fontSize: 24,
    fontWeight: '900',
    lineHeight: 28,
  },
  sub: {
    color: colours.soft,
    fontSize: 11,
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
