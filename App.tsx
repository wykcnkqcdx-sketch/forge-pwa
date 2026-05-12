import 'react-native-gesture-handler';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import './lib/backgroundTasks'; // Register background tasks globally for headless execution
import React from 'react';
import { AppProviders } from './components/AppProviders';
import { AppRouter } from './components/AppRouter';

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AppProviders>
        <AppRouter />
      </AppProviders>
    </GestureHandlerRootView>
  );
}
