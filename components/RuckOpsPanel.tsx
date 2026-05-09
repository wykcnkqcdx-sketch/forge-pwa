import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colours, typography } from '../theme';
import { distanceBetween, bearingBetween } from '../utils/mapUtils';
import { formatHeading, cardinalDirection } from '../utils/ruck';
import { CATEGORIES, ALL_ABBREVS } from '../data/militaryAbbreviations';
import type { Teammate } from '../lib/teamPresence';
import type { TrackPoint } from '../data/mockData';

type Props = {
  teammates: Teammate[];
  connected: boolean;
  teamEnabled: boolean;
  dismissedCallsigns: string[];
  currentPoint: TrackPoint | null;
  onFocusTeammate: (teammate: Teammate) => void;
  onDismissTeammate: (callsign: string) => void;
  onToggleTeam: () => void;
};

export function RuckOpsPanel({
  teammates,
  connected,
  teamEnabled,
  dismissedCallsigns,
  currentPoint,
  onFocusTeammate,
  onDismissTeammate,
  onToggleTeam,
}: Props) {
  const [query, setQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('essential');

  const visibleTeammates = teammates.filter((t) => !dismissedCallsigns.includes(t.callsign));

  const filteredTerms = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return null;
    return ALL_ABBREVS.filter(
      (t) => t.abbr.toLowerCase().includes(q) || t.meaning.toLowerCase().includes(q)
    );
  }, [query]);

  const displayTerms = filteredTerms ?? CATEGORIES.find((c) => c.id === activeCategory)?.terms ?? [];

  function relativeInfo(teammate: Teammate) {
    if (!currentPoint) return null;
    const from = { latitude: currentPoint.latitude, longitude: currentPoint.longitude, altitude: null, accuracy: null, timestamp: 0 };
    const to = { latitude: teammate.lat, longitude: teammate.lon, altitude: null, accuracy: null, timestamp: 0 };
    const distKm = distanceBetween(from, to);
    const brg = bearingBetween(from, to);
    return { distKm, brg };
  }

  function timeSince(ms: number) {
    const s = Math.floor((Date.now() - ms) / 1000);
    if (s < 60) return `${s}s ago`;
    if (s < 3600) return `${Math.floor(s / 60)}m ago`;
    return `${Math.floor(s / 3600)}h ago`;
  }

  return (
    <View style={styles.root}>
      {/* ── TEAM PRESENCE ─────────────────────────────── */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <View style={styles.sectionHeaderLeft}>
            <View style={[styles.connDot, { backgroundColor: connected && teamEnabled ? colours.green : colours.muted }]} />
            <Text style={styles.sectionLabel}>TEAM PRESENCE</Text>
          </View>
          <View style={styles.sectionHeaderRight}>
            {visibleTeammates.length > 0 && (
              <View style={styles.countBadge}>
                <Text style={styles.countText}>{visibleTeammates.length} ONLINE</Text>
              </View>
            )}
            <Pressable style={[styles.toggleBtn, teamEnabled && styles.toggleBtnActive]} onPress={onToggleTeam}>
              <Text style={[styles.toggleBtnText, teamEnabled && styles.toggleBtnTextActive]}>
                {teamEnabled ? 'ACTIVE' : 'ENABLE'}
              </Text>
            </Pressable>
          </View>
        </View>

        {!teamEnabled ? (
          <View style={styles.emptyState}>
            <Ionicons name="radio-outline" size={28} color={colours.muted} />
            <Text style={styles.emptyText}>Team PLI disabled</Text>
            <Text style={styles.emptySubText}>Enable to share position with teammates</Text>
          </View>
        ) : visibleTeammates.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="people-outline" size={28} color={colours.muted} />
            <Text style={styles.emptyText}>No teammates online</Text>
            <Text style={styles.emptySubText}>Waiting for team presence…</Text>
          </View>
        ) : (
          <View style={styles.teammateList}>
            {visibleTeammates.map((teammate) => {
              const rel = relativeInfo(teammate);
              const hasEmergency = teammate.emergency?.active;
              return (
                <View
                  key={teammate.callsign}
                  style={[styles.teammateRow, hasEmergency && styles.teammateRowEmergency]}
                >
                  <View style={[styles.teammateColor, { backgroundColor: teammate.color }]} />
                  <View style={styles.teammateInfo}>
                    <View style={styles.teammateTopRow}>
                      <Text style={styles.teammateCallsign}>{teammate.callsign}</Text>
                      {hasEmergency && (
                        <View style={styles.emergencyChip}>
                          <Ionicons name="alert-circle" size={10} color={colours.red} />
                          <Text style={styles.emergencyChipText}>EMERGENCY</Text>
                        </View>
                      )}
                    </View>
                    <View style={styles.teammateMeta}>
                      <Text style={styles.teammateMetaText}>{timeSince(teammate.updatedAt)}</Text>
                      {rel && (
                        <>
                          <Text style={styles.teammateDivider}>·</Text>
                          <Text style={styles.teammateMetaText}>
                            {rel.distKm < 1
                              ? `${Math.round(rel.distKm * 1000)}m`
                              : `${rel.distKm.toFixed(1)}km`}
                          </Text>
                          <Text style={styles.teammateDivider}>·</Text>
                          <Text style={styles.teammateMetaText}>
                            {formatHeading(rel.brg)} {cardinalDirection(rel.brg)}
                          </Text>
                        </>
                      )}
                    </View>
                  </View>
                  <View style={styles.teammateActions}>
                    <Pressable style={styles.actionBtn} onPress={() => onFocusTeammate(teammate)}>
                      <Ionicons name="locate-outline" size={14} color={colours.cyan} />
                    </Pressable>
                    <Pressable style={styles.actionBtn} onPress={() => onDismissTeammate(teammate.callsign)}>
                      <Ionicons name="close" size={14} color={colours.muted} />
                    </Pressable>
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </View>

      {/* ── ORDERS REFERENCE ──────────────────────────── */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <View style={styles.sectionHeaderLeft}>
            <Ionicons name="book-outline" size={12} color={colours.muted} />
            <Text style={styles.sectionLabel}>ORDERS REFERENCE</Text>
          </View>
        </View>

        <View style={styles.searchRow}>
          <Ionicons name="search-outline" size={14} color={colours.muted} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            value={query}
            onChangeText={setQuery}
            placeholder="Search abbreviations…"
            placeholderTextColor={colours.muted}
            autoCapitalize="characters"
            returnKeyType="search"
          />
          {query.length > 0 && (
            <Pressable onPress={() => setQuery('')} style={styles.searchClear}>
              <Ionicons name="close-circle" size={14} color={colours.muted} />
            </Pressable>
          )}
        </View>

        {!filteredTerms && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryScroll}>
            <View style={styles.categoryRow}>
              {CATEGORIES.map((cat) => (
                <Pressable
                  key={cat.id}
                  style={[styles.catChip, activeCategory === cat.id && styles.catChipActive]}
                  onPress={() => setActiveCategory(cat.id)}
                >
                  <Text style={[styles.catChipText, activeCategory === cat.id && styles.catChipTextActive]}>
                    {cat.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </ScrollView>
        )}

        <View style={styles.termList}>
          {filteredTerms && filteredTerms.length === 0 ? (
            <Text style={styles.noResultsText}>No matches for "{query}"</Text>
          ) : (
            displayTerms.map((term) => (
              <View key={term.abbr} style={styles.termRow}>
                <Text style={styles.termAbbr}>{term.abbr}</Text>
                <Text style={styles.termMeaning}>{term.meaning}</Text>
              </View>
            ))
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 12 },
  section: {
    backgroundColor: 'rgba(10,20,35,0.72)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    overflow: 'hidden',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  sectionHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  sectionHeaderRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionLabel: { ...typography.label, color: colours.muted, letterSpacing: 1.4 },
  connDot: { width: 6, height: 6, borderRadius: 3 },
  countBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: 'rgba(167,201,87,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(167,201,87,0.22)',
  },
  countText: { ...typography.label, color: colours.green, letterSpacing: 1 },
  toggleBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
  },
  toggleBtnActive: {
    backgroundColor: 'rgba(103,232,249,0.10)',
    borderColor: 'rgba(103,232,249,0.25)',
  },
  toggleBtnText: { ...typography.label, color: colours.muted, letterSpacing: 1 },
  toggleBtnTextActive: { color: colours.cyan },
  emptyState: { alignItems: 'center', paddingVertical: 24, gap: 6 },
  emptyText: { color: colours.textSoft, fontWeight: '700', fontSize: 13 },
  emptySubText: { ...typography.caption, color: colours.muted },
  teammateList: { paddingVertical: 4 },
  teammateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  teammateRowEmergency: { backgroundColor: 'rgba(224,95,79,0.07)' },
  teammateColor: { width: 4, height: 36, borderRadius: 2 },
  teammateInfo: { flex: 1, gap: 3 },
  teammateTopRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  teammateCallsign: { color: colours.text, fontWeight: '900', fontSize: 13, letterSpacing: 0.6 },
  emergencyChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: 'rgba(224,95,79,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(224,95,79,0.30)',
  },
  emergencyChipText: { ...typography.label, color: colours.red, letterSpacing: 0.8 },
  teammateMeta: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  teammateMetaText: { ...typography.caption, color: colours.muted },
  teammateDivider: { color: colours.muted, opacity: 0.4, fontSize: 9 },
  teammateActions: { flexDirection: 'row', gap: 6 },
  actionBtn: {
    width: 30,
    height: 30,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  searchIcon: { marginRight: 6 },
  searchInput: {
    flex: 1,
    color: colours.text,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  searchClear: { padding: 2 },
  categoryScroll: { marginHorizontal: 10, marginBottom: 4 },
  categoryRow: { flexDirection: 'row', gap: 6, paddingVertical: 4 },
  catChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  catChipActive: {
    backgroundColor: 'rgba(103,232,249,0.12)',
    borderColor: 'rgba(103,232,249,0.28)',
  },
  catChipText: { ...typography.label, color: colours.muted, letterSpacing: 0.6 },
  catChipTextActive: { color: colours.cyan },
  termList: { paddingHorizontal: 14, paddingBottom: 10 },
  termRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingVertical: 7,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  termAbbr: {
    width: 72,
    color: colours.cyan,
    fontWeight: '900',
    fontSize: 11,
    letterSpacing: 0.6,
    paddingTop: 1,
  },
  termMeaning: { flex: 1, color: colours.textSoft, fontSize: 12, fontWeight: '600', lineHeight: 17 },
  noResultsText: { color: colours.muted, fontSize: 12, textAlign: 'center', paddingVertical: 16 },
});
