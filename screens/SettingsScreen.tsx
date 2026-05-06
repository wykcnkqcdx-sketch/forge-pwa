import React from 'react';
import { Text, View, StyleSheet } from 'react-native';
import { Screen } from '../components/Screen';
import { InstructorScreen } from './InstructorScreen';
import { colours } from '../theme';

export function SettingsScreen(props: React.ComponentProps<typeof InstructorScreen>) {
  return (
    <Screen>
      <View style={styles.header}>
        <Text style={styles.title}>Ops</Text>
        <Text style={styles.subtitle}>Privacy, backup, sync, and coach tools</Text>
      </View>
      <InstructorScreen {...props} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingTop: 8,
    paddingBottom: 14,
  },
  title: {
    fontSize: 28,
    fontWeight: '900',
    color: colours.text,
  },
  subtitle: {
    fontSize: 14,
    color: colours.muted,
    marginTop: 8,
  },
});
