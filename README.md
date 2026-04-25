import React from 'react';
import { Text, View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '../components/Screen';
import { Card } from '../components/Card';
import { MetricCard } from '../components/MetricCard';
import { colours } from '../theme';

export function ProfileScreen() {
  return (
    <Screen>
      <Text style={styles.muted}>User profile</Text>
      <Text style={styles.title}>Profile</Text>

      <Card>
        <View style={styles.profileRow}>
          <View style={styles.avatar}>
            <Ionicons name="person" size={42} color={colours.cyan} />
          </View>
          <View>
            <Text style={styles.name}>Leo Wemyss</Text>
            <Text style={styles.muted}>Tactical fitness · Intermediate</Text>
            <Text style={styles.link}>Goal: Ruck performance</Text>
          </View>
        </View>
      </Card>

      <View style={styles.grid}>
        <MetricCard icon="barbell" label="Weight" value="82kg" sub="current" />
        <MetricCard icon="pulse" label="VO₂ Max" value="37.9" sub="baseline" tone={colours.violet} />
      </View>

      <Card>
        <Text style={styles.cardTitle}>Connected Devices</Text>
        {['Apple Health', 'Garmin', 'WHOOP', 'Google Fit'].map((device, index) => (
          <View key={device} style={styles.deviceRow}>
            <Text style={styles.device}>{device}</Text>
            <Text style={index === 0 ? styles.connected : styles.notConnected}>
              {index === 0 ? 'Connected' : 'Not connected'}
            </Text>
          </View>
        ))}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  muted: { color: colours.muted, fontSize: 13 },
  title: { color: colours.text, fontSize: 32, fontWeight: '900', marginBottom: 16 },
  profileRow: { flexDirection: 'row', gap: 16, alignItems: 'center' },
  avatar: {
    height: 78,
    width: 78,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(103,232,249,0.10)',
    borderColor: 'rgba(103,232,249,0.25)',
    borderWidth: 1,
  },
  name: { color: colours.text, fontSize: 21, fontWeight: '900' },
  link: { color: colours.cyan, marginTop: 4 },
  grid: { flexDirection: 'row', gap: 12 },
  cardTitle: { color: colours.text, fontSize: 19, fontWeight: '900', marginBottom: 12 },
  deviceRow: {
    borderColor: colours.border,
    borderWidth: 1,
    borderRadius: 18,
    padding: 14,
    marginBottom: 10,
    backgroundColor: 'rgba(0,0,0,0.18)',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  device: { color: colours.text, fontWeight: '800' },
  connected: { color: colours.cyan, fontSize: 12 },
  notConnected: { color: colours.muted, fontSize: 12 },
});
