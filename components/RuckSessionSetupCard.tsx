import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Card } from './Card';
import { colours, touchTarget } from '../theme';
import { responsiveSpacing } from '../utils/styling';

export function RuckSessionSetupCard({
  bodyMassKg,
  weightKg,
  distanceKm,
  plannedAscentM,
  terrainFactor,
  onBodyMassChange,
  onWeightChange,
  onDistanceChange,
  onAscentChange,
  onTerrainChange,
}: {
  bodyMassKg: number;
  weightKg: number;
  distanceKm: number;
  plannedAscentM: number;
  terrainFactor: number;
  onBodyMassChange: (amount: number) => void;
  onWeightChange: (amount: number) => void;
  onDistanceChange: (amount: number) => void;
  onAscentChange: (amount: number) => void;
  onTerrainChange: (amount: number) => void;
}) {
  return (
    <Card>
      <Text style={styles.cardTitle}>Session Setup</Text>
      <SetupRow label="Body Mass" value={`${bodyMassKg}kg`} onDecrement={() => onBodyMassChange(-1)} onIncrement={() => onBodyMassChange(1)} />
      <SetupRow label="Ruck Weight" value={`${weightKg}kg`} onDecrement={() => onWeightChange(-1)} onIncrement={() => onWeightChange(1)} />
      <SetupRow label="Distance" value={`${distanceKm}km`} onDecrement={() => onDistanceChange(-1)} onIncrement={() => onDistanceChange(1)} />
      <SetupRow label="Ascent" value={`${plannedAscentM}m`} onDecrement={() => onAscentChange(-50)} onIncrement={() => onAscentChange(50)} />
      <SetupRow label="Terrain Factor" value={`${terrainFactor.toFixed(1)}x`} onDecrement={() => onTerrainChange(-0.1)} onIncrement={() => onTerrainChange(0.1)} />
    </Card>
  );
}

function SetupRow({
  label,
  value,
  onDecrement,
  onIncrement,
}: {
  label: string;
  value: string;
  onDecrement: () => void;
  onIncrement: () => void;
}) {
  return (
    <View style={styles.controlRow}>
      <Text style={styles.controlLabel}>{label}</Text>
      <View style={styles.buttons}>
        <Pressable style={styles.smallButton} onPress={onDecrement}>
          <Text style={styles.smallButtonText}>-</Text>
        </Pressable>
        <Text style={styles.controlValue}>{value}</Text>
        <Pressable style={styles.smallButton} onPress={onIncrement}>
          <Text style={styles.smallButtonText}>+</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  cardTitle: { color: colours.text, fontSize: 19, fontWeight: '900', marginBottom: responsiveSpacing('md') },
  controlRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginVertical: responsiveSpacing('sm'), gap: responsiveSpacing('md') },
  controlLabel: { color: colours.text, fontWeight: '800' },
  buttons: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  smallButton: { width: touchTarget, height: touchTarget, borderRadius: 8, backgroundColor: colours.cyan, alignItems: 'center', justifyContent: 'center' },
  smallButtonText: { color: '#07111E', fontSize: 20, fontWeight: '900' },
  controlValue: { color: colours.text, fontWeight: '900', width: 55, textAlign: 'center' },
});
