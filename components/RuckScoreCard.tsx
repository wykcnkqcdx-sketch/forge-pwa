import React from 'react';
import { StyleSheet, Text } from 'react-native';
import { Card } from './Card';
import { colours, typography } from '../theme';

export function RuckScoreCard({ score }: { score: number }) {
  return (
    <Card style={styles.scoreCard}>
      <Text style={styles.muted}>Projected session score</Text>
      <Text style={styles.score}>{score}</Text>
      <Text style={styles.muted}>
        Higher distance and heavier load increase training stress. This is a planning estimate, not medical advice.
      </Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  scoreCard: { backgroundColor: 'rgba(103,232,249,0.08)' },
  muted: { ...typography.caption, color: colours.muted },
  score: { color: colours.cyan, fontSize: 52, fontWeight: '900', marginVertical: 4 },
});
