import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colours } from '../theme';

type Props = { children: React.ReactNode };
type State = { hasError: boolean; message: string };

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false, message: '' };

  static getDerivedStateFromError(error: unknown): State {
    return {
      hasError: true,
      message: error instanceof Error ? error.message : 'An unexpected error occurred.',
    };
  }

  componentDidCatch(error: unknown, info: React.ErrorInfo) {
    console.error('ErrorBoundary caught', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.container}>
          <Text style={styles.title}>// ERROR</Text>
          <Text style={styles.message}>{this.state.message}</Text>
          <Pressable style={styles.button} onPress={() => this.setState({ hasError: false, message: '' })}>
            <Text style={styles.buttonText}>Retry</Text>
          </Pressable>
        </View>
      );
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colours.background,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  title: {
    color: colours.red,
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: 3,
    marginBottom: 12,
  },
  message: {
    color: colours.muted,
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 24,
  },
  button: {
    backgroundColor: colours.cyan,
    borderRadius: 14,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  buttonText: {
    color: colours.background,
    fontWeight: '900',
    fontSize: 15,
  },
});
