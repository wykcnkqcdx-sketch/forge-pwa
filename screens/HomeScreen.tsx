import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '../components/Screen';
import { Card } from '../components/Card';
import { MetricCard } from '../components/MetricCard';
import { ProgressBar } from '../components/ProgressBar';
import { colours, shadow } from '../theme';
import { TrainingSession } from '../data/mockData';

export function HomeScreen({
  sessions,
  goToRuck,
  goToAnalytics,
}: {
  sessions: TrainingSession[];
  goToRuck: () => void;
  goToAnalytics: () => void;
}) {
  const recentSessions = sessions.slice(0, 3);
  const weeklyLoad = sessions.slice(0, 7).reduce((total, session) => total + session.durationMinutes * session.rpe, 0);
  const averageRecentRpe = recentSessions.length
    ? recentSessions.reduce((total, session) => total + session.rpe, 0) / recentSessions.length
    : 0;
  const recoveryLabel = averageRecentRpe >= 7.5 ? 'Caution' : averageRecentRpe >= 6 ? 'Steady' : 'Good';
  const recoverySub = recentSessions.length ? `Avg RPE ${averageRecentRpe.toFixed(1)}` : 'No recent load';
  const readiness = recentSessions.length
    ? Math.max(45, Math.min(96, Math.round(92 - averageRecentRpe * 3 + Math.min(8, recentSessions.length * 2))))
    : 72;
  const statusColour = readiness >= 80 ? colours.green : readiness >= 60 ? colours.amber : colours.red;
  const statusLabel  = readiness >= 80 ? 'GREEN — Train as planned' : readiness >= 60 ? 'AMBER — Monitor load' : 'RED — Rest advised';

  return (
    <Screen>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.callsign}>// FORGE</Text>
          <Text style={styles.pageTitle}>Today's Mission</Text>
        </View>
        <View style={[styles.statusBadge, { borderColor: `${statusColour}55`, backgroundColor: `${statusColour}12` }]}>
          <View style={[styles.statusDot, { backgroundColor: statusColour }]} />
          <Text style={[styles.statusText, { color: statusColour }]}>
            {readiness >= 80 ? 'GREEN' : readiness >= 60 ? 'AMBER' : 'RED'}
          </Text>
        </View>
      </View>

      {/* Readiness card */}
      <Card hot>
        <View style={styles.readinessRow}>
          <View style={styles.readinessCopy}>
            <Text style={styles.metaLabel}>READINESS SCORE</Text>
            <Text style={[styles.bigNumber, { color: statusColour }]}>{readiness}</Text>
            <Text style={[styles.statusLine, { color: statusColour }]}>{statusLabel}</Text>
          </View>
          <View style={[styles.circle, { borderColor: `${statusColour}35`, backgroundColor: `${statusColour}10` }]}>
            <Ionicons name="speedometer" size={40} color={statusColour} />
          </View>
        </View>
        <ProgressBar value={readiness} colour={statusColour} />
      </Card>

      {/* Today's workout card */}
      <Card accent={colours.amber}>
        <Text style={styles.eyebrow}>ASSIGNED</Text>
        <Text style={styles.cardTitle}>Ruck Intervals</Text>
        <Text style={styles.cardMeta}>45 min · 18 kg · Mixed terrain</Text>
        <View style={styles.workoutTags}>
          <View style={[styles.tag, { borderColor: `${colours.amber}40`, backgroundColor: colours.amberDim }]}>
            <Text style={[styles.tagText, { color: colours.amber }]}>RUCK</Text>
          </View>
          <View style={[styles.tag, { borderColor: `${colours.cyan}40`, backgroundColor: colours.cyanDim }]}>
            <Text style={[styles.tagText, { color: colours.cyan }]}>LOADED</Text>
          </View>
          <View style={[styles.tag, { borderColor: `${colours.red}40`, backgroundColor: colours.redDim }]}>
            <Text style={[styles.tagText, { color: colours.red }]}>RPE 7</Text>
          </View>
        </View>
        <Pressable style={({ pressed }) => [styles.primaryButton, pressed && { opacity: 0.80 }]} onPress={goToRuck}>
          <Ionicons name="play-circle" size={18} color={colours.background} />
          <Text style={styles.primaryButtonText}>Start Session</Text>
        </Pressable>
      </Card>

      {/* Metrics grid */}
      <View style={styles.grid}>
        <MetricCard icon="pulse"  label="Weekly Load" value={`${weeklyLoad}`} sub="duration x RPE" tone={colours.cyan} />
        <MetricCard icon="flame"  label="Recovery"    value={recoveryLabel} sub={recoverySub} tone={averageRecentRpe >= 7.5 ? colours.amber : colours.green} />
      </View>

      {/* Recent sessions */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Recent Sessions</Text>
        <Pressable onPress={goToAnalytics} style={styles.viewAllBtn}>
          <Text style={styles.viewAllText}>View all</Text>
          <Ionicons name="chevron-forward" size={13} color={colours.cyan} />
        </Pressable>
      </View>

      {recentSessions.length > 0 ? (
        recentSessions.map((session) => (
          <View key={session.id} style={[styles.sessionRow, shadow.subtle]}>
            <View style={[styles.sessionIconWrap, { backgroundColor: colours.cyanDim, borderColor: colours.border }]}>
              <Ionicons name="barbell-outline" size={18} color={colours.cyan} />
            </View>
            <View style={styles.sessionCopy}>
              <Text style={styles.sessionTitle}>{session.title}</Text>
              <Text style={styles.sessionMeta}>
                {session.type} · {session.durationMinutes} min · RPE {session.rpe}
              </Text>
            </View>
            <View style={styles.sessionRight}>
              <Text style={styles.score}>{session.score}</Text>
              <Text style={styles.scoreLabel}>SCORE</Text>
            </View>
          </View>
        ))
      ) : (
        <View style={[styles.emptyState, shadow.subtle]}>
          <Ionicons name="document-text-outline" size={22} color={colours.cyan} />
          <Text style={styles.emptyTitle}>No sessions yet</Text>
          <Text style={styles.emptyText}>Start a ruck or complete the strength block to populate your log.</Text>
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  callsign: {
    color: colours.muted,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 2.5,
    marginBottom: 3,
  },
  pageTitle: {
    color: colours.text,
    fontSize: 30,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginTop: 4,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.2,
  },

  /* Readiness */
  readinessRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 16,
  },
  readinessCopy: { flex: 1 },
  metaLabel: {
    color: colours.muted,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.5,
    marginBottom: 4,
  },
  bigNumber: {
    fontSize: 64,
    fontWeight: '900',
    lineHeight: 68,
  },
  statusLine: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.4,
    marginTop: 2,
  },
  circle: {
    width: 90,
    height: 90,
    borderRadius: 45,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* Today's workout */
  eyebrow: {
    color: colours.amber,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 2.5,
    marginBottom: 5,
  },
  cardTitle: {
    color: colours.text,
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: -0.3,
  },
  cardMeta: {
    color: colours.muted,
    fontSize: 13,
    marginTop: 3,
    marginBottom: 10,
  },
  workoutTags: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 14,
  },
  tag: {
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  tagText: {
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colours.cyan,
    borderRadius: 16,
    paddingVertical: 13,
    shadowColor: colours.cyan,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 14,
    elevation: 8,
  },
  primaryButtonText: {
    color: colours.background,
    fontWeight: '900',
    fontSize: 15,
    letterSpacing: 0.3,
  },

  /* Metrics */
  grid: { flexDirection: 'row', gap: 12 },

  /* Section header */
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  sectionTitle: {
    color: colours.text,
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 0.2,
  },
  viewAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  viewAllText: {
    color: colours.cyan,
    fontSize: 12,
    fontWeight: '700',
  },

  /* Session rows */
  sessionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: colours.borderSoft,
    borderRadius: 16,
    padding: 12,
    backgroundColor: 'rgba(10, 20, 35, 0.70)',
  },
  sessionIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  sessionCopy: { flex: 1 },
  sessionTitle: {
    color: colours.text,
    fontWeight: '800',
    fontSize: 13,
  },
  sessionMeta: {
    color: colours.muted,
    fontSize: 11,
    marginTop: 2,
  },
  sessionRight: { alignItems: 'flex-end' },
  score: {
    color: colours.cyan,
    fontSize: 20,
    fontWeight: '900',
  },
  scoreLabel: {
    color: colours.soft,
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 1.5,
    marginTop: 1,
  },
  emptyState: {
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: colours.borderSoft,
    borderRadius: 16,
    padding: 18,
    backgroundColor: 'rgba(10, 20, 35, 0.70)',
  },
  emptyTitle: {
    color: colours.text,
    fontSize: 14,
    fontWeight: '900',
  },
  emptyText: {
    color: colours.muted,
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 17,
  },
});
