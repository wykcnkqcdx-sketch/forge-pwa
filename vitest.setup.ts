import React from 'react';
import { vi } from 'vitest';

// ── React Native ──────────────────────────────────────────────────────────────
vi.mock('react-native', () => ({
  Alert: { alert: vi.fn() },
  Animated: {
    View: ({ children }: { children?: React.ReactNode }) => React.createElement('div', null, children),
    Value: class {
      _value: number;
      constructor(v: number) { this._value = v; }
      setValue(v: number) { this._value = v; }
      interpolate() { return this; }
    },
    timing: vi.fn(() => ({ start: vi.fn((cb?: (r: { finished: boolean }) => void) => cb?.({ finished: true })) })),
    parallel: vi.fn((anims: unknown[]) => ({ start: vi.fn((cb?: (r: { finished: boolean }) => void) => cb?.({ finished: true })) })),
    sequence: vi.fn((anims: unknown[]) => ({ start: vi.fn() })),
    loop: vi.fn(() => ({ start: vi.fn() })),
  },
  Platform: { OS: 'web' },
  StyleSheet: { create: (s: unknown) => s },
  PanResponder: { create: vi.fn(() => ({ panHandlers: {} })) },
  Pressable: 'Pressable',
  Text: 'Text',
  TextInput: 'TextInput',
  View: 'View',
}));

// ── AsyncStorage ──────────────────────────────────────────────────────────────
vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn().mockResolvedValue(null),
    setItem: vi.fn().mockResolvedValue(undefined),
    removeItem: vi.fn().mockResolvedValue(undefined),
    multiRemove: vi.fn().mockResolvedValue(undefined),
  },
}));

// ── Expo Haptics ──────────────────────────────────────────────────────────────
vi.mock('expo-haptics', () => ({
  impactAsync: vi.fn(),
  ImpactFeedbackStyle: { Light: 'Light' },
}));

// ── Expo Icons ────────────────────────────────────────────────────────────────
vi.mock('@expo/vector-icons', () => ({
  Ionicons: 'Ionicons',
}));

// ── Expo Sharing ──────────────────────────────────────────────────────────────
vi.mock('expo-sharing', () => ({
  isAvailableAsync: vi.fn().mockResolvedValue(false),
  shareAsync: vi.fn().mockResolvedValue(undefined),
}));

// ── react-native-view-shot ────────────────────────────────────────────────────
vi.mock('react-native-view-shot', () => ({
  captureRef: vi.fn().mockResolvedValue('file://mock.png'),
}));

// ── Expo File System ──────────────────────────────────────────────────────────
vi.mock('expo-file-system', () => ({
  documentDirectory: 'file://mock-documents/',
  cacheDirectory:    'file://mock-cache/',
  readAsStringAsync: vi.fn().mockResolvedValue(''),
  writeAsStringAsync: vi.fn().mockResolvedValue(undefined),
  deleteAsync: vi.fn().mockResolvedValue(undefined),
  getInfoAsync: vi.fn().mockResolvedValue({ exists: false }),
  makeDirectoryAsync: vi.fn().mockResolvedValue(undefined),
  copyAsync: vi.fn().mockResolvedValue(undefined),
  moveAsync: vi.fn().mockResolvedValue(undefined),
  downloadAsync: vi.fn().mockResolvedValue({ uri: 'file://mock.png', status: 200, headers: {}, md5: '' }),
  EncodingType: { UTF8: 'utf8', Base64: 'base64' },
}));

// ── Browser globals missing in happy-dom ─────────────────────────────────────
if (typeof window.confirm !== 'function') {
  window.confirm = vi.fn().mockReturnValue(false);
}
