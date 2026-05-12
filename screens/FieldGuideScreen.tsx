import React, { useMemo, useState } from 'react';
import {
  Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '../components/Screen';
import { ALL_ABBREVS, CATEGORIES } from '../data/militaryAbbreviations';
import { colours, radius, touchTarget, typography } from '../theme';

// ── Rich card data for key terms ────────────────────────────────
type RichCard = { desc: string; example?: string; related?: string[] };

const RICH: Record<string, RichCard> = {
  RV: {
    desc: 'A planned location where personnel or teams meet before or after a task.',
    example: 'RV Alpha: Main gate at 0630 before route departure.',
    related: ['ERV', 'FRV', 'SP', 'RP'],
  },
  ERV: {
    desc: 'A pre-planned emergency fallback if primary comms fail or the group gets separated.',
    example: 'ERV: Car park at the hill foot. Hold for 30 minutes then move to FRV.',
    related: ['RV', 'FRV', 'PACE'],
  },
  HLS: {
    desc: 'A pre-identified ground location suitable for helicopter operations.',
    example: 'HLS Alpha: Flat open field at grid 452 788, minimum 30 m clear.',
    related: ['HLZ', 'LZ', 'CASEVAC'],
  },
  CCP: {
    desc: 'A designated location where casualties are collected, assessed and prepared for evacuation.',
    example: 'CCP at CP3, manned by team medic from H+20.',
    related: ['CASEVAC', 'MEDEVAC', 'MIST'],
  },
  CASEVAC: {
    desc: 'The unplanned, unscheduled movement of a casualty from point of injury to medical care using any available means.',
    example: 'CASEVAC initiated: 1 T1 casualty at grid 450 780, requesting vehicle extraction.',
    related: ['MEDEVAC', 'CCP', '9-Liner', 'MIST'],
  },
  SMEAC: {
    desc: 'A five-paragraph orders format: Situation, Mission, Execution, Admin/Logistics, Command/Signal. Use it to brief your team before every ruck.',
    example: 'Issue a SMEAC brief at the SP: ground, route, pace, load, emergency actions.',
    related: ['OSMEAC', 'OPORD', 'GOTWA', 'SITREP'],
  },
  SITREP: {
    desc: 'A concise update on the current situation — location, personnel status and any problems.',
    example: 'SITREP: 4 of 4 at CP2, no casualties, on time, continuing to RV.',
    related: ['LOCSTAT', 'ACE', 'Casrep'],
  },
  LOCSTAT: {
    desc: 'A formal report of your current grid position, used in lost-comms or emergency situations.',
    example: 'LOCSTAT: Grid 450 782, moving south-west, ETA RV Alpha 1420.',
    related: ['SITREP', 'GR', 'MGRS'],
  },
  QRF: {
    desc: 'A team held at readiness to deploy rapidly in response to an incident at another location.',
    example: 'QRF at base: vehicle and 4 personnel, ready to move within 10 minutes of tasking.',
    related: ['ERV', 'CASEVAC', 'IA Drills'],
  },
  PACE: {
    desc: 'A communications plan with four escalating methods: Primary, Alternate, Contingency, Emergency.',
    example: 'P: radio  A: mobile  C: personal locator beacon  E: pre-planned RV at start point.',
    related: ['Net', 'COMSEC', 'ERV'],
  },
  MSR: {
    desc: 'The primary designated route used for movement of personnel, supplies or vehicles.',
    example: 'MSR Alpha: main road to FOB. If blocked, switch to ASR Bravo.',
    related: ['ASR', 'CP', 'SSR'],
  },
  GOTWA: {
    desc: 'A quick brief format when a leader leaves the group. Going, Others, Time, What to do, Actions on.',
    example: 'Going: to grid 452 780. Others: 2IC leads. Time: 20 mins. What: hold here. Actions on: if not back, move to ERV.',
    related: ['ERV', 'Actions On', 'SMEAC'],
  },
  MIST: {
    desc: 'A casualty handover format: Mechanism of injury, Injuries found/suspected, Signs/symptoms, Treatment given.',
    example: 'MIST: twisted ankle on descent, swelling to left ankle, walking with pain, buddy-supported.',
    related: ['ATMIST', 'CASEVAC', 'CCP', 'T2'],
  },
  BAMCIS: {
    desc: 'A planning sequence used by leaders: Begin planning, Arrange recce, Make recce, Complete plan, Issue order, Supervise.',
    example: 'Use BAMCIS for any ruck mission longer than 10 km or with multiple checkpoints.',
    related: ['SMEAC', 'GOTWA', 'METT-TC'],
  },
};

// ── Category display config ──────────────────────────────────────
const CAT_CONFIG: Record<string, { label: string; colour: string }> = {
  essential: { label: 'ESSENTIALS', colour: colours.cyan },
  movement:  { label: 'MOVEMENT',   colour: colours.violet },
  timings:   { label: 'TIMINGS',    colour: colours.amber },
  command:   { label: 'COMMAND',    colour: colours.green },
  medical:   { label: 'MEDICAL',    colour: colours.red },
  comms:     { label: 'COMMS',      colour: colours.cyan },
  patrol:    { label: 'PATROL',     colour: colours.amber },
  planning:  { label: 'PLANNING',   colour: colours.violet },
};

const PACKING_LIST = [
  'Ruck with fitted straps',
  'Water and electrolytes',
  'Foot care kit',
  'Weather layer',
  'Navigation backup (map/compass)',
  'Head torch',
  'Basic first aid (IFAK)',
];

// ── Flat list with category attached ────────────────────────────
const ALL_WITH_CAT = CATEGORIES.flatMap(cat =>
  cat.terms.map(t => ({ ...t, catId: cat.id }))
);

export function FieldGuideScreen() {
  const [query, setQuery]       = useState('');
  const [activeCat, setActiveCat] = useState('essential');
  const [expanded, setExpanded]  = useState<string | null>(null);

  const isSearching = query.trim().length > 0;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q) {
      return ALL_WITH_CAT.filter(t =>
        t.abbr.toLowerCase().includes(q) || t.meaning.toLowerCase().includes(q)
      );
    }
    return ALL_WITH_CAT.filter(t => t.catId === activeCat);
  }, [query, activeCat]);

  function toggleExpand(abbr: string) {
    setExpanded(prev => (prev === abbr ? null : abbr));
  }

  return (
    <Screen>
      {/* ── Header ───────────────────────────────────────────── */}
      <View>
        <Text style={styles.kicker}>FIELD GUIDE</Text>
        <Text style={styles.title}>Tactical fitness reference</Text>
      </View>

      {/* ── Search ───────────────────────────────────────────── */}
      <View style={styles.searchRow}>
        <Ionicons name="search-outline" size={16} color={colours.muted} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search RV, CASEVAC, SMEAC..."
          placeholderTextColor={colours.soft}
          style={styles.searchInput}
          returnKeyType="search"
          autoCorrect={false}
          autoCapitalize="none"
        />
        {query.length > 0 && (
          <Pressable onPress={() => setQuery('')} hitSlop={12}>
            <Ionicons name="close-circle" size={16} color={colours.muted} />
          </Pressable>
        )}
      </View>

      {/* ── Category filter ──────────────────────────────────── */}
      {!isSearching && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.catRow}
        >
          {CATEGORIES.map(cat => {
            const cfg = CAT_CONFIG[cat.id] ?? { label: cat.label.toUpperCase(), colour: colours.cyan };
            const active = activeCat === cat.id;
            return (
              <Pressable
                key={cat.id}
                style={[
                  styles.catChip,
                  active
                    ? { backgroundColor: cfg.colour, borderColor: cfg.colour }
                    : { borderColor: `${cfg.colour}40` },
                ]}
                onPress={() => { setActiveCat(cat.id); setExpanded(null); }}
              >
                <Text style={[styles.catChipText, { color: active ? colours.background : cfg.colour }]}>
                  {cfg.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      )}

      {/* ── Reference cards ──────────────────────────────────── */}
      {isSearching && filtered.length === 0 && (
        <View style={styles.emptyState}>
          <Ionicons name="search-outline" size={24} color={colours.muted} />
          <Text style={styles.emptyText}>No terms match "{query}"</Text>
        </View>
      )}

      {filtered.map(term => {
        const cfg   = CAT_CONFIG[term.catId] ?? { label: term.catId.toUpperCase(), colour: colours.cyan };
        const rich  = RICH[term.abbr];
        const open  = expanded === term.abbr;

        return (
          <Pressable
            key={`${term.abbr}-${term.catId}`}
            style={[styles.refCard, open && styles.refCardOpen]}
            onPress={() => rich && toggleExpand(term.abbr)}
            android_ripple={{ color: `${colours.cyan}18` }}
          >
            {/* Top row */}
            <View style={styles.refTop}>
              <View style={styles.refLeft}>
                <Text style={[styles.refAbbr, { color: colours.cyan }]}>{term.abbr}</Text>
                <Text style={styles.refMeaning}>{term.meaning}</Text>
              </View>
              <View style={styles.refRight}>
                <View style={[styles.catTag, { borderColor: `${cfg.colour}50`, backgroundColor: `${cfg.colour}10` }]}>
                  <Text style={[styles.catTagText, { color: cfg.colour }]}>{cfg.label}</Text>
                </View>
                {rich && (
                  <Ionicons
                    name={open ? 'chevron-up' : 'chevron-down'}
                    size={14}
                    color={colours.muted}
                    style={{ marginTop: 6 }}
                  />
                )}
              </View>
            </View>

            {/* Expanded detail */}
            {open && rich && (
              <View style={styles.richDetail}>
                <View style={styles.richDivider} />
                <Text style={styles.richDesc}>{rich.desc}</Text>
                {rich.example && (
                  <View style={styles.richExampleBox}>
                    <Text style={styles.richExampleLabel}>EXAMPLE</Text>
                    <Text style={styles.richExample}>{rich.example}</Text>
                  </View>
                )}
                {rich.related && (
                  <View style={styles.relatedRow}>
                    <Text style={styles.relatedLabel}>RELATED</Text>
                    {rich.related.map(r => (
                      <Pressable
                        key={r}
                        style={styles.relatedChip}
                        onPress={() => {
                          setQuery(r);
                          setExpanded(null);
                        }}
                      >
                        <Text style={styles.relatedChipText}>{r}</Text>
                      </Pressable>
                    ))}
                  </View>
                )}
              </View>
            )}
          </Pressable>
        );
      })}

      {/* ── Field tools ──────────────────────────────────────── */}
      {!isSearching && (
        <View style={styles.toolsSection}>
          <Text style={styles.toolsLabel}>RUCK PACKING LIST</Text>
          {PACKING_LIST.map(item => (
            <View key={item} style={styles.packRow}>
              <View style={styles.packDot} />
              <Text style={styles.packText}>{item}</Text>
            </View>
          ))}
        </View>
      )}

      {/* ── Safety ───────────────────────────────────────────── */}
      <View style={styles.safetyPanel}>
        <Ionicons name="shield-checkmark-outline" size={16} color={colours.green} />
        <Text style={styles.safetyText}>
          FORGE tools are for fitness, training navigation, safety check-ins and voluntary squad accountability only.
        </Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  // Header
  kicker: { ...typography.label, color: colours.cyan },
  title:  { color: colours.text, fontSize: 30, lineHeight: 34, fontWeight: '900', marginTop: 4 },

  // Search
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: touchTarget,
    borderWidth: 1,
    borderColor: colours.border,
    borderRadius: radius.sm,
    paddingHorizontal: 14,
    backgroundColor: colours.inputBg,
  },
  searchInput: {
    flex: 1,
    color: colours.text,
    fontSize: 14,
    fontWeight: '700',
  },

  // Category chips
  catRow: {
    gap: 8,
    paddingVertical: 2,
  },
  catChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  catChipText: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.4,
  },

  // Reference cards
  refCard: {
    backgroundColor: colours.panel,
    borderWidth: 1,
    borderColor: colours.border,
    borderRadius: radius.sm,
    padding: 14,
  },
  refCardOpen: {
    borderColor: colours.borderHot,
    backgroundColor: colours.panelHot,
  },
  refTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  refLeft: {
    flex: 1,
    gap: 3,
  },
  refAbbr: {
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: -0.5,
    lineHeight: 26,
  },
  refMeaning: {
    color: colours.textSoft,
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 18,
  },
  refRight: {
    alignItems: 'flex-end',
    gap: 4,
  },
  catTag: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  catTagText: {
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 1.2,
  },

  // Rich detail
  richDetail: {
    marginTop: 10,
    gap: 10,
  },
  richDivider: {
    height: 1,
    backgroundColor: colours.borderSoft,
  },
  richDesc: {
    color: colours.textSoft,
    fontSize: 13,
    lineHeight: 20,
    fontWeight: '600',
  },
  richExampleBox: {
    backgroundColor: colours.layer1,
    borderLeftWidth: 2,
    borderLeftColor: colours.cyan,
    borderRadius: radius.xs,
    padding: 10,
    gap: 4,
  },
  richExampleLabel: {
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 1.4,
    color: colours.muted,
    textTransform: 'uppercase',
  },
  richExample: {
    color: colours.text,
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 18,
    fontVariant: ['tabular-nums'],
  },
  relatedRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 6,
  },
  relatedLabel: {
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 1.4,
    color: colours.muted,
    textTransform: 'uppercase',
  },
  relatedChip: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colours.borderHot,
    backgroundColor: colours.cyanDim,
  },
  relatedChipText: {
    color: colours.cyan,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.8,
  },

  // Empty state
  emptyState: {
    alignItems: 'center',
    gap: 10,
    paddingVertical: 40,
  },
  emptyText: {
    color: colours.muted,
    fontSize: 13,
    fontWeight: '700',
  },

  // Field tools
  toolsSection: {
    backgroundColor: colours.panel,
    borderWidth: 1,
    borderColor: colours.border,
    borderRadius: radius.sm,
    padding: 14,
    gap: 2,
  },
  toolsLabel: {
    ...typography.label,
    color: colours.muted,
    marginBottom: 10,
  },
  packRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 36,
    borderTopWidth: 1,
    borderTopColor: colours.borderSoft,
  },
  packDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colours.cyan,
    opacity: 0.7,
  },
  packText: {
    flex: 1,
    color: colours.textSoft,
    fontSize: 13,
    fontWeight: '700',
  },

  // Safety
  safetyPanel: {
    borderWidth: 1,
    borderColor: `${colours.green}45`,
    borderRadius: radius.sm,
    backgroundColor: colours.greenDim,
    padding: 12,
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
  },
  safetyText: {
    flex: 1,
    color: colours.green,
    fontSize: 11,
    lineHeight: 17,
    fontWeight: '700',
  },
});
