import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, Alert, Modal, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '../components/Screen';
import { Card } from '../components/Card';
import { MetricCard } from '../components/MetricCard';
import { ProgressBar } from '../components/ProgressBar';

import { TrainingSession, TrackPoint } from '../data/mockData';
import { getMapPoints } from '../utils/mapUtils';

export function HomeScreen({
  sessions,
  goToRuck,
  goToAnalytics,
  deleteSession,
  editSession,
}: {
  sessions: TrainingSession[];
  goToRuck: () => void;
  goToAnalytics: () => void;
  deleteSession: (id: string) => void;
  editSession: (id: string, updates: Partial<TrainingSession>) => void;
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

  const [editingSession, setEditingSession] = useState<TrainingSession | null>(null);
  const [editScore, setEditScore] = useState('');
  const [editDuration, setEditDuration] = useState('');

  function confirmDelete(id: string) {
    Alert.alert(
      'Delete Session',
      'Are you sure you want to permanently delete this logged session?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => deleteSession(id) },
      ]
    );
  }

  function openEdit(session: TrainingSession) {
    setEditingSession(session);
    setEditScore(String(session.score));
    setEditDuration(String(session.durationMinutes));
  }

  function saveEdit() {
    if (!editingSession) return;
    const newScore = parseInt(editScore, 10);
    const newDuration = parseInt(editDuration, 10);

    if (isNaN(newScore) || isNaN(newDuration)) {
      Alert.alert('Invalid Input', 'Score and duration must be numbers.');
      return;
    }

    editSession(editingSession.id, { score: newScore, durationMinutes: newDuration });
    setEditingSession(null);
  }

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

      {/* AI Insights Card */}
      <Card style={{ backgroundColor: `${colours.cyan}10`, borderColor: `${colours.cyan}30`, borderWidth: 1 }}>
        <Text style={[styles.cardTitle, { color: colours.cyan }]}>AI Insights</Text>
        <Text style={{ color: colours.text, fontSize: 14, lineHeight: 21 }}>
          {readiness >= 80 ? 'Your readiness is high. It is a great day to push your limits on the assigned training.' : readiness >= 60 ? 'Your readiness is moderate. Proceed with the assigned workout but monitor your RPE.' : 'Your readiness is low. Consider swapping the assigned workout for a mobility or recovery session.'}
        </Text>
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
          <View key={session.id} style={[styles.sessionCard, shadow.subtle]}>
            <View style={styles.sessionRow}>
              <View style={[styles.sessionIconWrap, { backgroundColor: colours.cyanDim, borderColor: colours.border }]}>
                <Ionicons 
                  name={session.type === 'Ruck' ? 'footsteps-outline' : 'barbell-outline'} 
                  size={18} 
                  color={colours.cyan} 
                />
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
              <View style={styles.actions}>
                <Pressable onPress={() => openEdit(session)} style={styles.actionBtn}>
                  <Ionicons name="pencil" size={18} color={colours.cyan} />
                </Pressable>
                <Pressable onPress={() => confirmDelete(session.id)} style={styles.actionBtn}>
                  <Ionicons name="trash-outline" size={18} color={colours.red} />
                </Pressable>
              </View>
            </View>
            
            {session.routePoints && session.routePoints.length > 0 && (
              <View style={styles.miniMapStage}>
                {getMapPoints(session.routePoints).map((point: TrackPoint & { x: number; y: number }, index: number) => (
                  <View
                    key={index}
                    style={[styles.trailDot, { left: `${point.x}%`, top: `${point.y}%` }]}
                  />
                ))}
              </View>
            )}
          </View>
        ))
      ) : (
        <View style={[styles.emptyState, shadow.subtle]}>
          <Ionicons name="document-text-outline" size={22} color={colours.cyan} />
          <Text style={styles.emptyTitle}>No sessions yet</Text>
          <Text style={styles.emptyText}>Start a ruck or complete the strength block to populate your log.</Text>
        </View>
      )}

    {/* Edit Modal */}
    <Modal visible={!!editingSession} transparent animationType="fade">
      <View style={styles.modalOverlay}>
        <View style={[styles.modalPanel, shadow.card]}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Edit Session</Text>
            <Pressable onPress={() => setEditingSession(null)} style={styles.closeBtn}>
              <Ionicons name="close" size={20} color={colours.text} />
            </Pressable>
          </View>
          <Text style={styles.inputLabel}>SCORE</Text>
          <TextInput
            style={styles.input}
            keyboardType="number-pad"
            value={editScore}
            onChangeText={setEditScore}
          />
          <Text style={styles.inputLabel}>DURATION (MINS)</Text>
          <TextInput
            style={styles.input}
            keyboardType="number-pad"
            value={editDuration}
            onChangeText={setEditDuration}
          />
          <Pressable style={styles.saveBtn} onPress={saveEdit}>
            <Text style={styles.saveBtnText}>Save Changes</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
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

  /* Session Cards */
  sessionCard: {
    borderWidth: 1,
    borderColor: colours.borderSoft,
    borderRadius: 16,
    backgroundColor: 'rgba(10, 20, 35, 0.70)',
    marginBottom: 10,
    overflow: 'hidden',
  },
  sessionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
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
  actions: {
    flexDirection: 'row',
    marginLeft: 4,
  },
  actionBtn: {
    marginLeft: 2,
    padding: 6,
    justifyContent: 'center',
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
  miniMapStage: {
    height: 80,
    backgroundColor: 'rgba(4,8,15,0.4)',
    borderTopWidth: 1,
    borderColor: colours.borderSoft,
    position: 'relative',
  },
  trailDot: {
    position: 'absolute',
    width: 4,
    height: 4,
    borderRadius: 2,
    marginLeft: -2,
    marginTop: -2,
    backgroundColor: colours.cyan,
    opacity: 0.8,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    padding: 20,
    backgroundColor: 'rgba(0,0,0,0.62)',
  },
  modalPanel: {
    borderWidth: 1,
    borderColor: colours.border,
    borderRadius: 20,
    padding: 18,
    backgroundColor: colours.surface,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  modalTitle: {
    color: colours.text,
    fontSize: 20,
    fontWeight: '900',
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.07)',
  },
  inputLabel: {
    color: colours.muted,
    fontSize: 10,
    fontWeight: '900',
    marginBottom: 6,
    letterSpacing: 1.2,
  },
  input: {
    borderWidth: 1,
    borderColor: colours.borderSoft,
    borderRadius: 14,
    color: colours.text,
    backgroundColor: 'rgba(255,255,255,0.05)',
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 16,
    fontSize: 16,
    fontWeight: '800',
  },
  saveBtn: {
    alignItems: 'center',
    backgroundColor: colours.cyan,
    borderRadius: 16,
    paddingVertical: 13,
    marginTop: 4,
  },
  saveBtnText: {
    color: colours.background,
    fontSize: 15,
    fontWeight: '900',
  },
});
