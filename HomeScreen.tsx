import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colours } from '../theme';

type Props = {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  sub: string;
  tone?: string;
};

export function MetricCard({ icon, label, value, sub, tone = colours.cyan }: Props) {
  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <View>
          <Text style={styles.label}>{label}</Text>
          <Text style={styles.value}>{value}</Text>
          <Text style={styles.sub}>{sub}</Text>
        </View>
        <Ionicons name={icon} size={22} color={tone} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderColor: colours.border,
    borderWidth: 1,
    borderRadius: 24,
    padding: 16,
    marginBottom: 12,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  label: {
    color: colours.muted,
    fontSize: 12,
  },
  value: {
    color: colours.text,
    fontSize: 25,
    fontWeight: '900',
    marginTop: 4,
  },
  sub: {
    color: colours.muted,
    fontSize: 11,
    marginTop: 3,
  },
});
