import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Card } from './Card';
import { colours, typography } from '../theme';
import { responsiveSpacing } from '../utils/styling';
import type { PersonalRecord } from '../data/domain';

type Props = {
  records?: PersonalRecord[];
};

export function PRRecordsCard({ records }: Props) {
  if (!records || records.length === 0) return null;

  return (
    <Card>
      <Text style={styles.cardTitle}>Personal Records</Text>
      <View style={styles.list}>
        {records.map((pr) => {
          const dateStr = new Date(pr.dateAchieved).toLocaleDateString(undefined, {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
          });
          return (
            <View key={pr.id} style={styles.prRow}>
              <View style={styles.prLeft}>
                <Text style={styles.exerciseName}>{pr.exerciseName}</Text>
                <Text style={styles.dateAchieved}>{dateStr}</Text>
              </View>
              <View style={styles.prRight}>
                <Text style={styles.prValue}>
                  {pr.value} <Text style={styles.prUnit}>{pr.unit}</Text>
                </Text>
              </View>
            </View>
          );
        })}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  cardTitle: {
    ...typography.h4,
    color: colours.text,
    marginBottom: responsiveSpacing('md'),
  },
  list: {
    gap: responsiveSpacing('sm'),
  },
  prRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: responsiveSpacing('sm'),
    borderBottomWidth: 1,
    borderColor: colours.borderSoft,
  },
  prLeft: {
    flex: 1,
  },
  exerciseName: {
    color: colours.cyan,
    fontSize: 15,
    fontWeight: '900',
  },
  dateAchieved: {
    ...typography.caption,
    color: colours.textSoft,
    marginTop: 2,
    fontWeight: '800',
  },
  prRight: {
    alignItems: 'flex-end',
  },
  prValue: {
    color: colours.text,
    fontSize: 20,
    fontWeight: '900',
  },
  prUnit: {
    color: colours.muted,
    fontSize: 14,
    fontWeight: '800',
  },
});
