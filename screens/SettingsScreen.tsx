import React, { useMemo, useState } from 'react';
import { Alert, Linking, Platform, Text, TextInput, View, StyleSheet, Pressable } from 'react-native';
import { Screen } from '../components/Screen';
import { Card } from '../components/Card';
import { MetricCard } from '../components/MetricCard';
import { ProgressBar } from '../components/ProgressBar';
import { InstructorScreen } from './InstructorScreen';
import { colours } from '../theme';

export function SettingsScreen(props: React.ComponentProps<typeof InstructorScreen>) {
  return (
    <Screen>
      <View style={styles.header}>
        <Text style={styles.title}>Settings</Text>
        <Text style={styles.subtitle}>App preferences &amp; advanced tools</Text>
      </View>
      <InstructorScreen {...props} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingTop: 24,
    paddingBottom: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: '900',
    color: colours.text,
  },
  subtitle: {
    fontSize: 14,
    color: colours.muted,
    marginTop: 8,
  },
});

