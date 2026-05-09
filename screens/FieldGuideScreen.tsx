import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '../components/Card';
import { Screen } from '../components/Screen';
import { ALL_ABBREVS, CATEGORIES } from '../data/militaryAbbreviations';
import { colours, radius, touchTarget, typography } from '../theme';

const packingList = [
  'Ruck with fitted straps',
  'Water and electrolytes',
  'Foot care kit',
  'Weather layer',
  'Navigation backup',
  'Head torch',
  'Basic first aid',
];

const routeCardRows = ['SP', 'CP1', 'CP2', 'Water', 'RV', 'ERV', 'Finish'];
const riskRows = ['Route and weather', 'Load and pace', 'Hydration', 'Foot care', 'Emergency contact'];

export function FieldGuideScreen() {
  const [query, setQuery] = useState('');
  const filteredTerms = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return ALL_ABBREVS.slice(0, 24);
    return ALL_ABBREVS.filter((term) => (
      term.abbr.toLowerCase().includes(q) || term.meaning.toLowerCase().includes(q)
    ));
  }, [query]);

  return (
    <Screen>
      <View style={styles.header}>
        <Text style={styles.kicker}>FIELD GUIDE</Text>
        <Text style={styles.title}>Offline tactical fitness reference</Text>
      </View>

      <Card>
        <View style={styles.searchBox}>
          <Ionicons name="search-outline" size={18} color={colours.muted} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search RV, ERV, HLS, CASEVAC..."
            placeholderTextColor={colours.soft}
            style={styles.searchInput}
          />
        </View>
        <View style={styles.termGrid}>
          {filteredTerms.map((term) => (
            <View key={`${term.abbr}-${term.meaning}`} style={styles.termCard}>
              <Text style={styles.termAbbr}>{term.abbr}</Text>
              <Text style={styles.termMeaning}>{term.meaning}</Text>
            </View>
          ))}
        </View>
      </Card>

      <Card>
        <Text style={styles.cardTitle}>Ruck Packing Checklist</Text>
        {packingList.map((item) => (
          <View key={item} style={styles.checkRow}>
            <Ionicons name="square-outline" size={18} color={colours.cyan} />
            <Text style={styles.rowText}>{item}</Text>
          </View>
        ))}
      </Card>

      <Card>
        <Text style={styles.cardTitle}>Route Card Template</Text>
        {routeCardRows.map((row, index) => (
          <View key={row} style={styles.templateRow}>
            <Text style={styles.templateIndex}>{index + 1}</Text>
            <View style={styles.templateCopy}>
              <Text style={styles.templateLabel}>{row}</Text>
              <Text style={styles.templateHint}>Grid, distance, bearing, ETA, notes</Text>
            </View>
          </View>
        ))}
      </Card>

      <Card>
        <Text style={styles.cardTitle}>Risk Assessment</Text>
        {riskRows.map((row) => (
          <View key={row} style={styles.checkRow}>
            <Ionicons name="warning-outline" size={18} color={colours.amber} />
            <Text style={styles.rowText}>{row}</Text>
          </View>
        ))}
      </Card>

      <Card>
        <Text style={styles.cardTitle}>Hydration and Recovery</Text>
        <Text style={styles.body}>Start hydrated, carry enough fluid for the route, and add electrolytes for longer or hot-weather efforts.</Text>
        <Text style={styles.body}>After training, record foot issues, pain flags, sleep impact, and whether the pace or load should change next time.</Text>
      </Card>

      <Card>
        <Text style={styles.cardTitle}>Planning Frameworks</Text>
        {CATEGORIES.find((category) => category.id === 'planning')?.terms.slice(0, 6).map((term) => (
          <Pressable key={term.abbr} style={styles.frameworkRow}>
            <Text style={styles.frameworkAbbr}>{term.abbr}</Text>
            <Text style={styles.frameworkMeaning}>{term.meaning}</Text>
          </Pressable>
        ))}
      </Card>

      <View style={styles.safetyPanel}>
        <Ionicons name="shield-checkmark-outline" size={18} color={colours.green} />
        <Text style={styles.safetyText}>FORGE map and team tools are for fitness, training navigation, safety check-ins, and voluntary squad accountability only.</Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { gap: 4 },
  kicker: { ...typography.label, color: colours.cyan },
  title: { color: colours.text, fontSize: 30, lineHeight: 34, fontWeight: '900' },
  searchBox: { minHeight: touchTarget, borderWidth: 1, borderColor: colours.borderSoft, borderRadius: radius.sm, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, backgroundColor: colours.inputBg },
  searchInput: { flex: 1, color: colours.text, fontSize: 15, fontWeight: '800' },
  termGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  termCard: { width: '48%', flexGrow: 1, borderWidth: 1, borderColor: colours.borderSoft, borderRadius: radius.sm, padding: 10, backgroundColor: colours.layer1 },
  termAbbr: { color: colours.cyan, fontSize: 16, fontWeight: '900' },
  termMeaning: { ...typography.caption, color: colours.textSoft, marginTop: 4, lineHeight: 17 },
  cardTitle: { ...typography.h4, color: colours.text, marginBottom: 12 },
  checkRow: { minHeight: 42, flexDirection: 'row', alignItems: 'center', gap: 10, borderTopWidth: 1, borderTopColor: colours.borderSoft },
  rowText: { flex: 1, color: colours.textSoft, fontSize: 14, fontWeight: '800' },
  templateRow: { minHeight: 54, flexDirection: 'row', alignItems: 'center', gap: 12, borderTopWidth: 1, borderTopColor: colours.borderSoft },
  templateIndex: { width: 28, height: 28, borderRadius: 14, backgroundColor: colours.cyanDim, color: colours.cyan, textAlign: 'center', lineHeight: 28, fontWeight: '900' },
  templateCopy: { flex: 1 },
  templateLabel: { color: colours.text, fontWeight: '900' },
  templateHint: { ...typography.caption, color: colours.muted, marginTop: 2 },
  body: { ...typography.body, color: colours.textSoft, marginTop: 8 },
  frameworkRow: { minHeight: 46, flexDirection: 'row', alignItems: 'center', gap: 12, borderTopWidth: 1, borderTopColor: colours.borderSoft },
  frameworkAbbr: { width: 72, color: colours.amber, fontWeight: '900' },
  frameworkMeaning: { flex: 1, color: colours.textSoft, fontSize: 13, fontWeight: '800' },
  safetyPanel: { borderWidth: 1, borderColor: `${colours.green}45`, borderRadius: radius.sm, backgroundColor: colours.greenDim, padding: 12, flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  safetyText: { flex: 1, color: colours.green, fontSize: 12, lineHeight: 18, fontWeight: '900' },
});
