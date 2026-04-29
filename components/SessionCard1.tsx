import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colours, shadow } from '../theme';
import { TrainingSession, TrackPoint } from '../types';
import { getMapPoints } from '../utils/mapUtils';

export type SessionCardProps = {
  session: TrainingSession;
  onEdit: (session: TrainingSession) => void;
  onDelete: (id: string) => void;
};

export const SessionCard = React.memo(function SessionCard({ session, onEdit, onDelete }: SessionCardProps) {
  const mapPoints = getMapPoints(session.routePoints);

  return (
    <View style={[styles.sessionCard, shadow.subtle]}>
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
          <Pressable onPress={() => onEdit(session)} style={styles.actionBtn}>
            <Ionicons name="pencil" size={18} color={colours.cyan} />
          </Pressable>
          <Pressable onPress={() => onDelete(session.id)} style={styles.actionBtn}>
            <Ionicons name="trash-outline" size={18} color={colours.red} />
          </Pressable>
        </View>
      </View>

      {mapPoints.length > 0 && (
        <View style={styles.miniMapStage}>
          {mapPoints.map((point, index) => (
            <View
              key={index}
              style={[
                styles.trailDot,
                {
                  left: `${point.x}%`,
                  top: `${point.y}%`,
                },
              ]}
            />
          ))}
        </View>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
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
});

