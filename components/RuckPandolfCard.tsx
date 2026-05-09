import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Card } from './Card';
import { colours, typography } from '../theme';
import type { RuckEstimate } from '../lib/h2f';
import { responsiveSpacing } from '../utils/styling';

export function RuckPandolfCard({
  pandolf,
  distanceKm,
  loadKg,
}: {
  pandolf: RuckEstimate;
  distanceKm: number;
  loadKg: number;
}) {
  return (
    <Card accent={colours.cyan}>
      <Text style={styles.cardTitle}>Enhanced Pandolf Load Model</Text>
      <View style={styles.navGrid}>
        <View style={styles.navItem}>
          <Text style={styles.navValue}>{pandolf.watts}W</Text>
          <Text style={styles.navLabel}>raw cost</Text>
        </View>
        <View style={styles.navItem}>
          <Text style={styles.navValue}>{pandolf.wattsCorrected}W</Text>
          <Text style={styles.navLabel}>+27% heavy-load correction</Text>
        </View>
        <View style={styles.navItem}>
          <Text style={styles.navValue}>{pandolf.loadRatio}</Text>
          <Text style={styles.navLabel}>load/body ratio</Text>
        </View>
        <View style={styles.navItem}>
          <Text style={styles.navValue}>{Math.round(distanceKm * loadKg)}</Text>
          <Text style={styles.navLabel}>planned kg-km</Text>
        </View>
      </View>
      <Text style={styles.navGuide}>
        Model uses body mass, carried load, speed, grade, and terrain. The heavy-load correction applies when load reaches 27% of body mass.
      </Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  cardTitle: { color: colours.text, fontSize: 19, fontWeight: '900', marginBottom: responsiveSpacing('md') },
  navGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: responsiveSpacing('sm'), marginTop: responsiveSpacing('md') },
  navItem: {
    width: '47%',
    borderWidth: 1,
    borderColor: colours.borderSoft,
    borderRadius: 12,
    padding: responsiveSpacing('md'),
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  navValue: { color: colours.cyan, fontSize: 17, fontWeight: '900' },
  navLabel: { ...typography.label, color: colours.muted, marginTop: 3 },
  navGuide: { color: colours.textSoft, fontSize: 13, lineHeight: 19, marginTop: 12 },
});
