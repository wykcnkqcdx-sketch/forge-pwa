import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Animated, PanResponder, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { HomeScreen } from './screens/HomeScreen';
import { AnalyticsScreen } from './screens/AnalyticsScreen';
import { RuckScreen } from './screens/RuckScreen';
import { TrainScreen } from './screens/TrainScreen';
import { InstructorScreen } from './screens/InstructorScreen';
import { initialSessions, TrainingSession } from './data/mockData';
import { colours, shadow } from './theme';

type Tab = 'home' | 'train' | 'ruck' | 'analytics' | 'instructor';

const tabs: Array<{ id: Tab; label: string; icon: keyof typeof Ionicons.glyphMap; iconActive: keyof typeof Ionicons.glyphMap }> = [
  { id: 'home',       label: 'Home',    icon: 'home-outline',      iconActive: 'home' },
  { id: 'train',      label: 'Train',   icon: 'barbell-outline',   iconActive: 'barbell' },
  { id: 'ruck',       label: 'Ruck',    icon: 'footsteps-outline', iconActive: 'footsteps' },
  { id: 'analytics',  label: 'Intel',   icon: 'analytics-outline', iconActive: 'analytics' },
  { id: 'instructor', label: 'Coach',   icon: 'people-outline',    iconActive: 'people' },
];

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('home');
  const [sessions, setSessions] = useState<TrainingSession[]>(initialSessions);
  const [savedPin, setSavedPin] = useState<string | null>(null);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [typedText, setTypedText] = useState('');
  const prevTabIndex = useRef(0);
  const slideAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const pulseAnim = useRef(new Animated.Value(0.3)).current;
  const inactivityTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const resetInactivityTimer = useCallback(() => {
    if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
    if (savedPin && isUnlocked) {
      inactivityTimer.current = setTimeout(() => {
        setIsUnlocked(false);
      }, 3 * 60 * 1000); // 3 minutes
    }
  }, [savedPin, isUnlocked]);

  useEffect(() => {
    if (isReady) return;
    let i = 0;
    const text = 'INITIALISING SYSTEMS...';
    const timer = setInterval(() => {
      i++;
      if (i >= text.length) {
        setTypedText(text);
        clearInterval(timer);
      } else {
        setTypedText(text.substring(0, i) + '_');
      }
    }, 40);
    return () => clearInterval(timer);
  }, [isReady]);

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0.3,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [pulseAnim]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const manifestHref = new URL('manifest.webmanifest', window.location.href).toString();
    const existingManifest = document.querySelector('link[rel="manifest"]');
    const manifestLink = existingManifest ?? document.createElement('link');
    manifestLink.setAttribute('rel', 'manifest');
    manifestLink.setAttribute('href', manifestHref);
    if (!existingManifest) document.head.appendChild(manifestLink);

    const themeMeta = document.querySelector('meta[name="theme-color"]') ?? document.createElement('meta');
    themeMeta.setAttribute('name', 'theme-color');
    themeMeta.setAttribute('content', colours.background);
    if (!themeMeta.parentElement) document.head.appendChild(themeMeta);

    const appleMeta = document.querySelector('meta[name="apple-mobile-web-app-capable"]') ?? document.createElement('meta');
    appleMeta.setAttribute('name', 'apple-mobile-web-app-capable');
    appleMeta.setAttribute('content', 'yes');
    if (!appleMeta.parentElement) document.head.appendChild(appleMeta);

    if ('serviceWorker' in navigator) {
      const serviceWorkerUrl = new URL('sw.js', window.location.href).toString();
      navigator.serviceWorker.register(serviceWorkerUrl).catch((error) => {
        console.warn('Service worker registration failed', error);
      });
    }
  }, []);

  useEffect(() => {
    resetInactivityTimer();
    return () => { if (inactivityTimer.current) clearTimeout(inactivityTimer.current); };
  }, [resetInactivityTimer]);

  useEffect(() => {
    const currentIndex = tabs.findIndex((t) => t.id === activeTab);
    const prevIndex = prevTabIndex.current;

    if (currentIndex !== prevIndex) {
      const direction = currentIndex > prevIndex ? 1 : -1;
      slideAnim.setValue(direction * 40);
      fadeAnim.setValue(0);

      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start();

      prevTabIndex.current = currentIndex;
    }
  }, [activeTab, slideAnim, fadeAnim]);

  useEffect(() => {
    async function loadData() {
      try {
        const storedSessions = await AsyncStorage.getItem('forge:sessions');
        if (storedSessions) setSessions(JSON.parse(storedSessions));
        
        const storedPin = await AsyncStorage.getItem('forge:pin');
        if (storedPin) setSavedPin(storedPin);
      } catch (error) {
        console.error('Failed to load local data', error);
      } finally {
        setIsReady(true);
      }
    }
    loadData();
  }, []);

  useEffect(() => {
    if (isReady) AsyncStorage.setItem('forge:sessions', JSON.stringify(sessions));
  }, [sessions, isReady]);

  useEffect(() => {
    if (isReady) {
      if (savedPin === null) AsyncStorage.removeItem('forge:pin');
      else AsyncStorage.setItem('forge:pin', savedPin);
    }
  }, [savedPin, isReady]);

  function executeDuressWipe() {
    setSessions([]);
    setSavedPin(null);
    setIsUnlocked(true);
    setPinInput('');
    AsyncStorage.multiRemove(['forge:sessions', 'forge:pin']);
    Alert.alert('OPSEC WIPE', 'All local data has been permanently destroyed.');
  }

  function handleSetPin() {
    if (savedPin) {
      Alert.alert('Remove PIN', 'A PIN is already set. Do you want to remove it?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Remove', style: 'destructive', onPress: () => { setSavedPin(null); setIsUnlocked(true); } },
      ]);
    } else {
      Alert.alert('Set PIN', 'For this demo, the PIN will be set to "1234".\n\nDURESS FEATURE: Enter "0000" on the lock screen to wipe all data.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Set to 1234', onPress: () => { setSavedPin('1234'); setIsUnlocked(false); } },
      ]);
    }
  }

  function handleManualWipe() {
    Alert.alert('OPSEC WIPE', 'Permanently delete all local data? This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'WIPE', style: 'destructive', onPress: executeDuressWipe },
    ]);
  }

  function switchTab(newTab: Tab) {
    if (activeTab !== newTab) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setActiveTab(newTab);
    }
  }

  function addSession(session: TrainingSession) {
    setSessions((current) => [session, ...current]);
  }

  const panResponder = useMemo(
    () =>
      PanResponder.create({
          onStartShouldSetPanResponderCapture: () => {
            resetInactivityTimer();
            return false; // Return false so we don't block child touch events
          },
        onMoveShouldSetPanResponderCapture: (_, gestureState) => {
            resetInactivityTimer();
          // Capture the touch if it's a clear horizontal swipe
          return Math.abs(gestureState.dx) > Math.abs(gestureState.dy) * 2 && Math.abs(gestureState.dx) > 30;
        },
        onPanResponderRelease: (_, gestureState) => {
          const { dx } = gestureState;
          if (Math.abs(dx) > 60) {
            const currentIndex = tabs.findIndex((t) => t.id === activeTab);
            if (dx < 0 && currentIndex < tabs.length - 1) {
              switchTab(tabs[currentIndex + 1].id); // Swipe Left -> Next Tab
            } else if (dx > 0 && currentIndex > 0) {
              switchTab(tabs[currentIndex - 1].id); // Swipe Right -> Previous Tab
            }
          }
        },
      }),
      [activeTab, resetInactivityTimer]
  );

  function renderScreen() {
    switch (activeTab) {
      case 'train':
        return <TrainScreen addSession={addSession} />;
      case 'ruck':
        return <RuckScreen addSession={addSession} />;
      case 'analytics':
        return <AnalyticsScreen sessions={sessions} />;
      case 'instructor':
        return <InstructorScreen onSetPin={handleSetPin} onWipe={handleManualWipe} />;
      default:
        return (
          <HomeScreen
            sessions={sessions}
            goToRuck={() => switchTab('ruck')}
            goToAnalytics={() => switchTab('analytics')}
          />
        );
    }
  }

  if (!isReady) {
    return (
      <View style={styles.lockScreen}>
        <View style={styles.lockContent}>
          <Animated.Text
            style={[
              styles.brand,
              {
                opacity: pulseAnim,
                transform: [
                  {
                    scale: pulseAnim.interpolate({ inputRange: [0.3, 1], outputRange: [0.95, 1.05] }),
                  },
                ],
              },
            ]}
          >
            // FORGE
          </Animated.Text>
          <Text style={[styles.lockSub, { marginTop: 12 }]}>{typedText || '_'}</Text>
        </View>
      </View>
    );
  }

  if (savedPin && !isUnlocked) {
    return (
      <View style={styles.lockScreen}>
        <View style={styles.lockContent}>
          <Text style={styles.brand}>// FORGE</Text>
          <Text style={styles.lockSub}>Enter PIN to access tactical dashboard.</Text>
          <View style={styles.pinWrapper}>
            <View style={styles.pinDisplay}>
              {[0, 1, 2, 3].map((i) => (
                <View key={i} style={[styles.pinBox, pinInput.length > i && styles.pinBoxFilled]}>
                  <Text style={styles.pinDot}>{pinInput.length > i ? '•' : ''}</Text>
                </View>
              ))}
            </View>
            <TextInput
              style={styles.hiddenInput}
              keyboardType="number-pad"
              maxLength={4}
              value={pinInput}
              onChangeText={(val) => {
                const numericVal = val.replace(/[^0-9]/g, '');
                setPinInput(numericVal);
                setPinError(false);
                if (numericVal.length === 4) {
                  if (numericVal === '0000') executeDuressWipe();
                  else if (numericVal === savedPin) { setIsUnlocked(true); setPinInput(''); }
                  else { setPinError(true); setTimeout(() => setPinInput(''), 300); }
                }
              }}
              autoFocus
            />
          </View>
          <Text style={styles.pinErrorText}>{pinError ? 'Incorrect PIN' : ' '}</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.app} {...panResponder.panHandlers}>
      <Animated.View style={[styles.screenContainer, { opacity: fadeAnim, transform: [{ translateX: slideAnim }] }]}>
        {renderScreen()}
      </Animated.View>

      {/* ── Tab Bar ─────────────────────────────────── */}
      <View style={[styles.tabBar, shadow.card]}>
        {/* Glass top highlight */}
        <View style={styles.tabBarHighlight} />

        {tabs.map((tab) => {
          const isActive = tab.id === activeTab;
          return (
            <Pressable
              key={tab.id}
              style={({ pressed }) => [styles.tabItem, pressed && styles.tabItemPressed]}
              onPress={() => switchTab(tab.id)}
              accessibilityRole="button"
              accessibilityLabel={tab.label}
              accessibilityState={{ selected: isActive }}
            >
              {isActive ? (
                /* Active pill */
                <View style={styles.activePill}>
                  <Ionicons name={tab.iconActive} size={18} color={colours.background} />
                  <Text style={styles.activePillLabel}>{tab.label}</Text>
                </View>
              ) : (
                /* Inactive icon + label */
                <View style={styles.inactiveItem}>
                  <Ionicons name={tab.icon} size={20} color={colours.muted} />
                  <Text style={styles.inactiveLabel}>{tab.label}</Text>
                </View>
              )}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  app: {
    flex: 1,
    backgroundColor: colours.background,
  },

  screenContainer: {
    flex: 1,
  },

  /* Tab bar shell */
  tabBar: {
    position: 'absolute',
    left: 14,
    right: 14,
    bottom: 20,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: colours.border,
    backgroundColor: 'rgba(4, 8, 15, 0.94)',
    overflow: 'hidden',
  },

  tabBarHighlight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: colours.borderGlass,
  },

  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
    borderRadius: 20,
  },

  tabItemPressed: {
    opacity: 0.70,
  },

  /* Active state — filled pill */
  activePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colours.cyan,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 7,
    ...shadow.cyan,
  },

  activePillLabel: {
    color: colours.background,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.4,
  },

  /* Inactive state */
  inactiveItem: {
    alignItems: 'center',
    gap: 3,
  },

  inactiveLabel: {
    color: colours.muted,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.2,
  },

  /* Lock Screen */
  lockScreen: { flex: 1, backgroundColor: colours.background, justifyContent: 'center', alignItems: 'center', padding: 20 },
  lockContent: { alignItems: 'center', width: '100%', maxWidth: 320 },
  brand: { color: colours.cyan, fontSize: 24, fontWeight: '900', letterSpacing: 4, marginBottom: 8 },
  lockSub: { color: colours.muted, fontSize: 14, textAlign: 'center', marginBottom: 32 },
  pinWrapper: { position: 'relative', width: 240, height: 64, marginBottom: 16 },
  pinDisplay: { flexDirection: 'row', justifyContent: 'space-between', height: '100%' },
  pinBox: {
    width: 50,
    height: 64,
    borderWidth: 2,
    borderColor: colours.border,
    borderRadius: 12,
    backgroundColor: 'rgba(2, 5, 8, 0.58)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pinBoxFilled: { borderColor: colours.cyan },
  pinDot: { color: colours.cyan, fontSize: 32 },
  hiddenInput: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: 0 },
  pinErrorText: { color: colours.red, fontSize: 12, fontWeight: '700', minHeight: 16 },
});
