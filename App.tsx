import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, PanResponder, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { HomeScreen } from './screens/HomeScreen';
import { AnalyticsScreen } from './screens/AnalyticsScreen';
import { RuckScreen } from './screens/RuckScreen';
import { TrainScreen } from './screens/TrainScreen';
import { FuelScreen } from './screens/FuelScreen';
import { InstructorScreen } from './screens/InstructorScreen';
import { AuthScreen } from './screens/AuthScreen';
import { isSupabaseConfigured } from './lib/supabase';
import { colours, shadow } from './theme';
import { ErrorBoundary } from './components/ErrorBoundary';
import { useDataStore } from './hooks/useDataStore';
import { usePinLock } from './hooks/usePinLock';
import { useCloudSync } from './hooks/useCloudSync';
import { isWeb } from './lib/platform';

type Tab = 'home' | 'train' | 'ruck' | 'fuel' | 'analytics' | 'instructor';

const tabs: Array<{ id: Tab; label: string; icon: keyof typeof Ionicons.glyphMap; iconActive: keyof typeof Ionicons.glyphMap }> = [
  { id: 'home',       label: 'Home',  icon: 'home-outline',       iconActive: 'home' },
  { id: 'train',      label: 'Train', icon: 'barbell-outline',    iconActive: 'barbell' },
  { id: 'ruck',       label: 'Ruck',  icon: 'footsteps-outline',  iconActive: 'footsteps' },
  { id: 'fuel',       label: 'Fuel',  icon: 'restaurant-outline', iconActive: 'restaurant' },
  { id: 'analytics',  label: 'Intel', icon: 'analytics-outline',  iconActive: 'analytics' },
  { id: 'instructor', label: 'Coach', icon: 'people-outline',     iconActive: 'people' },
];

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('home');
  const [typedText, setTypedText] = useState('');
  const prevTabIndex = useRef(0);
  const slideAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const pulseAnim = useRef(new Animated.Value(0.3)).current;

  const store = useDataStore();
  const pin = usePinLock({
    savedPinEncoded: store.savedPinEncoded,
    setSavedPinEncoded: store.setSavedPinEncoded,
    wipeData: store.wipeData,
  });
  const cloud = useCloudSync({
    sessions: store.sessions,
    members: store.members,
    isReady: store.isReady,
    applyCloudSnapshot: store.applyCloudSnapshot,
  });

  const appReady = store.isReady && cloud.authReady;

  // Typewriter boot animation — keeps running until both data and auth are ready.
  useEffect(() => {
    if (appReady) return;
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
  }, [appReady]);

  // Pulse animation for the loading screen brand text.
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1,   duration: 800, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 0.3, duration: 800, useNativeDriver: true }),
      ])
    ).start();
  }, [pulseAnim]);

  // Inject PWA metadata on web.
  useEffect(() => {
    if (!isWeb) return;

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
      navigator.serviceWorker
        .register(new URL('sw.js', window.location.href).toString())
        .catch((err) => console.warn('Service worker registration failed', err));
    }
  }, []);

  // Slide + fade transition when the active tab changes.
  useEffect(() => {
    const currentIndex = tabs.findIndex((t) => t.id === activeTab);
    const prevIndex = prevTabIndex.current;
    if (currentIndex !== prevIndex) {
      const direction = currentIndex > prevIndex ? 1 : -1;
      slideAnim.setValue(direction * 40);
      fadeAnim.setValue(0);
      Animated.parallel([
        Animated.timing(slideAnim, { toValue: 0, duration: 250, useNativeDriver: true }),
        Animated.timing(fadeAnim,  { toValue: 1, duration: 250, useNativeDriver: true }),
      ]).start();
      prevTabIndex.current = currentIndex;
    }
  }, [activeTab, slideAnim, fadeAnim]);

  const switchTab = useCallback((newTab: Tab) => {
    if (activeTab !== newTab) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setActiveTab(newTab);
    }
  }, [activeTab]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponderCapture: () => {
          pin.resetInactivityTimer();
          return false;
        },
        onMoveShouldSetPanResponderCapture: (_, { dx, dy }) => {
          pin.resetInactivityTimer();
          return Math.abs(dx) > Math.abs(dy) * 2 && Math.abs(dx) > 30;
        },
        onPanResponderRelease: (_, { dx }) => {
          if (Math.abs(dx) > 60) {
            const currentIndex = tabs.findIndex((t) => t.id === activeTab);
            if (dx < 0 && currentIndex < tabs.length - 1) switchTab(tabs[currentIndex + 1].id);
            else if (dx > 0 && currentIndex > 0)          switchTab(tabs[currentIndex - 1].id);
          }
        },
      }),
    [activeTab, pin.resetInactivityTimer, switchTab]
  );

  function renderScreen() {
    switch (activeTab) {
      case 'train':
        return <TrainScreen addSession={store.addSession} sessions={store.sessions} />;
      case 'ruck':
        return <RuckScreen addSession={store.addSession} />;
      case 'fuel':
        return <FuelScreen sessions={store.sessions} />;
      case 'analytics':
        return (
          <AnalyticsScreen
            sessions={store.sessions}
            deleteSession={store.deleteSession}
            editSession={store.editSession}
          />
        );
      case 'instructor':
        return (
          <InstructorScreen
            pinEnabled={pin.pinEnabled}
            sessions={store.sessions}
            members={store.members}
            onSetPin={pin.handleSetPin}
            onWipe={pin.handleManualWipe}
            onExport={store.exportData}
            onImport={store.importData}
            onAddMember={store.addMember}
            onUpdateMember={store.updateMember}
            cloudEnabled={isSupabaseConfigured}
            cloudStatus={cloud.cloudStatus}
            cloudEmail={cloud.cloudSession?.user.email ?? null}
            onCloudSignOut={cloud.signOutCloud}
          />
        );
      default:
        return (
          <HomeScreen
            sessions={store.sessions}
            goToRuck={() => switchTab('ruck')}
            goToAnalytics={() => switchTab('analytics')}
            deleteSession={store.deleteSession}
            editSession={store.editSession}
          />
        );
    }
  }

  // ── Loading screen ───────────────────────────────────────
  if (!appReady) {
    return (
      <View style={styles.lockScreen}>
        <View style={styles.lockContent}>
          <Animated.Text
            style={[
              styles.brand,
              {
                opacity: pulseAnim,
                transform: [{ scale: pulseAnim.interpolate({ inputRange: [0.3, 1], outputRange: [0.95, 1.05] }) }],
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

  // ── Auth screen ──────────────────────────────────────────
  if (isSupabaseConfigured && !cloud.cloudSession) {
    return (
      <AuthScreen
        loading={cloud.authLoading}
        error={cloud.authError}
        onSignIn={cloud.signInWithEmail}
        onSignUp={cloud.signUpWithEmail}
      />
    );
  }

  // ── PIN lock screen ──────────────────────────────────────
  if (pin.pinEnabled && !pin.isUnlocked) {
    return (
      <View style={styles.lockScreen}>
        <View style={styles.lockContent}>
          <Text style={styles.brand}>// FORGE</Text>
          <Text style={styles.lockSub}>Enter PIN to access tactical dashboard.</Text>
          <View style={styles.pinWrapper}>
            <View style={styles.pinDisplay}>
              {Array.from({ length: pin.pinLength }, (_, i) => (
                <View key={i} style={[styles.pinBox, pin.pinInput.length > i && styles.pinBoxFilled]}>
                  <Text style={styles.pinDot}>{pin.pinInput.length > i ? '•' : ''}</Text>
                </View>
              ))}
            </View>
            <TextInput
              style={styles.hiddenInput}
              keyboardType="number-pad"
              maxLength={pin.pinLength}
              value={pin.pinInput}
              onChangeText={pin.handlePinInput}
              autoFocus
            />
          </View>
          <Text style={styles.pinErrorText}>{pin.pinError ? 'Incorrect PIN' : ' '}</Text>
        </View>
      </View>
    );
  }

  // ── Main app ─────────────────────────────────────────────
  return (
    <View style={styles.app} {...panResponder.panHandlers}>
      <ErrorBoundary>
        <Animated.View style={[styles.screenContainer, { opacity: fadeAnim, transform: [{ translateX: slideAnim }] }]}>
          {renderScreen()}
        </Animated.View>
      </ErrorBoundary>

      {/* PIN setup overlay */}
      {pin.pinSetupMode && (
        <View style={styles.pinSetupOverlay}>
          <View style={[styles.pinSetupPanel, shadow.card]}>
            <View style={styles.pinSetupHeader}>
              <View>
                <Text style={styles.pinSetupKicker}>APP LOCK</Text>
                <Text style={styles.pinSetupTitle}>{pin.pinSetupMode === 'set' ? 'Set PIN' : 'Change PIN'}</Text>
              </View>
              <Pressable style={styles.pinSetupClose} onPress={pin.closePinSetup} accessibilityRole="button" accessibilityLabel="Close PIN setup">
                <Ionicons name="close" size={20} color={colours.text} />
              </Pressable>
            </View>

            <Text style={styles.pinSetupCopy}>Use 4 to 8 digits. Entering 0000 at lock screen still performs duress wipe.</Text>

            <TextInput
              style={styles.pinSetupInput}
              keyboardType="number-pad"
              secureTextEntry
              maxLength={8}
              placeholder="New PIN"
              placeholderTextColor={colours.soft}
              value={pin.newPinInput}
              onChangeText={pin.setNewPinInput}
            />
            <TextInput
              style={styles.pinSetupInput}
              keyboardType="number-pad"
              secureTextEntry
              maxLength={8}
              placeholder="Confirm PIN"
              placeholderTextColor={colours.soft}
              value={pin.confirmPinInput}
              onChangeText={pin.setConfirmPinInput}
            />

            <Text style={styles.pinSetupError}>{pin.pinSetupError || ' '}</Text>

            <Pressable style={styles.pinSetupButton} onPress={pin.savePinSetup}>
              <Text style={styles.pinSetupButtonText}>Save PIN</Text>
            </Pressable>
          </View>
        </View>
      )}

      {/* Tab bar */}
      <View style={[styles.tabBar, shadow.card]}>
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
                <View style={styles.activePill}>
                  <Ionicons name={tab.iconActive} size={18} color={colours.background} />
                  <Text style={styles.activePillLabel}>{tab.label}</Text>
                </View>
              ) : (
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
  activePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colours.cyan,
    borderRadius: 20,
    paddingHorizontal: 9,
    paddingVertical: 7,
    ...shadow.cyan,
  },
  activePillLabel: {
    color: colours.background,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.4,
  },
  inactiveItem: {
    alignItems: 'center',
    gap: 3,
  },
  inactiveLabel: {
    color: colours.muted,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
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
  pinSetupOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 20,
    justifyContent: 'center',
    padding: 20,
    backgroundColor: 'rgba(0,0,0,0.62)',
  },
  pinSetupPanel: {
    borderWidth: 1,
    borderColor: colours.border,
    borderRadius: 20,
    padding: 18,
    backgroundColor: colours.surface,
  },
  pinSetupHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  pinSetupKicker: {
    color: colours.cyan,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.8,
  },
  pinSetupTitle: {
    color: colours.text,
    fontSize: 24,
    fontWeight: '900',
    marginTop: 3,
  },
  pinSetupClose: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.07)',
  },
  pinSetupCopy: {
    color: colours.muted,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 10,
    marginBottom: 14,
  },
  pinSetupInput: {
    borderWidth: 1,
    borderColor: colours.borderSoft,
    borderRadius: 14,
    color: colours.text,
    backgroundColor: 'rgba(255,255,255,0.05)',
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 10,
    fontSize: 16,
    fontWeight: '800',
  },
  pinSetupError: {
    minHeight: 18,
    color: colours.red,
    fontSize: 12,
    fontWeight: '800',
    marginBottom: 8,
  },
  pinSetupButton: {
    alignItems: 'center',
    backgroundColor: colours.cyan,
    borderRadius: 16,
    paddingVertical: 13,
  },
  pinSetupButtonText: {
    color: colours.background,
    fontSize: 15,
    fontWeight: '900',
  },
});
