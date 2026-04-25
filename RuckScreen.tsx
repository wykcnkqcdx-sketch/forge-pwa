import React from 'react';
import { SafeAreaView, ScrollView, StyleSheet } from 'react-native';
import { colours } from '../theme';

export function Screen({ children }: { children: React.ReactNode }) {
  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colours.background,
  },
  content: {
    padding: 20,
    paddingBottom: 110,
  },
});
