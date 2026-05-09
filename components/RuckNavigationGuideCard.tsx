import React from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card } from './Card';
import { colours, typography } from '../theme';
import { formatDuration, formatHeading } from '../utils/ruck';
import { responsiveSpacing } from '../utils/styling';

export function RuckNavigationGuideCard({
  rotationAnim,
  activeHeading,
  naismithMinutes,
  plannedAscentM,
  routeBearing,
  currentAltitude,
}: {
  rotationAnim: Animated.Value;
  activeHeading: number | null;
  naismithMinutes: number;
  plannedAscentM: number;
  routeBearing: number | null;
  currentAltitude: number | null;
}) {
  return (
    <Card>
      <View style={styles.navHeader}>
        <View>
          <Text style={styles.cardTitle}>Navigation Guide</Text>
          <Text style={styles.muted}>Metric mountain planning</Text>
        </View>
        <View style={styles.compassDial}>
          <Animated.View
            style={{
              transform: [
                {
                  rotate: rotationAnim.interpolate({
                    inputRange: [0, 360],
                    outputRange: ['0deg', '360deg'],
                  }),
                },
              ],
            }}
          >
            <Ionicons name="navigate" size={24} color={colours.background} />
          </Animated.View>
          <Text style={styles.compassText}>{activeHeading == null ? '---' : formatHeading(activeHeading)}</Text>
        </View>
      </View>
      <View style={styles.navGrid}>
        <View style={styles.navItem}>
          <Text style={styles.navValue}>{formatDuration(naismithMinutes)}</Text>
          <Text style={styles.navLabel}>Naismith time</Text>
        </View>
        <View style={styles.navItem}>
          <Text style={styles.navValue}>{plannedAscentM}m</Text>
          <Text style={styles.navLabel}>Total ascent</Text>
        </View>
        <View style={styles.navItem}>
          <Text style={styles.navValue}>{routeBearing == null ? '--' : formatHeading(routeBearing)}</Text>
          <Text style={styles.navLabel}>Route bearing</Text>
        </View>
        <View style={styles.navItem}>
          <Text style={styles.navValue}>{currentAltitude == null ? '--' : `${currentAltitude}m`}</Text>
          <Text style={styles.navLabel}>Altitude</Text>
        </View>
      </View>
      <Text style={styles.navGuide}>
        Naismith's Rule remains a navigation cross-check; Enhanced Pandolf drives metabolic load because it accounts for body mass, external load, grade, speed, and terrain.
      </Text>
      <Text style={styles.navGuide}>
        Compass basics: set the map, take a bearing, follow the direction of travel arrow, tick off distance in metres, and re-check at every handrail, attack point, and junction.
      </Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  navHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: responsiveSpacing('md') },
  cardTitle: { color: colours.text, fontSize: 19, fontWeight: '900', marginBottom: responsiveSpacing('md') },
  muted: { ...typography.caption, color: colours.muted },
  compassDial: {
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colours.cyan,
  },
  compassText: { ...typography.label, color: colours.background, marginTop: 1 },
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
